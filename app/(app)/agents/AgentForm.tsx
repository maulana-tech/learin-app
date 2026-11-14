"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { CustomAgent, ToolDef } from "@/app/lib";
import { Dot } from "@/components/dort";
import { Field, TextArea } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Checkbox, ControlRow, Switch } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

const GROUP: Record<string, string> = { reader: "Read", writer: "Write pages", organizer: "Tasks", reviewer: "Check" };

/** Build an agent: what it is for, how it should work, which tools it may use, which model. */
export function AgentForm({ tools, agent }: { tools: ToolDef[]; agent?: CustomAgent }) {
  const router = useRouter();
  const [name, setName] = useState(agent?.name ?? "");
  const [description, setDescription] = useState(agent?.description ?? "");
  const [instructions, setInstructions] = useState(agent?.instructions ?? "");
  const [picked, setPicked] = useState<string[]>(agent?.tools ?? ["list_files", "read_file", "create_page"]);
  const [model, setModel] = useState(agent?.model ?? "");
  const [shared, setShared] = useState(agent?.shared ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const groups = [...new Set(tools.map((t) => t.group))];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = { name, description, instructions, tools: picked, model: model || null, shared };
      const a = await call<{ id: string }>(agent ? `workspace-agents/${agent.id}` : "workspace-agents", body);
      router.push(`/agents/${a.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Flashcard Maker" maxLength={40} required /></Field>
        <Field label="What it does" hint="One line. The Orchestrator reads this to decide when to delegate to it.">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Turns a course's files into question-and-answer flashcards" maxLength={300} required />
        </Field>
        <Field label="Instructions" hint="How it should work, step by step. 20 to 4000 characters.">
          <TextArea rows={10} value={instructions} onChange={(e) => setInstructions(e.target.value)} required
            placeholder="Read every file of the course you are given. Write one page of 15 flashcards, Q on one line and A on the next, each citing its file as [n]." />
        </Field>
        <Field label="Model" optional hint="Leave empty to use the model you connected. A cheaper model suits simple jobs.">
          <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="gpt-4o-mini" />
        </Field>
        <ControlRow control={<Switch checked={shared} onCheckedChange={setShared} />} label="Share in the community gallery"
          hint="Others can install a copy. Your files and pages are never shared, only the agent." />
        {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}
        <Button type="submit" disabled={busy}>{busy ? "Saving…" : agent ? "Save agent" : "Create agent"}</Button>
      </div>

      <div className="min-w-0">
        <p className="text-text text-[12.5px]">Tools it may use <span className="text-muted-foreground">· {picked.length}</span></p>
        <div className="mt-2 space-y-3">
          {groups.map((g) => (
            <div key={g} className="bg-inner-grad rounded-lg border p-3">
              <p className="text-muted-foreground mb-2 text-[12px]">{GROUP[g] ?? g}</p>
              <ul className="space-y-2">
                {tools.filter((t) => t.group === g).map((t) => {
                  const on = picked.includes(t.name);
                  return (
                    <li key={t.name}>
                      <label className={cn("flex cursor-pointer items-start gap-2.5 rounded-md p-1.5 transition-colors", on ? "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]" : "hover:bg-white/60")}>
                        <Checkbox className="mt-0.5" checked={on}
                          onCheckedChange={() => setPicked(on ? picked.filter((x) => x !== t.name) : [...picked, t.name])} />
                        <span className="min-w-0">
                          <span className="font-mono text-[12px]">{t.name}</span>
                          {t.writes && <span className="text-warn ml-1.5 text-[11px]">changes the workspace</span>}
                          <span className="text-muted-foreground block text-[11.5px] leading-snug">{t.description}</span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </form>
  );
}
