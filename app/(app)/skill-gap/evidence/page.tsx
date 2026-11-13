import { ExternalLink } from "lucide-react";

import { apiResult, when, type Doc, type Student } from "@/app/lib";
import { AnalyseButton } from "@/components/analyse-button";
import { FileIcon, kb } from "@/components/bits";
import { Chip } from "@/components/dort";
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
          <div className="text-muted-foreground bg-inner-grad rounded-xl border p-4 text-xs leading-relaxed">
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
            <h2 className="text-[14px] font-medium">{list.length} document(s){pending ? ` · ${pending} not read yet` : ""}</h2>
            {list.length > 0 && <Reanalyse />}
          </div>
          {list.length === 0 ? (
            <EmptyState title="No evidence yet"
              body="Start with the syllabus of a course you liked, your transcript, or the README of something you built. Three documents are enough for a first radar." />
          ) : (
            <ul className="bg-inner-grad divide-y rounded-xl border">
              {list.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/70">
                  <FileIcon name={d.title} url={d.source_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-[13.5px] font-medium">{d.title}</p>
                      <Chip className="shrink-0">{KIND_LABEL[d.kind] ?? d.kind}</Chip>
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-[11.5px]">
                      {kb(d.chars)} · added {when(d.uploaded_at)}{d.analysed_at && !d.text_kept ? " · text deleted, quotes kept" : ""}
                    </p>
                  </div>
                  {d.analysed_at
                    ? <Chip tone="ok" className="shrink-0">{d.skills} skill(s)</Chip>
                    : <Chip tone="warn" className="shrink-0">not read yet</Chip>}
                  {d.source_url && (
                    <a href={d.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground p-1.5"
                      aria-label="Open source"><ExternalLink className="size-3.5" /></a>
                  )}
                  <DeleteDoc id={d.id} title={d.title} />
                </li>
              ))}
            </ul>
          )}
          {list.length > 0 && (
            <div className="bg-card-grad rounded-xl border p-4 shadow-soft"><AnalyseButton label={pending ? "Read new evidence" : "Run the agents again"} /></div>
          )}
        </div>
      </div>
    </Page>
  );
}
