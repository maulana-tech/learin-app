"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";

export function NewPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy} onClick={async () => {
      setBusy(true);
      try {
        const p = await call<{ id: string }>("pages", { title: "Untitled", content: "" });
        router.push(`/pages/${p.id}?edit=1`);
      } finally {
        setBusy(false);
      }
    }}><Plus className="size-4" /> New page</Button>
  );
}
