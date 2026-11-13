"""Workspaces: personal and group, with their pages, tasks, files and agents.

Every function that reads or writes a workspace's contents takes the acting
user and checks membership first (`role_in`), so a page id guessed from
another group is refused, not served. Agents act as the user who started the
run: an agent can do in a workspace exactly what that user can.

Groups are the supporting feature: invite friends with a link, share pages,
tasks and agents, split work between people and agents, and measure what the
group got done.
"""
from __future__ import annotations

import json
import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from core.store import _now, connect, new_id

TASK_STATUSES = ("todo", "doing", "done")
INVITE_DAYS = 7


class Denied(PermissionError):
    pass


class NotFound(LookupError):
    pass


# ------------------------------------------------------------- workspaces
def personal(user_id: str, name: str = "My workspace") -> Dict[str, Any]:
    """The user's personal workspace, created on first use."""
    with connect() as c:
        r = c.execute("SELECT * FROM workspaces WHERE owner_id=? AND kind='personal'", (user_id,)).fetchone()
        if r:
            return dict(r)
        wid = new_id("ws")
        c.execute("INSERT INTO workspaces (id,name,kind,owner_id,created_at) VALUES (?,?,?,?,?)",
                  (wid, name, "personal", user_id, _now()))
        c.execute("INSERT INTO members (workspace_id,user_id,role,joined_at) VALUES (?,?,?,?)",
                  (wid, user_id, "owner", _now()))
    return workspace(wid)


def create_group(user_id: str, name: str, purpose: Optional[str] = None) -> Dict[str, Any]:
    name = name.strip()[:80]
    if not name:
        raise ValueError("a group needs a name")
    wid = new_id("ws")
    with connect() as c:
        c.execute("INSERT INTO workspaces (id,name,kind,purpose,owner_id,created_at) VALUES (?,?,?,?,?,?)",
                  (wid, name, "group", (purpose or "").strip()[:400] or None, user_id, _now()))
        c.execute("INSERT INTO members (workspace_id,user_id,role,joined_at) VALUES (?,?,?,?)",
                  (wid, user_id, "owner", _now()))
    return workspace(wid)


def workspace(wid: str) -> Dict[str, Any]:
    with connect() as c:
        r = c.execute("SELECT * FROM workspaces WHERE id=?", (wid,)).fetchone()
    if not r:
        raise NotFound("no such workspace")
    return dict(r)


def mine(user_id: str) -> List[Dict[str, Any]]:
    personal(user_id)
    with connect() as c:
        rows = c.execute(
            "SELECT w.*, m.role, (SELECT count(*) FROM members x WHERE x.workspace_id=w.id) AS members"
            " FROM workspaces w JOIN members m ON m.workspace_id=w.id WHERE m.user_id=?"
            " ORDER BY w.kind DESC, w.created_at", (user_id,)).fetchall()
    return [dict(r) for r in rows]


def role_in(user_id: str, wid: str) -> str:
    """The user's role in the workspace, or Denied."""
    with connect() as c:
        r = c.execute("SELECT role FROM members WHERE workspace_id=? AND user_id=?", (wid, user_id)).fetchone()
    if not r:
        raise Denied("you are not a member of this workspace")
    return r["role"]


def resolve(user_id: str, wid: Optional[str]) -> str:
    """The workspace a request means: the one asked for if the user is a
    member, else their personal workspace."""
    if wid:
        role_in(user_id, wid)
        return wid
    return personal(user_id)["id"]


# --------------------------------------------------------------- members
def members(user_id: str, wid: str) -> List[Dict[str, Any]]:
    role_in(user_id, wid)
    with connect() as c:
        rows = c.execute(
            "SELECT m.user_id, m.role, m.hours_per_week, m.joined_at, u.name, u.email,"
            " (SELECT COALESCE(SUM(estimate_hours),0) FROM tasks t WHERE t.workspace_id=m.workspace_id"
            "   AND t.assignee_type='user' AND t.assignee_id=m.user_id AND t.status!='done') AS open_hours,"
            " (SELECT count(*) FROM tasks t WHERE t.workspace_id=m.workspace_id"
            "   AND t.done_by=m.user_id AND t.status='done') AS tasks_done"
            " FROM members m LEFT JOIN users u ON u.id=m.user_id WHERE m.workspace_id=?"
            " ORDER BY m.joined_at", (wid,)).fetchall()
    return [dict(r) for r in rows]


def set_hours(user_id: str, wid: str, hours: float) -> None:
    role_in(user_id, wid)
    if not 1 <= hours <= 60:
        raise ValueError("hours per week must be between 1 and 60")
    with connect() as c:
        c.execute("UPDATE members SET hours_per_week=? WHERE workspace_id=? AND user_id=?", (hours, wid, user_id))


def remove_member(user_id: str, wid: str, who: str) -> None:
    role = role_in(user_id, wid)
    if who != user_id and role != "owner":
        raise Denied("only the owner removes other members")
    if workspace(wid)["owner_id"] == who:
        raise Denied("the owner cannot leave their own group")
    with connect() as c:
        c.execute("DELETE FROM members WHERE workspace_id=? AND user_id=?", (wid, who))
        c.execute("UPDATE tasks SET assignee_type=NULL, assignee_id=NULL WHERE workspace_id=?"
                  " AND assignee_type='user' AND assignee_id=? AND status!='done'", (wid, who))


# --------------------------------------------------------------- invites
def create_invite(user_id: str, wid: str) -> Dict[str, Any]:
    if workspace(wid)["kind"] != "group":
        raise Denied("a personal workspace cannot be shared; create a group")
    role_in(user_id, wid)
    token = secrets.token_urlsafe(18)
    expires = (datetime.now(timezone.utc) + timedelta(days=INVITE_DAYS)).isoformat(timespec="seconds")
    with connect() as c:
        c.execute("INSERT INTO invites (token,workspace_id,created_by,created_at,expires_at) VALUES (?,?,?,?,?)",
                  (token, wid, user_id, _now(), expires))
    return {"token": token, "expires_at": expires}


def invite_info(token: str) -> Dict[str, Any]:
    with connect() as c:
        r = c.execute("SELECT i.*, w.name, w.purpose, (SELECT count(*) FROM members m WHERE m.workspace_id=w.id)"
                      " AS members FROM invites i JOIN workspaces w ON w.id=i.workspace_id WHERE i.token=?",
                      (token,)).fetchone()
    if not r or r["revoked"]:
        raise NotFound("this invite link is not valid")
    if r["expires_at"] < _now():
        raise NotFound("this invite link has expired")
    if r["uses"] >= r["max_uses"]:
        raise NotFound("this invite link has been used up")
    return {"workspace_id": r["workspace_id"], "name": r["name"], "purpose": r["purpose"],
            "members": r["members"], "expires_at": r["expires_at"]}


def accept_invite(user_id: str, token: str) -> Dict[str, Any]:
    info = invite_info(token)
    with connect() as c:
        joined = c.execute("INSERT OR IGNORE INTO members (workspace_id,user_id,role,joined_at) VALUES (?,?,?,?)",
                           (info["workspace_id"], user_id, "member", _now())).rowcount
        if joined:
            c.execute("UPDATE invites SET uses=uses+1 WHERE token=?", (token,))
    return workspace(info["workspace_id"])


# ----------------------------------------------------------------- files
def add_file(user_id: str, wid: str, name: str, text: str, source_url: Optional[str] = None,
             collection: Optional[str] = None) -> Dict[str, Any]:
    role_in(user_id, wid)
    fid = new_id("file")
    coll = (collection or "").strip()[:80] or None
    with connect() as c:
        c.execute("INSERT INTO files (id,workspace_id,name,text,chars,source_url,uploaded_by,uploaded_at,collection)"
                  " VALUES (?,?,?,?,?,?,?,?,?)",
                  (fid, wid, name[:200], text, len(text), source_url, user_id, _now(), coll))
    return file(user_id, fid, with_text=False)


def file(user_id: str, fid: str, with_text: bool = True) -> Dict[str, Any]:
    with connect() as c:
        r = c.execute("SELECT * FROM files WHERE id=?", (fid,)).fetchone()
    if not r:
        raise NotFound(f"no file '{fid}'")
    role_in(user_id, r["workspace_id"])
    d = dict(r)
    if not with_text:
        d.pop("text")
    return d


def file_preview(user_id: str, fid: str) -> Dict[str, Any]:
    """A file as its reader sees it: the text the agents read, who added it, and every page that
    cites it, with the quotes taken from it."""
    f = file(user_id, fid)
    with connect() as c:
        who = c.execute("SELECT name FROM users WHERE id=?", (f["uploaded_by"],)).fetchone()
        rows = c.execute("SELECT id, title, sources FROM pages WHERE workspace_id=? ORDER BY updated_at DESC",
                         (f["workspace_id"],)).fetchall()
    cited = []
    for r in rows:
        quotes = [{"n": s["n"], "quote": s["quote"]} for s in json.loads(r["sources"] or "[]") if s.get("file_id") == fid]
        if quotes:
            cited.append({"page_id": r["id"], "title": r["title"], "quotes": quotes})
    return {"id": f["id"], "name": f["name"], "collection": f["collection"], "chars": f["chars"],
            "source_url": f["source_url"], "uploaded_at": f["uploaded_at"], "uploader": who["name"] if who else None,
            "text": f["text"], "cited_by": cited}


def files(user_id: str, wid: str) -> List[Dict[str, Any]]:
    role_in(user_id, wid)
    with connect() as c:
        rows = c.execute("SELECT f.id, f.name, f.chars, f.source_url, f.uploaded_by, f.uploaded_at, f.collection,"
                         " u.name AS uploader FROM files f LEFT JOIN users u ON u.id=f.uploaded_by"
                         " WHERE f.workspace_id=? ORDER BY COALESCE(f.collection,'~'), f.uploaded_at DESC",
                         (wid,)).fetchall()
    return [dict(r) for r in rows]


def collections(user_id: str, wid: str) -> List[Dict[str, Any]]:
    """The courses (collections) in a workspace, with how much material each has."""
    role_in(user_id, wid)
    with connect() as c:
        rows = c.execute("SELECT COALESCE(collection,'(no course)') AS name, count(*) AS files, SUM(chars) AS chars"
                         " FROM files WHERE workspace_id=? GROUP BY COALESCE(collection,'(no course)')"
                         " ORDER BY name", (wid,)).fetchall()
    return [dict(r) for r in rows]


def delete_file(user_id: str, fid: str) -> None:
    f = file(user_id, fid, with_text=False)
    with connect() as c:
        c.execute("DELETE FROM files WHERE id=?", (f["id"],))


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def search(user_id: str, wid: str, query: str, limit: int = 8) -> List[Dict[str, Any]]:
    """Plain keyword search over files and pages: each hit with a snippet."""
    role_in(user_id, wid)
    words = [w for w in re.findall(r"\w+", query.lower()) if len(w) > 2][:8]
    if not words:
        return []
    with connect() as c:
        docs = [("file", r["id"], r["name"], r["text"]) for r in
                c.execute("SELECT id,name,text FROM files WHERE workspace_id=?", (wid,)).fetchall()]
        docs += [("page", r["id"], r["title"], r["content"]) for r in
                 c.execute("SELECT id,title,content FROM pages WHERE workspace_id=?", (wid,)).fetchall()]
    hits = []
    for kind, did, title, text in docs:
        low = text.lower()
        score = sum(low.count(w) for w in words) + 3 * sum(w in title.lower() for w in words)
        if not score:
            continue
        pos = min((low.find(w) for w in words if w in low), default=0)
        snippet = text[max(0, pos - 120): pos + 240].replace("\n", " ")
        hits.append({"kind": kind, "id": did, "title": title, "score": score, "snippet": snippet})
    return sorted(hits, key=lambda h: -h["score"])[:limit]


# ----------------------------------------------------------------- pages
MAX_QUOTE = 400


def check_sources(user_id: str, wid: str, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Each source must quote a file of this workspace word for word."""
    out = []
    for i, s in enumerate(sources, 1):
        f = file(user_id, str(s.get("file_id") or ""))
        if f["workspace_id"] != wid:
            raise Denied("a source must be a file of this workspace")
        quote = str(s.get("quote") or "").strip()
        if len(quote) < 3 or _norm(quote) not in _norm(f["text"]):
            raise ValueError(f"source [{i}]: the quote is not in '{f['name']}'")
        if len(quote) > MAX_QUOTE:
            # A quote is the passage that proves one claim, not a whole file: then [n] would "prove" anything.
            raise ValueError(f"source [{i}]: the quote is {len(quote)} characters; quote only the sentence that "
                             f"proves the claim (at most {MAX_QUOTE}), and give each distinct fact its own source")
        out.append({"n": i, "file_id": f["id"], "file_name": f["name"], "quote": quote})
    return out


def create_page(user_id: str, wid: str, title: str, content: str, by: str,
                sources: Optional[List[Dict[str, Any]]] = None, run_id: Optional[str] = None) -> Dict[str, Any]:
    role_in(user_id, wid)
    checked = check_sources(user_id, wid, sources or [])
    pid = new_id("page")
    with connect() as c:
        c.execute("INSERT INTO pages (id,workspace_id,title,content,sources,created_by,updated_by,run_id,"
                  "created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
                  (pid, wid, title.strip()[:200] or "Untitled", content, json.dumps(checked), by, by, run_id,
                   _now(), _now()))
    return page(user_id, pid)


def page(user_id: str, pid: str) -> Dict[str, Any]:
    with connect() as c:
        r = c.execute("SELECT * FROM pages WHERE id=?", (pid,)).fetchone()
    if not r:
        raise NotFound(f"no page '{pid}'")
    role_in(user_id, r["workspace_id"])
    d = dict(r)
    d["sources"] = json.loads(d["sources"] or "[]")
    return d


def pages(user_id: str, wid: str) -> List[Dict[str, Any]]:
    role_in(user_id, wid)
    with connect() as c:
        rows = c.execute("SELECT id,title,created_by,updated_by,updated_at,length(content) AS chars,"
                         " json_array_length(sources) AS sources FROM pages WHERE workspace_id=?"
                         " ORDER BY updated_at DESC", (wid,)).fetchall()
    return [dict(r) for r in rows]


def update_page(user_id: str, pid: str, by: str, title: Optional[str] = None, content: Optional[str] = None,
                sources: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    p = page(user_id, pid)
    checked = check_sources(user_id, p["workspace_id"], sources) if sources is not None else p["sources"]
    with connect() as c:
        c.execute("UPDATE pages SET title=?, content=?, sources=?, updated_by=?, updated_at=? WHERE id=?",
                  ((title if title is not None else p["title"]).strip()[:200] or "Untitled",
                   content if content is not None else p["content"], json.dumps(checked), by, _now(), pid))
    return page(user_id, pid)


def delete_page(user_id: str, pid: str) -> None:
    p = page(user_id, pid)
    with connect() as c:
        c.execute("DELETE FROM pages WHERE id=?", (p["id"],))


def review(user_id: str, pid: str) -> Dict[str, Any]:
    """What a reader cannot check in a page: references to sources that do not
    exist, sources nothing refers to, and paragraphs that state something with
    no source at all when the page has sources."""
    p = page(user_id, pid)
    ns = {s["n"] for s in p["sources"]}
    refs = {int(n) for n in re.findall(r"\[(\d+)\]", p["content"])}
    paras = [x.strip() for x in re.split(r"\n\s*\n", p["content"]) if x.strip()]
    claims = [x for x in paras if not x.startswith(("#", "-", "*", ">", "|")) and len(x) > 80]
    uncited = [x[:160] for x in claims if not re.search(r"\[\d+\]", x)] if ns else []
    # Every source quote is re-checked: a file may have changed since.
    stale = []
    for s in p["sources"]:
        try:
            f = file(user_id, s["file_id"])
            if _norm(s["quote"]) not in _norm(f["text"]):
                stale.append(s["n"])
        except NotFound:
            stale.append(s["n"])
    problems = len(refs - ns) + len(stale) + len(uncited)
    return {"page_id": pid, "sources": len(ns), "missing_sources": sorted(refs - ns),
            "unused_sources": sorted(ns - refs), "stale_sources": stale,
            "uncited_paragraphs": uncited, "ok": problems == 0}


# ----------------------------------------------------------------- tasks
def _assignee(user_id: str, wid: str, a_type: Optional[str], a_id: Optional[str]) -> None:
    if not a_type:
        return
    if a_type == "user":
        role_in(str(a_id), wid)
    elif a_type == "agent":
        from agents import workspace as aw
        if not aw.find(user_id, wid, str(a_id)):
            raise ValueError(f"no agent '{a_id}' in this workspace")
    else:
        raise ValueError("assignee type must be user or agent")


def create_task(user_id: str, wid: str, title: str, by: str, description: str = "",
                assignee_type: Optional[str] = None, assignee_id: Optional[str] = None,
                due_date: Optional[str] = None, estimate_hours: Optional[float] = None,
                page_id: Optional[str] = None, run_id: Optional[str] = None) -> Dict[str, Any]:
    role_in(user_id, wid)
    if not title.strip():
        raise ValueError("a task needs a title")
    _assignee(user_id, wid, assignee_type, assignee_id)
    if due_date:
        datetime.fromisoformat(due_date)
    tid = new_id("task")
    with connect() as c:
        c.execute("INSERT INTO tasks (id,workspace_id,title,description,assignee_type,assignee_id,due_date,"
                  "estimate_hours,page_id,created_by,run_id,created_at,updated_at)"
                  " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                  (tid, wid, title.strip()[:200], description[:4000], assignee_type, assignee_id, due_date,
                   estimate_hours, page_id, by, run_id, _now(), _now()))
    return task(user_id, tid)


def task(user_id: str, tid: str) -> Dict[str, Any]:
    with connect() as c:
        r = c.execute("SELECT * FROM tasks WHERE id=?", (tid,)).fetchone()
    if not r:
        raise NotFound(f"no task '{tid}'")
    role_in(user_id, r["workspace_id"])
    return dict(r)


def tasks(user_id: str, wid: str) -> List[Dict[str, Any]]:
    role_in(user_id, wid)
    with connect() as c:
        rows = c.execute(
            "SELECT t.*, u.name AS assignee_name, a.name AS agent_name FROM tasks t"
            " LEFT JOIN users u ON t.assignee_type='user' AND u.id=t.assignee_id"
            " LEFT JOIN agents a ON t.assignee_type='agent' AND a.id=t.assignee_id"
            " WHERE t.workspace_id=? ORDER BY CASE t.status WHEN 'doing' THEN 0 WHEN 'todo' THEN 1 ELSE 2 END,"
            " COALESCE(t.due_date,'9999'), t.created_at", (wid,)).fetchall()
    return [dict(r) for r in rows]


TASK_FIELDS = {"title", "description", "status", "assignee_type", "assignee_id", "due_date",
               "estimate_hours", "page_id"}


def update_task(user_id: str, tid: str, by: str, **fields) -> Dict[str, Any]:
    t = task(user_id, tid)
    bad = set(fields) - TASK_FIELDS
    if bad:
        raise ValueError(f"unknown field(s): {', '.join(sorted(bad))}")
    if "status" in fields and fields["status"] not in TASK_STATUSES:
        raise ValueError(f"status must be one of {', '.join(TASK_STATUSES)}")
    if "assignee_type" in fields or "assignee_id" in fields:
        _assignee(user_id, t["workspace_id"], fields.get("assignee_type", t["assignee_type"]),
                  fields.get("assignee_id", t["assignee_id"]))
    t.update(fields)
    done_at, done_by = t["done_at"], t["done_by"]
    if fields.get("status") == "done" and not done_at:
        done_at, done_by = _now(), by
    elif fields.get("status") in ("todo", "doing"):
        done_at = done_by = None
    with connect() as c:
        c.execute("UPDATE tasks SET title=?,description=?,status=?,assignee_type=?,assignee_id=?,due_date=?,"
                  "estimate_hours=?,page_id=?,updated_at=?,done_at=?,done_by=? WHERE id=?",
                  (t["title"], t["description"], t["status"], t["assignee_type"], t["assignee_id"],
                   t["due_date"], t["estimate_hours"], t["page_id"], _now(), done_at, done_by, tid))
    return task(user_id, tid)


def delete_task(user_id: str, tid: str) -> None:
    t = task(user_id, tid)
    with connect() as c:
        c.execute("DELETE FROM tasks WHERE id=?", (t["id"],))


# ---------------------------------------------------------------- impact
#: What an agent's work is assumed to save, when the task carries no estimate
#: of its own. Shown beside the figure, so nobody mistakes it for a measurement.
DEFAULT_TASK_HOURS = 1.0
PAGE_HOURS = 0.5


def impact(user_id: str, wid: str) -> Dict[str, Any]:
    role_in(user_id, wid)
    with connect() as c:
        t = [dict(r) for r in c.execute("SELECT status, done_by, estimate_hours, assignee_type FROM tasks"
                                        " WHERE workspace_id=?", (wid,)).fetchall()]
        p = [dict(r) for r in c.execute("SELECT created_by FROM pages WHERE workspace_id=?", (wid,)).fetchall()]
        runs = c.execute("SELECT count(*) FROM runs WHERE workspace_id=? AND status='done'", (wid,)).fetchone()[0]
        nfiles = c.execute("SELECT count(*) FROM files WHERE workspace_id=?", (wid,)).fetchone()[0]
        installs = c.execute("SELECT COALESCE(SUM(installs),0) FROM agents WHERE workspace_id=? AND shared=1",
                             (wid,)).fetchone()[0]
    done = [x for x in t if x["status"] == "done"]
    by_agents = [x for x in done if str(x["done_by"] or "").startswith("agent:")]
    agent_pages = [x for x in p if str(x["created_by"]).startswith("agent:")]
    saved = sum(x["estimate_hours"] or DEFAULT_TASK_HOURS for x in by_agents) + PAGE_HOURS * len(agent_pages)
    mem = members(user_id, wid)
    return {
        "members": len(mem),
        "tasks_total": len(t), "tasks_done": len(done),
        "tasks_done_by_people": len(done) - len(by_agents), "tasks_done_by_agents": len(by_agents),
        "pages": len(p), "pages_by_agents": len(agent_pages), "files": nfiles, "agent_runs": runs,
        "hours_saved_estimate": round(saved, 1),
        "hours_saved_rule": (f"estimate of each task an agent finished (or {DEFAULT_TASK_HOURS:g} h), "
                             f"plus {PAGE_HOURS:g} h per page an agent drafted"),
        "shared_agent_installs": installs,
        "contributions": [{"user_id": m["user_id"], "name": m["name"], "tasks_done": m["tasks_done"],
                           "open_hours": m["open_hours"], "hours_per_week": m["hours_per_week"]} for m in mem],
    }


def report_markdown(user_id: str, wid: str) -> str:
    """A group activity report, written from the numbers alone: no model, so
    every figure in it is the database's."""
    w, i = workspace(wid), impact(user_id, wid)
    done = [x for x in tasks(user_id, wid) if x["status"] == "done"]
    lines = [f"# Activity report: {w['name']}", "",
             f"Generated {datetime.now(timezone.utc).strftime('%d %b %Y')} from the workspace record.", ""]
    if w.get("purpose"):
        lines += [f"**Purpose:** {w['purpose']}", ""]
    lines += ["## In numbers", "",
              f"- Members: {i['members']}",
              f"- Tasks finished: {i['tasks_done']} of {i['tasks_total']} "
              f"({i['tasks_done_by_people']} by people, {i['tasks_done_by_agents']} by agents)",
              f"- Pages written: {i['pages']} ({i['pages_by_agents']} drafted by agents)",
              f"- Files shared: {i['files']}",
              f"- Estimated hours saved by agents: {i['hours_saved_estimate']} ({i['hours_saved_rule']})", "",
              "## Contributions", "", "| Member | Tasks finished | Open hours | Hours/week |", "|---|---|---|---|"]
    lines += [f"| {c['name'] or c['user_id']} | {c['tasks_done']} | {c['open_hours']:g} | {c['hours_per_week']:g} |"
              for c in i["contributions"]]
    if done:
        lines += ["", "## Finished work", ""]
        lines += [f"- {t['title']}" + (f" ({t['agent_name'] or t['assignee_name']})" if (t['agent_name'] or t['assignee_name']) else "")
                  for t in done[:30]]
    return "\n".join(lines) + "\n"


def demo() -> None:
    from core import identity
    a = identity.add_user("ani@kampus.ac.id", "Ani", "student", "pw-check-123")
    b = identity.add_user("bimo@kampus.ac.id", "Bimo", "student", "pw-check-123")
    stranger = identity.add_user("x@x.io", "X", "student", "pw-check-123")

    mine_ws = personal(a.id)
    assert personal(a.id)["id"] == mine_ws["id"], "one personal workspace per user"
    try:
        create_invite(a.id, mine_ws["id"])
        raise AssertionError("a personal workspace is not shared")
    except Denied:
        pass

    g = create_group(a.id, "Relawan Mengajar", "Kelas sore untuk anak SD")
    inv = create_invite(a.id, g["id"])
    assert invite_info(inv["token"])["name"] == "Relawan Mengajar"
    accept_invite(b.id, inv["token"])
    accept_invite(b.id, inv["token"])
    assert role_in(b.id, g["id"]) == "member" and len(members(a.id, g["id"])) == 2
    try:
        files(stranger.id, g["id"])
        raise AssertionError("a stranger sees nothing")
    except Denied:
        pass

    f = add_file(b.id, g["id"], "notulen.txt", "Rapat 3 Nov: 12 relawan hadir. Materi pecahan untuk kelas 4.",
                 collection="Rapat")
    add_file(b.id, g["id"], "modul.txt", "Modul pecahan kelas 4: penyebut, pembilang.", collection="Materi")
    assert [x["name"] for x in collections(a.id, g["id"])] == ["Materi", "Rapat"]
    assert search(a.id, g["id"], "materi pecahan")[0]["id"] == f["id"]
    try:
        create_page(a.id, g["id"], "Ringkasan", "x", "agent:writer",
                    [{"file_id": f["id"], "quote": "20 relawan hadir"}])
        raise AssertionError("a quote that is not in the file is refused")
    except ValueError:
        pass
    pg = create_page(a.id, g["id"], "Ringkasan rapat",
                     "Rapat dihadiri dua belas relawan dan memutuskan materi pecahan untuk kelas empat minggu depan [1].\n\n"
                     "Paragraf ini menyatakan sesuatu yang panjang tanpa sumber apa pun sehingga harus ditandai oleh Reviewer.",
                     "agent:writer", [{"file_id": f["id"], "quote": "12 relawan hadir"}])
    rv = review(a.id, pg["id"])
    assert not rv["ok"] and len(rv["uncited_paragraphs"]) == 1 and rv["missing_sources"] == []
    try:
        page(stranger.id, pg["id"])
        raise AssertionError("a stranger cannot read a page by id")
    except Denied:
        pass

    t1 = create_task(a.id, g["id"], "Siapkan lembar latihan", a.id, assignee_type="user",
                     assignee_id=b.id, estimate_hours=2)
    try:
        create_task(a.id, g["id"], "x", a.id, assignee_type="user", assignee_id=stranger.id)
        raise AssertionError("only members can be assigned")
    except Denied:
        pass
    update_task(b.id, t1["id"], b.id, status="done")
    t2 = create_task(a.id, g["id"], "Draf laporan", a.id, estimate_hours=1.5)
    update_task(a.id, t2["id"], "agent:writer", status="done")
    i = impact(a.id, g["id"])
    assert i["tasks_done_by_people"] == 1 and i["tasks_done_by_agents"] == 1
    assert i["hours_saved_estimate"] == 1.5 + PAGE_HOURS, i
    rep = report_markdown(a.id, g["id"])
    assert "Relawan Mengajar" in rep and "1 by people, 1 by agents" in rep and "Bimo" in rep
    remove_member(b.id, g["id"], b.id)
    assert len(members(a.id, g["id"])) == 1
    print("space ok: personal + group workspaces · invite links · members only · sources quoted word for word "
          "· review flags uncited claims · impact and report from the record")


if __name__ == "__main__":
    from core.config import fixtures_only
    fixtures_only(__file__, "LEARIS_SPACE_CHECK")
    demo()
