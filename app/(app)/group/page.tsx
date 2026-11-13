import { Bot, Clock, FileText, Link2, ListChecks, Scale, UserPlus, Users } from "lucide-react";
import Link from "next/link";

import { apiResult, currentWorkspace, me, when, type GroupImpact, type Workspace, type WorkspaceDetail } from "@/app/lib";
import { Avatar, AvatarStack, Meter } from "@/components/bits";
import { ServiceDown } from "@/components/page-bits";
import { PageHeader, Section } from "@/components/shell";
import { CreateGroup, InviteLink, MyHours, OpenGroup, RemoveMember, ReportButton } from "./GroupBits";

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
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)]">
          <div className="min-w-0 space-y-6">
            <div>
              <h2 className="mb-3 text-sm font-medium">Start a group</h2>
              <CreateGroup />
            </div>
            {groups.length > 0 && (
              <div>
                <h2 className="text-sm font-medium">Your groups</h2>
                <p className="text-muted-foreground mt-1 mb-3 text-xs">Open one to see its members, tasks and impact.</p>
                <ul className="grid gap-2">
                  {groups.map((g) => (
                    <li key={g.id}><OpenGroup id={g.id} name={g.name} members={g.members ?? 1} /></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="mb-3 text-sm font-medium">What a group gives you</h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {([
                [Link2, "Invite with a link", "Send one link to your study group or community. Friends without an account sign up and land straight in the group."],
                [Users, "Share the workspace", "Files, pages, tasks and custom agents are shared. Anyone can ask the agents about the group's material."],
                [Scale, "Split the work fairly", "Tasks go to members and to agents. Each member sets their free hours; the Planner never piles more on anyone."],
                [Bot, "See the impact", "Tasks finished by people and by agents, pages written, hours saved, and an activity report in one click."],
              ] as const).map(([Icon, t, d], n) => (
                <li key={t} className="rounded-xl border bg-white p-4 shadow-soft">
                  <div className="flex items-center justify-between">
                    <span className="flex size-9 items-center justify-center rounded-lg bg-[#111] text-white"><Icon className="size-4" /></span>
                    <span className="text-muted-foreground font-mono text-[11px]">0{n + 1}</span>
                  </div>
                  <p className="mt-3 text-[14px] font-medium">{t}</p>
                  <p className="text-muted-foreground mt-1 text-[12.5px] leading-relaxed">{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
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

  const doneBy = i.tasks_done_by_people + i.tasks_done_by_agents;
  const peoplePct = doneBy ? Math.round((i.tasks_done_by_people / doneBy) * 100) : 0;
  const top = Math.max(1, ...i.contributions.map((c) => c.tasks_done));

  return (
    <main className="w-full px-4 py-6 md:px-8 md:py-8">
      <section className="rounded-2xl bg-[#111] p-6 text-white shadow-float md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="flex min-w-0 items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#111]"><Users className="size-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-tight">{d.name}</h1>
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-[11.5px]">you: {d.role}</span>
              </div>
              <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-white/65">{d.purpose ?? "A shared workspace."}</p>
              <div className="mt-3 flex items-center gap-2.5">
                <AvatarStack dark names={d.members.map((m) => m.name ?? m.email ?? "?")} max={6} />
                <span className="text-[12px] text-white/65">{d.members.length} member(s)</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2"><InviteLink workspaceId={d.id} compact dark /><ReportButton dark /></div>
        </div>
      </section>

      <Section title="Impact" note="Counted from the group's own record. Hours saved is an estimate and says how it is worked out.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ImpactCard icon={<ListChecks className="size-4" />} href="/tasks" label="Tasks finished" value={`${i.tasks_done}`} of={`/ ${i.tasks_total}`}>
            <Meter value={i.tasks_done} max={Math.max(1, i.tasks_total)} />
            <p className="text-muted-foreground mt-2 text-[11.5px]">{i.tasks_done_by_people} by people · {i.tasks_done_by_agents} by agents</p>
          </ImpactCard>
          <ImpactCard icon={<FileText className="size-4" />} href="/pages" label="Pages written" value={String(i.pages)}>
            <p className="text-muted-foreground text-[11.5px]">{i.pages_by_agents} drafted by agents, all with cited sources</p>
          </ImpactCard>
          <ImpactCard icon={<Clock className="size-4" />} label="Hours saved" value={`${i.hours_saved_estimate}`} of="h · estimate">
            <p className="text-muted-foreground text-[11.5px] leading-snug">{i.hours_saved_rule}</p>
          </ImpactCard>
          <ImpactCard icon={<Bot className="size-4" />} href="/gallery" label="Agent runs" value={String(i.agent_runs)}>
            <p className="text-muted-foreground text-[11.5px]">{i.files} files shared · {i.shared_agent_installs} gallery agent(s) installed</p>
          </ImpactCard>
        </div>
      </Section>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section title="Members and their load" note="Open hours: unfinished tasks assigned to them. The Planner keeps it under two weeks of their free hours.">
          <ul className="grid gap-2.5 md:grid-cols-2">
            {d.members.map((m) => {
              const over = m.open_hours > 2 * m.hours_per_week;
              const you = m.email === user.email;
              return (
                <li key={m.user_id} className="rounded-xl border bg-white p-4 shadow-soft">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name ?? m.email ?? "?"} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium">{m.name ?? m.email}{you && <span className="text-muted-foreground font-normal"> · you</span>}</p>
                      <p className="text-muted-foreground truncate text-[11.5px]">{m.role} · joined {when(m.joined_at, { time: false })}</p>
                    </div>
                    {you && m.role !== "owner" && <RemoveMember workspaceId={d.id} userId={m.user_id} label="Leave this group" />}
                    {d.role === "owner" && !you && <RemoveMember workspaceId={d.id} userId={m.user_id} label={`Remove ${m.name ?? "this member"}`} />}
                  </div>
                  <div className="mt-3.5 flex items-baseline justify-between text-[11.5px]">
                    <span className="text-muted-foreground">Load (2 weeks)</span>
                    <span className={over ? "text-warn font-medium" : "text-text"}>
                      <span className="font-mono">{m.open_hours}/{2 * m.hours_per_week} h</span>{over && " · overloaded"}
                    </span>
                  </div>
                  <Meter className="mt-1.5" value={m.open_hours} max={2 * m.hours_per_week} />
                  <p className="text-muted-foreground mt-2.5 text-[11.5px]"><span className="text-fg font-mono">{m.tasks_done}</span> task(s) done · {m.hours_per_week} h free a week</p>
                </li>
              );
            })}
            {d.members.length < 4 && (
              <li className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[rgba(0,0,0,0.2)] bg-white p-4 text-center">
                <span className="bg-raised flex size-10 items-center justify-center rounded-full"><UserPlus className="size-4" /></span>
                <p className="mt-2 text-[13.5px] font-medium">Bring your group in</p>
                <p className="text-muted-foreground mt-0.5 mb-3 text-[11.5px]">One link, valid 7 days, up to 25 people.</p>
                <InviteLink workspaceId={d.id} compact />
              </li>
            )}
          </ul>
        </Section>

        <div className="min-w-0">
          <Section title="Who finished what">
            <div className="space-y-4 rounded-xl border bg-white p-4 shadow-soft">
              <div>
                <div className="flex justify-between text-[11.5px]"><span>People {peoplePct}%</span><span className="text-muted-foreground">Agents {doneBy ? 100 - peoplePct : 0}%</span></div>
                <div className="bg-inset mt-1.5 flex h-2.5 overflow-hidden rounded-full">
                  <div className="bg-brand h-full" style={{ width: `${peoplePct}%` }} />
                  <div className="h-full bg-[repeating-linear-gradient(45deg,#777_0_4px,#aaa_4px_8px)]" style={{ width: `${doneBy ? 100 - peoplePct : 0}%` }} />
                </div>
              </div>
              <ul className="space-y-2.5">
                {[...i.contributions].sort((a, b) => b.tasks_done - a.tasks_done).map((c) => (
                  <li key={c.user_id} className="flex items-center gap-2.5">
                    <Avatar name={c.name ?? "?"} size="sm" />
                    <span className="w-28 truncate text-[12.5px]">{c.name ?? "member"}</span>
                    <div className="bg-inset h-1.5 flex-1 overflow-hidden rounded-full"><div className="bg-brand h-full rounded-full" style={{ width: `${(c.tasks_done / top) * 100}%` }} /></div>
                    <span className="w-6 text-right font-mono text-[12px]">{c.tasks_done}</span>
                  </li>
                ))}
              </ul>
              {doneBy === 0 && <p className="text-muted-foreground text-[12px]">Nothing finished yet. Add tasks on the board and give some to agents.</p>}
            </div>
          </Section>
          {mine && (
            <Section title="Your time">
              <div className="rounded-xl border bg-white p-4 shadow-soft"><MyHours workspaceId={d.id} hours={mine.hours_per_week} /></div>
            </Section>
          )}
        </div>
      </div>
    </main>
  );
}

function ImpactCard({ icon, label, value, of, href, children }: {
  icon: React.ReactNode; label: string; value: string; of?: string; href?: string; children?: React.ReactNode;
}) {
  const body = (
    <div className="h-full rounded-xl border bg-white p-4 shadow-soft transition-colors hover:border-[rgba(0,0,0,0.3)]">
      <div className="text-muted-foreground flex items-center justify-between text-[12px]">
        <span>{label}</span><span className="bg-raised text-text flex size-7 items-center justify-center rounded-lg">{icon}</span>
      </div>
      <p className="mt-2 flex items-baseline gap-1.5"><span className="font-mono text-[28px] leading-none font-medium tabular-nums">{value}</span>
        {of && <span className="text-muted-foreground text-[12px]">{of}</span>}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}
