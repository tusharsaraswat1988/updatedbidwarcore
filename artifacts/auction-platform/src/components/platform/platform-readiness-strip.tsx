import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";

/**
 * PlatformReadinessStrip
 * Auction: Tournament Hub readiness checklist density
 * Badminton: setup checklist strip language
 */
export type PipelineStepState = "complete" | "pending" | "active" | "blocked";

export type PipelineStep = {
  id: ModuleWorkspaceId;
  label: string;
  state: PipelineStepState;
};

export function PlatformReadinessStrip({
  steps,
  className,
}: {
  steps: PipelineStep[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "org-surface-rail px-3 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-2",
        className,
      )}
      aria-label="Platform readiness"
    >
      {steps.map((step, index) => (
        <div key={step.id} className="inline-flex items-center gap-1.5">
          {index > 0 ? (
            <span className="text-muted-foreground/40 text-xs mr-1 hidden sm:inline" aria-hidden>
              →
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-semibold",
              step.state === "complete" && "text-green-400",
              step.state === "active" && "text-primary",
              step.state === "blocked" && "text-destructive",
              step.state === "pending" && "text-muted-foreground",
            )}
          >
            {step.state === "complete" ? (
              <Check className="w-3.5 h-3.5" aria-hidden />
            ) : step.state === "active" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <Circle className="w-3 h-3 opacity-50" aria-hidden />
            )}
            {step.label}
            {step.state === "complete" ? (
              <span className="sr-only">complete</span>
            ) : step.state === "pending" ? (
              <span className="text-[10px] font-medium opacity-70">Pending</span>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}
