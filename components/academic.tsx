"use client";

import { CheckCircle2, CircleAlert, CircleX, FileDown, Loader2, ScanSearch } from "lucide-react";
import { useEffect, useState } from "react";

import { Dot } from "@/components/dort";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { call } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

/* The Academic pack on a page: check that each source supports its sentence, and export the
 * page to Word in a campus format (presets from laporan-generator, MIT). */

type Verdict = "supported" | "partial" | "unsupported";
type Claim = { i: number; sentence: string; sources: number[]; verdict: Verdict; reason: string; method: "ai" | "rule" };
type Audit = { method: "ai" | "rule"; model: string | null; claims: Claim[]; counts: Record<Verdict, number>; ok: boolean };

const V: Record<Verdict, { label: string; icon: React.ElementType; cls: string }> = {
  supported: { label: "Didukung", icon: CheckCircle2, cls: "text-ok" },
  partial: { label: "Sebagian", icon: CircleAlert, cls: "text-warn" },
  unsupported: { label: "Tidak didukung", icon: CircleX, cls: "text-bad" },
};

export function ClaimCheck({ pageId }: { pageId: string }) {
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<Audit | null>(null);
  const [error, setError] = useState("");
  const [onlyWeak, setOnlyWeak] = useState(true);

  async function run() {
    setBusy(true); setError("");
    try { setA(await call<Audit>(`pages/${pageId}/audit`, {}, { ai: true })); }
    catch (e) { setError(e instanceof Error ? e.message : "could not check"); }
    finally { setBusy(false); }
  }

  const shown = a ? a.claims.filter((c) => !onlyWeak || c.verdict !== "supported") : [];
  return (
    <>
      <Button variant="outline" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ScanSearch className="size-4" />} {busy ? "Checking claims…" : "Check claims"}
      </Button>
      {(a || error) && (
        <div className="bg-card-grad order-last w-full rounded-xl border p-4 shadow-soft">
          {error ? <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p> : a && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2 text-[13.5px] font-medium">
                  <Dot tone={a.ok ? "ok" : "warn"} />
                  {a.claims.length === 0 ? "No cited sentences to check." : a.ok ? "Every cited sentence is supported by its source."
                    : `${a.counts.partial + a.counts.unsupported} of ${a.claims.length} cited sentences say more than their source.`}
                </p>
                <div className="flex items-center gap-1.5 text-[12px]">
                  {(Object.keys(V) as Verdict[]).map((k) => (
                    <span key={k} className={cn("flex items-center gap-1 rounded-full border bg-white px-2 py-0.5", V[k].cls)}>
                      {(() => { const I = V[k].icon; return <I className="size-3" />; })()}<span className="font-mono">{a.counts[k]}</span>
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-muted-foreground mt-1 text-[11.5px]">
                {a.method === "ai" ? <>Judged by <span className="font-mono">{a.model}</span> against each quote only.</>
                  : "No model available: a plain check that the quote holds the sentence's words and numbers."}
                {a.claims.some((c) => c.verdict === "supported") && (
                  <button type="button" onClick={() => setOnlyWeak(!onlyWeak)} className="hover:text-fg ml-2 underline underline-offset-2">
                    {onlyWeak ? "show all" : "show only weak"}
                  </button>
                )}
              </p>
              {shown.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {shown.map((c) => {
                    const v = V[c.verdict];
                    return (
                      <li key={c.i} className="flex gap-2.5 rounded-lg border bg-white p-2.5">
                        <v.icon className={cn("mt-0.5 size-4 shrink-0", v.cls)} />
                        <div className="min-w-0 text-[12.5px] leading-relaxed">
                          <p>{c.sentence} <span className="text-muted-foreground font-mono">{c.sources.map((n) => `[${n}]`).join("")}</span></p>
                          <p className={cn("mt-0.5 text-[11.5px]", v.cls)}>{v.label} · <span className="text-muted-foreground">{c.reason}</span></p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {!a.ok && a.claims.length > 0 && (
                <p className="text-muted-foreground mt-3 text-[11.5px]">Ask the Claim Auditor agent to fix these: it finds a quote that does support the sentence, or tones the sentence down.</p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}

type Formats = {
  presets: { id: string; name: string; margins_cm: Record<string, number>; cover_lecturer: boolean }[];
  kinds: { id: string; label: string; sections: string[] }[];
};
const COVER = [
  ["author", "Nama"], ["nim", "NIM"], ["course", "Mata kuliah"], ["lecturer", "Dosen pengampu"],
  ["program", "Program studi"], ["faculty", "Fakultas"], ["university", "Universitas"], ["city", "Kota"], ["year", "Tahun"],
] as const;
const KEY = "learis.export";

function loadSaved(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}

export function ExportWord({ pageId, title }: { pageId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [formats, setFormats] = useState<Formats | null>(null);
  const [v, setV] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || formats) return;
    call<Formats>("report-formats").then(setFormats).catch((e) => setError(e instanceof Error ? e.message : "could not load formats"));
  }, [open, formats]);

  const set = (k: string, val: string) => setV((x) => ({ ...x, [k]: val }));
  const preset = formats?.presets.find((p) => p.id === (v.preset || "standard"));

  async function download() {
    setBusy(true); setError("");
    try {
      try { localStorage.setItem(KEY, JSON.stringify({ ...v, title: undefined })); } catch { /* private window */ }
      const q = new URLSearchParams(Object.entries({ preset: "standard", kind: "praktikum", ...v, title: v.title || title })
        .filter(([, x]) => x) as [string, string][]);
      const r = await fetch(`/api/learis/pages/${pageId}/export?${q}`);
      if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? `HTTP ${r.status}`);
      const blob = await r.blob();
      const name = /filename="([^"]+)"/.exec(r.headers.get("content-disposition") || "")?.[1] || "laporan.docx";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : "export failed"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Button variant="outline" onClick={() => { setV({ ...loadSaved() }); setOpen(true); }}><FileDown className="size-4" /> Export → Word</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card-grad max-w-xl rounded-2xl p-0 shadow-float">
          <DialogHeader className="border-b">
            <DialogTitle className="flex items-center gap-2"><FileDown className="size-4" /> Export to Word</DialogTitle>
            <DialogDescription className="text-[12.5px]">A .docx with a cover, chapter headings, page numbers and the page&apos;s sources as Daftar Pustaka.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5"><span className="text-text text-[12.5px]">Jenis laporan</span>
                <Select value={v.kind || "praktikum"} onValueChange={(x) => set("kind", x)} ariaLabel="Report type"
                  options={(formats?.kinds ?? [{ id: "praktikum", label: "Laporan praktikum", sections: [] }]).map((k) => ({ value: k.id, label: k.label, hint: k.sections.slice(0, 3).join(", ") + (k.sections.length > 3 ? "…" : "") }))} />
              </label>
              <label className="space-y-1.5"><span className="text-text text-[12.5px]">Format kampus</span>
                <Select value={v.preset || "standard"} onValueChange={(x) => set("preset", x)} ariaLabel="Campus format"
                  options={(formats?.presets ?? [{ id: "standard", name: "Standar Modern", margins_cm: {}, cover_lecturer: true }]).map((p) => ({
                    value: p.id, label: p.name, hint: p.margins_cm.top ? `${p.margins_cm.top}-${p.margins_cm.bottom}-${p.margins_cm.left}-${p.margins_cm.right} cm` : undefined }))} />
              </label>
            </div>
            <label className="block space-y-1.5"><span className="text-text text-[12.5px]">Judul</span>
              <Input value={v.title ?? ""} placeholder={title} onChange={(e) => set("title", e.target.value)} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {COVER.filter(([k]) => k !== "lecturer" || preset?.cover_lecturer !== false).map(([k, label]) => (
                <label key={k} className="space-y-1.5"><span className="text-text text-[12.5px]">{label}</span>
                  <Input value={v[k] ?? ""} onChange={(e) => set(k, e.target.value)} placeholder={k === "year" ? String(new Date().getFullYear()) : ""} />
                </label>
              ))}
            </div>
            <p className="text-muted-foreground text-[11.5px] leading-relaxed">
              Times New Roman 12 pt, spasi 1,5, A4{preset?.margins_cm.top ? `, margin ${preset.margins_cm.top}-${preset.margins_cm.bottom}-${preset.margins_cm.left}-${preset.margins_cm.right} cm` : ""}.
              Campus presets are starting points from laporan-generator: check your faculty&apos;s latest guide. Your cover details stay in this browser.
            </p>
            {error && <p className="text-bad flex items-center gap-2 text-[12.5px]"><Dot tone="bad" />{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t px-5 py-3.5">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={download} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} Download .docx</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
