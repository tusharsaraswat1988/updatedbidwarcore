import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Award, Trophy } from "lucide-react";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { getTournamentPlayerProfile } from "@/lib/scoring-api";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import {
  cricketFanMatchPath,
  cricketFanPlayersPath,
  cricketFanTeamPath,
  cricketPlayerPublicPath,
  globalCricketPlayerPath,
} from "@/lib/tournament-navigation";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import {
  cricketCardClass,
  cricketPanelClass,
  cricketSectionTitleClass,
} from "@/components/scoring/cricket-page-chrome";
import type { PublicSchedulePayload } from "@/lib/public-tournament-types";
import { cn } from "@/lib/utils";

export default function ScoringPlayerPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket/player/:playerId");
  const tournamentId = parseInt(params?.id || "0");
  const playerId = parseInt(params?.playerId || "0");

  const { data: schedule } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-player-public", tournamentId, playerId],
    queryFn: () => getTournamentPlayerProfile(tournamentId, playerId),
    enabled: !!tournamentId && !!playerId,
  });

  const liveMatchId = (schedule?.matches ?? []).find((m) => m.status === "live")?.id ?? null;
  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${cricketPlayerPublicPath(tournamentId, playerId)}`
      : "";

  if (isLoading) return <CricketFanLoading tournamentId={tournamentId} />;
  if (error || !data) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Player profile not available." />;
  }

  const { player, team, stats, manOfTheMatchAwards } = data;

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={liveMatchId}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href={cricketFanPlayersPath(tournamentId)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Players
        </Link>
        {pageUrl ? (
          <ShareButtons url={pageUrl} shareText={`${player.name} — cricket stats`} />
        ) : null}
      </div>

      <header className="mb-8 flex items-start gap-4">
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt=""
            className="h-20 w-20 rounded-2xl object-cover border border-border bg-muted/30 shrink-0"
          />
        ) : (
          <div className="h-20 w-20 rounded-2xl border border-border bg-muted/30 flex items-center justify-center font-display text-xl font-bold text-muted-foreground shrink-0">
            {player.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Player</p>
          <h1 className="font-display text-3xl font-bold tracking-tight truncate">{player.name}</h1>
          {player.role ? <p className="text-sm text-muted-foreground">{player.role}</p> : null}
          {team ? (
            <Link
              href={cricketFanTeamPath(tournamentId, team.id)}
              className="text-primary hover:underline inline-block text-sm"
            >
              {team.name} ({team.shortCode})
            </Link>
          ) : null}
          {player.globalPlayerId ? (
            <Link
              href={globalCricketPlayerPath(player.globalPlayerId)}
              className="block text-xs text-muted-foreground hover:text-primary"
            >
              Career profile →
            </Link>
          ) : null}
        </div>
      </header>

      {stats ? (
        <section className={cricketPanelClass}>
          <h2 className={cn(cricketSectionTitleClass, "mb-3 flex items-center gap-2")}>
            <Trophy className="h-4 w-4 text-primary" />
            Tournament stats
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              ["Matches", stats.matches],
              ["Runs", stats.runs],
              ["Wickets", stats.wickets],
              ["Strike rate", stats.strikeRate],
              ["Economy", stats.economy],
              ["Fours", stats.fours],
              ["Sixes", stats.sixes],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-muted/30 px-3 py-2">
                <div className="text-lg font-bold text-foreground tabular-nums">{value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className={cn(cricketPanelClass, "mt-6")}>
        <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Batting & bowling</h2>
        <div className="grid gap-3 sm:grid-cols-2 text-sm">
          <div className={cn(cricketCardClass, "px-4 py-3 bg-card/50")}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Batting</p>
            <p>
              {stats?.runs ?? 0} runs · SR {stats?.strikeRate ?? 0}
            </p>
            <p className="text-muted-foreground mt-1">
              {stats?.fours ?? 0} fours · {stats?.sixes ?? 0} sixes
            </p>
          </div>
          <div className={cn(cricketCardClass, "px-4 py-3 bg-card/50")}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Bowling</p>
            <p>{stats?.wickets ?? 0} wickets</p>
            <p className="text-muted-foreground mt-1">Economy {stats?.economy ?? 0}</p>
          </div>
        </div>
      </section>

      {manOfTheMatchAwards.length > 0 ? (
        <section className={cn(cricketPanelClass, "mt-6 border-primary/25 bg-primary/5 space-y-2")}>
          <h2 className={cn(cricketSectionTitleClass, "text-primary flex items-center gap-2")}>
            <Award className="h-4 w-4" />
            Awards ({manOfTheMatchAwards.length})
          </h2>
          <ul className="space-y-2 text-sm">
            {manOfTheMatchAwards.map((a) => (
              <li key={a.matchId}>
                <Link
                  href={cricketFanMatchPath(tournamentId, a.matchId)}
                  className="text-foreground hover:text-primary"
                >
                  Man of the Match — Match #{a.matchId}
                </Link>
                {a.reason ? <span className="text-muted-foreground"> — {a.reason}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </CricketFanExperienceShell>
  );
}
