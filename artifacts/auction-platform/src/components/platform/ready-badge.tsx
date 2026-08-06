import { cn } from "@/lib/utils";

/**
 * ReadyBadge
 * Auction: readiness/locked pills on EPIC `*-setup-card.tsx`
 * Badminton: setup done/missing status chips (same green/amber/destructive language)
 */
export function ReadyBadge({
  locked,
  readiness,
  errorCount = 0,
  lockedLabel = "Locked",
  className,
  size = "sm",
}: {
  locked: boolean;
  readiness?: string;
  errorCount?: number;
  lockedLabel?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const label = locked
    ? lockedLabel
    : readiness === "ready"
      ? "Ready"
      : readiness === "almost_ready"
        ? "Almost Ready"
        : "Not Ready";

  const tone = locked
    ? "border-green-500/30 bg-green-500/10 text-green-400"
    : errorCount > 0
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-amber-500/30 bg-amber-500/10 text-amber-500";

  return (
    <span
      className={cn(
        "font-semibold rounded-md border shrink-0",
        size === "md" ? "text-xs px-2 py-1" : "text-[11px] px-2 py-0.5",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}
