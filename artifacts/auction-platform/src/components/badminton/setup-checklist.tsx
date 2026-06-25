import { Link } from "wouter";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { BtnPrimary, hubPanelClass, hubCardClass } from "@/components/badminton/form-ui";
import {
  getNextSetupStep,
  setupProgress,
  type BadmintonSetupItem,
} from "@/lib/badminton-setup-workflow";

export function BadmintonNextStepBanner({
  items,
  tournamentId,
}: {
  items: BadmintonSetupItem[];
  tournamentId: number;
}) {
  const next = getNextSetupStep(items);
  if (!next) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="p-2.5 rounded-lg bg-primary/15 shrink-0">
          <ArrowRight className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Next step</p>
          <h2 className="text-base font-display font-bold text-foreground mt-0.5">{next.label}</h2>
          <p className="text-sm text-muted-foreground mt-1">{next.description}</p>
        </div>
      </div>
      <Link href={next.href(tournamentId)}>
        <BtnPrimary className="w-full sm:w-auto shrink-0">
          Continue setup
        </BtnPrimary>
      </Link>
    </div>
  );
}

export function BadmintonSetupChecklist({
  items,
  tournamentId,
}: {
  items: BadmintonSetupItem[];
  tournamentId: number;
}) {
  const { doneCount, total, percent, complete } = setupProgress(items);

  if (complete) return null;

  return (
    <div className={cn(hubPanelClass, "space-y-4")}>
      <div>
        <h2 className="text-base font-display font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          Setup progress
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Follow this order to get your tournament ready — {doneCount} of {total} complete ({percent}%)
        </p>
        <Progress value={percent} className="h-1.5 mt-2 max-w-md" />
      </div>

      <ol className="space-y-2">
        {items.map((item, index) => (
          <li
            key={item.id}
            className={cn(
              "flex items-start gap-3 px-3 py-2.5 rounded-lg border",
              item.done
                ? "border-green-500/20 bg-green-500/5"
                : index === items.findIndex((s) => !s.done)
                  ? "border-primary/25 bg-primary/5"
                  : "border-border/50 bg-muted/10",
            )}
          >
            <span className="text-[10px] font-mono text-muted-foreground w-4 shrink-0 mt-0.5">
              {item.order}
            </span>
            {item.done ? (
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
            ) : (
              <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn("text-sm font-medium", item.done ? "text-green-400" : "text-foreground")}>
                {item.label}
              </p>
              {!item.done && (
                <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
              )}
            </div>
            {!item.done && (
              <Link
                href={item.href(tournamentId)}
                className="text-xs text-primary hover:underline shrink-0 font-medium mt-0.5"
              >
                Go →
              </Link>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
