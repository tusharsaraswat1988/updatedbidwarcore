import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HealthBadge, type PlatformHealth } from "@/components/platform/health-badge";
import { ReadyBadge } from "@/components/platform/ready-badge";
import { DependencyChips, type DependencyChip } from "@/components/platform/dependency-chips";
import { ValidationPanel } from "@/components/platform/validation-panel";
import { HistoryPanel, type HistoryEntry } from "@/components/platform/history-panel";
import { ErrorBanner } from "@/components/platform/error-banner";
import { ActionBar } from "@/components/platform/action-bar";
import { PlatformSurface } from "@/components/platform/platform-surface";
import { LoadingState } from "@/components/platform/loading-state";
import type { PlatformValidationIssue } from "@/components/platform/types";

/**
 * ModuleWorkspace
 * Shared platform shell — all module chrome lives here; children are domain bodies only.
 */
export type ModuleWorkspaceId =
  | "competition"
  | "teams"
  | "fixtures"
  | "scheduling"
  | "matches"
  | "runtime"
  | "live_operations"
  | "post_match";

export function ModuleWorkspace({
  id,
  icon: Icon,
  title,
  description,
  locked,
  readiness,
  errorCount = 0,
  lockedLabel,
  health,
  dependencies = [],
  validationIssues = [],
  validationVariant = "bordered",
  validationMaxItems = 8,
  history = [],
  error,
  actionBar,
  headerLink,
  lastUpdated,
  loading,
  onQuickPeek,
  quickPeekLabel = "Quick peek",
  workspaceRef,
  children,
  className,
}: {
  id: ModuleWorkspaceId;
  icon?: LucideIcon;
  title: string;
  description?: string;
  locked?: boolean;
  readiness?: string;
  errorCount?: number;
  lockedLabel?: string;
  health: PlatformHealth;
  dependencies?: DependencyChip[];
  validationIssues?: PlatformValidationIssue[];
  validationVariant?: "plain" | "bordered";
  validationMaxItems?: number;
  history?: HistoryEntry[];
  error?: string | null;
  actionBar?: ReactNode;
  headerLink?: ReactNode;
  lastUpdated?: string | null;
  loading?: boolean;
  onQuickPeek?: () => void;
  quickPeekLabel?: string;
  workspaceRef?: (node: HTMLElement | null) => void;
  children: ReactNode;
  className?: string;
}) {
  if (loading) {
    return <LoadingState />;
  }

  return (
    <section
      ref={workspaceRef}
      data-module-workspace={id}
      className={cn("space-y-2 scroll-mt-24", className)}
      aria-labelledby={`module-workspace-${id}-title`}
    >
      <PlatformSurface className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id={`module-workspace-${id}-title`}
                className="text-base font-display font-bold flex items-center gap-2"
              >
                {Icon ? <Icon className="w-4 h-4 text-primary" aria-hidden /> : null}
                {title}
              </h2>
              <HealthBadge health={health} />
              {locked != null || readiness != null ? (
                <ReadyBadge
                  locked={Boolean(locked)}
                  readiness={readiness}
                  errorCount={errorCount}
                  lockedLabel={lockedLabel}
                  size="md"
                />
              ) : null}
            </div>
            {description ? (
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">{description}</p>
            ) : null}
            <DependencyChips items={dependencies} className="mt-1.5" />
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            {headerLink}
            {onQuickPeek ? (
              <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onQuickPeek}>
                <Eye className="w-3.5 h-3.5 mr-1.5" aria-hidden />
                {quickPeekLabel}
              </Button>
            ) : null}
            {lastUpdated ? (
              <p className="text-[10px] text-muted-foreground">Updated {lastUpdated}</p>
            ) : null}
          </div>
        </div>

        <ValidationPanel
          issues={validationIssues}
          maxItems={validationMaxItems}
          variant={validationVariant}
        />

        <HistoryPanel entries={history} />

        <ErrorBanner message={error} />

        {children}

        {actionBar ? <ActionBar>{actionBar}</ActionBar> : null}
      </PlatformSurface>
    </section>
  );
}
