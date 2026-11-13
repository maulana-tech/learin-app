import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { api, me, type Workspace } from "@/app/lib";
import { SideNav } from "@/components/side-nav";
import { NAV_COOKIE, WS_COOKIE } from "@/lib/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, health, jar] = await Promise.all([
    me(), api<{ env: string; server_ai: boolean }>("health"), cookies(),
  ]);
  // The service answers and does not know you: sign in. It does not answer at
  // all: stay, and let the pages say the service is down.
  if (health && !user) redirect("/login");
  const list = user ? (await api<{ workspaces: Workspace[] }>("workspaces"))?.workspaces ?? [] : [];
  const picked = jar.get(WS_COOKIE)?.value;
  const current = list.find((w) => w.id === picked) ?? list.find((w) => w.kind === "personal");

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <SideNav user={user ?? undefined} connection={health ?? undefined} workspaces={list} current={current}
        collapsed={jar.get(NAV_COOKIE)?.value === "slim"} />
      <div className="flex min-w-0 flex-1 flex-col px-2 pb-2 md:py-3 md:pr-3 md:pl-0">
        <div className="bg-card-grad flex min-w-0 flex-1 flex-col overflow-clip rounded-xl border border-white/40 shadow-float">
          {children}
        </div>
      </div>
    </div>
  );
}
