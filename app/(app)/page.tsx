import { api, currentWorkspace, type RosterAgent } from "@/app/lib";
import { Chat, type ChatThread, type ChatTurn } from "@/components/chat";
import { ServiceDown } from "@/components/page-bits";

export const dynamic = "force-dynamic";

export default async function Assistant({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const ws = await currentWorkspace();
  if (!ws) return <ServiceDown />;
  const { c } = await searchParams;
  const [roster, threads, convo] = await Promise.all([
    api<{ agents: RosterAgent[] }>(`workspace-agents?ws=${ws.id}`),
    api<{ conversations: ChatThread[] }>(`conversations?ws=${ws.id}`),
    c ? api<{ turns: ChatTurn[] }>(`conversations/${c}`) : Promise.resolve(null),
  ]);
  const agents = (roster?.agents ?? []).filter((a) => !a.pack).map((a) => ({ id: a.id, name: a.name, description: a.description }));
  const id = convo ? c ?? null : null;
  /* A chat is not a document on a page, it is the page: it takes the whole
   * panel, so the transcript scrolls against a composer that stays put. */
  return (
    <main className="flex min-h-[calc(100dvh-4rem)] w-full flex-1 md:h-[calc(100dvh-1.5rem)] md:min-h-0">
      <Chat key={id ?? "new"} conversationId={id} initialTurns={convo?.turns ?? []} threads={threads?.conversations ?? []}
        agents={agents} workspaceName={ws.name} />
    </main>
  );
}
