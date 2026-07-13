import { PageHeader } from "@/components/badminton/page-chrome";
import { BadmintonSetupWizardProgress } from "@/components/badminton/setup-wizard-progress";
import { BadmintonSetupWizardFooter } from "@/components/badminton/setup-wizard-footer";
import { BadmintonSetupGuidePanel } from "@/components/badminton/setup-guide-panel";
import { useBadmintonSetup } from "@/hooks/use-badminton-setup";
import { getTournamentStoryBeat } from "@/lib/tournament-story";
import type { BadmintonSetupStepId } from "@/lib/badminton-setup-workflow";

/**
 * Shared wizard chrome with Tournament Story Mode:
 * progress → title → story guide (Where/Why/Creates/Next + How this connects) → body → Continue.
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
  guideExtras,
  hideGuide,
  headerActions,
  headerBadge,
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
  const { items, getStep, isLoading, progress } = useBadmintonSetup(tournamentId);
  const step = getStep(stepId);
  const beat = getTournamentStoryBeat(stepId);

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

      {step ? (
        <PageHeader
          eyebrow={`Step ${step.order} of 8 · Story mode`}
          title={step.title}
          subtitle={beat.whereAmI}
          badge={headerBadge}
          actions={headerActions}
        />
      ) : null}

      {!hideGuide && !isLoading ? (
        <div className="max-w-7xl mx-auto px-6 pt-6">
          <BadmintonSetupGuidePanel beat={beat} extras={guideExtras} />
        </div>
      ) : null}

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
