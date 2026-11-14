import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { publicLink, when, type PublicPage } from "@/app/lib";
import { LearisMark } from "@/components/learis-mark";
import { Markdown } from "@/components/markdown";

/* A page someone shared. Outside the app shell: no account needed to read it. Every claim's
 * quote is shown, so the link itself demonstrates what LEARIS does, and ends with the way in. */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await publicLink<PublicPage>("page", (await params).token, false);
  if (!p) return { title: "Link turned off" };
  const description = `${p.checks.sources} source quote(s), every claim checked against the course files. Shared by ${p.shared_by} on LEARIS.`;
  return { title: p.title, description, openGraph: { title: p.title, description, type: "article" },
    twitter: { card: "summary_large_image", title: p.title, description } };
}

export default async function SharedPage({ params }: Props) {
  const { token } = await params;
  const p = await publicLink<PublicPage>("page", token);
  if (!p) notFound();
  const join = `/login?mode=up&ref=${token}`;
  // A paper's text often starts with its own title as a heading: shown once, above.
  const body = p.content.replace(/^\s*#{1,2}\s+(.+)\n/, (line, h: string) => (h.trim() === p.title.trim() ? "" : line));
  return (
    <main className="flex w-full flex-1 flex-col items-center px-4 py-8 md:py-12">
      <header className="flex w-full max-w-3xl items-center justify-between gap-3 text-white">
        <Link href="/" className="flex items-center gap-2"><LearisMark className="size-6" /><span className="text-lg tracking-[-0.02em]">learis</span></Link>
        <Link href={join} className="rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#111] hover:bg-white/90">Try it free</Link>
      </header>

      <article className="bg-card-grad shadow-float mt-6 w-full max-w-3xl rounded-2xl border border-white/40 p-6 md:p-10">
        <p className="text-muted-foreground text-[12.5px]">
          Shared by {p.shared_by} · {p.by_agent ? "written by LEARIS agents from course files" : "written in LEARIS"} · updated {when(p.updated_at)}
        </p>
        <h1 className="mt-2 text-[26px] leading-tight font-medium tracking-tight md:text-[30px]">{p.title}</h1>
        {p.sources.length > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#111] px-3 py-1 text-[12px] text-white">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            {p.checks.cited} of {p.sources.length} source(s) cited · each quote was checked word for word against its file
          </p>
        )}
        <div className="mt-6"><Markdown>{body}</Markdown></div>

        {p.sources.length > 0 && (
          <section className="mt-8 border-t pt-5">
            <h2 className="text-sm font-medium">Sources</h2>
            <ol className="mt-3 space-y-2">
              {p.sources.map((s) => (
                <li key={s.n} id={`src-${s.n}`} className="rounded-lg border bg-white/60 p-3 dark:bg-white/5">
                  <span className="font-mono text-[11px]">[{s.n}] {s.file_name}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed">&ldquo;{s.quote}&rdquo;</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </article>

      <aside className="mt-6 w-full max-w-3xl rounded-2xl bg-[#111] p-6 text-white md:p-8">
        <p className="text-[12px] tracking-wide text-white/60 uppercase">Made with LEARIS</p>
        <h2 className="mt-1.5 text-xl font-medium tracking-tight md:text-2xl">Make one like this from your own course files</h2>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-white/75">
          Upload a semester of PDFs and ask once. Agents write summaries and papers where every claim cites its exact
          quote, put every deadline on a board, and format your report for your campus. Free, and you bring your own AI model.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={join} className="rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#111] hover:bg-white/90">Create a free account</Link>
          <Link href={`/login?ref=${token}`} className="rounded-full border border-white/30 px-4 py-2 text-[13px] hover:bg-white/10">Sign in</Link>
        </div>
      </aside>
    </main>
  );
}
