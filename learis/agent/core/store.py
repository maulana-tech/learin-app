"""Persistence. SQLite, zero dependencies.

What lands here is one student's record: the documents they gave as evidence,
the skills each document proves (with the quote that proves it), what the
agents produced from that, and the trace of every run.

Privacy is a property of this file, not a promise in a README: a document's
full text is dropped the moment it has been analysed unless the student asked
to keep it, and only the quoted evidence remains.

# ponytail: SQLite; move to Postgres once this is multi-tenant at scale.
"""
from __future__ import annotations

import json
import pathlib
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, Iterator, List, Optional

from core.config import CFG

SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
  user_id        TEXT PRIMARY KEY,
  target_role    TEXT,
  region         TEXT,
  hours_per_week REAL NOT NULL DEFAULT 8,
  exam_weeks     TEXT NOT NULL DEFAULT '[]',   -- JSON list of week numbers, 1-4
  plan_start     TEXT,                          -- ISO date of week 1's Monday
  profile_text   TEXT,                          -- pasted LinkedIn/CV text, optional
  consent_at     TEXT,                          -- when they agreed to send text to an AI provider
  auto_delete    INTEGER NOT NULL DEFAULT 1,
  updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  kind         TEXT NOT NULL,      -- syllabus | transcript | project | github | portfolio | cv | other
  title        TEXT NOT NULL,
  source_url   TEXT,
  text         TEXT,               -- NULL once analysed and auto-deleted
  chars        INTEGER NOT NULL,
  uploaded_at  TEXT NOT NULL,
  analysed_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, uploaded_at);

CREATE TABLE IF NOT EXISTS evidence (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  skill_id     TEXT NOT NULL,
  quote        TEXT NOT NULL,      -- the words in the document that prove it
  term         TEXT,               -- what was matched, for a rule match
  confidence   REAL NOT NULL,      -- 0..1
  method       TEXT NOT NULL,      -- rule | ai | verified
  created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_evidence_user ON evidence(user_id, skill_id);

CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  status       TEXT NOT NULL,      -- queued | running | done | failed
  ai           TEXT,               -- the model used, or NULL for rules only
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  summary      TEXT,
  error        TEXT
);

CREATE TABLE IF NOT EXISTS steps (
  run_id   TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  seq      INTEGER NOT NULL,
  agent    TEXT NOT NULL,
  kind     TEXT NOT NULL,          -- start | info | tool | result | warn | error
  message  TEXT NOT NULL,
  detail   TEXT,
  at       TEXT NOT NULL,
  PRIMARY KEY (run_id, seq)
);

-- Things owed to a student on a schedule: the weekly check-in for now.
CREATE TABLE IF NOT EXISTS reminders (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,        -- checkin
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  done_at    TEXT,
  note       TEXT
);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id, done_at);

-- The latest output of each agent for each student, and the first gap map
-- ever computed (kind 'baseline'), which the impact numbers compare against.
CREATE TABLE IF NOT EXISTS outputs (
  user_id    TEXT NOT NULL,
  kind       TEXT NOT NULL,        -- gap | roadmap | plan | profile | baseline
  run_id     TEXT,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, kind)
);
"""

DOC_KINDS = ("syllabus", "transcript", "project", "github", "portfolio", "cv", "other")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    p = pathlib.Path(CFG.database)
    p.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(p, timeout=10)
    c.row_factory = sqlite3.Row
    c.execute("PRAGMA foreign_keys = ON")
    c.execute("PRAGMA journal_mode = WAL")
    try:
        c.executescript(SCHEMA)
        yield c
        c.commit()
    finally:
        c.close()


# ------------------------------------------------------------------- student
def student(user_id: str) -> Dict[str, Any]:
    with connect() as c:
        r = c.execute("SELECT * FROM students WHERE user_id=?", (user_id,)).fetchone()
    if not r:
        return {"user_id": user_id, "target_role": None, "region": None,
                "hours_per_week": 8.0, "exam_weeks": [], "plan_start": None,
                "profile_text": None, "consent_at": None,
                "auto_delete": CFG.auto_delete, "updated_at": None}
    d = dict(r)
    d["exam_weeks"] = json.loads(d["exam_weeks"] or "[]")
    d["auto_delete"] = bool(d["auto_delete"])
    return d


STUDENT_FIELDS = {"target_role", "region", "hours_per_week", "exam_weeks", "plan_start",
                  "profile_text", "consent_at", "auto_delete"}


def update_student(user_id: str, **fields) -> Dict[str, Any]:
    bad = set(fields) - STUDENT_FIELDS
    if bad:
        raise ValueError(f"unknown field(s): {', '.join(sorted(bad))}")
    cur = student(user_id)
    cur.update(fields)
    with connect() as c:
        c.execute(
            "INSERT INTO students (user_id,target_role,region,hours_per_week,exam_weeks,"
            "plan_start,profile_text,consent_at,auto_delete,updated_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET"
            " target_role=excluded.target_role, region=excluded.region,"
            " hours_per_week=excluded.hours_per_week, exam_weeks=excluded.exam_weeks,"
            " plan_start=excluded.plan_start, profile_text=excluded.profile_text,"
            " consent_at=excluded.consent_at, auto_delete=excluded.auto_delete,"
            " updated_at=excluded.updated_at",
            (user_id, cur["target_role"], cur["region"], float(cur["hours_per_week"]),
             json.dumps(cur["exam_weeks"]), cur["plan_start"], cur["profile_text"],
             cur["consent_at"], int(bool(cur["auto_delete"])), _now()))
    return student(user_id)


# ----------------------------------------------------------------- documents
def add_document(user_id: str, kind: str, title: str, text: str,
                 source_url: Optional[str] = None) -> Dict[str, Any]:
    if kind not in DOC_KINDS:
        raise ValueError(f"kind must be one of {', '.join(DOC_KINDS)}")
    did = new_id("doc")
    with connect() as c:
        c.execute("INSERT INTO documents (id,user_id,kind,title,source_url,text,chars,uploaded_at)"
                  " VALUES (?,?,?,?,?,?,?,?)",
                  (did, user_id, kind, title, source_url, text, len(text), _now()))
    return document(did)


def document(did: str, with_text: bool = False) -> Optional[Dict[str, Any]]:
    with connect() as c:
        r = c.execute("SELECT * FROM documents WHERE id=?", (did,)).fetchone()
    if not r:
        return None
    d = dict(r)
    d["text_kept"] = d["text"] is not None
    if not with_text:
        d.pop("text")
    return d


def documents(user_id: str) -> List[Dict[str, Any]]:
    with connect() as c:
        rows = c.execute(
            "SELECT d.id, d.kind, d.title, d.source_url, d.chars, d.uploaded_at, d.analysed_at,"
            " d.text IS NOT NULL AS text_kept,"
            " (SELECT count(DISTINCT skill_id) FROM evidence e WHERE e.document_id=d.id) AS skills"
            " FROM documents d WHERE d.user_id=? ORDER BY d.uploaded_at", (user_id,)).fetchall()
    return [dict(r) | {"text_kept": bool(r["text_kept"])} for r in rows]


def pending_documents(user_id: str) -> List[Dict[str, Any]]:
    """Documents not analysed yet, with their text."""
    with connect() as c:
        rows = c.execute("SELECT * FROM documents WHERE user_id=? AND analysed_at IS NULL"
                         " AND text IS NOT NULL ORDER BY uploaded_at", (user_id,)).fetchall()
    return [dict(r) for r in rows]


def mark_analysed(did: str, drop_text: bool) -> None:
    with connect() as c:
        if drop_text:
            c.execute("UPDATE documents SET analysed_at=?, text=NULL WHERE id=?", (_now(), did))
        else:
            c.execute("UPDATE documents SET analysed_at=? WHERE id=?", (_now(), did))


def delete_document(user_id: str, did: str) -> bool:
    with connect() as c:
        n = c.execute("DELETE FROM documents WHERE id=? AND user_id=?", (did, user_id)).rowcount
    return n > 0


def reset_documents(user_id: str) -> None:
    """Analyse again every document whose text is still kept: its old rule and
    AI evidence goes and it becomes pending. A document whose text was deleted
    keeps its evidence, because nothing could replace it. Verified evidence
    always stays: it was earned."""
    with connect() as c:
        c.execute("DELETE FROM evidence WHERE user_id=? AND method!='verified' AND document_id IN"
                  " (SELECT id FROM documents WHERE user_id=? AND text IS NOT NULL)", (user_id, user_id))
        c.execute("UPDATE documents SET analysed_at=NULL WHERE user_id=? AND text IS NOT NULL",
                  (user_id,))


# ------------------------------------------------------------------ evidence
def add_evidence(user_id: str, rows: List[Dict[str, Any]]) -> int:
    with connect() as c:
        c.executemany(
            "INSERT INTO evidence (user_id,document_id,skill_id,quote,term,confidence,method,created_at)"
            " VALUES (?,?,?,?,?,?,?,?)",
            [(user_id, r["document_id"], r["skill_id"], r["quote"], r.get("term"),
              float(r["confidence"]), r["method"], _now()) for r in rows])
    return len(rows)


def evidence(user_id: str) -> List[Dict[str, Any]]:
    with connect() as c:
        rows = c.execute(
            "SELECT e.*, d.title AS document_title, d.kind AS document_kind, d.source_url"
            " FROM evidence e JOIN documents d ON d.id=e.document_id"
            " WHERE e.user_id=? ORDER BY e.confidence DESC", (user_id,)).fetchall()
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------- runs
def start_run(user_id: str, ai: Optional[str], status: str = "running") -> str:
    rid = new_id("run")
    with connect() as c:
        c.execute("INSERT INTO runs (id,user_id,status,ai,started_at) VALUES (?,?,?,?,?)",
                  (rid, user_id, status, ai, _now()))
    return rid


def set_run_status(run_id: str, status: str) -> None:
    with connect() as c:
        c.execute("UPDATE runs SET status=? WHERE id=?", (status, run_id))


def fail_stale_runs(older_than_minutes: int = 20) -> int:
    """Runs a worker can no longer be holding: the process restarted, or a
    model call hung past every timeout. Left 'running' they block the student
    from starting another one, so they are closed with the reason."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=older_than_minutes)).isoformat(timespec="seconds")
    with connect() as c:
        return c.execute("UPDATE runs SET status='failed', finished_at=?, error=?"
                         " WHERE status IN ('queued','running') AND started_at < ?",
                         (_now(), "stopped: no worker finished it", cutoff)).rowcount


def purge_kept_text() -> int:
    """Full text still held for an analysed document whose student wants it
    deleted, e.g. one analysed before they switched auto-delete on."""
    with connect() as c:
        return c.execute(
            "UPDATE documents SET text=NULL WHERE text IS NOT NULL AND analysed_at IS NOT NULL"
            " AND user_id IN (SELECT user_id FROM students WHERE auto_delete=1)"
            + (" OR (text IS NOT NULL AND analysed_at IS NOT NULL AND user_id NOT IN"
               " (SELECT user_id FROM students))" if CFG.auto_delete else "")).rowcount


# ----------------------------------------------------------------- reminders
def add_reminder(user_id: str, kind: str, message: str) -> str:
    rid = new_id("rem")
    with connect() as c:
        c.execute("INSERT INTO reminders (id,user_id,kind,message,created_at) VALUES (?,?,?,?,?)",
                  (rid, user_id, kind, message, _now()))
    return rid


def reminders(user_id: str, open_only: bool = True) -> List[Dict[str, Any]]:
    with connect() as c:
        rows = c.execute("SELECT * FROM reminders WHERE user_id=?"
                         + (" AND done_at IS NULL" if open_only else "")
                         + " ORDER BY created_at DESC", (user_id,)).fetchall()
    return [dict(r) for r in rows]


def finish_reminder(user_id: str, rid: str, note: Optional[str] = None) -> bool:
    with connect() as c:
        return c.execute("UPDATE reminders SET done_at=?, note=? WHERE id=? AND user_id=? AND done_at IS NULL",
                         (_now(), note, rid, user_id)).rowcount > 0


def checkin_due(days: int = 7) -> List[str]:
    """Students with a plan, no open check-in, and none in the last `days`."""
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat(timespec="seconds")
    with connect() as c:
        rows = c.execute(
            "SELECT o.user_id FROM outputs o WHERE o.kind='plan' AND o.created_at < ?"
            " AND NOT EXISTS (SELECT 1 FROM reminders r WHERE r.user_id=o.user_id AND r.kind='checkin'"
            "   AND (r.done_at IS NULL OR r.created_at >= ?))", (cutoff, cutoff)).fetchall()
    return [r["user_id"] for r in rows]


def add_step(run_id: str, agent: str, kind: str, message: str,
             detail: Optional[Dict[str, Any]] = None) -> None:
    with connect() as c:
        seq = c.execute("SELECT COALESCE(MAX(seq),0)+1 FROM steps WHERE run_id=?",
                        (run_id,)).fetchone()[0]
        c.execute("INSERT INTO steps (run_id,seq,agent,kind,message,detail,at) VALUES (?,?,?,?,?,?,?)",
                  (run_id, seq, agent, kind, message,
                   json.dumps(detail, ensure_ascii=False) if detail is not None else None, _now()))


def finish_run(run_id: str, status: str, summary: Optional[Dict[str, Any]] = None,
               error: Optional[str] = None) -> None:
    with connect() as c:
        c.execute("UPDATE runs SET status=?, finished_at=?, summary=?, error=? WHERE id=?",
                  (status, _now(), json.dumps(summary or {}, ensure_ascii=False), error, run_id))


def run(run_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    with connect() as c:
        r = c.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        if not r or (user_id and r["user_id"] != user_id):
            return None
        steps = c.execute("SELECT * FROM steps WHERE run_id=? ORDER BY seq", (run_id,)).fetchall()
    d = dict(r)
    d["summary"] = json.loads(d["summary"]) if d["summary"] else None
    d["steps"] = [dict(s) | {"detail": json.loads(s["detail"]) if s["detail"] else None}
                  for s in steps]
    return d


def runs(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    with connect() as c:
        rows = c.execute("SELECT id,status,ai,started_at,finished_at,error FROM runs"
                         " WHERE user_id=? ORDER BY started_at DESC LIMIT ?",
                         (user_id, limit)).fetchall()
    return [dict(r) for r in rows]


# ------------------------------------------------------------------- outputs
def save_output(user_id: str, kind: str, payload: Any, run_id: Optional[str] = None) -> None:
    with connect() as c:
        c.execute("INSERT INTO outputs (user_id,kind,run_id,payload,created_at) VALUES (?,?,?,?,?)"
                  " ON CONFLICT(user_id,kind) DO UPDATE SET run_id=excluded.run_id,"
                  " payload=excluded.payload, created_at=excluded.created_at",
                  (user_id, kind, run_id, json.dumps(payload, ensure_ascii=False), _now()))


def output(user_id: str, kind: str) -> Optional[Dict[str, Any]]:
    with connect() as c:
        r = c.execute("SELECT * FROM outputs WHERE user_id=? AND kind=?", (user_id, kind)).fetchone()
    if not r:
        return None
    return {"payload": json.loads(r["payload"]), "run_id": r["run_id"], "created_at": r["created_at"]}


def save_baseline_once(user_id: str, payload: Any, run_id: Optional[str] = None) -> None:
    if output(user_id, "baseline") is None:
        save_output(user_id, "baseline", payload, run_id)


def clear_outputs(user_id: str, kinds: Optional[List[str]] = None) -> None:
    with connect() as c:
        if kinds:
            c.executemany("DELETE FROM outputs WHERE user_id=? AND kind=?",
                          [(user_id, k) for k in kinds])
        else:
            c.execute("DELETE FROM outputs WHERE user_id=?", (user_id,))


def demo() -> None:
    uid = "usr_check"
    s = update_student(uid, target_role="junior-web-developer", hours_per_week=6, exam_weeks=[3])
    assert s["target_role"] == "junior-web-developer" and s["exam_weeks"] == [3]
    try:
        update_student(uid, password="x")
        raise AssertionError("an unknown field must be refused")
    except ValueError:
        pass

    d = add_document(uid, "syllabus", "Pemrograman Web", "HTML, CSS dan JavaScript")
    assert d and d["text_kept"] and d["chars"] == len("HTML, CSS dan JavaScript")
    assert [x["id"] for x in pending_documents(uid)] == [d["id"]]
    add_evidence(uid, [{"document_id": d["id"], "skill_id": "html", "quote": "HTML",
                        "confidence": 0.45, "method": "rule"}])
    mark_analysed(d["id"], drop_text=True)
    assert not document(d["id"])["text_kept"], "auto-delete drops the text"
    assert evidence(uid)[0]["quote"] == "HTML", "the quote survives the text"
    assert pending_documents(uid) == []

    rid = start_run(uid, None)
    add_step(rid, "orchestrator", "start", "go")
    add_step(rid, "evidence", "result", "1 skill", {"skills": 1})
    finish_run(rid, "done", {"ok": True})
    r = run(rid, uid)
    assert r and [s["seq"] for s in r["steps"]] == [1, 2] and r["summary"] == {"ok": True}
    assert run(rid, "someone_else") is None, "a run belongs to its student"

    save_output(uid, "gap", {"match": 10}, rid)
    save_baseline_once(uid, {"match": 10})
    save_baseline_once(uid, {"match": 90})
    assert output(uid, "baseline")["payload"] == {"match": 10}, "the baseline is the first one"

    reset_documents(uid)
    assert evidence(uid), "reading again never deletes evidence whose text is gone"
    assert delete_document(uid, d["id"]) and evidence(uid) == [], "evidence goes with its document"

    # Scheduled housekeeping.
    stuck = start_run(uid, None, status="queued")
    with connect() as c:
        c.execute("UPDATE runs SET started_at='2000-01-01T00:00:00+00:00' WHERE id=?", (stuck,))
    assert fail_stale_runs() == 1 and run(stuck)["status"] == "failed"
    kept = add_document(uid, "cv", "CV", "x" * 30)
    mark_analysed(kept["id"], drop_text=False)
    assert purge_kept_text() >= 1 and not document(kept["id"])["text_kept"], "auto-delete applies later too"
    with connect() as c:
        c.execute("UPDATE outputs SET created_at='2000-01-01T00:00:00+00:00' WHERE user_id=? AND kind='gap'", (uid,))
    save_output(uid, "plan", {"weeks": []})
    with connect() as c:
        c.execute("UPDATE outputs SET created_at='2000-01-01T00:00:00+00:00' WHERE user_id=? AND kind='plan'", (uid,))
    assert checkin_due() == [uid]
    rem = add_reminder(uid, "checkin", "How did week 1 go?")
    assert checkin_due() == [], "one open check-in at a time"
    assert finish_reminder(uid, rem, "good") and reminders(uid) == []
    print("store ok: text dropped after analysis, quotes kept, runs scoped to their student")


if __name__ == "__main__":
    from core.config import fixtures_only
    fixtures_only(__file__, "LEARIS_STORE_CHECK")
    demo()
