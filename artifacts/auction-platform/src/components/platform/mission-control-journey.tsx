import { Check, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrganiserJourneyStep } from "@/lib/mission-control-presenter";

export function MissionControlJourney({
  steps,
  className,
}: {
  steps: OrganiserJourneyStep[];
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "org-surface-rail px-3 py-2.5 flex flex-wrap items-center gap-x-2 gap-y-2",
        className,
      )}
      aria-label="Tournament journey"
    >
      {steps.map((step, index) => (
        <div key={step.id} className="inline-flex items-center gap-1.5">
          {index > 0 ? (
            <span className="text-muted-foreground/40 text-xs mr-0.5 hidden sm:inline" aria-hidden>
              →
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-semibold",
              step.state === "complete" && "text-green-400",
              step.state === "next" && "text-primary",
              step.state === "upcoming" && "text-muted-foreground",
            )}
          >
            {step.state === "complete" ? (
              <Check className="w-3.5 h-3.5" aria-hidden />
            ) : step.state === "next" ? (
              <ArrowRight className="w-3.5 h-3.5" aria-hidden />
            ) : (
              <Circle className="w-3 h-3 opacity-50" aria-hidden />
            )}
            {step.label}
            <span className="sr-only">
              {step.state === "complete"
                ? "complete"
                : step.state === "next"
                  ? "next"
                  : "upcoming"}
            </span>
          </span>
        </div>
      ))}
    </nav>
  );
}
