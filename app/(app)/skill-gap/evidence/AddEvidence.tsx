"use client";

import { FileUp, GitBranch, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { KIND_LABEL } from "@/components/skill-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";
import { fileText } from "@/lib/pdf-text";
import { cn } from "@/lib/utils";

const KINDS = ["syllabus", "transcript", "project", "portfolio", "cv", "other"];
const field = "border-input w-full rounded-lg border bg-white px-3 py-2 text-[13.5px] text-fg outline-none placeholder:text-muted-foreground/80 hover:border-[rgba(0,0,0,0.28)] focus-visible:border-[rgba(0,0,0,0.55)] focus-visible:ring-3 focus-visible:ring-[rgba(0,0,0,0.08)]";

type Mode = "file" | "paste" | "github";

export function AddEvidence() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("file");
  const [kind, setKind] = useState("syllabus");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    let added = 0;
    try {
      for (const f of Array.from(files)) {
        const body = await fileText(f);
        await call("documents", { kind, title: f.name.replace(/\.[^.]+$/, ""), text: body });
        added++;
      }
      setMsg({ ok: true, text: `${added} document(s) added. Run the agents to read them.` });
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: (added ? `${added} added, then: ` : "") + (e instanceof Error ? e.message : "upload failed") });
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "github") await call("documents/github", { url });
      else await call("documents", { kind, title, text });
      setMsg({ ok: true, text: "Added. Run the agents to read it." });
      setTitle(""); setText(""); setUrl("");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "could not add" });
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Mode; label: string; icon: React.ElementType }[] = [
    { id: "file", label: "Upload file", icon: FileUp },
    { id: "paste", label: "Paste text", icon: Type },
    { id: "github", label: "GitHub repo", icon: GitBranch },
  ];

  return (
    <div className="bg-inner-grad rounded-lg border p-4">
      <div className="flex flex-wrap gap-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={mode === t.id}
            onClick={() => { setMode(t.id); setMsg(null); }}
            className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              mode === t.id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}>
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="mt-4 space-y-3">
        {mode !== "github" && (
          <label className="block space-y-1">
            <span className="text-muted-foreground text-xs">What is it?</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={field}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
          </label>
        )}

        {mode === "file" && (
          <label className={cn("flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed p-6 text-center",
            busy && "pointer-events-none opacity-60")}>
            <FileUp className="text-muted-foreground size-5" />
            <span className="text-[14px] font-medium">{busy ? "Reading…" : "Choose PDF, TXT or Markdown files"}</span>
            <span className="text-muted-foreground text-xs">PDFs are read in your browser; only their text is sent.</span>
            <input type="file" multiple accept=".pdf,.txt,.md,.markdown,text/plain,application/pdf"
              className="sr-only" onChange={(e) => onFiles(e.target.files)} />
          </label>
        )}

        {mode === "paste" && (
          <>
            <Input placeholder="Title, e.g. Pemrograman Web (silabus)" value={title}
              onChange={(e) => setTitle(e.target.value)} required />
            <textarea value={text} onChange={(e) => setText(e.target.value)} required rows={8}
              placeholder="Paste a syllabus, a transcript, a project README…" className={field} />
            <Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add document"}</Button>
          </>
        )}

        {mode === "github" && (
          <>
            <Input placeholder="https://github.com/you/your-project" value={url}
              onChange={(e) => setUrl(e.target.value)} required type="url" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Public repositories only. We read the description, languages, README and dependency
              list. Your code is never run.
            </p>
            <Button type="submit" disabled={busy}>{busy ? "Reading repository…" : "Add repository"}</Button>
          </>
        )}
      </form>
      {msg && <p className={cn("mt-3 text-sm", msg.ok ? "text-ok" : "text-destructive")}>{msg.text}</p>}
    </div>
  );
}
