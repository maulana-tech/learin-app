import { ArrowRight, Check, CheckCircle2, Radar as RadarIcon } from "lucide-react";
import Link from "next/link";

import {
  apiResult, api, type Doc, type Gap, type Impact, type Output, type Reminder, type Run, type Student,
} from "@/app/lib";
import { AgentBadge } from "@/components/agent-card";
import { AgentPanel } from "@/components/agent-panel";
import { Ring } from "@/components/bits";
import { CheckIn } from "@/components/checkin";
import { AnalyseButton } from "@/components/analyse-button";
import { Page, ServiceDown, Stat } from "@/components/page-bits";
import { RadarChart } from "@/components/radar-chart";
import { PageHeader } from "@/components/shell";
import { cn } from "@/lib/utils";

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

  const doneCount = steps.filter((s) => s.done).length;
  const nextStep = steps.find((s) => !s.done);
  const team = [
    { name: "Skill Evidence", note: "quotes that prove each skill" },
    { name: "Roadmap", note: "gap to the target role" },
    { name: "Planner", note: "4 weeks inside your free hours" },
    { name: "Profile", note: "headline, About, CV bullets" },
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

      <section className="mt-6 rounded-2xl bg-[#111] text-white shadow-float">
        <div className="grid gap-6 p-6 md:p-7 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,0.9fr)] lg:items-center">
          <Ring dark value={g?.match ?? 0} size={124} label={g ? "match" : "no radar yet"} />
          <div className="min-w-0">
            <p className="text-[12px] text-white/60">Target role</p>
            <p className="mt-0.5 text-[22px] font-semibold tracking-tight">{g?.role.name ?? (student.target_role ? "Chosen, not measured yet" : "Not chosen yet")}</p>
            {g ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {([["mastered", "bg-white text-[#111]"], ["partial", "bg-white/15 text-white"], ["missing", "border border-white/25 text-white/80"]] as const).map(([k, cls]) => (
                  <span key={k} className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-medium", cls)}>
                    <span className="mr-1 font-mono">{g.counts[k]}</span>{k}
                  </span>
                ))}
              </div>
            ) : <p className="mt-1 text-[13px] text-white/60">{student.target_role ? "Run the agents to measure your match and draw the radar." : "Add evidence, choose a role, then run the agents."}</p>}
          </div>
          <div className="min-w-0 rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/10">
            <div className="flex items-baseline justify-between text-[12px]">
              <span className="text-white/60">Setup</span>
              <span className="font-mono">{doneCount}/{steps.length}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-white transition-[width]" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            {nextStep ? (
              <Link href={nextStep.href} className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2.5 text-[#111] transition-colors hover:bg-[#ececec]">
                <span className="min-w-0"><span className="block text-[11px] text-[#5f5f5f]">Next step</span>
                  <span className="block truncate text-[13.5px] font-medium">{nextStep.label}</span></span>
                <ArrowRight className="size-4 shrink-0" />
              </Link>
            ) : <p className="mt-3 flex items-center gap-1.5 text-[13px]"><CheckCircle2 className="size-4" /> All set. Keep following the plan.</p>}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="min-w-0 space-y-6">
          <ol className="grid gap-2.5 sm:grid-cols-2">
            {steps.map((s, i) => (
              <li key={s.label}>
                <Link href={s.href} className={cn("group flex h-full items-start gap-3 rounded-xl border bg-white p-3.5 shadow-soft transition-colors hover:border-[rgba(0,0,0,0.3)]",
                  s === nextStep && "border-[#111] ring-1 ring-[#111]")}>
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[12px]",
                    s.done ? "bg-brand text-white" : "bg-raised text-text")}>
                    {s.done ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className={cn("text-[13.5px] font-medium", s.done && "text-muted-foreground")}>{s.label}</p>
                    {s.note && <p className="text-muted-foreground mt-0.5 text-[11.5px] leading-snug">{s.note}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ol>

          <div id="run" className="rounded-xl border bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-medium">Agent team</h2>
              <Link href="/skill-gap/agents" className="text-muted-foreground hover:text-fg text-[12px]">How they work →</Link>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {team.map((t) => (
                <li key={t.name} className="flex items-center gap-2.5 rounded-lg border bg-[#fafafa] px-3 py-2">
                  <AgentBadge nickname={t.name} size="sm" showTooltip={false} />
                  <span className="min-w-0"><span className="block text-[12.5px] font-medium">{t.name}</span>
                    <span className="text-muted-foreground block truncate text-[11px]">{t.note}</span></span>
                </li>
              ))}
            </ul>
            <p className="text-muted-foreground mt-3 mb-3 text-[12px] leading-relaxed">
              The Orchestrator runs them in order. Everything works without a model; with one it reads
              between the lines, and every claim is checked against your documents.
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
            <div className="rounded-xl border bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-medium">Radar · {g.role.name}</h2>
                <Link href="/skill-gap/gap" className="text-muted-foreground hover:text-fg text-[12px]">Gap map →</Link>
              </div>
              <RadarChart className="mx-auto mt-2 w-full max-w-sm"
                axes={g.radar.map((r) => ({ label: r.category, value: r.score,
                  baseline: before.has(r.category) ? before.get(r.category) : undefined }))} />
              {before.size > 0 && (
                <p className="text-muted-foreground text-center text-[11px]">dashed: your first analysis</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl border border-dashed border-[rgba(0,0,0,0.2)] bg-white px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-[#111] text-white"><RadarIcon className="size-5" /></span>
              <p className="mt-3 text-[14px] font-medium">Your radar appears here</p>
              <p className="text-muted-foreground mt-1 text-[13px]">Add evidence, choose a role, then run the agents.</p>
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
