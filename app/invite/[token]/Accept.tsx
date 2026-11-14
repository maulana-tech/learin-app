"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Dot } from "@/components/dort";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";

export function Accept({ token, workspaceId }: { token: string; workspaceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-2">
      <Button size="lg" className="w-full" disabled={busy} onClick={async () => {
        setBusy(true);
        setError("");
        try {
          await call(`invites/${token}/accept`, {});
          await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: workspaceId }) });
          router.push("/group");
          router.refresh();
        } catch (e) {
          setError(e instanceof Error ? e.message : "could not join");
        } finally {
          setBusy(false);
        }
      }}>{busy ? "Joining…" : "Join the group"}</Button>
      {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}
    </div>
  );
}
