import { ExternalLink, FolderOpen } from "lucide-react";

import { apiResult, currentWorkspace, when, type Collection, type FileRow } from "@/app/lib";
import { FileIcon, kb } from "@/components/bits";
import { FileLink } from "@/components/file-preview";
import { Chip } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { DeleteFile, Upload } from "./Upload";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const ws = await currentWorkspace();
  const r = ws ? await apiResult<{ files: FileRow[]; collections: Collection[] }>(`files?ws=${ws.id}`) : null;
  if (!ws || !r?.data) return <ServiceDown error={r?.error} />;
  const { files, collections } = r.data;
  const byCourse = new Map<string, FileRow[]>();
  for (const f of files) byCourse.set(f.collection ?? "(no course)", [...(byCourse.get(f.collection ?? "(no course)") ?? []), f]);
  const total = files.reduce((n, f) => n + f.chars, 0);

  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Files"
        lead={`What the agents read in ${ws.name}. Upload a whole semester at once and label each file with its course; agents cite these files word for word.`}
        aside={files.length > 0 ? (
          <div className="flex items-center gap-5 text-right">
            <div><p className="font-mono text-lg font-medium">{collections.filter((c) => c.name !== "(no course)").length}</p><p className="text-muted-foreground text-[11px]">courses</p></div>
            <div><p className="font-mono text-lg font-medium">{files.length}</p><p className="text-muted-foreground text-[11px]">files</p></div>
            <div><p className="font-mono text-lg font-medium">{kb(total).replace(" chars", "")}</p><p className="text-muted-foreground text-[11px]">characters</p></div>
          </div>
        ) : undefined} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
        <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
          <Upload courses={collections.map((c) => c.name).filter((n) => n !== "(no course)")} />
        </div>

        <div className="min-w-0">
          {files.length === 0 ? (
            <div className="dot-grid-soft flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-14 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-white shadow-soft"><FolderOpen className="size-5" /></span>
              <p className="mt-3 text-[14.5px] font-medium">No files yet</p>
              <p className="text-muted-foreground mt-1 max-w-sm text-[13px] leading-relaxed">
                Add course modules, slides, assignment briefs or a repository. Then ask the Assistant to summarise each course or write a report.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 2xl:grid-cols-2">
              {[...byCourse.entries()].map(([course, list]) => (
                <section key={course} className="bg-inner-grad min-w-0 rounded-xl border">
                  <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
                    <h2 className="truncate text-[14px] font-medium">{course}</h2>
                    <Chip>{list.length} file(s) · {kb(list.reduce((n, f) => n + f.chars, 0))}</Chip>
                  </header>
                  <ul className="divide-y">
                    {list.map((f) => (
                      <li key={f.id} className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/70">
                        <FileIcon name={f.name} url={f.source_url} />
                        <div className="min-w-0 flex-1">
                          <FileLink id={f.id} name={f.name} className="block w-full truncate text-[13.5px]" />
                          <p className="text-muted-foreground truncate text-[11.5px]">{kb(f.chars)} · {f.uploader ?? "someone"} · {when(f.uploaded_at, { time: false })}</p>
                        </div>
                        {f.source_url && <a href={f.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-fg p-1.5" aria-label="Open source"><ExternalLink className="size-3.5" /></a>}
                        <DeleteFile id={f.id} name={f.name} />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
