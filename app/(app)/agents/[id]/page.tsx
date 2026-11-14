import { ArrowLeft, Pencil } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { apiResult, currentWorkspace, when, type AgentDetail } from "@/app/lib";
import { AgentBadge } from "@/components/agent-card";
import { Ask } from "@/components/ask";
import { Chip, Dot } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { Fact, Rail, Section, ToolList } from "@/components/shell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

/** What to ask each agent, to start a conversation worth having. */
const EXAMPLES: Record<string, string[]> = {
  reader: ["Apa isi file-file Basis Data? Beri poin penting beserta kutipannya", "Cari di semua file: apa definisi normalisasi?"],
  writer: ["Tulis ringkasan mata kuliah Statistika dari file-filenya, dengan sumber", "Buat laporan praktikum dari file yang ada"],
  organizer: ["Buat jadwal belajar minggu ini dari semua halaman ringkasan", "Bagi task kelompok ini rata ke anggota"],
  reviewer: ["Periksa semua halaman: klaim mana yang belum ada sumbernya?"],
};

const TONE = { start: "info", info: "neutral", tool: "solid", result: "ok", warn: "warn", error: "bad" } as const;

export default async function AgentProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "skill_gap") redirect("/skill-gap");
  const ws = await currentWorkspace();
  const r = ws ? await apiResult<AgentDetail>(`workspace-agents/${id}?ws=${ws.id}`) : null;
  if (!ws || !r?.data) return <ServiceDown error={r?.error} />;
  const a = r.data;
  const examples = EXAMPLES[a.id] ?? [`Apa yang bisa kamu kerjakan, ${a.name}?`, a.description];

  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <Link href="/agents" className="text-muted-foreground hover:text-fg inline-flex items-center gap-1.5 text-[12.5px]">
        <ArrowLeft className="size-3" /> Agents
      </Link>

      <header className="mt-4 border-b pb-5 md:pb-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <AgentBadge nickname={a.name} large showTooltip={false} />
          <h1 className="text-xl font-medium tracking-tight md:text-2xl">{a.name}</h1>
          <Chip tone={a.kind === "custom" ? "info" : "neutral"}>{a.kind}</Chip>
          {a.shared && <Chip tone="info">shared · {a.installs} install(s)</Chip>}
          {a.template_of && <Chip>from the gallery</Chip>}
          {a.kind === "custom" && (
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link href={`/agents/${a.id}/edit`}><Pencil className="size-3.5" /> Edit</Link>
            </Button>
          )}
        </div>
        <p className="text-muted-foreground mt-3 max-w-2xl text-sm leading-relaxed">{a.description}</p>
      </header>

      <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-10">
          <section>
            <h2 className="text-sm font-medium">Talk to {a.name}</h2>
            <p className="text-muted-foreground mt-1 mb-3 text-xs leading-relaxed">
              Directly, without the Orchestrator. It uses only its own tools, in {ws.name}.
            </p>
            <Ask workspaceName={ws.name} endpoint={`workspace-agents/${a.id}/ask`} speaker={a.name}
              examples={examples} placeholder={`Ask ${a.name}…`} />
          </section>

          <Section title="Recent activity" note={a.activity.length ? undefined : `${a.name} has not worked in this workspace yet.`}>
            {a.activity.length > 0 && (
              <ul className="bg-inner-grad divide-y rounded-lg border">
                {a.activity.slice(0, 20).map((s) => (
                  <li key={`${s.run_id}-${s.seq}`} className="flex gap-3 px-4 py-2.5">
                    <Dot tone={TONE[s.kind as keyof typeof TONE] ?? "neutral"} className="mt-[7px]" />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13px] leading-relaxed ${s.kind === "tool" ? "font-mono text-[12px]" : ""}`}>{s.message}</p>
                      <p className="text-muted-foreground mt-0.5 truncate text-[11px]">
                        {s.agent !== a.name && <>{s.agent.split(" · ")[1]} · </>}{when(s.at)}{s.request ? ` · “${s.request}”` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {a.instructions && (
            <Section title="Instructions" note="What this agent is told before every piece of work.">
              <pre className="bg-raised text-text max-h-[24rem] overflow-auto rounded-lg border p-4 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">{a.instructions}</pre>
            </Section>
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <Rail>
            <Fact label="Type" value={a.kind} mono={false} />
            <Fact label="Model" value={a.model ?? "your connected model"} />
            <Fact label="Tools" value={String(a.tools.length)} />
            <Fact label="Runs here" value={String(a.stats.runs)} />
            <Fact label="Pages written" value={String(a.stats.pages)} />
            <Fact label="Tasks finished" value={String(a.stats.tasks_done)} />
            <Fact label="Tasks waiting" value={String(a.stats.open_tasks)} tone={a.stats.open_tasks ? "warn" : "quiet"} />
          </Rail>
          {a.tools.length > 0 && (
            <div className="bg-inner-grad rounded-lg border">
              <p className="text-muted-foreground border-b px-4 py-2.5 text-xs font-medium">Tools ({a.tools.length})</p>
              <ToolList tools={a.tools.map((t) => ({ name: t.name, installed: true, description: t.description }))} />
            </div>
          )}
          {a.pages.length > 0 && (
            <div className="bg-inner-grad rounded-lg border">
              <p className="text-muted-foreground border-b px-4 py-2.5 text-xs font-medium">Pages it wrote</p>
              <ul className="divide-y">
                {a.pages.map((p) => (
                  <li key={p.id}><Link href={`/pages/${p.id}`} className="hover:bg-hover block px-4 py-2.5 text-[13px]">{p.title}</Link></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
