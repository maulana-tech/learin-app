import Link from "next/link";

import { apiResult, when, who, type PageFull } from "@/app/lib";
import { Chip } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { PageEditor } from "./PageEditor";

export const dynamic = "force-dynamic";

export default async function OnePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const r = await apiResult<PageFull>(`pages/${id}`);
  if (!r.data) return <ServiceDown error={r.error} />;
  const p = r.data;
  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <Link href="/pages" className="text-muted-foreground hover:text-fg text-[12.5px]">← Pages</Link>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">{p.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip tone={p.created_by.startsWith("agent:") ? "info" : "neutral"}>written by {who(p.created_by)}</Chip>
        <Chip>updated {when(p.updated_at)}</Chip>
        <Chip tone={p.sources.length ? "ok" : "neutral"}>{p.sources.length} source(s)</Chip>
      </div>
      <div className="mt-6 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <PageEditor page={p} startEditing={(await searchParams).edit === "1"} />
        <aside className="min-w-0">
          <h2 className="text-sm font-medium">Sources</h2>
          {p.sources.length === 0 ? (
            <p className="text-muted-foreground mt-2 text-[12.5px]">No sources. Claims on this page are not tied to a file.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {p.sources.map((s) => (
                <li key={s.n} className="bg-inner-grad rounded-lg border p-3">
                  <p className="font-mono text-[11px]">[{s.n}] {s.file_name}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed">&ldquo;{s.quote}&rdquo;</p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </main>
  );
}
