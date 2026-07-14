import { PageHeader } from "@/components/badminton/page-chrome";
import { BadmintonSetupWizardFooter } from "@/components/badminton/setup-wizard-footer";
import { useBadmintonSetup } from "@/hooks/use-badminton-setup";
import type { BadmintonSetupStepId } from "@/lib/badminton-setup-workflow";

/**
 * Lightweight setup chrome for SportsShell pages.
 * Sidebar owns navigation — no story guide, no progress ribbon, no duplicate hub chips.
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
  headerActions,
  headerBadge,
  /** @deprecated Story guide removed — kept for call-site compatibility. */
  guideExtras: _guideExtras,
  /** @deprecated Story guide removed — kept for call-site compatibility. */
  hideGuide: _hideGuide,
}: {
  tournamentId: number;
  stepId: BadmintonSetupStepId;
  children: React.ReactNode;
  continueHref?: string;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  hideFooter?: boolean;
  guideExtras?: React.ReactNode;
  hideGuide?: boolean;
  headerActions?: React.ReactNode;
  headerBadge?: string;
}) {
  const { getStep, isLoading, progress } = useBadmintonSetup(tournamentId);
  const step = getStep(stepId);

  /** Footer / step counter only while the setup wizard is still active. */
  const showWizard = !progress.complete || stepId === "ready";

  return (
    <>
      {step ? (
        <PageHeader
          eyebrow={
            isLoading
              ? undefined
              : showWizard
                ? `Setup · Step ${step.order} of 8`
                : "Setup"
          }
          title={step.title}
          subtitle={step.purpose}
          badge={headerBadge}
          actions={headerActions}
        />
      ) : null}

      {children}

      {showWizard && !hideFooter && !isLoading ? (
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
