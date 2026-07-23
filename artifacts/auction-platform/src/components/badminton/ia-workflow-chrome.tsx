import { Link } from "wouter";
import { AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader, BtnPrimary, BtnSecondary, hubPanelClass } from "@/components/badminton/page-chrome";
import { useBadmintonSetup } from "@/hooks/use-badminton-setup";
import {
  BADMINTON_IA_STEPS,
  evaluateBadmintonIaContinueGate,
  getBadmintonIaStep,
  isBadmintonIaChapterComplete,
  isBadmintonIaStepClickable,
  type BadmintonIaStepId,
} from "@/lib/badminton-ia-workflow";

/**
 * ✓ completed · ● current · ○ upcoming
 * Clickable when appropriate (never skip locked chapters).
 */
export function BadmintonIaProgress({
  tournamentId,
  current,
  className,
}: {
  tournamentId: number;
  current: BadmintonIaStepId;
  className?: string;
}) {
  const { snapshot, isLoading } = useBadmintonSetup(tournamentId);
  const currentIndex = BADMINTON_IA_STEPS.findIndex((s) => s.id === current);

  return (
    <nav
      aria-label="Tournament workflow"
      className={cn(
        "flex flex-wrap items-center gap-x-0.5 gap-y-1.5 text-[11px]",
        className,
      )}
    >
      {BADMINTON_IA_STEPS.map((step, index) => {
        const done =
          !isLoading && isBadmintonIaChapterComplete(step.id, snapshot);
        const active = index === currentIndex;
        const upcoming = index > currentIndex && !done;
        const clickable =
          !isLoading && isBadmintonIaStepClickable(step.id, current, snapshot);
        const marker = done && !active ? "✓" : active ? "●" : "○";

        const classNameInner = cn(
          "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors",
          active && "bg-primary/10 text-primary font-semibold",
          done && !active && "text-muted-foreground/90",
          upcoming && "text-muted-foreground/55",
          clickable && !active && "hover:text-foreground hover:bg-muted/40 cursor-pointer",
          !clickable && !active && "cursor-default",
        );

        const content = (
          <>
            <span className="tabular-nums w-3 text-center" aria-hidden>
              {marker}
            </span>
            <span className="hidden sm:inline">{step.fullLabel}</span>
            <span className="sm:hidden">{step.label}</span>
          </>
        );

        return (
          <span key={step.id} className="inline-flex items-center gap-0.5">
            {index > 0 ? (
              <span className="text-muted-foreground/30 mx-0.5" aria-hidden>
                /
              </span>
            ) : null}
            {clickable ? (
              <Link
                href={step.href(tournamentId)}
                className={classNameInner}
                aria-current={active ? "step" : undefined}
                title={step.fullLabel}
              >
                {content}
              </Link>
            ) : (
              <span
                className={classNameInner}
                aria-current={active ? "step" : undefined}
                title={
                  upcoming
                    ? `Finish ${BADMINTON_IA_STEPS[currentIndex]?.fullLabel ?? "current step"} first`
                    : step.fullLabel
                }
              >
                {content}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

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
 * Host-page chrome — same rhythm on every chapter:
 * Title → Description → Workflow strip → Do now → Sections → Content → Sticky Continue
 */
export function BadmintonIaPageChrome({
  tournamentId,
  stepId,
  children,
  headerActions,
  continueHref,
  continueLabel,
  hideContinue,
  sectionTabs,
}: {
  tournamentId: number;
  stepId: BadmintonIaStepId;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  continueHref?: string;
  continueLabel?: string;
  hideContinue?: boolean;
  sectionTabs?: React.ReactNode;
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
        title={step.title}
        subtitle={step.purpose}
        actions={headerActions}
      />

      <div className="max-w-7xl mx-auto px-6 pt-3 pb-2 space-y-3">
        <BadmintonIaProgress tournamentId={tournamentId} current={stepId} />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground/80">Do now: </span>
          {step.task}
        </p>
        {sectionTabs}
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

/** In-page section switcher for consolidated hosts (not sidebar items). */
export function BadmintonIaSectionTabs<T extends string>({
  tabs,
  labels,
  value,
  onChange,
}: {
  tabs: readonly T[];
  labels: Record<T, string>;
  value: T;
  onChange: (tab: T) => void;
}) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto pb-1"
      role="tablist"
      aria-label="Page sections"
    >
      {tabs.map((tab) => {
        const active = value === tab;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab)}
            className={cn(
              "min-h-10 px-3.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors border",
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card border-border text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {labels[tab]}
          </button>
        );
      })}
    </div>
  );
}
