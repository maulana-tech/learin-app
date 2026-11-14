"""Workspace routes: groups, invites, files, pages, tasks, agents, gallery, the
Orchestrator, and group impact. Registered on api.py's router.

Every route takes the workspace as `ws` (query or body) and falls back to the
user's personal workspace; core/space.py checks membership on every read and
write.

    GET  /workspaces · POST /workspaces {name, purpose}       my workspaces; create a group
    GET  /workspaces/{id}                                     one, with members and my role
    POST /workspaces/{id}/invite                              a 7-day invite link token
    POST /workspaces/{id}/hours {hours}                       my free hours a week there
    POST /workspaces/{id}/members/{uid}/remove                leave, or remove (owner)
    GET  /invites/{token} · POST /invites/{token}/accept
    GET  /files · POST /files {name, text, collection?} · POST /files/github {url, collection?}
    POST /files/{id}/delete · GET /collections
    GET  /pages · GET /pages/{id} · POST /pages · POST /pages/{id} · POST /pages/{id}/delete
    GET  /pages/{id}/review
    GET  /tasks · POST /tasks · POST /tasks/{id} · POST /tasks/{id}/delete · POST /tasks/{id}/run
    GET  /workspace-agents · POST /workspace-agents · POST /workspace-agents/{id} · .../delete
    GET  /tools                                               what a custom agent may use
    GET  /gallery · POST /gallery/{id}/install
    POST /ask {request}                                       the Orchestrator → {run_id}
    GET  /group-impact · POST /group-report                   numbers, and a report page from them
"""
from __future__ import annotations

import re
import threading
from typing import Dict, Optional

from agents import workspace as aw
from core import academic, ai, registry, space, store
from core.worker import POOL
from sources import github

MAX_TEXT = 200_000
#: Runs each user has queued or running. Studio panels run side by side, so a
#: user may have several at once, up to MAX_PER_USER.
_ASKING: Dict[str, set] = {}
MAX_PER_USER = 4
HISTORY_TURNS = 12
HISTORY_CHARS = 4000


def history_of(b: dict) -> list:
    """The conversation a Studio panel sends with its next message: earlier
    turns, oldest first, each cut to a size a context can hold."""
    raw = b.get("history") if isinstance(b.get("history"), list) else []
    out = [{"role": t["role"], "content": str(t["content"])[:HISTORY_CHARS]} for t in raw
           if isinstance(t, dict) and t.get("role") in ("user", "assistant") and str(t.get("content") or "").strip()]
    return out[-HISTORY_TURNS:]
_ASK_LOCK = threading.Lock()


def register(route, user_of) -> None:  # noqa: C901 - one place for every workspace route
    def ws(u, b, h=None) -> str:
        # The body or query names it, else the X-Learis-Ws header the web proxy
        # fills from the workspace the user last picked, else their personal one.
        return space.resolve(u.id, b.get("ws") or (h.get("X-Learis-Ws") if h else None) or None)

    # ------------------------------------------------------------ workspaces
    @route("GET", r"/workspaces")
    def list_ws(_m, _b, h):
        return 200, {"workspaces": space.mine(user_of(h).id)}

    @route("POST", r"/workspaces")
    def create_ws(_m, b, h):
        return 201, space.create_group(user_of(h).id, str(b.get("name") or ""), b.get("purpose"))

    @route("GET", r"/workspaces/([A-Za-z0-9_]+)")
    def one_ws(m, _b, h):
        u = user_of(h)
        role = space.role_in(u.id, m.group(1))
        return 200, {**space.workspace(m.group(1)), "role": role, "members": space.members(u.id, m.group(1))}

    @route("POST", r"/workspaces/([A-Za-z0-9_]+)/invite")
    def invite(m, _b, h):
        return 201, space.create_invite(user_of(h).id, m.group(1))

    @route("POST", r"/workspaces/([A-Za-z0-9_]+)/hours")
    def hours(m, b, h):
        u = user_of(h)
        try:
            value = float(b.get("hours"))
        except (TypeError, ValueError):
            return 400, {"error": "hours must be a number"}
        space.set_hours(u.id, m.group(1), value)
        return 200, {"hours_per_week": value}

    @route("POST", r"/workspaces/([A-Za-z0-9_]+)/members/([A-Za-z0-9_]+)/remove")
    def remove(m, _b, h):
        space.remove_member(user_of(h).id, m.group(1), m.group(2))
        return 200, {"removed": m.group(2)}

    @route("GET", r"/invites/([A-Za-z0-9_-]+)")
    def invite_info(m, _b, h):
        user_of(h)
        return 200, space.invite_info(m.group(1))

    @route("POST", r"/invites/([A-Za-z0-9_-]+)/accept")
    def accept(m, _b, h):
        return 200, space.accept_invite(user_of(h).id, m.group(1))

    # ----------------------------------------------------------------- files
    @route("GET", r"/files")
    def list_files(_m, b, h):
        u = user_of(h)
        w = ws(u, b, h)
        return 200, {"workspace_id": w, "files": space.files(u.id, w), "collections": space.collections(u.id, w)}

    @route("GET", r"/files/([A-Za-z0-9_]+)")
    def one_file(m, _b, h):
        return 200, space.file_preview(user_of(h).id, m.group(1))

    @route("GET", r"/collections")
    def colls(_m, b, h):
        u = user_of(h)
        return 200, {"collections": space.collections(u.id, ws(u, b, h))}

    @route("POST", r"/files")
    def add_file(_m, b, h):
        u = user_of(h)
        text = str(b.get("text") or "").strip()
        name = str(b.get("name") or "").strip()
        if len(text) < 20:
            return 400, {"error": "the file has no readable text (at least 20 characters)"}
        if len(text) > MAX_TEXT:
            return 400, {"error": f"the file is longer than {MAX_TEXT:,} characters"}
        if not name:
            return 400, {"error": "give the file a name"}
        return 201, space.add_file(u.id, ws(u, b, h), name, text, b.get("source_url"), b.get("collection"))

    @route("POST", r"/files/github")
    def add_repo(_m, b, h):
        u = user_of(h)
        try:
            repo = github.fetch(str(b.get("url") or ""))
        except github.GitHubError as e:
            return 400, {"error": str(e)}
        return 201, space.add_file(u.id, ws(u, b, h), repo["title"], repo["text"], repo["source_url"],
                                   b.get("collection"))

    @route("POST", r"/files/([A-Za-z0-9_]+)/delete")
    def del_file(m, _b, h):
        space.delete_file(user_of(h).id, m.group(1))
        return 200, {"deleted": m.group(1)}

    # ----------------------------------------------------------------- pages
    @route("GET", r"/pages")
    def list_pages(_m, b, h):
        u = user_of(h)
        return 200, {"pages": space.pages(u.id, ws(u, b, h))}

    @route("GET", r"/pages/([A-Za-z0-9_]+)")
    def one_page(m, _b, h):
        return 200, space.page(user_of(h).id, m.group(1))

    @route("GET", r"/pages/([A-Za-z0-9_]+)/review")
    def review(m, _b, h):
        return 200, space.review(user_of(h).id, m.group(1))

    @route("POST", r"/pages")
    def new_page(_m, b, h):
        u = user_of(h)
        return 201, space.create_page(u.id, ws(u, b, h), str(b.get("title") or "Untitled"),
                                      str(b.get("content") or ""), u.id, b.get("sources") or [])

    @route("POST", r"/pages/([A-Za-z0-9_]+)")
    def edit_page(m, b, h):
        u = user_of(h)
        return 200, space.update_page(u.id, m.group(1), u.id, b.get("title"), b.get("content"), b.get("sources"))

    # --------------------------------------------------- the Academic pack
    @route("POST", r"/pages/([A-Za-z0-9_]+)/audit")
    def audit_page(m, _b, h):
        u = user_of(h)
        try:
            cfg = ai.resolve(h.get("X-Learis-AI"))
        except ai.AIError:
            cfg = None      # no model: the plain word-and-number check, and the answer says so
        return 200, academic.audit(u.id, m.group(1), cfg)

    @route("GET", r"/pages/([A-Za-z0-9_]+)/doctor")
    def doctor_page(m, b, h):
        return 200, academic.doctor(user_of(h).id, m.group(1), str(b.get("kind") or "praktikum"))

    @route("GET", r"/report-formats")
    def report_formats(_m, _b, h):
        user_of(h)
        return 200, {"presets": academic.presets(),
                     "kinds": [{"id": k, "label": v["label"], "sections": [n for n, _ in v["sections"]]}
                               for k, v in academic.STRUCTURES.items()]}

    @route("GET", r"/pages/([A-Za-z0-9_]+)/export")
    def export_page(m, b, h):
        meta = {k: str(b.get(k) or "")[:200] for k in ("title", "author", "nim", "lecturer", "course", "program",
                                                       "faculty", "university", "city", "year", "email")}
        out = academic.docx(user_of(h).id, m.group(1), str(b.get("preset") or "standard"),
                            str(b.get("kind") or "praktikum"), meta)
        return 200, {"__file__": out["bytes"], "name": out["name"], "type": out["type"]}

    @route("POST", r"/pages/([A-Za-z0-9_]+)/delete")
    def del_page(m, _b, h):
        space.delete_page(user_of(h).id, m.group(1))
        return 200, {"deleted": m.group(1)}

    # ----------------------------------------------------------------- tasks
    @route("GET", r"/tasks")
    def list_tasks(_m, b, h):
        u = user_of(h)
        w = ws(u, b, h)
        return 200, {"tasks": space.tasks(u.id, w), "members": space.members(u.id, w),
                     "agents": [{"id": a["id"], "name": a["name"]} for a in aw.roster(u.id, w) if not a.get("pack")]}

    @route("POST", r"/tasks")
    def new_task(_m, b, h):
        u = user_of(h)
        est = b.get("estimate_hours")
        return 201, space.create_task(u.id, ws(u, b, h), str(b.get("title") or ""), u.id,
                                      str(b.get("description") or ""), b.get("assignee_type") or None,
                                      b.get("assignee_id") or None, b.get("due_date") or None,
                                      float(est) if est not in (None, "") else None, b.get("page_id") or None)

    @route("POST", r"/tasks/([A-Za-z0-9_]+)")
    def edit_task(m, b, h):
        u = user_of(h)
        fields = {k: (v if v != "" else None) for k, v in b.items() if k in space.TASK_FIELDS}
        if fields.get("estimate_hours") is not None:
            fields["estimate_hours"] = float(fields["estimate_hours"])
        return 200, space.update_task(u.id, m.group(1), u.id, **fields)

    @route("POST", r"/tasks/([A-Za-z0-9_]+)/delete")
    def del_task(m, _b, h):
        space.delete_task(user_of(h).id, m.group(1))
        return 200, {"deleted": m.group(1)}

    @route("POST", r"/tasks/([A-Za-z0-9_]+)/run")
    def run_task(m, b, h):
        u = user_of(h)
        t = space.task(u.id, m.group(1))
        try:
            cfg = ai.resolve(h.get("X-Learis-AI"))
        except ai.AIError as e:
            return 400, {"error": str(e)}
        rid = _start(u.id, t["workspace_id"], f"Task: {t['title']}", cfg, "task")
        if isinstance(rid, tuple):
            return rid
        POOL.submit(f"task {rid}", _finish, u.id, rid, aw.run_task, u.id, rid, t["workspace_id"], t["id"], cfg)
        return 202, {"run_id": rid}

    # ---------------------------------------------------------------- agents
    @route("GET", r"/workspace-agents")
    def roster(_m, b, h):
        u = user_of(h)
        w = ws(u, b, h)
        return 200, {"workspace_id": w, "agents": aw.roster(u.id, w), "custom": aw.custom(u.id, w)}

    @route("GET", r"/tools")
    def tool_library(_m, _b, h):
        user_of(h)
        return 200, {"tools": [{"name": n, "description": registry.get(n).description,
                                "writes": registry.get(n).writes, "group": registry.get(n).agent}
                               for n in aw.WORKSPACE_TOOLS]}

    def _save(u, b, h, agent_id: Optional[str] = None):
        tools = b.get("tools") or []
        if not isinstance(tools, list):
            return 400, {"error": "tools must be a list"}
        return (200 if agent_id else 201), aw.save_agent(
            u.id, ws(u, b, h), str(b.get("name") or ""), str(b.get("description") or ""),
            str(b.get("instructions") or ""), [str(t) for t in tools], b.get("model"), b.get("icon"),
            bool(b.get("shared")), agent_id)

    @route("GET", r"/workspace-agents/([A-Za-z0-9_]+)")
    def agent_detail(m, b, h):
        u = user_of(h)
        return 200, aw.detail(u.id, ws(u, b, h), m.group(1))

    @route("POST", r"/workspace-agents/([A-Za-z0-9_]+)/ask")
    def ask_one(m, b, h):
        u = user_of(h)
        request = str(b.get("request") or "").strip()
        if not request:
            return 400, {"error": "ask something"}
        try:
            cfg = ai.resolve(h.get("X-Learis-AI"))
        except ai.AIError as e:
            return 400, {"error": str(e)}
        if not cfg or not cfg.tools:
            return 400, {"error": "talking to an agent needs a model that can call tools: connect one in AI & privacy"}
        w = ws(u, b, h)
        if not aw.find(u.id, w, m.group(1)):
            return 404, {"error": "no such agent in this workspace"}
        rid = _start(u.id, w, request, cfg, f"agent:{m.group(1)}")
        if isinstance(rid, tuple):
            return rid
        POOL.submit(f"agent {rid}", _finish, u.id, rid, aw.ask_agent, u.id, rid, w, m.group(1), request, cfg,
                    history_of(b))
        return 202, {"run_id": rid}

    @route("POST", r"/workspace-agents")
    def new_agent(_m, b, h):
        return _save(user_of(h), b, h)

    @route("POST", r"/workspace-agents/([A-Za-z0-9_]+)")
    def edit_agent(m, b, h):
        return _save(user_of(h), b, h, m.group(1))

    @route("POST", r"/workspace-agents/([A-Za-z0-9_]+)/delete")
    def del_agent(m, b, h):
        u = user_of(h)
        aw.delete_agent(u.id, ws(u, b, h), m.group(1))
        return 200, {"deleted": m.group(1)}

    @route("GET", r"/gallery")
    def gallery(_m, _b, h):
        user_of(h)
        return 200, {"agents": aw.gallery()}

    @route("POST", r"/gallery/([A-Za-z0-9_]+)/install")
    def install(m, b, h):
        u = user_of(h)
        return 201, aw.install(u.id, ws(u, b, h), m.group(1))

    # ----------------------------------------------------------- orchestrator
    def _start(user_id: str, wid: str, request: str, cfg, kind: str):
        with _ASK_LOCK:
            mine = _ASKING.setdefault(user_id, set())
            if len(mine) >= MAX_PER_USER:
                return 409, {"error": f"{MAX_PER_USER} of your agents are already working; wait for one to finish"}
            rid = store.start_run(user_id, cfg.label if cfg else None, status="queued")
            with store.connect() as c:
                c.execute("UPDATE runs SET workspace_id=?, request=?, kind=? WHERE id=?",
                          (wid, request[:2000], kind, rid))
            mine.add(rid)
        return rid

    def _finish(user_id: str, rid: str, fn, *args):
        try:
            store.set_run_status(rid, "running")
            fn(*args)
        finally:
            with _ASK_LOCK:
                _ASKING.get(user_id, set()).discard(rid)

    @route("GET", r"/conversations")
    def chats(_m, b, h):
        u = user_of(h)
        return 200, {"conversations": store.conversations(u.id, ws(u, b, h))}

    @route("GET", r"/conversations/([A-Za-z0-9_]+)")
    def chat(m, _b, h):
        turns = store.conversation(user_of(h).id, m.group(1))
        return (200, {"id": m.group(1), "turns": turns}) if turns else (404, {"error": "no such conversation"})

    @route("POST", r"/conversations/([A-Za-z0-9_]+)/delete")
    def del_chat(m, _b, h):
        n = store.delete_conversation(user_of(h).id, m.group(1))
        return (200, {"deleted": m.group(1)}) if n else (404, {"error": "no such conversation"})

    @route("POST", r"/ask")
    def ask(_m, b, h):
        u = user_of(h)
        request = str(b.get("request") or "").strip()
        if not request:
            return 400, {"error": "ask something"}
        try:
            cfg = ai.resolve(h.get("X-Learis-AI"))
        except ai.AIError as e:
            return 400, {"error": str(e)}
        if not cfg or not cfg.tools:
            return 400, {"error": "the Orchestrator needs a model that can call tools: connect one in AI & privacy"}
        w = ws(u, b, h)
        # A chat keeps its thread on the server: the earlier turns of the
        # conversation are the history, so any device continues it.
        cid = str(b.get("conversation_id") or "")
        history = history_of(b)
        if cid:
            if not re.match(r"^[A-Za-z0-9_]{6,40}$", cid):
                return 400, {"error": "bad conversation id"}
            past = store.conversation(u.id, cid)
            history = history_of({"history": [x for t in past if t["status"] == "done" for x in
                                              ({"role": "user", "content": t["request"] or ""},
                                               {"role": "assistant", "content": t["answer"] or ""})]})
        else:
            cid = store.new_id("chat")
        rid = _start(u.id, w, request, cfg, "ask")
        if isinstance(rid, tuple):
            return rid
        with store.connect() as c:
            c.execute("UPDATE runs SET conversation_id=? WHERE id=?", (cid, rid))
        POOL.submit(f"ask {rid}", _finish, u.id, rid, aw.orchestrate, u.id, rid, w, request, cfg, history)
        return 202, {"run_id": rid, "conversation_id": cid}

    # ---------------------------------------------------------------- impact
    @route("GET", r"/group-impact")
    def group_impact(_m, b, h):
        u = user_of(h)
        w = ws(u, b, h)
        return 200, {"workspace": space.workspace(w), **space.impact(u.id, w)}

    @route("POST", r"/group-report")
    def group_report(_m, b, h):
        u = user_of(h)
        w = ws(u, b, h)
        md = space.report_markdown(u.id, w)
        p = space.create_page(u.id, w, md.splitlines()[0].lstrip("# ").strip(), md, u.id)
        return 201, p
