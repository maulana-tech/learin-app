import { Chip, type Tone } from "@/components/dort";

/* A status, in the blue system: a pale chip, and colour only in its dot. */
const TONES: Record<string, Tone> = {
  done: "ok", sent: "ok", ok: "ok", approved: "ok", delivered: "ok",
  running: "info", queued: "info",
  held: "warn", pending: "warn", late: "warn", short: "warn",
  failed: "bad", rejected: "bad",
  skipped: "neutral", off: "neutral", cancelled: "neutral", guided: "neutral",
};

export function StatusBadge({ status, className, children }: {
  status: string; className?: string; children?: React.ReactNode;
}) {
  return <Chip tone={TONES[status] ?? "neutral"} className={className}>{children ?? status}</Chip>;
}

const ORIGINS: Record<string, Tone> = { live: "ok", cached: "info", derived: "solid", modelled: "warn", missing: "bad" };

/** The data-origin label: what separates a figure you may trust from one you may not. */
export function OriginBadge({ origin, source }: { origin: string; source?: string | null }) {
  if (!(origin in ORIGINS)) return null;
  return <Chip tone={ORIGINS[origin]} className="font-mono text-[11px]">{origin}{source ? ` · ${source}` : ""}</Chip>;
}
