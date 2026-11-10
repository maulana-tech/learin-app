"use client";

import { Circle } from "lucide-react";
import Link from "next/link";

import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { useAIConfig } from "@/lib/ai-config";

export type Connection = { env: string; server_ai: boolean };

/** Which model the agents will use: the student's own, the deployment's, or none (rules only). */
export function ConnectionStatus({ c }: { c?: Connection }) {
  const own = useAIConfig()?.model ?? null;
  const up = !!c;
  const label = !up ? "agent service down" : own ? `AI: ${own}` : c?.server_ai ? "AI: server model" : "rules only · connect AI";
  const dot = !up ? "fill-rose-500 text-rose-500"
    : own || c?.server_ai ? "fill-emerald-500 text-emerald-500" : "fill-amber-500 text-amber-500";
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip={label}>
          <Link href="/settings">
            <Circle className={`size-2 ${dot}`} />
            <span className="truncate text-xs">{label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
