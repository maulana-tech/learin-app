"use client";

import { ArrowUp, FileText, ListChecks, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Artifact, AskRun } from "@/app/lib";
import { AgentBadge } from "@/components/agent-card";
import { AgentPanel } from "@/components/agent-panel";
import { Dot } from "@/components/dort";
import { Markdown } from "@/components/markdown";
import { SpeakButton, VoiceButton } from "@/components/voice";
import { Button } from "@/components/ui/button";
import { call, useAIConfig } from "@/lib/ai-config";
import { useServerAI } from "@/lib/server-ai";
import { ModelPicker } from "@/components/model-picker";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Ringkas tiap mata kuliah di Files, satu halaman per matkul, lalu buat jadwal belajar minggu ini",
  "Buat laporan praktikum dari file yang ada, dengan sumber di setiap klaim",
  "Pecah tugas kelompok ini jadi task dan bagi rata ke anggota grup",
  "Periksa semua halaman: mana klaim yang belum ada sumbernya?",
];

export function ArtifactLinks({ items }: { items: Artifact[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {items.map((a) => (
        <Link key={`${a.type}-${a.id}`} href={a.type === "page" ? `/pages/${a.id}` : "/tasks"}
          className="bg-raised text-text hover:bg-hover inline-flex h-7 max-w-full items-center gap-1.5 rounded-sm px-2 text-[12px]">
          {a.type === "page" ? <FileText className="size-3.5" /> : <ListChecks className="size-3.5" />}
          <span className="truncate">{a.title}</span>
        </Link>
      ))}
    </div>
  );
}

/** Ask the Orchestrator (or, with `endpoint`, one agent directly). The panel shows each agent working. */
export function Ask({ workspaceName, endpoint = "ask", examples = EXAMPLES, speaker = "Orchestrator", placeholder }: {
  workspaceName: string; endpoint?: string; examples?: string[]; speaker?: string; placeholder?: string;
}) {
  const router = useRouter();
  const cfg = useAIConfig();
  const server = useServerAI();
  const [text, setText] = useState("");
  const voiceBase = useRef<string | null>(null);
  const [run, setRun] = useState<AskRun | null>(null);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const busy = run?.status === "queued" || run?.status === "running";

  async function poll(id: string) {
    try {
      const r = await call<AskRun>(`runs/${id}`);
      setRun(r);
      if (r.status === "queued" || r.status === "running") timer.current = setTimeout(() => poll(id), 800);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "lost the run");
    }
  }

  async function send(request: string) {
    if (!request.trim() || busy) return;
    setError("");
    try {
      const { run_id } = await call<{ run_id: string }>(endpoint, { request }, { ai: true });
      setRun({ id: run_id, status: "queued", ai: null, started_at: "", finished_at: null, error: null, steps: [], request });
      setText("");
      poll(run_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not ask");
    }
  }

  const artifacts = (run?.summary?.artifacts as Artifact[] | undefined) ?? [];
  // The browser's own model wins; without one, the deployment's (e.g. Bedrock) is used.
  const noTools = cfg ? cfg.tools === false : !server;

  return (
    <div className="space-y-4">
      <form onSubmit={(e) => { e.preventDefault(); void send(text); }}
        className="bg-inner-grad focus-within:border-[rgba(0,0,0,0.45)] rounded-xl border p-3 shadow-soft">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} disabled={busy}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
          placeholder={placeholder ?? `Ask your agents anything about ${workspaceName}…`}
          className="text-fg placeholder:text-muted-foreground/80 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none" />
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <VoiceButton disabled={busy} onText={(spoken, done) => {
              if (voiceBase.current === null) voiceBase.current = text;
              setText([voiceBase.current, spoken].filter(Boolean).join(" "));
              if (done) voiceBase.current = null;
            }} />
            <ModelPicker />
            {noTools && <span className="text-warn hidden truncate text-[11.5px] sm:inline">{speaker} needs a model that can call tools</span>}
          </span>
          <Button type="submit" size="icon" disabled={busy || !text.trim()} aria-label="Ask">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </div>
      </form>

      {!run && (
        <div className="flex flex-wrap gap-2">
          {examples.map((x) => (
            <button key={x} type="button" onClick={() => setText(x)}
              className="bg-raised text-text hover:bg-hover rounded-md px-3 py-1.5 text-left text-[12.5px] leading-snug">
              {x}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}

      {run && (
        <div className="space-y-3">
          <div className="bg-raised text-fg ml-auto max-w-[85%] rounded-lg px-3.5 py-2.5 text-[14px] leading-relaxed">{run.request}</div>
          {(run.steps?.length ?? 0) > 0 && <AgentPanel steps={run.steps ?? []} live={busy} />}
          {run.status === "queued" && <p className="text-muted-foreground text-[13px]">Waiting for a worker…</p>}
          {run.answer && (
            <div className={cn("bg-card-grad rounded-lg border p-4 shadow-soft")}>
              <p className="text-muted-foreground mb-1 flex items-center gap-2 text-[12px]"><AgentBadge nickname={speaker} size="xs" showTooltip={false} />{speaker}</p>
              <div className="text-[14px] leading-relaxed"><Markdown>{run.answer}</Markdown></div>
              <SpeakButton text={run.answer ?? ""} className="mt-2" />
              <ArtifactLinks items={artifacts} />
            </div>
          )}
          {run.status === "failed" && <p className="text-bad text-[13px]">{run.error}</p>}
        </div>
      )}
    </div>
  );
}
