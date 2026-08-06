import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlatformValidationIssue } from "@/components/platform/types";

/**
 * ValidationPanel
 * Auction: validation issue lists on all EPIC setup cards
 * Badminton: wizard footer validation callout pattern (issue list twin)
 */
export function ValidationPanel({
  issues,
  maxItems = 4,
  variant = "plain",
  emptyLabel = "No validation issues",
  className,
}: {
  issues: PlatformValidationIssue[];
  maxItems?: number;
  /** `bordered` matches Competition card rows; `plain` matches Team/Fixture rows */
  variant?: "plain" | "bordered";
  emptyLabel?: string;
  className?: string;
}) {
  if (issues.length === 0) {
    return (
      <p className={cn("text-xs text-muted-foreground flex items-center gap-1.5", className)}>
        <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className={cn(variant === "bordered" ? "space-y-1.5" : "space-y-1", className)}>
      {issues.slice(0, maxItems).map((issue) => (
        <li
          key={`${issue.code}-${issue.message}`}
          className={cn(
            "flex items-start gap-2 text-xs",
            variant === "bordered" && "rounded-md border border-border/50 px-2.5 py-2",
          )}
        >
          {issue.severity === "ERROR" ? (
            <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          ) : issue.severity === "WARNING" ? (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
          )}
          <span>
            <span className="font-medium">{issue.severity}</span> — {issue.message}
          </span>
        </li>
      ))}
    </ul>
  );
}
