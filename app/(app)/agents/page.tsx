import { Plus } from "lucide-react";
import Link from "next/link";

import { apiResult, currentWorkspace, type RosterAgent } from "@/app/lib";
import { Chip } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { PageHeader, Section } from "@/components/shell";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

function Card({ a }: { a: RosterAgent }) {
  const href = a.pack ? "/skill-gap" : a.custom ? `/agents/${a.id}` : undefined;
  const body = (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <p className="text-[14px] font-medium">{a.name}</p>
        {a.shared && <Chip tone="info">shared</Chip>}
        {a.model && <Chip>{a.model}</Chip>}
      </div>
      <p className="text-muted-foreground mt-1 text-[12.5px] leading-snug">{a.description}</p>
      {a.tools.length > 0 && (
        <p className="text-muted-foreground mt-2 font-mono text-[11px] leading-relaxed break-words">{a.tools.join(" · ")}</p>
      )}
    </>
  );
  const cls = "bg-inner-grad block rounded-lg border p-4";
  return href ? <Link href={href} className={`${cls} hover:border-[rgba(0,0,0,0.35)]`}>{body}</Link> : <div className={cls}>{body}</div>;
}

export default async function AgentsPage() {
  const ws = await currentWorkspace();
  const r = ws ? await apiResult<{ agents: RosterAgent[] }>(`workspace-agents?ws=${ws.id}`) : null;
  if (!ws || !r?.data) return <ServiceDown error={r?.error} />;
  const all = r.data.agents;
  const builtin = all.filter((a) => a.builtin), packs = all.filter((a) => a.pack), mine = all.filter((a) => a.custom);

  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Agents"
        lead={`The team the Orchestrator delegates to in ${ws.name}. Build your own: give it instructions, choose its tools and, if you like, its own model. Everyone in the workspace can use it.`}
        aside={<Button asChild><Link href="/agents/new"><Plus className="size-4" /> New agent</Link></Button>} />
      <Section title="Built in" note="Always available. Each sees only its own tools; tools refuse a page that cites what a file does not say.">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">{builtin.map((a) => <Card key={a.id} a={a} />)}</div>
      </Section>
      <Section title="Yours" note={mine.length ? undefined : "No custom agents yet. Build one, or install one from the gallery."}
        action={<Link href="/gallery" className="text-brand text-[12.5px]">Browse the gallery →</Link>}>
        {mine.length > 0 && <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">{mine.map((a) => <Card key={a.id} a={a} />)}</div>}
      </Section>
      <Section title="Packs" note="Ready-made teams for one job.">
        <div className="grid gap-3 md:grid-cols-2">{packs.map((a) => <Card key={a.id} a={a} />)}</div>
      </Section>
    </main>
  );
}
