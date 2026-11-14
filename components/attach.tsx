"use client";

import { FileText, Loader2, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";

import { FileLink } from "@/components/file-preview";
import { call } from "@/lib/ai-config";
import { fileText } from "@/lib/pdf-text";
import { cn } from "@/lib/utils";

/* Attach files to a message. Each file is added to the workspace's Files first
 * (so it can be cited and read again later), then the message names it with its
 * id so the agent reads it before anything else. */

export type Attachment = { key: string; name: string; id?: string; state: "uploading" | "ready" | "failed"; error?: string };

const ACCEPT = ".pdf,.txt,.md,.markdown,.csv,.json,text/plain,application/pdf";
const TAG = /\n\n\[Attached files: ([^\n]+)\]\s*$/;

/** The request as sent: the text plus a line naming each attached file and its id. */
export function withAttached(text: string, items: Attachment[]): string {
  const ready = items.filter((a) => a.state === "ready" && a.id);
  if (!ready.length) return text;
  return `${text}\n\n[Attached files: ${ready.map((a) => `${a.name} (file_id: ${a.id})`).join("; ")}]`;
}

export type SentFile = { name: string; id?: string };

/** Split a stored request back into what the person typed and the files they attached. */
export function splitAttached(request: string): { text: string; files: SentFile[] } {
  const m = request.match(TAG);
  if (!m) return { text: request, files: [] };
  return {
    text: request.slice(0, m.index).trimEnd(),
    files: m[1].split("; ").map((f) => {
      const id = /\(file_id: ([^)]*)\)$/.exec(f)?.[1];
      return { name: f.replace(/ \(file_id: [^)]*\)$/, ""), id };
    }),
  };
}

export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([]);
  const busy = items.some((a) => a.state === "uploading");

  async function add(list: FileList | File[] | null) {
    const files = Array.from(list ?? []);
    for (const f of files) {
      const key = `${f.name}-${f.size}-${Date.now()}-${Math.random()}`;
      setItems((xs) => [...xs, { key, name: f.name, state: "uploading" }]);
      const set = (patch: Partial<Attachment>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
      try {
        const text = await fileText(f);
        const r = await call<{ id: string }>("files", { name: f.name, text, collection: null });
        set({ id: r.id, state: "ready" });
      } catch (e) {
        set({ state: "failed", error: e instanceof Error ? e.message : "could not read" });
      }
    }
  }

  return {
    items, busy, add,
    remove: (key: string) => setItems((xs) => xs.filter((x) => x.key !== key)),
    clear: () => setItems([]),
  };
}

/** The paperclip button with its hidden file input. */
export function AttachButton({ onFiles, disabled, small }: { onFiles: (f: FileList | null) => void; disabled?: boolean; small?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => input.current?.click()} aria-label="Attach files" title="Attach files (PDF, TXT, Markdown)"
        className={cn("text-muted-foreground hover:text-fg hover:bg-hover flex shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50",
          small ? "size-6" : "size-7")}>
        <Paperclip className={small ? "size-3.5" : "size-4"} />
      </button>
      <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only"
        onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
    </>
  );
}

/** The attached files above the text box, each removable. */
export function AttachChips({ items, onRemove, className }: { items: Attachment[]; onRemove: (key: string) => void; className?: string }) {
  if (!items.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((a) => (
        <li key={a.key} title={a.error ?? a.name}
          className={cn("flex h-7 max-w-[14rem] items-center gap-1.5 rounded-lg border bg-white pr-1 pl-2 text-[12px]",
            a.state === "failed" && "border-[rgba(183,30,30,0.35)] text-bad")}>
          {a.state === "uploading" ? <Loader2 className="size-3.5 shrink-0 animate-spin" /> : <FileText className="size-3.5 shrink-0" />}
          {a.id ? <FileLink id={a.id} name={a.name} className="truncate" /> : <span className="truncate">{a.name}</span>}
          {a.state === "failed" && <span className="shrink-0 text-[11px]">failed</span>}
          <button type="button" onClick={() => onRemove(a.key)} aria-label={`Remove ${a.name}`}
            className="text-muted-foreground hover:text-fg hover:bg-hover rounded p-0.5"><X className="size-3" /></button>
        </li>
      ))}
    </ul>
  );
}

/** Files attached to a message already sent, shown under the bubble; each opens its preview. */
export function SentFiles({ files, className }: { files: SentFile[]; className?: string }) {
  if (!files.length) return null;
  return (
    <ul className={cn("flex flex-wrap justify-end gap-1.5", className)}>
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="text-muted-foreground hover:text-fg flex h-6 max-w-[14rem] items-center gap-1 rounded-md border bg-white px-2 text-[11.5px]">
          <FileText className="size-3 shrink-0" />
          {f.id ? <FileLink id={f.id} name={f.name} className="truncate" /> : <span className="truncate">{f.name}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Props for a composer that accepts files dropped onto it. */
export function dropProps(onFiles: (f: FileList) => void, setOver: (v: boolean) => void) {
  return {
    onDragOver: (e: React.DragEvent) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); setOver(true); } },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); },
    onDrop: (e: React.DragEvent) => { if (e.dataTransfer.files.length) { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); } },
  };
}
