import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { getGlobalCricketLeaderboard } from "@/lib/scoring-api";
import { globalCricketPlayerPath } from "@/lib/tournament-navigation";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardCategory } from "@workspace/scoring-core";

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
    <div className="min-h-screen bg-[#0a0f1a] text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <p className="text-[10px] uppercase tracking-[0.2em] text-amber-400/80 mb-1">BidWar Cricket</p>
        <h1 className="text-3xl font-bold text-white mb-2">Global leaderboards</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Career stats across all BidWar tournaments — updated when matches complete.
        </p>

        <div className="flex gap-2 flex-wrap mb-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                tab === t.key
                  ? "bg-amber-500/20 border-amber-500/50 text-amber-200"
                  : "border-white/10 text-muted-foreground hover:border-white/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <Skeleton className="h-64 w-full bg-white/10" />
        ) : error ? (
          <p className="text-muted-foreground">Leaderboards unavailable.</p>
        ) : !data?.length ? (
          <p className="text-muted-foreground">No career stats yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium w-10">#</th>
                  <th className="px-3 py-2 font-medium">Player</th>
                  <th className="px-3 py-2 font-medium text-right">{active?.valueLabel}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.globalPlayerId} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{row.rank}</td>
                    <td className="px-3 py-2.5 font-medium">
                      <Link
                        href={globalCricketPlayerPath(row.globalPlayerId)}
                        className="text-white/95 hover:text-amber-300"
                      >
                        {row.playerName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-300/90">
                      {row.value}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
