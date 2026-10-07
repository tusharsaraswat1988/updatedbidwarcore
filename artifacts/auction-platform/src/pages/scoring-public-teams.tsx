import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { getScoringStandings } from "@/lib/scoring-api";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import { cricketCardClass, cricketSectionTitleClass } from "@/components/scoring/cricket-page-chrome";
import { cricketFanTeamPath } from "@/lib/tournament-navigation";
import type { PublicSchedulePayload, PublicTeam } from "@/lib/public-tournament-types";
import { cn } from "@/lib/utils";
import {
  formatNetRunRate,
  formatPointsPercentage,
  isMultiDrawCompetition,
  partitionByDraw,
} from "@workspace/scoring-core/cricket";

export default function ScoringPublicTeamsPage() {
  const [, params] = useRoute("/tournament/:id/cricket/teams");
  const tournamentId = parseInt(params?.id || "0");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
    refetchInterval: (q) => {
      const hasLive = (q.state.data?.matches ?? []).some((m) => m.status === "live");
      return hasLive ? 20000 : 60000;
    },
  });

  const { data: standings } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const standingLines = useMemo(() => {
    const map = new Map<number, Array<NonNullable<typeof standings>[number] & { drawName?: string | null }>>();
    const sections = partitionByDraw(standings?.groups ?? [], standings ?? []);
    const nameByDraw = new Map(sections.map((section) => [section.drawId, section.drawName]));
    for (const row of standings ?? []) {
      const list = map.get(row.teamId) ?? [];
      list.push({ ...row, drawName: row.drawId != null ? nameByDraw.get(row.drawId) : null });
      map.set(row.teamId, list);
    }
    return map;
  }, [standings]);
  const multiDraw = isMultiDrawCompetition(standings?.groups ?? [], standings ?? []);

  const liveMatchId = (data?.matches ?? []).find((m) => m.status === "live")?.id ?? null;
  const teams = (data?.teams ?? []) as PublicTeam[];

  if (isLoading) return <CricketFanLoading tournamentId={tournamentId} />;
  if (error || !data?.tournament) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Teams not available." />;
  }

  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={liveMatchId}>
      <header className="mb-6 space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Teams</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{data.tournament.name}</h1>
        <p className="text-sm text-muted-foreground">
          {multiDraw
            ? "Each team line is one competition. The same name can appear in more than one draw."
            : "Franchises, form, and net run rate."}
        </p>
      </header>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No teams published yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {sorted.map((team) => {
            const lines = standingLines.get(team.id) ?? [];
            const standing = lines.length === 1 ? lines[0] : undefined;
            return (
              <li key={team.id}>
                <Link
                  href={cricketFanTeamPath(tournamentId, team.id, standing?.drawId)}
                  className={cn(
                    cricketCardClass,
                    "flex items-center gap-4 px-4 py-4 hover:border-primary/30 transition-colors h-full",
                  )}
                >
                  {team.logoUrl ? (
                    <img
                      src={team.logoUrl}
                      alt=""
                      className="h-14 w-14 rounded-xl object-cover border border-border bg-muted/30 shrink-0"
                    />
                  ) : (
                    <div
                      className="h-14 w-14 rounded-xl border border-border flex items-center justify-center font-display font-bold shrink-0"
                      style={{
                        backgroundColor: team.color ? `${team.color}22` : undefined,
                        color: team.color ?? undefined,
                      }}
                    >
                      {team.shortCode.slice(0, 3)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{team.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {team.shortCode}
                      {team.squadCount != null ? ` · ${team.squadCount} players` : ""}
                    </p>
                    {lines.length > 1 ? (
                      <ul className="mt-1.5 space-y-1">
                        {lines.map((line) => (
                          <li key={`${line.drawId ?? "legacy"}-${line.teamId}`} className="text-xs text-primary tabular-nums">
                            {line.drawName ?? "Competition"} · {line.played}P · {line.points} pts · NRR {formatNetRunRate(line.netRunRate)}
                          </li>
                        ))}
                      </ul>
                    ) : standing ? (
                      <p className="text-xs text-primary mt-1.5 tabular-nums">
                        {standing.played}P · {standing.won}W · {standing.lost}L · {formatPointsPercentage(standing.pointsPercentage)} · NRR{" "}
                        {formatNetRunRate(standing.netRunRate)}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1.5">Awaiting first result</p>
                    )}
                  </div>
                  {standing ? (
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-primary tabular-nums">{standing.points}</p>
                      <p className={cn(cricketSectionTitleClass, "normal-case tracking-normal text-[10px]")}>
                        pts
                      </p>
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CricketFanExperienceShell>
  );
}
