import { Link } from "wouter";
import { CheckCircle2, ArrowRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { BtnPrimary, hubPanelClass } from "@/components/badminton/form-ui";
import {
  getNextSetupStep,
  setupProgress,
  type BadmintonSetupItem,
} from "@/lib/badminton-setup-workflow";
import { getTournamentStoryBeat } from "@/lib/tournament-story";

export function BadmintonNextStepBanner({
  items,
  tournamentId,
}: {
  items: BadmintonSetupItem[];
  tournamentId: number;
}) {
  const next = getNextSetupStep(items);
  if (!next) return null;
  const beat = getTournamentStoryBeat(next.id);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="p-2.5 rounded-lg bg-primary/15 shrink-0">
          <ArrowRight className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Continue the story</p>
          <h2 className="text-base font-display font-bold text-foreground mt-0.5">{next.title}</h2>
          <p className="text-sm text-muted-foreground mt-1">{beat.whereAmI}</p>
          <p className="text-xs text-muted-foreground/80 mt-1">{beat.happensNext}</p>
        </div>
      </div>
      <Link href={next.href(tournamentId)}>
        <BtnPrimary className="w-full sm:w-auto shrink-0">
          Continue
          <ArrowRight className="w-4 h-4" aria-hidden />
        </BtnPrimary>
      </Link>
    </div>
  );
}

function SetupChecklistRow({
  item,
  tournamentId,
}: {
  item: BadmintonSetupItem;
  tournamentId: number;
}) {
  const isCompleted = item.status === "completed";
  const isCurrent = item.status === "current";
  const isUpcoming = item.status === "upcoming";

  const content = (
    <>
      <span
        className={cn(
          "text-[10px] font-mono w-4 shrink-0 mt-0.5",
          isCurrent ? "text-primary font-bold" : "text-muted-foreground",
        )}
      >
        {item.order}
      </span>

      {isCompleted ? (
        <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" aria-hidden />
      ) : isCurrent ? (
        <ArrowRight className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden />
      ) : (
        <Lock className="w-3.5 h-3.5 text-muted-foreground/35 shrink-0 mt-0.5" aria-hidden />
      )}

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-medium",
            isCompleted && "text-green-400",
            isCurrent && "text-foreground font-semibold",
            isUpcoming && "text-muted-foreground/70",
          )}
        >
          {item.title}
        </p>
        {isCurrent && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.purpose}</p>
        )}
        {isUpcoming && (
          <p className="text-xs text-muted-foreground/60 mt-0.5">Waiting for previous step</p>
        )}
      </div>

      {isCurrent && (
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary shrink-0 mt-0.5">
          Current
        </span>
      )}
    </>
  );

  const rowClass = cn(
    "flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors",
    isCompleted && "border-green-500/20 bg-green-500/5",
    isCurrent && "border-primary/40 bg-primary/10 shadow-[0_0_0_1px] shadow-primary/10",
    isUpcoming && "border-border/40 bg-muted/5 opacity-70",
  );

  if (isUpcoming) {
    return (
      <li className={rowClass} aria-disabled="true">
        {content}
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href(tournamentId)}
        className={cn(
          rowClass,
          "hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          isCompleted && "hover:bg-green-500/10",
        )}
        aria-current={isCurrent ? "step" : undefined}
      >
        {content}
      </Link>
    </li>
  );
}

export function BadmintonSetupChecklist({
  items,
  tournamentId,
  /** When true, always show the checklist (Ready step review). */
  forceShow,
}: {
  items: BadmintonSetupItem[];
  tournamentId: number;
  forceShow?: boolean;
}) {
  const { doneCount, total, remaining, percent, complete } = setupProgress(items);

  if (complete && !forceShow) return null;

  const remainingLabel =
    remaining === 1 ? "Only 1 step remaining" : `Only ${remaining} steps remaining`;

  return (
    <div className={cn(hubPanelClass, "space-y-4")}>
      <div>
        <h2 className="text-base font-display font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary" />
          {complete ? "Readiness checklist" : "Setup progress"}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {complete
            ? "All setup steps are complete"
            : `${doneCount} of ${total} completed · ${remainingLabel}`}
        </p>
        <Progress value={percent} className="h-1.5 mt-2 max-w-md" />
      </div>

      <ol className="space-y-2">
        {items.map((item) => (
          <SetupChecklistRow key={item.id} item={item} tournamentId={tournamentId} />
        ))}
      </ol>
    </div>
  );
}
