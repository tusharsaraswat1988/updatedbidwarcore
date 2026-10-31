/**
 * Auction Overview — Auction product workspace home.
 *
 * Activated only when an organizer explicitly enters the Auction Workspace.
 * Hosts auction readiness checklist, team purses, spend statistics, and auction insights feed.
 */
import { useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  useGetTournamentSummary,
  useGetTeamPurses,
  useListPlayers,
  getGetTournamentQueryKey,
  getGetTournamentSummaryQueryKey,
  getGetTeamPursesQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { useAuctionUnit } from "@/hooks/use-auction-unit";
import { useToast } from "@/hooks/use-toast";
import { readinessFixPath } from "@/lib/settings-navigation";
import {
  Users, UserCheck, UserMinus, Wallet, Activity,
  CheckCircle2, Circle, AlertCircle, ArrowRight,
  Timer, Clock, Shuffle, Gavel, Calendar, Layers,
  Copy, MessageCircle, Tv, Flame, UserPlus, MapPin,
  FileText, Trophy,
} from "lucide-react";
import { resolveScoringEntryPath, auctionRoomPath, openAuctionRoom } from "@/lib/tournament-navigation";
import { playerRegistrationPublicUrl, playerRegistrationShareUrl } from "@workspace/api-base/registration-url";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PlatformSurface } from "@/components/platform/platform-surface";
import { ProgressHeader } from "@/components/platform/progress-header";
import {
  getReadinessChecklistItems,
  tournamentToReadinessInput,
  MIN_TEAMS_REQUIRED,
  minPlayersRequired,
  minSquadTargetPlayers,
  type AuctionReadinessCheckId,
} from "@workspace/api-base/auction-readiness";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { TournamentInsightsSection } from "@/components/tournament-insights-section";
import { useTournamentInsightsFeed } from "@/hooks/use-tournament-insights";
import { isAuctionEnabled, isScoringEnabled } from "@workspace/platform-core";

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return "Unscheduled";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export default function AuctionOverview() {
  const [, paramsDirect] = useRoute("/tournament/:id/auction-overview");
  const [, paramsAlias] = useRoute("/tournament/:id/overview");
  const [, paramsBase] = useRoute("/tournament/:id");
  const [, navigate] = useLocation();

  const tournamentId = parseInt(
    paramsDirect?.id || paramsAlias?.id || paramsBase?.id || "0",
  );

  const { data: tournament, isLoading: loadingTournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const auctionActive = isAuctionEnabled(tournament);
  const scoringActive = isScoringEnabled(tournament);

  const { data: summary, isLoading: loadingSummary } = useGetTournamentSummary(tournamentId, {
    query: {
      queryKey: getGetTournamentSummaryQueryKey(tournamentId),
      enabled: !!tournamentId && auctionActive,
    },
  });

  const { data: teamPurses, isLoading: loadingPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId && auctionActive,
    },
  });

  const { data: allPlayers = [], isLoading: loadingPlayers } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId && auctionActive,
    },
  });

  const { toast } = useToast();
  const { formatAmount, formatShort, budgetLabel } = useAuctionUnit(tournament);

  const { data: insightsPayload, isLoading: loadingInsights } = useTournamentInsightsFeed(
    tournamentId,
    auctionActive ? tournament : undefined,
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

  const squadTargetPlayersNeeded = minSquadTargetPlayers(
    teamCount,
    tournament?.minimumSquadSize ?? 10,
    readinessMode,
  );
  const squadTargetMet = playerCount >= squadTargetPlayersNeeded;

  const roleDistribution = useMemo(() => {
    if (!Array.isArray(allPlayers) || allPlayers.length === 0) return [];
    const counts: Record<string, number> = {};
    for (const p of allPlayers) {
      const rawRole = (p.role || "Unassigned").trim();
      const role = rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
      counts[role] = (counts[role] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [allPlayers]);

  const handleCopyRegistrationLink = () => {
    if (!tournament?.auctionCode) return;
    const origin = window.location.origin;
    const url = playerRegistrationPublicUrl(origin, tournament.auctionCode);
    navigator.clipboard.writeText(url).then(() => {
      toast({
        title: "Registration Link Copied",
        description: "Public player registration link copied to clipboard.",
      });
    });
  };

  const handleShareWhatsAppInvite = () => {
    if (!tournament?.auctionCode) return;
    const origin = window.location.origin;
    const url = playerRegistrationShareUrl(origin, tournament.auctionCode);
    const text = encodeURIComponent(
      `🏏 Player Registrations are open for ${tournament.name}!\n\nRegister now using the link below:\n${url}`,
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
  };

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

  if (tournament && !auctionActive) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="org-page-content">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center space-y-4">
            <AlertCircle className="w-10 h-10 text-destructive mx-auto" />
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-foreground">Auction Workspace Not Enabled</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                This tournament is configured for Sports Scoring only. The Auction module is disabled.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate(resolveScoringEntryPath(tournamentId, tournament?.sport))}
              className="gap-2"
            >
              Go to Sports Scoring
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="org-page-content">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {tournament?.logoUrl && (
              <img
                src={tournament.logoUrl}
                alt={tournament.name}
                className="h-8 w-8 sm:h-10 sm:w-10 object-contain rounded flex-shrink-0"
              />
            )}
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">
              {tournament?.name}
            </h1>
            {readinessMode === "trial" ? <TrialLicenseBadge /> : null}
            <span className="px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/30 rounded-full text-[11px] font-bold tracking-widest uppercase">
              {statusLabel}
            </span>
          </div>
          <p className="text-muted-foreground mt-1.5 font-mono text-xs sm:text-sm flex items-center flex-wrap gap-x-2 gap-y-1">
            <span className="font-bold text-foreground">{tournament?.sport?.toUpperCase()}</span>
            {tournament?.organizerName && <span>· {tournament.organizerName}</span>}
            <span>
              · {tournament?.venue ? (
                <span>{tournament.venue}</span>
              ) : (
                <button
                  onClick={() => navigate(`/tournament/${tournamentId}/settings?tab=general`)}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" /> Set Venue
                </button>
              )}
            </span>
            <span>
              · {tournament?.auctionDate ? (
                <span>{formatDisplayDate(tournament.auctionDate)}{tournament.auctionTime ? ` @ ${tournament.auctionTime}` : ""}</span>
              ) : (
                <button
                  onClick={() => navigate(`/tournament/${tournamentId}/settings?tab=general`)}
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Calendar className="w-3 h-3" /> Set Auction Date
                </button>
              )}
            </span>
            <span>· {budgetLabel}: {formatAmount(tournament?.basePurse)}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1.5 max-w-2xl">
            <span className="font-semibold text-foreground/80">Auction Overview</span>
            {" — "}
            {isSetupPhase
              ? readinessComplete
                ? "Auction setup complete — open Auction Control when you are ready to start."
                : "Prepare teams, players, and auction settings for auction day."
              : tournament?.status === "active"
                ? "Auction floor is live — monitor team bidding, player assignments, and real-time purse balance."
                : "Auction completed — review final squad rosters, team spend, and tournament analytics."}
          </p>
        </div>

        {/* P0 / P1: Action Required Priority Banner during Setup */}
        {isSetupPhase && readinessDataLoaded && !readinessComplete && (
          <div className="rounded-xl border border-primary/30 bg-primary/[0.07] p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">
                  Next Critical Action
                </span>
                <h3 className="text-sm sm:text-base font-bold text-foreground">
                  {teamCount < MIN_TEAMS_REQUIRED
                    ? "Add at least 2 teams to unlock auction rules & purses"
                    : !playersReady
                      ? `Register at least ${minPlayersNeeded} players to enable auction`
                      : "Complete pending auction settings"}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                {teamCount < MIN_TEAMS_REQUIRED
                  ? "Teams must exist before team owners can receive invitation links and bidding war chests can be calculated."
                  : !playersReady
                    ? `Your tournament currently has ${playerCount} players. Add players to reach the minimum starting threshold.`
                    : "Review and complete the pending checklist items below to get your auction floor ready."}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
              {teamCount < MIN_TEAMS_REQUIRED ? (
                <Button
                  onClick={() => navigate(readinessLinks.teams!)}
                  className="gap-2 font-semibold shadow-sm"
                >
                  <UserPlus className="w-4 h-4" />
                  Add Teams Now →
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    const firstPending = readinessChecks.find((c) => !c.done);
                    if (firstPending?.link) navigate(firstPending.link);
                  }}
                  className="gap-2 font-semibold shadow-sm"
                >
                  Fix Next Item →
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Lifecycle-Aware Quick Launch & Share Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          {isSetupPhase ? (
            <>
              {tournament?.auctionCode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                  onClick={handleCopyRegistrationLink}
                >
                  <Copy className="w-3.5 h-3.5 text-primary" />
                  Copy Registration Link
                </Button>
              )}
              {tournament?.auctionCode && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                  onClick={handleShareWhatsAppInvite}
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Invite on WhatsApp
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                onClick={() => window.open(`/tournament/${tournamentId}/display`, "_blank")}
              >
                <Tv className="w-3.5 h-3.5 text-blue-400" />
                Projector Screen
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                onClick={() => window.open(auctionRoomPath(tournamentId), "_blank")}
              >
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Practice Auction (Rehearsal)
              </Button>
            </>
          ) : tournament?.status === "active" ? (
            <>
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                onClick={() => openAuctionRoom(tournamentId)}
              >
                <Gavel className="w-3.5 h-3.5" />
                Enter Live Auction Floor →
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                onClick={() => window.open(`/tournament/${tournamentId}/display`, "_blank")}
              >
                <Tv className="w-3.5 h-3.5 text-blue-400" />
                Live Projector Screen
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                onClick={() => navigate(`/tournament/${tournamentId}/reports?doc=planning`)}
              >
                <Users className="w-3.5 h-3.5 text-primary" />
                Live Squad Rosters
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                onClick={() => navigate(`/tournament/${tournamentId}/reports`)}
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                View Full Reports
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                onClick={() => navigate(`/tournament/${tournamentId}/reports?doc=planning`)}
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                Final Squad Rosters
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 border-border/60 hover:bg-white/[0.06]"
                onClick={() => window.open(`/tournament/${tournamentId}/display`, "_blank")}
              >
                <Tv className="w-3.5 h-3.5 text-muted-foreground" />
                Display Screen Summary
              </Button>
              {isScoringEnabled(tournament?.mode) && (
                <Button
                  size="sm"
                  className="h-8 text-xs gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
                  onClick={() => navigate(resolveScoringEntryPath(tournamentId, tournament?.mode))}
                >
                  <Trophy className="w-3.5 h-3.5" />
                  Go to Match Center →
                </Button>
              )}
            </>
          )}
        </div>

        {/* P1: Deduplicated, High-Signal 4-KPI Grid */}
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
                  <p className="org-kpi-label">Registered Players</p>
                  {loadingSummary ? <Skeleton className="h-8 w-14 mt-1.5" /> : (
                    <>
                      <p className="org-kpi-value">{playerCount}</p>
                      <p className={`text-xs mt-1 ${squadTargetMet ? "text-green-400" : teamsReady ? "text-amber-400" : "text-muted-foreground"}`}>
                        {squadTargetMet
                          ? `Squad target met · min ${minPlayersNeeded}`
                          : `${playerCount} of ${squadTargetPlayersNeeded} needed for squads`}
                      </p>
                    </>
                  )}
                </div>
                <div className="org-kpi-icon bg-blue-500/10"><UserCheck className="w-5 h-5 text-blue-500" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Squad Rules</p>
                  <p className="org-kpi-value text-primary">{tournament?.minimumSquadSize ?? 10} / team</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {squadTargetPlayersNeeded} total players required
                  </p>
                </div>
                <div className="org-kpi-icon bg-primary/10"><Layers className="w-5 h-5 text-primary" /></div>
              </div>
              <div
                className={`org-kpi-card flex justify-between items-start gap-3 ${!tournament?.auctionDate ? "cursor-pointer hover:border-primary/40 transition-colors" : ""}`}
                onClick={() => {
                  if (!tournament?.auctionDate) {
                    navigate(`/tournament/${tournamentId}/settings?tab=general`);
                  }
                }}
              >
                <div className="min-w-0">
                  <p className="org-kpi-label">Auction Schedule</p>
                  <p className={`org-kpi-value text-base sm:text-lg truncate ${tournament?.auctionDate ? "text-foreground" : "text-primary"}`}>
                    {tournament?.auctionDate ? formatDisplayDate(tournament.auctionDate) : "Unscheduled"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {tournament?.auctionDate
                      ? (tournament.venue || (tournament.auctionTime ? `@ ${tournament.auctionTime}` : "Venue unassigned"))
                      : "Set date & venue →"}
                  </p>
                </div>
                <div className="org-kpi-icon bg-muted/30"><Calendar className="w-5 h-5 text-muted-foreground" /></div>
              </div>
            </>
          ) : (
            <>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Total Players</p>
                  {loadingSummary ? (
                    <Skeleton className="h-8 w-14 mt-1.5" />
                  ) : (
                    <>
                      <p className="org-kpi-value">{summary?.totalPlayers || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Registered in tournament
                      </p>
                    </>
                  )}
                </div>
                <div className="org-kpi-icon bg-blue-500/10"><Users className="w-5 h-5 text-blue-500" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">
                    {(summary?.retainedPlayers ?? 0) > 0 ? "In Squads" : "Sold"}
                  </p>
                  {loadingSummary ? (
                    <Skeleton className="h-8 w-14 mt-1.5" />
                  ) : (
                    <>
                      <p className="org-kpi-value text-green-500">
                        {(summary?.retainedPlayers ?? 0) > 0
                          ? (summary?.soldPlayers || 0) + (summary?.retainedPlayers || 0)
                          : (summary?.soldPlayers || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(summary?.retainedPlayers ?? 0) > 0
                          ? `${summary?.soldPlayers || 0} sold · ${summary?.retainedPlayers} retained`
                          : "Acquired in auction"}
                      </p>
                    </>
                  )}
                </div>
                <div className="org-kpi-icon bg-green-500/10"><UserCheck className="w-5 h-5 text-green-500" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">
                    {(summary?.availablePlayers ?? 0) > 0 ? "Unsold & Pool" : "Unsold"}
                  </p>
                  {loadingSummary ? (
                    <Skeleton className="h-8 w-14 mt-1.5" />
                  ) : (
                    <>
                      <p className={`org-kpi-value ${((summary?.unsoldPlayers || 0) + (summary?.availablePlayers || 0)) > 0 ? "text-amber-400" : "text-muted-foreground"}`}>
                        {(summary?.unsoldPlayers || 0) + (summary?.availablePlayers || 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(summary?.availablePlayers ?? 0) > 0
                          ? `${summary?.unsoldPlayers || 0} passed · ${summary?.availablePlayers} uncalled`
                          : "Passed without bid"}
                      </p>
                    </>
                  )}
                </div>
                <div className="org-kpi-icon bg-amber-500/10"><UserMinus className="w-5 h-5 text-amber-500" /></div>
              </div>
              <div className="org-kpi-card flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="org-kpi-label">Total Spent</p>
                  {loadingSummary ? (
                    <Skeleton className="h-8 w-20 mt-1.5" />
                  ) : (
                    <>
                      <p className="org-kpi-value text-primary">{formatShort(summary?.totalSpent)}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {summary?.totalTeams || 0} franchises · avg {formatShort(summary?.avgBidAmount)}
                      </p>
                    </>
                  )}
                </div>
                <div className="org-kpi-icon bg-primary/10"><Wallet className="w-5 h-5 text-primary" /></div>
              </div>
            </>
          )}
        </div>

        {/* P1: Player Role Distribution Ribbon */}
        {isSetupPhase && roleDistribution.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap text-xs -mt-2">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" /> Squad Pool Balance:
            </span>
            {roleDistribution.map(([role, count]) => (
              <span
                key={role}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/20 border border-border/40 font-mono text-[11px]"
              >
                <span className="font-semibold text-foreground">{count}</span>
                <span className="text-muted-foreground">{role}</span>
              </span>
            ))}
          </div>
        )}

        <TournamentInsightsSection
          insights={insightsPayload?.insights}
          isLoading={loadingInsights && !insightsPayload}
        />

        {/* Auction Rules & Default Timers */}
        <PlatformSurface className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border/40 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Gavel className="w-4 h-4 text-primary" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Auction Rules &amp; Timers</h3>
                <p className="text-[11px] text-muted-foreground">Standard rules &amp; defaults applied during live bidding</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => navigate(`/tournament/${tournamentId}/settings?tab=auction`)}
            >
              {tournament?.status === "completed" ? "View Applied Rules →" : "Configure Rules →"}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Opening Bid Timer */}
            <div className="p-3.5 rounded-lg border border-border/50 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-primary" /> Opening Bid Time
                </span>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20">
                  {tournament?.timerSeconds === 30 || !tournament?.timerSeconds ? "Default 30s" : "Custom"}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-foreground">
                {tournament?.timerSeconds ?? 30}s
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Countdown when a player first enters the auction block before opening bids.
              </p>
            </div>

            {/* Set Bid Timer */}
            <div className="p-3.5 rounded-lg border border-border/50 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-400" /> Bid Reset Timer
                </span>
                <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                  {tournament?.bidTimerSeconds === 10 || !tournament?.bidTimerSeconds ? "Default 10s" : "Custom"}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-foreground">
                {tournament?.bidTimerSeconds ?? 10}s
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Timer resets to this after each bid. Highest bidder wins at 0s.
              </p>
            </div>

            {/* Player Order */}
            <div className="p-3.5 rounded-lg border border-border/50 bg-muted/10 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Shuffle className="w-3.5 h-3.5 text-amber-400" /> Player Order
                </span>
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                  {(!tournament?.playerSelectionMode || tournament?.playerSelectionMode === "random") ? "Default Random" : "Custom"}
                </span>
              </div>
              <p className="text-xl font-bold text-foreground">
                {tournament?.playerSelectionMode === "sequential"
                  ? "In Order (Sequential)"
                  : tournament?.playerSelectionMode === "manual"
                    ? "Manual Queue"
                    : "Random Draw"}
              </p>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Players are drawn in randomized order for balanced, fair auctions.
              </p>
            </div>
          </div>
        </PlatformSurface>


        {isSetupPhase && readinessDataLoaded && !readinessComplete && (
          <PlatformSurface className="space-y-4">
            <ProgressHeader
              title="Auction Setup Checklist"
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
              {readinessChecks.map((item) => {
                const isPlayerItem = item.id === "players";
                const playerSquadDetail = isPlayerItem && playerCount < squadTargetPlayersNeeded
                  ? `Current: ${playerCount} players. Squad target: ${squadTargetPlayersNeeded} players recommended for full squads (${Math.max(teamCount, 2)} teams × ${tournament?.minimumSquadSize ?? 10}).`
                  : item.detail;

                return (
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
                      {playerSquadDetail && (
                        <p className={`text-xs mt-0.5 ${isPlayerItem && playerCount < squadTargetPlayersNeeded ? "text-amber-400/90" : "text-muted-foreground"}`}>
                          {playerSquadDetail}
                        </p>
                      )}
                    </div>
                    {item.link && (
                      !item.done ? (
                        <Button
                          size="sm"
                          onClick={() => navigate(item.link!)}
                          className="h-7 text-xs px-3 font-semibold gap-1 bg-primary text-primary-foreground hover:bg-primary/90 flex-shrink-0"
                        >
                          Fix →
                        </Button>
                      ) : (
                        <button
                          onClick={() => navigate(item.link!)}
                          className="text-xs text-muted-foreground/70 hover:text-foreground flex-shrink-0 font-medium mt-0.5"
                        >
                          Edit →
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </PlatformSurface>
        )}
      </div>
    </AppLayout>
  );
}
