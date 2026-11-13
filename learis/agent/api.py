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
from core import ai, identity, registry, space, store
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
                 "server_ai_model": CFG.ai_model if CFG.server_ai else None,
                 "server_ai_provider": ("Amazon Bedrock" if "bedrock-mantle." in CFG.ai_base_url else "custom")
                 if CFG.server_ai else None,
                 "auto_delete_default": CFG.auto_delete}


@route("POST", r"/login")
def login(_m, b, _h):
    try:
        u = identity.log_in(b.get("email", ""), b.get("password", ""))
    except NotAuthorised as e:
        return 401, {"error": str(e)}
    return 200, {"token": identity.issue_token(u),
                 "user": {"name": u.name, "email": u.email, "role": u.role}}


@route("POST", r"/signup")
def signup(_m, b, _h):
    """Anyone may create a student account: a friend invited to a group needs
    one before the invite link means anything. LEARIS_SIGNUP=0 closes it."""
    if os.environ.get("LEARIS_SIGNUP", "1") == "0":
        return 403, {"error": "sign-up is closed on this deployment"}
    email = str(b.get("email") or "").strip().lower()
    name = str(b.get("name") or "").strip()[:80]
    password = str(b.get("password") or "")
    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return 400, {"error": "give a valid email address"}
    if not name:
        return 400, {"error": "give your name"}
    if len(password) < 8:
        return 400, {"error": "the password needs at least 8 characters"}
    try:
        u = identity.add_user(email, name, "student", password)
    except Exception:                                              # noqa: BLE001
        return 409, {"error": "an account with that email already exists"}
    space.personal(u.id)
    return 201, {"token": identity.issue_token(u),
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
def list_runs(_m, b, h):
    u = _user(h)
    if b.get("ws"):
        space.role_in(u.id, b["ws"])
        rows = store.runs_in_workspace(b["ws"])
    else:
        rows = store.runs(u.id, 40)
    if b.get("kind"):
        rows = [r for r in rows if (r.get("kind") or "pack") == b["kind"]]
    return 200, {"runs": rows}


@route("GET", r"/runs/([A-Za-z0-9_]+)")
def one_run(m, _b, h):
    u = _user(h)
    r = store.run(m.group(1))
    # Yours, or a run in a workspace you are a member of.
    if r and r["user_id"] != u.id:
        if not r.get("workspace_id"):
            r = None
        else:
            space.role_in(u.id, r["workspace_id"])
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
    """Everything about this person goes: their Skill Gap record, their runs and
    chats, their personal workspace with its files, pages, tasks and agents,
    their place in every group, and the account itself. A group they own passes
    to its longest-standing other member, or is deleted when nobody else is in it."""
    u = _user(h)
    if b.get("confirm") != "delete":
        return 400, {"error": "send {\"confirm\": \"delete\"} to delete everything"}
    with store.connect() as c:
        for table in ("evidence", "documents", "outputs", "reminders", "students"):
            c.execute(f"DELETE FROM {table} WHERE user_id=?", (u.id,))
        c.execute("DELETE FROM steps WHERE run_id IN (SELECT id FROM runs WHERE user_id=?)", (u.id,))
        c.execute("DELETE FROM runs WHERE user_id=?", (u.id,))
        c.execute("DELETE FROM workspaces WHERE owner_id=? AND kind='personal'", (u.id,))
        # A group they own passes to its longest-standing other member; one with nobody else goes.
        for (gid,) in c.execute("SELECT id FROM workspaces WHERE owner_id=?", (u.id,)).fetchall():
            heir = c.execute("SELECT user_id FROM members WHERE workspace_id=? AND user_id!=?"
                             " ORDER BY joined_at LIMIT 1", (gid, u.id)).fetchone()
            if heir:
                c.execute("UPDATE workspaces SET owner_id=? WHERE id=?", (heir[0], gid))
                c.execute("UPDATE members SET role='owner' WHERE workspace_id=? AND user_id=?", (gid, heir[0]))
            else:
                c.execute("DELETE FROM workspaces WHERE id=?", (gid,))
        c.execute("DELETE FROM members WHERE user_id=?", (u.id,))
        # and the account itself: name, email and password hash. Its tokens stop working at once.
        c.execute("DELETE FROM users WHERE id=?", (u.id,))
    return 200, {"deleted": True}


import workspace_api  # noqa: E402  (registers its routes on this router)

workspace_api.register(route, _user)

# ----------------------------------------------------------------- server
PUBLIC = {("GET", "/health"), ("POST", "/login"), ("POST", "/signup")}
CORS = {"Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "content-type,authorization,accept,x-learis-ai,x-learis-ws",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"}


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send(self, code: int, data: Any) -> None:
        if isinstance(data, dict) and isinstance(data.get("__file__"), bytes):
            # A download (a Word export): bytes with a filename, never JSON.
            blob, name = data["__file__"], re.sub(r'[^\w.\- ]', "_", str(data.get("name") or "file"))
            self.send_response(code)
            self.send_header("Content-Type", str(data.get("type") or "application/octet-stream"))
            self.send_header("Content-Length", str(len(blob)))
            self.send_header("Content-Disposition", f'attachment; filename="{name}"')
            self.end_headers()
            self.wfile.write(blob)
            return
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
                # Read what was sent before answering, or the client sees a broken connection
                # instead of this message. Past 32 MB, just hang up.
                left = n if n <= 32 * 1024 * 1024 else 0
                while left > 0:
                    chunk = self.rfile.read(min(left, 1 << 16))
                    if not chunk:
                        break
                    left -= len(chunk)
                self.close_connection = True
                return self._send(413, {"error": f"the request is too large (a document can have up to {MAX_TEXT:,} characters)"})
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
                except space.Denied as e:
                    return self._send(403, {"error": str(e)})
                except space.NotFound as e:
                    return self._send(404, {"error": str(e)})
                except ValueError as e:
                    return self._send(400, {"error": str(e)})
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
                # The same mapping Handler._dispatch applies.
                try:
                    return fn(pattern.match(path), body or {}, headers)
                except space.Denied as e:
                    return 403, {"error": str(e)}
                except space.NotFound as e:
                    return 404, {"error": str(e)}
                except ValueError as e:
                    return 400, {"error": str(e)}
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
    assert call("POST", "/signup", {"email": "baru@kampus.ac.id", "name": "Baru", "password": "short"})[0] == 400
    code, su = call("POST", "/signup", {"email": "baru@kampus.ac.id", "name": "Baru", "password": "pw-long-enough"})
    assert code == 201 and su["token"]
    assert call("POST", "/signup", {"email": "baru@kampus.ac.id", "name": "B", "password": "pw-long-enough"})[0] == 409
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
    # ---- the workspace: a group, an invite, shared files, pages, tasks, agents
    personal_ws = call("GET", "/workspaces")[1]["workspaces"][0]
    assert personal_ws["kind"] == "personal"
    code, g = call("POST", "/workspaces", {"name": "Kelompok Basis Data", "purpose": "Tugas besar"})
    assert code == 201
    tok = call("POST", f"/workspaces/{g['id']}/invite")[1]["token"]
    assert call("GET", f"/invites/{tok}", headers=h2)[1]["name"] == "Kelompok Basis Data"
    assert call("GET", "/files", {"ws": g["id"]}, headers=h2)[0] == 403, "not a member before accepting"
    assert call("POST", f"/invites/{tok}/accept", headers=h2)[0] == 200
    code, f = call("POST", "/files", {"ws": g["id"], "name": "modul-1.txt", "collection": "Basis Data",
                                      "text": "Normalisasi mengurangi redundansi data dalam tabel relasional."},
                   headers=h2)
    assert code == 201 and call("GET", "/collections", {"ws": g["id"]})[1]["collections"][0]["name"] == "Basis Data"
    bad_src = call("POST", "/pages", {"ws": g["id"], "title": "x", "content": "y",
                                      "sources": [{"file_id": f["id"], "quote": "not in the file"}]})
    assert bad_src[0] == 400, "a page cannot cite what the file does not say"
    code, pg = call("POST", "/pages", {"ws": g["id"], "title": "Catatan", "content": "Normalisasi [1].",
                                       "sources": [{"file_id": f["id"], "quote": "Normalisasi mengurangi redundansi"}]})
    assert code == 201 and call("GET", f"/pages/{pg['id']}/review")[1]["ok"]
    assert call("GET", f"/pages/{pg['id']}", headers={"Authorization": h["Authorization"]})[0] == 200
    code, t = call("POST", "/tasks", {"ws": g["id"], "title": "Buat ERD", "assignee_type": "user",
                                      "assignee_id": other.id, "estimate_hours": 2})
    assert code == 201
    assert call("POST", f"/tasks/{t['id']}", {"status": "done"}, headers=h2)[1]["status"] == "done"
    code, ag = call("POST", "/workspace-agents", {"ws": g["id"], "name": "Quiz Maker", "description": "Quizzes",
                    "instructions": "Write a short quiz page from the course files, with sources.",
                    "tools": ["list_files", "read_file", "create_page"], "shared": True})
    assert code == 201 and any(a["id"] == ag["id"] for a in call("GET", "/gallery")[1]["agents"])
    assert call("POST", "/workspace-agents", {"ws": g["id"], "name": "Bad", "description": "x",
                "instructions": "long enough instructions here", "tools": ["rm_rf"]})[0] == 400
    assert call("POST", f"/gallery/{ag['id']}/install", {"ws": personal_ws["id"]})[0] == 201
    assert len(call("GET", "/tools")[1]["tools"]) >= 10
    assert call("POST", "/ask", {"ws": g["id"], "request": "Ringkas modul"})[0] == 400, "no tool-calling model"
    import workspace_api as wa
    hist = wa.history_of({"history": [{"role": "user", "content": "a"}, {"role": "system", "content": "x"},
                                      {"role": "assistant", "content": "b" * 9000}] * 10})
    assert len(hist) == wa.HISTORY_TURNS and {t["role"] for t in hist} <= {"user", "assistant"}
    assert max(len(t["content"]) for t in hist) <= wa.HISTORY_CHARS, "history is cut to size"
    gi = call("GET", "/group-impact", {"ws": g["id"]})[1]
    assert gi["members"] == 2 and gi["tasks_done_by_people"] == 1
    code, rep_page = call("POST", "/group-report", {"ws": g["id"]})
    assert code == 201 and "Kelompok Basis Data" in rep_page["title"]
    assert call("POST", f"/workspaces/{g['id']}/members/{u.id}/remove", headers=h2)[0] in (400, 403)

    assert call("POST", "/me/delete", {})[0] == 400
    assert call("POST", "/me/delete", {"confirm": "delete"})[1]["deleted"]
    try:
        call("GET", "/files", {"ws": personal_ws["id"]})
        raise AssertionError("a deleted account's token must stop working")
    except identity.NotAuthorised:
        pass
    with store.connect() as c:
        left = {t: c.execute(f"SELECT count(*) FROM {t} WHERE {col}=?", (u.id,)).fetchone()[0]
                for t, col in (("users", "id"), ("documents", "user_id"), ("runs", "user_id"), ("members", "user_id"))}
        assert not any(left.values()), left
        assert not c.execute("SELECT 1 FROM workspaces WHERE id=?", (personal_ws["id"],)).fetchone()
        heir = c.execute("SELECT owner_id FROM workspaces WHERE id=?", (g["id"],)).fetchone()
        assert heir and heir[0] != u.id, "the group they owned passes to its other member"
    print(f"api ok: {len(ROUTES)} routes · all but /health and /login need a session · "
          "students see only their own record · a full run through the API · delete-me removes the account and its data")


if __name__ == "__main__":
    if "--check" in sys.argv:
        from core.config import fixtures_only
        fixtures_only(__file__, "LEARIS_API_CHECK")
        demo()
        raise SystemExit(0)
    print(f"LEARIS API · env={CFG.env} · server AI: {'yes' if CFG.server_ai else 'no (BYOK only)'} "
          f"· {POOL.size} worker(s) · scheduler {'on' if SCHEDULER.enabled else 'off'}")
    from agents import workspace as agents_ws
    seeded = agents_ws.seed_gallery()
    if seeded:
        print(f"  community gallery started with {seeded} agents")
    # A run left queued or running by a previous process will never finish.
    n = store.fail_stale_runs(older_than_minutes=0)
    if n:
        print(f"  closed {n} run(s) left over from the last process")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"listening on http://{HOST}:{PORT}")
    SCHEDULER.start()
    server.serve_forever()
