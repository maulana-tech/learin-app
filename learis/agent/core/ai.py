"""Bring Your Own AI: one small client for any OpenAI-compatible endpoint.

The student brings the model. OpenAI, Anthropic, Gemini and OpenRouter all
answer the OpenAI Chat Completions shape, and so do Ollama and LM Studio on a
laptop, so one adapter covers every provider and the rest of the code sees two
calls:

    generate(cfg, system, user)                 -> str
    generate_structured(cfg, system, user, schema) -> dict, validated

`generate_structured` asks for JSON, validates it against the schema, and
retries once with the validation error when the model gets it wrong. A small
model that cannot keep to a schema fails loudly instead of handing the agents
a half-shaped answer.

Keys: the key arrives with the request (the browser keeps it, see
app/lib/ai-config.ts) or from the server's own LEARIS_AI_* variables. It is
held in memory for the length of one call and never written to the database
or a log; every error message is scrubbed of it.
"""
from __future__ import annotations

import base64
import ipaddress
import json
import os
import re
import socket
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field, replace
from typing import Any, Dict, List, Optional

from core.config import CFG

#: Where each provider's OpenAI-compatible endpoint lives.
PRESETS: Dict[str, Dict[str, str]] = {
    "openai": {"label": "OpenAI", "base_url": "https://api.openai.com/v1", "model": "gpt-4o-mini"},
    "anthropic": {"label": "Anthropic", "base_url": "https://api.anthropic.com/v1",
                  "model": "claude-haiku-4-5"},
    "gemini": {"label": "Google Gemini",
               "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
               "model": "gemini-2.5-flash"},
    "openrouter": {"label": "OpenRouter", "base_url": "https://openrouter.ai/api/v1",
                   "model": "openai/gpt-4o-mini"},
    "bedrock": {"label": "Amazon Bedrock", "base_url": "https://bedrock-mantle.ap-southeast-2.api.aws/v1",
                "model": "deepseek.v3.2"},
    "ollama": {"label": "Ollama (local)", "base_url": "http://localhost:11434/v1", "model": "llama3.1"},
    "lmstudio": {"label": "LM Studio (local)", "base_url": "http://localhost:1234/v1", "model": "local-model"},
    "custom": {"label": "Custom (OpenAI-compatible)", "base_url": "", "model": ""},
}

#: Providers whose compatibility layer rejects `response_format`.
NO_JSON_MODE = {"anthropic"}

#: Providers whose OpenAI-compatible endpoint handles function calling well
#: enough to let an agent pick its own tools. A local or custom model may or may
#: not; the student can switch it on, and the agents fall back to their fixed
#: order when a model will not call tools properly.
TOOL_CAPABLE = {"openai", "anthropic", "gemini", "openrouter", "bedrock"}
for _k, _p in PRESETS.items():
    _p["tools"] = _k in TOOL_CAPABLE

TIMEOUT = int(os.environ.get("LEARIS_AI_TIMEOUT", "90"))


class AIError(RuntimeError):
    pass


@dataclass(frozen=True)
class Config:
    provider: str
    base_url: str
    model: str
    api_key: str = field(default="", repr=False)
    #: A different model per agent (P1): cheap for extraction, strong for planning.
    agent_models: Dict[str, str] = field(default_factory=dict)
    source: str = "browser"          # browser | server
    #: Let agents choose their own tools (function calling).
    tools: bool = False

    def for_agent(self, agent: str) -> "Config":
        m = (self.agent_models or {}).get(agent)
        return replace(self, model=m) if m else self

    @property
    def label(self) -> str:
        return f"{PRESETS.get(self.provider, {}).get('label', self.provider)} · {self.model}"


def from_dict(d: Dict[str, Any], source: str = "browser") -> Config:
    provider = str(d.get("provider") or "custom")
    if provider not in PRESETS:
        raise AIError(f"unknown provider '{provider}'")
    base = str(d.get("base_url") or PRESETS[provider]["base_url"]).strip().rstrip("/")
    model = str(d.get("model") or PRESETS[provider]["model"]).strip()
    if not base or not model:
        raise AIError("a base URL and a model are required")
    if not base.startswith(("http://", "https://")):
        raise AIError("the base URL must start with http:// or https://")
    agents = {str(k): str(v).strip() for k, v in (d.get("agent_models") or {}).items()
              if str(v).strip()}
    tools = d.get("tools")
    tools = provider in TOOL_CAPABLE if tools is None else bool(tools)
    return Config(provider, base, model, str(d.get("api_key") or "").strip(), agents, source, tools)


def from_header(raw: Optional[str]) -> Optional[Config]:
    """The `X-Learis-AI` header: base64 of the JSON the AI settings page keeps."""
    if not raw:
        return None
    try:
        return from_dict(json.loads(base64.b64decode(raw).decode("utf-8")))
    except AIError:
        raise
    except Exception as e:                                           # noqa: BLE001
        raise AIError(f"the AI settings sent with the request are unreadable ({type(e).__name__})")


def server_config() -> Optional[Config]:
    if not CFG.server_ai:
        return None
    provider = "bedrock" if "bedrock-mantle." in CFG.ai_base_url else "custom"
    return Config(provider, CFG.ai_base_url, CFG.ai_model, CFG.ai_api_key, {}, "server",
                  os.environ.get("LEARIS_AI_TOOLS", "1") == "1")


def resolve(header: Optional[str]) -> Optional[Config]:
    """The student's own model first, then the deployment's, else None (rules only)."""
    return from_header(header) or server_config()


# -------------------------------------------------------------------- safety
def _private_host(url: str) -> bool:
    host = urllib.parse.urlparse(url).hostname or ""
    try:
        infos = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False
    for info in infos:
        ip = ipaddress.ip_address(info[4][0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return True
    return False


def _guard(cfg: Config) -> None:
    """A base URL the student typed is a URL this server will call. In
    production it may not point inside the server's own network, or a
    'model endpoint' becomes a way to reach things behind the firewall. A local
    model (Ollama, LM Studio) works when the agent service runs on the
    student's own machine, which is what dev mode is."""
    allow = os.environ.get("LEARIS_ALLOW_LOCAL_AI", "0" if CFG.production else "1") == "1"
    if cfg.source == "browser" and not allow and _private_host(cfg.base_url):
        raise AIError("this server does not call private or local addresses; run LEARIS "
                      "locally to use a local model")


def _scrub(text: str, cfg: Config) -> str:
    if cfg.api_key:
        text = text.replace(cfg.api_key, "***")
    return re.sub(r"(sk|key|AIza)[-_A-Za-z0-9]{12,}", "***", text)


# ---------------------------------------------------------------------- calls
def _chat(cfg: Config, messages: List[dict], max_tokens: int, json_mode: bool,
          temperature: float, tools: Optional[List[dict]] = None) -> Dict[str, Any]:
    _guard(cfg)
    body: Dict[str, Any] = {"model": cfg.model, "messages": messages,
                            "max_tokens": max_tokens, "temperature": temperature}
    if json_mode and cfg.provider not in NO_JSON_MODE:
        body["response_format"] = {"type": "json_object"}
    if tools:
        body["tools"] = tools
        body["tool_choice"] = "auto"
    headers = {"Content-Type": "application/json", "User-Agent": "learis-agent"}
    if cfg.api_key:
        headers["Authorization"] = f"Bearer {cfg.api_key}"
    if cfg.provider == "openrouter":
        headers["X-Title"] = "LEARIS"
    req = urllib.request.Request(f"{cfg.base_url}/chat/completions",
                                 data=json.dumps(body).encode(), headers=headers, method="POST")
    # A long answer (a whole page as a tool call) takes minutes on some models: the wait grows with the
    # room the answer is given. One timed-out request is asked again once before giving up.
    wait = min(600, max(TIMEOUT, 60 + max_tokens // 25))
    try:
        try:
            with urllib.request.urlopen(req, timeout=wait) as r:
                data = json.loads(r.read().decode("utf-8"))
        except (TimeoutError, socket.timeout):
            with urllib.request.urlopen(req, timeout=wait) as r:
                data = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:400]
        if json_mode and e.code == 400 and "response_format" in detail and "response_format" in body:
            # Some compatible servers do not know JSON mode. Ask again without it.
            return _chat(replace(cfg, provider="anthropic"), messages, max_tokens, json_mode,
                         temperature)
        raise AIError(_scrub(f"{cfg.label}: HTTP {e.code}: {detail}", cfg)) from None
    except (urllib.error.URLError, TimeoutError, socket.timeout) as e:
        raise AIError(_scrub(f"{cfg.label}: cannot reach {cfg.base_url} ({e})", cfg)) from None
    except json.JSONDecodeError:
        raise AIError(f"{cfg.label}: the answer was not JSON") from None
    if not data.get("choices"):
        raise AIError(_scrub(f"{cfg.label}: no answer ({str(data)[:200]})", cfg))
    return data


def _text(data: Dict[str, Any]) -> str:
    msg = data["choices"][0].get("message") or {}
    content = msg.get("content") or ""
    if isinstance(content, list):          # some servers return content parts
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    # Reasoning models may wrap their thinking in <think> tags; it is not the answer.
    return re.sub(r"<think>[\s\S]*?</think>", "", content).strip()


def generate(cfg: Config, system: str, user: str, max_tokens: int = 1200,
             temperature: float = 0.3) -> str:
    data = _chat(cfg, [{"role": "system", "content": system},
                       {"role": "user", "content": user}], max_tokens, False, temperature)
    return _text(data)


def _parse_json(text: str) -> Any:
    t = text.strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", t)
    if fence:
        t = fence.group(1).strip()
    try:
        return json.loads(t)
    except json.JSONDecodeError:
        start, end = t.find("{"), t.rfind("}")
        if start >= 0 and end > start:
            return json.loads(t[start:end + 1])
        raise


def validate(value: Any, schema: Dict[str, Any], path: str = "$") -> List[str]:
    """The subset of JSON Schema the agents use. Returns every problem found."""
    problems: List[str] = []
    kind = schema.get("type")
    types = {"object": dict, "array": list, "string": str, "boolean": bool}
    if kind in types and not isinstance(value, types[kind]):
        return [f"{path} must be {kind}"]
    if kind in ("number", "integer"):
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return [f"{path} must be a number"]
        if kind == "integer" and not float(value).is_integer():
            return [f"{path} must be an integer"]
        if "minimum" in schema and value < schema["minimum"]:
            problems.append(f"{path} must be >= {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            problems.append(f"{path} must be <= {schema['maximum']}")
    if "enum" in schema and value not in schema["enum"]:
        problems.append(f"{path} must be one of {schema['enum']}")
    if kind == "object":
        for k in schema.get("required", []):
            if k not in value:
                problems.append(f"{path}.{k} is required")
        for k, sub in (schema.get("properties") or {}).items():
            if k in value:
                problems += validate(value[k], sub, f"{path}.{k}")
    if kind == "array":
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            problems.append(f"{path} has more than {schema['maxItems']} items")
        for i, item in enumerate(value):
            problems += validate(item, schema.get("items") or {}, f"{path}[{i}]")
    return problems


def generate_structured(cfg: Config, system: str, user: str, schema: Dict[str, Any],
                        max_tokens: int = 2000) -> Dict[str, Any]:
    """JSON that matches the schema, or AIError. One automatic retry."""
    instruction = ("\n\nAnswer with ONE JSON object and nothing else. It must match this "
                   f"JSON Schema:\n{json.dumps(schema)}")
    messages = [{"role": "system", "content": system + instruction},
                {"role": "user", "content": user}]
    last = ""
    for attempt in range(2):
        text = _text(_chat(cfg, messages, max_tokens, True, 0.1))
        try:
            value = _parse_json(text)
            problems = validate(value, schema)
        except (json.JSONDecodeError, ValueError) as e:
            problems = [f"not valid JSON ({e})"]
            value = None
        if not problems:
            return value
        last = "; ".join(problems[:6])
        if attempt == 0:
            messages += [{"role": "assistant", "content": text[:4000]},
                         {"role": "user", "content": f"That did not match the schema: {last}. "
                                                     "Send the corrected JSON object only."}]
    raise AIError(f"{cfg.label} did not return valid JSON after a retry: {last}")


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: Dict[str, Any]
    raw_arguments: str
    error: Optional[str] = None


@dataclass
class Turn:
    """One model turn in a tool loop: what it said, and the tools it asked for."""
    text: str
    calls: List[ToolCall]
    message: Dict[str, Any]          # the assistant message, to send back next round


#: Room for one tool turn. A page with its quoted sources travels as the call's arguments, so a
#: small limit cuts the call off half-written and it is lost (finish_reason "length").
TOOL_TOKENS = int(os.environ.get("LEARIS_AI_TOOL_TOKENS", "6000"))

#: Some models (DeepSeek) write their own call markup as text when a call is cut off.
_LEAKED_CALL = re.compile(r"\s*<[｜|]\s*(DSML|tool[▁_ ]calls?[▁_ ]begin|tool_call)[\s\S]*$", re.I)


def chat_with_tools(cfg: Config, messages: List[dict], tools: List[dict],
                    max_tokens: Optional[int] = None) -> Turn:
    """One round of function calling. `tools` are OpenAI-style function specs.

    Arguments a model sends as broken JSON are not guessed at: the call comes
    back with `error` set, and the loop tells the model so. A turn cut off by the
    length limit before its call was complete is asked for once more with twice the room."""
    limit = max_tokens or TOOL_TOKENS
    data = _chat(cfg, messages, limit, False, 0.1, tools)
    choice = data["choices"][0]
    if choice.get("finish_reason") == "length" and not (choice.get("message") or {}).get("tool_calls"):
        data = _chat(cfg, messages, min(limit * 2, 16000), False, 0.1, tools)
        choice = data["choices"][0]
    msg = choice.get("message") or {}
    calls: List[ToolCall] = []
    for i, tc in enumerate(msg.get("tool_calls") or []):
        fn = tc.get("function") or {}
        raw = fn.get("arguments") or "{}"
        args: Dict[str, Any] = {}
        err = None
        if isinstance(raw, dict):
            args, raw = raw, json.dumps(raw)
        else:
            try:
                parsed = json.loads(raw or "{}")
                if isinstance(parsed, dict):
                    args = parsed
                else:
                    err = "arguments must be a JSON object"
            except json.JSONDecodeError as e:
                err = f"arguments are not valid JSON ({e})"
        calls.append(ToolCall(str(tc.get("id") or f"call_{i}"), str(fn.get("name") or ""),
                              args, raw, err))
    text = _LEAKED_CALL.sub("", _text(data) or "").strip()
    echo: Dict[str, Any] = {"role": "assistant", "content": text or None}
    if calls:
        echo["tool_calls"] = [{"id": c.id, "type": "function",
                               "function": {"name": c.name, "arguments": c.raw_arguments}}
                              for c in calls]
    return Turn(text, calls, echo)


def test(cfg: Config) -> Dict[str, Any]:
    """One real call, for the Test connection button."""
    started = time.time()
    text = generate(cfg, "You are a connection test.", "Reply with the single word: OK",
                    max_tokens=10, temperature=0)
    return {"ok": True, "model": cfg.model, "provider": cfg.provider, "reply": text[:40],
            "ms": round((time.time() - started) * 1000)}


def demo() -> None:
    schema = {"type": "object", "required": ["skills"], "properties": {
        "skills": {"type": "array", "items": {"type": "object", "required": ["id", "confidence"],
                   "properties": {"id": {"type": "string"},
                                  "confidence": {"type": "number", "minimum": 0, "maximum": 1}}}}}}
    assert validate({"skills": [{"id": "html", "confidence": 0.5}]}, schema) == []
    bad = validate({"skills": [{"id": 3, "confidence": 2}]}, schema)
    assert "$.skills[0].id must be string" in bad and "$.skills[0].confidence must be <= 1" in bad
    assert validate({}, schema) == ["$.skills is required"]
    assert _parse_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert _parse_json('Sure! {"a": 2} hope that helps') == {"a": 2}

    c = from_dict({"provider": "gemini", "api_key": "AIzaSyTESTKEY1234567890"})
    assert c.base_url.endswith("/openai") and c.model == "gemini-2.5-flash"
    assert "AIza" not in repr(c), "the key never appears in a repr"
    assert _scrub("bad key AIzaSyTESTKEY1234567890", c) == "bad key ***"
    per = from_dict({"provider": "openai", "model": "gpt-4o", "agent_models": {"evidence": "gpt-4o-mini"}})
    assert per.for_agent("evidence").model == "gpt-4o-mini" and per.for_agent("planner").model == "gpt-4o"
    raw = base64.b64encode(json.dumps({"provider": "ollama"}).encode()).decode()
    assert from_header(raw).base_url == "http://localhost:11434/v1"
    for wrong in ({"provider": "nope"}, {"provider": "custom"}, {"provider": "custom",
                  "base_url": "ftp://x", "model": "m"}):
        try:
            from_dict(wrong)
            raise AssertionError(f"{wrong} must be refused")
        except AIError:
            pass

    # Retry: a model that answers badly once and then correctly is accepted.
    answers = iter(['{"skills": "html"}', '{"skills": [{"id": "html", "confidence": 0.4}]}'])
    real = globals()["_chat"]
    globals()["_chat"] = lambda *a, **k: {"choices": [{"message": {"content": next(answers)}}]}
    try:
        got = generate_structured(c, "s", "u", schema)
        assert got["skills"][0]["id"] == "html"
        answers = iter(["nope", "still nope"])
        try:
            generate_structured(c, "s", "u", schema)
            raise AssertionError("two bad answers must fail")
        except AIError as e:
            assert "after a retry" in str(e)
    finally:
        globals()["_chat"] = real
    # Function calling: a turn with tool calls is parsed, broken arguments flagged.
    globals()["_chat"] = lambda *a, **k: {"choices": [{"message": {"content": "", "tool_calls": [
        {"id": "c1", "type": "function", "function": {"name": "compute_gap", "arguments": "{}"}},
        {"id": "c2", "type": "function", "function": {"name": "read_document", "arguments": "{bad"}}]}}]}
    try:
        t = chat_with_tools(c, [], [{"type": "function", "function": {"name": "compute_gap"}}])
        assert [x.name for x in t.calls] == ["compute_gap", "read_document"]
        assert t.calls[0].error is None and t.calls[1].error and "not valid JSON" in t.calls[1].error
        assert t.message["tool_calls"][0]["function"]["name"] == "compute_gap"
    finally:
        globals()["_chat"] = real
    assert from_dict({"provider": "openai"}).tools and not from_dict({"provider": "ollama"}).tools
    assert from_dict({"provider": "ollama", "tools": True}).tools, "a student may switch it on"
    print("ai ok: presets ✓ · schema validated ✓ · one retry ✓ · key never in repr or errors ✓ "
          "· function calling parsed ✓")


if __name__ == "__main__":
    demo()
