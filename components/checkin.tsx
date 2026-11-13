"use client";

import { CalendarCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Reminder } from "@/app/lib";
import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";

/** The weekly check-in the scheduler raises once a plan is a week old. */
export function CheckIn({ reminder }: { reminder: Reminder }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="rounded-lg border border-sky-500/40 bg-sky-500/5 p-4">
      <div className="flex items-start gap-3">
        <CalendarCheck className="mt-0.5 size-4 shrink-0 text-sky-600" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm">{reminder.message}</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line: what went well, what did not (optional)"
            className="border-input w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-sm dark:bg-input/30" />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={busy} onClick={async () => {
              setBusy(true);
              try { await call(`reminders/${reminder.id}/done`, { note }); router.refresh(); } finally { setBusy(false); }
            }}>Done</Button>
            <Button size="sm" variant="outline" asChild><Link href="/skill-gap/plan">Adjust the plan</Link></Button>
          </div>
        </div>
      </div>
    </div>
  );
}
