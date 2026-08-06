import { Check, AlertTriangle, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DependencyChips
 * Auction / Badminton: one-glance "Needs" chips (presentation only — no new rules)
 */
export type DependencyChipState = "met" | "warning" | "missing";

export type DependencyChip = {
  id: string;
  label: string;
  state: DependencyChipState;
};

export function DependencyChips({
  items,
  className,
}: {
  items: DependencyChip[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Dependencies">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-0.5">
        Needs
      </span>
      {items.map((item) => (
        <span
          key={item.id}
          className={cn(
            "inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded border",
            item.state === "met" && "border-green-500/25 bg-green-500/5 text-green-400",
            item.state === "warning" && "border-amber-500/25 bg-amber-500/5 text-amber-500",
            item.state === "missing" && "border-border/60 bg-muted/20 text-muted-foreground",
          )}
        >
          {item.state === "met" ? (
            <Check className="w-3 h-3" aria-hidden />
          ) : item.state === "warning" ? (
            <AlertTriangle className="w-3 h-3" aria-hidden />
          ) : (
            <Circle className="w-3 h-3" aria-hidden />
          )}
          {item.label}
        </span>
      ))}
    </div>
  );
}
