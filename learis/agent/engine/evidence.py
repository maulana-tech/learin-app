"""Skill evidence: which skills a document proves, with the words that prove it.

The rule the whole product rests on: no skill without evidence. Every skill
found here carries the quote it was found in and a confidence, and the
confidence depends on what kind of document said it. A project README that
describes using React is stronger evidence than a transcript line that names a
course called "Pemrograman Web": the course name hints at a skill, the README
shows it used.

Two ways in, one output shape:

  match()          deterministic, from the taxonomy's aliases. Always runs,
                   needs no model, and is what a student without an AI key gets.
  validate_ai()    what a model proposed, kept only if the skill exists in the
                   taxonomy and the quote it gave is really in the document. A
                   model that invents a quote gets nothing for it.
"""
from __future__ import annotations

import re
from typing import Any, Dict, Iterable, List, Optional, Tuple

from engine import catalog

#: How much one mention in each kind of document is worth.
BASE = {"github": 0.65, "project": 0.6, "portfolio": 0.55, "syllabus": 0.45,
        "cv": 0.35, "other": 0.35, "transcript": 0.3}
#: A course name is a hint, not a demonstration.
COURSE_FACTOR = 0.7
#: The most a single document can prove on its own, and the most any amount of
#: unverified evidence can add up to. Only a verified project goes higher.
DOC_CAP = 0.8
TOTAL_CAP = 0.9
VERIFIED = 0.95

#: A grade printed on a transcript line moves the course's evidence a little.
GRADE_BONUS = {"A": 0.1, "AB": 0.07, "B": 0.05, "BC": 0.0, "C": -0.05, "D": -0.1, "E": -0.15}
_GRADE = re.compile(r"(?<![A-Za-z])(A|AB|B\+?|BC|C\+?|D|E|A-|B-)(?![A-Za-z])")


def _pattern(term: str) -> re.Pattern:
    return re.compile(r"(?<![a-z0-9])" + re.escape(term.lower()) + r"(?![a-z0-9])")


_PATTERNS: Dict[str, List[Tuple[str, re.Pattern, bool]]] = {}


def _patterns() -> Dict[str, List[Tuple[str, re.Pattern, bool]]]:
    if not _PATTERNS:
        for s in catalog.skills():
            pats = [(a, _pattern(a), False) for a in s["aliases"]]
            pats += [(c, _pattern(c), True) for c in s.get("courses", [])]
            _PATTERNS[s["id"]] = pats
    return _PATTERNS


def _lines(text: str) -> List[str]:
    return [ln.strip() for ln in re.split(r"[\r\n]+|(?<=[.!?])\s+", text) if ln.strip()]


def _quote(line: str, limit: int = 180) -> str:
    return line if len(line) <= limit else line[:limit - 1].rstrip() + "…"


def _grade_bonus(line: str) -> float:
    m = _GRADE.findall(line)
    if not m:
        return 0.0
    g = m[-1].rstrip("+-")
    return GRADE_BONUS.get(g, 0.0)


def match(text: str, kind: str, document_id: str) -> List[Dict[str, Any]]:
    """Every skill the text mentions, at most one evidence row per skill."""
    base = BASE.get(kind, BASE["other"])
    lines = _lines(text)
    lowered = [ln.lower() for ln in lines]
    out: List[Dict[str, Any]] = []
    for sid, pats in _patterns().items():
        terms: set = set()
        topic_line: Optional[str] = None      # a line naming the skill itself
        course_line: Optional[str] = None     # a line naming only a course that teaches it
        for term, pat, is_course in pats:
            for ln, low in zip(lines, lowered):
                if pat.search(low):
                    terms.add(term)
                    if is_course:
                        course_line = course_line or ln
                    else:
                        topic_line = topic_line or ln
                    break
        if not terms:
            continue
        # A transcript line is a course title whatever words it uses: it says
        # a course was passed, not that the skill was used.
        hint_only = kind == "transcript" or topic_line is None
        line = (course_line or topic_line) if kind == "transcript" else (topic_line or course_line)
        conf = base * (COURSE_FACTOR if hint_only else 1.0)
        conf += min(0.2, 0.1 * (len(terms) - 1))       # several distinct words, same skill
        if kind == "transcript":
            conf += _grade_bonus(line)
        conf = round(max(0.05, min(DOC_CAP, conf)), 2)
        out.append({"document_id": document_id, "skill_id": sid, "quote": _quote(line),
                    "term": ", ".join(sorted(terms))[:120], "confidence": conf,
                    "method": "rule"})
    return out


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


def validate_ai(proposed: Iterable[Dict[str, Any]], text: str, kind: str,
                document_id: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Keep what a model proposed only where it can be checked. Returns the
    rows kept and a sentence for each one dropped."""
    body = _norm(text)
    cap = min(DOC_CAP, BASE.get(kind, BASE["other"]) + 0.2)
    kept, dropped, seen = [], [], set()
    for p in proposed:
        sid, quote = str(p.get("skill_id") or ""), str(p.get("quote") or "").strip()
        if not catalog.skill(sid):
            dropped.append(f"'{sid}' is not a skill in the taxonomy")
            continue
        if len(quote) < 3 or _norm(quote) not in body:
            dropped.append(f"{sid}: the quote is not in the document")
            continue
        if sid in seen:
            continue
        seen.add(sid)
        conf = round(max(0.05, min(cap, float(p.get("confidence") or 0))), 2)
        kept.append({"document_id": document_id, "skill_id": sid, "quote": _quote(quote),
                     "term": None, "confidence": conf, "method": "ai"})
    return kept, dropped


def merge(rule: List[Dict[str, Any]], ai: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """One row per skill per document: the stronger of the two, or both quotes
    when they differ. The rule match stays when the model agrees, because a
    rule match is reproducible."""
    by_skill = {r["skill_id"]: r for r in rule}
    out = list(rule)
    for a in ai:
        r = by_skill.get(a["skill_id"])
        if r is None:
            out.append(a)
        elif a["confidence"] > r["confidence"]:
            r["confidence"] = round(min(DOC_CAP, (r["confidence"] + a["confidence"]) / 2 + 0.05), 2)
    return out


def profile(rows: Iterable[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    """Every skill the evidence supports, with a combined confidence.

    Independent pieces of evidence combine as 1 - Π(1 - c): two documents that
    each say "maybe" add up to more than either, never past TOTAL_CAP until a
    project is verified."""
    by: Dict[str, Dict[str, Any]] = {}
    for r in rows:
        s = by.setdefault(r["skill_id"], {"skill_id": r["skill_id"], "miss": 1.0,
                                          "evidence": [], "verified": False, "kinds": set()})
        s["miss"] *= (1 - float(r["confidence"]))
        s["evidence"].append(r)
        s["kinds"].add(r.get("document_kind") or "")
        if r.get("method") == "verified":
            s["verified"] = True
    out = {}
    for sid, s in by.items():
        sk = catalog.skill(sid) or {"name": sid, "category": "Foundations"}
        conf = 1 - s["miss"]
        conf = max(conf, VERIFIED) if s["verified"] else min(conf, TOTAL_CAP)
        out[sid] = {"skill_id": sid, "name": sk["name"], "category": sk["category"],
                    "confidence": round(conf, 2), "verified": s["verified"],
                    "evidence_count": len(s["evidence"]),
                    "evidence": sorted(s["evidence"], key=lambda e: -float(e["confidence"])),
                    "only_from": sorted(k for k in s["kinds"] if k)}
    return out


def hidden(prof: Dict[str, Dict[str, Any]], cv_text: Optional[str]) -> List[str]:
    """Skills proven by coursework or projects that the student's own CV or
    profile does not name. These are the ones nobody would have known about."""
    cv = (cv_text or "").lower()
    found = []
    for sid, s in prof.items():
        if s["confidence"] < 0.25 or s["only_from"] == ["cv"]:
            continue
        sk = catalog.skill(sid)
        words = [sk["name"].lower()] + [a.lower() for a in sk["aliases"]] if sk else [sid]
        if not any(_pattern(w).search(cv) for w in words):
            found.append(sid)
    return found


def demo() -> None:
    syllabus = ("Mata kuliah Pemrograman Web. Topik: HTML5 semantik, CSS flexbox dan grid, "
                "media query untuk tampilan mobile-first, JavaScript ES6 dan DOM.\n"
                "Tugas akhir: aplikasi CRUD dengan REST API dan MySQL.")
    rows = match(syllabus, "syllabus", "doc1")
    got = {r["skill_id"]: r for r in rows}
    for sid in ("html", "css", "responsive-design", "javascript", "dom", "rest-api", "sql"):
        assert sid in got, f"{sid} missing from {sorted(got)}"
    assert "react" not in got, "a skill nobody mentioned is not found"
    assert all(r["quote"] and r["quote"] in syllabus.replace("\n", " ") or r["quote"] in syllabus
               for r in rows), "every quote is the document's own words"
    assert got["css"]["confidence"] > BASE["syllabus"], "flexbox + grid + css: several words, more confidence"

    transcript = "IF2110 Struktur Data 3 A\nIF2240 Basis Data 3 C\nMA1101 Statistika 2 B"
    t = {r["skill_id"]: r for r in match(transcript, "transcript", "doc2")}
    assert t["data-structures"]["confidence"] > t["sql"]["confidence"], "an A beats a C"
    assert t["sql"]["confidence"] < BASE["transcript"], "a course name alone is a weak hint"

    # A model's proposal is checked against the document, not trusted.
    kept, dropped = validate_ai([
        {"skill_id": "react", "quote": "built with React hooks", "confidence": 0.9},
        {"skill_id": "html", "quote": "HTML5 semantik", "confidence": 0.99},
        {"skill_id": "time-travel", "quote": "HTML5", "confidence": 0.5},
    ], syllabus, "syllabus", "doc1")
    assert [k["skill_id"] for k in kept] == ["html"], kept
    assert kept[0]["confidence"] <= BASE["syllabus"] + 0.2, "confidence capped by the kind of document"
    assert len(dropped) == 2 and any("not in the document" in d for d in dropped)

    prof = profile([dict(r, document_kind="syllabus") for r in rows]
                   + [dict(r, document_kind="transcript") for r in t.values()])
    assert prof["sql"]["confidence"] > max(got["sql"]["confidence"], t["sql"]["confidence"]), \
        "two documents agreeing add up"
    assert all(p["confidence"] <= TOTAL_CAP for p in prof.values())
    v = profile([{"skill_id": "react", "confidence": 0.4, "method": "verified", "document_kind": "github"}])
    assert v["react"]["confidence"] == VERIFIED and v["react"]["verified"]

    h = hidden(prof, "Saya menguasai HTML dan CSS.")
    assert "html" not in h and "css" not in h and "dom" in h, h
    print(f"evidence ok: {len(rows)} skills from one syllabus, each with its quote · grades count · "
          "a model's invented quote is dropped · evidence combines, capped until verified")


if __name__ == "__main__":
    demo()
