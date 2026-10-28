import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, BtnSecondary, hubPanelClass } from "@/components/badminton/page-chrome";
import {
  getBadmintonIaStep,
  type BadmintonIaStepId,
} from "@/lib/badminton-ia-workflow";

/**
 * Soft banner for legacy URLs that still work but moved into a chapter.
 */
export function BadmintonMovedBanner({
  toHref,
  toLabel,
  message,
}: {
  toHref: string;
  toLabel: string;
  message: string;
}) {
  return (
    <div
      className={cn(
        hubPanelClass,
        "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 !p-4 border-primary/20 bg-primary/5",
      )}
      role="status"
    >
      <p className="text-sm text-foreground/90">
        <span className="font-semibold">This screen has moved. </span>
        {message}
      </p>
      <Link href={toHref}>
        <BtnSecondary className="w-full sm:w-auto shrink-0">
          Go to {toLabel}
          <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </BtnSecondary>
      </Link>
    </div>
  );
}

/**
 * Host-page chrome — title / purpose / task + subnavigation tabs.
 * Module + section navigation lives in the left sidebar.
 */
export function BadmintonIaPageChrome({
  tournamentId,
  stepId,
  children,
  headerActions,
  titleOverride,
  purposeOverride,
  taskOverride,
  tabs,
}: {
  tournamentId: number;
  stepId: BadmintonIaStepId;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  /** Page-local copy only — does not change IA step definitions. */
  titleOverride?: string;
  purposeOverride?: string;
  taskOverride?: string;
  tabs?: React.ReactNode;
}) {
  const step = getBadmintonIaStep(stepId);
  const taskText = taskOverride ?? step.task;

  return (
    <>
      <PageHeader
        tournamentId={tournamentId}
        title={titleOverride ?? step.title}
        subtitle={purposeOverride ?? step.purpose}
        actions={headerActions}
      />

      {tabs ? (
        <div className="max-w-7xl mx-auto px-6 pt-4 pb-1">
          {tabs}
        </div>
      ) : null}

      {taskText ? (
        <div className="max-w-7xl mx-auto px-6 pt-2 pb-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-muted/40 border border-border/60 text-xs text-muted-foreground">
            <span className="font-semibold text-primary uppercase tracking-wide text-[10px]">Action</span>
            <span className="text-foreground/80">{taskText}</span>
          </div>
        </div>
      ) : null}

      {children}
    </>
  );
}
