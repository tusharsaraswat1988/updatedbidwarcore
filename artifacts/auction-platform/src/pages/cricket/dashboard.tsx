/**
 * Cricket Tournament Dashboard — day-ops overview for organizers.
 * Route: /tournament/:id/score/dashboard
 */
import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  EmptyState,
  HubKpiCard,
  HubSectionHeader,
  PageHeader,
  hubCardClass,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StandingsTable } from "@/components/scoring/standings-table";
import { useScoringMatches, useSquadReadiness } from "@/hooks/use-scoring-match";
import {
  getCricketMasterTeams,
  getScoringStandings,
  isTerminalCricketMatchStatus,
} from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  cricketAwardsPath,
  cricketFixturesPath,
  cricketOfficialsPath,
  cricketScheduleOpsPath,
  cricketScoreHubPath,
  cricketStandingsOpsPath,
  cricketStatsOpsPath,
} from "@/lib/cricket-routes";
import { tournamentMissionControlPath } from "@/lib/tournament-navigation";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Radio,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";

function isSameLocalDay(iso: string | null | undefined, now = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function CricketDashboardPage() {
  const [, params] = useRoute("/tournament/:id/score/dashboard");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: matches, isLoading: matchesLoading } = useScoringMatches(tournamentId, scoringActive);
  const { data: squadData } = useSquadReadiness(tournamentId, scoringActive);
  const { data: standings } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: scoringActive && !!tournamentId,
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
    const today = list.filter(
      (m) =>
        m.status === "live" ||
        isSameLocalDay(m.scheduledAt) ||
        isSameLocalDay(m.startedAt) ||
        isSameLocalDay(m.completedAt),
    );
    return {
      live: list.filter((m) => m.status === "live").length,
      today: today.length,
      upcoming: list.filter((m) => m.status === "scheduled").length,
      completed: list.filter((m) => isTerminalCricketMatchStatus(m.status)).length,
    };
  }, [matches]);

  const pendingActions = useMemo(() => {
    const items: { id: string; message: string; href: string; external?: boolean }[] = [];
    const notReady = (squadData?.squads ?? []).filter((s) => !s.ready);
    if (notReady.length > 0) {
      items.push({
        id: "squads",
        message: `${notReady.length} team${notReady.length === 1 ? "" : "s"} below playing XI readiness`,
        href: tournamentMissionControlPath(tournamentId),
        external: true,
      });
    }
    const unscheduled = (matches ?? []).filter(
      (m) => m.status === "scheduled" && !m.scheduledAt,
    );
    if (unscheduled.length > 0) {
      items.push({
        id: "schedule",
        message: `${unscheduled.length} match${unscheduled.length === 1 ? "" : "es"} without a scheduled time`,
        href: cricketScheduleOpsPath(tournamentId),
      });
    }
    if ((matches ?? []).length === 0) {
      items.push({
        id: "fixtures",
        message: "No matches yet — generate fixtures or create a match",
        href: cricketFixturesPath(tournamentId),
      });
    }
    return items;
  }, [squadData, matches, tournamentId]);

  const todayMatches = useMemo(() => {
    const list = matches ?? [];
    return list
      .filter(
        (m) =>
          m.status === "live" ||
          isSameLocalDay(m.scheduledAt) ||
          isSameLocalDay(m.startedAt),
      )
      .slice(0, 8);
  }, [matches]);

  const upcoming = useMemo(
    () => (matches ?? []).filter((m) => m.status === "scheduled").slice(0, 6),
    [matches],
  );

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Tournament Dashboard"
        subtitle={tournament?.name ?? "Load tournament…"}
        badge={stats.live > 0 ? `${stats.live} Live` : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <a href={tournamentMissionControlPath(tournamentId)}>Mission Control</a>
            </Button>
            <Button size="sm" asChild>
              <Link href={cricketScoreHubPath(tournamentId)}>Open Matches</Link>
            </Button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
        {tournamentLoading || (scoringActive && matchesLoading) ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : !scoringActive ? (
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament, then return here to run match day."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <HubKpiCard label="Live now" value={stats.live} icon={Radio} tint="red" pulse={stats.live > 0} />
              <HubKpiCard label="Today" value={stats.today} icon={Calendar} tint="primary" />
              <HubKpiCard label="Upcoming" value={stats.upcoming} icon={Calendar} tint="muted" />
              <HubKpiCard label="Completed" value={stats.completed} icon={CheckCircle2} tint="green" />
            </div>

            {pendingActions.length > 0 ? (
              <section>
                <HubSectionHeader
                  title="Pending actions"
                  subtitle="What needs attention before the next match"
                />
                <ul className="mt-3 space-y-2">
                  {pendingActions.map((item) =>
                    item.external ? (
                      <li key={item.id}>
                        <a
                          href={item.href}
                          className={cn(
                            hubPanelClass,
                            "flex items-start gap-3 hover:border-primary/30 transition-colors",
                          )}
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground">{item.message}</span>
                        </a>
                      </li>
                    ) : (
                      <li key={item.id}>
                        <Link
                          href={item.href}
                          className={cn(
                            hubPanelClass,
                            "flex items-start gap-3 hover:border-primary/30 transition-colors",
                          )}
                        >
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          <span className="text-sm text-foreground">{item.message}</span>
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </section>
            ) : null}

            <section>
              <HubSectionHeader
                title="Today's matches"
                subtitle={todayMatches.length ? undefined : "Nothing scheduled for today"}
              />
              {todayMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No matches today.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {todayMatches.map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    return (
                      <Link
                        key={m.id}
                        href={`/tournament/${tournamentId}/score/${m.id}`}
                        className={cn(hubCardClass, "p-4 block hover:border-primary/30")}
                      >
                        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1 capitalize">
                          {m.status}
                        </p>
                        <p className="font-display font-bold text-foreground">
                          {home?.shortCode ?? "Home"} vs {away?.shortCode ?? "Away"}
                        </p>
                        {m.resultSummary ? (
                          <p className="text-xs text-muted-foreground mt-1">{m.resultSummary}</p>
                        ) : null}
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <HubSectionHeader title="Upcoming" />
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">No upcoming matches.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {upcoming.map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    return (
                      <li key={m.id}>
                        <Link
                          href={`/tournament/${tournamentId}/score/${m.id}`}
                          className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5 hover:border-primary/30"
                        >
                          <span className="text-sm font-medium">
                            {home?.shortCode ?? "Home"} vs {away?.shortCode ?? "Away"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m.scheduledAt
                              ? new Date(m.scheduledAt).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })
                              : "Unscheduled"}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section>
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <HubSectionHeader title="Points table" subtitle="Sorted by points, then NRR" />
                <Link
                  href={cricketStandingsOpsPath(tournamentId)}
                  className="text-xs font-semibold text-primary"
                >
                  Full standings
                </Link>
              </div>
              <div className="mt-3">
                <StandingsTable rows={(standings ?? []).slice(0, 8)} compact />
              </div>
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: "Fixtures", href: cricketFixturesPath(tournamentId) },
                { label: "Schedule", href: cricketScheduleOpsPath(tournamentId) },
                { label: "Stats", href: cricketStatsOpsPath(tournamentId) },
                { label: "Officials", href: cricketOfficialsPath(tournamentId) },
                { label: "Awards", href: cricketAwardsPath(tournamentId) },
                {
                  label: "Teams",
                  href: `/tournament/${tournamentId}/teams`,
                  external: true as const,
                },
              ].map((item) =>
                "external" in item && item.external ? (
                  <a
                    key={item.label}
                    href={item.href}
                    className={cn(
                      hubPanelClass,
                      "text-center text-sm font-semibold hover:border-primary/30",
                    )}
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    className={cn(
                      hubPanelClass,
                      "text-center text-sm font-semibold hover:border-primary/30",
                    )}
                  >
                    {item.label}
                  </Link>
                ),
              )}
            </section>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
