"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
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
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={consent} disabled={busy}
          onChange={(e) => set({ consent: e.target.checked })} />
        <span>
          <span className="font-medium">Let my own AI model read my documents</span>
          <span className="text-muted-foreground block text-xs leading-relaxed">
            Without this, the agents use rules only and nothing you uploaded leaves this server.
            With it, document text is sent to the provider you connected above, under that provider&apos;s terms.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-1" checked={autoDelete} disabled={busy}
          onChange={(e) => set({ auto_delete: e.target.checked })} />
        <span>
          <span className="font-medium">Delete full text after analysis</span>
          <span className="text-muted-foreground block text-xs leading-relaxed">
            Only the short quotes that prove each skill are kept. Turn off to be able to read documents again.
          </span>
        </span>
      </label>
      <div className="border-t pt-4">
        <Button variant="destructive" disabled={busy} onClick={async () => {
          if (!confirm("Delete every document, skill, plan and run stored about you? This cannot be undone.")) return;
          setBusy(true);
          try { await call("me/delete", { confirm: "delete" }); router.push("/"); router.refresh(); }
          finally { setBusy(false); }
        }}>Delete all my data</Button>
      </div>
    </div>
  );
}
