"""The tool registry: every tool an agent may call, with its schema.

A tool is one capability with a JSON schema for its arguments, belonging to
one agent. The agent's model sees only its own tools; a call to anyone else's
is refused. Arguments are validated against the schema before the tool runs,
and a tool that raises returns its error to the model as data, so the model
can correct itself instead of the run crashing.

Tools that write (save evidence, save a profile) do their own checking: a
model cannot save a quote that is not in the document, or a profile that
claims a skill nothing proves. The tool refuses and says why.

The same registry backs the MCP server (mcp.py), where the tools marked
`mcp=True` are offered to a student's own agent.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Set

from core import ai


@dataclass
class Ctx:
    """Who a tool call is for, and what this run has done so far."""
    user_id: str
    run_id: Optional[str] = None
    agent: str = ""
    cfg: Optional[ai.Config] = None
    saved: Set[str] = field(default_factory=set)       # outputs written this run
    notes: Dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class Tool:
    name: str
    agent: str
    description: str
    params: Dict[str, Any]
    fn: Callable[..., Any]
    writes: bool = False
    mcp: bool = False

    def spec(self) -> Dict[str, Any]:
        """The OpenAI function-calling shape."""
        return {"type": "function", "function": {
            "name": self.name, "description": self.description, "parameters": self.params}}


_TOOLS: Dict[str, Tool] = {}


def tool(name: str, agent: str, description: str, properties: Optional[Dict[str, Any]] = None,
         required: Optional[List[str]] = None, writes: bool = False, mcp: bool = False):
    params = {"type": "object", "properties": properties or {}, "required": required or []}

    def wrap(fn: Callable[..., Any]) -> Callable[..., Any]:
        if name in _TOOLS:
            raise ValueError(f"tool '{name}' registered twice")
        _TOOLS[name] = Tool(name, agent, description, params, fn, writes, mcp)
        return fn
    return wrap


def all_tools() -> Dict[str, Tool]:
    _load()
    return dict(_TOOLS)


def tools_for(agent: str) -> List[Tool]:
    return [t for t in all_tools().values() if t.agent == agent]


def get(name: str) -> Optional[Tool]:
    return all_tools().get(name)


def _load() -> None:
    import tools  # noqa: F401  (registers every tool)


class ToolRefused(Exception):
    """Raised by a tool to refuse with a reason the model should read."""


MAX_RESULT = 6000


def run(name: str, args: Dict[str, Any], ctx: Ctx, agent: Optional[str] = None) -> Dict[str, Any]:
    """Run one tool. Always returns a JSON-able dict; never raises for the
    model's mistakes. `agent`, when given, restricts the call to that agent's
    own tools."""
    t = get(name)
    if t is None:
        return {"error": f"unknown tool '{name}'"}
    if agent and t.agent != agent:
        return {"error": f"'{name}' belongs to the {t.agent} agent, not to you"}
    problems = ai.validate(args, t.params)
    extra = set(args) - set(t.params["properties"])
    if extra:
        problems.append(f"unknown argument(s): {', '.join(sorted(extra))}")
    if problems:
        return {"error": "; ".join(problems[:5])}
    try:
        out = t.fn(ctx, **args)
    except ToolRefused as e:
        return {"error": str(e)}
    except Exception as e:                                           # noqa: BLE001
        return {"error": f"{type(e).__name__}: {e}"}
    return out if isinstance(out, dict) else {"result": out}


def shown(result: Dict[str, Any]) -> str:
    """A result as the model sees it: JSON, cut to a size a context can hold."""
    text = json.dumps(result, ensure_ascii=False, default=str)
    if len(text) > MAX_RESULT:
        text = text[:MAX_RESULT] + f'… [cut: {len(text) - MAX_RESULT} more characters]'
    return text


def demo() -> None:
    tools = all_tools()
    assert tools, "no tools registered"
    for t in tools.values():
        assert t.agent in ("evidence", "roadmap", "planner", "profile"), t.name
        assert t.description and t.params["type"] == "object"
        assert set(t.params["required"]) <= set(t.params["properties"]), t.name
    ctx = Ctx("usr_registry_check")
    assert "unknown tool" in run("launch_rocket", {}, ctx)["error"]
    some = next(t for t in tools.values() if t.agent == "planner")
    assert "belongs to the planner agent" in run(some.name, {}, ctx, agent="evidence")["error"]
    assert "unknown argument" in run("get_schedule", {"x": 1}, ctx)["error"]
    assert len(shown({"a": "x" * 10_000})) < MAX_RESULT + 80
    by = {}
    for t in tools.values():
        by.setdefault(t.agent, []).append(t.name)
    print("registry ok: " + " · ".join(f"{a} {len(n)}" for a, n in sorted(by.items()))
          + f" · {sum(t.mcp for t in tools.values())} offered over MCP")


if __name__ == "__main__":
    from core.config import fixtures_only
    fixtures_only(__file__, "LEARIS_REGISTRY_CHECK")
    # Run as the imported module, not as __main__: the tools register into
    # core.registry, and a second copy of this file would hold no tools.
    from core import registry
    registry.demo()
