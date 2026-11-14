import { AlertTriangle, CheckCircle2, CircleDot, Loader2, Wrench, XCircle } from "lucide-react";

import type { RunStep } from "@/app/lib";
import { AgentBadge } from "@/components/agent-card";
import { cn } from "@/lib/utils";

export const AGENT_NAME: Record<string, string> = {
  orchestrator: "Orchestrator",
  evidence: "Skill Evidence",
  roadmap: "Roadmap",
  planner: "Planner",
  profile: "Profile",
};

const ICON = {
  start: CircleDot, info: CircleDot, tool: Wrench, result: CheckCircle2, warn: AlertTriangle, error: XCircle,
};
const TONE = {
  start: "text-info", info: "text-muted-foreground", tool: "text-brand",
  result: "text-ok", warn: "text-warn", error: "text-bad",
};

/** What each agent did on a run, in order. While `live`, the last agent shows as working. */
export function AgentPanel({ steps, live = false }: { steps: RunStep[]; live?: boolean }) {
  const groups: { agent: string; steps: RunStep[] }[] = [];
  for (const s of steps) {
    const last = groups[groups.length - 1];
    if (last && last.agent === s.agent) last.steps.push(s);
    else groups.push({ agent: s.agent, steps: [s] });
  }
  return (
    <ol className="space-y-3">
      {groups.map((g, gi) => {
        const working = live && gi === groups.length - 1 && !g.steps.some((s) => s.kind === "result");
        return (
          <li key={`${g.agent}-${gi}`} className={cn("bg-inner-grad rounded-lg border p-3", working && "glow-top")}>
            <div className="flex items-center gap-2 text-sm font-medium">
              <AgentBadge nickname={AGENT_NAME[g.agent] ?? g.agent} size="sm" showTooltip={false} />
              {AGENT_NAME[g.agent] ?? g.agent}
              {working ? <Loader2 className="text-brand size-4 animate-spin" /> : <span className="text-muted-foreground font-mono text-[10px]">agent</span>}
            </div>
            <ul className="mt-2 space-y-1.5">
              {g.steps.map((s) => {
                const Icon = ICON[s.kind] ?? CircleDot;
                return (
                  <li key={s.seq} className="flex gap-2 text-xs leading-relaxed">
                    <Icon className={cn("mt-0.5 size-3.5 shrink-0", TONE[s.kind])} />
                    <span className={cn(s.kind === "result" && "font-medium", s.kind === "tool" && "font-mono text-[11px]",
                      s.kind === "tool" && s.detail?.ok === false && "text-warn")}>
                      {s.message}
                    </span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
