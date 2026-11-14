import Link from "next/link";

import { apiResult, api, when, type JobsStatus, type Run, type TeamAgent } from "@/app/lib";
import { AgentBadge } from "@/components/agent-card";
import { AgentPanel } from "@/components/agent-panel";
import { AnalyseButton } from "@/components/analyse-button";
import { Page, ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { StatusBadge } from "@/components/status-badge";
import { Chip } from "@/components/dort";
import { McpConnect } from "./McpConnect";

export const dynamic = "force-dynamic";

const every = (s: number) => (s >= 3600 ? `every ${s / 3600} h` : `every ${s / 60} min`);

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ run?: string }> }) {
  const team = await apiResult<{ team: TeamAgent[]; planned: TeamAgent[] }>("agents");
  if (!team.data) return <ServiceDown error={team.error} />;
  const [runsOut, jobs] = await Promise.all([api<{ runs: Run[] }>("runs"), api<JobsStatus>("jobs")]);
  const runs = runsOut?.runs ?? [];
  const pick = (await searchParams).run ?? runs[0]?.id;
  const run = pick ? await api<Run>(`runs/${pick}`) : null;

  return (
    <Page>
      <PageHeader title="Agent team"
        lead="One Orchestrator and four agents, each with its own tools. With a model that can call tools, each agent picks its own and every call shows below; tools refuse anything the evidence does not back. Without one, the agents follow fixed steps on the same engines." />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="min-w-0 space-y-3">
          <ul className="space-y-2">
            {team.data.team.map((a) => (
              <li key={a.code} className="bg-card-grad rounded-xl border p-4 shadow-soft">
                <div className="flex items-center gap-2.5">
                  <AgentBadge nickname={a.name.replace(/ Agent$/, "")} size="sm" showTooltip={false} />
                  <span className="text-[14px] font-medium">{a.name}</span>
                  <Chip>{a.priority}</Chip>
                  {a.tools.length > 0 && <span className="text-muted-foreground ml-auto text-[11px]">{a.tools.length} tools</span>}
                </div>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{a.brief}</p>
                {a.tools.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-muted-foreground cursor-pointer text-[11px]">Tools</summary>
                    <ul className="mt-1.5 space-y-1">
                      {a.tools.map((t) => (
                        <li key={t.name} className="text-[11px] leading-relaxed">
                          <span className="font-mono">{t.name}</span>
                          {t.writes && <span className="text-muted-foreground"> · saves</span>}
                          <span className="text-muted-foreground block">{t.description}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>

          <h2 className="pt-2 text-[14px] font-medium">Next</h2>
          <ul className="space-y-2">
            {team.data.planned.map((a) => (
              <li key={a.code} className="text-muted-foreground dot-grid-soft rounded-xl border border-dashed p-3 text-xs">
                <span className="text-foreground font-medium">{a.name}</span>{" "}
                <Chip>{a.priority}</Chip>
                <p className="mt-1 leading-relaxed">{a.brief}</p>
              </li>
            ))}
          </ul>

          {jobs && (
            <div className="bg-inner-grad rounded-xl border p-4">
              <h2 className="text-[14px] font-medium">Workers and scheduled jobs</h2>
              <p className="text-muted-foreground mt-1 text-xs">
                {jobs.workers.workers} worker(s) · {jobs.workers.busy} busy · {jobs.workers.queued} queued ·{" "}
                {jobs.workers.done} run(s) done since start · scheduler {jobs.scheduler_on ? "on" : "off"}
              </p>
              <ul className="mt-2 space-y-1.5">
                {jobs.jobs.map((j) => (
                  <li key={j.name} className="text-xs">
                    <span className="font-mono">{j.name}</span>{" "}
                    <span className="text-muted-foreground">{every(j.every_seconds)} · {j.what}</span>
                    {j.last_result && (
                      <span className={`block text-[11px] ${j.last_ok === false ? "text-destructive" : "text-muted-foreground"}`}>
                        last: {j.last_result}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-inner-grad rounded-xl border p-4">
            <h2 className="mb-2 text-[14px] font-medium">Use LEARIS from your own agent (MCP)</h2>
            <McpConnect />
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <div className="bg-card-grad rounded-xl border p-4 shadow-soft"><AnalyseButton /></div>
          {runs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {runs.slice(0, 8).map((r) => (
                <Link key={r.id} href={`/skill-gap/agents?run=${r.id}`}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${r.id === pick ? "border-brand bg-brand text-white" : "text-muted-foreground hover:text-fg bg-white"}`}>
                  {when(r.started_at)}
                </Link>
              ))}
            </div>
          )}
          {run && (
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <StatusBadge status={run.status === "done" ? "done" : run.status === "failed" ? "failed" : "running"}>
                  {run.status}
                </StatusBadge>
                <span className="text-muted-foreground">{run.ai ?? "rules only"} · {when(run.started_at)}</span>
              </div>
              <AgentPanel steps={run.steps ?? []} />
            </div>
          )}
        </section>
      </div>
    </Page>
  );
}
