"use client";

import { ArrowUp, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Artifact, AskRun, RunStep } from "@/app/lib";
import { AgentBadge } from "@/components/agent-card";
import { AgentPanel } from "@/components/agent-panel";
import { ArtifactLinks } from "@/components/ask";
import { Dot } from "@/components/dort";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ModelPicker, panelConfig } from "@/components/model-picker";
import { AttachButton, AttachChips, SentFiles, dropProps, splitAttached, useAttachments, withAttached } from "@/components/attach";
import { call, useSavedModels } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

export type StudioAgent = { id: string; name: string; description: string };
export type Turn = {
  request: string; runId?: string; status: "queued" | "running" | "done" | "failed";
  answer?: string | null; artifacts?: Artifact[]; error?: string | null;
};
/** `model`: undefined follows the default model, "server" the workspace model, else a saved model's id. */
export type PaneState = { id: string; agentId: string; turns: Turn[]; model?: string };

const endpointFor = (agentId: string) => (agentId === "orchestrator" ? "ask" : `workspace-agents/${agentId}/ask`);
const live = (t?: Turn) => t?.status === "queued" || t?.status === "running";

/** One chat with one agent. Earlier turns go with each new message, so the agent keeps the thread. */
export function Pane({ pane, agents, maximised, onChange, onClose, onMaximise }: {
  pane: PaneState; agents: StudioAgent[]; maximised: boolean;
  /** Functional, so a turn finishing in the background never overwrites a newer state. */
  onChange: (fn: (p: PaneState) => PaneState) => void; onClose: () => void; onMaximise: () => void;
}) {
  const agent = agents.find((a) => a.id === pane.agentId) ?? agents[0];
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<Record<string, RunStep[]>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const bottom = useRef<HTMLDivElement>(null);
  const last = pane.turns[pane.turns.length - 1];
  const saved = useSavedModels();
  const att = useAttachments();
  const [over, setOver] = useState(false);

  function patchTurn(runId: string, patch: Partial<Turn>) {
    onChange((p) => ({ ...p, turns: p.turns.map((t) => (t.runId === runId ? { ...t, ...patch } : t)) }));
  }

  // Follow the turn that is still working, including one left running before a reload.
  useEffect(() => {
    if (!last?.runId || !live(last)) return;
    let stop = false;
    const id = last.runId;
    const tick = async () => {
      try {
        const r = await call<AskRun>(`runs/${id}`);
        if (stop) return;
        setSteps((s) => ({ ...s, [id]: r.steps ?? [] }));
        if (r.status === "queued" || r.status === "running") {
          if (r.status !== last.status) patchTurn(id, { status: r.status });
          setTimeout(tick, 900);
        } else {
          patchTurn(id, { status: r.status, answer: r.answer, error: r.error,
            artifacts: (r.summary?.artifacts as Artifact[] | undefined) ?? [] });
        }
      } catch (e) {
        if (!stop) patchTurn(id, { status: "failed", error: e instanceof Error ? e.message : "lost the run" });
      }
    };
    void tick();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.runId]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [pane.turns.length, last?.status, steps]);

  async function send() {
    const typed = text.trim();
    if ((!typed && !att.items.some((a) => a.state === "ready")) || live(last) || att.busy) return;
    const request = withAttached(typed || "Read the attached file(s) and tell me what they cover.", att.items);
    setError("");
    const history = pane.turns.filter((t) => t.status === "done").flatMap((t) => [
      { role: "user", content: t.request }, { role: "assistant", content: t.answer ?? "" },
    ]);
    try {
      const { run_id } = await call<{ run_id: string }>(endpointFor(pane.agentId), { request, history }, panelConfig(pane.model, saved));
      onChange((p) => ({ ...p, turns: [...p.turns, { request, runId: run_id, status: "queued" }] }));
      setText("");
      att.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not send");
    }
  }

  async function toggleSteps(runId: string) {
    const show = !open[runId];
    setOpen((o) => ({ ...o, [runId]: show }));
    if (show && !steps[runId]) {
      const r = await call<AskRun>(`runs/${runId}`);
      setSteps((s) => ({ ...s, [runId]: r.steps ?? [] }));
    }
  }

  return (
    <section className={cn("bg-card-grad flex h-full min-h-[22rem] min-w-0 flex-col overflow-hidden rounded-lg border shadow-soft",
      live(last) && "glow-top")}>
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <Select value={pane.agentId} disabled={live(last)} ariaLabel="Agent for this panel" variant="ghost" size="sm"
            className="w-auto max-w-full font-medium" contentClassName="w-72"
            onValueChange={(agentId) => onChange((p) => ({ ...p, agentId }))}
            options={agents.map((a) => ({ value: a.id, label: a.name, hint: a.description,
              icon: <AgentBadge nickname={a.name} size="xs" showTooltip={false} /> }))}
            renderValue={(o) => <><AgentBadge nickname={agent?.name ?? "Agent"} size="sm" showTooltip={false} /><span className="truncate">{o?.label ?? agent?.name}</span></>} />
        </div>
        {live(last) && <Loader2 className="text-brand size-3.5 animate-spin" />}
        <Button variant="ghost" size="icon" className="size-7" onClick={onMaximise} aria-label={maximised ? "Restore" : "Maximise"}>
          {maximised ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={onClose} aria-label="Close panel"><X className="size-3.5" /></Button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {pane.turns.length === 0 && (
          <div className="text-muted-foreground py-6 text-center text-[12.5px] leading-relaxed">
            <p className="text-fg text-[13px]">{agent?.name}</p>
            <p className="mx-auto mt-1 max-w-xs">{agent?.description}</p>
          </div>
        )}
        {pane.turns.map((t, i) => (
          <div key={t.runId ?? i} className="space-y-2">
            <div className="bg-raised text-fg ml-auto w-fit max-w-[90%] rounded-lg px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap">{splitAttached(t.request).text}</div>
            <SentFiles files={splitAttached(t.request).files} className="ml-auto max-w-[90%]" />
            {live(t) && t.runId && (
              (steps[t.runId]?.length ?? 0) > 0
                ? <AgentPanel steps={steps[t.runId]} live />
                : <p className="text-muted-foreground flex items-center gap-2 text-[12.5px]"><Loader2 className="size-3.5 animate-spin" />{t.status === "queued" ? "Waiting for a worker…" : "Working…"}</p>
            )}
            {t.status === "done" && (
              <div className="bg-inner-grad rounded-lg border p-3">
                <div className="text-[13.5px] leading-relaxed"><Markdown>{t.answer || "Done."}</Markdown></div>
                <ArtifactLinks items={t.artifacts ?? []} />
                {t.runId && (
                  <button type="button" onClick={() => toggleSteps(t.runId!)} className="text-muted-foreground hover:text-fg mt-2 text-[11.5px]">
                    {open[t.runId] ? "Hide steps" : "Show what it did"}
                  </button>
                )}
                {t.runId && open[t.runId] && steps[t.runId] && <div className="mt-2"><AgentPanel steps={steps[t.runId]} /></div>}
              </div>
            )}
            {t.status === "failed" && <p className="text-bad flex items-center gap-2 text-[12.5px]"><Dot tone="bad" />{t.error ?? "failed"}</p>}
          </div>
        ))}
        <div ref={bottom} />
      </div>

      <form className="relative shrink-0 border-t p-2" onSubmit={(e) => { e.preventDefault(); void send(); }}
        {...dropProps((f) => void att.add(f), setOver)}
        onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); void att.add(e.clipboardData.files); } }}>
        {over && <div className="pointer-events-none absolute inset-2 z-10 flex items-center justify-center rounded-lg border border-dashed border-[#111] bg-white/95 text-[12.5px] font-medium">Drop to attach</div>}
        {error && <p className="text-bad mb-1.5 flex items-center gap-2 px-1 text-[12px]"><Dot tone="bad" />{error}</p>}
        <div className="bg-inner-grad rounded-lg border p-2 focus-within:border-[rgba(0,0,0,0.4)]">
          <AttachChips items={att.items} onRemove={att.remove} className="mb-1.5" />
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} disabled={live(last)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={live(last) ? "Working…" : `Message ${agent?.name ?? "the agent"}…`}
            className="text-fg placeholder:text-muted-foreground/80 block max-h-32 min-h-[1.5rem] w-full resize-none bg-transparent px-1 text-[13.5px] leading-relaxed outline-none" />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              <AttachButton small onFiles={(f) => void att.add(f)} disabled={live(last)} />
              <ModelPicker compact value={pane.model} onSelect={(model) => onChange((p) => ({ ...p, model }))} className="min-w-0" />
            </span>
            <Button type="submit" size="icon" className="size-7 shrink-0" aria-label="Send"
              disabled={live(last) || att.busy || (!text.trim() && !att.items.some((a) => a.state === "ready"))}>
              <ArrowUp className="size-3.5" />
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
