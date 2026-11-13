import Link from "next/link";

import { apiResult, currentWorkspace, when, who, type Member, type PageRow, type WorkspaceDetail } from "@/app/lib";
import { Chip } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { Empty, PageHeader } from "@/components/shell";
import { NewPage } from "./NewPage";

export const dynamic = "force-dynamic";

export default async function PagesPage() {
  const ws = await currentWorkspace();
  const r = ws ? await apiResult<{ pages: PageRow[] }>(`pages?ws=${ws.id}`) : null;
  if (!ws || !r?.data) return <ServiceDown error={r?.error} />;
  const detail = (await apiResult<WorkspaceDetail>(`workspaces/${ws.id}`)).data;
  const names = Object.fromEntries((detail?.members ?? []).map((m: Member) => [m.user_id, m.name ?? "member"]));

  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Pages"
        lead="Summaries, reports and study guides. Pages agents write cite their files as [n], and the Reviewer flags any claim without a source."
        aside={<NewPage />} />
      <div className="mt-6">
        {r.data.pages.length === 0 ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <Empty what="No pages yet" why="Pages are where the agents' work lands: summaries, reports, study guides. Ask the Assistant, or press New page to write one yourself." />
            <ul className="grid gap-3 sm:grid-cols-3">
              {[
                ["Summaries per course", "“Ringkas tiap mata kuliah di Files, satu halaman per matkul.”"],
                ["A sourced report", "“Buat laporan praktikum dari file yang ada, dengan sumber.”"],
                ["A study guide", "“Buat panduan belajar UTS Statistika dari semua materinya.”"],
              ].map(([t, q]) => (
                <li key={t} className="bg-inner-grad rounded-lg border p-4">
                  <p className="text-[13.5px] font-medium">{t}</p>
                  <p className="text-muted-foreground mt-1.5 text-[12.5px] leading-relaxed">{q}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {r.data.pages.map((p) => (
              <li key={p.id}>
                <Link href={`/pages/${p.id}`} className="bg-inner-grad hover:border-[rgba(0,0,0,0.35)] block rounded-lg border p-4 transition-colors">
                  <p className="truncate text-[14px] font-medium">{p.title}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip tone={p.updated_by.startsWith("agent:") ? "info" : "neutral"}>{who(p.updated_by, names)}</Chip>
                    <Chip tone={p.sources ? "ok" : "neutral"}>{p.sources} source(s)</Chip>
                  </div>
                  <p className="text-muted-foreground mt-2 font-mono text-[11px]">{when(p.updated_at)} · {p.chars.toLocaleString()} chars</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
