"use client";

import { FileUp, GitBranch, Type } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Dropzone } from "@/components/dropzone";
import { Dot } from "@/components/dort";
import { KIND_LABEL } from "@/components/skill-bits";
import { Button } from "@/components/ui/button";
import { TextArea } from "@/components/field";
import { Segmented } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";
import { fileText } from "@/lib/pdf-text";
import { cn } from "@/lib/utils";

const KINDS = ["syllabus", "transcript", "project", "portfolio", "cv", "other"];

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
    <div className="bg-card-grad rounded-xl border p-5 shadow-soft">
      <Segmented ariaLabel="How to add evidence" value={mode} onValueChange={(v) => { setMode(v as Mode); setMsg(null); }}
        items={tabs.map((t) => ({ value: t.id, label: t.label, icon: <t.icon className="size-3.5" /> }))} />

      <form onSubmit={submit} className="mt-4 space-y-3">
        {mode !== "github" && (
          <div className="space-y-1.5">
            <span className="text-text text-[12.5px]">What is it?</span>
            <div className="flex flex-wrap gap-1.5">
              {KINDS.map((k) => (
                <button key={k} type="button" onClick={() => setKind(k)}
                  className={cn("h-8 rounded-full border px-3 text-[12.5px] transition-colors",
                    kind === k ? "border-brand bg-brand text-white" : "text-text bg-white hover:border-[rgba(0,0,0,0.35)]")}>
                  {KIND_LABEL[k] ?? k}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "file" && (
          <Dropzone hint="Syllabus, transcript, project README: PDF, TXT or Markdown. PDFs are read in your browser; only their text is sent."
            onFile={async (f, set) => {
              const body = await fileText(f);
              set("sending");
              await call("documents", { kind, title: f.name.replace(/\.[^.]+$/, ""), text: body });
            }}
            onAllDone={(ok, failed) => {
              setMsg(failed ? { ok: false, text: `${ok} added, ${failed} could not be read` }
                : { ok: true, text: `${ok} document(s) added. Run the agents to read them.` });
              router.refresh();
            }} />
        )}

        {mode === "paste" && (
          <>
            <Input placeholder="Title, e.g. Pemrograman Web (silabus)" value={title}
              onChange={(e) => setTitle(e.target.value)} required />
            <TextArea value={text} onChange={(e) => setText(e.target.value)} required rows={8}
              placeholder="Paste a syllabus, a transcript, a project README…" />
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
      {msg && <p className={cn("mt-3 flex items-center gap-2 text-[13px]", msg.ok ? "text-ok" : "text-bad")}><Dot tone={msg.ok ? "ok" : "bad"} />{msg.text}</p>}
    </div>
  );
}
