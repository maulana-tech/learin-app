"use client";

import { RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";

export function DeleteDoc({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button variant="ghost" size="icon" disabled={busy} aria-label={`Delete ${title}`}
      onClick={async () => {
        if (!confirm(`Delete "${title}" and every skill it proved?`)) return;
        setBusy(true);
        try { await call(`documents/${id}/delete`, {}); router.refresh(); } finally { setBusy(false); }
      }}>
      <Trash2 className="size-4" />
    </Button>
  );
}

export function Reanalyse() {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={async () => {
        const r = await call<{ pending: number }>("documents/reanalyse", {});
        setMsg(r.pending ? `${r.pending} kept document(s) will be read again on the next run`
          : "No kept text to read again: auto-delete removed it after analysis");
        router.refresh();
      }}>
        <RotateCcw className="size-4" /> Read again
      </Button>
      {msg && <span className="text-muted-foreground text-xs">{msg}</span>}
    </div>
  );
}
