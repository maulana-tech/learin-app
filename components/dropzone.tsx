"use client";

import { CheckCircle2, Loader2, UploadCloud, XCircle } from "lucide-react";
import { useRef, useState } from "react";

import { FileIcon } from "@/components/bits";
import { cn } from "@/lib/utils";

export type QueueItem = { name: string; size: number; state: "reading" | "sending" | "done" | "failed"; error?: string };

/** Drop files here or click to choose. Reports each file's progress while `onFile` handles it. */
export function Dropzone({ onFile, accept = ".pdf,.txt,.md,.markdown,text/plain,application/pdf", hint, onAllDone }: {
  onFile: (f: File, set: (s: QueueItem["state"]) => void) => Promise<void>; accept?: string; hint?: string;
  onAllDone?: (ok: number, failed: number) => void;
}) {
  const [over, setOver] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const busy = queue.some((q) => q.state === "reading" || q.state === "sending");

  async function take(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    if (!files.length || busy) return;
    const start = queue.length;
    setQueue((q) => [...q, ...files.map((f) => ({ name: f.name, size: f.size, state: "reading" as const }))]);
    let ok = 0, failed = 0;
    for (const [i, f] of files.entries()) {
      const idx = start + i;
      const set = (state: QueueItem["state"], error?: string) =>
        setQueue((q) => q.map((x, j) => (j === idx ? { ...x, state, error } : x)));
      try {
        await onFile(f, (s) => set(s));
        set("done"); ok++;
      } catch (e) {
        set("failed", e instanceof Error ? e.message : "failed"); failed++;
      }
    }
    onAllDone?.(ok, failed);
  }

  return (
    <div className="space-y-3">
      <div role="button" tabIndex={0} onClick={() => input.current?.click()}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); void take(e.dataTransfer.files); }}
        className={cn("dot-grid-soft group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-all outline-none",
          "focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.25)]",
          over ? "border-brand scale-[1.01] bg-white" : "border-[rgba(0,0,0,0.15)] hover:border-[rgba(0,0,0,0.35)]")}>
        <span className={cn("flex size-12 items-center justify-center rounded-full bg-white shadow-soft transition-transform", over && "scale-110")}>
          <UploadCloud className="size-5" />
        </span>
        <p className="text-[14px] font-medium">{over ? "Drop to add" : "Drop files here, or click to choose"}</p>
        <p className="text-muted-foreground max-w-sm text-[12px] leading-relaxed">
          {hint ?? "PDF, TXT or Markdown. Many at once is fine. PDFs are read in your browser; only their text is sent."}
        </p>
        <input ref={input} type="file" multiple accept={accept} className="sr-only" onChange={(e) => { void take(e.target.files); e.target.value = ""; }} />
      </div>
      {queue.length > 0 && (
        <ul className="divide-y rounded-lg border bg-white">
          {queue.slice(-8).map((q, i) => (
            <li key={`${q.name}-${i}`} className="flex items-center gap-3 px-3 py-2">
              <FileIcon name={q.name} className="size-7" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px]">{q.name}</p>
                <p className={cn("text-[11px]", q.state === "failed" ? "text-bad" : "text-muted-foreground")}>
                  {q.state === "reading" ? "reading…" : q.state === "sending" ? "adding…" : q.state === "done" ? "added" : q.error}
                </p>
              </div>
              {q.state === "done" ? <CheckCircle2 className="text-ok size-4" /> : q.state === "failed" ? <XCircle className="text-bad size-4" />
                : <Loader2 className="text-muted-foreground size-4 animate-spin" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
