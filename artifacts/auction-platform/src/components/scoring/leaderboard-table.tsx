import type { ScoringLeaderboardRow } from "@/lib/scoring-api";
import { Link } from "wouter";
import { cricketPlayerPublicPath, cricketTeamPublicPath } from "@/lib/tournament-navigation";

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
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-muted-foreground">
            <th className="px-3 py-2 font-medium w-10">#</th>
            <th className="px-3 py-2 font-medium">Player</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium text-right">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.playerId}-${row.rank}`} className="border-b border-white/5 last:border-0">
              <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{row.rank}</td>
              <td className="px-3 py-2.5 font-medium text-white/95">
                {tournamentId ? (
                  <Link href={cricketPlayerPublicPath(tournamentId, row.playerId)} className="hover:text-amber-300">
                    {row.playerName}
                  </Link>
                ) : (
                  row.playerName
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {tournamentId ? (
                  <Link href={cricketTeamPublicPath(tournamentId, row.teamId)} className="hover:text-amber-300">
                    {row.shortCode}
                  </Link>
                ) : (
                  row.shortCode
                )}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-300/90">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
