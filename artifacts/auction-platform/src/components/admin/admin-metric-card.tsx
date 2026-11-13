import { Skeleton } from "@/components/ui/skeleton";
import type { ComponentType } from "react";

type IconType = ComponentType<{ className?: string }>;

/**
 * Shared metric card used across Dashboard, Tournament Detail, Organiser
 * Detail, and Live Operations. Consolidates what were previously 4+ separate
 * hand-rolled implementations of the same icon + big number + label layout.
 */
export function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: IconType;
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {Icon && <Icon className="h-4 w-4 text-primary" />}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className="text-2xl font-black text-foreground">{value}</div>
      )}
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
