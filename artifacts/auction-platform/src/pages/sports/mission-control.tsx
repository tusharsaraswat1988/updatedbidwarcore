/**
 * Tournament Dashboard — Sports product home (organiser landing).
 *
 * Route may remain /mission-control; visible product name is Tournament Dashboard.
 * Module registry + readiness engines remain authoritative underneath.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { MissionControlJourney } from "@/components/platform/mission-control-journey";
import { ModuleRegistryProvider } from "@/components/tournament-hub/module-registry";
import type { ModuleWorkspaceId } from "@/components/platform/module-workspace";
import {
  TournamentMissionControlModules,
  useTournamentModuleOrchestration,
} from "@/components/tournament-hub/tournament-mission-control-modules";
import { buildAttentionFromReadiness } from "@/lib/tournament-mission-control";
import { buildMissionControlPresenterView } from "@/lib/mission-control-presenter";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { useTournamentScoringActive } from "@/hooks/use-platform-features";
import { AccessStateView } from "@/components/access-state-view";
import { getSportCapabilities } from "@/lib/sport-capabilities";
import { sportsMissionControlPath } from "@/lib/tournament-navigation";
import { Button } from "@/components/ui/button";
import { ArrowRight, Radio } from "lucide-react";

export default function SportsMissionControlPage() {
  const [, params] = useRoute("/tournament/:id/mission-control");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const sportsActive = useTournamentScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const capabilities = getSportCapabilities(tournament?.sport);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!sportsActive) {
    return (
      <AccessStateView
        code={403}
        title="Sports unavailable"
        body="Sports is not enabled for this tournament."
        next="Enable match scoring in admin, or open Auction Overview for auction setup."
      />
    );
  }

  const isSetupPhase = tournament?.status === "setup";
  const readinessAttention = buildAttentionFromReadiness({
    isSetupPhase: false,
    readinessComplete: true,
    readinessChecks: [],
  });

  return (
    <ModuleRegistryProvider>
      <TournamentDashboardBody
        tournamentId={tournamentId}
        tournamentName={tournament?.name}
        sportLabel={capabilities.sportLabel}
        logoUrl={tournament?.logoUrl}
        licenseStatus={tournament?.licenseStatus}
        sport={tournament?.sport}
        isSetupPhase={isSetupPhase}
        readinessAttention={readinessAttention}
      />
    </ModuleRegistryProvider>
  );
}

function TournamentDashboardBody({
  tournamentId,
  tournamentName,
  sportLabel,
  logoUrl,
  licenseStatus,
  sport,
  isSetupPhase,
  readinessAttention,
}: {
  tournamentId: number;
  tournamentName?: string | null;
  sportLabel: string;
  logoUrl?: string | null;
  licenseStatus?: string | null;
  sport?: string | null;
  isSetupPhase: boolean;
  readinessAttention: import("@/components/platform/attention-center").AttentionItem[];
}) {
  const [, setLocation] = useLocation();
  const [focusedModuleId, setFocusedModuleId] = useState<ModuleWorkspaceId | null>(null);

  const { snapshots } = useTournamentModuleOrchestration({
    isSetupPhase,
    readinessComplete: !isSetupPhase,
    readinessAttention,
  });

  const capabilities = getSportCapabilities(sport);
  const presenter = useMemo(
    () =>
      buildMissionControlPresenterView({
        tournamentId,
        snapshots,
        capabilities,
        encodedReturnTo: encodeURIComponent(sportsMissionControlPath(tournamentId)),
      }),
    [tournamentId, snapshots, capabilities],
  );

  useEffect(() => {
    if (
      presenter.mode === "ready" ||
      presenter.mode === "onboarding" ||
      presenter.nextStep.continue.kind === "route"
    ) {
      setFocusedModuleId(null);
    }
  }, [presenter.mode, presenter.nextStep.stepId, presenter.nextStep.continue.kind]);

  function handleContinue() {
    const target = presenter.nextStep.continue;
    if (target.kind === "route") {
      setFocusedModuleId(null);
      setLocation(target.href);
      return;
    }
    // Avoid focusing Runtime / Competition diagnostic cards for organisers.
    // Never leave Start Setup / Continue as a dead click — fall back to sport routes.
    if (target.moduleId === "runtime" || target.moduleId === "competition") {
      const fallback =
        capabilities.missionControlDestinations?.tournament?.(tournamentId) ??
        capabilities.missionControlDestinations?.teams?.(tournamentId) ??
        capabilities.missionControlDestinations?.fixtures?.(tournamentId) ??
        capabilities.missionControlDestinations?.scoring?.(tournamentId);
      if (fallback) {
        setFocusedModuleId(null);
        setLocation(fallback);
      }
      return;
    }
    setFocusedModuleId(target.moduleId);
  }

  const showFocusedWorkspace =
    presenter.mode === "setup" &&
    focusedModuleId != null &&
    presenter.nextStep.continue.kind === "focus-module" &&
    focusedModuleId !== "runtime" &&
    focusedModuleId !== "competition";

  return (
    <div className="org-page-content p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <header>
        <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-muted-foreground">
          Tournament Dashboard
        </p>
        <div className="mt-2 flex items-center gap-2.5 flex-wrap">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={tournamentName ?? "Tournament"}
              className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded flex-shrink-0"
            />
          ) : null}
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">
            {tournamentName}
          </h1>
          {licenseStatus && licenseStatus !== "active" && licenseStatus !== "completed" ? (
            <TrialLicenseBadge />
          ) : null}
          <span className="px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-[11px] font-bold tracking-widest uppercase">
            {sportLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          {presenter.mode === "onboarding"
            ? "Let's get your tournament ready."
            : presenter.mode === "setup"
              ? "Tournament setup is progressing."
              : "Your tournament is ready for matches and scoring."}
        </p>
      </header>

      <div className="mt-6 space-y-5">
        {presenter.mode === "onboarding" ? (
          <section
            className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-5 sm:px-6 sm:py-6 space-y-4"
            aria-labelledby="td-onboarding-heading"
          >
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-primary">
              Get started
            </p>
            <h2
              id="td-onboarding-heading"
              className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
            >
              {presenter.nextStep.title}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              {presenter.nextStep.description}
            </p>
            <Button type="button" onClick={handleContinue} className="gap-2">
              {presenter.nextStep.ctaLabel}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Button>
          </section>
        ) : null}

        {presenter.mode === "setup" ? (
          <section
            className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-5 sm:px-6 sm:py-6 space-y-5"
            aria-labelledby="td-setup-heading"
          >
            <div>
              <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-primary">
                Setup Status
              </p>
              <h2
                id="td-setup-heading"
                className="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-foreground"
              >
                {presenter.nextStep.title}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground max-w-xl">
                {presenter.nextStep.description}
              </p>
            </div>

            <MissionControlJourney steps={presenter.journey} />

            {presenter.attention.length > 0 ? (
              <ul className="space-y-2">
                {presenter.attention.map((item) => (
                  <li
                    key={`${item.title}-${item.detail}`}
                    className="rounded-md border border-border/50 bg-background/60 px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                  </li>
                ))}
              </ul>
            ) : null}

            <Button type="button" onClick={handleContinue} className="gap-2">
              {presenter.nextStep.ctaLabel}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Button>
          </section>
        ) : null}

        {presenter.mode === "ready" ? (
          <ReadyOverview
            nextStepTitle={presenter.nextStep.title}
            nextStepDescription={presenter.nextStep.description}
            scoringHref={presenter.scoring.href}
            scoringLabel={presenter.scoring.label}
            liveOpsHref={presenter.liveOps.primaryHref}
            liveOpsTitle={presenter.liveOps.primaryTitle}
            journey={presenter.journey}
            onOpenScoring={handleContinue}
          />
        ) : null}

        {showFocusedWorkspace ? (
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Continue here
          </p>
        ) : null}

        {/* Registry host — always mounted; never the organiser dashboard */}
        <TournamentMissionControlModules
          tournamentId={tournamentId}
          sport={sport}
          focusModuleId={showFocusedWorkspace ? focusedModuleId : null}
          showAll={false}
          className={showFocusedWorkspace ? undefined : "sr-only"}
        />
      </div>
    </div>
  );
}

function ReadyOverview({
  nextStepTitle,
  nextStepDescription,
  scoringHref,
  scoringLabel,
  liveOpsHref,
  liveOpsTitle,
  journey,
  onOpenScoring,
}: {
  nextStepTitle: string;
  nextStepDescription: string;
  scoringHref: string | null;
  scoringLabel: string;
  liveOpsHref: string | null;
  liveOpsTitle: string | null;
  journey: import("@/lib/mission-control-presenter").OrganiserJourneyStep[];
  onOpenScoring: () => void;
}) {
  return (
    <section
      className="rounded-xl border border-primary/25 bg-primary/5 px-5 py-5 sm:px-6 sm:py-6 space-y-4"
      aria-labelledby="td-ready-heading"
    >
      <p className="text-[11px] font-bold tracking-[0.14em] uppercase text-primary">
        Match Day
      </p>
      {journey.length > 0 ? <MissionControlJourney steps={journey} /> : null}
      <h2
        id="td-ready-heading"
        className="text-xl sm:text-2xl font-bold tracking-tight text-foreground"
      >
        {nextStepTitle}
      </h2>
      <p className="text-sm text-muted-foreground max-w-xl">{nextStepDescription}</p>
      <div className="flex flex-wrap gap-3 pt-1">
        {scoringHref ? (
          <Button asChild className="gap-2">
            <Link href={scoringHref}>
              {scoringLabel}
              <ArrowRight className="w-4 h-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button type="button" className="gap-2" onClick={onOpenScoring}>
            {scoringLabel}
            <ArrowRight className="w-4 h-4" aria-hidden />
          </Button>
        )}
        {liveOpsHref ? (
          <Button asChild variant="outline" className="gap-2">
            <Link href={liveOpsHref}>
              <Radio className="w-4 h-4" aria-hidden />
              {liveOpsTitle ?? "Live Scoring"}
            </Link>
          </Button>
        ) : null}
      </div>
    </section>
  );
}
