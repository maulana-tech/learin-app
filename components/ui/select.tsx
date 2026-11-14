"use client";

import { Check, ChevronDown } from "lucide-react";
import { Select as S } from "radix-ui";
import * as React from "react";

import { cn } from "@/lib/utils";

/* A select in the monochrome system: a white control that opens a floating
 * panel, the chosen row ticked. Built on Radix, so it is keyboard- and
 * screen-reader-correct, and it looks the same in every browser (a native
 * <select> does not).
 *
 * Radix reserves the empty string, so "nothing chosen" is any value the caller
 * maps itself (for example "none"). */

export type SelectOption = {
  value: string; label: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode;
  group?: string; disabled?: boolean;
};

export function Select({ value, onValueChange, options, placeholder, disabled, size = "default", variant = "default",
  className, contentClassName, ariaLabel, renderValue }: {
  value: string; onValueChange: (v: string) => void; options: SelectOption[]; placeholder?: string;
  disabled?: boolean; size?: "default" | "sm" | "xs"; variant?: "default" | "ghost"; className?: string;
  contentClassName?: string; ariaLabel?: string;
  /** What the closed control shows; defaults to the chosen option's icon and label. */
  renderValue?: (o: SelectOption | undefined) => React.ReactNode;
}) {
  const chosen = options.find((o) => o.value === value);
  const groups: { name: string | undefined; items: SelectOption[] }[] = [];
  for (const o of options) {
    const g = groups.find((x) => x.name === o.group);
    if (g) g.items.push(o); else groups.push({ name: o.group, items: [o] });
  }
  return (
    <S.Root value={value} onValueChange={onValueChange} disabled={disabled}>
      <S.Trigger aria-label={ariaLabel}
        className={cn(
          "group/select text-fg inline-flex w-full min-w-0 items-center justify-between gap-2 outline-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-[rgba(0,0,0,0.25)] disabled:cursor-not-allowed disabled:opacity-55",
          variant === "default" && "border-input rounded-lg border bg-white shadow-[0_1px_0_rgba(0,0,0,0.03)] hover:border-[rgba(0,0,0,0.28)] data-[state=open]:border-[rgba(0,0,0,0.5)]",
          variant === "ghost" && "rounded-md bg-transparent hover:bg-raised data-[state=open]:bg-raised",
          size === "default" && "h-9 px-3 text-[13.5px]",
          size === "sm" && "h-8 px-2.5 text-[13px]",
          size === "xs" && "h-7 px-2 text-[12px]",
          className)}>
        <span className="flex min-w-0 items-center gap-2 truncate">
          {renderValue ? renderValue(chosen) : chosen ? <>{chosen.icon}<span className="truncate">{chosen.label}</span></>
            : <span className="text-muted-foreground truncate">{placeholder ?? "Choose…"}</span>}
        </span>
        <S.Icon asChild>
          <ChevronDown className="text-muted-foreground size-3.5 shrink-0 transition-transform group-data-[state=open]/select:rotate-180" />
        </S.Icon>
      </S.Trigger>
      <S.Portal>
        <S.Content position="popper" sideOffset={6}
          className={cn(
            "bg-card-grad text-fg z-50 max-h-[min(22rem,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border shadow-float",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1",
            contentClassName)}>
          <S.Viewport className="p-1">
            {groups.map((g, gi) => (
              <S.Group key={g.name ?? `g${gi}`}>
                {gi > 0 && <S.Separator className="bg-border mx-1 my-1 h-px" />}
                {g.name && <S.Label className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-[11px]">{g.name}</S.Label>}
                {g.items.map((o) => (
                  <S.Item key={o.value} value={o.value} disabled={o.disabled}
                    className={cn(
                      "relative flex cursor-pointer items-center gap-2.5 rounded-md py-1.5 pr-8 pl-2.5 text-[13px] outline-none select-none",
                      "data-[highlighted]:bg-hover data-[disabled]:pointer-events-none data-[disabled]:opacity-45")}>
                    {o.icon}
                    <span className="min-w-0">
                      <S.ItemText>{o.label}</S.ItemText>
                      {o.hint && <span className="text-muted-foreground block truncate text-[11.5px] leading-snug">{o.hint}</span>}
                    </span>
                    <S.ItemIndicator className="absolute right-2.5">
                      <Check className="size-3.5" />
                    </S.ItemIndicator>
                  </S.Item>
                ))}
              </S.Group>
            ))}
          </S.Viewport>
        </S.Content>
      </S.Portal>
    </S.Root>
  );
}
