"""How LEARIS spreads: public links to what a student made, and who each link brought in.

A student shares a page (a summary, a report, a paper) as a read-only link anyone can open
without an account. Every claim on it still shows the exact quote that proves it, so the link
itself shows what LEARIS does. Below it: "make one from your own files", which leads to sign-up.
The same for a community agent: a link that installs it.

Each sign-up that came through a link (a shared page, a shared agent, or a group invite) is
counted for whoever shared it, so a student sees their reach and the product sees its loop:

    share → a friend opens it → signs up → makes their own → shares it

Nothing private travels: a public page shows its title, text and the quotes it cites, with the
file *names* only; never a file's full text, the workspace, or anyone's email. A link can be
turned off at once, and deleting the page or the account ends it.
"""
from __future__ import annotations

import json
import re
import secrets
from typing import Any, Dict, Optional

from core import space
from core.store import _now, connect

KINDS = ("page", "agent")
TOKEN = re.compile(r"^[A-Za-z0-9_-]{8,64}$")


def _first_name(name: Optional[str]) -> str:
    return (name or "").strip().split(" ")[0][:40] or "A student"


def _active(c, kind: str, target_id: str, user_id: str):
    return c.execute("SELECT * FROM shares WHERE kind=? AND target_id=? AND created_by=? AND revoked=0",
                     (kind, target_id, user_id)).fetchone()


def _check_target(user_id: str, kind: str, target_id: str) -> None:
    if kind == "page":
        space.page(user_id, target_id)            # a member of its workspace, or NotFound/Denied
        return
    if kind == "agent":
        with connect() as c:
            a = c.execute("SELECT workspace_id, shared FROM agents WHERE id=?", (target_id,)).fetchone()
        if not a:
            raise space.NotFound("no such agent")
        if not a["shared"]:
            # Only an agent already in the community gallery has a public link: that is the
            # author's choice to publish its instructions.
            raise ValueError("share the agent in the community gallery first")
        return
    raise ValueError(f"kind must be one of {KINDS}")


def share(user_id: str, kind: str, target_id: str) -> Dict[str, Any]:
    """Turn on the public link (or return the one already on): one per person per item, so
    each sharer sees their own reach."""
    _check_target(user_id, kind, target_id)
    with connect() as c:
        r = _active(c, kind, target_id, user_id)
        if not r:
            token = secrets.token_urlsafe(9)
            c.execute("INSERT INTO shares (token,kind,target_id,created_by,created_at) VALUES (?,?,?,?,?)",
                      (token, kind, target_id, user_id, _now()))
            r = c.execute("SELECT * FROM shares WHERE token=?", (token,)).fetchone()
    return _status(r)


def unshare(user_id: str, kind: str, target_id: str) -> Dict[str, Any]:
    with connect() as c:
        c.execute("UPDATE shares SET revoked=1 WHERE kind=? AND target_id=? AND created_by=?",
                  (kind, target_id, user_id))
    return {"shared": False}


def status(user_id: str, kind: str, target_id: str) -> Dict[str, Any]:
    _check_target(user_id, kind, target_id)
    with connect() as c:
        r = _active(c, kind, target_id, user_id)
    return _status(r) if r else {"shared": False}


def _status(r) -> Dict[str, Any]:
    return {"shared": True, "token": r["token"], "kind": r["kind"], "views": r["views"],
            "signups": r["signups"], "since": r["created_at"]}


def _open(token: str, kind: str, count: bool):
    if not TOKEN.match(token or ""):
        raise space.NotFound("this link is not valid")
    with connect() as c:
        r = c.execute("SELECT s.*, u.name AS sharer FROM shares s LEFT JOIN users u ON u.id=s.created_by"
                      " WHERE s.token=? AND s.kind=?", (token, kind)).fetchone()
        if not r or r["revoked"] or r["sharer"] is None:
            raise space.NotFound("this link was turned off or never existed")
        if count:
            c.execute("UPDATE shares SET views=views+1 WHERE token=?", (token,))
    return r


def public_page(token: str, count: bool = True) -> Dict[str, Any]:
    """What anyone with the link sees. No ids, no emails, no file text beyond the quotes."""
    s = _open(token, "page", count)
    with connect() as c:
        p = c.execute("SELECT title, content, sources, created_by, updated_at FROM pages WHERE id=?",
                      (s["target_id"],)).fetchone()
    if not p:
        raise space.NotFound("the page behind this link was deleted")
    sources = [{"n": x["n"], "file_name": x["file_name"], "quote": x["quote"]}
               for x in json.loads(p["sources"] or "[]")]
    cited = {int(n) for n in re.findall(r"\[(\d+)\]", p["content"])}
    return {"title": p["title"], "content": p["content"], "sources": sources,
            "by_agent": str(p["created_by"]).startswith("agent:"),
            "shared_by": _first_name(s["sharer"]), "updated_at": p["updated_at"],
            "checks": {"sources": len(sources), "cited": len(cited & {x["n"] for x in sources})},
            "ref": token}


def public_agent(token: str, count: bool = True) -> Dict[str, Any]:
    s = _open(token, "agent", count)
    with connect() as c:
        a = c.execute("SELECT a.id, a.name, a.description, a.instructions, a.tools, a.installs, a.shared,"
                      " u.name AS author FROM agents a LEFT JOIN users u ON u.id=a.created_by WHERE a.id=?",
                      (s["target_id"],)).fetchone()
    if not a or not a["shared"]:
        raise space.NotFound("this agent is no longer shared")
    return {"id": a["id"], "name": a["name"], "description": a["description"], "instructions": a["instructions"],
            "tools": json.loads(a["tools"]), "installs": a["installs"], "author": _first_name(a["author"]),
            "shared_by": _first_name(s["sharer"]), "ref": token}


def record_signup(new_user_id: str, ref: Optional[str]) -> Optional[str]:
    """Credit the link a new account came through: a share token, or a group invite token.
    Returns who referred them (or None). A bad or self-referring ref is ignored, never an error."""
    ref = str(ref or "").strip()
    if not TOKEN.match(ref):
        return None
    with connect() as c:
        if c.execute("SELECT 1 FROM referrals WHERE user_id=?", (new_user_id,)).fetchone():
            return None
        r = c.execute("SELECT created_by FROM shares WHERE token=? AND revoked=0", (ref,)).fetchone()
        via = f"share:{ref}"
        if not r:
            r = c.execute("SELECT created_by FROM invites WHERE token=? AND revoked=0", (ref,)).fetchone()
            via = f"invite:{ref}"
        if not r or r["created_by"] == new_user_id:
            return None
        c.execute("INSERT INTO referrals (user_id,via,referrer_id,created_at) VALUES (?,?,?,?)",
                  (new_user_id, via, r["created_by"], _now()))
        if via.startswith("share:"):
            c.execute("UPDATE shares SET signups=signups+1 WHERE token=?", (ref,))
        return r["created_by"]


def reach(user_id: str) -> Dict[str, Any]:
    """A student's own reach: what they shared, how often it was opened, who it brought in."""
    with connect() as c:
        sh = c.execute("SELECT count(*) AS n, coalesce(sum(views),0) AS views, coalesce(sum(signups),0) AS signups"
                       " FROM shares WHERE created_by=? AND revoked=0", (user_id,)).fetchone()
        joined = c.execute("SELECT count(*) FROM referrals WHERE referrer_id=?", (user_id,)).fetchone()[0]
        installs = c.execute("SELECT coalesce(sum(installs),0) FROM agents WHERE created_by=? AND shared=1",
                             (user_id,)).fetchone()[0]
        invited = c.execute("SELECT coalesce(sum(uses),0) FROM invites WHERE created_by=?", (user_id,)).fetchone()[0]
        top = c.execute("SELECT s.token, s.kind, s.views, s.signups, coalesce(p.title, a.name) AS title"
                        " FROM shares s LEFT JOIN pages p ON s.kind='page' AND p.id=s.target_id"
                        " LEFT JOIN agents a ON s.kind='agent' AND a.id=s.target_id"
                        " WHERE s.created_by=? AND s.revoked=0 ORDER BY s.views DESC, s.created_at DESC LIMIT 5",
                        (user_id,)).fetchall()
    return {"links": sh["n"], "views": sh["views"], "signups": joined, "agent_installs": installs,
            "invite_joins": invited, "top": [dict(r) for r in top if r["title"]]}


def loop() -> Dict[str, Any]:
    """The product's loop across everyone, from the database alone (no tracking scripts):
    of the accounts, how many came through someone's link, and the links behind them."""
    with connect() as c:
        users = c.execute("SELECT count(*) FROM users").fetchone()[0]
        referred = c.execute("SELECT count(*) FROM referrals").fetchone()[0]
        sharers = c.execute("SELECT count(DISTINCT created_by) FROM shares").fetchone()[0]
        links = c.execute("SELECT count(*), coalesce(sum(views),0) FROM shares").fetchone()
        via = {r[0]: r[1] for r in c.execute(
            "SELECT substr(via,1,instr(via,':')-1), count(*) FROM referrals GROUP BY 1").fetchall()}
    return {"accounts": users, "referred": referred, "referred_pct": round(100 * referred / users, 1) if users else 0,
            "sharers": sharers, "links": links[0], "link_views": links[1], "via": via,
            # sign-ups each sharing student brought in: >1 means each wave is bigger than the last
            "k": round(referred / sharers, 2) if sharers else 0}


def demo() -> None:
    from core import identity
    a = identity.add_user("ani@kampus.ac.id", "Ani Lestari", "student", "pw-check-123")
    stranger = identity.add_user("x@x.io", "X", "student", "pw-check-123")
    w = space.personal(a.id)["id"]
    f = space.add_file(a.id, w, "materi.txt", "Normalisasi mengurangi redundansi data dalam tabel.")
    pg = space.create_page(a.id, w, "Ringkasan Basis Data", "Normalisasi mengurangi redundansi [1].", a.id,
                           [{"file_id": f["id"], "quote": "Normalisasi mengurangi redundansi data"}])

    try:
        share(stranger.id, "page", pg["id"])
        raise AssertionError("someone outside the workspace shared its page")
    except (space.Denied, space.NotFound):
        pass
    s = share(a.id, "page", pg["id"])
    assert share(a.id, "page", pg["id"])["token"] == s["token"], "one link per person per page"
    pub = public_page(s["token"])
    assert pub["title"] == "Ringkasan Basis Data" and pub["shared_by"] == "Ani"
    assert pub["sources"] == [{"n": 1, "file_name": "materi.txt", "quote": "Normalisasi mengurangi redundansi data"}]
    assert pub["checks"] == {"sources": 1, "cited": 1}
    assert "file_id" not in str(pub) and "kampus.ac.id" not in str(pub) and w not in str(pub), "nothing private"
    assert status(a.id, "page", pg["id"])["views"] == 1

    b = identity.add_user("budi@kampus.ac.id", "Budi", "student", "pw-check-123")
    assert record_signup(b.id, s["token"]) == a.id
    assert record_signup(b.id, s["token"]) is None, "counted once"
    assert record_signup(a.id, s["token"]) is None, "no self-referral"
    assert record_signup(stranger.id, "not a token!") is None
    r = reach(a.id)
    assert r["links"] == 1 and r["views"] == 1 and r["signups"] == 1 and r["top"][0]["title"] == "Ringkasan Basis Data"
    lp = loop()
    assert lp["referred"] == 1 and lp["sharers"] == 1 and lp["k"] == 1.0 and lp["via"] == {"share": 1}

    unshare(a.id, "page", pg["id"])
    try:
        public_page(s["token"])
        raise AssertionError("a turned-off link still opened")
    except space.NotFound:
        pass

    # an agent: only once it is in the community gallery
    with connect() as c:
        c.execute("INSERT INTO agents (id,workspace_id,name,description,instructions,tools,created_by,created_at,"
                  "updated_at) VALUES ('agt_x',?,'Flashcards','Makes flashcards','Read and write.','[]',?,?,?)",
                  (w, a.id, _now(), _now()))
    try:
        share(a.id, "agent", "agt_x")
        raise AssertionError("a private agent got a public link")
    except ValueError:
        pass
    with connect() as c:
        c.execute("UPDATE agents SET shared=1 WHERE id='agt_x'")
    ag = public_agent(share(a.id, "agent", "agt_x")["token"])
    assert ag["name"] == "Flashcards" and ag["author"] == "Ani"
    print("growth: share links, public views, referrals, reach and loop OK")


if __name__ == "__main__":
    from core.config import fixtures_only
    fixtures_only(__file__, "LEARIS_GROWTH_CHECK")
    demo()
