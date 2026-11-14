import { Chip, type Tone } from "@/components/dort";
import { cn } from "@/lib/utils";

/* Skill states in the blue system: the chip is pale blue, only the dot carries the state. */
export const STATUS: Record<string, { label: string; tone: Tone }> = {
  mastered: { label: "mastered", tone: "ok" },
  partial: { label: "partial", tone: "warn" },
  missing: { label: "missing", tone: "bad" },
};

export function statusOf(conf: number): "mastered" | "partial" | "missing" {
  return conf >= 0.6 ? "mastered" : conf >= 0.25 ? "partial" : "missing";
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? STATUS.missing;
  return <Chip tone={s.tone} className={className}>{s.label}</Chip>;
}

/** Confidence as a brand-blue bar with its number; the number is always written. */
export function Confidence({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-inset h-1.5 w-20 overflow-hidden rounded-full" aria-hidden>
        <div className={cn("h-full rounded-full", value >= 0.6 ? "bg-brand" : value >= 0.25 ? "bg-brand/60" : "bg-brand/30")}
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-muted-foreground font-mono text-[11px] tabular-nums">{pct}%</span>
    </div>
  );
}

const METHOD: Record<string, string> = {
  rule: "matched by rule",
  ai: "found by your model, quote checked",
  verified: "verified project",
};

export function MethodTag({ method }: { method: string }) {
  return <span className="text-muted-foreground font-mono text-[10.5px]">{METHOD[method] ?? method}</span>;
}

export const KIND_LABEL: Record<string, string> = {
  syllabus: "Syllabus", transcript: "Transcript", project: "Project README", github: "GitHub repo",
  portfolio: "Portfolio", cv: "CV / LinkedIn", other: "Other",
};
