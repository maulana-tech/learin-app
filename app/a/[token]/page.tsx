import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { publicLink, type PublicAgent } from "@/app/lib";
import { LearisMark } from "@/components/learis-mark";

/* A community agent someone shared: what it does, which tools it may use, and the way in. */

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await publicLink<PublicAgent>("agent", (await params).token, false);
  if (!a) return { title: "Link turned off" };
  const description = `${a.description} An AI study agent on LEARIS, installed ${a.installs} time(s).`;
  return { title: a.name, description, openGraph: { title: a.name, description },
    twitter: { card: "summary_large_image", title: a.name, description } };
}

export default async function SharedAgent({ params }: Props) {
  const { token } = await params;
  const a = await publicLink<PublicAgent>("agent", token);
  if (!a) notFound();
  const join = `/login?mode=up&ref=${token}&next=${encodeURIComponent(`/gallery?install=${a.id}`)}`;
  return (
    <main className="flex w-full flex-1 flex-col items-center px-4 py-8 md:py-12">
      <header className="flex w-full max-w-2xl items-center justify-between text-white">
        <Link href="/" className="flex items-center gap-2"><LearisMark className="size-6" /><span className="text-lg tracking-[-0.02em]">learis</span></Link>
      </header>
      <article className="bg-card-grad shadow-float mt-6 w-full max-w-2xl rounded-2xl border border-white/40 p-6 md:p-8">
        <p className="text-muted-foreground text-[12.5px]">A community agent · built by {a.author} · shared by {a.shared_by}</p>
        <h1 className="mt-2 text-[26px] font-medium tracking-tight">{a.name}</h1>
        <p className="mt-2 text-[14px] leading-relaxed">{a.description}</p>
        <p className="mt-3 inline-flex rounded-full bg-[#111] px-3 py-1 text-[12px] text-white">Installed {a.installs} time(s)</p>
        <h2 className="mt-6 text-sm font-medium">What it may use</h2>
        <p className="text-muted-foreground mt-1 font-mono text-[12px] break-words">{a.tools.join(" · ")}</p>
        <h2 className="mt-5 text-sm font-medium">Its instructions</h2>
        <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line">{a.instructions}</p>
        <div className="mt-6 flex flex-wrap gap-2 border-t pt-5">
          <Link href={join} className="rounded-full bg-[#111] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#111]/90">Install it free</Link>
          <Link href={`/login?ref=${token}&next=${encodeURIComponent(`/gallery?install=${a.id}`)}`} className="rounded-full border px-4 py-2 text-[13px] hover:bg-hover">I have an account</Link>
        </div>
        <p className="text-muted-foreground mt-3 text-[12px]">It runs on your own files, with the AI model you choose. Nobody&apos;s files come with it.</p>
      </article>
    </main>
  );
}
