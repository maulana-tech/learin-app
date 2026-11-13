import { apiResult, api, type Output, type ProfileDraft, type Student } from "@/app/lib";
import { AnalyseButton } from "@/components/analyse-button";
import { EmptyState, Page, ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ProfileText } from "./ProfileBits";

export const dynamic = "force-dynamic";

function Block({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <CopyButton text={text} />
      </div>
      {children ?? <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{text}</p>}
    </div>
  );
}

export default async function ProfilePage() {
  const st = await apiResult<Student>("student");
  if (!st.data) return <ServiceDown error={st.error} />;
  const out = await api<Output<ProfileDraft>>("profile");
  const p = out?.payload ?? null;

  return (
    <Page>
      <PageHeader title="Profile"
        lead="Suggestions for LinkedIn and your CV, written only from skills your evidence proves. If a draft claims a skill or tool nothing backs, the Profile Agent rejects it. You publish it yourself; nothing is posted for you."
        aside={p && <Badge variant="outline">{p.method === "ai" ? "written by your model, checked" : "template"}</Badge>} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 space-y-3">
          <h2 className="text-sm font-semibold">Your current profile</h2>
          <ProfileText initial={st.data.profile_text ?? ""} />
          <div className="rounded-lg border p-4"><AnalyseButton label="Write suggestions" /></div>
        </section>

        <section className="min-w-0 space-y-3">
          {!p ? (
            <EmptyState title="No suggestions yet" body="Add evidence and run the agents. The Profile Agent writes from what is proven." />
          ) : (
            <>
              <Block title="Headline" text={p.headline} />
              <Block title="About" text={p.about} />
              <Block title="CV bullets" text={p.bullets.map((b) => `• ${b.text}`).join("\n")}>
                {p.bullets.length === 0 ? (
                  <p className="text-muted-foreground mt-2 text-sm">Not enough evidence per document for a bullet yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {p.bullets.map((b) => (
                      <li key={b.text} className="text-sm leading-relaxed">
                        • {b.text}
                        <span className="text-muted-foreground block text-[11px]">source: {b.source}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Block>
              {p.post && <Block title="Post draft" text={p.post} />}
            </>
          )}
        </section>
      </div>
    </Page>
  );
}
