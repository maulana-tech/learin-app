import { apiResult, currentWorkspace, me, type GroupImpact, type Workspace, type WorkspaceDetail } from "@/app/lib";
import { Chip } from "@/components/dort";
import { ServiceDown } from "@/components/page-bits";
import { Metric, PageHeader, Section } from "@/components/shell";
import { CreateGroup, InviteLink, MyHours, RemoveMember, ReportButton } from "./GroupBits";

export const dynamic = "force-dynamic";

export default async function GroupPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const [ws, user, list] = await Promise.all([currentWorkspace(), me(), apiResult<{ workspaces: Workspace[] }>("workspaces")]);
  if (!ws || !user) return <ServiceDown error={list.error} />;
  const groups = (list.data?.workspaces ?? []).filter((w) => w.kind === "group");
  const wantNew = (await searchParams).new === "1";

  if (ws.kind !== "group" || wantNew) {
    return (
      <main className="w-full px-4 py-6 md:px-8 md:py-8">
        <PageHeader title="Group"
          lead="Work together: a study group, a project team, a student organisation or a volunteer community. Invite friends with a link, share files, pages and agents, split the work between people and agents, and see what the group got done." />
        <Section title="Start a group">
          <CreateGroup />
        </Section>
        {groups.length > 0 && (
          <Section title="Your groups" note="Switch to one from the workspace menu at the top of the sidebar.">
            <div className="flex flex-wrap gap-2">{groups.map((g) => <Chip key={g.id} tone="info">{g.name} · {g.members} member(s)</Chip>)}</div>
          </Section>
        )}
      </main>
    );
  }

  const [detail, impact] = await Promise.all([
    apiResult<WorkspaceDetail>(`workspaces/${ws.id}`),
    apiResult<GroupImpact>(`group-impact?ws=${ws.id}`),
  ]);
  if (!detail.data || !impact.data) return <ServiceDown error={detail.error ?? impact.error} />;
  const d = detail.data, i = impact.data;
  const mine = d.members.find((m) => m.email === user.email);

  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <PageHeader title={d.name} lead={d.purpose ?? "A shared workspace."}
        aside={<><Chip tone="info">group</Chip><Chip>{d.members.length} member(s)</Chip><Chip>you: {d.role}</Chip></>} />

      <Section title="Impact" note="Counted from the group's own record. Hours saved is an estimate and says how it is worked out."
        action={<ReportButton />}>
        <div className="bg-inner-grad grid grid-cols-2 gap-6 rounded-lg border p-5 md:grid-cols-4">
          <Metric label="Tasks finished" value={`${i.tasks_done}/${i.tasks_total}`} note={`${i.tasks_done_by_people} by people · ${i.tasks_done_by_agents} by agents`} href="/tasks" />
          <Metric label="Pages written" value={String(i.pages)} note={`${i.pages_by_agents} drafted by agents`} href="/pages" />
          <Metric label="Hours saved (estimate)" value={`${i.hours_saved_estimate} h`} note={i.hours_saved_rule} />
          <Metric label="Shared agents installed" value={String(i.shared_agent_installs)} note={`${i.files} files shared · ${i.agent_runs} agent runs`} />
        </div>
      </Section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section title="Members and their load" note="Open hours: unfinished tasks assigned to them. The Planner keeps it under two weeks of their free hours.">
          <ul className="divide-y rounded-lg border bg-white">
            {d.members.map((m) => (
              <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px]">{m.name ?? m.email} <span className="text-muted-foreground text-[11px]">{m.role}</span></p>
                  <p className="text-muted-foreground font-mono text-[11px]">{m.tasks_done} done · {m.open_hours}/{m.hours_per_week} h open</p>
                </div>
                <Chip tone={m.open_hours > 2 * m.hours_per_week ? "warn" : "ok"}>{m.open_hours > 2 * m.hours_per_week ? "overloaded" : "ok"}</Chip>
                {m.email === user.email && m.role !== "owner" && <RemoveMember workspaceId={d.id} userId={m.user_id} label="Leave this group" />}
                {d.role === "owner" && m.email !== user.email && <RemoveMember workspaceId={d.id} userId={m.user_id} label={`Remove ${m.name ?? "this member"}`} />}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Invite and settings">
          <div className="space-y-5">
            <InviteLink workspaceId={d.id} />
            {mine && <MyHours workspaceId={d.id} hours={mine.hours_per_week} />}
          </div>
        </Section>
      </div>
    </main>
  );
}
