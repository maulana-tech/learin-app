"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { Run } from "@/app/lib";
import { AgentPanel } from "@/components/agent-panel";
import { Button } from "@/components/ui/button";
import { call, useAIConfig } from "@/lib/ai-config";

/** Runs the agent team and shows each agent's work as it happens. */
export function AnalyseButton({ label = "Run the agents", showPanel = true }: {
  label?: string; showPanel?: boolean;
}) {
  const router = useRouter();
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState("");
  const model = useAIConfig()?.model ?? null;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function poll(id: string) {
    try {
      const r = await call<Run>(`runs/${id}`);
      setRun(r);
      if (r.status === "running" || r.status === "queued") timer.current = setTimeout(() => poll(id), 700);
      else router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "lost the run");
    }
  }

  async function start() {
    setError("");
    setRun(null);
    try {
      const { run_id } = await call<{ run_id: string }>("analyze", {}, { ai: true });
      setRun({ id: run_id, status: "queued", ai: null, started_at: "", finished_at: null, error: null, steps: [] });
      poll(run_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not start");
    }
  }

  const busy = run?.status === "running" || run?.status === "queued";
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={start} disabled={busy}>
          <Play className="size-4" /> {run?.status === "queued" ? "Waiting for a worker…" : busy ? "Agents working…" : label}
        </Button>
        <span className="text-muted-foreground text-xs">
          {model ? <>with your model <span className="font-mono">{model}</span></> : "rules only (no model connected)"}
        </span>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {showPanel && run?.steps && run.steps.length > 0 && (
        <AgentPanel steps={run.steps} live={busy} />
      )}
      {run?.status === "failed" && <p className="text-destructive text-sm">{run.error}</p>}
    </div>
  );
}
