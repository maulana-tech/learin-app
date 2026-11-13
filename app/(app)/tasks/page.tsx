import { apiResult, currentWorkspace, type Member, type Task } from "@/app/lib";
import { Chip } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { PageHeader } from "@/components/shell";
import { Board } from "./Board";

export const dynamic = "force-dynamic";

export default async function TasksPage() {
  const ws = await currentWorkspace();
  const r = ws ? await apiResult<{ tasks: Task[]; members: Member[]; agents: { id: string; name: string }[] }>(`tasks?ws=${ws.id}`) : null;
  if (!ws || !r?.data) return <ServiceDown error={r?.error} />;
  const { tasks, members, agents } = r.data;
  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <PageHeader title="Tasks"
        lead="Work for people and for agents, side by side. Give a task to an agent and press Run: it does the work and marks it done. The Planner agent balances people's open hours against their free hours."
        aside={ws.kind === "group" ? (
          <>{members.map((m) => (
            <Chip key={m.user_id} tone={m.open_hours > 2 * m.hours_per_week ? "warn" : "ok"}
              title={`${m.open_hours} open hours of ${m.hours_per_week} free a week`}>
              {m.name ?? m.email} · {m.open_hours}/{m.hours_per_week} h
            </Chip>
          ))}</>
        ) : undefined} />
      <div className="mt-6"><Board tasks={tasks} members={members} agents={agents} /></div>
    </main>
  );
}
