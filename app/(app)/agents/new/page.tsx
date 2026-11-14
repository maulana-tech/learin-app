import Link from "next/link";

import { apiResult, type ToolDef } from "@/app/lib";
import { ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { AgentForm } from "../AgentForm";

export const dynamic = "force-dynamic";

export default async function NewAgent() {
  const r = await apiResult<{ tools: ToolDef[] }>("tools");
  if (!r.data) return <ServiceDown error={r.error} />;
  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <Link href="/agents" className="text-muted-foreground hover:text-fg text-[12.5px]">← Agents</Link>
      <PageHeader title="New agent" lead="An agent is instructions plus the tools it may use. The Orchestrator will delegate to it when its description fits the request." />
      <div className="mt-6"><AgentForm tools={r.data.tools} /></div>
    </main>
  );
}
