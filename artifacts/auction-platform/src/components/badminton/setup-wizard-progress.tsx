import { Link } from "wouter";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BadmintonSetupItem } from "@/lib/badminton-setup-workflow";

/**
 * Visual setup flow at the top of every wizard page.
 * Completed = green, current = primary, future = muted.
 * Connectors read as a downward flow (Tournament → … → Ready).
 */
export function BadmintonSetupWizardProgress({
  items,
  tournamentId,
}: {
  items: BadmintonSetupItem[];
  tournamentId: number;
}) {
  return (
    <nav
      className="border-b border-border bg-card/40"
      aria-label="Tournament setup progress"
    >
      <ol className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-0.5 overflow-x-auto scrollbar-none">
        {items.map((item, index) => {
          const isCompleted = item.status === "completed";
          const isCurrent = item.status === "current";
          const isUpcoming = item.status === "upcoming";
          const showConnector = index < items.length - 1;

          const chip = (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors",
                isCompleted && "bg-green-500/15 text-green-400",
                isCurrent && "bg-primary/15 text-primary ring-1 ring-primary/40 shadow-[0_0_0_1px] shadow-primary/10",
                isUpcoming && "text-muted-foreground/50",
              )}
            >
              {isCompleted ? (
                <Check className="w-3 h-3 shrink-0" aria-hidden />
              ) : (
                <span
                  className={cn(
                    "font-mono text-[10px] w-3.5 text-center",
                    isCurrent ? "text-primary font-bold" : "text-muted-foreground/45",
                  )}
                >
                  {item.order}
                </span>
              )}
              {item.label}
            </span>
          );

          return (
            <li key={item.id} className="flex items-center gap-0.5 shrink-0">
              {isUpcoming ? (
                <span aria-disabled="true">{chip}</span>
              ) : (
                <Link
                  href={item.href(tournamentId)}
                  aria-current={isCurrent ? "step" : undefined}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-md"
                >
                  {chip}
                </Link>
              )}
              {showConnector ? (
                <span
                  className={cn(
                    "flex flex-col items-center justify-center w-4 sm:w-6 shrink-0 text-[10px] leading-none",
                    isCompleted ? "text-green-500/55" : "text-muted-foreground/35",
                  )}
                  aria-hidden
                >
                  <ChevronDown className="w-3.5 h-3.5 -my-0.5" />
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
