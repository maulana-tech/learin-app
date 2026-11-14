"use client";

import { Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { PageFull, PageReview } from "@/app/lib";
import { Dot } from "@/components/dort";
import { TextArea } from "@/components/field";
import { Markdown } from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";
import { ClaimCheck, ExportWord } from "@/components/academic";

export function PageEditor({ page, startEditing }: { page: PageFull; startEditing: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(startEditing);
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [review, setReview] = useState<PageReview | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function save() {
    setBusy("Saving…");
    setError("");
    try {
      await call(`pages/${page.id}`, { title, content });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {editing ? (
          <>
            <Button onClick={save} disabled={!!busy}>{busy || "Save"}</Button>
            <Button variant="ghost" onClick={() => { setEditing(false); setTitle(page.title); setContent(page.content); }}>Cancel</Button>
          </>
        ) : (
          <>
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil className="size-4" /> Edit</Button>
            <Button variant="outline" onClick={async () => setReview(await call<PageReview>(`pages/${page.id}/review`))}>
              <ShieldCheck className="size-4" /> Review sources
            </Button>
            <ClaimCheck pageId={page.id} />
            <ExportWord pageId={page.id} title={page.title} />
            <Button variant="ghost" size="icon" aria-label="Delete page" onClick={async () => {
              if (!confirm(`Delete "${page.title}"?`)) return;
              await call(`pages/${page.id}/delete`, {});
              router.push("/pages");
              router.refresh();
            }}><Trash2 className="size-4" /></Button>
          </>
        )}
      </div>
      {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}

      {review && (
        <div className="bg-inner-grad rounded-lg border p-3 text-[13px]">
          <p className="flex items-center gap-2 font-medium"><Dot tone={review.ok ? "ok" : "warn"} />
            {review.ok ? "Every claim points to a real source." : "Some claims cannot be checked."}</p>
          <ul className="text-muted-foreground mt-1.5 space-y-1 text-[12.5px]">
            {review.missing_sources.length > 0 && <li>References to sources that do not exist: {review.missing_sources.map((n) => `[${n}]`).join(" ")}</li>}
            {review.stale_sources.length > 0 && <li>Sources whose quote is no longer in the file: {review.stale_sources.map((n) => `[${n}]`).join(" ")}</li>}
            {review.unused_sources.length > 0 && <li>Sources never referred to: {review.unused_sources.map((n) => `[${n}]`).join(" ")}</li>}
            {review.uncited_paragraphs.map((p) => <li key={p}>No source: &ldquo;{p}…&rdquo;</li>)}
          </ul>
        </div>
      )}

      {editing ? (
        <div className="space-y-3">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="text-lg" />
          <TextArea rows={18} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-[13px]"
            placeholder="Markdown. Cite a source as [1]." />
        </div>
      ) : (
        <article className="bg-card-grad rounded-lg border px-5 py-5 text-[14.5px] leading-relaxed shadow-soft md:px-8 md:py-7">
          {page.content ? <Markdown>{page.content}</Markdown> : <p className="text-muted-foreground">Empty page.</p>}
        </article>
      )}
    </div>
  );
}
