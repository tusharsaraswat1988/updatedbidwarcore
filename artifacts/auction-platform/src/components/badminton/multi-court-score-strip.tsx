/**
 * Equal multi-court score strip — Approach A.
 * Shows up to 3 LIVE matches as equal rows for one OBS / Venue feed.
 */

import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  formatTeamPlayerLine,
  identityFromSideInfo,
} from "@/lib/team-player-identity";
import { matchCourtLabel, type BroadcastConsoleMatch } from "@/lib/badminton-broadcast-console";
import { MAX_MULTI_COURT_ROWS } from "@/lib/badminton-broadcast-director";
import { cn } from "@/lib/utils";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
} from "@/lib/bidwar-broadcast-colors";

export type MultiCourtRow = {
  matchId: number;
  courtLabel: string;
  state: BadmintonMatchState;
};

export function multiCourtRowsFromMatches(
  matches: BroadcastConsoleMatch[],
  max = MAX_MULTI_COURT_ROWS,
): MultiCourtRow[] {
  return matches
    .filter((m) => !!m.state)
    .slice(0, max)
    .map((m) => ({
      matchId: m.id,
      courtLabel: matchCourtLabel(m),
      state: m.state as BadmintonMatchState,
    }));
}

function gameDots(won: number, total: number) {
  const n = Math.max(total, 1);
  return Array.from({ length: n }, (_, i) => (
    <span
      key={i}
      className={cn(
        "inline-block size-2 rounded-full border",
        i < won ? "bg-white border-white" : "border-white/30 bg-transparent",
      )}
    />
  ));
}

function CourtRow({
  row,
  variant,
}: {
  row: MultiCourtRow;
  variant: "overlay" | "venue";
}) {
  const { state, courtLabel } = row;
  const left = formatTeamPlayerLine(
    identityFromSideInfo(state.leftSide, { preferShort: true }),
  );
  const right = formatTeamPlayerLine(
    identityFromSideInfo(state.rightSide, { preferShort: true }),
  );
  const totalGames = state.format?.totalGames ?? 3;
  const dense = variant === "overlay";

  return (
    <div
      className={cn(
        "grid items-center gap-2 md:gap-3 w-full",
        dense
          ? "grid-cols-[minmax(52px,auto)_1fr_auto_auto_auto_1fr] px-3 py-2"
          : "grid-cols-[minmax(72px,auto)_1fr_auto_auto_auto_1fr] px-4 py-3",
      )}
      style={{
        background: "rgba(10,10,12,0.92)",
        border: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
        boxShadow: "0 4px 18px rgba(0,0,0,0.45)",
      }}
    >
      <div
        className={cn(
          "font-['Bebas_Neue'] uppercase tracking-[0.14em] text-center shrink-0",
          dense ? "text-sm" : "text-base",
        )}
        style={{ color: BIDWAR_BROADCAST_YELLOW }}
      >
        {courtLabel}
      </div>

      <div className="min-w-0 text-right">
        <p
          className={cn(
            "font-['Bebas_Neue'] uppercase tracking-wide text-white truncate",
            dense ? "text-base" : "text-xl",
          )}
        >
          {left}
        </p>
        <div className="flex justify-end gap-1 mt-0.5">{gameDots(state.gamesLeft, totalGames)}</div>
      </div>

      <p
        className={cn(
          "font-['Bebas_Neue'] text-white tabular-nums text-center min-w-[2ch]",
          dense ? "text-2xl" : "text-4xl",
        )}
      >
        {state.leftScore}
      </p>

      <span className="text-white/35 font-mono text-[10px] uppercase tracking-widest">vs</span>

      <p
        className={cn(
          "font-['Bebas_Neue'] text-white tabular-nums text-center min-w-[2ch]",
          dense ? "text-2xl" : "text-4xl",
        )}
      >
        {state.rightScore}
      </p>

      <div className="min-w-0 text-left">
        <p
          className={cn(
            "font-['Bebas_Neue'] uppercase tracking-wide text-white truncate",
            dense ? "text-base" : "text-xl",
          )}
        >
          {right}
        </p>
        <div className="flex justify-start gap-1 mt-0.5">{gameDots(state.gamesRight, totalGames)}</div>
      </div>
    </div>
  );
}

export function MultiCourtScoreStrip({
  rows,
  variant = "overlay",
  className,
}: {
  rows: MultiCourtRow[];
  variant?: "overlay" | "venue";
  className?: string;
}) {
  if (rows.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col w-full",
        variant === "overlay" ? "gap-1.5 max-w-[min(1100px,96vw)]" : "gap-3 max-w-[min(1200px,94vw)]",
        className,
      )}
      aria-label="Multi-court live scores"
    >
      {rows.map((row) => (
        <CourtRow key={row.matchId} row={row} variant={variant} />
      ))}
    </div>
  );
}
