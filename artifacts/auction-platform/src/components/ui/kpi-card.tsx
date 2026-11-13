import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  iconBg?: string;
  trend?: ReactNode;
  valueClassName?: string;
  loading?: boolean;
  className?: string;
}

/**
 * Standardized High-Contrast KPI Card for BidWar Organizer & Reports.
 * Follows the canonical light design system: #FFFFFF surface, #CBD5E1 border,
 * #475569 label, #0F172A monospace/tabular-nums value.
 */
export function KpiCard({
  label,
  value,
  subtitle,
  icon,
  iconBg,
  trend,
  valueClassName,
  loading = false,
  className,
}: KpiCardProps) {
  return (
    <div
      data-slot="kpi-card"
      className={cn(
        "org-kpi-card flex justify-between items-start gap-3 p-4 sm:p-5 rounded-xl border border-border bg-card shadow-card transition-all hover:border-slate-400/60",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="org-kpi-label text-xs sm:text-sm font-semibold text-slate-600 mb-1 leading-snug">
          {label}
        </p>
        {loading ? (
          <div className="space-y-1.5 py-0.5">
            <Skeleton className="h-7 w-20" />
            {subtitle ? <Skeleton className="h-3.5 w-32" /> : null}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <p
                className={cn(
                  "org-kpi-value text-xl sm:text-2xl lg:text-3xl font-bold font-mono tracking-tight text-slate-900 tabular-nums leading-none",
                  valueClassName
                )}
              >
                {value}
              </p>
              {trend ? <div className="text-xs font-semibold">{trend}</div> : null}
            </div>
            {subtitle ? (
              <p className="text-xs text-slate-500 font-medium mt-1.5 leading-snug">
                {subtitle}
              </p>
            ) : null}
          </>
        )}
      </div>

      {icon ? (
        <div
          className={cn(
            "org-kpi-icon w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 border border-slate-200/80 bg-slate-50 text-slate-700",
            iconBg
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
      ) : null}
    </div>
  );
}

export function KpiCardGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="kpi-card-grid"
      className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4", className)}
    >
      {children}
    </div>
  );
}
