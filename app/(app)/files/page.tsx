import { ExternalLink } from "lucide-react";

import { apiResult, currentWorkspace, when, type Collection, type FileRow } from "@/app/lib";
import { Chip } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { Empty, PageHeader } from "@/components/shell";
import { DeleteFile, Upload } from "./Upload";

export const dynamic = "force-dynamic";

export default async function FilesPage() {
  const ws = await currentWorkspace();
  const r = ws ? await apiResult<{ files: FileRow[]; collections: Collection[] }>(`files?ws=${ws.id}`) : null;
  if (!ws || !r?.data) return <ServiceDown error={r?.error} />;
  const { files, collections } = r.data;
  const byCourse = new Map<string, FileRow[]>();
  for (const f of files) byCourse.set(f.collection ?? "(no course)", [...(byCourse.get(f.collection ?? "(no course)") ?? []), f]);

  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Files"
        lead={`What the agents read in ${ws.name}. Upload a whole semester at once and label each file with its course: the Orchestrator can then send one agent per course.`}
        aside={<>{collections.map((c) => <Chip key={c.name}>{c.name} · {c.files}</Chip>)}</>} />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <Upload courses={collections.map((c) => c.name).filter((n) => n !== "(no course)")} />
        <div className="min-w-0 space-y-5">
          {files.length === 0 ? (
            <Empty what="No files yet" why="Add course modules, slides, assignment briefs or a repository. Agents cite these, word for word, in every page they write." />
          ) : [...byCourse.entries()].map(([course, list]) => (
            <section key={course}>
              <h2 className="text-sm font-medium">{course} <span className="text-muted-foreground font-normal">· {list.length}</span></h2>
              <ul className="mt-2 divide-y rounded-lg border bg-white">
                {list.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px]">{f.name}</p>
                      <p className="text-muted-foreground font-mono text-[11px]">{f.chars.toLocaleString()} chars · {f.uploader ?? "someone"} · {when(f.uploaded_at)}</p>
                    </div>
                    {f.source_url && <a href={f.source_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-fg p-2" aria-label="Open source"><ExternalLink className="size-4" /></a>}
                    <DeleteFile id={f.id} name={f.name} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
