"use client";

import { ArrowRight, ArrowUp, ChevronDown, Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Artifact, AskRun, RunStep } from "@/app/lib";
import { AgentBadge } from "@/components/agent-card";
import { AgentPanel } from "@/components/agent-panel";
import { ArtifactLinks } from "@/components/ask";
import { Dot } from "@/components/dort";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { call, useAIConfig } from "@/lib/ai-config";
import { useServerAI } from "@/lib/server-ai";
import { ModelPicker } from "@/components/model-picker";
import { SpeakButton, VoiceButton } from "@/components/voice";
import { AttachButton, AttachChips, SentFiles, dropProps, splitAttached, useAttachments, withAttached } from "@/components/attach";
import { cn } from "@/lib/utils";

/* The Assistant, as a conversation (layout after AERA's chat).
 *
 * Nothing asked yet: the composer sits in the middle under the heading, with
 * examples. Once there is a transcript it drops to the bottom and stays. Each
 * reply shows the agents' work while it runs and folds it away when done.
 * Chats live on the server, so the thread continues on any device and the
 * Orchestrator sees the earlier turns. */

export type ChatTurn = {
  id: string; status: "queued" | "running" | "done" | "failed"; request: string | null;
  answer: string | null; error: string | null; started_at: string; finished_at: string | null;
  summary: { artifacts?: Artifact[] } | null;
};
export type ChatThread = { id: string; title: string | null; updated_at: string; turns: number };

const EXAMPLES = [
  "Ringkas tiap mata kuliah di Files, satu halaman per matkul, lalu buat jadwal belajar minggu ini",
  "Buat laporan praktikum dari file yang ada, dengan sumber di setiap klaim",
  "Pecah tugas kelompok ini jadi task dan bagi rata ke anggota grup",
  "Periksa semua halaman: mana klaim yang belum ada sumbernya?",
];

const live = (t?: ChatTurn) => t?.status === "queued" || t?.status === "running";
const secs = (t: ChatTurn) =>
  t.finished_at ? Math.max(1, Math.round((new Date(t.finished_at).getTime() - new Date(t.started_at).getTime()) / 1000)) : null;

function shortWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function Chat({ conversationId, initialTurns, threads, agents, workspaceName }: {
  conversationId: string | null; initialTurns: ChatTurn[]; threads: ChatThread[];
  agents: { id: string; name: string; description: string }[]; workspaceName: string;
}) {
  const router = useRouter();
  const cfg = useAIConfig();
  const server = useServerAI();
  const [cid, setCid] = useState(conversationId);
  const [turns, setTurns] = useState<ChatTurn[]>(initialTurns);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [steps, setSteps] = useState<Record<string, RunStep[]>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const att = useAttachments();
  const voiceBase = useRef<string | null>(null);
  const [over, setOver] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const last = turns[turns.length - 1];
  const busy = live(last);
  const noModel = cfg ? cfg.tools === false : server === null;

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [turns.length, last?.status, steps]);

  // Follow the running turn until it finishes, then refresh the thread list.
  useEffect(() => {
    if (!last || !live(last)) return;
    let stop = false;
    const id = last.id;
    const tick = async () => {
      try {
        const r = await call<AskRun>(`runs/${id}`);
        if (stop) return;
        setSteps((s) => ({ ...s, [id]: r.steps ?? [] }));
        setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, status: r.status, answer: r.answer ?? null, error: r.error,
          finished_at: r.finished_at, summary: (r.summary as ChatTurn["summary"]) ?? null } : t)));
        if (r.status === "queued" || r.status === "running") setTimeout(tick, 900);
        else router.refresh();
      } catch (e) {
        if (!stop) setError(e instanceof Error ? e.message : "lost the run");
      }
    };
    void tick();
    return () => { stop = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last?.id]);

  async function send(typed: string) {
    typed = typed.trim();
    if ((!typed && !att.items.some((a) => a.state === "ready")) || busy || att.busy) return;
    const request = withAttached(typed || "Read the attached file(s) and tell me what they cover.", att.items);
    setError("");
    try {
      const r = await call<{ run_id: string; conversation_id: string }>("ask", { request, conversation_id: cid }, { ai: true });
      if (!cid) {
        setCid(r.conversation_id);
        window.history.replaceState(null, "", `/?c=${r.conversation_id}`);
      }
      setTurns((ts) => [...ts, { id: r.run_id, status: "queued", request, answer: null, error: null,
        started_at: new Date().toISOString(), finished_at: null, summary: null }]);
      setText("");
      att.clear();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not send");
    }
  }

  async function toggle(id: string) {
    const show = !open[id];
    setOpen((o) => ({ ...o, [id]: show }));
    if (show && !steps[id]) {
      const r = await call<AskRun>(`runs/${id}`);
      setSteps((s) => ({ ...s, [id]: r.steps ?? [] }));
    }
  }

  // A new chat: clear this view as well, since the URL may not change (it was set by replaceState).
  function newChat() {
    setCid(null);
    setTurns([]);
    setSteps({});
    setOpen({});
    setError("");
    window.history.replaceState(null, "", "/");
    router.push("/");
  }

  async function remove(id: string) {
    if (!confirm("Delete this conversation? Pages and tasks the agents made stay in the workspace.")) return;
    await call(`conversations/${id}/delete`, {});
    if (id === cid) newChat();
    else router.refresh();
  }

  const canSend = !busy && !att.busy && (!!text.trim() || att.items.some((a) => a.state === "ready"));
  const composer = (
    <form onSubmit={(e) => { e.preventDefault(); void send(text); }} {...dropProps((f) => void att.add(f), setOver)}
      onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); void att.add(e.clipboardData.files); } }}
      className={cn("bg-inner-grad relative rounded-xl border p-3 shadow-soft focus-within:border-[rgba(0,0,0,0.4)]",
        over && "border-[#111] border-dashed bg-white")}>
      {over && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/90 text-[13px] font-medium">Drop to attach to this message</div>}
      <AttachChips items={att.items} onRemove={att.remove} className="mb-2" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={turns.length ? 2 : 3} disabled={busy}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
        placeholder={busy ? "Your agents are working…" : `Ask your agents anything about ${workspaceName}…`}
        className="text-fg placeholder:text-muted-foreground/80 w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <AttachButton onFiles={(f) => void att.add(f)} disabled={busy} />
          <VoiceButton disabled={busy} onText={(spoken, done) => {
            if (voiceBase.current === null) voiceBase.current = text;
            setText([voiceBase.current, spoken].filter(Boolean).join(" "));
            if (done) voiceBase.current = null;
          }} />
          <ModelPicker />
          {noModel && <span className="text-warn hidden truncate text-[11.5px] sm:inline">needs a model that can call tools</span>}
        </span>
        <Button type="submit" size="icon" disabled={!canSend} aria-label="Send">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
        </Button>
      </div>
    </form>
  );

  return (
    <div className="flex min-h-0 flex-1">
      {/* the rail: every chat in this workspace */}
      <aside className="hidden w-64 shrink-0 flex-col border-r md:flex">
        <div className="p-3">
          <Button variant="outline" className="w-full justify-start" onClick={newChat}>
            <MessageSquarePlus className="size-4" /> New chat
          </Button>
        </div>
        <p className="text-muted-foreground px-4 pb-1.5 text-[11.5px]">Chats in {workspaceName}</p>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {threads.length === 0 && <li className="text-muted-foreground px-2 py-1.5 text-[12.5px]">No chats yet.</li>}
          {threads.map((t) => (
            <li key={t.id} className="group relative">
              <Link href={`/?c=${t.id}`}
                className={cn("block rounded-md px-2.5 py-2 pr-8 text-[13px] leading-snug transition-colors",
                  t.id === cid ? "bg-raised text-fg" : "text-text hover:bg-hover")}>
                <span className="line-clamp-2">{t.title ?? "Untitled chat"}</span>
                <span className="text-muted-foreground mt-0.5 block font-mono text-[10.5px]">{shortWhen(t.updated_at)} · {t.turns} turn(s)</span>
              </Link>
              <button type="button" onClick={() => remove(t.id)} aria-label="Delete chat"
                className="text-muted-foreground hover:text-bad absolute top-2 right-1.5 hidden rounded p-1 group-hover:block">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center gap-3 border-b px-4 py-2.5 md:px-6">
          <AgentBadge nickname="Orchestrator" size="sm" showTooltip={false} />
          <div className="min-w-0 flex-1">
            <h1 className="text-[14px] font-medium">Assistant</h1>
            <p className="text-muted-foreground hidden truncate text-[12px] sm:block">
              Delegates to your agents, in parallel where it can. You do not have to know who to ask.
            </p>
          </div>
          <div className="hidden items-center gap-1.5 sm:flex">
            {agents.map((a) => <AgentBadge key={a.id} nickname={a.name} title={a.description.split(".")[0]} href={`/agents/${a.id}`} align="end" />)}
          </div>
          <Button variant="ghost" size="sm" className="md:hidden" onClick={newChat} aria-label="New chat"><MessageSquarePlus className="size-4" /></Button>
        </header>

        {turns.length === 0 ? (
          <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto px-4 py-8">
            <div className="mx-auto w-full max-w-2xl space-y-6">
              <div className="text-center">
                <div className="flex justify-center"><AgentBadge nickname="Orchestrator" large showTooltip={false} /></div>
                <h2 className="mt-3 text-2xl font-medium tracking-tight">What should your agents do?</h2>
                <p className="text-muted-foreground mt-2 text-[13.5px] leading-relaxed">
                  The Orchestrator splits your request across Reader, Writer, Planner, Reviewer and your own agents.
                  Pages they write cite your files; tasks never overload anyone.
                </p>
              </div>
              {composer}
              {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}
              <ul className="space-y-2">
                {EXAMPLES.map((ex) => (
                  <li key={ex}>
                    <button type="button" onClick={() => setText(ex)}
                      className="bg-inner-grad group flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-[13px] transition-colors hover:border-[rgba(0,0,0,0.3)]">
                      <span className="flex-1">{ex}</span>
                      <ArrowRight className="text-muted-foreground group-hover:text-fg size-3.5 shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 md:px-6">
                {turns.map((t) => (
                  <div key={t.id} className="space-y-3">
                    <div className="flex flex-col items-end gap-1.5">
                      <p className="bg-primary text-primary-foreground max-w-[85%] rounded-lg rounded-br-sm px-4 py-2.5 text-[14px] leading-relaxed whitespace-pre-line">{splitAttached(t.request ?? "").text}</p>
                      <SentFiles files={splitAttached(t.request ?? "").files} className="max-w-[85%]" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <AgentBadge nickname="Orchestrator" size="xs" showTooltip={false} />
                        <span className="text-[12.5px] font-medium">Orchestrator</span>
                        {live(t) && <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]"><Loader2 className="size-3 animate-spin" />{t.status === "queued" ? "waiting for a worker…" : "agents working…"}</span>}
                        {t.status === "done" && secs(t) && <span className="text-muted-foreground font-mono text-[11px]">· {secs(t)}s</span>}
                      </div>
                      {live(t) && ((steps[t.id]?.length ?? 0) > 0 ? <AgentPanel steps={steps[t.id]} live /> :
                        <p className="text-muted-foreground font-mono text-[12px]">Preparing…</p>)}
                      {t.status === "done" && (
                        <>
                          <button type="button" onClick={() => toggle(t.id)}
                            className="text-muted-foreground hover:text-fg flex items-center gap-1 text-[12px]">
                            <ChevronDown className={cn("size-3.5 transition-transform", open[t.id] && "rotate-180")} />
                            {open[t.id] ? "Hide what the agents did" : "Show what the agents did"}
                          </button>
                          {open[t.id] && steps[t.id] && <AgentPanel steps={steps[t.id]} />}
                          <div className="bg-inner-grad rounded-lg border p-4">
                            <div className="text-[14px] leading-relaxed"><Markdown>{t.answer || "Done."}</Markdown></div>
                            <ArtifactLinks items={t.summary?.artifacts ?? []} />
                            <SpeakButton text={t.answer || ""} className="mt-2" />
                          </div>
                        </>
                      )}
                      {t.status === "failed" && (
                        <div className="bg-inner-grad rounded-lg border p-4">
                          <p className="text-bad flex items-center gap-2 text-[13.5px]"><Dot tone="bad" />{t.error ?? "The agents stopped."}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={bottom} />
              </div>
            </div>
            <div className="shrink-0 border-t px-4 py-3 md:px-6">
              <div className="mx-auto w-full max-w-3xl space-y-2">
                {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}
                {composer}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
