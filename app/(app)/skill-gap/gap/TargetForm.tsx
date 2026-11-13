"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Region, Role } from "@/app/lib";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";

const field = "border-input w-full rounded-lg border bg-white px-3 py-2 text-[13.5px] text-fg outline-none placeholder:text-muted-foreground/80 hover:border-[rgba(6,35,89,0.28)] focus-visible:border-[rgba(6,71,179,0.55)] focus-visible:ring-3 focus-visible:ring-[rgba(6,71,179,0.08)]";

export function TargetForm({ roles, regions, role, region }: {
  roles: Role[]; regions: Region[]; role: string | null; region: string | null;
}) {
  const router = useRouter();
  const [r, setR] = useState(role ?? roles[0]?.id ?? "");
  const [g, setG] = useState(region ?? regions[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = r !== role || g !== region;

  async function save() {
    setBusy(true);
    setError("");
    try {
      await call("student", { target_role: r, region: g });
      // Re-run the team so the gap map, roadmap and plan follow the new target.
      const { run_id } = await call<{ run_id: string }>("analyze", {}, { ai: true });
      for (let i = 0; i < 240; i++) {
        const run = await call<{ status: string }>(`runs/${run_id}`);
        if (run.status !== "running" && run.status !== "queued") break;
        await new Promise((res) => setTimeout(res, 700));
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="space-y-1">
        <span className="text-muted-foreground block text-xs">Target role</span>
        <select value={r} onChange={(e) => setR(e.target.value)} className={field}>
          {roles.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <label className="space-y-1">
        <span className="text-muted-foreground block text-xs">Region</span>
        <select value={g} onChange={(e) => setG(e.target.value)} className={field}>
          {regions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </label>
      <Button onClick={save} disabled={busy || (!changed && !!role)}>
        {busy ? "Updating…" : role ? "Update" : "Set target"}
      </Button>
      {error && <p className="text-destructive w-full text-sm">{error}</p>}
    </div>
  );
}
