import Link from "next/link";

import { api, currentWorkspace, when, type AskRun, type Collection, type RosterAgent } from "@/app/lib";
import { ArtifactLinks, Ask } from "@/components/ask";
import { Chip } from "@/components/dort";
import { Markdown } from "@/components/markdown";
import { ServiceDown } from "@/components/page-bits";
import type { Artifact } from "@/app/lib";

export const dynamic = "force-dynamic";

export default async function Assistant() {
  const ws = await currentWorkspace();
  if (!ws) return <ServiceDown />;
  const [runs, roster, files] = await Promise.all([
    api<{ runs: AskRun[] }>(`runs?kind=ask&ws=${ws.id}`),
    api<{ agents: RosterAgent[] }>(`workspace-agents?ws=${ws.id}`),
    api<{ collections: Collection[] }>(`collections?ws=${ws.id}`),
  ]);
  const past = (runs?.runs ?? []).filter((r) => r.answer).slice(0, 6);
  const agents = roster?.agents ?? [];

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-medium tracking-tight md:text-[28px]">What should your agents do?</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
          The Orchestrator splits your request and delegates it, in parallel where it can, to agents that read
          your files, write pages where every claim cites a source, plan tasks for people and agents, and check the result.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <Chip tone={ws.kind === "group" ? "info" : "neutral"}>{ws.name}</Chip>
          {(files?.collections ?? []).map((c) => <Chip key={c.name}>{c.name} · {c.files}</Chip>)}
          {!files?.collections?.length && <Link href="/files" className="text-brand text-[12.5px]">Add files first →</Link>}
        </div>
      </div>

      <Ask workspaceName={ws.name} />

      <section className="mt-10">
        <h2 className="text-sm font-medium">Your agents</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a) => (
            <Link key={a.id} href={a.pack ? "/skill-gap" : a.custom ? `/agents/${a.id}` : "/agents"}
              className="bg-inner-grad hover:border-[rgba(0,0,0,0.35)] rounded-lg border p-3 transition-colors">
              <p className="text-[13.5px] font-medium">{a.name}
                <span className="text-muted-foreground ml-1.5 text-[11px]">{a.pack ? "pack" : a.custom ? "yours" : "built-in"}</span>
              </p>
              <p className="text-muted-foreground mt-1 line-clamp-2 text-[12px] leading-snug">{a.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm font-medium">Earlier</h2>
          <ul className="mt-3 space-y-2">
            {past.map((r) => (
              <li key={r.id} className="rounded-lg border p-3">
                <details>
                  <summary className="text-[13.5px]">
                    {r.request}
                    <span className="text-muted-foreground ml-2 font-mono text-[11px]">{when(r.started_at)}</span>
                  </summary>
                  <div className="mt-2 text-[13.5px] leading-relaxed"><Markdown>{r.answer ?? ""}</Markdown></div>
                  <ArtifactLinks items={((r.summary as { artifacts?: Artifact[] } | null)?.artifacts) ?? []} />
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
