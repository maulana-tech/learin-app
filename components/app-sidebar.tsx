"use client";

import Link from "next/link";

import {
  Bot, FileText, LayoutDashboard, ListChecks, Radar, Settings2, Sparkles, UserRound,
} from "lucide-react";

import { LearisMark } from "@/components/learis-mark";
import { NavMain, type NavItem } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { ConnectionStatus, type Connection } from "@/components/connection-status";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail,
} from "@/components/ui/sidebar";

// In the order a student walks through it: evidence in, gap out, plan, profile.
const JOURNEY: NavItem[] = [
  { title: "Overview", href: "/", icon: LayoutDashboard },
  { title: "Evidence", href: "/evidence", icon: FileText },
  { title: "Skills", href: "/skills", icon: Sparkles },
  { title: "Gap map", href: "/gap", icon: Radar },
  { title: "Roadmap & plan", href: "/plan", icon: ListChecks },
  { title: "Profile", href: "/profile", icon: UserRound },
];

const TEAM: NavItem[] = [
  { title: "Agent team", href: "/agents", icon: Bot },
];

const SETTINGS: NavItem[] = [
  { title: "AI & privacy", href: "/settings", icon: Settings2 },
];

export function AppSidebar({
  user, connection, ...props
}: {
  user?: { name: string; role: string; email: string };
  connection?: Connection;
} & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <LearisMark className="size-6 shrink-0" />
          <span className="truncate text-sm font-semibold tracking-[-0.03em] group-data-[collapsible=icon]:hidden">
            LEARIS
          </span>
        </Link>
        <ConnectionStatus c={connection} />
      </SidebarHeader>

      <SidebarContent>
        <NavMain label="Your journey" items={JOURNEY} />
        <NavMain label="Agents" items={TEAM} />
        <NavMain items={SETTINGS} />
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
