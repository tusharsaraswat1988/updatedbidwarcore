import type { ScoringStandingRow } from "@/lib/scoring-api";
import { formatPointsPercentage } from "@workspace/scoring-core/cricket";

function nrrText(nrr: number): string {
  if (nrr > 0) return `+${nrr.toFixed(3)}`;
  return nrr.toFixed(3);
}

function formatDecimalOvers(decimalOvers?: number): string {
  if (decimalOvers == null || decimalOvers === 0) return "0.0";
  const totalBalls = Math.round(decimalOvers * 6);
  const overs = Math.floor(totalBalls / 6);
  const balls = totalBalls % 6;
  return `${overs}.${balls}`;
}

function nrrBreakdownTooltip(row: ScoringStandingRow): string | undefined {
  if (!row.extrasJson) return undefined;
  const scored = row.extrasJson.runsScored ?? 0;
  const faced = formatDecimalOvers(row.extrasJson.oversFaced);
  const conceded = row.extrasJson.runsConceded ?? 0;
  const bowled = formatDecimalOvers(row.extrasJson.oversBowled);
  return `For: ${scored}/${faced} · Against: ${conceded}/${bowled}`;
}

export function StandingsTable({
  rows,
  compact = false,
  highlightTop = 0,
}: {
  rows: ScoringStandingRow[];
  compact?: boolean;
  /** Highlight the first N rows as a qualification band. */
  highlightTop?: number;
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
            <th className="px-3 py-2.5 font-semibold text-right" title="Points percentage">
              Pts %
            </th>
            <th className="px-3 py-2.5 font-semibold text-right" title="Net Run Rate (ICC / CricHeroes standard)">
              NRR
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={row.teamId}
              className={
                highlightTop > 0 && idx < highlightTop
                  ? "border-b border-border/60 last:border-0 bg-primary/5"
                  : "border-b border-border/60 last:border-0"
              }
            >
              <td className="px-3 py-2.5 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  {idx + 1}
                  {highlightTop > 0 && idx < highlightTop ? (
                    <span className="text-[10px] font-extrabold uppercase px-1 py-0.2 rounded bg-primary/20 text-primary border border-primary/30" title="Top qualifier spot">
                      Q
                    </span>
                  ) : null}
                </span>
              </td>
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
              <td className="px-3 py-2.5 text-right tabular-nums">
                {formatPointsPercentage(row.pointsPercentage)}
              </td>
              <td
                className="px-3 py-2.5 text-right tabular-nums text-muted-foreground"
                title={nrrBreakdownTooltip(row)}
              >
                {nrrText(row.netRunRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
