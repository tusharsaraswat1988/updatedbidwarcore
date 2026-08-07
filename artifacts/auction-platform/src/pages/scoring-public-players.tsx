import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { getScoringLeaderboard, listScoringAwards } from "@/lib/scoring-api";
import {
  CricketFanEmpty,
  CricketFanExperienceShell,
  CricketFanLoading,
} from "@/components/scoring/public-tournament-shell";
import {
  CricketFilterPill,
  cricketCardClass,
  cricketSectionTitleClass,
} from "@/components/scoring/cricket-page-chrome";
import { cricketFanPlayerPath } from "@/lib/tournament-navigation";
import type { PublicSchedulePayload } from "@/lib/public-tournament-types";
import { cn } from "@/lib/utils";
import type { LeaderboardCategory } from "@workspace/scoring-core";

const TABS: { key: LeaderboardCategory; label: string }[] = [
  { key: "runs", label: "Runs" },
  { key: "wickets", label: "Wickets" },
  { key: "strike_rate", label: "Strike rate" },
  { key: "economy", label: "Economy" },
  { key: "sixes", label: "Sixes" },
  { key: "fours", label: "Fours" },
];

export default function ScoringPublicPlayersPage() {
  const [, params] = useRoute("/tournament/:id/cricket/players");
  const tournamentId = parseInt(params?.id || "0");
  const [tab, setTab] = useState<LeaderboardCategory>("runs");

  const { data: schedule, isLoading: loadingSchedule } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId) as Promise<PublicSchedulePayload>,
    enabled: !!tournamentId,
    refetchInterval: (q) => {
      const hasLive = (q.state.data?.matches ?? []).some((m) => m.status === "live");
      return hasLive ? 20000 : 60000;
    },
  });

  const { data: rows, isLoading: loadingLb } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, tab],
    queryFn: () => getScoringLeaderboard(tournamentId, tab, 40),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const { data: awards } = useQuery({
    queryKey: ["scoring-awards", tournamentId],
    queryFn: () => listScoringAwards(tournamentId),
    enabled: !!tournamentId,
  });

  const awardsByPlayer = useMemo(() => {
    const map = new Map<number, number>();
    for (const a of awards ?? []) {
      map.set(a.playerId, (map.get(a.playerId) ?? 0) + 1);
    }
    return map;
  }, [awards]);

  const liveMatchId = (schedule?.matches ?? []).find((m) => m.status === "live")?.id ?? null;

  if (loadingSchedule || loadingLb) return <CricketFanLoading tournamentId={tournamentId} />;
  if (!schedule?.tournament) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Players not available." />;
  }

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={liveMatchId}>
      <header className="mb-6 space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Players</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{schedule.tournament.name}</h1>
        <p className="text-sm text-muted-foreground">
          Batting and bowling leaders, with awards across the tournament.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <CricketFilterPill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </CricketFilterPill>
        ))}
      </div>

      {(rows ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No player stats yet.</p>
      ) : (
        <ul className="space-y-2">
          {(rows ?? []).map((row) => {
            const mom = awardsByPlayer.get(row.playerId) ?? 0;
            return (
              <li key={`${row.playerId}-${row.rank}`}>
                <Link
                  href={cricketFanPlayerPath(tournamentId, row.playerId)}
                  className={cn(
                    cricketCardClass,
                    "flex items-center gap-4 px-4 py-3 hover:border-primary/30 transition-colors",
                  )}
                >
                  <span className="w-8 text-sm tabular-nums text-muted-foreground">{row.rank}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{row.playerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {row.teamName}
                      {mom > 0 ? ` · ${mom} MoM` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-primary tabular-nums">{row.value}</p>
                    <p className={cn(cricketSectionTitleClass, "normal-case tracking-normal text-[10px]")}>
                      {TABS.find((t) => t.key === tab)?.label}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </CricketFanExperienceShell>
  );
}
