"use client";

import { ArrowLeft, Check, ChevronDown, ChevronRight, Cpu, ExternalLink, Loader2, Plus, Server, Settings2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Dot } from "@/components/dort";
import { Button } from "@/components/ui/button";
import { ControlRow, Switch } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  addModel, call, removeModel, sameModel, selectModel, useAIConfig, useSavedModels, type AIConfig, type SavedModel,
} from "@/lib/ai-config";
import { useServerAI } from "@/lib/server-ai";
import { cn } from "@/lib/utils";

/* Pick the model the agents use, or add one, without leaving the chat.
 * Connections live in this browser only; the key goes with each request and is never stored on the server. */

type Provider = {
  id: string; label: string; short: string; models: string[]; keyHint?: string; keyUrl?: string;
  local?: boolean; tools: boolean; base?: string; note?: string;
};

export const PROVIDERS: Provider[] = [
  { id: "openai", label: "OpenAI", short: "OA", models: ["gpt-4o-mini", "gpt-4.1-mini", "gpt-4.1"], keyHint: "sk-…", keyUrl: "https://platform.openai.com/api-keys", tools: true },
  { id: "anthropic", label: "Anthropic", short: "A", models: ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"], keyHint: "sk-ant-…", keyUrl: "https://console.anthropic.com/settings/keys", tools: true },
  { id: "gemini", label: "Google Gemini", short: "G", models: ["gemini-2.5-flash", "gemini-2.5-pro"], keyHint: "AIza…", keyUrl: "https://aistudio.google.com/apikey", tools: true },
  { id: "openrouter", label: "OpenRouter", short: "OR", models: ["openai/gpt-4o-mini", "deepseek/deepseek-chat", "qwen/qwen3-235b-a22b"], keyHint: "sk-or-…", keyUrl: "https://openrouter.ai/keys", tools: true, note: "Hundreds of models behind one key." },
  { id: "bedrock", label: "Amazon Bedrock", short: "AWS", models: ["deepseek.v3.2", "qwen.qwen3-235b-a22b-2507", "openai.gpt-oss-120b", "zai.glm-4.7", "moonshotai.kimi-k2.5"], keyHint: "Bedrock API key", tools: true, base: "https://bedrock-mantle.ap-southeast-2.api.aws/v1", note: "Use a Bedrock API key; change the region in the URL if needed." },
  { id: "ollama", label: "Ollama", short: "OL", models: ["llama3.1", "qwen2.5", "mistral"], local: true, tools: false, note: "Runs on your machine. Works when LEARIS runs locally too." },
  { id: "lmstudio", label: "LM Studio", short: "LM", models: ["local-model"], local: true, tools: false, note: "Runs on your machine. Works when LEARIS runs locally too." },
  { id: "custom", label: "Custom", short: "</>", models: [], keyHint: "API key (if any)", tools: false, note: "Any OpenAI-compatible /v1 endpoint." },
];

const providerOf = (id: string) => PROVIDERS.find((p) => p.id === id);

function ProviderMark({ id, className }: { id: string; className?: string }) {
  const p = providerOf(id);
  return (
    <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md bg-[#111] font-mono text-[9.5px] font-medium text-white", className)}>
      {p?.short ?? "AI"}
    </span>
  );
}

/** The chip under a composer: shows the model in use; opens the list and "Add a model".
 * Without `onSelect` it sets the default for every chat. With it (a Studio panel) it picks for that
 * panel only: `value` is undefined (follow the default), "server", or a saved model's id. */
export function ModelPicker({ className, align = "start", value, onSelect, compact }: {
  className?: string; align?: "start" | "end";
  value?: string; onSelect?: (v: string | undefined) => void; compact?: boolean;
}) {
  const active = useAIConfig();
  const saved = useSavedModels();
  const server = useServerAI();
  const [adding, setAdding] = useState(false);
  const local = !!onSelect;
  const pinned = local && value ? (value === "server" ? "server" : saved.find((m) => m.id === value) ?? null) : null;
  // What this chip is using right now.
  const using: AIConfig | "server" | null = pinned ?? (active ?? (server ? "server" : null));
  const none = using === null && server === null;
  const label = using === "server" ? server?.model ?? "workspace model" : using ? using.model : server === undefined ? "…" : "No model";
  const sub = using === "server" ? "workspace" : using ? (providerOf(using.provider)?.label ?? using.provider).replace(/^(Amazon|Google) /, "") : "";
  const isOn = (v: string | undefined) => (local ? value === v : v === "server" ? !active : false);
  const choose = (v: string | undefined, m?: AIConfig | null) => (local ? onSelect!(v) : selectModel(m ?? null));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" title={local && !value ? "Follows the default model" : undefined}
            className={cn("hover:bg-hover flex h-7 max-w-[22rem] min-w-0 items-center gap-1.5 rounded-full border bg-white px-2.5 text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.2)]",
              compact && "h-6 px-2 text-[11.5px]", className)}>
            <Dot tone={none ? "warn" : "ok"} />
            <span className="truncate font-mono">{label}</span>
            {sub && !compact && <span className="text-muted-foreground hidden truncate sm:inline">· {sub}</span>}
            {local && !value && <span className="text-muted-foreground shrink-0">· default</span>}
            <ChevronDown className="text-muted-foreground size-3.5 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-80">
          <DropdownMenuLabel className="text-muted-foreground text-[11px] font-normal">
            {local ? "Model for this panel" : "Default model for your agents"}
          </DropdownMenuLabel>
          {local && (
            <DropdownMenuItem onSelect={() => onSelect!(undefined)} className="gap-2.5">
              <span className="bg-raised flex size-7 shrink-0 items-center justify-center rounded-md"><Settings2 className="size-3.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px]">Same as default</span>
                <span className="text-muted-foreground block truncate font-mono text-[11px]">{active?.model ?? server?.model ?? "none"}</span>
              </span>
              {!value && <Check className="size-4" />}
            </DropdownMenuItem>
          )}
          {server && (
            <DropdownMenuItem onSelect={() => choose("server", null)} className="gap-2.5">
              <span className="bg-raised flex size-7 shrink-0 items-center justify-center rounded-md"><Server className="size-3.5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-mono text-[12.5px]">{server.model}</span>
                <span className="text-muted-foreground block text-[11px]">Workspace model · no key needed</span>
              </span>
              {isOn("server") && <Check className="size-4" />}
            </DropdownMenuItem>
          )}
          {saved.map((m) => {
            const on = local ? value === m.id : sameModel(m, active);
            return (
              <DropdownMenuItem key={m.id} onSelect={() => choose(m.id, m)} className="group gap-2.5">
                <ProviderMark id={m.provider} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[12.5px]">{m.model}</span>
                  <span className="text-muted-foreground block text-[11px]">{providerOf(m.provider)?.label ?? m.provider} · your key</span>
                </span>
                {on ? <Check className="size-4" /> : (
                  <span role="button" tabIndex={-1} aria-label={`Remove ${m.model}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeModel(m); }}
                    className="text-muted-foreground hover:text-bad rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 group-data-[highlighted]:opacity-100">
                    <Trash2 className="size-3.5" />
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
          {!server && saved.length === 0 && (
            <p className="text-muted-foreground px-2.5 py-2 text-[12px]">No model yet. Add one to let the agents think.</p>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAdding(true)} className="gap-2.5 font-medium">
            <span className="flex size-7 items-center justify-center rounded-md border border-dashed"><Plus className="size-3.5" /></span>
            Add a model…
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="text-muted-foreground gap-2.5 text-[12px]">
            <Link href="/settings"><Settings2 className="ml-1.5 size-3.5" /> Per-agent models and privacy</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AddModelDialog open={adding} onOpenChange={setAdding} activate={!local} onAdded={local ? (m) => onSelect!(m.id) : undefined} />
    </>
  );
}

/** The AI settings a request from a Studio panel should carry: undefined means "the default". */
export function panelConfig(value: string | undefined, saved: SavedModel[]): { ai?: boolean; ai_config?: AIConfig | null } {
  if (!value) return { ai: true };
  if (value === "server") return {};
  const m = saved.find((x) => x.id === value);
  if (!m) return { ai: true };
  const { id: _i, name: _n, ...cfg } = m;
  void _i; void _n;
  return { ai_config: cfg };
}

/** Two steps: pick a provider, then paste a key and pick a model. Tested before it is saved. */
export function AddModelDialog({ open, onOpenChange, activate = true, onAdded }: {
  open: boolean; onOpenChange: (v: boolean) => void; activate?: boolean; onAdded?: (m: SavedModel) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card-grad max-w-xl rounded-2xl p-0 shadow-float">
        {open && <AddModel activate={activate} onDone={(m) => { onOpenChange(false); if (m) onAdded?.(m); }} />}
      </DialogContent>
    </Dialog>
  );
}

function AddModel({ onDone, activate }: { onDone: (m?: SavedModel) => void; activate: boolean }) {
  const [p, setP] = useState<Provider | null>(null);
  const [key, setKey] = useState("");
  const [model, setModel] = useState("");
  const [base, setBase] = useState("");
  const [tools, setTools] = useState(true);
  const [more, setMore] = useState(false);
  const [state, setState] = useState<{ busy?: boolean; ok?: boolean; text?: string }>({});

  function pick(x: Provider) {
    setP(x); setModel(x.models[0] ?? ""); setBase(x.base ?? ""); setTools(x.tools); setKey(""); setState({});
    setMore(x.id === "custom");
  }

  const cfg: AIConfig | null = p ? { provider: p.id, base_url: base.trim(), model: model.trim(), api_key: key.trim(), tools } : null;
  const ready = !!cfg && !!cfg.model && (p?.local || p?.id === "custom" || !!cfg.api_key) && (p?.id !== "custom" || !!cfg.base_url);

  async function connect(saveAnyway = false) {
    if (!cfg) return;
    if (saveAnyway) { onDone(addModel(cfg, undefined, activate)); return; }
    setState({ busy: true, text: "Asking the model to say hello…" });
    try {
      const r = await call<{ ok: boolean; error?: string; reply?: string; ms?: number }>("ai/test", {}, { ai_config: cfg });
      if (!r.ok) { setState({ ok: false, text: r.error ?? "the model did not answer" }); return; }
      setState({ ok: true, text: `Answered in ${r.ms} ms` });
      const m = addModel(cfg, undefined, activate);
      setTimeout(() => onDone(m), 500);
    } catch (e) {
      setState({ ok: false, text: e instanceof Error ? e.message : "could not reach the model" });
    }
  }

  if (!p) {
    return (
      <>
        <DialogHeader className="border-b">
          <DialogTitle className="flex items-center gap-2"><Cpu className="size-4" /> Add a model</DialogTitle>
          <DialogDescription className="text-[12.5px]">Pick a provider. Your key stays in this browser and goes only with your own requests.</DialogDescription>
        </DialogHeader>
        <ul className="grid gap-2 p-5 sm:grid-cols-2">
          {PROVIDERS.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => pick(x)}
                className="group flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left shadow-soft transition-colors hover:border-[rgba(0,0,0,0.35)]">
                <ProviderMark id={x.id} className="size-9 text-[10.5px]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-medium">{x.label}</span>
                  <span className="text-muted-foreground block truncate text-[11.5px]">
                    {x.local ? "local · no key" : x.models[0] ?? "any OpenAI-compatible"}{x.tools ? " · tools" : ""}
                  </span>
                </span>
                <ChevronRight className="text-muted-foreground size-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ready && !state.busy) void connect(); }}>
      <DialogHeader className="border-b">
        <DialogTitle className="flex items-center gap-2.5">
          <button type="button" onClick={() => setP(null)} className="hover:bg-hover -ml-1 rounded-md p-1" aria-label="Back to providers"><ArrowLeft className="size-4" /></button>
          <ProviderMark id={p.id} /> {p.label}
        </DialogTitle>
        {p.note && <DialogDescription className="text-[12.5px]">{p.note}</DialogDescription>}
      </DialogHeader>

      <div className="space-y-4 p-5">
        {!p.local && (
          <label className="block space-y-1.5">
            <span className="flex items-center justify-between text-[12.5px]">
              <span className="text-text">API key</span>
              {p.keyUrl && <a href={p.keyUrl} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-fg flex items-center gap-1 text-[11.5px]">Get a key <ExternalLink className="size-3" /></a>}
            </span>
            <Input autoFocus type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={p.keyHint} />
          </label>
        )}

        <div className="space-y-1.5">
          <span className="text-text text-[12.5px]">Model</span>
          {p.models.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {p.models.map((m) => (
                <button key={m} type="button" onClick={() => setModel(m)}
                  className={cn("h-7 rounded-full border px-2.5 font-mono text-[11.5px] transition-colors",
                    model === m ? "border-brand bg-brand text-white" : "bg-white hover:border-[rgba(0,0,0,0.35)]")}>
                  {m}
                </button>
              ))}
            </div>
          )}
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="or type any model id" className="font-mono text-[13px]" />
        </div>

        <button type="button" onClick={() => setMore(!more)} className="text-muted-foreground hover:text-fg flex items-center gap-1 text-[12px]">
          <ChevronRight className={cn("size-3.5 transition-transform", more && "rotate-90")} /> Advanced
        </button>
        {more && (
          <div className="bg-inner-grad space-y-3 rounded-xl border p-3">
            <label className="block space-y-1.5">
              <span className="text-text text-[12.5px]">Base URL {p.id !== "custom" && <span className="text-muted-foreground">(optional)</span>}</span>
              <Input value={base} onChange={(e) => setBase(e.target.value)} placeholder={p.base ?? "https://…/v1"} className="font-mono text-[12.5px]" />
            </label>
            <ControlRow control={<Switch checked={tools} onCheckedChange={setTools} />} label="Agents choose their own tools"
              hint="Needs a model with function calling. Off: the agents follow fixed steps." />
          </div>
        )}

        {state.text && (
          <p className={cn("flex items-start gap-2 text-[12.5px]", state.busy ? "text-muted-foreground" : state.ok ? "text-ok" : "text-bad")}>
            {state.busy ? <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin" /> : <Dot tone={state.ok ? "ok" : "bad"} className="mt-1.5" />}
            <span className="min-w-0 break-words">{state.text}</span>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t px-5 py-3.5">
        <p className="text-muted-foreground text-[11.5px]">Tested with one short message before it is saved.</p>
        <div className="flex gap-2">
          {state.ok === false && <Button type="button" variant="ghost" onClick={() => connect(true)}>Save anyway</Button>}
          <Button type="submit" disabled={!ready || state.busy}>
            {state.busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />} Connect
          </Button>
        </div>
      </div>
    </form>
  );
}
