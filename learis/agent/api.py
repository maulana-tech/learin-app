"""LEARIS HTTP service: Skill Gap Radar's agent backend.

# ponytail: stdlib http.server, zero dependencies. Move to FastAPI + uvicorn if
#           this needs async, websockets, or more than a few requests a second.

    python3 api.py                 # listen on :8787
    python3 api.py --check         # call every route against a scratch database

Every route but /health and /login needs a session, and every query is scoped
to the student in the session token.

The student's own AI settings travel in the X-Learis-AI header (base64 JSON,
see core/ai.py). They are used for that request and never stored or logged.

Endpoints
    GET  /health                       readiness
    POST /login                        {email, password}
    GET  /me
    GET  /catalog                      roles, regions, skill categories, AI presets
    GET  /agents                       the team, P0 and what comes next
    GET  /student · POST /student      target role, region, free hours, exam weeks,
                                       profile text, consent, auto-delete
    GET  /documents
    POST /documents                    {kind, title, text}
    POST /documents/github             {url}
    POST /documents/{id}/delete
    POST /documents/reanalyse          analyse every kept text again
    POST /analyze                      start a run of the agent team → {run_id}
    GET  /runs · GET /runs/{id}        the agent panel: every step of a run
    GET  /skills                       every skill with evidence, its quotes and confidence
    GET  /gap · /roadmap · /plan · /profile   the latest output of each agent
    POST /plan                         {hours_per_week?, exam_weeks?, plan_start?} replan now
    GET  /impact                       hidden skills found, match before and after
    POST /ai/test                      one real call with the AI settings in the header
    POST /me/delete                    delete everything stored about me
    GET  /reminders · POST /reminders/{id}/done   the weekly check-in
    GET  /jobs                         workers and scheduled jobs
    POST /jobs/{name}/run              run a scheduled job now (admin)
    POST /mcp                          the same skills as an MCP server, for the student's own agent
"""
from __future__ import annotations

import json
import os
import re
import sys
import threading
import traceback
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Callable, Dict, List, Tuple
from urllib.parse import parse_qs, urlparse

import mcp
from agents import team
from core import ai, identity, registry, store
from core.jobs import SCHEDULER
from core.worker import POOL
from core.config import CFG, bind_target
from core.identity import NotAuthorised, User
from engine import catalog, evidence, planner
from sources import github

HOST, PORT = bind_target(os.environ)
ROUTES: List[Tuple[str, "re.Pattern[str]", Callable]] = []
MAX_TEXT = 200_000          # characters in one uploaded document
_RUNNING: Dict[str, str] = {}          # student -> their queued or running run
_RUN_LOCK = threading.Lock()


def _user(headers) -> User:
    """Identity comes ONLY from the token. Never from the request body."""
    auth = headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise NotAuthorised("a session token is required")
    return identity.from_token(auth[7:])


def route(method: str, pattern: str) -> Callable:
    r = re.compile("^" + pattern + "$")

    def wrap(fn: Callable) -> Callable:
        ROUTES.append((method, r, fn))
        return fn
    return wrap


def _ai(headers):
    """The AI settings for this request, or None. A broken header is an error
    the student should see, not a silent fall back to rules."""
    return ai.resolve(headers.get("X-Learis-AI"))


# ----------------------------------------------------------------- basics
@route("GET", r"/health")
def health(_m, _b, _h):
    return 200, {"ok": True, "env": CFG.env, "server_ai": CFG.server_ai,
                 "auto_delete_default": CFG.auto_delete}


@route("POST", r"/login")
def login(_m, b, _h):
    try:
        u = identity.log_in(b.get("email", ""), b.get("password", ""))
    except NotAuthorised as e:
        return 401, {"error": str(e)}
    return 200, {"token": identity.issue_token(u),
                 "user": {"name": u.name, "email": u.email, "role": u.role}}


@route("GET", r"/me")
def me(_m, _b, h):
    u = _user(h)
    return 200, {"name": u.name, "email": u.email, "role": u.role}


@route("GET", r"/catalog")
def get_catalog(_m, _b, h):
    _user(h)
    return 200, {
        "roles": [{"id": r["id"], "name": r["name"], "summary": r["summary"],
                   "skills": len(r["requires"])} for r in catalog.roles()],
        "regions": catalog.regions(),
        "categories": catalog.categories(),
        "skills": len(catalog.skills()),
        "doc_kinds": list(store.DOC_KINDS),
        "ai_presets": {k: v for k, v in ai.PRESETS.items()},
        "server_ai": CFG.server_ai,
    }


@route("GET", r"/agents")
def agents(_m, _b, h):
    _user(h)
    as_dict = lambda a: {"code": a.code, "name": a.name, "priority": a.priority,  # noqa: E731
                         "brief": a.brief, "uses_ai": a.uses_ai,
                         "tools": [{"name": t.name, "description": t.description, "writes": t.writes}
                                   for t in registry.tools_for(a.code)]}
    return 200, {"team": [as_dict(a) for a in team.TEAM],
                 "planned": [as_dict(a) for a in team.PLANNED]}


# ---------------------------------------------------------------- student
@route("GET", r"/student")
def get_student(_m, _b, h):
    return 200, store.student(_user(h).id)


@route("POST", r"/student")
def set_student(_m, b, h):
    u = _user(h)
    fields: Dict[str, Any] = {}
    if "target_role" in b:
        if b["target_role"] and not catalog.role(str(b["target_role"])):
            return 400, {"error": f"unknown role '{b['target_role']}'"}
        fields["target_role"] = b["target_role"] or None
    if "region" in b:
        if b["region"] and b["region"] not in {r["id"] for r in catalog.regions()}:
            return 400, {"error": f"unknown region '{b['region']}'"}
        fields["region"] = b["region"] or None
    if "hours_per_week" in b:
        try:
            hours = float(b["hours_per_week"])
        except (TypeError, ValueError):
            return 400, {"error": "hours_per_week must be a number"}
        if not 1 <= hours <= 60:
            return 400, {"error": "hours_per_week must be between 1 and 60"}
        fields["hours_per_week"] = hours
    if "exam_weeks" in b:
        weeks = b["exam_weeks"] or []
        if not isinstance(weeks, list) or any(not isinstance(w, int) or not 1 <= w <= 4 for w in weeks):
            return 400, {"error": "exam_weeks must be a list of week numbers from 1 to 4"}
        fields["exam_weeks"] = sorted(set(weeks))
    if "plan_start" in b:
        if b["plan_start"]:
            try:
                fields["plan_start"] = planner.monday(date.fromisoformat(str(b["plan_start"]))).isoformat()
            except ValueError:
                return 400, {"error": "plan_start must be a date, YYYY-MM-DD"}
        else:
            fields["plan_start"] = None
    if "profile_text" in b:
        fields["profile_text"] = (str(b["profile_text"] or "")[:20_000]) or None
    if "consent" in b:
        fields["consent_at"] = store._now() if b["consent"] else None
    if "auto_delete" in b:
        fields["auto_delete"] = bool(b["auto_delete"])
    return 200, store.update_student(u.id, **fields)


# -------------------------------------------------------------- documents
@route("GET", r"/documents")
def list_documents(_m, _b, h):
    return 200, {"documents": store.documents(_user(h).id)}


@route("POST", r"/documents")
def add_document(_m, b, h):
    u = _user(h)
    kind = str(b.get("kind") or "other")
    text = str(b.get("text") or "").strip()
    title = str(b.get("title") or "").strip()[:200]
    if kind not in store.DOC_KINDS:
        return 400, {"error": f"kind must be one of {', '.join(store.DOC_KINDS)}"}
    if len(text) < 20:
        return 400, {"error": "the document has no readable text (at least 20 characters)"}
    if len(text) > MAX_TEXT:
        return 400, {"error": f"the document is longer than {MAX_TEXT:,} characters"}
    if not title:
        return 400, {"error": "give the document a title"}
    d = store.add_document(u.id, kind, title, text, b.get("source_url") or None)
    return 201, d


@route("POST", r"/documents/github")
def add_github(_m, b, h):
    u = _user(h)
    try:
        repo = github.fetch(str(b.get("url") or ""))
    except github.GitHubError as e:
        return 400, {"error": str(e)}
    d = store.add_document(u.id, "github", repo["title"], repo["text"], repo["source_url"])
    return 201, d


@route("POST", r"/documents/reanalyse")
def reanalyse(_m, _b, h):
    u = _user(h)
    store.reset_documents(u.id)
    return 200, {"pending": len(store.pending_documents(u.id))}


@route("POST", r"/documents/([A-Za-z0-9_]+)/delete")
def delete_document(m, _b, h):
    u = _user(h)
    if not store.delete_document(u.id, m.group(1)):
        return 404, {"error": "no such document"}
    return 200, {"deleted": m.group(1)}


# ------------------------------------------------------------------- runs
def _work(user_id: str, run_id: str, cfg) -> None:
    try:
        store.set_run_status(run_id, "running")
        team.run(user_id, run_id, cfg)
    finally:
        with _RUN_LOCK:
            _RUNNING.pop(user_id, None)


@route("POST", r"/analyze")
def analyze(_m, _b, h):
    u = _user(h)
    try:
        cfg = _ai(h)
    except ai.AIError as e:
        return 400, {"error": str(e)}
    with _RUN_LOCK:
        if u.id in _RUNNING:
            return 409, {"error": "a run is already going", "run_id": _RUNNING[u.id]}
        rid = store.start_run(u.id, cfg.label if cfg else None, status="queued")
        _RUNNING[u.id] = rid
    POOL.submit(f"run {rid}", _work, u.id, rid, cfg)
    return 202, {"run_id": rid, "queue": POOL.status()}


@route("GET", r"/runs")
def list_runs(_m, _b, h):
    return 200, {"runs": store.runs(_user(h).id)}


@route("GET", r"/runs/([A-Za-z0-9_]+)")
def one_run(m, _b, h):
    r = store.run(m.group(1), _user(h).id)
    return (200, r) if r else (404, {"error": "no such run"})


# ---------------------------------------------------------------- outputs
@route("GET", r"/skills")
def skills(_m, _b, h):
    u = _user(h)
    prof = evidence.profile(store.evidence(u.id))
    st = store.student(u.id)
    hidden = set(evidence.hidden(prof, st.get("profile_text")))
    rows = sorted(prof.values(), key=lambda p: -p["confidence"])
    return 200, {"skills": [p | {"hidden": p["skill_id"] in hidden} for p in rows],
                 "hidden": len(hidden), "thresholds": {"mastered": 0.6, "partial": 0.25}}


def _output(kind: str):
    def handler(_m, _b, h):
        o = store.output(_user(h).id, kind)
        return 200, o or {"payload": None}
    return handler


for _kind in ("gap", "roadmap", "plan", "profile"):
    route("GET", "/" + _kind)(_output(_kind))


@route("POST", r"/plan")
def replan(_m, b, h):
    """Change free hours or exam weeks and get the new plan at once. No model:
    the hours are arithmetic, and waiting on a model to redo arithmetic is how
    a plan stops being adjusted."""
    u = _user(h)
    if any(k in b for k in ("hours_per_week", "exam_weeks", "plan_start")):
        code, out = set_student(None, {k: b[k] for k in ("hours_per_week", "exam_weeks", "plan_start")
                                       if k in b}, h)
        if code != 200:
            return code, out
    rm = store.output(u.id, "roadmap")
    if not rm:
        return 409, {"error": "no roadmap yet: choose a target role and run the analysis"}
    st = store.student(u.id)
    start = date.fromisoformat(st["plan_start"]) if st.get("plan_start") else None
    plan = planner.build(rm["payload"], float(st["hours_per_week"]), st["exam_weeks"], start)
    store.save_output(u.id, "plan", plan, rm["run_id"])
    return 200, {"payload": plan}


@route("GET", r"/impact")
def impact(_m, _b, h):
    u = _user(h)
    prof = evidence.profile(store.evidence(u.id))
    st = store.student(u.id)
    base, now = store.output(u.id, "baseline"), store.output(u.id, "gap")
    plan = store.output(u.id, "plan")
    return 200, {
        "documents": len(store.documents(u.id)),
        "skills_with_evidence": len(prof),
        "hidden_skills": len(evidence.hidden(prof, st.get("profile_text"))),
        "verified_skills": sum(1 for p in prof.values() if p["verified"]),
        "match_before": base["payload"]["match"] if base else None,
        "radar_before": base["payload"].get("radar") if base else None,
        "baseline_role": base["payload"].get("role") if base else None,
        "match_now": now["payload"]["match"] if now else None,
        "planned_hours": plan["payload"]["planned_hours"] if plan else None,
        "runs": len(store.runs(u.id, 1000)),
    }


# --------------------------------------------------------------------- ai
@route("POST", r"/ai/test")
def ai_test(_m, _b, h):
    _user(h)
    try:
        cfg = _ai(h)
        if not cfg:
            return 400, {"ok": False, "error": "no AI settings were sent"}
        return 200, ai.test(cfg)
    except ai.AIError as e:
        return 200, {"ok": False, "error": str(e)}


@route("GET", r"/reminders")
def get_reminders(_m, _b, h):
    return 200, {"reminders": store.reminders(_user(h).id)}


@route("POST", r"/reminders/([A-Za-z0-9_]+)/done")
def reminder_done(m, b, h):
    if not store.finish_reminder(_user(h).id, m.group(1), (b.get("note") or None)):
        return 404, {"error": "no open reminder with that id"}
    return 200, {"done": m.group(1)}


@route("GET", r"/jobs")
def jobs(_m, _b, h):
    _user(h)
    return 200, {"workers": POOL.status(), "scheduler_on": SCHEDULER.enabled, "jobs": SCHEDULER.describe()}


@route("POST", r"/jobs/([a-z_]+)/run")
def job_run(m, _b, h):
    if _user(h).role != "admin":
        return 403, {"error": "only an admin runs scheduled jobs by hand"}
    out = SCHEDULER.run_now(m.group(1))
    return (200, {"result": out}) if out is not None else (404, {"error": "no such job"})


@route("POST", r"/mcp")
def mcp_endpoint(_m, b, h):
    u = _user(h)
    out = mcp.handle(b, u.id)
    return 200, out if out is not None else {}


@route("POST", r"/me/delete")
def delete_me(_m, b, h):
    """Everything about this student goes: documents, evidence, outputs, runs."""
    u = _user(h)
    if b.get("confirm") != "delete":
        return 400, {"error": "send {\"confirm\": \"delete\"} to delete everything"}
    with store.connect() as c:
        for table in ("evidence", "documents", "outputs", "reminders", "students"):
            c.execute(f"DELETE FROM {table} WHERE user_id=?", (u.id,))
        c.execute("DELETE FROM steps WHERE run_id IN (SELECT id FROM runs WHERE user_id=?)", (u.id,))
        c.execute("DELETE FROM runs WHERE user_id=?", (u.id,))
    return 200, {"deleted": True}


# ----------------------------------------------------------------- server
PUBLIC = {("GET", "/health"), ("POST", "/login")}
CORS = {"Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type,authorization,accept,x-learis-ai",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send(self, code: int, data: Any) -> None:
        body = json.dumps(data, ensure_ascii=False, default=str).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:          # noqa: N802
        self.send_response(204)
        for k, v in CORS.items():
            self.send_header(k, v)
        self.end_headers()

    def _dispatch(self, method: str) -> None:
        parts = urlparse(self.path)
        path = parts.path.rstrip("/") or "/health"
        body: Dict[str, Any] = {k: v[0] for k, v in parse_qs(parts.query).items()}
        if method == "POST":
            n = int(self.headers.get("Content-Length") or 0)
            if n > 4 * MAX_TEXT:
                return self._send(413, {"error": "the request is too large"})
            if n:
                try:
                    body = json.loads(self.rfile.read(n))
                except json.JSONDecodeError:
                    return self._send(400, {"error": "the body is not valid JSON"})
                if not isinstance(body, dict):
                    return self._send(400, {"error": "the body must be a JSON object"})
        for m, pattern, fn in ROUTES:
            if m != method:
                continue
            found = pattern.match(path)
            if found:
                try:
                    code, data = fn(found, body, self.headers)
                except NotAuthorised as e:
                    return self._send(401, {"error": str(e)})
                except Exception as e:                               # noqa: BLE001
                    traceback.print_exc()
                    return self._send(500, {"error": f"{type(e).__name__}: {e}"})
                return self._send(code, data)
        self._send(404, {"error": f"unknown route: {method} {path}"})

    def do_GET(self) -> None:              # noqa: N802
        self._dispatch("GET")

    def do_POST(self) -> None:             # noqa: N802
        self._dispatch("POST")

    def log_message(self, fmt: str, *a) -> None:
        # The path only: never a header, which is where the AI key travels.
        print(f"  {self.command} {urlparse(self.path).path} → {a[1] if len(a) > 1 else ''}")


def demo() -> None:
    """Every route, through its handler, against a scratch database."""
    import base64
    import secrets
    import time
    os.environ.setdefault("LEARIS_SECRET", secrets.token_hex(16))
    identity.SECRET = os.environ["LEARIS_SECRET"]
    u = identity.add_user("sari@kampus.ac.id", "Sari", "student", "pw-for-the-check")
    other = identity.add_user("budi@kampus.ac.id", "Budi", "student", "pw-for-the-check")
    h = {"Authorization": f"Bearer {identity.issue_token(u)}"}
    h2 = {"Authorization": f"Bearer {identity.issue_token(other)}"}

    def call(method: str, path: str, body: Dict[str, Any] = None, headers=h):
        for m, pattern, fn in ROUTES:
            if m == method and pattern.match(path):
                return fn(pattern.match(path), body or {}, headers)
        raise AssertionError(f"no route {method} {path}")

    # Every route but the public two refuses a request without a session.
    for m, pattern, fn in ROUTES:
        if (m, pattern.pattern.strip("^$")) in PUBLIC:
            continue
        sample = re.sub(r"\(\[A-Za-z0-9_\]\+\)", "x1", pattern.pattern.strip("^$"))
        try:
            fn(pattern.match(sample), {}, {})
            raise AssertionError(f"{m} {sample} answered without a session")
        except NotAuthorised:
            pass

    assert call("GET", "/health")[0] == 200
    assert call("POST", "/login", {"email": "sari@kampus.ac.id", "password": "pw-for-the-check"})[0] == 200
    assert call("POST", "/login", {"email": "sari@kampus.ac.id", "password": "no"})[0] == 401
    cat = call("GET", "/catalog")[1]
    assert {r["id"] for r in cat["roles"]} == {"junior-web-developer", "data-analyst"}

    assert call("POST", "/student", {"target_role": "astronaut"})[0] == 400
    assert call("POST", "/student", {"exam_weeks": [5]})[0] == 400
    code, st = call("POST", "/student", {"target_role": "junior-web-developer", "region": "id",
                                         "hours_per_week": 8, "exam_weeks": [3]})
    assert code == 200 and st["exam_weeks"] == [3]

    assert call("POST", "/documents", {"kind": "syllabus", "title": "x", "text": "short"})[0] == 400
    code, d = call("POST", "/documents", {"kind": "syllabus", "title": "Pemrograman Web",
                   "text": "HTML5, CSS flexbox, media query, JavaScript ES6, DOM, REST API dan MySQL."})
    assert code == 201
    call("POST", "/documents", {"kind": "project", "title": "Recipe app",
         "text": "Built with React hooks and Tailwind, tested with Jest, deployed on Vercel, Git."})
    assert call("POST", "/documents/github", {"url": "https://gitlab.com/a/b"})[0] == 400
    assert len(call("GET", "/documents", headers=h2)[1]["documents"]) == 0, "students see only their own"

    bad = {**h, "X-Learis-AI": base64.b64encode(b'{"provider": "nope"}').decode()}
    assert call("POST", "/analyze", headers=bad)[0] == 400, "broken AI settings are an error"
    code, out = call("POST", "/analyze")
    assert code == 202
    assert call("POST", "/analyze")[0] == 409, "one run at a time per student"
    for _ in range(200):
        r = call("GET", f"/runs/{out['run_id']}")[1]
        if r["status"] not in ("queued", "running"):
            break
        time.sleep(0.05)
    assert r["status"] == "done", r
    assert call("GET", f"/runs/{out['run_id']}", headers=h2)[0] == 404
    assert call("GET", "/gap")[1]["payload"]["match"] > 0
    assert call("GET", "/skills")[1]["skills"]
    before = call("GET", "/plan")[1]["payload"]["planned_hours"]
    code, p = call("POST", "/plan", {"hours_per_week": 16})
    assert code == 200 and p["payload"]["planned_hours"] > before, "more hours, more planned"
    imp = call("GET", "/impact")[1]
    assert imp["match_before"] == imp["match_now"] and imp["skills_with_evidence"] >= 8
    assert call("POST", "/ai/test")[0] == 400
    ag = call("GET", "/agents")[1]
    assert all(a["tools"] for a in ag["team"] if a["code"] != "orchestrator"), "each agent lists its tools"
    j = call("GET", "/jobs")[1]
    assert j["workers"]["workers"] >= 1 and {x["name"] for x in j["jobs"]} == {"stale_runs", "purge_text", "checkin"}
    assert call("POST", "/jobs/checkin/run")[0] == 403, "students do not run jobs"
    tl = call("POST", "/mcp", {"jsonrpc": "2.0", "id": 1, "method": "tools/list"})[1]
    assert any(t["name"] == "get_gap_map" for t in tl["result"]["tools"])
    gm = call("POST", "/mcp", {"jsonrpc": "2.0", "id": 2, "method": "tools/call",
                               "params": {"name": "get_gap_map", "arguments": {}}})[1]
    assert gm["result"]["structuredContent"]["match"] > 0, "MCP sees the same gap map"
    rem = store.add_reminder(u.id, "checkin", "How did it go?")
    assert call("GET", "/reminders")[1]["reminders"][0]["id"] == rem
    assert call("POST", f"/reminders/{rem}/done", {"note": "ok"})[0] == 200
    assert call("POST", f"/reminders/{rem}/done", {}, headers=h2)[0] == 404
    assert call("POST", "/me/delete", {})[0] == 400
    assert call("POST", "/me/delete", {"confirm": "delete"})[1]["deleted"]
    assert call("GET", "/documents")[1]["documents"] == []
    print(f"api ok: {len(ROUTES)} routes · all but /health and /login need a session · "
          "students see only their own record · a full run through the API · delete-me works")


if __name__ == "__main__":
    if "--check" in sys.argv:
        from core.config import fixtures_only
        fixtures_only(__file__, "LEARIS_API_CHECK")
        demo()
        raise SystemExit(0)
    print(f"LEARIS API · env={CFG.env} · server AI: {'yes' if CFG.server_ai else 'no (BYOK only)'} "
          f"· {POOL.size} worker(s) · scheduler {'on' if SCHEDULER.enabled else 'off'}")
    # A run left queued or running by a previous process will never finish.
    n = store.fail_stale_runs(older_than_minutes=0)
    if n:
        print(f"  closed {n} run(s) left over from the last process")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"listening on http://{HOST}:{PORT}")
    SCHEDULER.start()
    server.serve_forever()
