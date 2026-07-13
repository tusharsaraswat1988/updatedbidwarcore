import { Link } from "wouter";
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { BtnPrimary, BtnSecondary, hubPanelClass } from "@/components/badminton/form-ui";
import {
  getFollowingSetupStep,
  getPreviousSetupStep,
  type BadmintonSetupItem,
  type BadmintonSetupStepId,
} from "@/lib/badminton-setup-workflow";

/**
 * Sticky wizard footer: Back → previous step, Continue → next (gated by validation).
 */
export function BadmintonSetupWizardFooter({
  tournamentId,
  stepId,
  step,
  continueHref,
  onContinue,
  continueLabel = "Continue",
  continueDisabled,
}: {
  tournamentId: number;
  stepId: BadmintonSetupStepId;
  step: BadmintonSetupItem | null;
  /** Override next href (e.g. after save). Defaults to following step. */
  continueHref?: string;
  /** Optional click handler instead of (or before) navigation. */
  onContinue?: () => void;
  continueLabel?: string;
  /** Force-disable Continue even if step appears done. */
  continueDisabled?: boolean;
}) {
  const previous = getPreviousSetupStep(stepId);
  const following = getFollowingSetupStep(stepId);
  const nextHref =
    continueHref ?? (following ? following.href(tournamentId) : undefined);
  const canContinue = Boolean(step?.done);
  const showValidation = step != null && !step.done && !onContinue;
  const continueIsDisabled = Boolean(continueDisabled) || (!onContinue && !canContinue);

  return (
    <div className="sticky bottom-0 z-10 border-t border-border bg-card/95 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-3">
        {showValidation ? (
          <div
            className={cn(hubPanelClass, "flex flex-col sm:flex-row sm:items-center gap-3 !p-4")}
            role="status"
          >
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{step.missingLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.requiredWhy}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground sm:text-right shrink-0">
              Complete this step, then continue.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
          {previous ? (
            <Link href={previous.href(tournamentId)}>
              <BtnSecondary className="w-full sm:w-auto">
                <ArrowLeft className="w-4 h-4" aria-hidden />
                Back
              </BtnSecondary>
            </Link>
          ) : (
            <Link href={`/tournament/${tournamentId}/badminton`}>
              <BtnSecondary className="w-full sm:w-auto">
                <ArrowLeft className="w-4 h-4" aria-hidden />
                Back
              </BtnSecondary>
            </Link>
          )}

          {onContinue ? (
            <BtnPrimary
              className="w-full sm:w-auto"
              disabled={continueIsDisabled}
              onClick={onContinue}
            >
              {continueLabel}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </BtnPrimary>
          ) : nextHref ? (
            !continueIsDisabled ? (
              <Link href={nextHref}>
                <BtnPrimary className="w-full sm:w-auto">
                  {continueLabel}
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </BtnPrimary>
              </Link>
            ) : (
              <BtnPrimary className="w-full sm:w-auto" disabled>
                {continueLabel}
                <ArrowRight className="w-4 h-4" aria-hidden />
              </BtnPrimary>
            )
          ) : null}
        </div>
      </div>
    </div>
  );
}
