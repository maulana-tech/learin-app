"use client";

import { useState } from "react";

import type { Preset } from "@/app/lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { call, maskKey, saveAI, useAIConfig, type AIConfig } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

const field = "border-input w-full rounded-lg border bg-white px-3 py-2 text-[13.5px] text-fg outline-none placeholder:text-muted-foreground/80 hover:border-[rgba(0,0,0,0.28)] focus-visible:border-[rgba(0,0,0,0.55)] focus-visible:ring-3 focus-visible:ring-[rgba(0,0,0,0.08)]";
const AGENTS = [["evidence", "Skill Evidence"], ["roadmap", "Roadmap"], ["planner", "Planner"], ["profile", "Profile"]];

export function AISettings({ presets }: { presets: Record<string, Preset> }) {
  const saved = useAIConfig();
  // Remount the form when the saved settings load or change, so it starts from them.
  return <Form key={saved ? JSON.stringify(saved) : "none"} presets={presets} saved={saved} />;
}

function Form({ presets, saved }: { presets: Record<string, Preset>; saved: AIConfig | null }) {
  const [cfg, setCfg] = useState<AIConfig>(saved ?? { provider: "openai", base_url: "", model: "", api_key: "" });
  const [perAgent, setPerAgent] = useState(!!saved?.agent_models && Object.keys(saved.agent_models).length > 0);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const preset = presets[cfg.provider];
  const local = cfg.provider === "ollama" || cfg.provider === "lmstudio";
  const tools = cfg.tools ?? preset?.tools ?? false;
  const full: AIConfig = {
    ...cfg,
    tools,
    base_url: cfg.base_url || preset?.base_url || "",
    model: cfg.model || preset?.model || "",
    agent_models: perAgent ? cfg.agent_models : undefined,
  };

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await call<{ ok: boolean; error?: string; reply?: string; ms?: number; model?: string }>(
        "ai/test", {}, { ai_config: full });
      setMsg(r.ok ? { ok: true, text: `Connected: ${r.model} answered "${r.reply}" in ${r.ms} ms` }
        : { ok: false, text: r.error ?? "the model did not answer" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "test failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs">Provider</span>
          <select className={field} value={cfg.provider}
            onChange={(e) => setCfg({ ...cfg, provider: e.target.value, base_url: "", model: "" })}>
            {Object.entries(presets).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs">Model</span>
          <Input value={cfg.model} placeholder={preset?.model || "model name"}
            onChange={(e) => setCfg({ ...cfg, model: e.target.value })} />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className="text-muted-foreground text-xs">Base URL (OpenAI-compatible)</span>
          <Input value={cfg.base_url} placeholder={preset?.base_url || "https://…/v1"}
            onChange={(e) => setCfg({ ...cfg, base_url: e.target.value })} />
        </label>
        {!local && (
          <label className="space-y-1 sm:col-span-2">
            <span className="text-muted-foreground text-xs">API key</span>
            <Input type="password" autoComplete="off" value={cfg.api_key} placeholder="sk-…"
              onChange={(e) => setCfg({ ...cfg, api_key: e.target.value })} />
          </label>
        )}
      </div>
      {local && (
        <p className="text-muted-foreground text-xs">
          A local model is reached from the agent service, so it works when LEARIS runs on your own machine.
        </p>
      )}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={tools} onChange={(e) => setCfg({ ...cfg, tools: e.target.checked })} />
        <span>
          Agents choose their own tools (function calling)
          <span className="text-muted-foreground block text-xs">
            Each agent picks from its own tools and every call shows in the agent panel. Tools still
            refuse anything unproven. Off: the agents follow fixed steps, which suits small local models.
          </span>
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={perAgent} onChange={(e) => setPerAgent(e.target.checked)} />
        A different model per agent (cheap for reading, strong for writing)
      </label>
      {perAgent && (
        <div className="grid gap-2 sm:grid-cols-2">
          {AGENTS.map(([code, name]) => (
            <label key={code} className="space-y-1">
              <span className="text-muted-foreground text-xs">{name}</span>
              <Input value={cfg.agent_models?.[code] ?? ""} placeholder={full.model}
                onChange={(e) => setCfg({ ...cfg, agent_models: { ...cfg.agent_models, [code]: e.target.value } })} />
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={test} disabled={busy || !full.base_url || !full.model}>
          {busy ? "Testing…" : "Test connection"}
        </Button>
        <Button onClick={() => saveAI(full)}
          disabled={!full.base_url || !full.model}>Save</Button>
        {saved && (
          <Button variant="ghost" onClick={() => saveAI(null)}>
            Disconnect
          </Button>
        )}
      </div>
      {msg && <p className={cn("text-sm", msg.ok ? "text-ok" : "text-destructive")}>{msg.text}</p>}
      <p className="text-muted-foreground text-xs">
        {saved ? <>Connected: <span className="font-mono">{saved.model}</span> · key {maskKey(saved.api_key)}</> : "Not connected."}{" "}
        Your key stays in this browser. It is sent with each request that needs it and never stored on our server or written to a log.
      </p>
    </div>
  );
}
