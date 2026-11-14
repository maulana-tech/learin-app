"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Region, Role } from "@/app/lib";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { call } from "@/lib/ai-config";


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
      <div className="w-56 space-y-1">
        <span className="text-muted-foreground block text-xs">Target role</span>
        <Select value={r} onValueChange={setR} ariaLabel="Target role"
          options={roles.map((x) => ({ value: x.id, label: x.name, hint: `${x.skills} skills` }))} />
      </div>
      <div className="w-44 space-y-1">
        <span className="text-muted-foreground block text-xs">Region</span>
        <Select value={g} onValueChange={setG} ariaLabel="Region" options={regions.map((x) => ({ value: x.id, label: x.name }))} />
      </div>
      <Button onClick={save} disabled={busy || (!changed && !!role)}>
        {busy ? "Updating…" : role ? "Update" : "Set target"}
      </Button>
      {error && <p className="text-destructive w-full text-sm">{error}</p>}
    </div>
  );
}
