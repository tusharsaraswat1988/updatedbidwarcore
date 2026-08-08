import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MissionControlNextStep } from "@/lib/mission-control-presenter";

export function MissionControlNextStepPanel({
  nextStep,
  remainingCount,
  onContinue,
  eyebrow = "Next Step",
  className,
}: {
  nextStep: MissionControlNextStep;
  remainingCount: number;
  onContinue: () => void;
  /** Optional label above the title — defaults to Next Step. */
  eyebrow?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-primary/25 bg-primary/5 px-5 py-5 sm:px-6 sm:py-6",
        className,
      )}
      aria-labelledby="mc-next-step-heading"
    >
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-primary">
        {eyebrow}
      </p>
      <h2
        id="mc-next-step-heading"
        className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-foreground"
      >
        {nextStep.title}
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
        {nextStep.description}
      </p>
      {remainingCount > 1 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {remainingCount} steps remaining
        </p>
      ) : null}
      <div className="mt-4">
        <Button type="button" onClick={onContinue} className="gap-2">
          {nextStep.ctaLabel}
          <ArrowRight className="w-4 h-4" aria-hidden />
        </Button>
      </div>
    </section>
  );
}
