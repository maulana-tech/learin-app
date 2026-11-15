"use client";

import { ArrowRight, Check, Copy, FileText, Link2, Plus, Users } from "lucide-react";
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
    <form className="space-y-4 rounded-xl border bg-white p-5 shadow-soft" onSubmit={async (e) => {
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
      <Field label="Group name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Database study group · Teaching volunteers" required /></Field>
      <Field label="What it is for" optional hint="Shown to people you invite, and at the top of activity reports.">
        <TextArea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Library database group project, 4 people" />
      </Field>
      {error && <p className="text-bad flex items-center gap-2 text-[13px]"><Dot tone="bad" />{error}</p>}
      <Button type="submit" disabled={busy}><Plus className="size-4" /> {busy ? "Creating…" : "Create group"}</Button>
    </form>
  );
}

export function InviteLink({ workspaceId, compact, dark }: { workspaceId: string; compact?: boolean; dark?: boolean }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const origin = useSyncExternalStore(() => () => {}, () => window.location.origin, () => "");
  async function make() {
    const r = await call<{ token: string }>(`workspaces/${workspaceId}/invite`, {});
    const l = `${origin}/invite/${r.token}`;
    setLink(l);
    setCopied(false);
    return l;
  }
  if (compact) {
    return (
      <Button variant="outline" title="Valid for 7 days, up to 25 people"
        className={dark ? "border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white" : undefined} onClick={async () => {
        const l = link || await make();
        try { await navigator.clipboard.writeText(l); setCopied(true); } catch { prompt("Invite link", l); }
      }}>
        {copied ? <Check className="size-4" /> : <Link2 className="size-4" />} {copied ? "Link copied" : "Invite friends"}
      </Button>
    );
  }
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
    <form onSubmit={async (e) => {
      e.preventDefault();
      await call(`workspaces/${workspaceId}/hours`, { hours: Number(h) });
      router.refresh();
    }}>
      <p className="text-text text-[12.5px]">My free hours a week here</p>
      <div className="mt-1.5 flex items-center gap-2">
        <Input type="number" min={1} max={60} step={0.5} value={h} onChange={(e) => setH(e.target.value)} className="w-28" />
        <Button type="submit" variant="outline">Save</Button>
      </div>
      <p className="text-muted-foreground mt-1.5 text-[11.5px]">The Planner will not pile more than this on you.</p>
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

export function ReportButton({ dark }: { dark?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button disabled={busy} className={dark ? "bg-white text-[#111] hover:bg-[#ececec]" : undefined} onClick={async () => {
      setBusy(true);
      try { const p = await call<{ id: string }>("group-report", {}); router.push(`/pages/${p.id}`); }
      finally { setBusy(false); }
    }}><FileText className="size-4" /> {busy ? "Writing…" : "Write activity report"}</Button>
  );
}

export function OpenGroup({ id, name, members }: { id: string; name: string; members: number }) {
  const router = useRouter();
  return (
    <button type="button" onClick={async () => { await switchTo(id); router.push("/group"); router.refresh(); }}
      className="flex w-full items-center gap-3 rounded-xl border bg-white p-3 text-left shadow-soft transition-colors hover:border-[rgba(0,0,0,0.3)]">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#111] text-white"><Users className="size-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{name}</span>
        <span className="text-muted-foreground block text-[11.5px]">{members} member(s)</span>
      </span>
      <ArrowRight className="text-muted-foreground size-4" />
    </button>
  );
}
