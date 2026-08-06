import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  useGetTournamentSummary,
  useGetTeamPurses,
  getGetTournamentQueryKey,
  getGetTournamentSummaryQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { useAuctionUnit } from "@/hooks/use-auction-unit";
import { readinessFixPath } from "@/lib/settings-navigation";
import {
  Users, UserCheck, UserMinus, Wallet, Activity,
  CheckCircle2, Circle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PlatformSurface } from "@/components/platform/platform-surface";
import { ProgressHeader } from "@/components/platform/progress-header";
import { AttentionCenter } from "@/components/platform/attention-center";
import { PlatformReadinessStrip } from "@/components/platform/platform-readiness-strip";
import { TournamentHealth } from "@/components/platform/tournament-health";
import {
  getReadinessChecklistItems,
  tournamentToReadinessInput,
  MIN_TEAMS_REQUIRED,
  minPlayersRequired,
  type AuctionReadinessCheckId,
} from "@workspace/api-base/auction-readiness";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { TournamentInsightsSection } from "@/components/tournament-insights-section";
import { ModuleRegistryProvider } from "@/components/tournament-hub/module-registry";
import {
  TournamentMissionControlModules,
  useTournamentModuleOrchestration,
} from "@/components/tournament-hub/tournament-mission-control-modules";
import {
  buildAttentionFromReadiness,
  buildPlatformReadinessSteps,
} from "@/lib/tournament-mission-control";

import { useTournamentInsightsFeed } from "@/hooks/use-tournament-insights";

export default function TournamentHub() {
  const [, params] = useRoute("/tournament/:id");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: { queryKey: getGetTournamentSummaryQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: teamPurses, isLoading: loadingPurses } = useGetTeamPurses(tournamentId, {
    query: { queryKey: getGetTeamPursesQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { formatAmount, formatShort, budgetLabel } = useAuctionUnit(tournament);
  const { data: insightsPayload, isLoading: loadingInsights } = useTournamentInsightsFeed(
    tournamentId,
    tournament,
  );

  const readinessMode = tournament?.licenseStatus === "active" ? "live" : "trial";
  const readinessLinks: Partial<Record<AuctionReadinessCheckId, string>> = {
    teams: readinessFixPath(tournamentId, "teams"),
    players: readinessFixPath(tournamentId, "players"),
    minBid: readinessFixPath(tournamentId, "minBid"),
    openingTimer: readinessFixPath(tournamentId, "openingTimer"),
    bidTimer: readinessFixPath(tournamentId, "bidTimer"),
    playerOrder: readinessFixPath(tournamentId, "playerOrder"),
    bidTiers: readinessFixPath(tournamentId, "bidTiers"),
    minSquad: readinessFixPath(tournamentId, "minSquad"),
  };
  const isSetupPhase = tournament?.status === "setup";
  const minPlayersNeeded = minPlayersRequired(readinessMode);
  const teamCount = teamPurses?.length ?? 0;
  const playerCount = summary?.totalPlayers ?? 0;
  const teamsReady = teamCount >= MIN_TEAMS_REQUIRED;
  const playersReady = playerCount >= minPlayersNeeded;
  const readinessInput = tournament && summary && Array.isArray(teamPurses)
    ? tournamentToReadinessInput(
        tournament,
        teamPurses.length,
        summary.totalPlayers,
      )
    : null;
  const readinessChecks = readinessInput
    ? getReadinessChecklistItems(readinessInput, readinessMode, readinessLinks)
    : [];
  const readinessDataLoaded = readinessInput !== null;
  const readinessComplete = readinessChecks.length > 0 && readinessChecks.every((c) => c.done);
  const readinessDoneCount = readinessChecks.filter((c) => c.done).length;
  const readinessTotal = readinessChecks.length;
  const readinessPercent = readinessTotal > 0 ? Math.round((readinessDoneCount / readinessTotal) * 100) : 0;
  const statusLabel = tournament?.status === "setup"
    ? "Getting Ready"
    : tournament?.status === "active"
      ? "Auction Running"
      : tournament?.status === "completed"
        ? "Auction Done"
        : tournament?.status ?? "";

  const readinessSteps = buildPlatformReadinessSteps({
    isSetupPhase,
    readinessComplete,
  });
  const readinessAttention = buildAttentionFromReadiness({
    isSetupPhase,
    readinessComplete,
    readinessChecks,
  });

  if (loadingTournament) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-4 w-32" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <ModuleRegistryProvider>
        <TournamentHubMissionControl
          tournamentId={tournamentId}
          tournament={tournament}
          summary={summary}
          insightsPayload={insightsPayload}
          loadingInsights={loadingInsights}
          loadingPurses={loadingPurses}
          loadingSummary={loadingSummary}
          isSetupPhase={isSetupPhase}
          readinessComplete={readinessComplete}
          readinessAttention={readinessAttention}
          readinessSteps={readinessSteps}
          readinessChecks={readinessChecks}
          readinessDataLoaded={readinessDataLoaded}
          readinessDoneCount={readinessDoneCount}
          readinessTotal={readinessTotal}
          readinessPercent={readinessPercent}
          readinessMode={readinessMode}
          statusLabel={statusLabel}
          teamCount={teamCount}
          playerCount={playerCount}
          teamsReady={teamsReady}
          playersReady={playersReady}
          minPlayersNeeded={minPlayersNeeded}
          formatAmount={formatAmount}
          formatShort={formatShort}
          budgetLabel={budgetLabel}
          navigate={navigate}
        />
      </ModuleRegistryProvider>
    </AppLayout>
  );
}

function TournamentHubMissionControl({
  tournamentId,
  tournament,
  summary,
  insightsPayload,
  loadingInsights,
  loadingPurses,
  loadingSummary,
  isSetupPhase,
  readinessComplete,
  readinessAttention,
  readinessSteps,
  readinessChecks,
  readinessDataLoaded,
  readinessDoneCount,
  readinessTotal,
  readinessPercent,
  readinessMode,
  statusLabel,
  teamCount,
  playerCount,
  teamsReady,
  playersReady,
  minPlayersNeeded,
  formatAmount,
  formatShort,
  budgetLabel,
  navigate,
}: {
  tournamentId: number;
  tournament: ReturnType<typeof useGetTournament>["data"];
  summary: ReturnType<typeof useGetTournamentSummary>["data"];
  insightsPayload: ReturnType<typeof useTournamentInsightsFeed>["data"];
  loadingInsights: boolean;
  loadingPurses: boolean;
  loadingSummary: boolean;
  isSetupPhase: boolean;
  readinessComplete: boolean;
  readinessAttention: import("@/components/platform/attention-center").AttentionItem[];
  readinessSteps: import("@/components/platform/platform-readiness-strip").PipelineStep[];
  readinessChecks: ReturnType<typeof getReadinessChecklistItems>;
  readinessDataLoaded: boolean;
  readinessDoneCount: number;
  readinessTotal: number;
  readinessPercent: number;
  readinessMode: "live" | "trial";
  statusLabel: string;
  teamCount: number;
  playerCount: number;
  teamsReady: boolean;
  playersReady: boolean;
  minPlayersNeeded: number;
  formatAmount: (value?: number | null) => string;
  formatShort: (value?: number | null) => string;
  budgetLabel: string;
  navigate: (path: string) => void;
}) {
  const { attentionItems, moduleHealth, scrollToModule } = useTournamentModuleOrchestration({
    isSetupPhase,
    readinessComplete,
    readinessAttention,
  });

  return (
      <div className="org-page-content">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {tournament?.logoUrl && (
              <img src={tournament.logoUrl} alt={tournament.name} className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded flex-shrink-0" />
            )}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight">{tournament?.name}</h1>
            {readinessMode === "trial" ? <TrialLicenseBadge /> : null}
            <span className="px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-[11px] font-bold tracking-widest uppercase">
              {statusLabel}
            </span>
          </div>
          <p className="text-muted-foreground mt-1.5 font-mono text-xs sm:text-sm flex items-center flex-wrap gap-x-2 gap-y-1">
            {tournament?.sport?.toUpperCase()}
            {tournament?.city && <span>· {tournament.city}</span>}
            {tournament?.organizerName && <span>· {tournament.organizerName}</span>}
            {tournament?.venue && <span>· {tournament.venue}</span>}
            <span>· {budgetLabel}: {formatAmount(tournament?.basePurse)}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl">
            <span className="font-semibold text-foreground/80">Tournament Mission Control</span>
            {" — "}
            {isSetupPhase && readinessComplete
              ? "Setup complete — open Live Operations when you are ready to start."
              : "Orchestrate competition setup, then open Live Operations when you are ready."}
          </p>
        </div>

        <PlatformReadinessStrip steps={readinessSteps} />
        <TournamentHealth modules={moduleHealth} />
        <AttentionCenter items={attentionItems} onModuleAction={scrollToModule} />

        {/* Summary Stats */}
        <div className="org-stat-grid">
          {isSetupPhase ? (
            <>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Teams</p>
                  {loadingPurses ? <Skeleton className="h-8 w-14 mt-1.5" /> : (
                    <>
                      <p className="org-kpi-value">{teamCount}</p>
                      <p className={`text-xs mt-1 ${teamsReady ? "text-green-400" : "text-muted-foreground"}`}>
                        {teamsReady ? `Ready · min ${MIN_TEAMS_REQUIRED}` : `${teamCount} of ${MIN_TEAMS_REQUIRED} minimum`}
                      </p>
                    </>
                  )}
                </div>
                <div className="org-kpi-icon bg-primary/10"><Users className="w-5 h-5 text-primary" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Players</p>
                  {loadingSummary ? <Skeleton className="h-8 w-14 mt-1.5" /> : (
                    <>
                      <p className="org-kpi-value">{playerCount}</p>
                      <p className={`text-xs mt-1 ${playersReady ? "text-green-400" : "text-muted-foreground"}`}>
                        {playersReady ? `Ready · min ${minPlayersNeeded}` : `${playerCount} of ${minPlayersNeeded} minimum`}
                      </p>
                    </>
                  )}
                </div>
                <div className="org-kpi-icon bg-blue-500/10"><UserCheck className="w-5 h-5 text-blue-500" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Settings</p>
                  <p className="org-kpi-value text-primary">{readinessPercent}%</p>
                </div>
                <div className="org-kpi-icon bg-primary/10"><Activity className="w-5 h-5 text-primary" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Steps left</p>
                  <p className="org-kpi-value">{readinessTotal - readinessDoneCount}</p>
                </div>
                <div className="org-kpi-icon bg-muted/30"><CheckCircle2 className="w-5 h-5 text-muted-foreground" /></div>
              </div>
            </>
          ) : (
            <>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Total Players</p>
                  {loadingSummary ? <Skeleton className="h-8 w-14 mt-1.5" /> : <p className="org-kpi-value">{summary?.totalPlayers || 0}</p>}
                </div>
                <div className="org-kpi-icon bg-blue-500/10"><Users className="w-5 h-5 text-blue-500" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Sold</p>
                  {loadingSummary ? <Skeleton className="h-8 w-14 mt-1.5" /> : <p className="org-kpi-value text-green-500">{summary?.soldPlayers || 0}</p>}
                </div>
                <div className="org-kpi-icon bg-green-500/10"><UserCheck className="w-5 h-5 text-green-500" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Unsold</p>
                  {loadingSummary ? <Skeleton className="h-8 w-14 mt-1.5" /> : <p className="org-kpi-value text-destructive">{summary?.unsoldPlayers || 0}</p>}
                </div>
                <div className="org-kpi-icon bg-destructive/10"><UserMinus className="w-5 h-5 text-destructive" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Total Spent</p>
                  {loadingSummary ? <Skeleton className="h-8 w-20 mt-1.5" /> : <p className="org-kpi-value text-primary">{formatShort(summary?.totalSpent)}</p>}
                </div>
                <div className="org-kpi-icon bg-primary/10"><Wallet className="w-5 h-5 text-primary" /></div>
              </div>
            </>
          )}
        </div>

        <TournamentInsightsSection
          insights={insightsPayload?.insights}
          isLoading={loadingInsights && !insightsPayload}
        />

        {tournamentId ? (
          <TournamentMissionControlModules
            tournamentId={tournamentId}
            sport={tournament?.sport}
          />
        ) : null}

        {/* Setup Checklist — hidden once every item is complete */}
        {isSetupPhase && readinessDataLoaded && !readinessComplete && (
          <PlatformSurface className="space-y-4">
            <ProgressHeader
              title="Setup Checklist"
              icon={<CheckCircle2 className="w-4 h-4 text-primary" />}
              doneCount={readinessDoneCount}
              totalCount={readinessTotal}
            />
            <div className="space-y-2">
              <div className="flex items-start gap-3 px-3 py-2.5 rounded-lg border border-green-500/20 bg-green-500/5">
                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-400">Tournament created</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Name, sport, date and purse are configured.</p>
                </div>
              </div>
              {readinessChecks.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                    item.done
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-border/50 bg-muted/10"
                  }`}
                >
                  {item.done
                    ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    : <Circle className="w-4 h-4 text-muted-foreground/40 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${item.done ? "text-green-400" : "text-foreground"}`}>
                      {item.label}
                    </p>
                  </div>
                  {!item.done && item.link && (
                    <button
                      onClick={() => navigate(item.link!)}
                      className="text-xs text-primary hover:underline flex-shrink-0 font-medium mt-0.5"
                    >
                      Fix →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </PlatformSurface>
        )}

      </div>
  );
}
