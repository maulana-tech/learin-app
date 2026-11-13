"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/skill-gap", label: "Overview" },
  { href: "/skill-gap/evidence", label: "Evidence" },
  { href: "/skill-gap/skills", label: "Skills" },
  { href: "/skill-gap/gap", label: "Gap map" },
  { href: "/skill-gap/plan", label: "Roadmap & plan" },
  { href: "/skill-gap/profile", label: "Profile" },
  { href: "/skill-gap/agents", label: "Pack agents" },
];

export function SkillGapTabs() {
  const path = usePathname();
  return (
    <div className="rail-x flex shrink-0 items-center gap-1 border-b px-4 py-2 md:px-6">
      <span className="text-muted-foreground mr-2 shrink-0 text-xs">Skill Gap Radar</span>
      {TABS.map((t) => {
        const on = t.href === "/skill-gap" ? path === t.href : path.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={cn("shrink-0 rounded-md px-2.5 py-1 text-[13px] transition-colors",
              on ? "bg-raised text-fg font-medium" : "text-muted-foreground hover:text-fg")}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
