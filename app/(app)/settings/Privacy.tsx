"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ControlRow, Switch } from "@/components/ui/controls";
import { call } from "@/lib/ai-config";

export function Privacy({ consent, autoDelete }: { consent: boolean; autoDelete: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(body: Record<string, unknown>) {
    setBusy(true);
    try { await call("student", body); router.refresh(); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <ControlRow control={<Switch checked={consent} disabled={busy} onCheckedChange={(v) => set({ consent: v })} />}
        label="Let an AI model read my documents"
        hint="Without this, the Skill Gap agents use rules only and nothing you uploaded leaves this server. With it, document text is sent to the model provider, under that provider's terms." />
      <ControlRow control={<Switch checked={autoDelete} disabled={busy} onCheckedChange={(v) => set({ auto_delete: v })} />}
        label="Delete full text after analysis"
        hint="Only the short quotes that prove each skill are kept. Turn off to be able to read documents again." />
      <div className="border-t pt-4">
        <Button variant="destructive" disabled={busy} onClick={async () => {
          if (!confirm("Delete your account and everything stored about you: documents, skills, plans, chats and your personal workspace? A group you own passes to its longest-standing member. This cannot be undone.")) return;
          setBusy(true);
          try {
            await call("me/delete", { confirm: "delete" });
            await fetch("/api/login", { method: "DELETE" });
            router.push("/login"); router.refresh();
          } finally { setBusy(false); }
        }}>Delete my account and data</Button>
      </div>
    </div>
  );
}
