import { CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";

import {
  apiResult, api, type Doc, type Gap, type Impact, type Output, type Reminder, type Run, type Student,
} from "@/app/lib";
import { AgentPanel } from "@/components/agent-panel";
import { CheckIn } from "@/components/checkin";
import { AnalyseButton } from "@/components/analyse-button";
import { Page, ServiceDown, Stat } from "@/components/page-bits";
import { RadarChart } from "@/components/radar-chart";
import { PageHeader } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const st = await apiResult<Student>("student");
  if (!st.data) return <ServiceDown error={st.error} />;
  const [docs, gap, impact, runs, reminders] = await Promise.all([
    api<{ documents: Doc[] }>("documents"),
    api<Output<Gap>>("gap"),
    api<Impact>("impact"),
    api<{ runs: Run[] }>("runs"),
    api<{ reminders: Reminder[] }>("reminders"),
  ]);
  const student = st.data;
  const g = gap?.payload ?? null;
  const last = runs?.runs?.[0] ? await api<Run>(`runs/${runs.runs[0].id}`) : null;
  const n = docs?.documents.length ?? 0;
  const pending = docs?.documents.filter((d) => !d.analysed_at).length ?? 0;
  const before = new Map((impact?.baseline_role === g?.role.id ? impact?.radar_before ?? [] : [])
    .map((r) => [r.category, r.score]));

  const steps = [
    { done: n > 0, label: "Add evidence", note: n ? `${n} document(s)` : "syllabus, transcript, README or repo", href: "/skill-gap/evidence" },
    { done: !!student.target_role, label: "Choose a target role", note: g?.role.name ?? "Junior Web Developer or Data Analyst", href: "/skill-gap/gap" },
    { done: !!g && pending === 0, label: "Run the agents", note: pending ? `${pending} document(s) not analysed yet` : g ? "up to date" : "evidence → gap → plan → profile", href: "#run" },
    { done: !!g, label: "Read your gap map", note: g ? `${g.match}% match` : "", href: "/skill-gap/gap" },
    { done: !!impact?.planned_hours, label: "Follow the 4-week plan", note: impact?.planned_hours ? `${impact.planned_hours} h planned` : "", href: "/skill-gap/plan" },
    { done: !!g, label: "Update your profile", note: "headline, About, CV bullets", href: "/skill-gap/profile" },
  ];

  return (
    <Page>
      <PageHeader
        title="Skill Gap Radar"
        lead="Your degree already taught you more than your resume shows. Add what you have studied and built; the agents prove which skills it shows, measure the gap to your target role, and plan four weeks that fit your real week."
      />

      {reminders?.reminders.map((r) => (
        <div key={r.id} className="mt-6"><CheckIn reminder={r} /></div>
      ))}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 space-y-6">
          <ol className="divide-y rounded-lg border bg-white">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link href={s.href} className="hover:bg-hover flex items-start gap-3 p-3 transition-colors">
                  {s.done ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ok" />
                    : <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium">{i + 1}. {s.label}</p>
                    {s.note && <p className="text-muted-foreground text-xs">{s.note}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ol>

          <div id="run" className="bg-inner-grad rounded-lg border p-4">
            <h2 className="text-[14px] font-medium">Agent team</h2>
            <p className="text-muted-foreground mt-1 mb-3 text-xs leading-relaxed">
              The Orchestrator reads where you are and runs Skill Evidence, Roadmap, Planner and
              Profile in order. Everything works without a model; connecting your own AI lets it
              read between the lines, and every claim it makes is checked against your documents.
            </p>
            <AnalyseButton />
            {last?.steps && last.steps.length > 0 && (
              <details className="mt-4">
                <summary className="text-muted-foreground cursor-pointer text-xs">Last run: what each agent did</summary>
                <div className="mt-3"><AgentPanel steps={last.steps} /></div>
              </details>
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-6">
          {g ? (
            <div className="bg-inner-grad glow-top rounded-lg border p-4 shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-medium">{g.role.name}</h2>
                <p className="font-mono text-3xl font-medium tabular-nums">{g.match}%</p>
              </div>
              <p className="text-muted-foreground text-xs">
                match · {g.counts.mastered} mastered · {g.counts.partial} partial · {g.counts.missing} missing
              </p>
              <RadarChart className="mx-auto mt-2 w-full max-w-sm"
                axes={g.radar.map((r) => ({ label: r.category, value: r.score,
                  baseline: before.has(r.category) ? before.get(r.category) : undefined }))} />
              {before.size > 0 && (
                <p className="text-muted-foreground text-center text-[11px]">dashed: your first analysis</p>
              )}
            </div>
          ) : (
            <div className="dot-grid-soft rounded-lg border border-dashed p-6 text-sm">
              <p className="font-medium">Your radar appears here</p>
              <p className="text-muted-foreground mt-1">Add evidence, choose a role, then run the agents.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Skills with evidence" value={impact?.skills_with_evidence ?? 0}
              note="each with the quote that proves it" />
            <Stat label="Hidden skills found" value={impact?.hidden_skills ?? 0}
              note="proven, but not on your profile yet" />
            <Stat label="Match, first → now"
              value={impact?.match_before != null ? `${impact.match_before}% → ${impact.match_now}%` : "-"} />
            <Stat label="Planned, next 4 weeks" value={impact?.planned_hours != null ? `${impact.planned_hours} h` : "-"}
              note="never more than your free hours" />
          </div>
        </section>
      </div>
    </Page>
  );
}
