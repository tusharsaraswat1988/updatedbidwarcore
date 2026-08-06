import { cn } from "@/lib/utils";

/**
 * HealthBadge
 * Auction: connection/feed badge language (operator-layout)
 * Badminton: MissionControlHealthStrip level language
 *
 * Health ≠ Ready. Values: Healthy | Warning | Blocked
 */
export type PlatformHealth = "healthy" | "warning" | "blocked";

const HEALTH_CLASS: Record<PlatformHealth, string> = {
  healthy: "border-green-500/30 bg-green-500/10 text-green-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  blocked: "border-destructive/30 bg-destructive/10 text-destructive",
};

const HEALTH_LABEL: Record<PlatformHealth, string> = {
  healthy: "Healthy",
  warning: "Warning",
  blocked: "Blocked",
};

export function HealthBadge({
  health,
  className,
}: {
  health: PlatformHealth;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "text-[11px] font-semibold px-2 py-0.5 rounded-md border shrink-0",
        HEALTH_CLASS[health],
        className,
      )}
    >
      {HEALTH_LABEL[health]}
    </span>
  );
}

export function rollupHealth(levels: PlatformHealth[]): PlatformHealth {
  if (levels.includes("blocked")) return "blocked";
  if (levels.includes("warning")) return "warning";
  return "healthy";
}
