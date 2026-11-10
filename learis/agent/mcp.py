"""LEARIS as an MCP server: the student's own agent can call it.

JSON-RPC 2.0 over POST /mcp (no SSE: a client discovers and calls; nothing
needs pushing). Authenticated like every other route, with the student's
session token, so a tool only ever sees that student's record.

Tools offered:

    extract_skills   text in, skills with quotes and confidence out; saves nothing
    list_documents   the student's evidence
    get_skill_profile every proven skill, with confidence
    refresh_gap      recompute gap map and roadmap from today's evidence
    get_gap_map      the saved gap map
    get_roadmap      the saved roadmap
    build_plan       replan the four weeks, optionally with new free hours or exam weeks
    get_plan         the saved plan

Every result is the same data the app shows, origin included: a skill comes
with the quote that proves it, and a number comes from the engine, not a model.
"""
from __future__ import annotations

import json
from typing import Any, Callable, Dict, List, Optional, Tuple

from core import registry, store
from core.registry import Ctx
from engine import evidence

PROTOCOL = "2025-06-18"


def _extract(ctx: Ctx, text: str, kind: str = "other") -> Dict[str, Any]:
    if kind not in store.DOC_KINDS:
        return {"error": f"kind must be one of {', '.join(store.DOC_KINDS)}"}
    rows = evidence.match(text[:200_000], kind, "mcp")
    return {"skills": [{"skill_id": r["skill_id"], "quote": r["quote"], "confidence": r["confidence"]}
                       for r in rows],
            "note": "matched by the taxonomy's rules; nothing was saved"}


def _saved(kind: str) -> Callable[[Ctx], Dict[str, Any]]:
    def get(ctx: Ctx) -> Dict[str, Any]:
        o = store.output(ctx.user_id, kind)
        return o["payload"] if o else {"error": f"no {kind} yet: run the analysis in LEARIS first"}
    return get


def _refresh(ctx: Ctx) -> Dict[str, Any]:
    g = registry.run("compute_gap", {}, ctx)
    if "error" in g:
        return g
    rm = registry.run("build_roadmap", {}, ctx)
    return {**g, "roadmap_steps": len(rm.get("steps", [])), "roadmap_hours": rm.get("total_hours")}


def _plan(ctx: Ctx, hours_per_week: Optional[float] = None,
          exam_weeks: Optional[List[int]] = None) -> Dict[str, Any]:
    fields: Dict[str, Any] = {}
    if hours_per_week is not None:
        if not 1 <= float(hours_per_week) <= 60:
            return {"error": "hours_per_week must be between 1 and 60"}
        fields["hours_per_week"] = float(hours_per_week)
    if exam_weeks is not None:
        if any(not 1 <= int(w) <= 4 for w in exam_weeks):
            return {"error": "exam_weeks are week numbers 1 to 4"}
        fields["exam_weeks"] = sorted({int(w) for w in exam_weeks})
    if fields:
        store.update_student(ctx.user_id, **fields)
    return registry.run("build_plan", {}, ctx)


def _obj(props: Dict[str, Any] = None, required: List[str] = None) -> Dict[str, Any]:
    return {"type": "object", "properties": props or {}, "required": required or []}


TOOLS: Dict[str, Tuple[str, Dict[str, Any], Callable[..., Dict[str, Any]], bool]] = {
    "extract_skills": ("Find skills in a piece of text (a syllabus, README, CV), each with its quote "
                       "and confidence. Saves nothing.",
                       _obj({"text": {"type": "string"},
                             "kind": {"type": "string", "enum": list(store.DOC_KINDS)}}, ["text"]),
                       _extract, True),
    "list_documents": ("The student's evidence documents.", _obj(),
                       lambda ctx: registry.run("list_documents", {}, ctx), True),
    "get_skill_profile": ("Every skill the student's evidence proves, with confidence.", _obj(),
                          lambda ctx: registry.run("get_skill_profile", {}, ctx), True),
    "refresh_gap": ("Recompute the gap map and roadmap for the target role from current evidence.",
                    _obj(), _refresh, False),
    "get_gap_map": ("The saved gap map: match %, each requirement mastered/partial/missing.", _obj(),
                    _saved("gap"), True),
    "get_roadmap": ("The saved roadmap, ordered by prerequisite.", _obj(), _saved("roadmap"), True),
    "build_plan": ("Replan four weeks that fit the student's free hours and exam weeks.",
                   _obj({"hours_per_week": {"type": "number", "minimum": 1, "maximum": 60},
                         "exam_weeks": {"type": "array", "items": {"type": "integer", "minimum": 1,
                                                                    "maximum": 4}}}),
                   _plan, False),
    "get_plan": ("The saved four-week plan.", _obj(), _saved("plan"), True),
}


def handle(body: Dict[str, Any], user_id: str) -> Optional[Dict[str, Any]]:
    """One JSON-RPC message. Returns the response, or None for a notification."""
    rid = body.get("id")
    method = body.get("method")
    params = body.get("params") or {}

    def ok(result: Any) -> Dict[str, Any]:
        return {"jsonrpc": "2.0", "id": rid, "result": result}

    def fail(code: int, message: str) -> Dict[str, Any]:
        return {"jsonrpc": "2.0", "id": rid, "error": {"code": code, "message": message}}

    if rid is None and str(method or "").startswith("notifications/"):
        return None
    if method == "initialize":
        return ok({"protocolVersion": PROTOCOL, "capabilities": {"tools": {"listChanged": False}},
                   "serverInfo": {"name": "learis-skill-gap-radar", "version": "1.0"},
                   "instructions": "Skill Gap Radar for one signed-in student. Skills always carry the "
                                   "quote that proves them; numbers come from the engine."})
    if method == "ping":
        return ok({})
    if method == "tools/list":
        return ok({"tools": [{"name": n, "description": d, "inputSchema": s,
                              "annotations": {"readOnlyHint": ro}}
                             for n, (d, s, _, ro) in TOOLS.items()]})
    if method == "tools/call":
        name = params.get("name") or ""
        if name not in TOOLS:
            return fail(-32602, f"unknown tool: {name}")
        _, schema, fn, _ = TOOLS[name]
        args = params.get("arguments") or {}
        from core import ai
        problems = ai.validate(args, schema)
        if problems:
            return fail(-32602, "; ".join(problems))
        out = fn(Ctx(user_id, agent="mcp"), **args)
        is_error = isinstance(out, dict) and "error" in out
        return ok({"content": [{"type": "text", "text": json.dumps(out, ensure_ascii=False, default=str)}],
                   "structuredContent": out, "isError": is_error})
    return fail(-32601, f"method not found: {method}")


def demo() -> None:
    uid = "usr_mcp_check"
    init = handle({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}}, uid)
    assert init["result"]["serverInfo"]["name"] == "learis-skill-gap-radar"
    assert handle({"jsonrpc": "2.0", "method": "notifications/initialized"}, uid) is None
    names = [t["name"] for t in handle({"jsonrpc": "2.0", "id": 2, "method": "tools/list"}, uid)["result"]["tools"]]
    assert {"extract_skills", "get_gap_map", "build_plan"} <= set(names), names

    def call(name: str, **args: Any) -> Dict[str, Any]:
        return handle({"jsonrpc": "2.0", "id": 3, "method": "tools/call",
                       "params": {"name": name, "arguments": args}}, uid)

    ex = call("extract_skills", text="Built a React app with a REST API and PostgreSQL.", kind="project")
    got = {s["skill_id"] for s in ex["result"]["structuredContent"]["skills"]}
    assert {"react", "rest-api", "sql"} <= got and store.documents(uid) == [], "extract saves nothing"
    assert call("get_gap_map")["result"]["isError"], "no gap yet is an error result, not a crash"
    assert "error" in call("nope") and "error" in call("extract_skills"), "unknown tool, missing argument"

    store.update_student(uid, target_role="junior-web-developer", region="id")
    d = store.add_document(uid, "project", "App", "Built a React app with a REST API and PostgreSQL. Uses Git.")
    store.add_evidence(uid, evidence.match("Built a React app with a REST API and PostgreSQL. Uses Git.",
                                           "project", d["id"]))
    r = call("refresh_gap")["result"]
    assert not r["isError"] and r["structuredContent"]["match"] > 0, r
    p = call("build_plan", hours_per_week=10, exam_weeks=[2])["result"]["structuredContent"]
    assert p["weeks"][1]["exam"] and p["planned_hours"] > 0, p
    assert store.student(uid)["hours_per_week"] == 10
    assert call("get_plan")["result"]["structuredContent"]["hours_per_week"] == 10
    print(f"mcp ok: {len(names)} tools · extract_skills saves nothing · refresh_gap + build_plan "
          "write the same outputs the app shows")


if __name__ == "__main__":
    from core.config import fixtures_only
    fixtures_only(__file__, "LEARIS_MCP_CHECK")
    demo()
