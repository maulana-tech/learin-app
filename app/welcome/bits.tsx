"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/* The landing page's moving parts. Each is small and does one job; everything else is static. */

/** Fades a block in the first time it enters the viewport (CSS does the motion, and skips it
 * under reduced motion). */
export function Reveal({ children, className = "", as: Tag = "div" }: {
  children: React.ReactNode; className?: string; as?: "div" | "section" | "li";
}) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.add("is-in"); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} className={`lw-reveal ${className}`}>{children}</Tag>;
}

/* ------------------------------------------------------------- claim demo */
type Claim = {
  n: number; text: string; file: string; quote: string;
  verdict: "supported" | "unsupported"; why: string; fixed?: string;
};
const CLAIMS: Claim[] = [
  { n: 1, text: "Normalisasi menyusun tabel agar tidak terjadi redundansi dan anomali data",
    file: "modul-normalisasi.md", quote: "Normalisasi adalah proses menyusun tabel agar tidak terjadi redundansi dan anomali data",
    verdict: "supported", why: "The quote says this, nearly word for word." },
  { n: 2, text: "Sistem perpustakaan kampus membutuhkan minimal enam entitas utama",
    file: "tugas-besar-basis-data.md", quote: "minimal 6 entitas: Anggota, Buku, Eksemplar, Peminjaman, Denda, Petugas",
    verdict: "supported", why: "Six entities, named in the assignment brief." },
  { n: 3, text: "Tabel dalam 3NF selalu membuat query lebih cepat",
    file: "modul-normalisasi.md", quote: "Tabel berada dalam 3NF jika sudah 2NF dan tidak ada ketergantungan transitif",
    verdict: "unsupported", why: "The quote defines 3NF. It says nothing about speed.",
    fixed: "Tabel dalam 3NF tidak memiliki ketergantungan transitif" },
];

export function ClaimDemo() {
  const [open, setOpen] = useState(1);
  const [fixed, setFixed] = useState(false);
  const c = CLAIMS.find((x) => x.n === open)!;
  const bad = c.verdict === "unsupported" && !fixed;
  return (
    <div className="grid gap-px overflow-hidden rounded-[6px] bg-white/15 md:grid-cols-[1.15fr_1fr]">
      <div className="bg-[#f3f3f1] p-6 text-[#161616] md:p-8">
        <p className="lw-mono text-[11px] tracking-[0.12em] text-[#77776f] uppercase">A page your agents wrote</p>
        <h3 className="lw-serif mt-3 text-[26px] leading-tight">Normalisasi Basis Data</h3>
        <p className="mt-4 text-[15.5px] leading-[1.8] text-[#2b2b29]">
          {CLAIMS.map((x) => {
            const text = x.n === 3 && fixed ? x.fixed! : x.text;
            const active = x.n === open;
            return (
              <span key={x.n}>
                <span className={active ? "bg-[#14432f]/10" : ""}>{text}</span>{" "}
                <button type="button" onClick={() => setOpen(x.n)} aria-pressed={active}
                  aria-label={`Show source ${x.n}`}
                  className={`lw-mono rounded-[3px] px-1 text-[12px] transition-colors ${active ? "bg-[#14432f] text-white" : "bg-[#161616]/8 text-[#161616] hover:bg-[#161616]/15"}`}>
                  [{x.n}]
                </button>
                {". "}
              </span>
            );
          })}
        </p>
        <p className="mt-5 text-[12.5px] text-[#77776f]">Click a number to open its source.</p>
      </div>
      <div className="flex flex-col bg-[#0f3424] p-6 text-white md:p-8">
        <p className="lw-mono text-[11px] tracking-[0.12em] text-white/55 uppercase">Source [{c.n}] · {c.file}</p>
        <blockquote className="lw-serif mt-4 border-l-2 border-[#8fd3a8] pl-4 text-[19px] leading-snug text-white/90">
          &ldquo;{c.quote}&rdquo;
        </blockquote>
        <div className="mt-auto pt-8">
          <p className="text-[13px] text-white/60">Checked word for word against the file: <span className="text-white">found</span></p>
          <p className="mt-2 text-[13px] text-white/60">
            Does the quote support the sentence?{" "}
            <span className={bad ? "text-[#ffb4a6]" : "text-[#8fd3a8]"}>{bad ? "No" : "Yes"}</span>
          </p>
          <p className="mt-1 text-[13px] text-white/80">{fixed && c.n === 3 ? "Rewritten to say only what the quote proves." : c.why}</p>
          {c.n === 3 && (
            <button type="button" onClick={() => setFixed((f) => !f)}
              className="lw-btn mt-5 rounded-[4px] bg-white px-4 py-2 text-[13px] font-medium text-[#14432f] hover:bg-white/90">
              {fixed ? "Show the original claim" : "Let the Claim Auditor fix it"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ steps */
const STEPS = [
  { name: "Upload", title: "Drop in the whole semester.", body: "PDFs, slides, syllabi and briefs, labelled by course. PDFs are read in your browser; only their text is sent.", img: "/landing/files.webp" },
  { name: "Ask", title: "Ask once, in your own words.", body: "The Orchestrator sends one agent per course in parallel. You watch every file they open and every tool they call.", img: "/landing/chat.webp" },
  { name: "Check", title: "Open any number to see the proof.", body: "Each [n] opens the file at the exact quote. A quote that is not in the file is refused before the page is saved.", img: "/landing/page.webp" },
  { name: "Share", title: "Send the page, not a screenshot.", body: "A public link anyone can read without an account, every quote visible. Your files stay private.", img: "/landing/shared.webp" },
];
const STEP_MS = 6500;

export function Steps() {
  const [i, setI] = useState(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    if (!auto || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => setI((x) => (x + 1) % STEPS.length), STEP_MS);
    return () => clearTimeout(t);
  }, [i, auto]);
  const s = STEPS[i];
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-14">
      <ol className="flex flex-col">
        {STEPS.map((x, k) => (
          <li key={x.name} className="border-t border-white/12 first:border-t-0">
            <button type="button" onClick={() => { setI(k); setAuto(false); }} aria-current={k === i}
              className="group w-full py-5 text-left">
              <span className={`lw-mono text-[11px] tracking-[0.14em] uppercase ${k === i ? "text-[#8fd3a8]" : "text-white/40"}`}>{x.name}</span>
              <span className={`lw-serif mt-1.5 block text-[22px] leading-snug transition-colors ${k === i ? "text-white" : "text-white/45 group-hover:text-white/75"}`}>{x.title}</span>
              {k === i && <span className="mt-2 block max-w-[46ch] text-[14px] leading-relaxed text-white/65">{x.body}</span>}
              <span className="mt-4 block h-px w-full bg-white/10">
                {k === i && (auto
                  ? <span key={i} className="lw-progress block h-px origin-left bg-[#8fd3a8]" style={{ ["--lw-step" as string]: `${STEP_MS}ms` }} />
                  : <span className="block h-px bg-[#8fd3a8]" />)}
              </span>
            </button>
          </li>
        ))}
      </ol>
      <div className="relative overflow-hidden rounded-[6px] border border-white/12 bg-[#1c1c1b] p-2">
        {STEPS.map((x, k) => (
          <Image key={x.name} src={x.img} alt={`LEARIS: ${x.title}`} width={2880} height={1800} sizes="(min-width: 1024px) 60vw, 100vw"
            className={`h-auto w-full rounded-[4px] transition-opacity duration-500 ${k === i ? "relative opacity-100" : "absolute inset-2 opacity-0"}`}
            style={k === i ? undefined : { width: "calc(100% - 1rem)" }} />
        ))}
        <span className="sr-only" aria-live="polite">{s.title}</span>
      </div>
    </div>
  );
}
