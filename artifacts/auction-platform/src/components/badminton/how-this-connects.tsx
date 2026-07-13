import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tiny visual relationship diagram — "How this connects".
 * Prefer flows over paragraphs.
 */
export function HowThisConnects({
  steps,
  title = "How this connects",
  className,
  highlightLast,
}: {
  steps: string[];
  title?: string;
  className?: string;
  /** Emphasize the final node (e.g. Champion). */
  highlightLast?: boolean;
}) {
  if (steps.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <ol className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-1.5 sm:gap-1">
        {steps.map((label, index) => {
          const isLast = index === steps.length - 1;
          const emphasize = highlightLast && isLast;
          return (
            <li key={`${label}-${index}`} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-semibold",
                  emphasize
                    ? "border-amber-400/40 bg-amber-500/15 text-amber-200"
                    : "border-border/70 bg-background/60 text-foreground",
                )}
              >
                {label}
              </span>
              {!isLast ? (
                <>
                  <ChevronDown
                    className="w-3.5 h-3.5 text-muted-foreground/50 sm:hidden shrink-0"
                    aria-hidden
                  />
                  <span
                    className="hidden sm:inline text-muted-foreground/45 text-xs font-medium px-0.5"
                    aria-hidden
                  >
                    →
                  </span>
                </>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** Compact global journey strip reinforcing the continuous tournament story. */
export function TournamentStoryRibbon({
  focus,
  className,
}: {
  focus: string;
  className?: string;
}) {
  const milestones = [
    "Tournament",
    "Players",
    "Events",
    "Tournament Draw",
    "Court Schedule",
    "Live Matches",
    "Champions",
  ];

  const focusIndex = milestones.findIndex((m) => m === focus);

  return (
    <div
      className={cn(
        "rounded-lg border border-border/60 bg-muted/10 px-3 py-2.5",
        className,
      )}
      aria-label="Tournament story"
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
        Tournament story
      </p>
      <ol className="flex flex-wrap items-center gap-1">
        {milestones.map((label, index) => {
          const isFocus = label === focus;
          const isPast = focusIndex >= 0 && index < focusIndex;
          return (
            <li key={label} className="flex items-center gap-1">
              <span
                className={cn(
                  "text-[11px] font-semibold whitespace-nowrap",
                  isFocus && "text-primary",
                  isPast && !isFocus && "text-green-400/90",
                  !isFocus && !isPast && "text-muted-foreground/45",
                )}
              >
                {label}
              </span>
              {index < milestones.length - 1 ? (
                <span className="text-muted-foreground/30 text-[10px]" aria-hidden>
                  ↓
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
