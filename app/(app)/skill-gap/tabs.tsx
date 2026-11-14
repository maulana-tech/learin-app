"use client";

import { Bot, FileSearch, LayoutDashboard, Map, Radar, Route, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/skill-gap", label: "Overview", icon: LayoutDashboard },
  { href: "/skill-gap/evidence", label: "Evidence", icon: FileSearch },
  { href: "/skill-gap/skills", label: "Skills", icon: Radar },
  { href: "/skill-gap/gap", label: "Gap map", icon: Map },
  { href: "/skill-gap/plan", label: "Roadmap & plan", icon: Route },
  { href: "/skill-gap/profile", label: "Profile", icon: UserRound },
  { href: "/skill-gap/agents", label: "Pack agents", icon: Bot },
];

export function SkillGapTabs() {
  const path = usePathname();
  return (
    <div className="rail-x sticky top-0 z-10 flex shrink-0 items-center gap-1 border-b bg-white px-4 md:px-8">
      <span className="mr-3 flex shrink-0 items-center gap-1.5 py-2.5 text-[12.5px] font-medium">
        <span className="bg-brand flex size-5 items-center justify-center rounded-md text-white"><Radar className="size-3" /></span>
        Skill Gap Radar
      </span>
      {TABS.map((t) => {
        const on = t.href === "/skill-gap" ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={cn("relative flex shrink-0 items-center gap-1.5 px-2.5 py-3 text-[13px] transition-colors",
              on ? "text-fg font-medium" : "text-muted-foreground hover:text-fg")}>
            <t.icon className="size-3.5" />{t.label}
            {on && <span className="bg-brand absolute inset-x-2 -bottom-px h-0.5 rounded-full" />}
          </Link>
        );
      })}
    </div>
  );
}
