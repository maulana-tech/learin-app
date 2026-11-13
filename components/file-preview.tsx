"use client";

import { ExternalLink, FileText, Loader2, Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { FileIcon, kb } from "@/components/bits";
import { Markdown } from "@/components/markdown";
import { Segmented } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { call } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

/* Open a file and read what the agents read: its text (for a PDF, the text taken from it in the
 * browser), the quote a page cites highlighted, a find box, and the pages that cite it. */

type Preview = {
  id: string; name: string; collection: string | null; chars: number; source_url: string | null;
  uploaded_at: string; uploader: string | null; text: string;
  cited_by: { page_id: string; title: string; quotes: { n: number; quote: string }[] }[];
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A quote matched across any whitespace, as the source check does. */
const pattern = (q: string) => new RegExp(q.trim().split(/\s+/).map(escapeRe).join("\\s+"), "gi");

function ranges(text: string, q: string, all: boolean): [number, number][] {
  if (!q.trim()) return [];
  const out: [number, number][] = [];
  const re = pattern(q);
  for (let m = re.exec(text); m; m = re.exec(text)) {
    out.push([m.index, m.index + m[0].length]);
    if (!all || out.length > 500) break;
    if (m[0].length === 0) re.lastIndex++;
  }
  return out;
}

function Highlighted({ text, marks, current }: { text: string; marks: [number, number][]; current: number }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  marks.forEach(([a, b], i) => {
    if (a > at) parts.push(text.slice(at, a));
    parts.push(<mark key={i} data-mark={i} className={cn("rounded-sm px-0.5 text-fg", i === current ? "bg-[#ffd666] ring-2 ring-[#111]" : "bg-[#fff1b8]")}>{text.slice(a, b)}</mark>);
    at = b;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

export function FilePreview({ fileId, highlight, open, onOpenChange }: {
  fileId: string | null; highlight?: string; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const [data, setData] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [find, setFind] = useState("");
  const [view, setView] = useState<"plain" | "formatted">("plain");
  const [current, setCurrent] = useState(0);
  const body = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !fileId) return;
    let stop = false;
    call<Preview>(`files/${fileId}`).then((d) => {
      if (stop) return;
      setData(d); setError(""); setFind(""); setCurrent(0);
      setView(!highlight && /\.(md|markdown)$/i.test(d.name) ? "formatted" : "plain");
    }).catch((e) => { if (!stop) setError(e instanceof Error ? e.message : "could not open the file"); });
    return () => { stop = true; };
  }, [open, fileId, highlight]);

  const q = find || highlight || "";
  const marks = useMemo(() => (data && view === "plain" ? ranges(data.text, q, !!find) : []), [data, q, find, view]);

  useEffect(() => {
    if (!marks.length) return;
    const t = setTimeout(() => body.current?.querySelector(`[data-mark="${current}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 60);
    return () => clearTimeout(t);
  }, [marks, current]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="bg-card-grad flex w-full flex-col gap-0 p-0 sm:max-w-2xl [&>button]:hidden">
        <div className="flex items-start gap-3 border-b p-4">
          {data ? <FileIcon name={data.name} url={data.source_url} /> : <span className="bg-raised size-9 rounded-lg" />}
          <div className="min-w-0 flex-1">
            <SheetTitle className="truncate text-[15px] font-medium">{data?.name ?? "Opening…"}</SheetTitle>
            {data && (
              <p className="text-muted-foreground mt-0.5 truncate text-[11.5px]">
                {data.collection ?? "no course"} · {kb(data.chars)} · {data.uploader ?? "someone"}
                {/\.pdf$/i.test(data.name) && " · text read from the PDF"}
              </p>
            )}
          </div>
          {data?.source_url && (
            <a href={data.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-fg hover:bg-hover rounded-md p-1.5" aria-label="Open the original"><ExternalLink className="size-4" /></a>
          )}
          <button type="button" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-fg hover:bg-hover rounded-md p-1.5" aria-label="Close"><X className="size-4" /></button>
        </div>

        {data && (
          <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5">
            <div className="relative min-w-0 flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input value={find} onChange={(e) => { setFind(e.target.value); setCurrent(0); setView("plain"); }}
                onKeyDown={(e) => { if (e.key === "Enter" && marks.length) setCurrent((c) => (c + (e.shiftKey ? marks.length - 1 : 1)) % marks.length); }}
                placeholder="Find in file" className="h-8 pl-8 text-[13px]" />
            </div>
            {find && <span className="text-muted-foreground font-mono text-[11.5px]">{marks.length ? `${current + 1}/${marks.length}` : "0"}</span>}
            <Segmented size="sm" ariaLabel="View" value={view} onValueChange={(v) => setView(v as "plain" | "formatted")}
              items={[{ value: "plain", label: "Text" }, { value: "formatted", label: "Formatted" }]} />
          </div>
        )}

        {highlight && data && view === "plain" && !find && (
          <p className={cn("border-b px-4 py-2 text-[12px]", marks.length ? "bg-[#fffbe6]" : "bg-[#fdecec] text-bad")}>
            {marks.length ? "The highlighted passage is the quote this page cites." : "The cited quote is no longer in this file: the source is stale."}
          </p>
        )}

        <div ref={body} className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {error ? <p className="text-bad text-[13px]">{error}</p> : !data ? (
            <p className="text-muted-foreground flex items-center gap-2 text-[13px]"><Loader2 className="size-4 animate-spin" /> Opening…</p>
          ) : view === "formatted" ? (
            <div className="text-[14px] leading-relaxed"><Markdown>{data.text}</Markdown></div>
          ) : (
            <pre className="text-text font-sans text-[13.5px] leading-relaxed break-words whitespace-pre-wrap"><Highlighted text={data.text} marks={marks} current={current} /></pre>
          )}
        </div>

        {data && data.cited_by.length > 0 && (
          <div className="max-h-48 shrink-0 overflow-y-auto border-t px-4 py-3">
            <p className="text-muted-foreground mb-1.5 text-[11.5px]">Cited by {data.cited_by.length} page(s)</p>
            <ul className="space-y-1.5">
              {data.cited_by.map((c) => (
                <li key={c.page_id} className="flex items-start gap-2 text-[12.5px]">
                  <FileText className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                  <div className="min-w-0">
                    <Link href={`/pages/${c.page_id}`} onClick={() => onOpenChange(false)} className="hover:underline">{c.title}</Link>
                    <span className="text-muted-foreground"> · </span>
                    {c.quotes.slice(0, 3).map((x) => (
                      <button key={x.n} type="button" onClick={() => { setFind(""); setView("plain"); setCurrent(0); setFind(x.quote); }}
                        className="text-muted-foreground hover:text-fg mr-1.5 font-mono text-[11px]" title={x.quote}>[{x.n}]</button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** A file name that opens the preview. */
export function FileLink({ id, name, highlight, className, children }: {
  id: string; name: string; highlight?: string; className?: string; children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={`Preview ${name}`}
        className={cn("min-w-0 text-left hover:underline focus-visible:underline focus-visible:outline-none", className)}>
        {children ?? name}
      </button>
      {open && <FilePreview fileId={id} highlight={highlight} open={open} onOpenChange={setOpen} />}
    </>
  );
}
