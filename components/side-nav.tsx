"use client";

import {
  Bot, Check, ChevronsUpDown, FileText, FolderOpen, LayoutGrid, ListChecks, LogIn, LogOut, Menu,
  MessagesSquare, PanelLeftClose, PanelLeftOpen, Plus, Radar, Settings2, Store, Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import type { Workspace } from "@/app/lib";
import { LearisMark } from "@/components/learis-mark";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAIConfig } from "@/lib/ai-config";
import { NAV_COOKIE } from "@/lib/nav";
import { cn } from "@/lib/utils";

/* The navigation, on the blue canvas (design from AERA).
 *
 * The workspace comes first: a switcher between the personal workspace and the
 * groups the user belongs to. Then the main feature, the Assistant, and the
 * workspace itself. Groups and the Skill Gap pack sit below as support. */

export type Connection = { env: string; server_ai: boolean };
type User = { name: string; role: string; email: string };
type Item = { title: string; href: string; icon: React.ElementType };

const isActive = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

const GROUPS: { label: string; items: Item[] }[] = [
  { label: "", items: [{ title: "Assistant", href: "/", icon: MessagesSquare }] },
  {
    label: "Workspace",
    items: [
      { title: "Pages", href: "/pages", icon: FileText },
      { title: "Tasks", href: "/tasks", icon: ListChecks },
      { title: "Files", href: "/files", icon: FolderOpen },
      { title: "Agents", href: "/agents", icon: Bot },
      { title: "Gallery", href: "/gallery", icon: Store },
    ],
  },
  { label: "Together", items: [{ title: "Group", href: "/group", icon: Users }] },
  { label: "Packs", items: [{ title: "Skill Gap Radar", href: "/skill-gap", icon: Radar }] },
];
const SETTINGS: Item = { title: "AI & privacy", href: "/settings", icon: Settings2 };

function NavTile({ item, on, slim, onNavigate }: { item: Item; on: boolean; slim: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link href={item.href} onClick={onNavigate} title={slim ? item.title : undefined} aria-current={on ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-3 rounded-md text-[14px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        slim ? "w-9 justify-center" : "px-3",
        on ? "bg-white text-brand shadow-soft" : "text-white/85 hover:bg-white/10 hover:text-white",
      )}>
      <Icon className="size-4 shrink-0" />
      {!slim && <span className="min-w-0 flex-1 truncate">{item.title}</span>}
    </Link>
  );
}

function WorkspaceSwitcher({ workspaces, current, slim }: { workspaces: Workspace[]; current?: Workspace; slim: boolean }) {
  const router = useRouter();
  async function pick(id: string) {
    await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    router.refresh();
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger title={slim ? current?.name : undefined}
        className={cn("flex items-center gap-2.5 rounded-md border border-white/15 bg-white/10 text-left text-white outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60",
          slim ? "size-9 justify-center" : "w-full px-3 py-2")}>
        {current?.kind === "group" ? <Users className="size-4 shrink-0" /> : <LayoutGrid className="size-4 shrink-0" />}
        {!slim && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px]">{current?.name ?? "Workspace"}</span>
              <span className="block truncate text-[11.5px] text-white/70">
                {current?.kind === "group" ? `group · ${current.members ?? 1} member(s)` : "personal"}
              </span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-70" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start" sideOffset={10} className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">Workspaces</DropdownMenuLabel>
        {workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onClick={() => pick(w.id)}>
            {w.kind === "group" ? <Users /> : <LayoutGrid />}
            <span className="min-w-0 flex-1 truncate">{w.name}</span>
            {w.id === current?.id && <Check className="size-4" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push("/group?new=1")}>
          <Plus /> New group
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AIStatus({ c, slim }: { c?: Connection; slim: boolean }) {
  const own = useAIConfig();
  const label = !c ? "Service down" : own ? own.model : c.server_ai ? "Server model" : "No model yet";
  const sub = !c ? "agent service not answering" : own ? (own.tools === false ? "fixed steps only" : "agents pick their tools") : "connect your AI";
  const dot = !c ? "bg-rose-300" : own || c.server_ai ? "bg-emerald-300" : "bg-amber-300";
  return (
    <Link href="/settings" title={slim ? label : undefined}
      className={cn("flex items-center gap-2.5 rounded-md text-left text-white hover:bg-white/10", slim ? "size-9 justify-center" : "w-full px-3 py-1.5")}>
      <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dot)} />
      {!slim && (
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[12.5px]">{label}</span>
          <span className="block truncate text-[11px] text-white/65">{sub}</span>
        </span>
      )}
    </Link>
  );
}

function UserMenu({ user, slim }: { user?: User; slim: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!user) {
    return (
      <Link href="/login" className="flex h-9 items-center gap-3 rounded-md px-3 text-[14px] text-white/85 hover:bg-white/10">
        <LogIn className="size-4" /> {!slim && "Sign in"}
      </Link>
    );
  }
  async function signOut() {
    setBusy(true);
    await fetch("/api/login", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }
  const initials = user.name.split(" ").map((x) => x[0]).slice(0, 2).join("").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={`Signed in as ${user.name}`}
        className={cn("flex items-center gap-2.5 rounded-md text-left text-white outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/60",
          slim ? "size-9 justify-center" : "w-full p-1.5")}>
        <span className="text-brand flex size-8 shrink-0 items-center justify-center rounded-md bg-white text-[12px] font-medium shadow-soft">{initials}</span>
        {!slim && (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px]">{user.name}</span>
              <span className="block truncate text-[11.5px] text-white/70">{user.email}</span>
            </span>
            <ChevronsUpDown className="size-3.5 shrink-0 opacity-70" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="end" sideOffset={10} className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{user.name}</span>
          <span className="text-muted-foreground block truncate font-mono text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} disabled={busy}><LogOut />{busy ? "Signing out…" : "Sign out"}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type Props = { user?: User; connection?: Connection; workspaces: Workspace[]; current?: Workspace };

function NavBody({ user, connection, workspaces, current, slim, onNavigate, onCollapse }: Props & {
  slim: boolean; onNavigate?: () => void; onCollapse?: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className={cn("flex h-10 items-center", slim ? "justify-center" : "justify-between pl-1.5")}>
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2 rounded-md text-white outline-none focus-visible:ring-2 focus-visible:ring-white/60">
          <LearisMark className="size-6" />
          {!slim && <span className="text-[19px] tracking-[-0.02em]">learis</span>}
        </Link>
        {onCollapse && !slim && (
          <button type="button" onClick={onCollapse} aria-label="Collapse the sidebar" title="Collapse"
            className="flex size-8 items-center justify-center rounded-md text-white/75 hover:bg-white/10 hover:text-white">
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <WorkspaceSwitcher workspaces={workspaces} current={current} slim={slim} />

      <nav aria-label="Main" className={cn("-mx-1 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 pt-1", slim && "items-center")}>
        {GROUPS.map((g) => (
          <div key={g.label || "main"} className={cn("flex flex-col gap-0.5", slim && "items-center")}>
            {g.label && (slim ? <div className="mx-auto mb-1 h-px w-6 bg-white/15" /> : <p className="mb-1 px-3 text-[12px] text-white/60">{g.label}</p>)}
            {g.items.map((it) => <NavTile key={it.href} item={it} on={isActive(pathname, it.href)} slim={slim} onNavigate={onNavigate} />)}
          </div>
        ))}
      </nav>

      <div className={cn("flex flex-col gap-1 border-t border-white/15 pt-3", slim && "items-center")}>
        <AIStatus c={connection} slim={slim} />
        <NavTile item={SETTINGS} on={isActive(pathname, SETTINGS.href)} slim={slim} onNavigate={onNavigate} />
        <UserMenu user={user} slim={slim} />
      </div>
    </div>
  );
}

/** Desktop: a rail on the blue canvas that collapses to icons. Phone: a top bar and a drawer. */
export function SideNav({ collapsed: initial = false, ...props }: Props & { collapsed?: boolean }) {
  const [slim, setSlim] = useState(initial);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const current = [...GROUPS.flatMap((g) => g.items), SETTINGS].find((i) => isActive(pathname, i.href));

  function toggle(next: boolean) {
    setSlim(next);
    document.cookie = `${NAV_COOKIE}=${next ? "slim" : "wide"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <>
      <aside className={cn("sticky top-0 hidden h-dvh shrink-0 transition-[width] duration-200 md:block", slim ? "w-[68px]" : "w-[248px]")}>
        <NavBody {...props} slim={slim} onCollapse={() => toggle(true)} />
        {slim && (
          <button type="button" onClick={() => toggle(false)} aria-label="Expand the sidebar" title="Expand"
            className="absolute top-14 -right-2.5 z-10 flex size-6 items-center justify-center rounded-full bg-white text-brand shadow-soft hover:bg-raised">
            <PanelLeftOpen className="size-3.5" />
          </button>
        )}
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center gap-2 px-3 md:hidden">
        <Sheet open={drawer} onOpenChange={setDrawer}>
          <SheetTrigger aria-label="Open the menu" className="flex size-9 items-center justify-center rounded-md bg-white text-brand shadow-soft">
            <Menu className="size-4" />
          </SheetTrigger>
          <SheetContent side="left" showCloseButton={false} className="bg-canvas dot-grid w-[280px] gap-0 border-0 p-0 text-white sm:max-w-[280px]">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <NavBody {...props} slim={false} onNavigate={() => setDrawer(false)} />
          </SheetContent>
        </Sheet>
        <LearisMark className="size-5 text-white" />
        <span className="min-w-0 flex-1 truncate text-[15px] text-white">{current?.title ?? "learis"}</span>
      </div>
    </>
  );
}
