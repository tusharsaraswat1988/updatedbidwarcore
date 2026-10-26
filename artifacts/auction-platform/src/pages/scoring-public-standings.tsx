import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { getScoringStandings } from "@/lib/scoring-api";
import { StandingsTable } from "@/components/scoring/standings-table";
import {
  competitionGroupTitle,
  isMultiDrawCompetition,
  partitionByDraw,
  rowsForCompetitionSelection,
  formatNetRunRate,
  formatPointsPercentage,
} from "@workspace/scoring-core/cricket";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import { cricketCardClass, cricketSectionTitleClass } from "@/components/scoring/cricket-page-chrome";
import { cricketFanTeamPath } from "@/lib/tournament-navigation";
import type { PublicSchedulePayload } from "@/lib/public-tournament-types";
import { cn } from "@/lib/utils";

export default function ScoringPublicStandingsPage() {
  const [, params] = useRoute("/tournament/:id/cricket/standings");
  const tournamentId = parseInt(params?.id || "0");

  const { data: schedule, isLoading: loadingSchedule } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
    refetchInterval: (q) => {
      const hasLive = (q.state.data?.matches ?? []).some((m) => m.status === "live");
      return hasLive ? 20000 : 60000;
    },
  });

  const { data: standings, isLoading: loadingStandings, error } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const liveMatchId = (schedule?.matches ?? []).find((m) => m.status === "live")?.id ?? null;
  const groups = standings?.groups ?? [];
  const rows = standings ?? [];
  const multiDraw = isMultiDrawCompetition(groups, rows);
  const sections = partitionByDraw(groups, rows);
  const legacyBand = rowsForCompetitionSelection(groups, rows, { kind: "all" });
  const top4 = legacyBand.qualifiers > 0 ? legacyBand.rows.slice(0, legacyBand.qualifiers) : [];

  if (loadingSchedule || loadingStandings) return <CricketFanLoading tournamentId={tournamentId} />;
  if (error || !schedule?.tournament) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Standings not available." />;
  }

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={liveMatchId}>
      <header className="mb-6 space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Points table</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{schedule.tournament.name}</h1>
        <p className="text-sm text-muted-foreground">
          Points percentage, net run rate, and league standings.
        </p>
      </header>

      {top4.length > 0 ? (
        <section className="mb-8">
          <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Qualification — Top 4</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {top4.map((row, idx) => (
              <Link
                key={`${row.drawId ?? "legacy"}-${row.teamId}`}
                href={cricketFanTeamPath(tournamentId, row.teamId, row.drawId)}
                className={cn(
                  cricketCardClass,
                  "px-4 py-3 hover:border-primary/30 transition-colors",
                  idx < 4 && "border-primary/20 bg-primary/5",
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg font-display font-bold text-primary tabular-nums w-6">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{row.teamName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.played} played · {row.won}W-{row.lost}L
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary tabular-nums">{row.points} pts</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {formatPointsPercentage(row.pointsPercentage)} · NRR {formatNetRunRate(row.netRunRate)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {groups.length > 0 ? (
        <div className="space-y-8">
          {sections.map((section) => (
            <div key={section.drawId ?? "legacy"} className="space-y-6">
              {multiDraw ? (
                <h2 className="font-display text-2xl font-bold tracking-tight">{section.drawName}</h2>
              ) : null}
              {section.groups.map((g) => (
                <section key={g.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className={cn(cricketSectionTitleClass)}>{competitionGroupTitle(g)} Standings</h3>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
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
              Each competition qualifies its own teams. There is no tournament-wide top 4.
            </p>
          ) : (
            <section className="space-y-2 opacity-80">
              <h2 className={cn(cricketSectionTitleClass)}>Overall Standings</h2>
              <StandingsTable rows={rows} highlightTop={0} />
            </section>
          )}
        </div>
      ) : multiDraw ? (
        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.drawId ?? "legacy"} className="space-y-2">
              <h2 className={cn(cricketSectionTitleClass)}>{section.drawName}</h2>
              <StandingsTable rows={section.rows} highlightTop={0} />
            </section>
          ))}
        </div>
      ) : (
        <section>
          <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Full standings</h2>
          <StandingsTable rows={rows} highlightTop={legacyBand.qualifiers} />
        </section>
      )}
    </CricketFanExperienceShell>
  );
}
