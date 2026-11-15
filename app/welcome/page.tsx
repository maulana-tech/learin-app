import type { Metadata } from "next";
import { Geist, Newsreader } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import {
  BookOpenText, CalendarClock, ClipboardList, FileCode2, FileText, FlaskConical, GraduationCap,
  KeyRound, Link2, Presentation, ScrollText, ShieldCheck, Trash2,
} from "lucide-react";

import { LearisMark } from "@/components/learis-mark";
import { ClaimDemo, Reveal, Steps } from "./bits";
import { CountUp, Drift, HeroStage, SmoothScroll, Words } from "./motion";
import "lenis/dist/lenis.css";
import "./welcome.css";

/* The public front door. Signed-in people go straight to the app; everyone else lands here.
 * Visual language: an editorial, printed page (serif display, dashed column rules, mono labels),
 * one woven green block for the proof, a dark band for the steps. Every product image is a real
 * screenshot of LEARIS (public/landing). */

const serif = Newsreader({ subsets: ["latin"], variable: "--font-lw-serif", style: ["normal", "italic"], weight: ["400", "500"] });
const sans = Geist({ subsets: ["latin"], variable: "--font-lw-sans" });

export const metadata: Metadata = {
  title: { absolute: "LEARIS: study notes that show their sources" },
  alternates: { canonical: "/" },
  description: "Upload a semester and ask once. AI agents write summaries, papers and deadlines, and every claim quotes the file it came from.",
  openGraph: {
    title: "LEARIS: study notes that show their sources",
    description: "Upload a semester and ask once. Every claim quotes the file it came from.",
    images: [{ url: "/landing/og.webp", width: 1200, height: 630 }],
  },
};

const START = "/login?mode=up";

const INPUTS = [
  { icon: ScrollText, label: "Syllabi" },
  { icon: Presentation, label: "Lecture slides" },
  { icon: ClipboardList, label: "Assignment briefs" },
  { icon: FlaskConical, label: "Lab modules" },
  { icon: BookOpenText, label: "Readings (PDF)" },
  { icon: FileCode2, label: "GitHub repos" },
  { icon: FileText, label: "Your own notes" },
  { icon: CalendarClock, label: "Course schedules" },
];

const PACK = [
  { name: "Tutor", body: "Asks what you already know, then teaches one step at a time from your own files." },
  { name: "Practice Coach", body: "Problems that make you recall which idea applies. Hints, not answers." },
  { name: "Review Panel", body: "A methods reviewer, a devil's advocate and an editor's decision on your draft." },
  { name: "Report Formatter", body: "Lab report, essay or journal paper, exported to Word in your campus format." },
];

export default function Welcome() {
  return (
    <div className={`lw lw-grain relative w-full flex-1 overflow-x-clip ${serif.variable} ${sans.variable}`}>
      <SmoothScroll />
      <Drift />
      {/* ------------------------------------------------------------ nav */}
      <header className="sticky top-3 z-30 mx-auto mt-3 w-full max-w-[1296px] px-4 md:px-6">
        <nav className="flex h-14 items-center justify-between border border-[var(--lw-line)] bg-[var(--lw-paper)]/90 pr-2 pl-4 backdrop-blur-md">
          <Link href="/" className="flex items-center gap-2" aria-label="LEARIS home">
            <LearisMark className="size-6 text-[var(--lw-ink)]" />
            <span className="lw-serif text-[24px] leading-none">learis</span>
          </Link>
          <div className="hidden items-center gap-7 text-[14px] text-[var(--lw-ink-2)] md:flex">
            <a href="#how" className="hover:text-[var(--lw-ink)]">How it works</a>
            <a href="#proof" className="hover:text-[var(--lw-ink)]">Proof</a>
            <a href="#share" className="hover:text-[var(--lw-ink)]">Sharing</a>
            <a href="#privacy" className="hover:text-[var(--lw-ink)]">Privacy</a>
            <Link href="/login" className="hover:text-[var(--lw-ink)]">Sign in</Link>
          </div>
          <Link href={START} className="lw-btn lw-serif bg-[var(--lw-ink)] px-5 py-2.5 text-[15px] text-white hover:bg-black">Start free</Link>
        </nav>
      </header>

      <main className="relative z-10">
        {/* ----------------------------------------------------------- hero */}
        <section className="lw-frame mx-auto max-w-[1296px] px-4 pt-20 md:min-h-[100dvh] md:px-6 md:pt-24">
          <div data-hero-copy className="mx-auto max-w-[920px] text-center">
            <h1 className="lw-serif lw-rise text-[46px] leading-[1.02] sm:text-[64px] lg:text-[84px]">
              Every sentence, with the line that proves it.
            </h1>
            <p className="lw-rise-2 mx-auto mt-6 max-w-[560px] text-[17px] leading-relaxed text-[var(--lw-ink-2)]">
              Upload a semester and ask once. AI agents write your summaries, papers and deadlines, and every claim quotes its file.
            </p>
            <div className="lw-rise-3 mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href={START} className="lw-btn lw-serif bg-[var(--lw-ink)] px-10 py-4 text-[18px] text-white hover:bg-black">Start free</Link>
              <a href="#how" className="lw-btn px-5 py-4 text-[15px] text-[var(--lw-ink-2)] underline-offset-4 hover:text-[var(--lw-ink)] hover:underline">See how it works</a>
            </div>
          </div>

          {/* real screens lying back like papers on a desk; scrolling stands them up (motion.tsx) */}
          <HeroStage />
          <div className="h-16 md:h-24" />
        </section>

        {/* ----------------------------------------------------- the numbers */}
        <section aria-label="What LEARIS enforces" className="relative">
          <div className="lw-rule mx-auto grid max-w-[1296px] grid-cols-1 px-4 md:grid-cols-[1fr_1fr_1fr] md:px-6">
            <p className="lw-mono py-4 text-[11px] leading-relaxed tracking-[0.08em] text-[var(--lw-ink-3)] uppercase md:border-r md:border-dashed md:border-[var(--lw-line)]">
              Read, quoted, checked, shared
            </p>
          </div>
          <div data-drift="stripe" className="lw-stripe" />
          <div className="mx-auto grid max-w-[1296px] grid-cols-1 px-4 md:grid-cols-3 md:px-6">
            {[
              ["400", "characters, the longest a quote may be. A source proves one sentence, never a whole file."],
              ["0", "deadlines guessed. A task gets a date only when a file states it."],
              ["14", "campus and journal formats for the Word export, from a lab report to a journal paper."],
            ].map(([n, t], k) => (
              <Reveal key={n} className={`py-10 md:px-8 md:py-14 ${k ? "md:border-l md:border-dashed md:border-[var(--lw-line)]" : "md:pl-0"}`}>
                <p className="lw-serif text-[76px] leading-none tabular-nums md:text-[96px]"><CountUp value={Number(n)} /></p>
                <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-[var(--lw-ink-2)]">{t}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------ the problem */}
        <section className="lw-rule">
          <div className="lw-frame mx-auto grid max-w-[1296px] gap-10 px-4 py-20 md:grid-cols-2 md:gap-16 md:px-12 md:py-28">
            <Reveal>
              <h2 className="lw-serif text-[40px] leading-[1.05] md:text-[54px]"><Words text="Students don't need more answers. They need ones they can check." /></h2>
            </Reveal>
            <Reveal className="space-y-5 text-[16.5px] leading-relaxed text-[var(--lw-ink-2)] md:pt-3">
              <p>A chatbot summary sounds sure of itself, and nobody can tell which sentence the lecture notes actually support. A citation is often decoration: a source is attached, but it doesn&apos;t say what the sentence claims.</p>
              <p>Meanwhile the deadlines sit inside PDFs no one re-reads, and the last mile of every report is formatting margins at midnight.</p>
              <p className="text-[var(--lw-ink)]">LEARIS reads the files you already have, and won&apos;t write anything it can&apos;t quote.</p>
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------- what goes in */}
        <section aria-label="What you can upload" className="lw-guilloche lw-rule">
          <div className="lw-frame mx-auto max-w-[1296px] px-4 py-16 md:px-16 md:py-20">
            <p className="lw-mono text-[13px] tracking-[0.12em] uppercase">Everything your course already gave you</p>
            <ul className="mt-6 grid grid-cols-1 border-t border-l border-dashed border-[var(--lw-line)] sm:grid-cols-2">
              {INPUTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-4 border-r border-b border-dashed border-[var(--lw-line)] bg-[var(--lw-paper)]/85 px-5 py-5">
                  <Icon className="size-5 shrink-0" strokeWidth={1.5} />
                  <span className="lw-mono text-[15px] tracking-[0.06em] uppercase">{label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* -------------------------------------------- the proof (green) */}
        <section id="proof" data-drift="cloth" className="lw-cloth relative scroll-mt-24 text-white">
          <div aria-hidden className="h-24 bg-[var(--lw-paper)] [clip-path:polygon(0_0,100%_0,90%_100%,10%_100%)] md:h-32" />
          <div className="mx-auto max-w-[1296px] px-4 pt-14 pb-24 md:px-6 md:pt-20 md:pb-32">
            <Reveal className="max-w-[760px]">
              <h2 className="lw-serif text-[40px] leading-[1.05] md:text-[60px]"><Words text="A citation is a promise. We check it twice." /></h2>
              <p className="mt-5 max-w-[56ch] text-[16.5px] leading-relaxed text-white/75">
                First, the quote must appear in the file, word for word, or the page isn&apos;t saved. Then the Claim Auditor reads the meaning: does this quote actually support this sentence?
              </p>
            </Reveal>
            <Reveal className="mt-12">
              <ClaimDemo />
            </Reveal>
            <div className="mt-14 grid gap-10 md:grid-cols-2">
              <Reveal>
                <h3 className="lw-serif flex items-center gap-2.5 text-[24px]"><ShieldCheck className="size-5" strokeWidth={1.5} />Tools check, not the model&apos;s word</h3>
                <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-white/70">Quotes that aren&apos;t in the file, quotes longer than a passage, dates the file doesn&apos;t state: refused by the tool, whatever the model says.</p>
              </Reveal>
              <Reveal>
                <h3 className="lw-serif flex items-center gap-2.5 text-[24px]"><GraduationCap className="size-5" strokeWidth={1.5} />Weak claims get rewritten, not hidden</h3>
                <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-white/70">The auditor narrows a sentence to what its quote proves. It never strengthens one, and never just deletes the number.</p>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------- steps (dark) */}
        <section id="how" className="scroll-mt-24 bg-[#121211] text-white">
          <div className="mx-auto max-w-[1296px] px-4 py-24 md:px-6 md:py-32">
            <Reveal>
              <h2 className="lw-serif max-w-[16ch] text-[40px] leading-[1.05] md:text-[60px]"><Words text="Four steps. One of them is typing a sentence." /></h2>
            </Reveal>
            <div className="mt-14"><Steps /></div>
          </div>
        </section>

        {/* ------------------------------------------------- the agent pack */}
        <section aria-label="The Academic pack" className="lw-rule">
          <div className="lw-frame mx-auto max-w-[1296px] px-4 py-20 md:px-6 md:py-28">
            <Reveal className="max-w-[720px]">
              <h2 className="lw-serif text-[40px] leading-[1.05] md:text-[54px]"><Words text="A study group of agents, on your files." /></h2>
              <p className="mt-5 max-w-[56ch] text-[16.5px] leading-relaxed text-[var(--lw-ink-2)]">A Reader, a Writer, a Planner and a Reviewer by default. Add the Academic pack, build your own, or install one a classmate shared.</p>
            </Reveal>
            <div className="mt-12 grid gap-px border border-[var(--lw-line)] bg-[var(--lw-line)] lg:grid-cols-3 lg:grid-rows-2">
              <Reveal className="relative overflow-hidden bg-[var(--lw-paper-2)] p-3 lg:col-span-2 lg:row-span-2">
                <Image src="/landing/agents.webp" alt="The Agents page in LEARIS: built-in agents and the Academic pack"
                  width={2880} height={1800} sizes="(min-width: 1024px) 860px, 100vw" className="h-full w-full rounded-[4px] border border-[var(--lw-line)] object-cover object-right-top" />
              </Reveal>
              <Reveal className="lw-cloth flex flex-col justify-end p-7 text-white">
                <p className="lw-serif text-[26px] leading-tight">Claim Auditor</p>
                <p className="mt-2 text-[14.5px] leading-relaxed text-white/75">Reads every source on a page and fixes the claims that say more than their quote.</p>
              </Reveal>
              <Reveal className="flex flex-col justify-end bg-[var(--lw-paper)] p-7">
                <ul className="space-y-5">
                  {PACK.map((a) => (
                    <li key={a.name}>
                      <p className="lw-serif text-[20px]">{a.name}</p>
                      <p className="mt-1 text-[14px] leading-relaxed text-[var(--lw-ink-2)]">{a.body}</p>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- sharing */}
        <section id="share" className="lw-rule scroll-mt-24 bg-[var(--lw-paper-2)]">
          <div className="lw-frame mx-auto grid max-w-[1296px] items-center gap-12 px-4 py-20 md:px-12 md:py-28 lg:grid-cols-[1fr_1.1fr]">
            <Reveal>
              <h2 className="lw-serif text-[40px] leading-[1.05] md:text-[54px]"><Words text="Made to be passed along the class group." /></h2>
              <p className="mt-5 max-w-[50ch] text-[16.5px] leading-relaxed text-[var(--lw-ink-2)]">
                Press Share on any page. Your friend opens it without an account, sees every quote, and can make their own from their files. You see how many opened it and joined.
              </p>
              <ol className="mt-9 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-2">
                {[["Make", "a page from your files"], ["Share", "one link, any chat app"], ["Read", "no account, quotes shown"], ["Join", "and make their own"]].map(([h, t]) => (
                  <li key={h} className="border-t border-[var(--lw-ink)] pt-3">
                    <p className="lw-serif text-[21px]">{h}</p>
                    <p className="mt-1 text-[13.5px] text-[var(--lw-ink-3)]">{t}</p>
                  </li>
                ))}
              </ol>
            </Reveal>
            <Reveal className="relative">
              <Image src="/landing/shared.webp" alt="A shared LEARIS page opened without an account, with its sources and a sign-up invitation"
                width={2880} height={1800} sizes="(min-width: 1024px) 640px, 100vw" className="h-auto w-full rounded-[6px] border border-[var(--lw-line)] shadow-[0_24px_60px_-24px_rgba(20,40,30,0.35)]" />
              <Image data-drift="float" src="/landing/og.webp" alt="The preview card a chat app shows for a shared page"
                width={1200} height={630} sizes="320px" className="absolute -bottom-8 -left-4 hidden w-[52%] rounded-[6px] border border-white/20 shadow-[0_24px_50px_-18px_rgba(10,20,15,0.55)] sm:block md:-left-10" />
            </Reveal>
          </div>
        </section>

        {/* ------------------------------------------------------- privacy */}
        <section id="privacy" className="lw-rule scroll-mt-24">
          <div className="lw-frame mx-auto max-w-[1296px] px-4 py-20 md:px-12 md:py-24">
            <Reveal>
              <h2 className="lw-serif max-w-[20ch] text-[36px] leading-[1.05] md:text-[48px]"><Words text="Your files are yours. So is your AI key." /></h2>
            </Reveal>
            <div className="mt-12 grid gap-10 md:grid-cols-3">
              {[
                { icon: KeyRound, h: "Bring your own model", t: "Your key stays in your browser and travels only with your request. Or use a free local model." },
                { icon: Link2, h: "Links show quotes, not files", t: "A shared page shows its text, the quotes it cites and file names. Never a whole file or your email." },
                { icon: Trash2, h: "Gone in one click", t: "Delete your account and everything goes with it: files, pages, chats and every link you shared." },
              ].map(({ icon: Icon, h, t }) => (
                <Reveal key={h} className="border-t border-[var(--lw-ink)] pt-5">
                  <Icon className="size-5" strokeWidth={1.5} />
                  <p className="lw-serif mt-4 text-[22px]">{h}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-[var(--lw-ink-2)]">{t}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- CTA */}
        <section className="lw-rule lw-guilloche">
          <div className="lw-frame mx-auto max-w-[1296px] px-4 py-20 md:px-6 md:py-28">
            <Reveal className="mx-auto max-w-[820px] border border-[var(--lw-line)] bg-[var(--lw-paper)] px-6 py-14 text-center shadow-[0_30px_80px_-40px_rgba(20,40,30,0.4)] md:px-16 md:py-20">
              <h2 className="lw-serif text-[40px] leading-[1.05] md:text-[58px]"><Words text="Bring this semester's files." /></h2>
              <p className="mx-auto mt-4 max-w-[44ch] text-[16px] leading-relaxed text-[var(--lw-ink-2)]">Free. Agents answer in your language, on your phone, with voice.</p>
              <Link href={START} className="lw-btn lw-serif mt-9 inline-block bg-[var(--lw-ink)] px-10 py-4 text-[18px] text-white hover:bg-black">Start free</Link>
            </Reveal>
          </div>
        </section>
      </main>

      {/* ---------------------------------------------------------- footer */}
      <footer className="relative z-10 overflow-hidden bg-[#121211] text-white">
        <div className="mx-auto grid max-w-[1296px] gap-10 px-4 pt-16 md:grid-cols-4 md:px-6">
          {[
            ["Product", [["How it works", "#how"], ["Proof", "#proof"], ["Sharing", "#share"]]],
            ["Use it", [["Start free", START], ["Sign in", "/login"]]],
            ["Trust", [["Privacy", "#privacy"], ["Source code", "https://github.com/maulana-tech/learin-app"]]],
            ["Made for", [["HackOnVibe 2026", "https://hackonvibe.com"]]],
          ].map(([h, links]) => (
            <div key={h as string}>
              <p className="lw-serif text-[18px]">{h as string}</p>
              <ul className="lw-mono mt-4 space-y-2 text-[12px] tracking-[0.08em] text-white/60 uppercase">
                {(links as string[][]).map(([l, href]) => (
                  <li key={l}><a href={href} className="hover:text-white">{l}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p aria-hidden data-drift="rise" className="lw-serif mt-10 -mb-[0.22em] text-center text-[34vw] leading-[0.8] tracking-[-0.05em] text-white/[0.08] select-none">learis</p>
      </footer>
    </div>
  );
}
