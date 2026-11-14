"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ToggleChips } from "@/components/ui/controls";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";

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
        <Input type="number" min={1} max={60} step={0.5} value={h} onChange={(e) => setH(e.target.value)} className="w-24" />
      </label>
      <div className="space-y-1">
        <span className="text-muted-foreground block text-xs">Exam weeks</span>
        <ToggleChips ariaLabel="Exam weeks" value={ex.map(String)} onValueChange={(v) => setEx(v.map(Number).sort())}
          items={[1, 2, 3, 4].map((w) => ({ value: String(w), label: `W${w}`, title: `Week ${w}` }))} />
      </div>
      <Button onClick={save} disabled={busy}>{busy ? "Replanning…" : "Replan"}</Button>
      {error && <p className="text-destructive w-full text-sm">{error}</p>}
    </div>
  );
}
