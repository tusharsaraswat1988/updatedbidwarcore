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
      <EmptyState
        icon={Trophy}
        title="No statistics recorded yet"
        desc="Leaderboard statistics will appear as balls and match results are recorded."
      />
    );
  }

  return (
    <div className={cricketTableWrapClass}>
      <table className="w-full text-sm">
        <thead>
          <tr className={cn(cricketTableHeadRowClass, "bg-muted/40 text-xs uppercase tracking-wider")}>
            <th className="px-3.5 py-2.5 font-bold w-12 text-center">Rank</th>
            <th className="px-3.5 py-2.5 font-bold">Player</th>
            <th className="px-3.5 py-2.5 font-bold">Team</th>
            <th className="px-3.5 py-2.5 font-bold text-right">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isFirst = row.rank === 1;
            const isSecond = row.rank === 2;
            const isThird = row.rank === 3;

            return (
              <tr
                key={`${row.playerId}-${row.rank}`}
                className={cn(
                  "border-b border-border/50 last:border-0 transition-colors hover:bg-muted/20",
                  isFirst && "bg-amber-500/5",
                )}
              >
                <td className="px-3.5 py-3 tabular-nums text-center">
                  {isFirst ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-xs">
                      1
                    </span>
                  ) : isSecond ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300 text-slate-950 font-black text-xs">
                      2
                    </span>
                  ) : isThird ? (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/60 text-amber-100 font-bold text-xs">
                      3
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-medium text-xs">
                      {row.rank}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-3 font-semibold text-foreground">
                  {tournamentId ? (
                    <Link
                      href={cricketFanPlayerPath(tournamentId, row.playerId)}
                      className="hover:text-primary transition-colors inline-flex items-center gap-1.5"
                    >
                      {row.playerName}
                    </Link>
                  ) : (
                    row.playerName
                  )}
                </td>
                <td className="px-3.5 py-3 text-muted-foreground">
                  {tournamentId ? (
                    <Link
                      href={cricketFanTeamPath(tournamentId, row.teamId)}
                      className="hover:text-primary transition-colors font-medium"
                    >
                      {row.shortCode || "Team"}
                    </Link>
                  ) : (
                    row.shortCode || "Team"
                  )}
                </td>
                <td className="px-3.5 py-3 text-right tabular-nums font-bold text-primary font-display text-base">
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
