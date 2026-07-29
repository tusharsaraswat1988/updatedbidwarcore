import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import type { HealthLevel, SystemHealth } from "@/lib/mission-control-ops";

function levelText(level: HealthLevel): string {
  if (level === "healthy") return "OK";
  if (level === "warning") return "Check";
  return "Offline";
}

function levelClass(level: HealthLevel): string {
  if (level === "healthy") return "text-emerald-300";
  if (level === "warning") return "text-amber-200";
  return "text-red-300";
}

/** Worst status among presentation-related signals. */
function screensLevel(health: SystemHealth): HealthLevel {
  const levels: HealthLevel[] = [health.broadcast, health.venue, health.obs];
  if (levels.includes("disconnected")) return "disconnected";
  if (levels.includes("warning")) return "warning";
  return "healthy";
}

const METRICS: { key: keyof SystemHealth | "screens"; label: string; resolve?: (h: SystemHealth) => HealthLevel }[] = [
  { key: "internet", label: "Connection" },
  { key: "realtime", label: "Live sync" },
  { key: "screens", label: "Screens", resolve: screensLevel },
  { key: "scorers", label: "Scorers" },
];

export function MissionControlHealthStrip({ health }: { health: SystemHealth }) {
  return (
    <div
      className={cn(hubCardClass, "px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-1")}
      aria-label="System status"
    >
      {METRICS.map(({ key, label, resolve }) => {
        const level = resolve ? resolve(health) : health[key as keyof SystemHealth];
        return (
          <span key={key} className="text-[11px] font-semibold inline-flex items-center gap-1.5">
            <span className="text-white/45">{label}</span>
            <span className={levelClass(level)}>{levelText(level)}</span>
          </span>
        );
      })}
    </div>
  );
}
