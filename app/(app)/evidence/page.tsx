import { ExternalLink } from "lucide-react";

import { apiResult, when, type Doc, type Student } from "@/app/lib";
import { AnalyseButton } from "@/components/analyse-button";
import { EmptyState, Page, ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { KIND_LABEL } from "@/components/skill-bits";
import { AddEvidence } from "./AddEvidence";
import { DeleteDoc, Reanalyse } from "./DocActions";

export const dynamic = "force-dynamic";

export default async function EvidencePage() {
  const [docs, st] = await Promise.all([
    apiResult<{ documents: Doc[] }>("documents"),
    apiResult<Student>("student"),
  ]);
  if (!docs.data || !st.data) return <ServiceDown error={docs.error ?? st.error} />;
  const list = docs.data.documents;
  const pending = list.filter((d) => !d.analysed_at).length;

  return (
    <Page>
      <PageHeader title="Evidence"
        lead="Give the agents what you have actually studied and built. Course names alone say little; syllabi, project READMEs and repositories say what you can do. Every skill found later points back to a line in one of these." />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-4">
          <AddEvidence />
          <div className="text-muted-foreground rounded-lg border p-4 text-xs leading-relaxed">
            <p className="text-foreground font-medium">Your data</p>
            <p className="mt-1">
              {st.data.auto_delete
                ? "Auto-delete is on: once a document is analysed its full text is deleted and only the quoted evidence is kept."
                : "Auto-delete is off: full texts are kept so they can be read again."}{" "}
              {st.data.consent_at
                ? "You agreed to let your own AI model read these documents."
                : "No document is sent to an AI model until you agree in AI & privacy."}
            </p>
            <p className="mt-1">Content inside documents is treated as data, never as instructions to the agents.</p>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{list.length} document(s){pending ? ` · ${pending} not read yet` : ""}</h2>
            {list.length > 0 && <Reanalyse />}
          </div>
          {list.length === 0 ? (
            <EmptyState title="No evidence yet"
              body="Start with the syllabus of a course you liked, your transcript, or the README of something you built. Three documents are enough for a first radar." />
          ) : (
            <ul className="divide-y rounded-lg border">
              {list.map((d) => (
                <li key={d.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.title}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {KIND_LABEL[d.kind] ?? d.kind} · {d.chars.toLocaleString()} chars · added {when(d.uploaded_at)}
                    </p>
                    <p className="mt-1 text-xs">
                      {d.analysed_at
                        ? <span className="text-emerald-700 dark:text-emerald-400">read · {d.skills} skill(s) proven{d.text_kept ? "" : " · text deleted, quotes kept"}</span>
                        : <span className="text-amber-700 dark:text-amber-400">waiting for the agents</span>}
                    </p>
                  </div>
                  {d.source_url && (
                    <a href={d.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground p-2"
                      aria-label="Open source"><ExternalLink className="size-4" /></a>
                  )}
                  <DeleteDoc id={d.id} title={d.title} />
                </li>
              ))}
            </ul>
          )}
          {list.length > 0 && (
            <div className="rounded-lg border p-4"><AnalyseButton label={pending ? "Read new evidence" : "Run the agents again"} /></div>
          )}
        </div>
      </div>
    </Page>
  );
}
