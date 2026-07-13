import { BadmintonSetupWizardProgress } from "@/components/badminton/setup-wizard-progress";
import { BadmintonSetupWizardFooter } from "@/components/badminton/setup-wizard-footer";
import { useBadmintonSetup } from "@/hooks/use-badminton-setup";
import type { BadmintonSetupStepId } from "@/lib/badminton-setup-workflow";

/**
 * Shared wizard chrome for setup pages: progress strip + sticky Continue/Back.
 * Renders nothing for the footer until setup data is ready (avoids flash).
 */
export function BadmintonSetupWizardChrome({
  tournamentId,
  stepId,
  children,
  continueHref,
  onContinue,
  continueLabel,
  continueDisabled,
  hideFooter,
}: {
  tournamentId: number;
  stepId: BadmintonSetupStepId;
  children: React.ReactNode;
  continueHref?: string;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  /** Hide footer when the page already has its own Save & Continue flow. */
  hideFooter?: boolean;
}) {
  const { items, getStep, isLoading, progress } = useBadmintonSetup(tournamentId);
  const step = getStep(stepId);

  // Once setup is fully complete, keep progress visible for review but allow ops nav.
  const showWizard = !progress.complete || stepId === "ready";

  if (!showWizard) {
    return <>{children}</>;
  }

  return (
    <>
      {!isLoading ? (
        <BadmintonSetupWizardProgress items={items} tournamentId={tournamentId} />
      ) : (
        <div className="h-12 border-b border-border bg-muted/10 animate-pulse" aria-hidden />
      )}
      {children}
      {!hideFooter && !isLoading ? (
        <BadmintonSetupWizardFooter
          tournamentId={tournamentId}
          stepId={stepId}
          step={step}
          continueHref={continueHref}
          onContinue={onContinue}
          continueLabel={continueLabel}
          continueDisabled={continueDisabled}
        />
      ) : null}
    </>
  );
}
