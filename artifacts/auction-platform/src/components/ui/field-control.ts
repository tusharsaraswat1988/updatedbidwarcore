import { cn } from "@/lib/utils";

/**
 * Shared control chrome for inputs / selects / date triggers.
 * Uses elevated `--rail` fill + visible border so fields read clearly
 * on BidWar indigo card/panel surfaces (especially in portaled dialogs).
 */
export const fieldControlClass = cn(
  "rounded-lg border border-border bg-rail text-foreground",
  "shadow-xs",
  "placeholder:text-muted-foreground",
  "transition-[border-color,box-shadow,background-color]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export const fieldControlSizeClass = "h-11 min-h-11 px-3.5 text-base md:text-sm";
