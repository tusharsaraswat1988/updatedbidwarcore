import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import type { HealthLevel, SystemHealth } from "@/lib/mission-control-ops";

const LABELS: { key: keyof SystemHealth; label: string }[] = [
  { key: "internet", label: "Internet" },
  { key: "realtime", label: "Realtime" },
  { key: "broadcast", label: "Broadcast" },
  { key: "venue", label: "Venue" },
  { key: "obs", label: "OBS" },
  { key: "scorers", label: "Scorers" },
];

function levelText(level: HealthLevel): string {
  if (level === "healthy") return "Healthy";
  if (level === "warning") return "Warning";
  return "Disconnected";
}

function levelClass(level: HealthLevel): string {
  if (level === "healthy") return "text-emerald-300";
  if (level === "warning") return "text-amber-200";
  return "text-red-300";
}

export function MissionControlHealthStrip({ health }: { health: SystemHealth }) {
  return (
    <div
      className={cn(hubCardClass, "px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1")}
      aria-label="System health"
    >
      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Health</span>
      {LABELS.map(({ key, label }) => (
        <span key={key} className="text-[11px] font-semibold inline-flex items-center gap-1.5">
          <span className="text-white/45">{label}</span>
          <span className={levelClass(health[key])}>{levelText(health[key])}</span>
        </span>
      ))}
    </div>
  );
}
