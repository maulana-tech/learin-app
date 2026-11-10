import { apiResult, type Skill } from "@/app/lib";
import { EmptyState, Page, ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { Confidence, KIND_LABEL, MethodTag, StatusPill, statusOf } from "@/components/skill-bits";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SkillsPage() {
  const r = await apiResult<{ skills: Skill[]; hidden: number }>("skills");
  if (!r.data) return <ServiceDown error={r.error} />;
  const { skills, hidden } = r.data;
  const byCat = new Map<string, Skill[]>();
  for (const s of skills) byCat.set(s.category, [...(byCat.get(s.category) ?? []), s]);

  return (
    <Page>
      <PageHeader title="Skills"
        lead="Every skill here comes with the words that prove it and how sure we are. A course name is a weak hint; a project that uses the skill is strong. Nothing is listed without a source."
        aside={skills.length > 0 && (
          <span className="text-muted-foreground text-sm">
            {skills.length} skill(s) · <span className="text-foreground font-medium">{hidden} hidden</span> (not on your profile)
          </span>
        )} />

      {skills.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="No skills proven yet" body="Add evidence and run the agents. Each skill the Skill Evidence Agent finds will show here with its quote."
            href="/evidence" cta="Add evidence" />
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {[...byCat.entries()].map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wide">{cat}</h2>
              <ul className="mt-2 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {list.map((s) => (
                  <li key={s.skill_id} className="min-w-0 rounded-lg border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <StatusPill status={statusOf(s.confidence)} />
                      {s.hidden && <Badge variant="outline" className="text-[10px]">hidden skill</Badge>}
                      {s.verified && <Badge variant="outline" className="text-[10px]">verified</Badge>}
                    </div>
                    <Confidence value={s.confidence} className="mt-2" />
                    <ul className="mt-3 space-y-2">
                      {s.evidence.slice(0, 3).map((e) => (
                        <li key={e.id} className="border-l-2 pl-2.5">
                          <p className="text-xs leading-relaxed">&ldquo;{e.quote}&rdquo;</p>
                          <p className="text-muted-foreground mt-0.5 text-[11px]">
                            {e.document_title} · {KIND_LABEL[e.document_kind] ?? e.document_kind} · {Math.round(e.confidence * 100)}% · <MethodTag method={e.method} />
                          </p>
                        </li>
                      ))}
                      {s.evidence.length > 3 && (
                        <li className="text-muted-foreground text-[11px]">+{s.evidence.length - 3} more source(s)</li>
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
