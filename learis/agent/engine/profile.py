"""Profile suggestions: LinkedIn headline, About, CV bullets and a post draft,
written ONLY from skills the evidence proves.

The template here is what a student without an AI key gets, and the floor
under what a model writes. A model's draft goes through `unproven()` before
anyone sees it: if it names a skill the evidence does not support, it is not
shown as written.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from engine import catalog, evidence
from engine.gap import MASTERED, PARTIAL


def proven(prof: Dict[str, Dict[str, Any]], minimum: float = PARTIAL) -> List[Dict[str, Any]]:
    return sorted((p for p in prof.values() if p["confidence"] >= minimum),
                  key=lambda p: (-p["verified"], -p["confidence"]))


def unproven(text: str, prof: Dict[str, Dict[str, Any]]) -> List[str]:
    """What a piece of writing claims that the evidence does not back.

    The same matcher that reads documents reads the draft, at two levels:

      · a skill that is not proven at PARTIAL or better is a claim with
        nothing behind it ("SQL" when no document shows SQL);
      · within a proven skill, a specific tool the student's documents never
        mention is still a claim ("Docker" when the evidence for deployment is
        a Vercel link). The skill's own name is always fine.
    """
    ok = {p["skill_id"]: p for p in proven(prof)}
    out = set()
    for r in evidence.match(text, "other", "draft"):
        sk = catalog.skill(r["skill_id"])
        if r["skill_id"] not in ok:
            out.add(sk["name"])
            continue
        backed = " ".join(f"{e.get('term') or ''} {e.get('quote') or ''}"
                          for e in ok[r["skill_id"]]["evidence"]).lower()
        for term in (t.strip() for t in (r["term"] or "").split(",")):
            if not term or term.lower() == sk["name"].lower() or term.lower() in sk["name"].lower():
                continue
            if not evidence._pattern(term).search(backed):
                out.add(term if term.isupper() else term.title() if term.islower() else term)
    # Technologies the taxonomy does not cover cannot be proven by it either:
    # a draft may name one only if the student's own quotes do.
    quotes = " ".join(f"{e.get('quote') or ''} {e.get('term') or ''}"
                      for p in prof.values() for e in p["evidence"]).lower()
    low = text.lower()
    for tech in catalog.watchlist():
        pat = evidence._pattern(tech)
        if pat.search(low) and not pat.search(quotes):
            out.add(tech)
    return sorted(out)


def _join(names: List[str]) -> str:
    if len(names) <= 1:
        return "".join(names)
    return ", ".join(names[:-1]) + " and " + names[-1]


def template(prof: Dict[str, Dict[str, Any]], role_name: Optional[str],
             docs: List[Dict[str, Any]]) -> Dict[str, Any]:
    strong = [p for p in proven(prof, MASTERED)]
    some = [p for p in proven(prof) if p["confidence"] < MASTERED]
    top = [p["name"] for p in strong[:4]] or [p["name"] for p in some[:3]]
    target = role_name or "Software Developer"
    headline = f"Aspiring {target}" + (f" · {' · '.join(top[:3])}" if top else "")

    about_parts = [f"Student working towards a {target} role."]
    if strong:
        about_parts.append(f"I have hands-on evidence of {_join([p['name'] for p in strong[:6]])}.")
    if some:
        about_parts.append(f"Currently building up {_join([p['name'] for p in some[:4]])}.")
    about_parts.append("Every skill listed here is backed by coursework or a project I can show.")

    bullets: List[Dict[str, Any]] = []
    by_doc: Dict[str, List[str]] = {}
    for p in proven(prof):
        for e in p["evidence"]:
            by_doc.setdefault(e["document_id"], []).append(p["name"])
    for d in docs:
        names = list(dict.fromkeys(by_doc.get(d["id"], [])))
        if len(names) < 2:
            continue
        if d["kind"] in ("project", "github", "portfolio"):
            text = f"Built {d['title']} using {_join(names[:4])}."
        elif d["kind"] == "syllabus":
            # A transcript names many courses at once; a bullet per transcript
            # reads as filler, so only a syllabus becomes a coursework line.
            text = f"Completed coursework in {d['title']} covering {_join(names[:4])}."
        else:
            continue
        bullets.append({"text": text, "source": d["title"], "skills": names[:4]})

    post = None
    if strong:
        post = (f"I mapped what my studies and projects actually taught me against what "
                f"{target} roles ask for. Turns out I can already show {_join(top[:3])}. "
                f"Next up: closing the gap one project at a time. #learning #{target.replace(' ', '')}")
    return {"headline": headline, "about": " ".join(about_parts), "bullets": bullets[:6],
            "post": post, "method": "template"}


def demo() -> None:
    def p(sid: str, c: float, doc: str = "d1") -> Dict[str, Any]:
        sk = catalog.skill(sid)
        return {"skill_id": sid, "name": sk["name"], "category": sk["category"], "confidence": c,
                "verified": False, "evidence_count": 1,
                "evidence": [{"document_id": doc, "quote": "q"}], "only_from": []}

    prof = {"react": p("react", 0.7, "d2"), "javascript": p("javascript", 0.8, "d2"),
            "html": p("html", 0.65), "css": p("css", 0.4), "sql": p("sql", 0.1)}
    docs = [{"id": "d1", "kind": "syllabus", "title": "Pemrograman Web"},
            {"id": "d2", "kind": "project", "title": "a recipe-sharing web app"}]
    t = template(prof, "Junior Web Developer", docs)
    assert t["headline"].startswith("Aspiring Junior Web Developer")
    assert "SQL" not in t["headline"] + t["about"], "a skill below the bar is never claimed"
    assert any(b["text"].startswith("Built a recipe-sharing web app using") for b in t["bullets"])
    assert unproven(t["headline"] + " " + t["about"] + " " + (t["post"] or ""), prof) == [], \
        "the template claims nothing the evidence does not back"

    assert unproven("Skilled in React, Docker and PostgreSQL.", prof) == ["Deployment and hosting", "SQL"]
    prof["deployment"] = {**p("deployment", 0.6, "d2"),
                          "evidence": [{"document_id": "d2", "term": "vercel", "quote": "Deployed on Vercel"}]}
    assert unproven("Deployed on Vercel.", prof) == []
    assert unproven("Deployment with Docker.", prof) == ["Docker"], "a tool the evidence never names"
    assert unproven("Built with React on Kubernetes.", prof) == ["Kubernetes"], "outside the taxonomy too"
    print("profile ok: written from proven skills only · a draft naming unproven skills is caught")


if __name__ == "__main__":
    demo()
