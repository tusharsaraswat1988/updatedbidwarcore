import { cn } from "@/lib/utils";
import {
  HealthBadge,
  rollupHealth,
  type PlatformHealth,
} from "@/components/platform/health-badge";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";

/**
 * TournamentHealth
 * Rollup of module health for Tournament Mission Control.
 * Distinct from Ready lifecycle.
 */
export type ModuleHealthEntry = {
  id: ModuleWorkspaceId;
  label: string;
  health: PlatformHealth;
};

export function TournamentHealth({
  modules,
  className,
}: {
  modules: ModuleHealthEntry[];
  className?: string;
}) {
  const overall = rollupHealth(modules.map((m) => m.health));

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border/60 bg-muted/10 px-3 py-2.5",
        className,
      )}
      aria-label="Tournament health"
    >
      <div className="inline-flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Tournament Health
        </span>
        <HealthBadge health={overall} />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {modules.map((m) => (
          <span key={m.id} className="inline-flex items-center gap-1.5 text-[11px]">
            <span className="text-muted-foreground">{m.label}</span>
            <HealthBadge health={m.health} />
          </span>
        ))}
      </div>
    </div>
  );
}
