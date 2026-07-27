import { Link } from "wouter";
import { AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, BtnPrimary, BtnSecondary, hubPanelClass } from "@/components/badminton/page-chrome";
import { useBadmintonSetup } from "@/hooks/use-badminton-setup";
import {
  evaluateBadmintonIaContinueGate,
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
  continueHref,
  continueLabel,
  hideContinue,
  titleOverride,
  purposeOverride,
  taskOverride,
}: {
  tournamentId: number;
  stepId: BadmintonIaStepId;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  continueHref?: string;
  continueLabel?: string;
  hideContinue?: boolean;
  /** Page-local copy only — does not change IA step definitions. */
  titleOverride?: string;
  purposeOverride?: string;
  taskOverride?: string;
}) {
  const step = getBadmintonIaStep(stepId);
  const { snapshot, isLoading } = useBadmintonSetup(tournamentId);
  const gate = evaluateBadmintonIaContinueGate(stepId, snapshot);
  const href = continueHref ?? step.continueHref(tournamentId);
  const label = continueLabel ?? step.continueLabel;
  const continueBlocked = !isLoading && !gate.allowed;

  return (
    <>
      <PageHeader
        eyebrow="Tournament"
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

      {!hideContinue ? (
        <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3">
            {continueBlocked && gate.reason ? (
              <div
                className={cn(
                  hubPanelClass,
                  "flex flex-col sm:flex-row sm:items-center gap-3 !p-3.5",
                )}
                role="status"
              >
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  <AlertCircle
                    className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
                    aria-hidden
                  />
                  <p className="text-sm text-foreground/90">{gate.reason}</p>
                </div>
                {gate.fixHref && gate.fixLabel ? (
                  <Link href={gate.fixHref(tournamentId)}>
                    <BtnSecondary className="w-full sm:w-auto shrink-0">
                      {gate.fixLabel}
                    </BtnSecondary>
                  </Link>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Next:{" "}
                <span className="text-foreground/80 font-medium">{label}</span>
              </p>
              {continueBlocked ? (
                <BtnPrimary className="w-full sm:w-auto opacity-50 cursor-not-allowed" disabled>
                  {label}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </BtnPrimary>
              ) : (
                <Link href={href}>
                  <BtnPrimary className="w-full sm:w-auto">
                    {label}
                    <ArrowRight className="w-4 h-4" aria-hidden />
                  </BtnPrimary>
                </Link>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
