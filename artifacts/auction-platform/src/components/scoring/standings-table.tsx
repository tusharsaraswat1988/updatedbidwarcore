import type { ScoringStandingRow } from "@/lib/scoring-api";
import { formatNetRunRate, formatPointsPercentage } from "@workspace/scoring-core/cricket";
import { cn } from "@/lib/utils";

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
      <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-6">
        No completed matches yet — points table will appear after the first result.
      </p>
    );
  }

  return (
    <>
      <ul className="md:hidden space-y-2">
        {rows.map((row, idx) => {
          const isQualified =
            typeof row.qualified === "boolean"
              ? row.qualified
              : highlightTop > 0 && idx < highlightTop;
          return (
            <li
              key={`card-${row.drawId ?? "legacy"}-${row.teamId}`}
              className={cn(
                "rounded-xl border p-3.5 shadow-sm",
                isQualified
                  ? "border-[hsl(var(--primary))/40] bg-[hsl(var(--primary))/10]"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--card))]"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))] w-5 shrink-0">{idx + 1}</span>
                {row.color ? (
                  <span className="w-2 h-5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                ) : null}
                <span className="font-medium truncate text-[hsl(var(--foreground))]">{row.teamName || row.shortCode}</span>
                {isQualified ? (
                  <span className="text-[10px] font-extrabold uppercase px-1 rounded bg-[hsl(var(--primary))/20] text-[hsl(var(--primary))] border border-[hsl(var(--primary))/30] shrink-0">
                    Q
                  </span>
                ) : null}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                <div><dt className="text-[hsl(var(--muted-foreground))]">P</dt><dd className="tabular-nums font-medium text-[hsl(var(--foreground))]">{row.played}</dd></div>
                <div><dt className="text-[hsl(var(--muted-foreground))]">W</dt><dd className="tabular-nums font-medium text-[hsl(var(--foreground))]">{row.won}</dd></div>
                <div><dt className="text-[hsl(var(--muted-foreground))]">Pts</dt><dd className="tabular-nums font-semibold text-[hsl(var(--primary))]">{row.points}</dd></div>
                <div><dt className="text-[hsl(var(--muted-foreground))]">Pts %</dt><dd className="tabular-nums text-[hsl(var(--foreground))]">{formatPointsPercentage(row.pointsPercentage)}</dd></div>
                <div className="col-span-2"><dt className="text-[hsl(var(--muted-foreground))]">NRR</dt><dd className="tabular-nums text-[hsl(var(--foreground))]" title={nrrBreakdownTooltip(row)}>{formatNetRunRate(row.netRunRate)}</dd></div>
              </dl>
            </li>
          );
        })}
      </ul>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))/50] text-left text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              <th className="px-3 py-2.5 font-semibold">#</th>
              <th className="px-3 py-2.5 font-semibold">Team</th>
              <th className="px-3 py-2.5 font-semibold text-center">P</th>
              <th className="px-3 py-2.5 font-semibold text-center">W</th>
              {!compact ? <th className="px-3 py-2.5 font-semibold text-center">L</th> : null}
              {!compact ? <th className="px-3 py-2.5 font-semibold text-center">T</th> : null}
              {!compact ? <th className="px-3 py-2.5 font-semibold text-center">NR</th> : null}
              <th className="px-3 py-2.5 font-semibold text-center">Pts</th>
              <th className="px-3 py-2.5 font-semibold text-right" title="Points percentage">Pts %</th>
              <th className="px-3 py-2.5 font-semibold text-right" title="Net Run Rate">NRR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]">
            {rows.map((row, idx) => {
              const isQualified =
                typeof row.qualified === "boolean"
                  ? row.qualified
                  : highlightTop > 0 && idx < highlightTop;
              return (
                <tr
                  key={`${row.drawId ?? "legacy"}-${row.teamId}`}
                  className={cn(
                    "transition-colors",
                    isQualified
                      ? "bg-[hsl(var(--primary))/10] hover:bg-[hsl(var(--primary))/15]"
                      : "hover:bg-[hsl(var(--muted))/50]"
                  )}
                >
                  <td className="px-3 py-2.5 text-[hsl(var(--muted-foreground))]">
                    <span className="inline-flex items-center gap-1.5">
                      {idx + 1}
                      {isQualified ? (
                        <span className="text-[10px] font-extrabold uppercase px-1 py-0.2 rounded bg-[hsl(var(--primary))/20] text-[hsl(var(--primary))] border border-[hsl(var(--primary))/30]" title="Top qualifier spot">
                          Q
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[hsl(var(--foreground))]">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      {row.color ? (
                        <span className="w-2 h-5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                      ) : null}
                      <span className="truncate">{row.teamName || row.shortCode}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-[hsl(var(--foreground))]">{row.played}</td>
                  <td className="px-3 py-2.5 text-center tabular-nums text-[hsl(var(--foreground))]">{row.won}</td>
                  {!compact ? <td className="px-3 py-2.5 text-center tabular-nums text-[hsl(var(--foreground))]">{row.lost}</td> : null}
                  {!compact ? <td className="px-3 py-2.5 text-center tabular-nums text-[hsl(var(--foreground))]">{row.tied}</td> : null}
                  {!compact ? <td className="px-3 py-2.5 text-center tabular-nums text-[hsl(var(--foreground))]">{row.noResult}</td> : null}
                  <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-[hsl(var(--primary))]">
                    {row.points}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium text-[hsl(var(--foreground))]">
                    {formatPointsPercentage(row.pointsPercentage)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[hsl(var(--muted-foreground))]" title={nrrBreakdownTooltip(row)}>
                    {formatNetRunRate(row.netRunRate)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
