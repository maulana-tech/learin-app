"""The gap map: what a role asks for, set against what the evidence proves.

Each required skill lands in one of three states:

  mastered  confidence at or above MASTERED
  partial   some evidence, not enough
  missing   no evidence worth the name

The match percentage is the role's weighted requirements, each scored by how
far its confidence goes towards MASTERED, so a skill halfway there counts
half. It moves the moment new evidence lands, which is what makes the radar
worth watching.

How often each skill appears in the sample job posts for the role and region
is reported beside it, read with the same matcher as the student's documents:
it is the reason a skill is on the list, in the employers' own words.
"""
from __future__ import annotations

from typing import Any, Dict, Optional

from engine import catalog, evidence

MASTERED = 0.6
PARTIAL = 0.25


def status(conf: float) -> str:
    return "mastered" if conf >= MASTERED else "partial" if conf >= PARTIAL else "missing"


def _score(conf: float) -> float:
    return min(1.0, conf / MASTERED)


def demand(role_id: str, region: Optional[str]) -> Dict[str, Dict[str, Any]]:
    """Per skill: how many of the sample posts ask for it, and in which words."""
    posts = catalog.posts(role_id, region)
    out: Dict[str, Dict[str, Any]] = {}
    for p in posts:
        for row in evidence.match(p["text"], "other", p["id"]):
            d = out.setdefault(row["skill_id"], {"posts": 0, "terms": set()})
            d["posts"] += 1
            d["terms"].update(t.strip() for t in (row["term"] or "").split(","))
    return {k: {"posts": v["posts"], "of": len(posts), "terms": sorted(v["terms"])[:5]}
            for k, v in out.items()}


def compute(prof: Dict[str, Dict[str, Any]], role_id: str,
            region: Optional[str] = None) -> Dict[str, Any]:
    role = catalog.role(role_id)
    if not role:
        raise ValueError(f"unknown role '{role_id}'")
    asked = demand(role_id, region)
    n_posts = len(catalog.posts(role_id, region))
    rows, total_w, got_w = [], 0.0, 0.0
    for req in role["requires"]:
        sk = catalog.skill(req["skill"])
        p = prof.get(req["skill"])
        conf = p["confidence"] if p else 0.0
        st = status(conf)
        total_w += req["weight"]
        got_w += req["weight"] * _score(conf)
        rows.append({
            "skill_id": req["skill"], "name": sk["name"], "category": sk["category"],
            "level": req["level"], "weight": req["weight"],
            "confidence": round(conf, 2), "status": st,
            "verified": bool(p and p["verified"]),
            "evidence_count": p["evidence_count"] if p else 0,
            "top_quote": (p["evidence"][0]["quote"] if p and p["evidence"] else None),
            "top_source": (p["evidence"][0].get("document_title") if p and p["evidence"] else None),
            "demand": asked.get(req["skill"], {"posts": 0, "of": n_posts, "terms": []}),
        })
    order = {"missing": 0, "partial": 1, "mastered": 2}
    rows.sort(key=lambda r: (order[r["status"]], r["level"] != "core", -r["weight"],
                             -r["demand"]["posts"]))
    radar = []
    for cat in catalog.categories():
        in_cat = [r for r in rows if r["category"] == cat]
        if not in_cat:
            continue
        w = sum(r["weight"] for r in in_cat)
        radar.append({"category": cat,
                      "score": round(100 * sum(r["weight"] * _score(r["confidence"]) for r in in_cat) / w),
                      "skills": len(in_cat)})
    counts = {s: sum(1 for r in rows if r["status"] == s) for s in ("mastered", "partial", "missing")}
    beyond = sorted((p for sid, p in prof.items()
                     if sid not in {r["skill_id"] for r in rows} and p["confidence"] >= PARTIAL),
                    key=lambda p: -p["confidence"])
    return {
        "role": {"id": role["id"], "name": role["name"], "summary": role["summary"]},
        "region": region,
        "match": round(100 * got_w / total_w) if total_w else 0,
        "counts": counts,
        "skills": rows,
        "radar": radar,
        "posts_read": n_posts,
        "beyond_role": [{"skill_id": p["skill_id"], "name": p["name"],
                         "confidence": p["confidence"]} for p in beyond[:8]],
        "thresholds": {"mastered": MASTERED, "partial": PARTIAL},
    }


def demo() -> None:
    def p(sid: str, conf: float) -> Dict[str, Any]:
        sk = catalog.skill(sid)
        return {"skill_id": sid, "name": sk["name"], "category": sk["category"],
                "confidence": conf, "verified": False, "evidence_count": 1,
                "evidence": [{"quote": "q", "document_title": "d"}], "only_from": ["syllabus"]}

    empty = compute({}, "junior-web-developer", "id")
    assert empty["match"] == 0 and empty["counts"]["mastered"] == 0
    assert empty["skills"][0]["level"] == "core", "missing core skills first"

    prof = {s: p(s, 0.7) for s in ("html", "css", "javascript", "git")}
    prof["react"] = p("react", 0.3)
    prof["statistics"] = p("statistics", 0.5)
    g = compute(prof, "junior-web-developer", "id")
    by = {r["skill_id"]: r for r in g["skills"]}
    assert by["html"]["status"] == "mastered" and by["react"]["status"] == "partial"
    assert by["sql"]["status"] == "missing"
    assert 0 < g["match"] < 100
    assert g["counts"] == {"mastered": 4, "partial": 1, "missing": len(g["skills"]) - 5}
    assert {r["category"] for r in g["radar"]} <= set(catalog.categories())
    assert by["javascript"]["demand"]["posts"] == g["posts_read"], "every sample post asks for JavaScript"
    assert any(b["skill_id"] == "statistics" for b in g["beyond_role"]), "skills beyond the role are kept"

    more = compute({**prof, "react": p("react", 0.8)}, "junior-web-developer", "id")
    assert more["match"] > g["match"], "new evidence moves the match"
    try:
        compute({}, "astronaut")
        raise AssertionError("an unknown role must be refused")
    except ValueError:
        pass
    print(f"gap ok: match {g['match']}% from 4 mastered + 1 partial · moves with evidence · "
          f"demand read from {g['posts_read']} sample posts")


if __name__ == "__main__":
    demo()
