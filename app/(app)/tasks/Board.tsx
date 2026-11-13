"use client";

import { Bot, Play, Plus, Trash2, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Member, Task } from "@/app/lib";
import { Chip, Dot } from "@/components/dort";
import { AgentBadge } from "@/components/agent-card";
import { Field } from "@/components/field";
import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

const COLS: { id: Task["status"]; label: string }[] = [
  { id: "todo", label: "To do" }, { id: "doing", label: "Doing" }, { id: "done", label: "Done" },
];

type AgentOpt = { id: string; name: string };

const NONE = "none";

function assigneeValue(t: Pick<Task, "assignee_type" | "assignee_id">) {
  return t.assignee_type && t.assignee_id ? `${t.assignee_type}:${t.assignee_id}` : NONE;
}

function assigneeOptions(members: Member[], agents: AgentOpt[]): SelectOption[] {
  const initials = (n: string) => n.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return [
    { value: NONE, label: "Unassigned" },
    ...members.map((m) => ({
      value: `user:${m.user_id}`, label: m.name ?? m.email ?? "member", group: "People",
      icon: <span className="bg-raised text-text flex size-5 items-center justify-center rounded-full text-[9.5px] font-medium">{initials(m.name ?? m.email ?? "?")}</span>,
    })),
    ...agents.map((a) => ({ value: `agent:${a.id}`, label: a.name, group: "Agents",
      icon: <AgentBadge nickname={a.name} size="xs" showTooltip={false} /> })),
  ];
}

const split = (v: string) => (v && v !== NONE ? { assignee_type: v.split(":")[0], assignee_id: v.split(":").slice(1).join(":") }
  : { assignee_type: null, assignee_id: null });

export function Board({ tasks, members, agents }: { tasks: Task[]; members: Member[]; agents: AgentOpt[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState(NONE);
  const people = assigneeOptions(members, agents);
  const [est, setEst] = useState("");
  const [due, setDue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>, ok?: string) {
    setMsg(null);
    try { await fn(); if (ok) setMsg({ ok: true, text: ok }); router.refresh(); }
    catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "failed" }); }
  }

  async function runAgent(t: Task) {
    setRunning(t.id);
    await act(async () => {
      const { run_id } = await call<{ run_id: string }>(`tasks/${t.id}/run`, {}, { ai: true });
      for (let i = 0; i < 300; i++) {
        const r = await call<{ status: string; error?: string }>(`runs/${run_id}`);
        if (r.status === "failed") throw new Error(r.error ?? "the agent failed");
        if (r.status === "done") break;
        await new Promise((res) => setTimeout(res, 900));
      }
    }, `${t.agent_name ?? "The agent"} finished "${t.title}".`);
    setRunning(null);
  }

  return (
    <div className="space-y-5">
      <form className="bg-inner-grad grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_90px_150px_auto] md:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (!title.trim()) return;
          void act(() => call("tasks", { title, ...split(assignee), estimate_hours: est || null, due_date: due || null }));
          setTitle(""); setEst(""); setDue("");
        }}>
        <Field label="New task"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tulis bab 2 laporan" /></Field>
        <Field label="For"><Select value={assignee} onValueChange={setAssignee} options={people} ariaLabel="Assign to" /></Field>
        <Field label="Hours"><Input type="number" min={0} step={0.5} value={est} onChange={(e) => setEst(e.target.value)} /></Field>
        <Field label="Due"><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <Button type="submit"><Plus className="size-4" /> Add</Button>
      </form>
      {msg && <p className={cn("flex items-center gap-2 text-[13px]", msg.ok ? "text-ok" : "text-bad")}><Dot tone={msg.ok ? "ok" : "bad"} />{msg.text}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        {COLS.map((col) => {
          const list = tasks.filter((t) => t.status === col.id);
          return (
            <section key={col.id} className="dot-grid-soft min-w-0 rounded-lg border p-2">
              <h2 className="px-1.5 pt-1 pb-2 text-[13px] font-medium">{col.label} <span className="text-muted-foreground">· {list.length}</span></h2>
              <ul className="space-y-2">
                {list.map((t) => (
                  <li key={t.id} className={cn("bg-card-grad rounded-lg border p-3 shadow-soft", running === t.id && "glow-top")}>
                    <p className={cn("text-[13.5px] leading-snug", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</p>
                    {t.description && <p className="text-muted-foreground mt-1 line-clamp-2 text-[12px]">{t.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {t.assignee_type === "agent" && <Chip tone="info"><Bot className="size-3" />{t.agent_name ?? t.assignee_id}</Chip>}
                      {t.assignee_type === "user" && <Chip><User className="size-3" />{t.assignee_name ?? "member"}</Chip>}
                      {t.estimate_hours != null && <Chip>{t.estimate_hours} h</Chip>}
                      {t.due_date && <Chip tone="warn">{t.due_date}</Chip>}
                      {t.page_id && <Link href={`/pages/${t.page_id}`} className="text-brand text-[12px]">page →</Link>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      <Select value={t.status} size="xs" className="w-auto" ariaLabel="Status"
                        onValueChange={(v) => void act(() => call(`tasks/${t.id}`, { status: v }))}
                        options={COLS.map((c) => ({ value: c.id, label: c.label }))} />
                      <Select value={assigneeValue(t)} size="xs" className="w-auto max-w-[10rem]" ariaLabel="Assignee"
                        onValueChange={(v) => void act(() => call(`tasks/${t.id}`, split(v)))} options={people} />
                      {t.assignee_type === "agent" && t.status !== "done" && (
                        <Button size="sm" variant="outline" className="h-7" disabled={!!running} onClick={() => runAgent(t)}>
                          <Play className="size-3.5" /> {running === t.id ? "Working…" : "Run"}
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="ml-auto size-7" aria-label="Delete task"
                        onClick={() => { if (confirm(`Delete "${t.title}"?`)) void act(() => call(`tasks/${t.id}/delete`, {})); }}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
