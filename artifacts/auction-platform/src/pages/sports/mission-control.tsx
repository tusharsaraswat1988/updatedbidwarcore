/**
 * Tournament Mission Control — Sports product home.
 *
 * Ownership: Sports (not Auction). Temporarily hosted under /scoring-app.
 * Auction Overview lives at auction-platform `/tournament/:id`.
 */
import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AttentionCenter } from "@/components/platform/attention-center";
import { PlatformReadinessStrip } from "@/components/platform/platform-readiness-strip";
import { TournamentHealth } from "@/components/platform/tournament-health";
import { ModuleRegistryProvider } from "@/components/tournament-hub/module-registry";
import {
  TournamentMissionControlModules,
  useTournamentModuleOrchestration,
} from "@/components/tournament-hub/tournament-mission-control-modules";
import {
  buildAttentionFromReadiness,
  buildPlatformReadinessSteps,
} from "@/lib/tournament-mission-control";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { useTournamentScoringActive } from "@/hooks/use-platform-features";
import { AccessStateView } from "@/components/access-state-view";
import { getSportCapabilities } from "@/lib/sport-capabilities";

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
  // Sports pipeline attention is module-driven; seed empty readiness attention.
  const readinessAttention = buildAttentionFromReadiness({
    isSetupPhase: false,
    readinessComplete: true,
    readinessChecks: [],
  });
  const readinessSteps = buildPlatformReadinessSteps({
    isSetupPhase,
    readinessComplete: !isSetupPhase,
  });

  return (
    <ModuleRegistryProvider>
      <SportsMissionControlBody
        tournamentId={tournamentId}
        tournamentName={tournament?.name}
        sportLabel={capabilities.sportLabel}
        logoUrl={tournament?.logoUrl}
        licenseStatus={tournament?.licenseStatus}
        sport={tournament?.sport}
        isSetupPhase={isSetupPhase}
        readinessSteps={readinessSteps}
        readinessAttention={readinessAttention}
      />
    </ModuleRegistryProvider>
  );
}

function SportsMissionControlBody({
  tournamentId,
  tournamentName,
  sportLabel,
  logoUrl,
  licenseStatus,
  sport,
  isSetupPhase,
  readinessSteps,
  readinessAttention,
}: {
  tournamentId: number;
  tournamentName?: string | null;
  sportLabel: string;
  logoUrl?: string | null;
  licenseStatus?: string | null;
  sport?: string | null;
  isSetupPhase: boolean;
  readinessSteps: import("@/components/platform/platform-readiness-strip").PipelineStep[];
  readinessAttention: import("@/components/platform/attention-center").AttentionItem[];
}) {
  const { attentionItems, moduleHealth, scrollToModule } = useTournamentModuleOrchestration({
    isSetupPhase,
    readinessComplete: !isSetupPhase,
    readinessAttention,
  });

  return (
    <div className="org-page-content p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
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
        <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl">
          <span className="font-semibold text-foreground/80">Tournament Mission Control</span>
          {" — "}
          Orchestrate competition setup, then open Live Operations when you are ready.
        </p>
      </div>

      <div className="mt-4 space-y-4">
        <PlatformReadinessStrip steps={readinessSteps} />
        <TournamentHealth modules={moduleHealth} />
        <AttentionCenter items={attentionItems} onModuleAction={scrollToModule} />
        <TournamentMissionControlModules tournamentId={tournamentId} sport={sport} />
      </div>
    </div>
  );
}
