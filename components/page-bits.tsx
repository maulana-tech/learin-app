import Link from "next/link";

import { Dot } from "@/components/dort";
import { cn } from "@/lib/utils";

/* Page furniture shared by every screen, in the blue system (from AERA). */

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("w-full px-4 py-6 md:px-8 md:py-8", className)}>{children}</main>;
}

export function ServiceDown({ error }: { error?: string | null }) {
  return (
    <Page>
      <div className="bg-inner-grad max-w-xl rounded-lg border p-6">
        <p className="flex items-center gap-2 text-[15px] font-medium"><Dot tone="bad" />The agent service is not responding</p>
        {error && <p className="text-muted-foreground mt-2 text-[13px]">{error}</p>}
        <pre className="bg-raised text-text mt-4 rounded-md p-3 font-mono text-[12.5px]">cd learis/agent{"\n"}python3 api.py</pre>
      </div>
    </Page>
  );
}

/** A section with nothing in it yet, saying what fills it and where to go. */
export function EmptyState({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="dot-grid-soft rounded-lg border border-dashed px-5 py-8">
      <p className="text-[14px] font-medium">{title}</p>
      <p className="text-muted-foreground mt-1.5 max-w-xl text-[13px] leading-relaxed">{body}</p>
      {href && cta && <Link href={href} className="text-brand mt-3 inline-block text-[13px]">{cta} →</Link>}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="bg-inner-grad min-w-0 rounded-lg border p-4">
      <p className="text-muted-foreground text-[12px]">{label}</p>
      <p className="mt-1.5 font-mono text-xl font-medium tabular-nums">{value}</p>
      {note && <p className="text-muted-foreground mt-1 text-[11.5px] leading-snug">{note}</p>}
    </div>
  );
}
