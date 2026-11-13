"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";
import { cn } from "@/lib/utils";

/** Free hours and exam weeks. Saving replans at once: arithmetic, no model. */
export function PlanSettings({ hours, exams, canPlan }: { hours: number; exams: number[]; canPlan: boolean }) {
  const router = useRouter();
  const [h, setH] = useState(String(hours));
  const [ex, setEx] = useState<number[]>(exams);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      const body = { hours_per_week: Number(h), exam_weeks: ex };
      if (canPlan) await call("plan", body);
      else await call("student", body);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not replan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="space-y-1">
        <span className="text-muted-foreground block text-xs">Free hours a week</span>
        <input type="number" min={1} max={60} step={0.5} value={h} onChange={(e) => setH(e.target.value)}
          className="border-input w-24 rounded-lg border bg-white px-3 py-2 text-sm" />
      </label>
      <div className="space-y-1">
        <span className="text-muted-foreground block text-xs">Exam weeks</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((w) => (
            <button key={w} type="button" aria-pressed={ex.includes(w)}
              onClick={() => setEx(ex.includes(w) ? ex.filter((x) => x !== w) : [...ex, w].sort())}
              className={cn("size-9 rounded-lg border text-sm transition-colors",
                ex.includes(w) ? "border-brand bg-brand text-white" : "text-muted-foreground")}>
              {w}
            </button>
          ))}
        </div>
      </div>
      <Button onClick={save} disabled={busy}>{busy ? "Replanning…" : "Replan"}</Button>
      {error && <p className="text-destructive w-full text-sm">{error}</p>}
    </div>
  );
}
