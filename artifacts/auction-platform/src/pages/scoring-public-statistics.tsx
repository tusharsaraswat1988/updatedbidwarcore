import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { getScoringLeaderboard, listScoringAwards } from "@/lib/scoring-api";
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
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
import { cricketFanMatchPath, cricketFanPlayerPath } from "@/lib/tournament-navigation";
import type { PublicSchedulePayload } from "@/lib/public-tournament-types";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import type { LeaderboardCategory } from "@workspace/scoring-core";

const TABS: { key: LeaderboardCategory; label: string; valueLabel: string }[] = [
  { key: "runs", label: "Runs", valueLabel: "Runs" },
  { key: "wickets", label: "Wickets", valueLabel: "Wkts" },
  { key: "strike_rate", label: "Strike rate", valueLabel: "SR" },
  { key: "economy", label: "Economy", valueLabel: "Econ" },
  { key: "sixes", label: "Sixes", valueLabel: "6s" },
  { key: "fours", label: "Fours", valueLabel: "4s" },
];

export default function ScoringPublicStatisticsPage() {
  const [, params] = useRoute("/tournament/:id/cricket/statistics");
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
    queryFn: () => getScoringLeaderboard(tournamentId, tab, 25),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const { data: awards } = useQuery({
    queryKey: ["scoring-awards", tournamentId],
    queryFn: () => listScoringAwards(tournamentId),
    enabled: !!tournamentId,
  });

  const liveMatchId = (schedule?.matches ?? []).find((m) => m.status === "live")?.id ?? null;
  const active = TABS.find((t) => t.key === tab);

  if (loadingSchedule || loadingLb) return <CricketFanLoading tournamentId={tournamentId} />;
  if (!schedule?.tournament) {
    return <CricketFanEmpty tournamentId={tournamentId} message="Statistics not available." />;
  }

  return (
    <CricketFanExperienceShell tournamentId={tournamentId} liveMatchId={liveMatchId}>
      <header className="mb-6 space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Statistics</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{schedule.tournament.name}</h1>
        <p className="text-sm text-muted-foreground">
          Tournament leaderboards for batting, bowling, and boundary hitting.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        {TABS.map((t) => (
          <CricketFilterPill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </CricketFilterPill>
        ))}
      </div>

      <section className="mb-10">
        <h2 className={cn(cricketSectionTitleClass, "mb-3")}>{active?.label ?? "Leaderboard"}</h2>
        <LeaderboardTable
          rows={rows ?? []}
          valueLabel={active?.valueLabel}
          tournamentId={tournamentId}
        />
      </section>

      {(awards ?? []).length > 0 ? (
        <section>
          <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Awards</h2>
          <ul className="space-y-2">
            {(awards ?? []).slice(0, 20).map((a) => (
              <li key={a.id} className={cn(cricketCardClass, "px-4 py-3")}>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  {a.awardType === "man_of_the_match" ? "Man of the Match" : a.awardType}
                </p>
                <p className="text-sm mt-1">
                  <Link
                    href={cricketFanPlayerPath(tournamentId, a.playerId)}
                    className="font-semibold hover:text-primary"
                  >
                    {a.playerName}
                  </Link>
                  <span className="text-muted-foreground"> · {a.teamName}</span>
                </p>
                {a.reason ? <p className="text-xs text-muted-foreground mt-1">{a.reason}</p> : null}
                <Link
                  href={cricketFanMatchPath(tournamentId, a.matchId)}
                  className="text-xs text-primary hover:underline mt-1 inline-block"
                >
                  View match →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </CricketFanExperienceShell>
  );
}
