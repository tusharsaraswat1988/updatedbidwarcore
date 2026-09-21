/**
 * Cricket Reports & Awards — Organizer summary, awards, points table, and printable reports.
 * Route: /tournament/:id/score/reports
 */
import { useMemo, useRef, useState } from "react";
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
  CricketFilterPill,
  EmptyState,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
  hubPanelClass,
} from "@/components/scoring/cricket-page-chrome";
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
  type ScoringAwardRow,
  type ScoringLeaderboardRow,
} from "@/lib/scoring-api";
import { listFixtures } from "@/lib/scoring-foundation-api";
import { cricketMasterTeamToScorerTeam, type CricketScorerTeam } from "@/lib/scoring-squad";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketFanPlayerPath, cricketFanTeamPath, cricketMatchPublicPath } from "@/lib/tournament-navigation";
import {
  Award,
  ChevronRight,
  Download,
  Flame,
  HelpCircle,
  Medal,
  Printer,
  Scale,
  Shield,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ReportTab = "all" | "awards" | "standings" | "stats" | "results";

type DerivedAward = {
  id: string;
  title: string;
  playerName: string;
  teamName: string;
  detail: string;
  icon: typeof Trophy;
};

function topAward(
  id: string,
  title: string,
  row: ScoringLeaderboardRow | undefined,
  unit: string,
  icon: typeof Trophy,
): DerivedAward | null {
  if (!row) return null;
  return {
    id,
    title,
    playerName: row.playerName,
    teamName: row.shortCode || row.teamName,
    detail: `${row.value} ${unit}`,
    icon,
  };
}

function potFromMoms(moms: ScoringAwardRow[]): DerivedAward | null {
  if (moms.length === 0) return null;
  const counts = new Map<number, { count: number; name: string; team: string }>();
  for (const a of moms) {
    const cur = counts.get(a.playerId) ?? {
      count: 0,
      name: a.playerName,
      team: a.shortCode || a.teamName,
    };
    cur.count += 1;
    counts.set(a.playerId, cur);
  }
  let best: { playerId: number; count: number; name: string; team: string } | null = null;
  for (const [playerId, v] of counts) {
    if (!best || v.count > best.count) {
      best = { playerId, ...v };
    }
  }
  if (!best) return null;
  return {
    id: "pot",
    title: "Player of the Tournament (MVP)",
    playerName: best.name,
    teamName: best.team,
    detail: `${best.count} Player of the Match award${best.count === 1 ? "" : "s"}`,
    icon: Trophy,
  };
}

export default function CricketReportsPage() {
  const [, params] = useRoute("/tournament/:id/score/reports");
  const tournamentId = parseInt(params?.id || "0");
  const printRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ReportTab>("all");

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
  const { data: sixes } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "sixes"],
    queryFn: () => getScoringLeaderboard(tournamentId, "sixes", 5),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: strikeRate } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "strike_rate"],
    queryFn: () => getScoringLeaderboard(tournamentId, "strike_rate", 5),
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
  const teamMap = useMemo(() => new Map<number, CricketScorerTeam>(teams.map((t) => [t.id, t])), [teams]);
  const matchMap = useMemo(() => new Map((matches ?? []).map((m) => [m.id, m])), [matches]);

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

  // Derived tournament awards
  const tournamentAwards = useMemo(() => {
    const list: DerivedAward[] = [];
    const pot = potFromMoms(awards ?? []);
    if (pot) list.push(pot);
    const batter = topAward("best-batter", "Best Batter", runs?.[0], "Runs", Trophy);
    if (batter) list.push(batter);
    const bowler = topAward("best-bowler", "Best Bowler", wickets?.[0], "Wickets", Target);
    if (bowler) list.push(bowler);
    const bigHitter = topAward("sixes", "Maximum Sixes King", sixes?.[0], "Sixes", Flame);
    if (bigHitter) list.push(bigHitter);
    const striker = topAward("strike-rate", "Highest Strike Rate", strikeRate?.[0], "SR", Zap);
    if (striker) list.push(striker);
    return list;
  }, [awards, runs, wickets, sixes, strikeRate]);

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
      {/* Simple, Streamlined Header */}
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Reports & Awards"
        subtitle="Match awards, tournament honors, points table, and printable reports"
        actions={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-6" ref={printRef}>
        {!scoringActive ? (
          <EmptyState icon={Trophy} title="Cricket scoring is off" desc="Enable scoring to generate reports." />
        ) : loading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : (
          <>
            {/* Simple Top KPI Summary Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={cn(hubPanelClass, "p-4 flex flex-col justify-between")}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Teams</span>
                <span className="text-2xl font-bold font-display mt-1">{summary.teams}</span>
              </div>
              <div className={cn(hubPanelClass, "p-4 flex flex-col justify-between")}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fixtures</span>
                <span className="text-2xl font-bold font-display mt-1">{summary.fixtures}</span>
              </div>
              <div className={cn(hubPanelClass, "p-4 flex flex-col justify-between")}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matches</span>
                <span className="text-2xl font-bold font-display mt-1">
                  {summary.completed} <span className="text-sm font-normal text-muted-foreground">/ {summary.total || summary.fixtures}</span>
                </span>
              </div>
              <div className={cn(hubPanelClass, "p-4 flex flex-col justify-between")}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Player of Matches</span>
                <span className="text-2xl font-bold font-display mt-1 text-primary">{summary.moms}</span>
              </div>
            </div>

            {/* Navigation Filter Tabs (Hidden in Print View) */}
            <div className="flex flex-wrap items-center gap-2 border-b border-border/60 pb-3 print:hidden">
              <CricketFilterPill
                active={activeTab === "all"}
                onClick={() => setActiveTab("all")}
              >
                All Sections
              </CricketFilterPill>
              <CricketFilterPill
                active={activeTab === "awards"}
                onClick={() => setActiveTab("awards")}
              >
                Awards & Honors
              </CricketFilterPill>
              <CricketFilterPill
                active={activeTab === "standings"}
                onClick={() => setActiveTab("standings")}
              >
                Points Table & Rules
              </CricketFilterPill>
              <CricketFilterPill
                active={activeTab === "stats"}
                onClick={() => setActiveTab("stats")}
              >
                Top Performers
              </CricketFilterPill>
              <CricketFilterPill
                active={activeTab === "results"}
                onClick={() => setActiveTab("results")}
              >
                Match Results
              </CricketFilterPill>
            </div>

            {/* ============================================================== */}
            {/* SECTION 1: AWARDS & HONORS (MATCH-WISE FIRST, THEN TOURNAMENT) */}
            {/* ============================================================== */}
            {(activeTab === "all" || activeTab === "awards") && (
              <div className="space-y-6">
                {/* 1A. Match-by-Match Awards (Awarded as matches finish) */}
                <section className={cn(hubCardClass, "p-5 sm:p-6 space-y-4")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <HubSectionHeader
                      title="Match-by-Match Awards"
                      subtitle="Player of the Match honors announced upon match conclusion"
                    />
                    <span className="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                      {awards?.length ?? 0} Award{(awards?.length ?? 0) === 1 ? "" : "s"} Given
                    </span>
                  </div>

                  {(awards?.length ?? 0) === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
                      No Player of the Match awards assigned yet. Awards appear automatically as matches finish.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {(awards ?? []).map((a) => {
                        const m = matchMap.get(a.matchId);
                        const home = m ? teamMap.get(m.homeTeamId) : null;
                        const away = m ? teamMap.get(m.awayTeamId) : null;
                        const matchFixtureTitle = home && away ? `${home.shortCode} vs ${away.shortCode}` : `Match #${a.matchId}`;

                        return (
                          <div
                            key={a.id}
                            className="bg-card/90 border border-border/70 rounded-xl p-4 flex flex-col justify-between gap-3 transition-colors hover:border-primary/40 shadow-xs"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pb-2 border-b border-border/40 mb-2.5">
                                <span className="font-semibold text-foreground/80 flex items-center gap-1.5">
                                  <Medal className="w-3.5 h-3.5 text-amber-500" />
                                  {matchFixtureTitle}
                                </span>
                                <Link
                                  href={cricketMatchPublicPath(tournamentId, a.matchId)}
                                  className="text-primary hover:underline inline-flex items-center gap-0.5 font-medium"
                                >
                                  Scorecard
                                  <ChevronRight className="w-3 h-3" />
                                </Link>
                              </div>
                              <p className="font-display font-bold text-base text-foreground">
                                {tournamentId ? (
                                  <Link
                                    href={cricketFanPlayerPath(tournamentId, a.playerId)}
                                    className="hover:text-primary transition-colors"
                                  >
                                    {a.playerName}
                                  </Link>
                                ) : (
                                  a.playerName
                                )}
                              </p>
                              <p className="text-xs font-medium text-muted-foreground mt-0.5">
                                {a.shortCode || a.teamName}
                              </p>
                              {a.reason ? (
                                <p className="text-xs text-foreground/80 mt-2 bg-muted/40 rounded-md px-2.5 py-1.5 italic">
                                  "{a.reason}"
                                </p>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* 1B. Tournament-Level Awards (Decided after tournament progress / completion) */}
                <section className={cn(hubCardClass, "p-5 sm:p-6 space-y-4 bg-linear-to-b from-card to-amber-500/5")}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <HubSectionHeader
                      title="Tournament-Level Awards"
                      subtitle="Evaluated across the tournament based on aggregate stats & accolades"
                    />
                    <span className="text-xs text-muted-foreground">
                      Concluded & finalized for the tournament
                    </span>
                  </div>

                  {tournamentAwards.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
                      Tournament awards will appear as balls are bowled and matches are completed.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {tournamentAwards.map((a) => {
                        const Icon = a.icon;
                        const isPot = a.id === "pot";
                        return (
                          <div
                            key={a.id}
                            className={cn(
                              "border rounded-xl p-4.5 flex flex-col justify-between gap-2 shadow-xs transition-colors",
                              isPot
                                ? "bg-amber-500/10 border-amber-500/40 ring-1 ring-amber-500/20"
                                : "bg-card border-border/70 hover:border-border",
                            )}
                          >
                            <div>
                              <div className="flex items-center gap-1.5 text-amber-500 dark:text-amber-400 mb-2">
                                <Icon className="w-4 h-4 shrink-0" />
                                <span className="text-xs font-bold uppercase tracking-wider">{a.title}</span>
                              </div>
                              <p className="font-display font-bold text-lg text-foreground">{a.playerName}</p>
                              <p className="text-xs font-semibold text-muted-foreground mt-0.5">{a.teamName}</p>
                            </div>
                            <div className="pt-2 border-t border-border/40 mt-1 flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Record:</span>
                              <span className="font-bold text-primary font-display">{a.detail}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            )}

            {/* ============================================================== */}
            {/* SECTION 2: POINTS TABLE & POINTS SYSTEM RULES INTEGRATED       */}
            {/* ============================================================== */}
            {(activeTab === "all" || activeTab === "standings") && (
              <section className={cn(hubCardClass, "p-5 sm:p-6 space-y-5")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <HubSectionHeader
                    title="Points Table & Standings"
                    subtitle="Ranked by Points, then Net Run Rate (NRR)"
                  />
                  <BtnSecondary onClick={handleExportCsv} className={cn(btnCompactClass, "print:hidden")}>
                    <Download className="w-3.5 h-3.5" />
                    Export CSV
                  </BtnSecondary>
                </div>

                {/* Standings Table */}
                <StandingsTable rows={standings ?? []} highlightTop={2} />

                {/* Points System & Scoring Rules Guide */}
                <div className="bg-muted/30 border border-border/60 rounded-xl p-4.5 space-y-3">
                  <div className="flex items-center gap-2 text-foreground font-semibold text-sm">
                    <Scale className="w-4 h-4 text-primary" />
                    <span>Tournament Points Allocation & Ranking System</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-card border border-border/60 rounded-lg p-3">
                      <p className="font-bold text-emerald-500 mb-1">Match Win</p>
                      <p className="text-foreground font-semibold text-base">+2 Points</p>
                      <p className="text-muted-foreground mt-1">Awarded to the victorious team</p>
                    </div>
                    <div className="bg-card border border-border/60 rounded-lg p-3">
                      <p className="font-bold text-amber-500 mb-1">Tie / No Result (NR)</p>
                      <p className="text-foreground font-semibold text-base">+1 Point</p>
                      <p className="text-muted-foreground mt-1">Shared in case of tie or rain washout</p>
                    </div>
                    <div className="bg-card border border-border/60 rounded-lg p-3">
                      <p className="font-bold text-rose-500 mb-1">Match Loss</p>
                      <p className="text-foreground font-semibold text-base">0 Points</p>
                      <p className="text-muted-foreground mt-1">No points for defeated team</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1 pt-1">
                    <p className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-primary shrink-0" />
                      <span>
                        <strong>Tie-breaker Order:</strong> Total Points &rarr; Net Run Rate (NRR) &rarr; Head-to-Head Result.
                      </span>
                    </p>
                    <p className="pl-5 text-muted-foreground/90">
                      <strong>NRR Formula:</strong> (Total Runs Scored / Total Overs Faced) &minus; (Total Runs Conceded / Total Overs Bowled).
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* ============================================================== */}
            {/* SECTION 3: TOP INDIVIDUAL PERFORMERS & LEADERBOARDS           */}
            {/* ============================================================== */}
            {(activeTab === "all" || activeTab === "stats") && (
              <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className={cn(hubCardClass, "p-5 space-y-3")}>
                  <HubSectionHeader title="Top Run Scorers" subtitle="Leading tournament run getters" />
                  <div className="mt-2">
                    <LeaderboardTable rows={runs ?? []} valueLabel="Runs" tournamentId={tournamentId} />
                  </div>
                </div>
                <div className={cn(hubCardClass, "p-5 space-y-3")}>
                  <HubSectionHeader title="Top Wicket Takers" subtitle="Leading tournament wicket takers" />
                  <div className="mt-2">
                    <LeaderboardTable rows={wickets ?? []} valueLabel="Wkts" tournamentId={tournamentId} />
                  </div>
                </div>
              </section>
            )}

            {/* ============================================================== */}
            {/* SECTION 4: COMPLETED MATCH RESULTS                             */}
            {/* ============================================================== */}
            {(activeTab === "all" || activeTab === "results") && (
              <section className={cn(hubCardClass, "p-5 sm:p-6 space-y-4")}>
                <HubSectionHeader title="Completed Match Results" subtitle="Final fixtures and outcome summaries" />

                {(matches ?? []).filter((m) => isTerminalCricketMatchStatus(m.status)).length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
                    No completed matches recorded yet. Match summaries will appear as soon as games finish.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/40 text-sm">
                    {(matches ?? [])
                      .filter((m) => isTerminalCricketMatchStatus(m.status))
                      .map((m) => {
                        const home = teamMap.get(m.homeTeamId);
                        const away = teamMap.get(m.awayTeamId);
                        return (
                          <li key={m.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-foreground">
                                {home?.name ?? "Home"} vs {away?.name ?? "Away"}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono">
                                ({home?.shortCode ?? "H"} vs {away?.shortCode ?? "A"})
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-semibold text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                                {m.resultSummary ?? m.status}
                              </span>
                              <Link
                                href={cricketMatchPublicPath(tournamentId, m.id)}
                                className="text-xs font-semibold text-primary hover:underline print:hidden"
                              >
                                View Scorecard
                              </Link>
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                )}
              </section>
            )}

            <p className="text-xs text-muted-foreground print:hidden">
              Tip: Click <strong>Print / PDF</strong> in the top right to generate a complete official tournament report including standings, awards, and leaderboard summaries.
            </p>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
