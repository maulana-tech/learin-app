import Link from "next/link";

import type { Reach } from "@/app/lib";

/* What your shared links did: opened, and the friends who joined through them. */
export function ReachCard({ reach }: { reach: Reach | null }) {
  if (!reach) return null;
  if (!reach.links && !reach.signups && !reach.invite_joins) {
    return (
      <div className="rounded-xl border border-dashed p-4 text-[12.5px] leading-relaxed">
        <span className="font-medium">Share what you made.</span>{" "}
        <span className="text-muted-foreground">Open a page and press Share: friends read it with every quote, no account needed, and you see how many opened it and joined.</span>
      </div>
    );
  }
  const cells: [string, number][] = [
    ["public links", reach.links], ["opened", reach.views],
    ["friends joined", reach.signups], ["agent installs", reach.agent_installs],
  ];
  return (
    <div className="rounded-xl bg-[#111] p-5 text-white">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium">Your reach</p>
        <p className="text-[11.5px] text-white/55">counted from the links themselves; no tracking scripts</p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cells.map(([label, n]) => (
          <div key={label}><p className="font-mono text-2xl tabular-nums">{n}</p><p className="text-[11.5px] text-white/60">{label}</p></div>
        ))}
      </div>
      {reach.top.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-white/10 pt-3 text-[12.5px]">
          {reach.top.map((t) => (
            <li key={t.token} className="flex justify-between gap-3">
              <Link href={`/${t.kind === "page" ? "p" : "a"}/${t.token}`} className="truncate hover:underline">{t.title}</Link>
              <span className="shrink-0 text-white/60 tabular-nums">{t.views} opened · {t.signups} joined</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
