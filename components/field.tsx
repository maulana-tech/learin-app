import { cn } from "@/lib/utils";

/* Form primitives in the blue system (from AERA's profile editor). */

export function Field({ label, hint, children, className, optional }: {
  label: string; hint?: string; children: React.ReactNode; className?: string; optional?: boolean;
}) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-text text-[12.5px]">
        {label}
        {optional && <span className="text-muted-foreground ml-1.5 text-[11px]">optional</span>}
      </span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="text-muted-foreground mt-1 block text-[11px] leading-relaxed">{hint}</span>}
    </label>
  );
}

const control = "border-input w-full rounded-lg border bg-white px-3 py-2 text-[13.5px] text-fg outline-none placeholder:text-muted-foreground/80 hover:border-[rgba(6,35,89,0.28)] focus-visible:border-[rgba(6,71,179,0.55)] focus-visible:ring-3 focus-visible:ring-[rgba(6,71,179,0.08)] disabled:opacity-60";

export function TextArea(props: React.ComponentProps<"textarea">) {
  return <textarea {...props} className={cn(control, props.className)} />;
}

export function Select(props: React.ComponentProps<"select">) {
  return <select {...props} className={cn(control, "h-9 py-0", props.className)} />;
}
