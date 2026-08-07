import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { getScoringStandings } from "@/lib/scoring-api";
import { StandingsTable } from "@/components/scoring/standings-table";
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
  const top4 = (standings ?? []).slice(0, 4);

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
          Qualification band, net run rate, and full league standings.
        </p>
      </header>

      {top4.length > 0 ? (
        <section className="mb-8">
          <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Qualification — Top 4</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {top4.map((row, idx) => (
              <Link
                key={row.teamId}
                href={cricketFanTeamPath(tournamentId, row.teamId)}
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
                      NRR {row.netRunRate > 0 ? "+" : ""}
                      {row.netRunRate.toFixed(3)}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Full standings</h2>
        <StandingsTable rows={standings ?? []} highlightTop={4} />
      </section>
    </CricketFanExperienceShell>
  );
}
