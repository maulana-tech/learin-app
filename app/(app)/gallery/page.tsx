import { apiResult, currentWorkspace, type CustomAgent } from "@/app/lib";
import { Chip } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { Empty, PageHeader } from "@/components/shell";
import { Install } from "./Install";

export const dynamic = "force-dynamic";

export default async function Gallery() {
  const [ws, r] = await Promise.all([currentWorkspace(), apiResult<{ agents: CustomAgent[] }>("gallery")]);
  if (!ws || !r.data) return <ServiceDown error={r.error} />;
  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Community gallery"
        lead="Agents other students, study groups and communities built and chose to share. Installing one copies the agent into your workspace; nobody's files or pages come with it." />
      <div className="mt-6">
        {r.data.agents.length === 0 ? (
          <Empty what="Nothing shared yet" why="Build an agent and tick “Share in the community gallery”. It appears here for everyone." />
        ) : (
          <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {r.data.agents.map((a) => (
              <li key={a.id} className="bg-inner-grad flex flex-col rounded-lg border p-4">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-[14px] font-medium">{a.name}</p>
                  <Chip tone="info">{a.installs} install(s)</Chip>
                </div>
                <p className="text-muted-foreground mt-1 text-[12.5px] leading-snug">{a.description}</p>
                <p className="text-muted-foreground mt-2 font-mono text-[11px] break-words">{a.tools.join(" · ")}</p>
                <details className="mt-2">
                  <summary className="text-muted-foreground text-[12px]">Instructions</summary>
                  <p className="mt-1 text-[12.5px] leading-relaxed whitespace-pre-line">{a.instructions}</p>
                </details>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className="text-muted-foreground text-[12px]">by {a.author ?? "someone"}</span>
                  <Install id={a.id} workspaceName={ws.name} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
