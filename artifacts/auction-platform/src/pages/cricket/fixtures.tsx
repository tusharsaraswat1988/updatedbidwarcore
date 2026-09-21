/**
 * Cricket Fixture Browser — filters over fixtures + matches with direct match operations.
 * Route: /tournament/:id/score/fixtures
 */
import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketOrganizerPageShell,
  CricketFilterPill,
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  HubKpiCard,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
} from "@/components/scoring/cricket-page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useScoringMatches } from "@/hooks/use-scoring-match";
import { getCricketMasterTeams, isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { listFixtures } from "@/lib/scoring-foundation-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketScheduleOpsPath, cricketScorerPath, cricketMatchCenterPath } from "@/lib/cricket-routes";
import { Calendar, CheckCircle2, ChevronRight, ListOrdered, Radio, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterKey = "all" | "today" | "upcoming" | "live" | "completed";

function isSameLocalDay(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function CricketFixturesPage() {
  const [, params] = useRoute("/tournament/:id/score/fixtures");
  const tournamentId = parseInt(params?.id || "0");
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: matches, isLoading } = useScoringMatches(tournamentId, scoringActive);
  const { data: fixtures } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
    enabled: scoringActive,
  });
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const stats = useMemo(() => {
    const list = matches ?? [];
    return {
      total: list.length,
      live: list.filter((m) => m.status === "live").length,
      upcoming: list.filter((m) => m.status === "scheduled").length,
      completed: list.filter((m) => isTerminalCricketMatchStatus(m.status)).length,
      fixturesCount: fixtures?.length ?? 0,
    };
  }, [matches, fixtures]);

  const filtered = useMemo(() => {
    const list = matches ?? [];
    switch (filter) {
      case "today":
        return list.filter(
          (m) =>
            m.status === "live" ||
            isSameLocalDay(m.scheduledAt) ||
            isSameLocalDay(m.startedAt) ||
            isSameLocalDay(m.completedAt),
        );
      case "upcoming":
        return list.filter((m) => m.status === "scheduled");
      case "live":
        return list.filter((m) => m.status === "live");
      case "completed":
        return list.filter((m) => isTerminalCricketMatchStatus(m.status));
      default:
        return list;
    }
  }, [matches, filter]);

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Fixture Browser"
        subtitle={`${stats.fixturesCount} fixture${stats.fixturesCount === 1 ? "" : "s"} · ${stats.total} match${stats.total === 1 ? "" : "es"}`}
        actions={
          <BtnPrimary href={cricketScheduleOpsPath(tournamentId)} className={btnCompactClass}>
            <Calendar className="w-4 h-4" />
            Schedule & generate
          </BtnPrimary>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-6">
        {tournamentLoading || (scoringActive && isLoading && !matches) ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))}
            </div>
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        ) : !scoringActive ? (
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring to browse fixtures and schedule matches."
          />
        ) : (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <HubKpiCard label="Live Matches" value={stats.live} icon={Radio} tint="red" pulse={stats.live > 0} />
              <HubKpiCard label="Scheduled" value={stats.upcoming} icon={Calendar} tint="primary" />
              <HubKpiCard label="Completed" value={stats.completed} icon={CheckCircle2} tint="green" />
              <HubKpiCard label="Total Fixtures" value={stats.fixturesCount} icon={ListOrdered} tint="muted" />
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All Fixtures"],
                  ["today", "Today"],
                  ["upcoming", "Upcoming"],
                  ["live", "Live"],
                  ["completed", "Completed"],
                ] as const
              ).map(([key, label]) => (
                <CricketFilterPill
                  key={key}
                  active={filter === key}
                  onClick={() => setFilter(key)}
                >
                  {label}
                </CricketFilterPill>
              ))}
            </div>

            <HubSectionHeader
              title="Match Fixtures"
              subtitle={`${filtered.length} of ${stats.total} match${stats.total === 1 ? "" : "es"} shown`}
              badge={stats.live > 0 ? `${stats.live} LIVE` : undefined}
              badgeVariant="destructive"
            />

            {filtered.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title={filter === "all" ? "No fixtures generated yet" : "No matches in this filter"}
                desc={
                  filter === "all"
                    ? "Generate tournament fixtures or create individual matches to populate the calendar."
                    : "Try switching to another filter or check the schedule tab."
                }
                action={{
                  label: "Schedule & Generate",
                  onClick: () => {
                    window.location.href = cricketScheduleOpsPath(tournamentId);
                  },
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filtered.map((m) => {
                  const home = teamMap.get(m.homeTeamId);
                  const away = teamMap.get(m.awayTeamId);
                  const isLive = m.status === "live";
                  const isCompleted = isTerminalCricketMatchStatus(m.status);
                  const isScheduled = m.status === "scheduled";
                  const scorerUrl = cricketScorerPath(tournamentId, m.id);
                  const centerUrl = cricketMatchCenterPath(tournamentId, m.id);

                  return (
                    <div
                      key={m.id}
                      className={cn(
                        hubCardClass,
                        "p-4.5 flex flex-col justify-between gap-4 transition-all hover:border-primary/40",
                        isLive && "border-amber-500/50 bg-gradient-to-b from-amber-500/10 via-card to-card shadow-[0_0_20px_rgba(245,158,11,0.12)]",
                      )}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <span
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full",
                              isLive
                                ? "bg-red-500/15 border border-red-500/30 text-red-400 animate-pulse"
                                : isCompleted
                                  ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
                                  : "bg-muted border border-border text-muted-foreground",
                            )}
                          >
                            {isLive ? "🔴 LIVE NOW" : m.status}
                          </span>
                          <span className="text-xs text-muted-foreground font-semibold">
                            {m.scheduledAt
                              ? new Date(m.scheduledAt).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : m.venue || "Match #" + m.id}
                          </span>
                        </div>

                        {/* Teams Row */}
                        <div className="flex items-center justify-between gap-3 py-1.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: home?.color || "#3B82F6" }}
                            >
                              {home?.shortCode?.slice(0, 3) || "H"}
                            </div>
                            <span className="font-bold text-foreground text-sm truncate">
                              {home?.name ?? "Home"}
                            </span>
                          </div>
                          <span className="text-xs font-bold text-muted-foreground/60 uppercase shrink-0">
                            vs
                          </span>
                          <div className="flex items-center gap-2.5 min-w-0 flex-1 justify-end">
                            <span className="font-bold text-foreground text-sm truncate text-right">
                              {away?.name ?? "Away"}
                            </span>
                            <div
                              className="w-7 h-7 rounded-md flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs"
                              style={{ backgroundColor: away?.color || "#10B981" }}
                            >
                              {away?.shortCode?.slice(0, 3) || "A"}
                            </div>
                          </div>
                        </div>

                        {/* Round / Result Summary */}
                        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">{m.roundName || `Match #${m.id}`}</span>
                          {m.resultSummary ? (
                            <span className="font-semibold text-primary truncate max-w-[60%] text-right">
                              {m.resultSummary}
                            </span>
                          ) : (
                            <span>{m.venue || `${m.rules?.overs ?? 20} Overs`}</span>
                          )}
                        </div>
                      </div>

                      {/* Direct Operational Action Buttons */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                        {isLive ? (
                          <>
                            <Link href={scorerUrl} className="flex-1">
                              <Button className="w-full h-8.5 font-bold text-xs rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 gap-1.5 shadow-xs">
                                <Radio className="w-3.5 h-3.5" />
                                Scorer Pad
                              </Button>
                            </Link>
                            <Link href={centerUrl}>
                              <Button variant="outline" className="h-8.5 px-3 text-xs font-semibold rounded-lg">
                                Scorecard
                              </Button>
                            </Link>
                          </>
                        ) : isScheduled ? (
                          <>
                            <Link href={scorerUrl} className="flex-1">
                              <Button className="w-full h-8.5 font-bold text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5 shadow-xs">
                                <Radio className="w-3.5 h-3.5" />
                                Start Toss & Score
                              </Button>
                            </Link>
                            <Link href={centerUrl}>
                              <Button variant="outline" className="h-8.5 px-3 text-xs font-semibold rounded-lg">
                                Details
                              </Button>
                            </Link>
                          </>
                        ) : (
                          <Link href={centerUrl} className="w-full">
                            <Button variant="outline" className="w-full h-8.5 font-semibold text-xs rounded-lg gap-1.5 justify-between">
                              <span>View Match Scorecard</span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
