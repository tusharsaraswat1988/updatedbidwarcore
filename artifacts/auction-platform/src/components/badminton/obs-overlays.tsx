/**
 * OBS-Compatible Badminton Score Overlays
 *
 * All overlays:
 * - Transparent background (chroma-key ready)
 * - Real-time SSE updates (no OBS refresh needed)
 * - Multiple variants selectable via URL ?type=
 *
 * Variants:
 * - compact    — bottom-bar style score strip
 * - full       — full match scorecard
 * - intro      — player introduction card
 * - winner     — match winner celebration
 * - sponsor    — sponsor display loop
 * - results    — recent completed match winners + point difference
 */

import type { BadmintonMatchState, BadmintonSide } from "@workspace/badminton-core";
import { useEffect, useRef, useState } from "react";
import {
  isPairMatchKind,
  currentReceiverLabel,
  currentServerLabel,
  detectGamePointSide,
  detectMatchPointSide,
} from "@workspace/badminton-core";
import { SidePlayerPhotos } from "@/components/badminton/side-players";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";
import { DirectorStatusBanner } from "@/components/badminton/director-status-banner";
import { cn } from "@/lib/utils";
import { SponsorCarousel } from "@/components/display/sponsor-carousel";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { identityFromSideInfo, formatTeamPlayerLine, type TeamPlayerIdentity } from "@/lib/team-player-identity";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
  BIDWAR_BROADCAST_YELLOW_MUTED,
  BIDWAR_BROADCAST_YELLOW_SOFT,
} from "@/lib/bidwar-broadcast-colors";
import type { BroadcastConsoleMatch } from "@/lib/badminton-broadcast-console";
import {
  formatPointDifference,
  gameScoreLines,
  gamesWonLine,
  listRecentCompleted,
  loserLabel,
  winnerLabel,
  winnerPointDifference,
  type ResultsMatch,
} from "@/lib/badminton-results";

type OverlayType = "compact" | "full" | "intro" | "winner" | "sponsor" | "results";
type PointFlashSide = BadmintonSide | null;

const OBS_RESULTS_ROTATE_MS = 4_500;

function useServeSideFlash(servingSide: "left" | "right") {
  const prevRef = useRef(servingSide);
  const [flashSide, setFlashSide] = useState<"left" | "right" | null>(null);

  useEffect(() => {
    if (prevRef.current === servingSide) return;
    prevRef.current = servingSide;
    setFlashSide(servingSide);
    const timer = window.setTimeout(() => setFlashSide(null), 650);
    return () => window.clearTimeout(timer);
  }, [servingSide]);

  return flashSide;
}

/** Brief score-digit pop when a side wins a rally (venue parity). */
function usePointScoreFlash(leftScore: number, rightScore: number): PointFlashSide {
  const prevRef = useRef({ left: leftScore, right: rightScore });
  const [flashSide, setFlashSide] = useState<PointFlashSide>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (leftScore > prev.left) {
      setFlashSide("left");
      const timer = window.setTimeout(() => setFlashSide(null), 800);
      prevRef.current = { left: leftScore, right: rightScore };
      return () => window.clearTimeout(timer);
    }
    if (rightScore > prev.right) {
      setFlashSide("right");
      const timer = window.setTimeout(() => setFlashSide(null), 800);
      prevRef.current = { left: leftScore, right: rightScore };
      return () => window.clearTimeout(timer);
    }
    prevRef.current = { left: leftScore, right: rightScore };
  }, [leftScore, rightScore]);

  return flashSide;
}

function overlayUrgency(state: BadmintonMatchState): {
  kind: "game" | "match" | "deuce" | null;
  side: BadmintonSide | null;
} {
  const busy =
    state.matchStatus !== "live" || !!state.activeTimeout || !!state.inInterval;
  if (busy) return { kind: null, side: null };

  const matchSide = detectMatchPointSide(state);
  if (matchSide) return { kind: "match", side: matchSide };
  const gameSide = detectGamePointSide(state);
  if (gameSide) return { kind: "game", side: gameSide };

  const deuce =
    state.leftScore >= state.format.deuceAt &&
    state.rightScore >= state.format.deuceAt;
  if (deuce) return { kind: "deuce", side: null };
  return { kind: null, side: null };
}

function ObsUrgencyBanner({ state }: { state: BadmintonMatchState }) {
  const { kind } = overlayUrgency(state);
  if (!kind) return null;

  return (
    <div
      className={cn(
        "badminton-urgency-banner mx-auto",
        kind === "match" && "badminton-urgency-banner--match",
        kind === "game" && "badminton-urgency-banner--game",
        kind === "deuce" && "badminton-urgency-banner--deuce",
      )}
    >
      <span className="bw-heading">
        {kind === "match" ? "MATCH POINT" : kind === "game" ? "GAME POINT" : "DEUCE"}
      </span>
    </div>
  );
}

function OverlayScoreDigit({
  score,
  celebrate,
  className,
}: {
  score: number;
  celebrate?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "badminton-score-digit font-black leading-none tabular-nums",
        celebrate && "badminton-score-digit--celebrate",
        className,
      )}
    >
      {score}
    </span>
  );
}

function overlayServeSideShellClass(isServing: boolean, isFlash: boolean) {
  return cn(
    "relative transition-[background-color,box-shadow,border-color] duration-500 ease-out",
    isServing && !isFlash && "badminton-serve-side--active border-2 border-[#ffd700]/45",
    isFlash && "badminton-serve-side--flash border-2 border-[#ffd700]/70",
    !isServing && "border-2 border-transparent",
  );
}

/** OBS-safe anchor positions per overlay variant. */
export function overlayPlacementClass(
  type: OverlayType,
  withBottomTicker = false,
  slimTicker = false,
): string {
  const tickerBottom = slimTicker ? "bottom-[8vh]" : "bottom-[11vh]";
  const sponsorBottom = slimTicker ? "bottom-[9vh]" : "bottom-[12vh]";
  /** Full lower-third — wide enough for broadcast-readable names + scores. */
  const compactBottom = withBottomTicker
    ? `${tickerBottom} left-1/2 -translate-x-1/2 w-[min(1280px,94vw)]`
    : "bottom-[5vh] left-1/2 -translate-x-1/2 w-[min(1280px,94vw)]";
  switch (type) {
    case "full":
      return "bottom-0 left-0 right-0 w-full";
    case "compact":
      return compactBottom;
    case "intro":
    case "winner":
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    case "results":
      return withBottomTicker
        ? `${tickerBottom} left-1/2 -translate-x-1/2 w-[min(920px,92vw)]`
        : "bottom-[5vh] left-1/2 -translate-x-1/2 w-[min(920px,92vw)]";
    case "sponsor":
      return withBottomTicker
        ? `${sponsorBottom} left-1/2 -translate-x-1/2`
        : "bottom-[6vh] left-1/2 -translate-x-1/2";
    default:
      return compactBottom;
  }
}

interface OverlayProps {
  type: OverlayType;
  state: BadmintonMatchState;
  tournamentName?: string;
  tournamentLogoUrl?: string;
  courtNumber?: string;
  matchLabel?: string;
  roundName?: string;
  sponsorLogos?: SponsorLogo[];
  showPlatformCredit?: boolean;
  /** OBS CEF: longer sponsor hold */
  sponsorRotateMs?: number;
}

export function BadmintonOverlay({
  type,
  state,
  tournamentName,
  tournamentLogoUrl,
  courtNumber,
  matchLabel,
  roundName,
  sponsorLogos = [],
  showPlatformCredit = false,
  sponsorRotateMs,
}: OverlayProps) {
  switch (type) {
    case "compact":
      return (
        <CompactOverlay
          state={state}
          courtNumber={courtNumber}
          matchLabel={matchLabel}
          showPlatformCredit={showPlatformCredit}
        />
      );
    case "full":
      return (
        <FullOverlay
          state={state}
          courtNumber={courtNumber}
          roundName={roundName}
          matchLabel={matchLabel}
        />
      );
    case "intro":
      return <IntroOverlay state={state} tournamentName={tournamentName} roundName={roundName} />;
    case "winner":
      return state.winnerSide ? (
        <WinnerOverlay
          state={state}
          tournamentName={tournamentName}
        />
      ) : null;
    case "sponsor":
      return (
        <SponsorOverlay
          sponsorLogos={sponsorLogos}
          tournamentName={tournamentName}
          rotateMs={sponsorRotateMs}
        />
      );
    case "results":
      return null;
    default:
      return (
        <CompactOverlay
          state={state}
          courtNumber={courtNumber}
          matchLabel={matchLabel}
        />
      );
  }
}

/** Timeout / interval / game-win cards — translucent, not full opaque veil. */
export function ObsPlayMoments({ state }: { state: BadmintonMatchState }) {
  const [gameWin, setGameWin] = useState<{
    side: BadmintonSide;
    winner: number;
    loser: number;
    gameNumber: number;
  } | null>(null);
  const prevRef = useRef(state);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevRef.current;
    if (
      state.gamesLeft > prev.gamesLeft ||
      state.gamesRight > prev.gamesRight
    ) {
      const completed = [...state.games].reverse().find((g) => g.phase === "completed");
      const side: BadmintonSide =
        state.gamesLeft > prev.gamesLeft ? "left" : "right";
      if (completed) {
        setGameWin({
          side,
          winner: side === "left" ? completed.leftScore : completed.rightScore,
          loser: side === "left" ? completed.rightScore : completed.leftScore,
          gameNumber: completed.gameNumber,
        });
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setGameWin(null), 3200);
      }
    }
    prevRef.current = state;
  }, [state]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  if (state.activeTimeout) {
    const side = state.activeTimeout.side;
    const player = side === "left" ? state.leftSide : state.rightSide;
    return (
      <div className="absolute inset-0 z-[26] flex items-center justify-center pointer-events-none bg-black/40">
        <div
          className={cn(
            "badminton-moment-card border px-10 py-6",
            side === "left"
              ? "border-[#ffc400]/45 bg-[#1a1400]/92"
              : "border-[#ce93d8]/45 bg-[#180523]/92",
          )}
        >
          <p className="bw-label text-amber-300/90 mb-2 tracking-[0.3em]">Timeout</p>
          <p className="bw-heading text-white text-4xl mb-3">TIMEOUT</p>
          <TeamPlayerCard
            identity={identityFromSideInfo(player)}
            size="md"
            tone="led"
            align="center"
            playerClassName="text-white text-2xl font-black"
            teamClassName="text-white/60"
          />
        </div>
      </div>
    );
  }

  if (state.inInterval && !state.activeTimeout) {
    return (
      <div className="absolute inset-0 z-[25] flex items-center justify-center pointer-events-none bg-black/35">
        <div className="badminton-moment-card border border-sky-400/40 bg-[#0a1e33]/92 px-10 py-6">
          <p className="bw-label text-sky-300/90 mb-2 tracking-[0.3em]">Interval</p>
          <p className="bw-heading text-white text-4xl mb-2">INTERVAL</p>
          <p className="text-white/70 text-lg font-semibold">
            Game {state.currentGame} · {state.leftScore} – {state.rightScore}
          </p>
        </div>
      </div>
    );
  }

  if (gameWin && !state.winnerSide) {
    return (
      <div className="absolute inset-0 z-[28] flex items-center justify-center pointer-events-none bg-black/35">
        <div
          className={cn(
            "rounded-2xl px-12 py-6 text-center border shadow-2xl animate-[badmintonMomentIn_0.4s_ease-out_forwards]",
            gameWin.side === "left"
              ? "bg-[#ffc400]/85 border-[#ffc400]/50"
              : "bg-[#7c3aed]/85 border-[#ce93d8]/50",
          )}
        >
          <p className="bw-label text-white/85 text-xs mb-1">Game {gameWin.gameNumber} Won</p>
          <TeamPlayerCard
            identity={identityFromSideInfo(
              gameWin.side === "left" ? state.leftSide : state.rightSide,
            )}
            size="md"
            tone="led"
            align="center"
            playerClassName="text-white text-3xl font-black"
            teamClassName="text-white/80"
          />
          <p className="text-white text-3xl font-black tabular-nums mt-2">
            {gameWin.winner} – {gameWin.loser}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ── Compact Overlay — BWF-style broadcast lower-third ─────────────────────────

function CompactGameDots({
  won,
  total,
}: {
  won: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0" aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "h-2.5 w-2.5 rounded-full border-2",
            i < won
              ? "bg-[#ffd700] border-[#ffd700]"
              : "bg-transparent border-white/35",
          )}
        />
      ))}
    </div>
  );
}

function CompactOverlay({
  state,
  courtNumber,
  matchLabel,
  showPlatformCredit,
}: {
  state: BadmintonMatchState;
  courtNumber?: string;
  matchLabel?: string;
  showPlatformCredit?: boolean;
}) {
  const isLive = state.matchStatus === "live";
  const isDoubles = isPairMatchKind(state.matchKind);
  const serverLabel = isDoubles ? currentServerLabel(state) : null;
  const receiverLabel = isDoubles ? currentReceiverLabel(state) : null;
  const flashSide = useServeSideFlash(state.servingSide);
  const pointFlash = usePointScoreFlash(state.leftScore, state.rightScore);
  const leftIdentity = identityFromSideInfo(state.leftSide);
  const rightIdentity = identityFromSideInfo(state.rightSide);
  const leftServing = state.servingSide === "left";
  const rightServing = state.servingSide === "right";

  return (
    <div
      className="flex w-full flex-col gap-2"
      style={{ fontFamily: "'Barlow Condensed', 'Inter', system-ui, sans-serif" }}
    >
      <DirectorStatusBanner state={state} />
      <ObsUrgencyBanner state={state} />

      <div className="w-full overflow-hidden rounded-2xl border border-white/15 bg-[#050507] shadow-[0_12px_48px_rgba(0,0,0,0.65)]">
        {/* Meta row */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black px-4 py-1.5 min-h-[32px]">
          <div className="flex items-center gap-2.5 min-w-0">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 shrink-0">
                <span className="size-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
                <span className="text-[11px] font-black tracking-[0.2em] text-red-300">LIVE</span>
              </span>
            ) : null}
            <span className="text-sm font-bold uppercase tracking-wider text-white/80">
              Game {state.currentGame}
            </span>
            {matchLabel?.trim() ? (
              <span className="truncate text-xs font-semibold uppercase tracking-wider text-white/40">
                {matchLabel.trim()}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs font-semibold uppercase tracking-wider text-white/45">
            {isDoubles && serverLabel ? (
              <span className="inline-flex items-center gap-1.5 text-[#ffd700]">
                <span className="badminton-serve-pip badminton-serve-pip--active" aria-hidden />
                <span className="max-w-[10rem] truncate">{serverLabel}</span>
              </span>
            ) : null}
            {isDoubles && receiverLabel ? (
              <span className="inline-flex items-center gap-1.5 text-white/55">
                <span className="badminton-receive-pip" aria-hidden />
                <span className="max-w-[10rem] truncate">{receiverLabel}</span>
              </span>
            ) : null}
            {courtNumber ? <span>Court {courtNumber}</span> : null}
          </div>
        </div>

        {/* Score row — opaque panels, large digits, serve never washes scores */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-stretch min-h-[96px]">
          {/* Left */}
          <div
            className={cn(
              "relative flex items-center gap-3 bg-[#0c0c10] px-4 py-3 sm:gap-4 sm:px-5",
              leftServing && "ring-1 ring-inset ring-[#ffd700]/55",
              flashSide === "left" && "badminton-serve-side--flash",
            )}
          >
            {leftServing ? (
              <div className="absolute inset-y-3 left-0 w-1.5 rounded-r-full bg-[#ffd700]" aria-hidden />
            ) : null}
            {!isDoubles && leftServing ? (
              <span className="badminton-serve-pip badminton-serve-pip--active shrink-0" aria-hidden />
            ) : (
              <span className="w-3 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1">
              <TeamPlayerCard
                identity={leftIdentity}
                size="sm"
                tone="led"
                layout="stack"
                playerClassName="text-white font-black text-xl sm:text-2xl leading-tight"
                teamClassName="text-white/55 text-xs sm:text-sm"
              />
            </div>
            <CompactGameDots won={state.gamesLeft} total={state.format.totalGames} />
            <div className="flex h-[72px] w-[88px] sm:h-[80px] sm:w-[100px] shrink-0 items-center justify-center rounded-xl bg-black border border-white/15">
              <OverlayScoreDigit
                score={state.leftScore}
                celebrate={pointFlash === "left"}
                className="text-white text-5xl sm:text-6xl font-black"
              />
            </div>
          </div>

          {/* Center */}
          <div className="flex w-[72px] sm:w-[88px] flex-col items-center justify-center gap-1 border-x border-white/10 bg-[#08080c] px-2">
            <span className="text-[10px] font-black tracking-[0.22em] text-white/35">SET</span>
            <span className="text-2xl sm:text-3xl font-black tabular-nums text-[#ffd700]">
              {state.currentGame}
            </span>
            <span className="text-[11px] font-bold tabular-nums text-white/50">
              {state.gamesLeft}–{state.gamesRight}
            </span>
          </div>

          {/* Right */}
          <div
            className={cn(
              "relative flex items-center gap-3 bg-[#0c0c10] px-4 py-3 flex-row-reverse sm:gap-4 sm:px-5",
              rightServing && "ring-1 ring-inset ring-[#ffd700]/55",
              flashSide === "right" && "badminton-serve-side--flash",
            )}
          >
            {rightServing ? (
              <div className="absolute inset-y-3 right-0 w-1.5 rounded-l-full bg-[#ffd700]" aria-hidden />
            ) : null}
            {!isDoubles && rightServing ? (
              <span className="badminton-serve-pip badminton-serve-pip--active shrink-0" aria-hidden />
            ) : (
              <span className="w-3 shrink-0" aria-hidden />
            )}
            <div className="min-w-0 flex-1 text-right">
              <TeamPlayerCard
                identity={rightIdentity}
                size="sm"
                tone="led"
                layout="stack"
                align="end"
                playerClassName="text-white font-black text-xl sm:text-2xl leading-tight"
                teamClassName="text-white/55 text-xs sm:text-sm"
              />
            </div>
            <CompactGameDots won={state.gamesRight} total={state.format.totalGames} />
            <div className="flex h-[72px] w-[88px] sm:h-[80px] sm:w-[100px] shrink-0 items-center justify-center rounded-xl bg-black border border-white/15">
              <OverlayScoreDigit
                score={state.rightScore}
                celebrate={pointFlash === "right"}
                className="text-white text-5xl sm:text-6xl font-black"
              />
            </div>
          </div>
        </div>
      </div>

      {showPlatformCredit ? (
        <p className="text-center text-[9px] font-bold uppercase tracking-[0.22em] text-white/25">
          Powered by BidWar
        </p>
      ) : null}
    </div>
  );
}

// ── Full Overlay — horizontal score bar above sponsor ticker ─────────────────

function FullOverlay({
  state,
  courtNumber,
  roundName,
  matchLabel,
}: {
  state: BadmintonMatchState;
  courtNumber?: string;
  roundName?: string;
  matchLabel?: string;
}) {
  const completedGames = state.games.filter((g) => g.phase === "completed");
  const displayMatchName = matchLabel?.trim();
  const metaParts = [
    displayMatchName,
    roundName,
    courtNumber ? `Court ${courtNumber}` : null,
    `Game ${state.currentGame}`,
  ].filter(Boolean);
  const flashSide = useServeSideFlash(state.servingSide);
  const pointFlash = usePointScoreFlash(state.leftScore, state.rightScore);

  return (
    <div
      className="w-full flex flex-col gap-2"
      style={{ fontFamily: "'Barlow Condensed', 'Inter', system-ui, sans-serif" }}
    >
      <DirectorStatusBanner state={state} />
      <ObsUrgencyBanner state={state} />

      <div className="rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.55)] border border-white/10 bg-[#070708]/95 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 border-b border-white/10 bg-black/50 min-h-[28px]">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 min-w-0 flex-1">
            {metaParts.map((part, i) => (
              <span key={`${part}-${i}`} className="inline-flex items-center gap-2">
                {i > 0 ? <span className="text-white/25 text-[10px]">·</span> : null}
                <span
                  className={cn(
                    "uppercase tracking-wider",
                    i === 0 && displayMatchName
                      ? "text-xs font-bold text-white"
                      : "text-[10px] font-semibold text-white/45",
                  )}
                >
                  {part}
                </span>
              </span>
            ))}
          </div>
          <FullOverlayCompletedSets games={completedGames} />
        </div>

        <div className="flex items-stretch min-h-[52px]">
          <FullOverlaySide
            align="left"
            identity={identityFromSideInfo(state.leftSide)}
            score={state.leftScore}
            gamesWon={state.gamesLeft}
            isServing={state.servingSide === "left"}
            isServeFlash={flashSide === "left"}
            isWinner={state.winnerSide === "left"}
            celebrate={pointFlash === "left"}
            format={state.format}
          />

          <div className="w-px bg-white/10 shrink-0" aria-hidden />

          <FullOverlaySide
            align="right"
            identity={identityFromSideInfo(state.rightSide)}
            score={state.rightScore}
            gamesWon={state.gamesRight}
            isServing={state.servingSide === "right"}
            isServeFlash={flashSide === "right"}
            isWinner={state.winnerSide === "right"}
            celebrate={pointFlash === "right"}
            format={state.format}
          />
        </div>
      </div>
    </div>
  );
}

function FullOverlayCompletedSets({
  games,
}: {
  games: BadmintonMatchState["games"];
}) {
  if (games.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
      {games.map((g) => (
        <div
          key={g.gameNumber}
          className="flex items-center gap-1 rounded-md border px-2 py-0.5"
          style={{
            borderColor: BIDWAR_BROADCAST_YELLOW_BORDER,
            backgroundColor: BIDWAR_BROADCAST_YELLOW_SOFT,
          }}
          title={`Game ${g.gameNumber} set score`}
        >
          <span
            className="text-[9px] font-bold uppercase tracking-[0.14em]"
            style={{ color: BIDWAR_BROADCAST_YELLOW_MUTED }}
          >
            G{g.gameNumber}
          </span>
          <span
            className="text-xs sm:text-sm font-black tabular-nums"
            style={{ color: BIDWAR_BROADCAST_YELLOW }}
          >
            {g.leftScore}
          </span>
          <span className="text-[10px] font-bold" style={{ color: "rgba(255, 196, 0, 0.45)" }}>
            –
          </span>
          <span
            className="text-xs sm:text-sm font-black tabular-nums"
            style={{ color: BIDWAR_BROADCAST_YELLOW }}
          >
            {g.rightScore}
          </span>
        </div>
      ))}
    </div>
  );
}

function FullOverlaySide({
  align,
  identity,
  score,
  gamesWon,
  isServing,
  isServeFlash,
  isWinner,
  celebrate,
  format,
}: {
  align: "left" | "right";
  identity: TeamPlayerIdentity;
  score: number;
  gamesWon: number;
  isServing: boolean;
  isServeFlash: boolean;
  isWinner: boolean;
  celebrate?: boolean;
  format: { totalGames: number };
}) {
  const isRight = align === "right";

  return (
    <div
      className={cn(
        "flex flex-1 min-w-0",
        overlayServeSideShellClass(isServing, isServeFlash),
      )}
    >
      {isServing ? (
        <div
          className={cn(
            "absolute inset-y-2 w-1 rounded-full bg-[#ffd700]/90 pointer-events-none",
            isRight ? "right-1.5" : "left-1.5",
          )}
          aria-hidden
        />
      ) : null}

      <div
        className={cn(
          "relative z-10 flex flex-1 items-center gap-2 sm:gap-3 px-3 py-2 min-w-0",
          isRight && "flex-row-reverse",
        )}
      >
      {isServing ? (
        <div className="w-2 h-2 rounded-full bg-[#ffd700] animate-pulse shrink-0" />
      ) : (
        <div className="w-2 shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <TeamPlayerCard
          identity={identity}
          size="xs"
          tone="led"
          layout="inline"
          align={isRight ? "end" : "start"}
          playerClassName="text-white font-black text-sm sm:text-base"
          teamClassName="text-white/50"
        />
      </div>

      <div className={cn("flex items-center gap-0.5 shrink-0", isRight && "flex-row-reverse")}>
        {Array.from({ length: format.totalGames }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              i < gamesWon ? "bg-white" : "bg-white/12",
            )}
          />
        ))}
      </div>

      <OverlayScoreDigit
        score={score}
        celebrate={celebrate}
        className={cn(
          "text-2xl sm:text-3xl text-white shrink-0",
          isWinner && "text-[#ffd700]",
        )}
      />
      </div>
    </div>
  );
}

// ── Player Intro Overlay ───────────────────────────────────────────────────────

function IntroOverlay({
  state,
  tournamentName,
  roundName,
}: {
  state: BadmintonMatchState;
  tournamentName?: string;
  roundName?: string;
}) {
  return (
    <div
      className="flex gap-4 items-end"
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      {/* Left player */}
      <IntroCard
        side="left"
        info={state.leftSide}
        matchKind={state.matchKind}
        tournamentName={tournamentName}
        roundName={roundName}
      />

      {/* VS separator */}
      <div className="flex flex-col items-center gap-2 pb-4">
        <div className="bg-white/10 rounded-xl px-4 py-2">
          <span className="text-white font-black text-xl">VS</span>
        </div>
        {state.matchKind && (
          <span className="text-white/30 text-[10px] font-medium uppercase tracking-widest text-center">
            {state.matchKind.replace("_", " ")}
          </span>
        )}
      </div>

      {/* Right player */}
      <IntroCard
        side="right"
        info={state.rightSide}
        matchKind={state.matchKind}
        tournamentName={tournamentName}
        roundName={roundName}
      />
    </div>
  );
}

function IntroCard({
  side,
  info,
  matchKind,
  tournamentName,
  roundName,
}: {
  side: "left" | "right";
  info: BadmintonMatchState["leftSide"];
  matchKind: BadmintonMatchState["matchKind"];
  tournamentName?: string;
  roundName?: string;
}) {
  const isLeft = side === "left";
  const identity = identityFromSideInfo(info);

  return (
    <div
      className={cn(
        "rounded-2xl overflow-hidden w-52",
        isLeft
          ? "bg-gradient-to-b from-[#0d2560]/95 to-[#071535]/95"
          : "bg-gradient-to-b from-[#2d0a4a]/95 to-[#12052a]/95",
      )}
    >
      <div className="relative h-36 overflow-hidden flex items-center justify-center gap-1 px-2">
        <SidePlayerPhotos
          info={info}
          matchKind={matchKind}
          side={side}
          size="md"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d2560]/80 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="px-4 pt-2 pb-4">
        <TeamPlayerCard
          identity={identity}
          size="sm"
          tone="led"
          layout="stack"
          align={isLeft ? "start" : "end"}
          playerClassName="text-base font-bold"
        />
        <div className="flex items-center gap-2 mt-1">
          {info.sponsorLogoUrl && (
            <img src={info.sponsorLogoUrl} alt="" loading="lazy" className="h-3 w-auto object-contain opacity-70" />
          )}
        </div>
        {info.countryName && (
          <p className={cn(
            "text-xs font-bold uppercase tracking-wider mt-1",
            isLeft ? "text-[#4fc3f7]" : "text-[#ce93d8]",
          )}>
            {info.countryName}
          </p>
        )}
        {info.flagUrl && (
          <img src={info.flagUrl} alt={info.countryCode} className="h-4 w-auto mt-2 rounded-sm" />
        )}
      </div>
    </div>
  );
}

// ── Winner Overlay ─────────────────────────────────────────────────────────────

function WinnerOverlay({
  state,
  tournamentName,
}: {
  state: BadmintonMatchState;
  tournamentName?: string;
}) {
  if (!state.winnerSide) return null;

  const winner = state.winnerSide === "left" ? state.leftSide : state.rightSide;
  const isLeft = state.winnerSide === "left";
  const completedGames = state.games.filter((g) => g.phase === "completed");
  const identity = identityFromSideInfo(winner);

  return (
    <div
      className={cn(
        "rounded-3xl overflow-hidden shadow-2xl w-[480px] animate-[badmintonMomentIn_0.45s_ease-out_forwards]",
        isLeft
          ? "bg-gradient-to-br from-[#0d1e4a]/95 to-[#0a3080]/90"
          : "bg-gradient-to-br from-[#1a052e]/95 to-[#3a0a5e]/90",
        "border",
        isLeft ? "border-[#ffc400]/20" : "border-[#ff6b6b]/20",
      )}
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      <div className="p-8 text-center">
        <div className="badminton-winner-seal mx-auto mb-4">
          <span className="bw-heading">WINNER</span>
        </div>
        <p className="text-white/40 text-xs font-bold uppercase tracking-[0.4em] mb-2">
          {tournamentName ?? "Match Winner"}
        </p>

        {winner.photoUrl && (
          <img
            src={winner.photoUrl}
            alt={identity.playerName}
            className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-4 border-[#ffd700]/50"
          />
        )}

        <div className="mb-1 flex justify-center">
          <TeamPlayerCard
            identity={identity}
            size="xl"
            tone="led"
            align="center"
            playerClassName="text-3xl font-black text-white"
            teamClassName="text-white/55"
          />
        </div>

        {winner.countryName && (
          <p className={cn(
            "text-sm font-bold uppercase tracking-widest mb-4",
            isLeft ? "text-[#4fc3f7]" : "text-[#ce93d8]",
          )}>
            {winner.countryName}
          </p>
        )}

        <div className="flex items-center justify-center gap-2 mb-4">
          <span className={cn("text-4xl font-black", isLeft ? "text-[#ffc400]" : "text-[#ff6b6b]")}>
            {state.gamesLeft}
          </span>
          <span className="text-white/30 text-2xl">–</span>
          <span className="text-white/40 text-4xl font-black">{state.gamesRight}</span>
        </div>

        <div className="flex items-center justify-center gap-2">
          {completedGames.map((g) => (
            <div key={g.gameNumber} className="bg-white/8 rounded-lg px-3 py-1.5">
              <span className="text-white text-xs font-bold">
                {g.leftScore}–{g.rightScore}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sponsor Overlay ────────────────────────────────────────────────────────────

function SponsorOverlay({
  sponsorLogos,
  tournamentName,
  rotateMs,
}: {
  sponsorLogos: SponsorLogo[];
  tournamentName?: string;
  rotateMs?: number;
}) {
  if (!sponsorLogos.length) return null;

  return (
    <div
      className="rounded-xl overflow-hidden bg-[#101013]/90 border border-white/10 px-6 py-4 flex items-center gap-6 shadow-2xl"
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      {tournamentName ? (
        <span className="text-white/40 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
          Supported by
        </span>
      ) : null}
      <SponsorCarousel logos={sponsorLogos} overlay rotateMs={rotateMs} />
    </div>
  );
}

function toResultsMatch(m: BroadcastConsoleMatch): ResultsMatch {
  return {
    id: m.id,
    status: m.status,
    scheduledAt: m.scheduledAt,
    completedAt: m.state?.endedAt ?? null,
    detail: m.detail,
    state: m.state,
    resultSummary: null,
    fixtureId: null,
    roundName:
      typeof m.detail?.roundName === "string" ? m.detail.roundName : null,
  };
}

/** OBS lower-third — cycles completed matches: winner, games, point difference. */
export function ObsRecentResultsOverlay({
  matches,
  rotateMs = OBS_RESULTS_ROTATE_MS,
}: {
  matches: BroadcastConsoleMatch[];
  rotateMs?: number;
}) {
  const results = listRecentCompleted(matches.map(toResultsMatch), 8);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (results.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % results.length);
    }, rotateMs);
    return () => clearInterval(id);
  }, [results.length, rotateMs]);

  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-white/15 bg-black/80 px-5 py-3 shadow-2xl backdrop-blur-sm">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300/80">
          Results
        </p>
        <p className="text-white/70 text-sm font-semibold mt-1">No completed matches yet</p>
      </div>
    );
  }

  const match = results[Math.min(index, results.length - 1)]!;
  const winner = winnerLabel(match) ?? "Winner";
  const loser = loserLabel(match) ?? "—";
  const diff = formatPointDifference(winnerPointDifference(match));
  const sets = gameScoreLines(match);
  const metaBits = [
    typeof match.detail?.categoryName === "string"
      ? match.detail.categoryName.trim()
      : "",
    typeof match.detail?.roundName === "string" ? match.detail.roundName.trim() : "",
  ].filter(Boolean);

  return (
    <div
      key={match.id}
      className="rounded-xl border border-amber-400/35 bg-black/85 px-5 py-3.5 shadow-2xl backdrop-blur-sm animate-[badmintonMomentIn_0.35s_ease-out_forwards]"
      style={{ fontFamily: "'Barlow Condensed', 'Inter', system-ui, sans-serif" }}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-amber-300/90">
          Result{results.length > 1 ? ` · ${index + 1}/${results.length}` : ""}
        </p>
        {metaBits.length > 0 ? (
          <p className="text-[10px] uppercase tracking-wide text-white/40 truncate max-w-[50%]">
            {metaBits.join(" · ")}
          </p>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-white text-xl md:text-2xl font-bold leading-tight truncate">
            {winner}
          </p>
          <p className="text-white/55 text-xs md:text-sm mt-0.5 truncate">
            def <span className="text-white/80">{loser}</span>
            {sets.length > 0 ? (
              <span className="text-white/40"> · {sets.join(", ")}</span>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-center">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/40">
              Games
            </p>
            <p className="text-white text-2xl font-black tabular-nums leading-none">
              {gamesWonLine(match)}
            </p>
          </div>
          <div className="text-center min-w-[3.25rem]">
            <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-emerald-300/70">
              Diff
            </p>
            <p className="text-emerald-300 text-2xl font-black tabular-nums leading-none">
              {diff}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
