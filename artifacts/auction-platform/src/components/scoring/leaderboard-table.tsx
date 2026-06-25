import type { ScoringLeaderboardRow } from "@/lib/scoring-api";
import { Link } from "wouter";
import { cricketPlayerPublicPath, cricketTeamPublicPath } from "@/lib/tournament-navigation";

import {
  cricketTableHeadRowClass,
  cricketTableWrapClass,
} from "@/components/scoring/cricket-page-chrome";

type LeaderboardTableProps = {
  rows: ScoringLeaderboardRow[];
  valueLabel?: string;
  tournamentId?: number;
};

export function LeaderboardTable({ rows, valueLabel = "Value", tournamentId }: LeaderboardTableProps) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No stats yet.</p>;
  }

  return (
    <div className={cricketTableWrapClass}>
      <table className="w-full text-sm">
        <thead>
          <tr className={cricketTableHeadRowClass}>
            <th className="px-3 py-2 font-medium w-10">#</th>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium text-right">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.playerId}-${row.rank}`} className="border-b border-border/50 last:border-0">
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{row.rank}</td>
              <td className="px-3 py-2.5 font-medium text-foreground">
                {tournamentId ? (
                  <Link href={cricketPlayerPublicPath(tournamentId, row.playerId)} className="hover:text-primary">
                    {row.playerName}
                  </Link>
                ) : (
                  row.playerName
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {tournamentId ? (
                  <Link href={cricketTeamPublicPath(tournamentId, row.teamId)} className="hover:text-primary">
                    {row.shortCode}
                  </Link>
                ) : (
                  row.shortCode
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-primary">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
