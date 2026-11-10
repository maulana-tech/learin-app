"""The four-week plan: the roadmap, cut to fit a real student's week.

Two rules, enforced here rather than suggested in a prompt:

  · a week never holds more than the hours the student said they have free,
    and only BUFFER of them are filled, so a bad week does not break the plan;
  · an exam week shrinks to EXAM_SHARE of that, because a plan that ignores
    exams is the plan that gets abandoned, and then burns the student out.

The roadmap's order is kept. A step too big for what is left of a week is
split across weeks rather than squeezed in. Whatever does not fit in four weeks
is listed as "after week 4", visibly, not silently dropped.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any, Dict, List, Optional

BUFFER = 0.85
EXAM_SHARE = 0.3
WEEKS = 4
#: Hours per week above which the plan warns: a student carrying a full course
#: load who plans more than this every week is planning to burn out.
HEAVY = 15


def monday(d: Optional[date] = None) -> date:
    d = d or date.today()
    return d - timedelta(days=d.weekday())


def capacity(hours: float, exam: bool) -> float:
    cap = hours * BUFFER * (EXAM_SHARE if exam else 1.0)
    return round(cap * 2) / 2                       # half-hour steps


def build(roadmap: Dict[str, Any], hours_per_week: float, exam_weeks: List[int],
          start: Optional[date] = None) -> Dict[str, Any]:
    if hours_per_week <= 0:
        raise ValueError("hours per week must be more than zero")
    start = monday(start)
    exams = {int(w) for w in exam_weeks if 1 <= int(w) <= WEEKS}
    queue = [dict(s, left=s["hours"]) for s in roadmap["steps"]]
    weeks = []
    for n in range(1, WEEKS + 1):
        cap = capacity(hours_per_week, n in exams)
        room, tasks = cap, []
        while queue and room >= 0.5:
            step = queue[0]
            take = min(step["left"], room)
            take = round(take * 2) / 2
            if take < 0.5:
                break
            part_of = step["left"] < step["hours"] or take < step["left"]
            tasks.append({"skill_id": step["skill_id"], "name": step["name"], "hours": take,
                          "status": step["status"], "continues": take < step["left"],
                          "split": part_of})
            step["left"] = round(step["left"] - take, 1)
            room = round(room - take, 1)
            if step["left"] < 0.5:
                queue.pop(0)
        planned = round(cap - room, 1)
        weeks.append({
            "week": n, "starts": (start + timedelta(weeks=n - 1)).isoformat(),
            "exam": n in exams, "free_hours": hours_per_week, "capacity": cap,
            "planned_hours": planned,
            "load_pct": round(100 * planned / hours_per_week) if hours_per_week else 0,
            "tasks": tasks,
        })
    later = [{"skill_id": s["skill_id"], "name": s["name"], "hours": s["left"]} for s in queue]
    warnings = []
    if hours_per_week > HEAVY:
        warnings.append(f"{hours_per_week:g} free hours every week on top of classes is a lot. "
                        "If a week goes badly, lower it here rather than falling behind.")
    if exams:
        warnings.append(f"Exam week{'s' if len(exams) > 1 else ''} "
                        f"{', '.join(str(w) for w in sorted(exams))}: the plan drops to "
                        f"{round(EXAM_SHARE * 100)}% so revision comes first.")
    return {"start": start.isoformat(), "hours_per_week": hours_per_week,
            "exam_weeks": sorted(exams), "weeks": weeks, "later": later,
            "planned_hours": round(sum(w["planned_hours"] for w in weeks), 1),
            "later_hours": round(sum(x["hours"] for x in later), 1),
            "rules": {"buffer": BUFFER, "exam_share": EXAM_SHARE}, "warnings": warnings}


def demo() -> None:
    rm = {"steps": [
        {"skill_id": "linux-cli", "name": "Command line", "hours": 4, "status": "missing"},
        {"skill_id": "git", "name": "Git", "hours": 8, "status": "missing"},
        {"skill_id": "react", "name": "React", "hours": 30, "status": "partial"},
    ]}
    p = build(rm, 8, [3], date(2026, 11, 11))
    assert p["start"] == "2026-11-09", "weeks start on a Monday"
    for w in p["weeks"]:
        assert w["planned_hours"] <= w["capacity"] <= w["free_hours"], w
    assert p["weeks"][2]["exam"] and p["weeks"][2]["capacity"] < p["weeks"][1]["capacity"] / 2
    order = [t["skill_id"] for w in p["weeks"] for t in w["tasks"]]
    assert order.index("linux-cli") < order.index("git") < order.index("react"), "roadmap order kept"
    total = p["planned_hours"] + p["later_hours"]
    assert abs(total - 42) < 0.01, f"nothing is dropped: {total}"
    assert p["later"] and p["later"][0]["skill_id"] == "react", "what does not fit is listed"
    assert any(t["continues"] for t in p["weeks"][0]["tasks"] + p["weeks"][1]["tasks"]), \
        "a step bigger than the room left is split, not squeezed"
    assert build(rm, 20, [])["warnings"], "a very heavy week gets a warning"
    try:
        build(rm, 0, [])
        raise AssertionError("zero hours is refused")
    except ValueError:
        pass
    print(f"planner ok: never over capacity · exam week at {round(EXAM_SHARE * 100)}% · order kept · "
          f"{p['later_hours']} h shown as after week 4, not dropped")


if __name__ == "__main__":
    demo()
