import { apiResult, api, type Catalog, type Gap, type Impact, type Output, type Student } from "@/app/lib";
import { AnalyseButton } from "@/components/analyse-button";
import { EmptyState, Page, ServiceDown } from "@/components/page-bits";
import { RadarChart } from "@/components/radar-chart";
import { PageHeader } from "@/components/shell";
import { Confidence, STATUS, StatusPill } from "@/components/skill-bits";
import { TargetForm } from "./TargetForm";

export const dynamic = "force-dynamic";

export default async function GapPage() {
  const [cat, st] = await Promise.all([apiResult<Catalog>("catalog"), apiResult<Student>("student")]);
  if (!cat.data || !st.data) return <ServiceDown error={cat.error ?? st.error} />;
  const [gap, impact] = await Promise.all([api<Output<Gap>>("gap"), api<Impact>("impact")]);
  const g = gap?.payload ?? null;
  const stale = g && st.data.target_role && g.role.id !== st.data.target_role;
  const before = new Map((impact?.baseline_role === g?.role.id ? impact?.radar_before ?? [] : [])
    .map((r) => [r.category, r.score]));

  return (
    <Page>
      <PageHeader title="Gap map"
        lead="Your proven skills set against what the role asks for. Each requirement is mastered, partial or missing, and beside it: how many of the sample job posts for that region ask for it, in their own words."
        aside={<TargetForm roles={cat.data.roles} regions={cat.data.regions}
          role={st.data.target_role} region={st.data.region} />} />

      {!g || stale ? (
        <div className="mt-6 space-y-4">
          <EmptyState title={st.data.target_role ? "Run the agents to draw the gap map" : "Choose a target role"}
            body="The Roadmap Agent compares the skills your evidence proves with the role's requirements, then orders what is left by prerequisite." />
          {st.data.target_role && <AnalyseButton />}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
          <section className="min-w-0 space-y-4">
            <div className="bg-inner-grad glow-top rounded-lg border p-4 shadow-soft">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="text-[14px] font-medium">{g.role.name}</h2>
                <span className="font-mono text-3xl font-medium tabular-nums">{g.match}%</span>
              </div>
              <p className="text-muted-foreground text-xs">{g.role.summary}</p>
              <RadarChart className="mx-auto mt-2 w-full max-w-sm"
                axes={g.radar.map((r) => ({ label: r.category, value: r.score, baseline: before.get(r.category) }))} />
              <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                {(["mastered", "partial", "missing"] as const).map((s) => (
                  <div key={s} className="rounded-md border p-2">
                    <p className="font-mono text-lg font-medium">{g.counts[s]}</p>
                    <p className="text-muted-foreground text-[11px]">{STATUS[s].label}</p>
                  </div>
                ))}
              </div>
              {g.explanation && <p className="mt-3 text-sm leading-relaxed">{g.explanation}</p>}
            </div>
            {g.beyond_role.length > 0 && (
              <div className="bg-inner-grad rounded-lg border p-4">
                <h3 className="text-[14px] font-medium">Beyond this role</h3>
                <p className="text-muted-foreground text-xs">Proven, not required here, still yours.</p>
                <p className="mt-2 text-sm">{g.beyond_role.map((b) => b.name).join(" · ")}</p>
              </div>
            )}
          </section>

          <section className="min-w-0">
            <div className="overflow-x-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b text-left text-xs">
                  <tr>
                    <th className="p-3 font-medium">Skill</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Confidence</th>
                    <th className="p-3 font-medium">Asked for</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {g.skills.map((s) => (
                    <tr key={s.skill_id} className="align-top">
                      <td className="p-3">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-muted-foreground text-[11px]">{s.level === "core" ? "core" : "plus"} · {s.category}</p>
                        {s.top_quote && (
                          <p className="text-muted-foreground mt-1 max-w-sm text-[11px] leading-relaxed">
                            &ldquo;{s.top_quote}&rdquo; · {s.top_source}
                          </p>
                        )}
                      </td>
                      <td className="p-3"><StatusPill status={s.status} /></td>
                      <td className="p-3"><Confidence value={s.confidence} /></td>
                      <td className="p-3">
                        <p className="font-mono text-xs">{s.demand.posts}/{s.demand.of} posts</p>
                        {s.demand.terms.length > 0 && (
                          <p className="text-muted-foreground text-[11px]">{s.demand.terms.slice(0, 3).join(", ")}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-muted-foreground mt-2 text-[11px]">
              Job posts are {g.posts_read} illustrative samples written for the demo, not real listings.
              Mastered at {Math.round(0.6 * 100)}% confidence, partial from 25%.
            </p>
          </section>
        </div>
      )}
    </Page>
  );
}
