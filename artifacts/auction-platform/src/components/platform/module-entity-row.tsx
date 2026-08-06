import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ReadyBadge } from "@/components/platform/ready-badge";
import { ValidationPanel } from "@/components/platform/validation-panel";
import type { PlatformValidationIssue } from "@/components/platform/types";

/**
 * ModuleEntityRow
 * Standardized row chrome for list-based module bodies.
 * Auction: per-row blocks in Team/Fixture/Scheduling/Match setup cards
 * Badminton: list row status patterns
 */
export function ModuleEntityRow({
  title,
  subtitle,
  locked,
  readiness,
  errorCount = 0,
  issues = [],
  maxIssues = 4,
  footer,
  children,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  locked: boolean;
  readiness?: string;
  errorCount?: number;
  issues?: PlatformValidationIssue[];
  maxIssues?: number;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <li
      className={cn(
        "rounded-lg border border-border/40 bg-muted/10 px-3 py-3 space-y-2",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{title}</p>
          {subtitle ? (
            <p className="text-[11px] text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <ReadyBadge locked={locked} readiness={readiness} errorCount={errorCount} />
      </div>

      {children}

      <ValidationPanel issues={issues} maxItems={maxIssues} />

      {footer}
    </li>
  );
}
