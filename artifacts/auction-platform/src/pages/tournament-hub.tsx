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
import { Progress } from "@/components/ui/progress";
import { useAuctionUnit } from "@/hooks/use-auction-unit";
import { readinessFixPath } from "@/lib/settings-navigation";
import {
  Users, UserCheck, UserMinus, Wallet, Activity,
  CheckCircle2, Circle,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getReadinessChecklistItems,
  tournamentToReadinessInput,
  MIN_TEAMS_REQUIRED,
  minPlayersRequired,
  type AuctionReadinessCheckId,
} from "@workspace/api-base/auction-readiness";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { TournamentInsightsSection } from "@/components/tournament-insights-section";
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
            {isSetupPhase && readinessComplete
              ? "Setup complete — open Auction Control when you are ready to start."
              : "Add teams and players, finish settings, then open Auction Control in a new tab when you are ready."}
          </p>
        </div>

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
                <div className="org-kpi-icon bg-amber-500/10"><Users className="w-5 h-5 text-amber-500" /></div>
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

        {/* Setup Checklist — hidden once every item is complete */}
        {isSetupPhase && readinessDataLoaded && !readinessComplete && (
          <div className="rounded-xl border border-border bg-card/30 p-5 space-y-4">
            <div>
              <h2 className="text-base font-display font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" /> Setup Checklist
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {readinessDoneCount} of {readinessTotal} complete ({readinessPercent}%)
              </p>
              <Progress value={readinessPercent} className="h-1.5 mt-2 max-w-xs" />
            </div>
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
          </div>
        )}

      </div>
    </AppLayout>
  );
}
