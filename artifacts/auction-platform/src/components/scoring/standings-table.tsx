import type { ScoringStandingRow } from "@/lib/scoring-api";
import { formatNetRunRate, formatPointsPercentage } from "@workspace/scoring-core/cricket";

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

  const extraCol = compact ? "" : "hidden lg:table-cell";

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
              className={
                isQualified
                  ? "rounded-xl border border-primary/30 bg-primary/5 p-3"
                  : "rounded-xl border border-border p-3"
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs tabular-nums text-muted-foreground w-5 shrink-0">{idx + 1}</span>
                {row.color ? (
                  <span className="w-2 h-5 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
                ) : null}
                <span className="font-medium truncate">{row.teamName || row.shortCode}</span>
                {isQualified ? (
                  <span className="text-[10px] font-extrabold uppercase px-1 rounded bg-primary/20 text-primary border border-primary/30 shrink-0">
                    Q
                  </span>
                ) : null}
              </div>
              <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                <div><dt className="text-muted-foreground">P</dt><dd className="tabular-nums font-medium">{row.played}</dd></div>
                <div><dt className="text-muted-foreground">W</dt><dd className="tabular-nums font-medium">{row.won}</dd></div>
                <div><dt className="text-muted-foreground">Pts</dt><dd className="tabular-nums font-semibold text-primary">{row.points}</dd></div>
                <div><dt className="text-muted-foreground">Pts %</dt><dd className="tabular-nums">{formatPointsPercentage(row.pointsPercentage)}</dd></div>
                <div className="col-span-2"><dt className="text-muted-foreground">NRR</dt><dd className="tabular-nums" title={nrrBreakdownTooltip(row)}>{formatNetRunRate(row.netRunRate)}</dd></div>
              </dl>
            </li>
          );
        })}
      </ul>
    <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 font-semibold">#</th>
            <th className="px-3 py-2.5 font-semibold">Team</th>
            <th className="px-3 py-2.5 font-semibold text-center">P</th>
            <th className="px-3 py-2.5 font-semibold text-center">W</th>
            {!compact ? <th className={`px-3 py-2.5 font-semibold text-center ${extraCol}`}>L</th> : null}
            {!compact ? <th className={`px-3 py-2.5 font-semibold text-center ${extraCol}`}>T</th> : null}
            {!compact ? <th className={`px-3 py-2.5 font-semibold text-center ${extraCol}`}>NR</th> : null}
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
          {rows.map((row, idx) => {
            const isQualified =
              typeof row.qualified === "boolean"
                ? row.qualified
                : highlightTop > 0 && idx < highlightTop;
            return (
            <tr
              key={`${row.drawId ?? "legacy"}-${row.teamId}`}
              className={
                isQualified
                  ? "border-b border-border/60 last:border-0 bg-primary/5"
                  : "border-b border-border/60 last:border-0"
              }
            >
              <td className="px-3 py-2.5 text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  {idx + 1}
                  {isQualified ? (
                    <span className="text-[10px] font-extrabold uppercase px-1 py-0.2 rounded bg-primary/20 text-primary border border-primary/30" title="Top qualifier spot">
                      Q
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2.5 font-medium">
                <span className="inline-flex items-center gap-2 min-w-0">
                  {row.color ? (
                    <span
                      className="w-2 h-5 rounded-sm shrink-0"
                      style={{ backgroundColor: row.color }}
                    />
                  ) : null}
                  <span className="truncate">{row.teamName || row.shortCode}</span>
                  {row.shortCode && row.teamName && row.shortCode !== row.teamName ? (
                    <span className="text-xs font-normal text-muted-foreground shrink-0">
                      {row.shortCode}
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="px-3 py-2.5 text-center tabular-nums">{row.played}</td>
              <td className="px-3 py-2.5 text-center tabular-nums">{row.won}</td>
              {!compact ? <td className={`px-3 py-2.5 text-center tabular-nums ${extraCol}`}>{row.lost}</td> : null}
              {!compact ? <td className={`px-3 py-2.5 text-center tabular-nums ${extraCol}`}>{row.tied}</td> : null}
              {!compact ? <td className={`px-3 py-2.5 text-center tabular-nums ${extraCol}`}>{row.noResult}</td> : null}
              <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-primary">
                {row.points}
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap font-medium">
                {formatPointsPercentage(row.pointsPercentage)}
              </td>
              <td
                className="px-3 py-2.5 text-right tabular-nums text-muted-foreground"
                title={nrrBreakdownTooltip(row)}
              >
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
