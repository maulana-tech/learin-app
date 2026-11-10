import Link from "next/link";

import { cn } from "@/lib/utils";

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cn("w-full px-4 py-4 md:px-6 md:py-8", className)}>{children}</main>;
}

export function ServiceDown({ error }: { error?: string | null }) {
  return (
    <Page>
      <h1 className="text-xl font-semibold">The agent service is not responding</h1>
      {error && <p className="text-muted-foreground mt-2 text-sm">{error}</p>}
      <pre className="bg-card mt-4 rounded-lg border p-4 font-mono text-sm">
        cd learis/agent{"\n"}python3 api.py
      </pre>
    </Page>
  );
}

/** A section with nothing in it yet, saying what fills it and where to go. */
export function EmptyState({ title, body, href, cta }: {
  title: string; body: string; href?: string; cta?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed p-6 md:p-8">
      <p className="text-sm font-medium">{title}</p>
      <p className="text-muted-foreground mt-1 max-w-xl text-sm leading-relaxed">{body}</p>
      {href && cta && (
        <Link href={href} className="mt-3 inline-block text-sm font-medium underline underline-offset-4">
          {cta}
        </Link>
      )}
    </div>
  );
}

export function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="min-w-0 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {note && <p className="text-muted-foreground mt-1 text-xs leading-snug">{note}</p>}
    </div>
  );
}
