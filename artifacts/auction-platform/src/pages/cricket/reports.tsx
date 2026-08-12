/**
 * Cricket Reports — print / export views for organizers.
 * Route: /tournament/:id/score/reports
 * Uses browser print for PDF; no new report engine.
 */
import { useMemo, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { StandingsTable } from "@/components/scoring/standings-table";
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
import { useScoringMatches } from "@/hooks/use-scoring-match";
import {
  getCricketMasterTeams,
  getScoringLeaderboard,
  getScoringStandings,
  isTerminalCricketMatchStatus,
  listScoringAwards,
} from "@/lib/scoring-api";
import { listFixtures } from "@/lib/scoring-foundation-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { Download, Printer, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CricketReportsPage() {
  const [, params] = useRoute("/tournament/:id/score/reports");
  const tournamentId = parseInt(params?.id || "0");
  const printRef = useRef<HTMLDivElement>(null);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: matches, isLoading: matchesLoading } = useScoringMatches(tournamentId, scoringActive);
  const { data: standings, isLoading: standingsLoading } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: fixtures } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
    enabled: scoringActive,
  });
  const { data: runs } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "runs"],
    queryFn: () => getScoringLeaderboard(tournamentId, "runs", 10),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: wickets } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "wickets"],
    queryFn: () => getScoringLeaderboard(tournamentId, "wickets", 10),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: awards } = useQuery({
    queryKey: ["scoring-awards", tournamentId],
    queryFn: () => listScoringAwards(tournamentId),
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

  const summary = useMemo(() => {
    const list = matches ?? [];
    return {
      total: list.length,
      completed: list.filter((m) => isTerminalCricketMatchStatus(m.status)).length,
      live: list.filter((m) => m.status === "live").length,
      scheduled: list.filter((m) => m.status === "scheduled").length,
      fixtures: fixtures?.length ?? 0,
      teams: teams.length,
      moms: awards?.length ?? 0,
    };
  }, [matches, fixtures, teams, awards]);

  function handlePrint() {
    window.print();
  }

  function handleExportCsv() {
    const rows = standings ?? [];
    const header = "Rank,Team,Played,Won,Lost,Tied,NR,Points,NRR";
    const body = rows
      .map(
        (r, i) =>
          `${i + 1},"${r.teamName}",${r.played},${r.won},${r.lost},${r.tied},${r.noResult},${r.points},${r.netRunRate.toFixed(3)}`,
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tournament?.name ?? "tournament"}-standings.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  const loading = matchesLoading || standingsLoading;

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Reports"
        subtitle="Tournament summary, standings export, print views"
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <BtnSecondary onClick={handleExportCsv} className={btnCompactClass}>
              <Download className="w-4 h-4" />
              Standings CSV
            </BtnSecondary>
            <BtnPrimary onClick={handlePrint} className={btnCompactClass}>
              <Printer className="w-4 h-4" />
              Print / PDF
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-8" ref={printRef}>
        {!scoringActive ? (
          <EmptyState icon={Trophy} title="Cricket scoring is off" desc="Enable scoring to generate reports." />
        ) : loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <>
            <section className={cn(hubCardClass, "p-5 space-y-3")}>
              <HubSectionHeader title="Tournament summary" />
              <h2 className="text-2xl font-display font-bold">{tournament?.name}</h2>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Teams</dt>
                  <dd className="font-semibold text-lg">{summary.teams}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fixtures</dt>
                  <dd className="font-semibold text-lg">{summary.fixtures}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Matches</dt>
                  <dd className="font-semibold text-lg">
                    {summary.completed}/{summary.total}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">MoM awards</dt>
                  <dd className="font-semibold text-lg">{summary.moms}</dd>
                </div>
              </dl>
            </section>

            <section>
              <HubSectionHeader title="Points table" subtitle="Export via CSV or print" />
              <div className="mt-3">
                <StandingsTable rows={standings ?? []} />
              </div>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <HubSectionHeader title="Top run scorers" />
                <div className="mt-3">
                  <LeaderboardTable rows={runs ?? []} valueLabel="Runs" tournamentId={tournamentId} />
                </div>
              </div>
              <div>
                <HubSectionHeader title="Top wicket takers" />
                <div className="mt-3">
                  <LeaderboardTable rows={wickets ?? []} valueLabel="Wkts" tournamentId={tournamentId} />
                </div>
              </div>
            </section>

            <section>
              <HubSectionHeader title="Match results" />
              <ul className="mt-3 space-y-1.5 text-sm">
                {(matches ?? [])
                  .filter((m) => isTerminalCricketMatchStatus(m.status))
                  .map((m) => {
                    const home = teamMap.get(m.homeTeamId);
                    const away = teamMap.get(m.awayTeamId);
                    return (
                      <li key={m.id} className="flex justify-between gap-3 border-b border-border/40 py-2">
                        <span>
                          {home?.shortCode ?? "Home"} vs {away?.shortCode ?? "Away"}
                        </span>
                        <span className="text-muted-foreground text-right">
                          {m.resultSummary ?? m.status}
                        </span>
                      </li>
                    );
                  })}
              </ul>
            </section>

            <p className="text-xs text-muted-foreground print:hidden">
              Tip: use Print / PDF for fixtures, standings, and score summaries. Scorecard PDFs open from each{" "}
              <Link href={`/tournament/${tournamentId}/score`} className="text-primary font-semibold">
                completed match
              </Link>{" "}
              public scorecard via the browser print dialog.
            </p>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
