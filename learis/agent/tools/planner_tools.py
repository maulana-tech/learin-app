"""The Planner Agent's tools. The hours are arithmetic; the model only adds words."""
from __future__ import annotations

from datetime import date
from typing import Any, Dict

from core import store
from core.registry import Ctx, ToolRefused, tool
from engine import evidence, planner


@tool("get_schedule", "planner",
      "The student's free hours a week, exam weeks (1-4) and plan start.")
def get_schedule(ctx: Ctx) -> Dict[str, Any]:
    st = store.student(ctx.user_id)
    return {"hours_per_week": st["hours_per_week"], "exam_weeks": st["exam_weeks"],
            "plan_start": st.get("plan_start"),
            "rules": {"fill_at_most": f"{round(planner.BUFFER * 100)}% of free hours",
                      "exam_week": f"{round(planner.EXAM_SHARE * 100)}% of that"}}


@tool("build_plan", "planner",
      "Cut the saved roadmap into four weeks that fit the student's free hours and shrink in exam "
      "weeks, and save it. Returns what each week holds.", writes=True, mcp=True)
def build_plan(ctx: Ctx) -> Dict[str, Any]:
    rm = store.output(ctx.user_id, "roadmap")
    if not rm:
        raise ToolRefused("there is no roadmap yet; the Roadmap Agent builds it first")
    st = store.student(ctx.user_id)
    start = date.fromisoformat(st["plan_start"]) if st.get("plan_start") else None
    plan = planner.build(rm["payload"], float(st["hours_per_week"]), st["exam_weeks"], start)
    store.save_output(ctx.user_id, "plan", plan, ctx.run_id)
    ctx.saved.add("plan")
    return {"planned_hours": plan["planned_hours"], "later_hours": plan["later_hours"],
            "warnings": plan["warnings"],
            "weeks": [{"week": w["week"], "exam": w["exam"], "planned_hours": w["planned_hours"],
                       "capacity": w["capacity"], "tasks": [t["name"] for t in w["tasks"]]}
                      for w in plan["weeks"]]}


@tool("set_week_focus", "planner",
      "Save one short, encouraging focus line (max 160 characters) for a week of the plan. It may "
      "only mention that week's own tasks. In an exam week, say revision comes first.",
      {"week": {"type": "integer", "minimum": 1, "maximum": 4}, "focus": {"type": "string"}},
      ["week", "focus"], writes=True)
def set_week_focus(ctx: Ctx, week: int, focus: str) -> Dict[str, Any]:
    p = store.output(ctx.user_id, "plan")
    if not p or "plan" not in ctx.saved:
        raise ToolRefused("call build_plan first")
    focus = focus.strip()
    if not focus or len(focus) > 160:
        raise ToolRefused("the focus line must be 1 to 160 characters")
    plan = p["payload"]
    w = next(x for x in plan["weeks"] if x["week"] == week)
    allowed = {t["skill_id"] for t in w["tasks"]}
    named = {r["skill_id"] for r in evidence.match(focus, "other", "focus")}
    if named - allowed:
        raise ToolRefused("it mentions a skill that is not in week %d's tasks" % week)
    w["focus"] = focus
    store.save_output(ctx.user_id, "plan", plan, ctx.run_id)
    return {"saved": True, "week": week}
