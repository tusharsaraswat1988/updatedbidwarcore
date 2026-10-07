/**
 * Cricket Standings — organizer points table.
 * Route: /tournament/:id/score/standings
 */
import { useMemo } from "react";
import {
  competitionGroupTitle,
  isMultiDrawCompetition,
  partitionByDraw,
  rowsForCompetitionSelection,
  formatNetRunRate,
} from "@workspace/scoring-core/cricket";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  CricketOrganizerPageShell,
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  HubKpiCard,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
  hubPanelClass,
} from "@/components/scoring/cricket-page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { StandingsTable } from "@/components/scoring/standings-table";
import { getScoringStandings } from "@/lib/scoring-api";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketPublicPath } from "@/lib/tournament-navigation";
import { cricketReportsPath } from "@/lib/cricket-routes";
import { ExternalLink, FileText, RefreshCw, Shield, TrendingUp, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CricketStandingsPage() {
  const [, params] = useRoute("/tournament/:id/score/standings");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: standings, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: scoringActive && !!tournamentId,
    refetchInterval: 30000,
  });

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  const rows = standings ?? [];
  const groups = standings?.groups ?? [];
  const multiDraw = isMultiDrawCompetition(groups, rows);
  const sections = partitionByDraw(groups, rows);
  const legacyBand = rowsForCompetitionSelection(groups, rows, { kind: "all" });

  const leader = multiDraw ? null : rows[0];
  let bestNrr = rows[0] ?? null;
  for (const row of rows) {
    if (bestNrr == null || row.netRunRate > bestNrr.netRunRate) bestNrr = row;
  }

  const totalMatchesPlayed = useMemo(() => {
    return rows.reduce((sum, r) => sum + r.played, 0) / 2;
  }, [rows]);

  const publicStandingsUrl = cricketPublicPath(tournamentId);

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Standings & Points Table"
        subtitle={tournament?.name ?? "Tournament points table · sorted by points percentage, then net run rate"}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BtnSecondary
              className={btnCompactClass}
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Refresh
            </BtnSecondary>
            <BtnSecondary
              href={cricketReportsPath(tournamentId)}
              className={btnCompactClass}
            >
              <FileText className="w-4 h-4" />
              Export / Print
            </BtnSecondary>
            <BtnSecondary
              href={publicStandingsUrl}
              external
              className={btnCompactClass}
            >
              <ExternalLink className="w-4 h-4" />
              Public Standings Page
            </BtnSecondary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-6">
        {tournamentLoading || (scoringActive && isLoading && !standings) ? (
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
            desc="Enable scoring to calculate standings and Net Run Rates."
          />
        ) : (
          <>
            {/* KPI Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
              <HubKpiCard
                label={multiDraw ? "Competitions" : "Tournament Leader"}
                value={multiDraw ? sections.length : leader?.shortCode || leader?.teamName || "—"}
                subtitle={
                  multiDraw
                    ? "Each draw has its own table"
                    : leader
                      ? `${leader.points} Pts (${leader.won}W - ${leader.lost}L)`
                      : "No results yet"
                }
                icon={Trophy}
                tint="primary"
              />
              <HubKpiCard
                label="Best Net Run Rate"
                value={bestNrr && bestNrr.played > 0 ? formatNetRunRate(bestNrr.netRunRate) : "—"}
                subtitle={bestNrr?.shortCode ? `${bestNrr.shortCode}` : "No matches yet"}
                icon={TrendingUp}
                tint="green"
              />
              <HubKpiCard
                label="Total Teams"
                value={rows.length}
                subtitle="In competition"
                icon={Shield}
                tint="muted"
              />
              <HubKpiCard
                label="Completed Matches"
                value={Math.floor(totalMatchesPlayed)}
                subtitle="Results factored into table"
                icon={Trophy}
                tint="red"
              />
            </div>

            {/* Tie-break Rule Explainer Panel */}
            <div className={cn(hubPanelClass, "text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5")}>
              <div className="space-y-0.5">
                <span className="font-bold text-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  Official Tie-Break Order:
                </span>
                <span>1. Points % → 2. Net Run Rate → 3. Head-to-head → 4. Team id</span>
              </div>
              <span className="text-[11px] text-muted-foreground/80 bg-muted/40 px-2 py-1 rounded border border-border/40 shrink-0">
                Auto-calculated
              </span>
            </div>

            {/* Standings Table Container */}
            {groups.length > 0 ? (
              <div className="space-y-6">
                {sections.map((section) => (
                  <div key={section.drawId ?? "legacy"} className="space-y-6">
                    {multiDraw ? (
                      <h2 className="font-display text-xl font-bold">{section.drawName}</h2>
                    ) : null}
                    {section.groups.map((g) => (
                      <section key={g.id} className={cn(hubCardClass, "p-4 sm:p-6 space-y-4")}>
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                          <HubSectionHeader
                            title={`${competitionGroupTitle(g)} Points Table`}
                            subtitle={`${g.rows.length} teams · Top ${g.qualifiersPerGroup ?? 2} qualify`}
                          />
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-primary/10 text-primary border border-primary/20">
                            Top {g.qualifiersPerGroup ?? 2} qualify
                          </span>
                        </div>
                        <StandingsTable rows={g.rows} highlightTop={g.qualifiersPerGroup ?? 2} />
                      </section>
                    ))}
                  </div>
                ))}
                {multiDraw ? (
                  <p className="text-xs text-muted-foreground">
                    Qualification stays inside each competition. This page does not rank a tournament-wide top 4.
                  </p>
                ) : (
                  <section className={cn(hubCardClass, "p-4 sm:p-6 space-y-4 opacity-80 hover:opacity-100 transition-opacity")}>
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                      <HubSectionHeader
                        title="Overall Standings"
                        subtitle="Combined view of this competition's groups"
                      />
                    </div>
                    <StandingsTable rows={rows} highlightTop={0} />
                  </section>
                )}
              </div>
            ) : multiDraw ? (
              <div className="space-y-6">
                {sections.map((section) => (
                  <section key={section.drawId ?? "legacy"} className={cn(hubCardClass, "p-4 sm:p-6 space-y-4")}>
                    <HubSectionHeader title={section.drawName} subtitle="Competition points table" />
                    <StandingsTable rows={section.rows} highlightTop={0} />
                  </section>
                ))}
              </div>
            ) : (
              <section className={cn(hubCardClass, "p-4 sm:p-6 space-y-4")}>
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
                  <HubSectionHeader
                    title="Points Table & Net Run Rate"
                    subtitle={`${rows.length} franchise team${rows.length === 1 ? "" : "s"}`}
                  />
                </div>
                <StandingsTable rows={rows} highlightTop={legacyBand.qualifiers} />
              </section>
            )}
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
