import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const STATUS: Record<string, { label: string; badge: string; bar: string }> = {
  mastered: { label: "mastered", badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400", bar: "bg-emerald-500" },
  partial:  { label: "partial",  badge: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400", bar: "bg-amber-500" },
  missing:  { label: "missing",  badge: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400", bar: "bg-rose-500" },
};

export function statusOf(conf: number): "mastered" | "partial" | "missing" {
  return conf >= 0.6 ? "mastered" : conf >= 0.25 ? "partial" : "missing";
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? STATUS.missing;
  return <Badge variant="outline" className={cn("font-mono text-[10px]", s.badge, className)}>{s.label}</Badge>;
}

/** Confidence as a bar with its number. The colour follows the status, the number is always written. */
export function Confidence({ value, className }: { value: number; className?: string }) {
  const s = STATUS[statusOf(value)];
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="bg-muted h-1.5 w-20 overflow-hidden rounded-full" aria-hidden>
        <div className={cn("h-full rounded-full", s.bar)} style={{ width: `${Math.round(value * 100)}%` }} />
      </div>
      <span className="text-muted-foreground font-mono text-[11px] tabular-nums">{Math.round(value * 100)}%</span>
    </div>
  );
}

const METHOD: Record<string, string> = {
  rule: "matched by rule",
  ai: "found by your model, quote checked",
  verified: "verified project",
};

export function MethodTag({ method }: { method: string }) {
  return <span className="text-muted-foreground font-mono text-[10px]">{METHOD[method] ?? method}</span>;
}

export const KIND_LABEL: Record<string, string> = {
  syllabus: "Syllabus", transcript: "Transcript", project: "Project README", github: "GitHub repo",
  portfolio: "Portfolio", cv: "CV / LinkedIn", other: "Other",
};
