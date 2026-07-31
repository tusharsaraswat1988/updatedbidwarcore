/**
 * Multi-court live scores for Venue LED / OBS.
 * Venue: stacked boards (one court above the other) using the same full
 * scoreboard language as a single match (photos, serve, games, centre score).
 * OBS: two lower-third boxes — Court A bottom-left, Court B bottom-right.
 */

import type { BadmintonMatchState } from "@workspace/badminton-core";
import {
  currentServerLabel,
  isPairMatchKind,
} from "@workspace/badminton-core";
import { identityFromSideInfo } from "@/lib/team-player-identity";
import { matchCourtLabel, type BroadcastConsoleMatch } from "@/lib/badminton-broadcast-console";
import { MAX_MULTI_COURT_ROWS } from "@/lib/badminton-broadcast-director";
import { cn } from "@/lib/utils";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
  BIDWAR_SCOREBOARD_INSET,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";
import { BroadcastMatchBoard } from "@/components/badminton/broadcast-display";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";

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

/** Subtle board tints so stacked courts read as separate surfaces. */
const VENUE_BOARD_TONES = [
  {
    shell: "rgba(8, 12, 20, 0.97)",
    edge: "rgba(255, 215, 0, 0.28)",
  },
  {
    shell: "rgba(18, 12, 8, 0.97)",
    edge: "rgba(255, 190, 90, 0.32)",
  },
] as const;

/**
 * Full-language court board — same photos / serve / games / centre score
 * composition as a single live match, scaled for a stacked half-height slot.
 */
function VenueCourtBoard({
  row,
  toneIndex,
}: {
  row: MultiCourtRow;
  toneIndex: number;
}) {
  const tone = VENUE_BOARD_TONES[toneIndex % VENUE_BOARD_TONES.length]!;

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg"
      style={{
        background: tone.shell,
        border: `1px solid ${tone.edge}`,
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.03), 0 8px 28px rgba(0,0,0,0.45)",
      }}
    >
      <BroadcastMatchBoard
        state={row.state}
        density="compact"
        courtLabel={row.courtLabel}
        showDirectorBanner={false}
        className="min-h-0 flex-1"
      />
    </div>
  );
}

function ObsGameDots({ won, total }: { won: number; total: number }) {
  const n = Math.max(total, 1);
  return (
    <div className="flex items-center gap-1.5" aria-hidden>
      {Array.from({ length: n }, (_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block size-2.5 rounded-full border-2",
            i < won ? "border-transparent" : "bg-transparent border-white/35",
          )}
          style={
            i < won
              ? {
                  backgroundColor: BIDWAR_BROADCAST_YELLOW,
                  borderColor: BIDWAR_BROADCAST_YELLOW,
                }
              : undefined
          }
        />
      ))}
    </div>
  );
}

/**
 * OBS lower-third box — mirrors single-court compact language:
 * team (muted) above players (bold), large score tiles, serve cue.
 */
function ObsCourtBox({ row }: { row: MultiCourtRow }) {
  const { state, courtLabel } = row;
  const leftIdentity = identityFromSideInfo(state.leftSide);
  const rightIdentity = identityFromSideInfo(state.rightSide);
  const totalGames = state.format?.totalGames ?? 3;
  const isTimeout = !!state.activeTimeout;
  const isDoubles = isPairMatchKind(state.matchKind);
  const serverLabel = isDoubles ? currentServerLabel(state) : null;
  const leftServing =
    (!isDoubles && state.servingSide === "left") ||
    (isDoubles && state.doublesServe?.servingSide === "left");
  const rightServing =
    (!isDoubles && state.servingSide === "right") ||
    (isDoubles && state.doublesServe?.servingSide === "right");

  return (
    <div
      className="pointer-events-none w-[min(540px,46vw)] overflow-hidden rounded-xl"
      style={{
        background: BIDWAR_SCOREBOARD_SHELL,
        border: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
        boxShadow: "0 10px 36px rgba(0,0,0,0.6)",
        fontFamily: "'Barlow Condensed', 'Inter', system-ui, sans-serif",
      }}
      aria-label={`${courtLabel} overlay score`}
    >
      <div
        className="flex items-center justify-between gap-3 px-3.5 py-2 border-b border-white/10"
        style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      >
        <span
          className="font-['Bebas_Neue'] font-bold text-base uppercase tracking-[0.16em] shrink-0"
          style={{ color: BIDWAR_BROADCAST_YELLOW }}
        >
          {courtLabel}
        </span>
        <span
          className={cn(
            "bw-label text-[10px] tracking-[0.18em] shrink-0",
            isTimeout ? "text-amber-200" : "text-red-200",
          )}
        >
          <span
            className={cn(
              "inline-block size-1.5 rounded-full mr-1.5 align-middle",
              isTimeout ? "bg-amber-400 animate-pulse" : "bg-red-500 animate-pulse",
            )}
          />
          {isTimeout ? "TIMEOUT" : "LIVE"}
        </span>
        <span className="font-mono font-bold text-[11px] uppercase tracking-[0.16em] text-white/50 shrink-0">
          Game {state.currentGame || 1}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch min-h-[112px]">
        <div
          className={cn(
            "relative flex flex-col justify-center gap-1.5 px-3.5 py-3 min-w-0",
            leftServing && "ring-1 ring-inset ring-[#ffd700]/45",
          )}
          style={{ backgroundColor: BIDWAR_SCOREBOARD_PANEL }}
        >
          {leftServing ? (
            <div
              className="absolute inset-y-2.5 left-0 w-1 rounded-r-full"
              style={{ backgroundColor: BIDWAR_BROADCAST_YELLOW }}
              aria-hidden
            />
          ) : null}
          <TeamPlayerCard
            identity={leftIdentity}
            size="sm"
            tone="led"
            layout="stack"
            align="start"
            showBadge={Boolean(leftIdentity.teamName?.trim())}
            className="w-full min-w-0"
            teamClassName="!text-sm sm:!text-base uppercase tracking-[0.1em] text-white/70 font-bold"
            playerClassName="text-white font-black text-[15px] sm:text-lg leading-snug"
          />
          <ObsGameDots won={state.gamesLeft} total={totalGames} />
        </div>

        <div
          className="flex flex-col items-center justify-center gap-1.5 px-3 py-2.5 border-x border-white/10 min-w-[5.5rem]"
          style={{ backgroundColor: BIDWAR_SCOREBOARD_INSET }}
        >
          <div className="flex items-center gap-2">
            <span className="font-['Bebas_Neue'] font-black text-4xl sm:text-5xl tabular-nums text-white leading-none min-w-[1.15ch] text-center">
              {state.leftScore}
            </span>
            <span className="text-white/30 text-xl font-black leading-none">:</span>
            <span className="font-['Bebas_Neue'] font-black text-4xl sm:text-5xl tabular-nums text-white leading-none min-w-[1.15ch] text-center">
              {state.rightScore}
            </span>
          </div>
          <span
            className="text-[10px] font-black uppercase tracking-[0.2em]"
            style={{ color: BIDWAR_BROADCAST_YELLOW }}
          >
            {state.gamesLeft} – {state.gamesRight}
          </span>
        </div>

        <div
          className={cn(
            "relative flex flex-col justify-center items-end gap-1.5 px-3.5 py-3 min-w-0 text-right",
            rightServing && "ring-1 ring-inset ring-[#ffd700]/45",
          )}
          style={{ backgroundColor: BIDWAR_SCOREBOARD_PANEL }}
        >
          {rightServing ? (
            <div
              className="absolute inset-y-2.5 right-0 w-1 rounded-l-full"
              style={{ backgroundColor: BIDWAR_BROADCAST_YELLOW }}
              aria-hidden
            />
          ) : null}
          <TeamPlayerCard
            identity={rightIdentity}
            size="sm"
            tone="led"
            layout="stack"
            align="end"
            showBadge={Boolean(rightIdentity.teamName?.trim())}
            className="w-full min-w-0"
            teamClassName="!text-sm sm:!text-base uppercase tracking-[0.1em] text-white/70 font-bold"
            playerClassName="text-white font-black text-[15px] sm:text-lg leading-snug"
          />
          <ObsGameDots won={state.gamesRight} total={totalGames} />
        </div>
      </div>

      {isDoubles && serverLabel ? (
        <div
          className="flex items-center justify-center gap-2 px-3 py-1.5 border-t border-white/10"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        >
          <span
            className="badminton-serve-pip badminton-serve-pip--active"
            aria-hidden
          />
          <span className="bw-label text-[10px] tracking-[0.16em] text-white/45">
            Serving
          </span>
          <span
            className="text-xs font-bold uppercase tracking-wide"
            style={{ color: BIDWAR_BROADCAST_YELLOW }}
          >
            {serverLabel}
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function MultiCourtScoreStrip({
  rows,
  variant = "overlay",
  layout = "stack",
  className,
}: {
  rows: MultiCourtRow[];
  variant?: "overlay" | "venue";
  /**
   * Venue: `stack` = one court above the other (default).
   * Overlay ignores this — always bottom-left / bottom-right boxes.
   */
  layout?: "stack" | "split";
  className?: string;
}) {
  if (rows.length === 0) return null;

  if (variant === "venue") {
    const boards = rows.slice(0, 2);
    return (
      <div
        className={cn(
          "grid w-full h-full min-h-0 gap-1.5 md:gap-2",
          boards.length === 1 ? "grid-rows-1" : "grid-rows-2",
          className,
        )}
        aria-label="Stacked court live scores"
      >
        {boards.map((row, i) => (
          <VenueCourtBoard key={row.matchId} row={row} toneIndex={i} />
        ))}
      </div>
    );
  }

  // OBS: two boxes at bottom corners (or a single centered box if only one live).
  const left = rows[0];
  const right = rows[1];

  if (!right) {
    return (
      <div
        className={cn(
          "absolute z-20 left-1/2 -translate-x-1/2 pointer-events-none",
          className,
        )}
        aria-label="Multi-court overlay scores"
      >
        {left ? <ObsCourtBox row={left} /> : null}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 pointer-events-none",
        className,
      )}
      aria-label="Multi-court overlay scores"
    >
      <div className="flex items-end justify-between gap-4 px-[2vw] pb-[1.25vh]">
        <ObsCourtBox row={left} />
        <ObsCourtBox row={right} />
      </div>
    </div>
  );
}
