"use client";

import { Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";

export function Install({ id, workspaceName }: { id: string; workspaceName: string }) {
  const router = useRouter();
  const [state, setState] = useState<"" | "busy" | "done">("");
  return (
    <Button size="sm" variant={state === "done" ? "outline" : "default"} disabled={state !== ""}
      onClick={async () => {
        setState("busy");
        try { await call(`gallery/${id}/install`, {}); setState("done"); router.refresh(); }
        catch { setState(""); }
      }}>
      <Download className="size-3.5" />
      {state === "done" ? `Installed in ${workspaceName}` : state === "busy" ? "Installing…" : "Install"}
    </Button>
  );
}
