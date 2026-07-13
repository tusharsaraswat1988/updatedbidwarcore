import { ArrowRight, HelpCircle, Lightbulb, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { hubPanelClass } from "@/components/badminton/form-ui";
import type { BadmintonSetupStep } from "@/lib/badminton-setup-workflow";

/**
 * Answers the three organizer questions for every setup step:
 * What is this? Why is it needed? What happens after this?
 */
export function BadmintonSetupGuidePanel({
  step,
  className,
  extras,
}: {
  step: BadmintonSetupStep;
  className?: string;
  /** Optional page-specific teaching content (diagrams, lists). */
  extras?: React.ReactNode;
}) {
  return (
    <div className={cn(hubPanelClass, "space-y-4 border-primary/20 bg-primary/5", className)}>
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/15 shrink-0">
          <HelpCircle className="w-4 h-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            What is this?
          </p>
          <p className="text-sm font-semibold text-foreground">{step.what}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
          <Lightbulb className="w-4 h-4 text-amber-300" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-300/90">
            Why is it needed?
          </p>
          <p className="text-sm text-muted-foreground">{step.why}</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-sky-500/15 shrink-0">
          <ArrowRight className="w-4 h-4 text-sky-300" aria-hidden />
        </div>
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300/90">
            What happens after this?
          </p>
          <p className="text-sm text-muted-foreground">{step.after}</p>
        </div>
      </div>

      {step.examples?.length ? (
        <div className="pt-1 border-t border-border/60">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Examples
          </p>
          <ul className="flex flex-wrap gap-2">
            {step.examples.map((example) => (
              <li
                key={example}
                className="rounded-md border border-border/70 bg-background/50 px-2.5 py-1 text-xs font-medium text-foreground/90"
              >
                {example}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {extras ? <div className="pt-1 border-t border-border/60">{extras}</div> : null}
    </div>
  );
}

/** Short term glossary line — keeps jargon from standing alone. */
export function SetupTerm({
  term,
  meaning,
}: {
  term: string;
  meaning: string;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-semibold text-foreground">{term}</span>
      {" — "}
      {meaning}
    </p>
  );
}

export function SetupReadyCelebration({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        hubPanelClass,
        "text-center space-y-3 border-green-500/30 bg-green-500/10",
        className,
      )}
    >
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 mx-auto">
        <Sparkles className="w-6 h-6 text-green-400" aria-hidden />
      </div>
      <p className="text-3xl" aria-hidden>
        🎉
      </p>
      <h2 className="text-xl font-display font-bold text-foreground">
        Your tournament is ready.
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Next you will operate the tournament from{" "}
        <span className="font-semibold text-foreground">Control Center</span>
        {" — "}the live desk for courts, scorers, and match day.
      </p>
    </div>
  );
}
