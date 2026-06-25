import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getGlobalCricketLeaderboard } from "@/lib/scoring-api";
import { globalCricketPlayerPath } from "@/lib/tournament-navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardCategory } from "@workspace/scoring-core";
import {
  CricketFilterPill,
  CricketPublicPageHeader,
  CricketPublicShell,
  cricketTableHeadRowClass,
  cricketTableWrapClass,
} from "@/components/scoring/cricket-page-chrome";

const TABS: { key: LeaderboardCategory; label: string; valueLabel: string }[] = [
  { key: "runs", label: "Runs", valueLabel: "Runs" },
  { key: "wickets", label: "Wickets", valueLabel: "Wkts" },
  { key: "sixes", label: "Sixes", valueLabel: "6s" },
  { key: "fours", label: "Fours", valueLabel: "4s" },
];

export default function CricketGlobalLeaderboardsPage() {
  const [tab, setTab] = useState<LeaderboardCategory>("runs");
  const active = TABS.find((t) => t.key === tab);

  const { data, isLoading, error } = useQuery({
    queryKey: ["cricket-global-leaderboard", tab],
    queryFn: () => getGlobalCricketLeaderboard(tab, 25),
  });

  return (
    <CricketPublicShell>
      <CricketPublicPageHeader
        eyebrow="BidWar Cricket"
        title="Global leaderboards"
        subtitle={
          <p>Career stats across all BidWar tournaments — updated when matches complete.</p>
        }
      />

      <div className="flex gap-2 flex-wrap mb-6">
        {TABS.map((t) => (
          <CricketFilterPill key={t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </CricketFilterPill>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full bg-muted" />
      ) : error ? (
        <p className="text-muted-foreground">Leaderboards unavailable.</p>
      ) : !data?.length ? (
        <p className="text-muted-foreground">No career stats yet.</p>
      ) : (
        <div className={cricketTableWrapClass}>
          <table className="w-full text-sm">
            <thead>
              <tr className={cricketTableHeadRowClass}>
                <th className="px-3 py-2 font-medium w-10">#</th>
                <th className="px-3 py-2 font-medium">Player</th>
                <th className="px-3 py-2 font-medium text-right">{active?.valueLabel}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.globalPlayerId} className="border-b border-border/50 last:border-0">
                  <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{row.rank}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <Link
                      href={globalCricketPlayerPath(row.globalPlayerId)}
                      className="text-foreground hover:text-primary"
                    >
                      {row.playerName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-primary">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </CricketPublicShell>
  );
}
