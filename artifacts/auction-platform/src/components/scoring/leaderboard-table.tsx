import type { ScoringLeaderboardRow } from "@/lib/scoring-api";
import { Link } from "wouter";
import { cricketFanPlayerPath, cricketFanTeamPath } from "@/lib/tournament-navigation";
import {
  EmptyState,
  cricketTableHeadRowClass,
  cricketTableWrapClass,
} from "@/components/scoring/cricket-page-chrome";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type LeaderboardTableProps = {
  rows: ScoringLeaderboardRow[];
  valueLabel?: string;
  tournamentId?: number;
};

export function LeaderboardTable({ rows, valueLabel = "Value", tournamentId }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-8 text-center text-[hsl(var(--muted-foreground))]">
        <Trophy className="mx-auto h-8 w-8 text-[hsl(var(--muted))]" />
        <p className="mt-3 font-semibold text-[hsl(var(--foreground))]">No statistics recorded yet</p>
        <p className="text-sm">Leaderboard statistics will appear as balls and match results are recorded.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/50] text-left text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
            <th className="px-3.5 py-2.5 font-bold w-12 text-center">Rank</th>
            <th className="px-3.5 py-2.5 font-bold">Player</th>
            <th className="px-3.5 py-2.5 font-bold">Team</th>
            <th className="px-3.5 py-2.5 font-bold text-right">{valueLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[hsl(var(--border))]">
          {rows.map((row) => {
            const isFirst = row.rank === 1;
            const isSecond = row.rank === 2;
            const isThird = row.rank === 3;

            return (
              <tr
                key={`${row.playerId}-${row.rank}`}
                className={cn(
                  "transition-colors hover:bg-[hsl(var(--muted))/50]",
                  isFirst && "bg-[hsl(var(--primary))/10]",
                )}
              >
                <td className="px-3.5 py-3 tabular-nums text-center">
                  {isFirst ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-black text-xs shadow-sm">
                      1
                    </span>
                  ) : isSecond ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--muted-foreground))] text-[hsl(var(--background))] font-black text-xs">
                      2
                    </span>
                  ) : isThird ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[hsl(var(--muted-foreground))/60] text-[hsl(var(--background))] font-bold text-xs">
                      3
                    </span>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))] font-medium text-xs">
                      {row.rank}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-3 font-semibold text-[hsl(var(--foreground))]">
                  {tournamentId ? (
                    <Link
                      href={cricketFanPlayerPath(tournamentId, row.playerId)}
                      className="hover:text-[hsl(var(--primary))] transition-colors inline-flex items-center gap-1.5"
                    >
                      {row.playerName}
                    </Link>
                  ) : (
                    row.playerName
                  )}
                </td>
                <td className="px-3.5 py-3 text-[hsl(var(--muted-foreground))]">
                  {tournamentId ? (
                    <Link
                      href={cricketFanTeamPath(tournamentId, row.teamId)}
                      className="hover:text-[hsl(var(--primary))] transition-colors font-medium"
                    >
                      {row.shortCode || "Team"}
                    </Link>
                  ) : (
                    row.shortCode || "Team"
                  )}
                </td>
                <td className="px-3.5 py-3 text-right tabular-nums font-bold text-[hsl(var(--primary))] font-display text-base">
                  {row.value}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
