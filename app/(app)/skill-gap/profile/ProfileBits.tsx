"use client";

import { Check, Copy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";

export function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button variant="ghost" size="sm" onClick={async () => {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    }}>
      {done ? <Check className="size-4" /> : <Copy className="size-4" />} {done ? "Copied" : "Copy"}
    </Button>
  );
}

/** The LinkedIn/CV text the student pastes. Used to find hidden skills and to match their voice. */
export function ProfileText({ initial }: { initial: string }) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
        placeholder="Paste your LinkedIn About, headline or CV text. LinkedIn has no public API, so pasting is the honest way."
        className="border-input w-full rounded-lg border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30" />
      <div className="flex items-center gap-2">
        <Button variant="outline" disabled={busy} onClick={async () => {
          setBusy(true);
          try { await call("student", { profile_text: text }); setMsg("Saved. Run the agents to refresh the suggestions."); router.refresh(); }
          catch (e) { setMsg(e instanceof Error ? e.message : "could not save"); }
          finally { setBusy(false); }
        }}>Save profile text</Button>
        {msg && <span className="text-muted-foreground text-xs">{msg}</span>}
      </div>
    </div>
  );
}
