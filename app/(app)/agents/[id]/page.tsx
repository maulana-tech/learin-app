import Link from "next/link";

import { apiResult, currentWorkspace, type CustomAgent, type ToolDef } from "@/app/lib";
import { ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { AgentForm } from "../AgentForm";
import { DeleteAgent } from "./DeleteAgent";

export const dynamic = "force-dynamic";

export default async function EditAgent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ws = await currentWorkspace();
  const [tools, roster] = await Promise.all([
    apiResult<{ tools: ToolDef[] }>("tools"),
    ws ? apiResult<{ custom: CustomAgent[] }>(`workspace-agents?ws=${ws.id}`) : null,
  ]);
  if (!tools.data || !roster?.data) return <ServiceDown error={tools.error ?? roster?.error} />;
  const agent = roster.data.custom.find((a) => a.id === id);
  if (!agent) return <ServiceDown error="This agent is not in the current workspace." />;
  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <Link href="/agents" className="text-muted-foreground hover:text-fg text-[12.5px]">← Agents</Link>
      <PageHeader title={agent.name} lead={agent.description}
        aside={<DeleteAgent id={agent.id} name={agent.name} />} />
      {agent.template_of && <p className="text-muted-foreground mt-3 text-[12.5px]">Installed from the community gallery.</p>}
      <div className="mt-6"><AgentForm tools={tools.data.tools} agent={agent} /></div>
    </main>
  );
}
