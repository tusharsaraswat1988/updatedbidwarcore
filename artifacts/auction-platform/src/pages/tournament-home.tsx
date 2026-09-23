/**
 * Generic Tournament Home — /tournament/:id
 *
 * Neutral entry point for a tournament across BidWar product modules.
 * Answers:
 * - What tournament is this?
 * - Which products/modules are enabled?
 * - What can the organizer access from here?
 *
 * Performance Contract:
 * - Zero Auction WebSocket/SSE connections
 * - Zero Scoring WebSocket/SSE connections
 * - Zero Auction session initialization
 * - Zero scoring runtime bundles loaded
 * - Only lightweight tournament metadata is fetched
 */
import { useRoute, useLocation } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
} from "@workspace/platform-core";
import {
  Gavel,
  Trophy,
  ArrowRight,
  Calendar,
  MapPin,
  Building2,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { auctionOverviewPath } from "@/lib/tournament-navigation";
import { scoringAppHomePath } from "@workspace/api-base/scoring-urls";

function getNeutralStatusLabel(status?: string | null): string {
  switch (status) {
    case "setup":
      return "Getting Ready";
    case "active":
      return "Live";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    default:
      return status ?? "Getting Ready";
  }
}

function getSportEmoji(sport?: string | null): string {
  const s = (sport || "").toLowerCase();
  if (s.includes("cricket")) return "🏏";
  if (s.includes("badminton")) return "🏸";
  if (s.includes("football") || s.includes("soccer")) return "⚽";
  if (s.includes("tennis")) return "🎾";
  if (s.includes("volleyball")) return "🏐";
  if (s.includes("kabaddi")) return "🤼";
  return "🏆";
}

export default function TournamentHome() {
  const [, params] = useRoute("/tournament/:id");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  if (isLoading) {
    return (
      <AppLayout tournamentId={tournamentId}>
        <div className="space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  const auctionActive = isAuctionEnabled(tournament);
  const scoringActive = isScoringEnabled(tournament);
  const productMode = tournament
    ? resolveTournamentProductMode(tournament)
    : "auction_only";

  const statusLabel = getNeutralStatusLabel(tournament?.status);
  const sportEmoji = getSportEmoji(tournament?.sport);
  const sportLabel = (tournament?.sport || "Sport").toUpperCase();

  const isLive = tournament?.status === "active";
  const isCompleted = tournament?.status === "completed";

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="max-w-5xl mx-auto space-y-8 py-2">
        {/* ─── Tournament Identity Header ─── */}
        <div className="space-y-3 border-b border-border/40 pb-6">
          <div className="flex items-center gap-3 flex-wrap">
            {tournament?.logoUrl && (
              <img
                src={tournament.logoUrl}
                alt={tournament.name}
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-lg border border-border/40 bg-card p-1 flex-shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-foreground truncate">
                {tournament?.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {tournament?.licenseStatus === "trial" ? (
                <TrialLicenseBadge />
              ) : (
                <Badge
                  variant="outline"
                  className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[11px] font-semibold"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                  Live Ready
                </Badge>
              )}
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase border ${
                  isLive
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : isCompleted
                      ? "bg-sky-500/15 text-sky-400 border-sky-500/30"
                      : "bg-primary/15 text-primary border-primary/30"
                }`}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5 text-xs sm:text-sm text-muted-foreground pt-1">
            <span className="font-semibold text-foreground/90 flex items-center gap-1.5">
              <span>{sportEmoji}</span>
              <span>{sportLabel}</span>
            </span>

            {(tournament?.city || tournament?.venue) && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-3.5 h-3.5 text-primary/80" />
                <span>
                  {[tournament.venue, tournament.city].filter(Boolean).join(", ")}
                </span>
              </span>
            )}

            {tournament?.organizerName && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Building2 className="w-3.5 h-3.5 text-muted-foreground/80" />
                <span>{tournament.organizerName}</span>
              </span>
            )}

            {tournament?.auctionDate && auctionActive && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5 text-amber-400/80" />
                <span>Auction: {tournament.auctionDate}</span>
              </span>
            )}
          </div>
        </div>

        {/* ─── Available Modules Section ─── */}
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              <span>Available Workspaces</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Select a workspace to manage tournament operations.
            </p>
          </div>

          <div
            className={`grid gap-6 ${
              productMode === "both" ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 max-w-xl"
            }`}
          >
            {/* ─── Auction Module Card (only if auctionEnabled) ─── */}
            {auctionActive && (
              <div
                data-testid="module-card-auction"
                className="group relative rounded-2xl border border-primary/25 bg-card/80 p-6 shadow-sm hover:shadow-md hover:border-primary/50 transition-all flex flex-col justify-between overflow-hidden"
              >
                <div
                  className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none"
                  aria-hidden="true"
                />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                      <Gavel className="w-6 h-6" />
                    </div>
                    <Badge variant="outline" className="text-xs bg-primary/5 border-primary/20 text-primary">
                      Auction
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-foreground">Auction Workspace</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Live player bidding, team budgets, roster management, squad rules, and big-screen LED display.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground">
                      Teams & Squads
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground">
                      Live Bidding
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground">
                      Purse Economics
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground">
                      LED Screen
                    </span>
                  </div>
                </div>

                <div className="pt-6">
                  <Button
                    data-testid="btn-open-auction"
                    className="w-full h-11 font-bold text-xs sm:text-sm gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
                    onClick={() => navigate(auctionOverviewPath(tournamentId))}
                  >
                    <span>Open Auction Workspace</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* ─── Sports Scoring Module Card (only if scoringEnabled) ─── */}
            {scoringActive && (
              <div
                data-testid="module-card-scoring"
                className="group relative rounded-2xl border border-sky-500/25 bg-card/80 p-6 shadow-sm hover:shadow-md hover:border-sky-500/50 transition-all flex flex-col justify-between overflow-hidden"
              >
                <div
                  className="absolute top-0 right-0 w-32 h-32 bg-sky-500/5 rounded-full blur-2xl pointer-events-none"
                  aria-hidden="true"
                />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <Badge variant="outline" className="text-xs bg-sky-500/5 border-sky-500/20 text-sky-300">
                      Sports Scoring
                    </Badge>
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="text-lg font-bold text-foreground">Sports Scoring Workspace</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                      Matches, schedule, court/pitch control, live point & ball scoring, tournament standings, and fan page.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground">
                      Match Center
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground">
                      Live Scoring
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground">
                      Fixtures & Results
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-muted/40 border border-border/50 text-muted-foreground">
                      Leaderboards
                    </span>
                  </div>
                </div>

                <div className="pt-6">
                  <Button
                    data-testid="btn-open-scoring"
                    variant="outline"
                    className="w-full h-11 font-bold text-xs sm:text-sm gap-2 border-sky-500/40 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 shadow-sm"
                    onClick={() => {
                      const s = (tournament?.sport || "").toLowerCase();
                      if (s.includes("badminton")) {
                        navigate(`/tournament/${tournamentId}/badminton`);
                      } else if (s.includes("cricket")) {
                        navigate(`/tournament/${tournamentId}/score`);
                      } else {
                        navigate(scoringAppHomePath(tournamentId, tournament?.sport));
                      }
                    }}
                  >
                    <span>Open Sports Scoring</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
