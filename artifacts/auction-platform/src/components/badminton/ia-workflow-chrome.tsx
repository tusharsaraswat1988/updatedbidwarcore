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
 * Host-page chrome — title / purpose / task only.
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
}: {
  tournamentId: number;
  stepId: BadmintonIaStepId;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  /** Page-local copy only — does not change IA step definitions. */
  titleOverride?: string;
  purposeOverride?: string;
  taskOverride?: string;
}) {
  const step = getBadmintonIaStep(stepId);

  return (
    <>
      <PageHeader
        tournamentId={tournamentId}
        title={titleOverride ?? step.title}
        subtitle={purposeOverride ?? step.purpose}
        actions={headerActions}
      />

      <div className="max-w-7xl mx-auto px-6 pt-3 pb-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Do now: </span>
          {taskOverride ?? step.task}
        </p>
      </div>

      {children}
    </>
  );
}
