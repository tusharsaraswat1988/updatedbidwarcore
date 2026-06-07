import type { ScoringStandingRow } from "@/lib/scoring-api";

function nrrText(nrr: number): string {
  if (nrr > 0) return `+${nrr.toFixed(3)}`;
  return nrr.toFixed(3);
}

export function StandingsTable({
  rows,
  compact = false,
}: {
  rows: ScoringStandingRow[];
  compact?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No completed matches yet — points table will appear after the first result.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-semibold">#</th>
            <th className="px-3 py-2.5 font-semibold">Team</th>
            <th className="px-3 py-2.5 font-semibold text-center">P</th>
            <th className="px-3 py-2.5 font-semibold text-center">W</th>
            {!compact ? <th className="px-3 py-2.5 font-semibold text-center">L</th> : null}
            {!compact ? <th className="px-3 py-2.5 font-semibold text-center">T</th> : null}
            {!compact ? <th className="px-3 py-2.5 font-semibold text-center">NR</th> : null}
            <th className="px-3 py-2.5 font-semibold text-center">Pts</th>
            <th className="px-3 py-2.5 font-semibold text-right">NRR</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.teamId} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
              <td className="px-3 py-2.5 font-medium">
                <span className="inline-flex items-center gap-2">
                  {row.color ? (
                    <span
                      className="w-2 h-5 rounded-sm shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                  ) : null}
                  {row.shortCode || row.teamName}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums">{row.played}</td>
              <td className="px-3 py-2.5 text-center tabular-nums">{row.won}</td>
              {!compact ? <td className="px-3 py-2.5 text-center tabular-nums">{row.lost}</td> : null}
              {!compact ? <td className="px-3 py-2.5 text-center tabular-nums">{row.tied}</td> : null}
              {!compact ? <td className="px-3 py-2.5 text-center tabular-nums">{row.noResult}</td> : null}
              <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-primary">
                {row.points}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                {nrrText(row.netRunRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
