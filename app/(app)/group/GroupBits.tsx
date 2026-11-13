"use client";

import { Copy, FileText, Link2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { Dot } from "@/components/dort";
import { Field, TextArea } from "@/components/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { call } from "@/lib/ai-config";

async function switchTo(id: string) {
  await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
}

export function CreateGroup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form className="bg-inner-grad max-w-xl space-y-4 rounded-lg border p-4" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError("");
      try {
        const g = await call<{ id: string }>("workspaces", { name, purpose });
        await switchTo(g.id);
        router.push("/group");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "could not create");
      } finally {
        setBusy(false);
      }
    }}>
      <Field label="Group name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kelompok Basis Data · Relawan Mengajar" required /></Field>
      <Field label="What it is for" optional hint="Shown to people you invite, and at the top of activity reports.">
        <TextArea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Tugas besar sistem perpustakaan, 4 orang" />
      </Field>
      {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}
      <Button type="submit" disabled={busy}><Plus className="size-4" /> {busy ? "Creating…" : "Create group"}</Button>
    </form>
  );
}

export function InviteLink({ workspaceId }: { workspaceId: string }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  return (
    <div className="space-y-2">
      <Button variant="outline" onClick={async () => {
        const r = await call<{ token: string }>(`workspaces/${workspaceId}/invite`, {});
        setLink(`${origin}/invite/${r.token}`);
        setCopied(false);
      }}><Link2 className="size-4" /> {link ? "New invite link" : "Invite friends"}</Button>
      {link && (
        <div className="flex items-center gap-2">
          <code className="bg-raised min-w-0 flex-1 truncate rounded-md px-2.5 py-1.5 font-mono text-[12px]">{link}</code>
          <Button size="sm" variant="ghost" onClick={async () => { await navigator.clipboard.writeText(link); setCopied(true); }}>
            <Copy className="size-3.5" /> {copied ? "Copied" : "Copy"}
          </Button>
        </div>
      )}
      {link && <p className="text-muted-foreground text-[12px]">Valid for 7 days, up to 25 people. Anyone with the link who signs in joins this group.</p>}
    </div>
  );
}

export function MyHours({ workspaceId, hours }: { workspaceId: string; hours: number }) {
  const router = useRouter();
  const [h, setH] = useState(String(hours));
  return (
    <form className="flex items-end gap-2" onSubmit={async (e) => {
      e.preventDefault();
      await call(`workspaces/${workspaceId}/hours`, { hours: Number(h) });
      router.refresh();
    }}>
      <Field label="My free hours a week here" hint="The Planner will not pile more than this on you."><Input type="number" min={1} max={60} step={0.5} value={h} onChange={(e) => setH(e.target.value)} className="w-28" /></Field>
      <Button type="submit" variant="outline">Save</Button>
    </form>
  );
}

export function RemoveMember({ workspaceId, userId, label }: { workspaceId: string; userId: string; label: string }) {
  const router = useRouter();
  return (
    <Button size="sm" variant="ghost" onClick={async () => {
      if (!confirm(`${label}?`)) return;
      await call(`workspaces/${workspaceId}/members/${userId}/remove`, {});
      if (label.startsWith("Leave")) await fetch("/api/workspace", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      router.refresh();
    }}>{label.startsWith("Leave") ? "Leave" : "Remove"}</Button>
  );
}

export function ReportButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy} onClick={async () => {
      setBusy(true);
      try { const p = await call<{ id: string }>("group-report", {}); router.push(`/pages/${p.id}`); }
      finally { setBusy(false); }
    }}><FileText className="size-4" /> {busy ? "Writing…" : "Write activity report"}</Button>
  );
}
