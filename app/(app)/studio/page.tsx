import { apiResult, currentWorkspace, type RosterAgent } from "@/app/lib";
import { ServiceDown } from "@/components/page-bits";
import { Studio } from "@/components/studio/studio";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const ws = await currentWorkspace();
  const r = ws ? await apiResult<{ agents: RosterAgent[] }>(`workspace-agents?ws=${ws.id}`) : null;
  if (!ws || !r?.data) return <ServiceDown error={r?.error} />;
  const agents = [
    { id: "orchestrator", name: "Orchestrator", description: "Splits your request and delegates it to the other agents." },
    ...r.data.agents.filter((a) => !a.pack).map((a) => ({ id: a.id, name: a.name, description: a.description })),
  ];
  return (
    <main className="flex w-full flex-1 flex-col px-3 py-3 md:h-[calc(100dvh-1.5rem)] md:px-4 md:py-4">
      <div className="mb-3 flex shrink-0 items-baseline justify-between gap-3 px-1">
        <h1 className="text-lg font-medium tracking-tight">Studio</h1>
        <p className="text-muted-foreground hidden text-[12.5px] md:block">
          Several agents at once, each in its own panel. Drag the borders to resize.
        </p>
      </div>
      <Studio workspaceId={ws.id} workspaceName={ws.name} agents={agents} />
    </main>
  );
}
