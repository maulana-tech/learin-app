"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { call } from "@/lib/ai-config";

/* Share a page or a community agent as a public link. Anyone can open it without an account;
 * the link is how LEARIS spreads, and the sharer sees how many people opened it and joined. */

type Status = { shared: false } | { shared: true; token: string; views: number; signups: number; since: string };

const PATH = { page: "p", agent: "a" } as const;

export function shareUrl(kind: "page" | "agent", token: string) {
  return `${window.location.origin}/${PATH[kind]}/${token}`;
}

export function ShareButton({ kind, id, title, size = "default", variant = "outline" }: {
  kind: "page" | "agent"; id: string; title: string;
  size?: "default" | "sm"; variant?: "outline" | "default" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [st, setSt] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    call<Status>(`share/${kind}/${id}`).then(setSt).catch((e) => setError(String(e.message ?? e)));
  }, [open, kind, id]);

  async function turn(on: boolean) {
    setBusy(true); setError("");
    try { setSt(await call<Status>(`share/${kind}/${id}${on ? "" : "/off"}`, {})); }
    catch (e) { setError(e instanceof Error ? e.message : "could not change the link"); }
    finally { setBusy(false); }
  }

  const url = st?.shared ? shareUrl(kind, st.token) : "";
  const blurb = kind === "page"
    ? `${title}: every claim links to the exact quote from the course file. Made with LEARIS.`
    : `${title}: an AI study agent you can install in one click on LEARIS.`;
  const enc = encodeURIComponent;
  const targets = url ? [
    { label: "WhatsApp", href: `https://wa.me/?text=${enc(`${blurb} ${url}`)}` },
    { label: "Telegram", href: `https://t.me/share/url?url=${enc(url)}&text=${enc(blurb)}` },
    { label: "X", href: `https://x.com/intent/post?text=${enc(blurb)}&url=${enc(url)}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
  ] : [];

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}><Share2 className="size-4" /> Share</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card-grad max-w-lg rounded-2xl p-0 shadow-float">
          <DialogHeader className="border-b">
            <DialogTitle className="flex items-center gap-2"><Link2 className="size-4" /> Share {kind === "page" ? "this page" : "this agent"}</DialogTitle>
            <DialogDescription className="text-[12.5px]">
              {kind === "page"
                ? "Anyone with the link can read it, with each claim's quote, without an account. Your files, workspace and email are not shown: only the quotes the page cites and the files' names."
                : "Anyone with the link can see what the agent does and install it after signing up. Nobody's files travel with it."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-5">
            {!st ? <p className="text-muted-foreground text-[13px]">{error || "Loading…"}</p> : st.shared ? (
              <>
                <div className="flex gap-2">
                  <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Public link"
                    className="bg-background min-w-0 flex-1 rounded-md border px-3 py-2 font-mono text-[12px]" />
                  <Button onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1600); }}>
                    {copied ? <Check className="size-4" /> : <Copy className="size-4" />}{copied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {targets.map((t) => (
                    <a key={t.label} href={t.href} target="_blank" rel="noopener noreferrer"
                      className="hover:bg-hover rounded-full border px-3 py-1.5 text-[12.5px]">{t.label}</a>
                  ))}
                  {typeof navigator !== "undefined" && "share" in navigator && (
                    <button type="button" className="hover:bg-hover rounded-full border px-3 py-1.5 text-[12.5px]"
                      onClick={() => navigator.share({ title, text: blurb, url }).catch(() => {})}>More…</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border bg-white/60 p-3 dark:bg-white/5">
                    <p className="text-2xl font-medium tabular-nums">{st.views}</p>
                    <p className="text-muted-foreground text-[12px]">opened the link</p>
                  </div>
                  <div className="rounded-lg border bg-white/60 p-3 dark:bg-white/5">
                    <p className="text-2xl font-medium tabular-nums">{st.signups}</p>
                    <p className="text-muted-foreground text-[12px]">joined LEARIS from it</p>
                  </div>
                </div>
                <button type="button" disabled={busy} onClick={() => turn(false)}
                  className="text-muted-foreground hover:text-bad text-[12.5px] underline-offset-4 hover:underline">
                  Turn the link off
                </button>
              </>
            ) : (
              <Button onClick={() => turn(true)} disabled={busy} className="w-full">
                <Link2 className="size-4" /> {busy ? "Creating…" : "Create a public link"}
              </Button>
            )}
            {error && st && <p className="text-bad text-[12.5px]">{error}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
