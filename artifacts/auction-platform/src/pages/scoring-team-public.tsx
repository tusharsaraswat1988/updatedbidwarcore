import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { getTournamentTeamProfile } from "@/lib/scoring-api";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import {
  cricketFanPlayerPath,
  cricketFanMatchPath,
  cricketFanTeamsPath,
  cricketTeamPublicPath,
} from "@/lib/tournament-navigation";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import {
  cricketCardClass,
  cricketSectionTitleClass,
} from "@/components/scoring/cricket-page-chrome";
import type { PublicSchedulePayload } from "@/lib/public-tournament-types";
import { cn } from "@/lib/utils";

export default function ScoringTeamPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket/team/:teamId");
  const tournamentId = parseInt(params?.id || "0");
  const teamId = parseInt(params?.teamId || "0");

  const { data: schedule } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-team-public", tournamentId, teamId],
    queryFn: () => getTournamentTeamProfile(tournamentId, teamId),
    enabled: !!tournamentId && !!teamId,
  });

  const liveMatchId = (schedule?.matches ?? []).find((m) => m.status === "live")?.id ?? null;
  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${cricketTeamPublicPath(tournamentId, teamId)}`
      : "";

  if (isLoading) return <CricketFanLoading tournamentId={tournamentId} />;
  if (error || !data) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Team profile not available." />;
  }

  const { team, standing, squad, recentResults, topBatsmen } = data;
  const captain =
    squad.find((p) => (p.role ?? "").toLowerCase().includes("captain")) ?? null;

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={liveMatchId}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={cricketFanTeamsPath(tournamentId)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Teams
        </Link>
        {pageUrl ? <ShareButtons url={pageUrl} shareText={`${team.name} — team profile`} /> : null}
      </div>

      <header className="mb-8 flex items-start gap-4">
        {team.logoUrl ? (
          <img
            src={team.logoUrl}
            alt=""
            className="h-20 w-20 rounded-2xl object-cover border border-border bg-muted/30 shrink-0"
          />
        ) : (
          <div
            className="h-20 w-20 rounded-2xl border border-border flex items-center justify-center font-display text-xl font-bold shrink-0"
            style={{
              backgroundColor: team.color ? `${team.color}22` : undefined,
              color: team.color ?? undefined,
            }}
          >
            {team.shortCode.slice(0, 3)}
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Team</p>
          <h1 className="font-display text-3xl font-bold tracking-tight truncate">{team.name}</h1>
          <p className="text-sm text-muted-foreground">{team.shortCode}</p>
          {captain ? (
            <p className="text-sm">
              Captain:{" "}
              <Link
                href={cricketFanPlayerPath(tournamentId, captain.id)}
                className="text-primary hover:underline"
              >
                {captain.name}
              </Link>
            </p>
          ) : null}
          {standing ? (
            <p className="text-sm text-primary tabular-nums">
              {standing.played}P · {standing.won}W · {standing.lost}L · {standing.points} pts · NRR{" "}
              {standing.netRunRate > 0 ? "+" : ""}
              {standing.netRunRate.toFixed(3)}
            </p>
          ) : null}
        </div>
      </header>

      <div className="space-y-6">
        {topBatsmen.length > 0 ? (
          <section className={cn(cricketCardClass, "overflow-hidden")}>
            <h2 className={cn(cricketSectionTitleClass, "px-4 py-3 border-b border-border")}>
              Top run scorers
            </h2>
            <ul>
              {topBatsmen.map((b) => (
                <li
                  key={b.playerId}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0"
                >
                  <Link
                    href={cricketFanPlayerPath(tournamentId, b.playerId)}
                    className="text-foreground hover:text-primary"
                  >
                    {b.playerName}
                  </Link>
                  <span className="text-sm tabular-nums text-primary">{b.runs} runs</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={cn(cricketCardClass, "overflow-hidden")}>
          <h2 className={cn(cricketSectionTitleClass, "px-4 py-3 border-b border-border")}>Players</h2>
          <ul>
            {squad.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0 text-sm"
              >
                <Link
                  href={cricketFanPlayerPath(tournamentId, p.id)}
                  className="text-foreground hover:text-primary"
                >
                  {p.name}
                  {captain?.id === p.id ? (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-primary">C</span>
                  ) : null}
                </Link>
                <span className="text-muted-foreground">{p.role ?? p.status}</span>
              </li>
            ))}
          </ul>
        </section>

        {recentResults.length > 0 ? (
          <section className="space-y-2">
            <h2 className={cricketSectionTitleClass}>Recent results</h2>
            <ul className="space-y-2">
              {recentResults.map((m) => (
                <li key={m.id}>
                  <Link
                    href={cricketFanMatchPath(tournamentId, m.id)}
                    className={cn(cricketCardClass, "block px-4 py-2 text-sm hover:border-primary/25")}
                  >
                    <span className={m.won ? "text-emerald-400" : "text-muted-foreground"}>
                      {m.won ? "W" : "L"}
                    </span>
                    <span className="ml-2 text-foreground">{m.resultSummary ?? `Match #${m.id}`}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </CricketFanExperienceShell>
  );
}
