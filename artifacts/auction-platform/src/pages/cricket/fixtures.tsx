/**
 * Cricket Fixture Browser — filters over fixtures + matches.
 * Route: /tournament/:id/score/fixtures
 */
import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell, CricketFilterPill } from "@/components/scoring/cricket-page-chrome";
import {
  EmptyState,
  HubSectionHeader,
  PageHeader,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useScoringMatches } from "@/hooks/use-scoring-match";
import { getCricketMasterTeams, isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { listFixtures } from "@/lib/scoring-foundation-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketScheduleOpsPath } from "@/lib/cricket-routes";
import { Calendar, Trophy } from "lucide-react";
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

  const { data: tournament } = useGetTournament(tournamentId, {
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
        subtitle={`${fixtures?.length ?? 0} fixture${(fixtures?.length ?? 0) === 1 ? "" : "s"} · ${matches?.length ?? 0} match${(matches?.length ?? 0) === 1 ? "" : "es"}`}
        actions={
          <Button variant="outline" size="sm" className="gap-2" asChild>
            <Link href={cricketScheduleOpsPath(tournamentId)}>
              <Calendar className="w-4 h-4" />
              Schedule & generate
            </Link>
          </Button>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-6">
        {!scoringActive ? (
          <EmptyState
            icon={Trophy}
            title="Cricket scoring is off"
            desc="Enable scoring to browse fixtures."
          />
        ) : isLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
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
              title="Matches"
              subtitle={`${filtered.length} shown`}
            />

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches in this filter.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((m) => {
                  const home = teamMap.get(m.homeTeamId);
                  const away = teamMap.get(m.awayTeamId);
                  return (
                    <Link
                      key={m.id}
                      href={`/tournament/${tournamentId}/score/${m.id}`}
                      className={cn(hubCardClass, "p-4 block hover:border-primary/30")}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge
                          variant={
                            m.status === "live"
                              ? "destructive"
                              : isTerminalCricketMatchStatus(m.status)
                                ? "secondary"
                                : "default"
                          }
                          className="capitalize"
                        >
                          {m.status}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {m.scheduledAt
                            ? new Date(m.scheduledAt).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : m.venue || "—"}
                        </span>
                      </div>
                      <p className="font-display font-bold text-foreground">
                        {home?.shortCode ?? "Home"} vs {away?.shortCode ?? "Away"}
                      </p>
                      {m.roundName ? (
                        <p className="text-xs text-muted-foreground mt-1">{m.roundName}</p>
                      ) : null}
                      {m.resultSummary ? (
                        <p className="text-xs text-muted-foreground mt-1">{m.resultSummary}</p>
                      ) : null}
                    </Link>
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
