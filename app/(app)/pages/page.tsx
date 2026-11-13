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
          <Empty what="No pages yet" why="Ask the Assistant to summarise your files, or write one yourself." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {r.data.pages.map((p) => (
              <li key={p.id}>
                <Link href={`/pages/${p.id}`} className="bg-inner-grad hover:border-[rgba(6,71,179,0.35)] block rounded-lg border p-4 transition-colors">
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
