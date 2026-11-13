"use client";

import { Check } from "lucide-react";
import { Checkbox as C, Switch as Sw, ToggleGroup as TG } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/* Small controls in the monochrome system: checkbox, switch, segmented control
 * and toggle chips. All Radix underneath, so keyboard and screen readers work. */

export function Checkbox({ checked, onCheckedChange, disabled, id, className, ariaLabel }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; id?: string;
  className?: string; ariaLabel?: string;
}) {
  return (
    <C.Root id={id} checked={checked} disabled={disabled} aria-label={ariaLabel}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      className={cn(
        "border-input flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border bg-white transition-colors outline-none",
        "hover:border-[rgba(0,0,0,0.4)] focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.25)]",
        "data-[state=checked]:border-brand data-[state=checked]:bg-brand data-[state=checked]:text-white disabled:opacity-50",
        className)}>
      <C.Indicator><Check className="size-3" strokeWidth={3} /></C.Indicator>
    </C.Root>
  );
}

export function Switch({ checked, onCheckedChange, disabled, id, ariaLabel }: {
  checked: boolean; onCheckedChange: (v: boolean) => void; disabled?: boolean; id?: string; ariaLabel?: string;
}) {
  return (
    <Sw.Root id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={ariaLabel}
      className={cn(
        "bg-inset inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-[rgba(0,0,0,0.08)] p-[2px] transition-colors outline-none",
        "focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.25)] data-[state=checked]:border-brand data-[state=checked]:bg-brand disabled:opacity-50")}>
      <Sw.Thumb className="block size-4 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform data-[state=checked]:translate-x-4" />
    </Sw.Root>
  );
}

/** A row label with a control on the left (checkbox) or right (switch), and an optional hint below. */
export function ControlRow({ control, label, hint, className }: {
  control: React.ReactNode; label: React.ReactNode; hint?: React.ReactNode; className?: string;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 text-[13.5px]", className)}>
      <span className="mt-0.5">{control}</span>
      <span className="min-w-0">
        <span className="text-fg">{label}</span>
        {hint && <span className="text-muted-foreground mt-0.5 block text-[12px] leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

export type Segment = { value: string; label?: React.ReactNode; icon?: React.ReactNode; title?: string };

/** One choice out of a few, as a pale track with the chosen segment raised in white. */
export function Segmented({ value, onValueChange, items, ariaLabel, size = "default", className }: {
  value: string; onValueChange: (v: string) => void; items: Segment[]; ariaLabel: string;
  size?: "default" | "sm"; className?: string;
}) {
  return (
    <TG.Root type="single" value={value} aria-label={ariaLabel}
      onValueChange={(v) => { if (v) onValueChange(v); }}
      className={cn("bg-raised inline-flex items-center gap-0.5 rounded-lg p-[3px]", className)}>
      {items.map((it) => (
        <TG.Item key={it.value} value={it.value} title={it.title} aria-label={it.title ?? (typeof it.label === "string" ? it.label : it.value)}
          className={cn(
            "text-muted-foreground inline-flex items-center justify-center gap-1.5 rounded-md transition-all outline-none",
            "hover:text-fg focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.25)]",
            "data-[state=on]:text-fg data-[state=on]:bg-white data-[state=on]:shadow-[0_1px_2px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.06)]",
            size === "default" ? "h-8 px-3 text-[13px]" : "h-7 px-2 text-[12px]",
            !it.label && (size === "default" ? "w-8 px-0" : "w-7 px-0"))}>
          {it.icon}{it.label}
        </TG.Item>
      ))}
    </TG.Root>
  );
}

/** Several independent on/off chips, e.g. exam weeks 1 to 4. */
export function ToggleChips({ value, onValueChange, items, ariaLabel }: {
  value: string[]; onValueChange: (v: string[]) => void; items: Segment[]; ariaLabel: string;
}) {
  return (
    <TG.Root type="multiple" value={value} onValueChange={onValueChange} aria-label={ariaLabel} className="inline-flex gap-1">
      {items.map((it) => (
        <TG.Item key={it.value} value={it.value} title={it.title}
          className={cn(
            "border-input text-text inline-flex h-9 min-w-9 items-center justify-center rounded-lg border bg-white px-2.5 text-[13px] transition-colors outline-none",
            "hover:border-[rgba(0,0,0,0.35)] focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.25)]",
            "data-[state=on]:border-brand data-[state=on]:bg-brand data-[state=on]:text-white")}>
          {it.icon}{it.label}
        </TG.Item>
      ))}
    </TG.Root>
  );
}
