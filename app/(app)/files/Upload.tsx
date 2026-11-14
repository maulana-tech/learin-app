"use client";

import { FileUp, GitBranch, Plus, Trash2, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Dropzone } from "@/components/dropzone";
import { Dot } from "@/components/dort";
import { Field, TextArea } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";
import { fileText } from "@/lib/pdf-text";
import { cn } from "@/lib/utils";

type Mode = "file" | "paste" | "github";

/** Add material, labelled with its course: a whole semester at once is split by course later. */
export function Upload({ courses }: { courses: string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [course, setCourse] = useState(courses[0] ?? "");
  const [adding, setAdding] = useState(false);
  const [newCourse, setNewCourse] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const all = [...new Set([...courses, ...(course && !courses.includes(course) ? [course] : [])])];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Adding…");
    setMsg(null);
    try {
      if (mode === "github") await call("files/github", { url, collection: course || null });
      else await call("files", { name, text, collection: course || null });
      setMsg({ ok: true, text: `Added${course ? ` to ${course}` : ""}.` });
      setName(""); setText(""); setUrl("");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "could not add" });
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="bg-card-grad space-y-5 rounded-xl border p-5 shadow-soft">
      <div>
        <p className="text-text text-[12.5px]">1 · Which course is this for?</p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setCourse("")}
            className={cn("h-8 rounded-full border px-3 text-[12.5px] transition-colors",
              !course ? "border-brand bg-brand text-white" : "text-text bg-white hover:border-[rgba(0,0,0,0.35)]")}>
            No course
          </button>
          {all.map((c) => (
            <button key={c} type="button" onClick={() => setCourse(c)}
              className={cn("h-8 rounded-full border px-3 text-[12.5px] transition-colors",
                course === c ? "border-brand bg-brand text-white" : "text-text bg-white hover:border-[rgba(0,0,0,0.35)]")}>
              {c}
            </button>
          ))}
          {adding ? (
            <form className="flex items-center gap-1" onSubmit={(e) => {
              e.preventDefault();
              if (newCourse.trim()) { setCourse(newCourse.trim()); setNewCourse(""); setAdding(false); }
            }}>
              <Input autoFocus value={newCourse} onChange={(e) => setNewCourse(e.target.value)} placeholder="e.g. Basis Data" className="h-8 w-40" />
              <Button size="sm" type="submit">Add</Button>
            </form>
          ) : (
            <button type="button" onClick={() => setAdding(true)}
              className="text-muted-foreground hover:text-fg flex h-8 items-center gap-1 rounded-full border border-dashed px-3 text-[12.5px]">
              <Plus className="size-3.5" /> New course
            </button>
          )}
        </div>
        <p className="text-muted-foreground mt-1.5 text-[11.5px]">The Orchestrator can send one agent per course when you ask it to work on the semester.</p>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-text text-[12.5px]">2 · Add material</p>
          <Segmented ariaLabel="How to add" size="sm" value={mode} onValueChange={(v) => { setMode(v as Mode); setMsg(null); }}
            items={[{ value: "file", label: "Upload", icon: <FileUp className="size-3.5" /> },
              { value: "paste", label: "Paste", icon: <Type className="size-3.5" /> },
              { value: "github", label: "GitHub", icon: <GitBranch className="size-3.5" /> }]} />
        </div>

        {mode === "file" && (
          <Dropzone
            onFile={async (f, set) => {
              const body = await fileText(f);
              set("sending");
              await call("files", { name: f.name, text: body, collection: course || null });
            }}
            onAllDone={(ok, failed) => {
              setMsg(failed ? { ok: false, text: `${ok} added, ${failed} could not be read` }
                : { ok: true, text: `${ok} file(s) added${course ? ` to ${course}` : ""}.` });
              router.refresh();
            }} />
        )}
        {mode === "paste" && (
          <form onSubmit={submit} className="space-y-3">
            <Field label="Name"><Input placeholder="Modul minggu 3" value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Text"><TextArea rows={8} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste notes, a module, an assignment brief…" required /></Field>
            <Button type="submit" disabled={!!busy}>{busy || "Add"}</Button>
          </form>
        )}
        {mode === "github" && (
          <form onSubmit={submit} className="space-y-3">
            <Field label="Repository" hint="Public repositories only: description, languages, README and dependencies. Code is never run.">
              <Input type="url" placeholder="https://github.com/you/project" value={url} onChange={(e) => setUrl(e.target.value)} required />
            </Field>
            <Button type="submit" disabled={!!busy}>{busy || "Add repository"}</Button>
          </form>
        )}
        {msg && <p className={cn("flex items-center gap-2 text-[13px]", msg.ok ? "text-ok" : "text-bad")}><Dot tone={msg.ok ? "ok" : "bad"} />{msg.text}</p>}
      </div>
    </div>
  );
}

export function DeleteFile({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <Button variant="ghost" size="icon-xs" aria-label={`Delete ${name}`} className="opacity-60 hover:opacity-100" onClick={async () => {
      if (!confirm(`Delete "${name}"? Pages that cite it will show the source as stale.`)) return;
      await call(`files/${id}/delete`, {});
      router.refresh();
    }}><Trash2 className="size-3.5" /></Button>
  );
}
