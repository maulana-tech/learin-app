"""The Roadmap Agent's tools. Every number is computed here, never by the model."""
from __future__ import annotations

from typing import Any, Dict, Optional

from core import store
from core.registry import Ctx, ToolRefused, tool
from engine import catalog, evidence, gap, roadmap


def profile_of(user_id: str) -> Dict[str, Dict[str, Any]]:
    return evidence.profile(store.evidence(user_id))


@tool("get_skill_profile", "roadmap",
      "Every skill the student's evidence proves, with combined confidence and how many sources "
      "back it, plus the hidden skills (proven but not on their own profile).", mcp=True)
def get_skill_profile(ctx: Ctx) -> Dict[str, Any]:
    prof = profile_of(ctx.user_id)
    st = store.student(ctx.user_id)
    return {"skills": [{"skill_id": p["skill_id"], "name": p["name"], "category": p["category"],
                        "confidence": p["confidence"], "status": gap.status(p["confidence"]),
                        "sources": p["evidence_count"], "verified": p["verified"]}
                       for p in sorted(prof.values(), key=lambda p: -p["confidence"])],
            "hidden": evidence.hidden(prof, st.get("profile_text"))}


@tool("get_target", "roadmap",
      "The student's target role and region, and what the role requires (skill, core or plus, weight).")
def get_target(ctx: Ctx) -> Dict[str, Any]:
    st = store.student(ctx.user_id)
    role = catalog.role(st["target_role"]) if st.get("target_role") else None
    if not role:
        raise ToolRefused("the student has not chosen a target role yet")
    return {"role": role["id"], "name": role["name"], "region": st.get("region"),
            "requires": role["requires"]}


@tool("job_demand", "roadmap",
      "How many of the sample job posts for a role and region ask for each skill, and in which "
      "words. Defaults to the student's target.",
      {"role_id": {"type": "string"}, "region": {"type": "string"}})
def job_demand(ctx: Ctx, role_id: Optional[str] = None, region: Optional[str] = None) -> Dict[str, Any]:
    st = store.student(ctx.user_id)
    rid = role_id or st.get("target_role")
    if not rid or not catalog.role(rid):
        raise ToolRefused("give a known role_id, or let the student choose a target")
    d = gap.demand(rid, region or st.get("region"))
    return {"role": rid, "posts": len(catalog.posts(rid, region or st.get("region"))),
            "note": "illustrative sample posts, not real listings",
            "demand": {k: {"posts": v["posts"], "terms": v["terms"]} for k, v in d.items()}}


@tool("compute_gap", "roadmap",
      "Compute the gap map for the student's target from their current evidence and save it: "
      "match percentage, each requirement mastered/partial/missing, radar per category.",
      writes=True, mcp=True)
def compute_gap(ctx: Ctx) -> Dict[str, Any]:
    st = store.student(ctx.user_id)
    if not st.get("target_role"):
        raise ToolRefused("the student has not chosen a target role yet")
    prof = profile_of(ctx.user_id)
    g = gap.compute(prof, st["target_role"], st.get("region"))
    store.save_output(ctx.user_id, "gap", g, ctx.run_id)
    store.save_baseline_once(ctx.user_id, {"match": g["match"], "counts": g["counts"],
                                           "role": g["role"]["id"], "radar": g["radar"]}, ctx.run_id)
    ctx.saved.add("gap")
    return {"role": g["role"]["name"], "match": g["match"], "counts": g["counts"],
            "radar": g["radar"],
            "missing": [s["name"] for s in g["skills"] if s["status"] == "missing"],
            "partial": [s["name"] for s in g["skills"] if s["status"] == "partial"]}


@tool("build_roadmap", "roadmap",
      "Order everything not yet mastered by prerequisite, pull in unmet prerequisites, and save "
      "it. Needs compute_gap first.", writes=True)
def build_roadmap(ctx: Ctx) -> Dict[str, Any]:
    g = store.output(ctx.user_id, "gap")
    if not g or "gap" not in ctx.saved:
        raise ToolRefused("call compute_gap first, so the roadmap is built from today's evidence")
    rm = roadmap.build(g["payload"], profile_of(ctx.user_id))
    store.save_output(ctx.user_id, "roadmap", rm, ctx.run_id)
    ctx.saved.add("roadmap")
    return {"done": [d["name"] for d in rm["done"]], "total_hours": rm["total_hours"],
            "steps": [{"step": s["step"], "name": s["name"], "hours": s["hours"], "why": s["why"]}
                      for s in rm["steps"]]}


@tool("explain_gap", "roadmap",
      "Save a short, kind explanation of the gap for the student (at most three sentences). "
      "Mention only skills that are in the gap map.",
      {"text": {"type": "string"}}, ["text"], writes=True)
def explain_gap(ctx: Ctx, text: str) -> Dict[str, Any]:
    g = store.output(ctx.user_id, "gap")
    if not g or "gap" not in ctx.saved:
        raise ToolRefused("call compute_gap first")
    text = text.strip()
    if not text or len(text) > 600:
        raise ToolRefused("the explanation must be 1 to 600 characters")
    in_map = {s["skill_id"] for s in g["payload"]["skills"]} | set(profile_of(ctx.user_id))
    named = {r["skill_id"] for r in evidence.match(text, "other", "explanation")}
    stray = named - in_map
    if stray:
        raise ToolRefused(f"mentions {', '.join(catalog.skill(s)['name'] for s in sorted(stray))}, "
                          "which is neither required nor proven; remove it")
    payload = dict(g["payload"], explanation=text)
    store.save_output(ctx.user_id, "gap", payload, ctx.run_id)
    return {"saved": True}
