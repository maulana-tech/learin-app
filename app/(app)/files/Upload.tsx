"use client";

import { FileUp, GitBranch, Trash2, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Dot } from "@/components/dort";
import { Field, TextArea } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";
import { fileText } from "@/lib/pdf-text";
import { cn } from "@/lib/utils";

type Mode = "file" | "paste" | "github";

/** Add material, labelled with its course: a whole semester at once is split by course later. */
export function Upload({ courses }: { courses: string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [course, setCourse] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFiles(list: FileList | null) {
    if (!list?.length) return;
    setMsg(null);
    let n = 0;
    try {
      for (const f of Array.from(list)) {
        setBusy(`Reading ${f.name}…`);
        await call("files", { name: f.name, text: await fileText(f), collection: course || null });
        n++;
      }
      setMsg({ ok: true, text: `${n} file(s) added${course ? ` to ${course}` : ""}.` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: `${n ? `${n} added, then: ` : ""}${e instanceof Error ? e.message : "upload failed"}` });
    } finally {
      setBusy("");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy("Adding…");
    setMsg(null);
    try {
      if (mode === "github") await call("files/github", { url, collection: course || null });
      else await call("files", { name, text, collection: course || null });
      setMsg({ ok: true, text: "Added." });
      setName(""); setText(""); setUrl("");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "could not add" });
    } finally {
      setBusy("");
    }
  }

  const tabs: { id: Mode; label: string; icon: React.ElementType }[] = [
    { id: "file", label: "Upload", icon: FileUp }, { id: "paste", label: "Paste", icon: Type },
    { id: "github", label: "GitHub repo", icon: GitBranch },
  ];

  return (
    <div className="bg-inner-grad space-y-4 rounded-lg border p-4">
      <Field label="Course or collection" optional hint="e.g. Basis Data. Agents can work one course at a time.">
        <Input list="courses" value={course} onChange={(e) => setCourse(e.target.value)} placeholder="Basis Data" />
        <datalist id="courses">{courses.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <div className="flex flex-wrap gap-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={mode === t.id} onClick={() => setMode(t.id)}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px]",
              mode === t.id ? "bg-raised text-fg font-medium" : "text-muted-foreground hover:text-fg")}>
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "file" && (
          <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed bg-white p-6 text-center", busy && "pointer-events-none opacity-60")}>
            <FileUp className="text-muted-foreground size-5" />
            <span className="text-[13.5px] font-medium">{busy || "Choose PDF, TXT or Markdown files"}</span>
            <span className="text-muted-foreground text-[12px]">Select many at once. PDFs are read in your browser; only their text is sent.</span>
            <input type="file" multiple accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf" className="sr-only"
              onChange={(e) => onFiles(e.target.files)} />
          </label>
        )}
        {mode === "paste" && (
          <>
            <Input placeholder="Name, e.g. Modul minggu 3" value={name} onChange={(e) => setName(e.target.value)} required />
            <TextArea rows={7} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste notes, a module, an assignment…" required />
            <Button type="submit" disabled={!!busy}>{busy || "Add"}</Button>
          </>
        )}
        {mode === "github" && (
          <>
            <Input type="url" placeholder="https://github.com/you/project" value={url} onChange={(e) => setUrl(e.target.value)} required />
            <p className="text-muted-foreground text-[12px]">Public repositories only: description, languages, README, dependencies. Code is never run.</p>
            <Button type="submit" disabled={!!busy}>{busy || "Add repository"}</Button>
          </>
        )}
      </form>
      {msg && <p className={cn("flex items-center gap-2 text-[13px]", msg.ok ? "text-ok" : "text-bad")}><Dot tone={msg.ok ? "ok" : "bad"} />{msg.text}</p>}
    </div>
  );
}

export function DeleteFile({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <Button variant="ghost" size="icon" aria-label={`Delete ${name}`} onClick={async () => {
      if (!confirm(`Delete "${name}"? Pages that cite it will show the source as stale.`)) return;
      await call(`files/${id}/delete`, {});
      router.refresh();
    }}><Trash2 className="size-4" /></Button>
  );
}
