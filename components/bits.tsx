import { FileCode2, FileText, FileType2, GitBranch } from "lucide-react";

import { cn } from "@/lib/utils";

/* Small shared pieces for the richer pages (server-safe; the drop zone lives in dropzone.tsx):
 * avatars, a load meter, a ring for a percentage, and a file-type icon. */

export function initials(name: string) {
  return name.split(/[\s@._-]+/).filter(Boolean).map((x) => x[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span title={name} className={cn("bg-brand flex shrink-0 items-center justify-center rounded-full font-medium text-white ring-2 ring-white",
      size === "sm" && "size-6 text-[9.5px]", size === "md" && "size-8 text-[11px]", size === "lg" && "size-10 text-[13px]", className)}>
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, max = 5, dark }: { names: string[]; max?: number; dark?: boolean }) {
  return (
    <div className="flex items-center">
      {names.slice(0, max).map((n, i) => <Avatar key={`${n}-${i}`} name={n} size="sm"
        className={cn(i && "-ml-1.5", dark && "bg-white text-[#111] ring-[#111]")} />)}
      {names.length > max && (
        <span className="bg-raised text-text -ml-1.5 flex size-6 items-center justify-center rounded-full text-[10px] ring-2 ring-white">+{names.length - max}</span>
      )}
    </div>
  );
}

/** Used against available, as a thin bar; over the limit it turns striped. */
export function Meter({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const over = value > max;
  return (
    <div className={cn("bg-inset h-1.5 w-full overflow-hidden rounded-full", className)} aria-hidden>
      <div className={cn("h-full rounded-full transition-[width]", over
        ? "bg-[repeating-linear-gradient(45deg,#111_0_4px,#555_4px_8px)]" : "bg-brand")} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** A percentage as a ring, the number in the middle. */
export function Ring({ value, size = 96, label, dark }: { value: number; size?: number; label?: string; dark?: boolean }) {
  const r = (size - 10) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} className={cn("fill-none", dark ? "stroke-white/15" : "stroke-[#ececec]")} strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} className={cn("fill-none transition-[stroke-dashoffset] duration-700", dark ? "stroke-white" : "stroke-brand")}
          strokeWidth={8} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-medium tabular-nums">{Math.round(v)}%</span>
        {label && <span className={cn("text-[10.5px]", dark ? "text-white/60" : "text-muted-foreground")}>{label}</span>}
      </div>
    </div>
  );
}

export function FileIcon({ name, url, className }: { name: string; url?: string | null; className?: string }) {
  const n = name.toLowerCase();
  const Icon = url?.includes("github.com") ? GitBranch : n.endsWith(".pdf") ? FileType2 : n.endsWith(".md") ? FileCode2 : FileText;
  return (
    <span className={cn("bg-raised text-text flex size-9 shrink-0 items-center justify-center rounded-lg", className)}>
      <Icon className="size-4" />
    </span>
  );
}

export const kb = (chars: number) => (chars >= 1000 ? `${(chars / 1000).toFixed(chars >= 10000 ? 0 : 1)}k chars` : `${chars} chars`);
