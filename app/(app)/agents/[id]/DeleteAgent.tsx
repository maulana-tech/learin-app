"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { call } from "@/lib/ai-config";

export function DeleteAgent({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  return (
    <Button variant="outline" onClick={async () => {
      if (!confirm(`Delete the agent "${name}"? Tasks assigned to it stay, unassigned from it.`)) return;
      await call(`workspace-agents/${id}/delete`, {});
      router.push("/agents");
      router.refresh();
    }}><Trash2 className="size-4" /> Delete</Button>
  );
}
