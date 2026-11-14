import { AlertTriangle, Check } from "lucide-react";

import { apiResult, api, when, type Output, type Plan, type Roadmap, type Student } from "@/app/lib";
import { AnalyseButton } from "@/components/analyse-button";
import { Meter } from "@/components/bits";
import { EmptyState, Page, ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { StatusPill } from "@/components/skill-bits";
import { cn } from "@/lib/utils";
import { PlanSettings } from "./PlanSettings";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const st = await apiResult<Student>("student");
  if (!st.data) return <ServiceDown error={st.error} />;
  const [rm, plan] = await Promise.all([api<Output<Roadmap>>("roadmap"), api<Output<Plan>>("plan")]);
  const r = rm?.payload ?? null;
  const p = plan?.payload ?? null;

  return (
    <Page>
      <PageHeader title="Roadmap & plan"
        lead="What you already know is crossed off. What is left is ordered so nothing comes before what it builds on, then cut into four weeks that never exceed your free hours and shrink in exam weeks."
        aside={<PlanSettings hours={st.data.hours_per_week} exams={st.data.exam_weeks} canPlan={!!r} />} />

      {!r ? (
        <div className="mt-6 space-y-4">
          <EmptyState title="No roadmap yet" body="Choose a target role on the Gap map, then run the agents."
            href="/skill-gap/gap" cta="Choose a target role" />
          {st.data.target_role && <AnalyseButton />}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <section className="min-w-0">
            <h2 className="text-[14px] font-medium">Roadmap to {r.role.name}</h2>
            <p className="text-muted-foreground text-xs">{r.steps.length} step(s) · about {r.total_hours} h in total</p>
            <ol className="relative mt-4 space-y-2 pl-5 before:absolute before:top-2 before:bottom-2 before:left-[7px] before:w-px before:bg-[rgba(0,0,0,0.12)]">
              {r.done.map((d) => (
                <li key={d.skill_id} className="text-muted-foreground relative flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm">
                  <span className="bg-brand absolute top-1/2 -left-5 flex size-3.5 -translate-y-1/2 items-center justify-center rounded-full text-white"><Check className="size-2.5" /></span>
                  <span className="line-through">{d.name}</span>
                  <span className="ml-auto text-[11px]">already proven{d.source ? ` · ${d.source}` : ""}</span>
                </li>
              ))}
              {r.steps.map((s) => (
                <li key={s.skill_id} className="bg-card-grad relative rounded-lg border px-3.5 py-2.5 shadow-soft">
                  <span className="absolute top-3.5 -left-5 size-3.5 rounded-full border-2 border-[#111] bg-white" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-raised text-text rounded px-1.5 font-mono text-[11px]">{s.step}</span>
                    <span className="text-[14px] font-medium">{s.name}</span>
                    <StatusPill status={s.status} />
                    <span className="text-muted-foreground ml-auto font-mono text-[11px]">{s.hours} h</span>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-[11px]">{s.why}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="min-w-0">
            {!p ? (
              <EmptyState title="No plan yet" body="Run the agents to build the four-week plan." />
            ) : (
              <>
                <h2 className="text-[14px] font-medium">Next four weeks</h2>
                <p className="text-muted-foreground text-xs">
                  {p.planned_hours} h planned · {p.hours_per_week} free h/week · from {when(p.start, { time: false })}
                </p>
                {p.warnings.map((w) => (
                  <p key={w} className="bg-inner-grad mt-2 flex gap-2 rounded-lg border p-2.5 text-xs">
                    <AlertTriangle className="size-4 shrink-0 text-warn" /> {w}
                  </p>
                ))}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {p.weeks.map((w) => (
                    <div key={w.week} className={cn("bg-card-grad rounded-xl border p-4 shadow-soft", w.exam && "border-[rgba(161,98,7,0.35)] glow-top")}>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-[14px] font-medium">Week {w.week}{w.exam ? " · exams" : ""}</h3>
                        <span className="text-muted-foreground font-mono text-[11px]">{w.planned_hours}/{w.free_hours} h</span>
                      </div>
                      <Meter className="mt-2" value={w.planned_hours} max={Math.max(0.01, w.free_hours)} />
                      <p className="text-muted-foreground mt-1 text-[11px]">starts {when(w.starts, { time: false })} · {w.load_pct}% of your free time</p>
                      {w.focus && <p className="mt-2 text-xs italic leading-relaxed">{w.focus}</p>}
                      <ul className="mt-3 space-y-1 border-t pt-2.5">
                        {w.tasks.length === 0 && <li className="text-muted-foreground text-xs">Rest and revise.</li>}
                        {w.tasks.map((t, i) => (
                          <li key={`${t.skill_id}-${i}`} className="flex justify-between gap-2 text-xs">
                            <span>{t.name}{t.continues ? " (continues)" : ""}</span>
                            <span className="text-muted-foreground font-mono">{t.hours} h</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {p.later.length > 0 && (
                  <p className="text-muted-foreground mt-3 text-xs">
                    After week 4 ({p.later_hours} h): {p.later.map((l) => l.name).join(", ")}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
