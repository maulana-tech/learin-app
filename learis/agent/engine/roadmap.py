"""The roadmap: what is left to learn, in an order that respects prerequisites.

What the evidence already proves is struck out, not dropped: seeing it crossed
off is half the point. What remains is ordered so nothing comes before the
thing it builds on, and among the things ready to start, core skills, heavy
weights and skills employers ask for most go first.

A prerequisite that the role does not list but a missing skill needs (React
needs the DOM) is pulled in, marked as a prerequisite, so the plan never asks
for something the student cannot start yet.
"""
from __future__ import annotations

import heapq
from typing import Any, Dict, List

from engine import catalog
from engine.gap import MASTERED


def _hours(sid: str, conf: float) -> float:
    full = float(catalog.skill(sid)["hours"])
    left = full * (1 - min(1.0, conf / MASTERED))
    return round(max(2.0, left) * 2) / 2          # half-hour steps, at least two hours


def build(gap: Dict[str, Any], prof: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    conf = {sid: p["confidence"] for sid, p in prof.items()}
    required = {r["skill_id"]: r for r in gap["skills"]}
    done = [r for r in gap["skills"] if r["status"] == "mastered"]
    todo = {sid for sid, r in required.items() if r["status"] != "mastered"}

    # Pull in unmet prerequisites, all the way down.
    pulled: Dict[str, str] = {}
    stack = list(todo)
    while stack:
        sid = stack.pop()
        for pre in catalog.skill(sid)["prereqs"]:
            if conf.get(pre, 0) < MASTERED and pre not in todo:
                todo.add(pre)
                pulled[pre] = sid
                stack.append(pre)

    def rank(sid: str) -> tuple:
        r = required.get(sid)
        if not r:                                  # a pulled-in prerequisite: as early as possible
            return (0, 0, 0, 0)
        return (1 if r["level"] == "core" else 2, -r["weight"], -r["demand"]["posts"], 0)

    blockers = {sid: {p for p in catalog.skill(sid)["prereqs"] if p in todo} for sid in todo}
    ready = [(rank(s), s) for s, b in blockers.items() if not b]
    heapq.heapify(ready)
    order: List[str] = []
    while ready:
        _, sid = heapq.heappop(ready)
        order.append(sid)
        for other, b in blockers.items():
            if sid in b:
                b.discard(sid)
                if not b and other not in order:
                    heapq.heappush(ready, (rank(other), other))
    assert len(order) == len(todo), "the taxonomy's prerequisites have a cycle"

    steps = []
    for i, sid in enumerate(order, 1):
        sk = catalog.skill(sid)
        r = required.get(sid)
        c = conf.get(sid, 0.0)
        steps.append({
            "step": i, "skill_id": sid, "name": sk["name"], "category": sk["category"],
            "status": r["status"] if r else ("partial" if c > 0 else "missing"),
            "confidence": round(c, 2),
            "level": r["level"] if r else "prerequisite",
            "why": (f"core for {gap['role']['name']}" if r and r["level"] == "core"
                    else f"asked for in {r['demand']['posts']} of {r['demand']['of']} sample posts"
                    if r else f"needed before {catalog.skill(pulled[sid])['name']}"),
            "prereqs": [p for p in sk["prereqs"]],
            "hours": _hours(sid, c),
        })
    return {
        "role": gap["role"],
        "done": [{"skill_id": r["skill_id"], "name": r["name"], "confidence": r["confidence"],
                  "source": r["top_source"]} for r in done],
        "steps": steps,
        "total_hours": round(sum(s["hours"] for s in steps), 1),
    }


def demo() -> None:
    from engine.gap import compute

    def p(sid: str, c: float) -> Dict[str, Any]:
        sk = catalog.skill(sid)
        return {"skill_id": sid, "name": sk["name"], "category": sk["category"], "confidence": c,
                "verified": False, "evidence_count": 1, "evidence": [{"quote": "q"}], "only_from": []}

    prof = {s: p(s, 0.75) for s in ("html", "css", "programming-basics")}
    prof["javascript"] = p("javascript", 0.3)
    g = compute(prof, "junior-web-developer", "id")
    rm = build(g, prof)
    names = [s["skill_id"] for s in rm["steps"]]
    assert "html" not in names and {d["skill_id"] for d in rm["done"]} >= {"html", "css"}
    pos = {s: i for i, s in enumerate(names)}
    for s in rm["steps"]:
        for pre in s["prereqs"]:
            if pre in pos:
                assert pos[pre] < pos[s["skill_id"]], f"{pre} must come before {s['skill_id']}"
    assert pos["javascript"] < pos["react"] and pos["dom"] < pos["react"]
    assert "linux-cli" in pos and rm["steps"][pos["linux-cli"]]["level"] == "prerequisite", \
        "git needs the command line, so it is pulled in"
    js = rm["steps"][pos["javascript"]]
    assert js["hours"] < catalog.skill("javascript")["hours"], "partial evidence shortens the step"
    print(f"roadmap ok: {len(rm['steps'])} steps, {rm['total_hours']} h · prerequisites first · "
          f"{len(rm['done'])} struck out")


if __name__ == "__main__":
    demo()
