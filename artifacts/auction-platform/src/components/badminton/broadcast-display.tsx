/**
 * Badminton Broadcast Display
 *
 * Designed for LED screens, projectors, and streaming.
 * Inspired by BWF World Championships, Olympic broadcasts,
 * and international federation graphics standards.
 *
 * Readable from 50+ feet. High contrast. 16:9 optimized.
 */

import { useState, useEffect, useRef, type CSSProperties } from "react";
import type { BadmintonMatchState, BadmintonSide } from "@workspace/badminton-core";
import {
  resolveFranchiseLogoUrl,
  resolveFranchiseName,
  isPairMatchKind,
  currentReceiverLabel,
  currentServerLabel,
  gamesNeededToWin,
  detectGamePointSide,
  detectMatchPointSide,
} from "@workspace/badminton-core";
import { SidePlayerPhotos } from "@/components/badminton/side-players";
import { type ScoreBoardSponsor } from "@/components/badminton/score-board-sponsor-panel";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";
import { cn } from "@/lib/utils";
import { DirectorStatusBanner } from "@/components/badminton/director-status-banner";
import { BadmintonLedChyron, BadmintonLedTopStrip } from "@/components/badminton/badminton-led-chrome";
import {
  badmintonLedSurfaceStyle,
  fixedGameDotStyle,
  fixedScoreStyle,
} from "@/components/badminton/badminton-led-theme";
import {
  formatTeamPlayerLine,
  identityFromSideInfo,
} from "@/lib/team-player-identity";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
  BIDWAR_BROADCAST_YELLOW_MUTED,
  BIDWAR_SCOREBOARD_INSET,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";

interface BroadcastDisplayProps {
  state: BadmintonMatchState;
  tournamentName?: string;
  tournamentLogoUrl?: string;
  courtNumber?: string;
  matchNumber?: string;
  roundName?: string;
  matchLabel?: string;
  sponsorLogos?: SponsorLogo[];
  scoreBoardSponsor?: ScoreBoardSponsor | null;
}

export interface BroadcastMatchBoardProps {
  state: BadmintonMatchState;
  /** Compact density for stacked multi-court venue boards. */
  density?: "full" | "compact";
  /** When set, shows a court identity bar above the score stage. */
  courtLabel?: string;
  className?: string;
  /** Hide director status banner (used in multi-court stacks). */
  showDirectorBanner?: boolean;
}

type FlashSide = BadmintonSide | null;
type GameWinPayload = {
  side: BadmintonSide;
  winner: number;
  loser: number;
  gameNumber: number;
};

function lastCompletedGame(games: BadmintonMatchState["games"]) {
  for (let i = games.length - 1; i >= 0; i--) {
    if (games[i]?.phase === "completed") return games[i];
  }
  return null;
}

/**
 * Live match scoreboard stage — photos, names, serve, games, centre score.
 * Used by the full single-court LED display and by multi-court venue stacks.
 */
export function BroadcastMatchBoard({
  state,
  density = "full",
  courtLabel,
  className,
  showDirectorBanner = true,
}: BroadcastMatchBoardProps) {
  const [gameWin, setGameWin] = useState<GameWinPayload | null>(null);
  const [pointFlash, setPointFlash] = useState<FlashSide>(null);
  const prevStateRef = useRef<BadmintonMatchState | null>(null);
  const prevScoreRef = useRef({ left: 0, right: 0 });
  const pointTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gameWinTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const compact = density === "compact";

  useEffect(() => {
    const prev = prevStateRef.current;
    if (!prev) {
      prevStateRef.current = state;
      prevScoreRef.current = { left: state.leftScore, right: state.rightScore };
      return;
    }

    if (state.leftScore > prevScoreRef.current.left) {
      setPointFlash("left");
      if (pointTimerRef.current) clearTimeout(pointTimerRef.current);
      pointTimerRef.current = setTimeout(() => setPointFlash(null), 800);
    } else if (state.rightScore > prevScoreRef.current.right) {
      setPointFlash("right");
      if (pointTimerRef.current) clearTimeout(pointTimerRef.current);
      pointTimerRef.current = setTimeout(() => setPointFlash(null), 800);
    }

    if (state.gamesLeft > prev.gamesLeft || state.gamesRight > prev.gamesRight) {
      const completed = lastCompletedGame(state.games);
      const side: BadmintonSide =
        state.gamesLeft > prev.gamesLeft ? "left" : "right";
      if (completed) {
        setGameWin({
          side,
          winner: side === "left" ? completed.leftScore : completed.rightScore,
          loser: side === "left" ? completed.rightScore : completed.leftScore,
          gameNumber: completed.gameNumber,
        });
        if (gameWinTimerRef.current) clearTimeout(gameWinTimerRef.current);
        gameWinTimerRef.current = setTimeout(() => setGameWin(null), 3500);
      }
    }

    prevStateRef.current = state;
    prevScoreRef.current = { left: state.leftScore, right: state.rightScore };
  }, [state]);

  useEffect(() => {
    return () => {
      if (pointTimerRef.current) clearTimeout(pointTimerRef.current);
      if (gameWinTimerRef.current) clearTimeout(gameWinTimerRef.current);
    };
  }, []);

  const isTimeout = !!state.activeTimeout;
  const isDoubles = isPairMatchKind(state.matchKind);
  const serverLabel = isDoubles ? currentServerLabel(state) : null;
  const receiverLabel = isDoubles ? currentReceiverLabel(state) : null;
  const leftServing =
    (!isDoubles && state.servingSide === "left") ||
    (isDoubles && state.doublesServe?.servingSide === "left");
  const rightServing =
    (!isDoubles && state.servingSide === "right") ||
    (isDoubles && state.doublesServe?.servingSide === "right");

  const showMatchWinner =
    (state.matchStatus === "completed" ||
      state.matchStatus === "walkover" ||
      state.matchStatus === "retired" ||
      state.matchStatus === "disqualified") &&
    !!state.winnerSide;

  const suppressDirectorBanner =
    !showDirectorBanner ||
    showMatchWinner ||
    isTimeout ||
    state.inInterval ||
    !!gameWin;

  const gamePointSide =
    state.matchStatus === "live" && !isTimeout && !state.inInterval
      ? detectGamePointSide(state)
      : null;
  const matchPointSide =
    state.matchStatus === "live" && !isTimeout && !state.inInterval
      ? detectMatchPointSide(state)
      : null;
  const urgencySide = matchPointSide ?? gamePointSide;
  const urgencyKind = matchPointSide ? "match" : gamePointSide ? "game" : null;

  const isDeuce =
    state.matchStatus === "live" &&
    state.leftScore >= state.format.deuceAt &&
    state.rightScore >= state.format.deuceAt;

  return (
    <div
      className={cn(
        "relative flex h-full min-h-0 flex-col overflow-hidden",
        compact && "badminton-score-board--compact",
        className,
      )}
      aria-label={courtLabel ? `${courtLabel} live score` : "Live score"}
    >
      {courtLabel ? (
        <div className="badminton-multi-court-bar flex items-center justify-between gap-3 shrink-0">
          <span className="badminton-multi-court-bar__court uppercase tracking-[0.18em]">
            {courtLabel}
          </span>
          <span
            className={cn(
              "bw-label tracking-[0.18em]",
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
          <span className="font-mono font-bold uppercase tracking-[0.16em] text-white/45">
            Game {state.currentGame || 1}
          </span>
        </div>
      ) : null}

      <div
        className={cn(
          "badminton-score-stage relative z-10 min-h-0 flex-1",
          compact && "badminton-score-stage--compact",
        )}
        style={{ backgroundColor: BIDWAR_SCOREBOARD_SHELL }}
      >
        {!suppressDirectorBanner ? (
          <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
            <DirectorStatusBanner state={state} />
          </div>
        ) : null}

        <PlayerBlock
          side="left"
          info={state.leftSide}
          matchKind={state.matchKind}
          gamesWon={state.gamesLeft}
          isServing={!!leftServing}
          servingPlayerLabel={leftServing && isDoubles ? serverLabel : null}
          isWinner={state.winnerSide === "left"}
          flash={pointFlash === "left"}
          gameWinFlash={gameWin?.side === "left"}
          gamesToWin={gamesNeededToWin(state.format.totalGames)}
          heat={urgencySide === "left" || pointFlash === "left"}
          compact={compact}
        />

        <CentrePanel
          state={state}
          isDoubles={isDoubles}
          serverLabel={serverLabel}
          receiverLabel={receiverLabel}
          isDeuce={isDeuce}
          urgencyKind={urgencyKind}
          urgencySide={urgencySide}
          pointFlash={pointFlash}
          compact={compact}
        />

        <PlayerBlock
          side="right"
          info={state.rightSide}
          matchKind={state.matchKind}
          gamesWon={state.gamesRight}
          isServing={!!rightServing}
          servingPlayerLabel={rightServing && isDoubles ? serverLabel : null}
          isWinner={state.winnerSide === "right"}
          flash={pointFlash === "right"}
          gameWinFlash={gameWin?.side === "right"}
          gamesToWin={gamesNeededToWin(state.format.totalGames)}
          heat={urgencySide === "right" || pointFlash === "right"}
          compact={compact}
        />
      </div>

      {isTimeout && state.activeTimeout ? (
        <TimeoutOverlay
          side={state.activeTimeout.side}
          player={
            state.activeTimeout.side === "left" ? state.leftSide : state.rightSide
          }
        />
      ) : null}

      {state.inInterval && !isTimeout ? (
        <IntervalOverlay
          currentGame={state.currentGame}
          leftScore={state.leftScore}
          rightScore={state.rightScore}
        />
      ) : null}

      {gameWin && !showMatchWinner && !isTimeout ? (
        <GameWinOverlay
          side={gameWin.side}
          player={gameWin.side === "left" ? state.leftSide : state.rightSide}
          score={{ winner: gameWin.winner, loser: gameWin.loser }}
          gameNumber={gameWin.gameNumber}
        />
      ) : null}

      {showMatchWinner && state.winnerSide ? (
        <MatchWinOverlay
          side={state.winnerSide}
          player={state.winnerSide === "left" ? state.leftSide : state.rightSide}
          gamesLeft={state.gamesLeft}
          gamesRight={state.gamesRight}
          games={state.games}
          resultReason={state.resultReason}
          compact={compact}
        />
      ) : null}
    </div>
  );
}

export function BroadcastDisplay({
  state,
  tournamentName = "Badminton Tournament",
  tournamentLogoUrl,
  courtNumber,
  matchNumber,
  roundName,
  matchLabel,
  sponsorLogos = [],
  scoreBoardSponsor = null,
}: BroadcastDisplayProps) {
  const isTimeout = !!state.activeTimeout;

  const displayMatchName =
    matchLabel?.trim() ||
    (roundName?.trim()
      ? null
      : `${formatTeamPlayerLine(identityFromSideInfo(state.leftSide))} vs ${formatTeamPlayerLine(identityFromSideInfo(state.rightSide))}`);

  const matchPointSide =
    state.matchStatus === "live" && !isTimeout && !state.inInterval
      ? detectMatchPointSide(state)
      : null;
  /** Match point — hide sponsor bar and enlarge score for hall readability ("crowd mode"). */
  const crowdMode = !!matchPointSide;

  return (
    <div
      className={cn(
        "badminton-led-surface absolute inset-0 overflow-hidden font-['Barlow_Condensed'] led-display-tv grid grid-rows-[auto_1fr_auto]",
        crowdMode && "badminton-led-surface--crowd",
      )}
      style={badmintonLedSurfaceStyle}
    >
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse 70% 50% at 50% 42%, rgba(255,255,255,0.07), transparent 70%),
            linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.22) 1px, transparent 1px)
          `,
          backgroundSize: "auto, 72px 72px, 72px 72px",
        }}
      />

      <BadmintonLedTopStrip
        tournamentName={tournamentName}
        tournamentLogoUrl={tournamentLogoUrl}
        courtNumber={courtNumber}
        matchNumber={matchNumber}
        roundName={roundName}
        matchStatus={state.matchStatus}
        isTimeout={isTimeout}
        timeoutSide={state.activeTimeout?.side}
        leftLabel={formatTeamPlayerLine(identityFromSideInfo(state.leftSide))}
        rightLabel={formatTeamPlayerLine(identityFromSideInfo(state.rightSide))}
        scoreBoardSponsor={scoreBoardSponsor}
        sponsorLogos={sponsorLogos}
      />

      <BroadcastMatchBoard state={state} className="relative z-10 min-h-0" />

      <footer className="relative z-20 flex flex-col shrink-0">
        <ScoreboardMetaRow
          matchName={displayMatchName}
          games={state.games}
        />
        {crowdMode ? (
          <div className="badminton-crowd-strip border-t border-red-500/40 bg-red-600/20 h-[10vh] min-h-[72px] max-h-[104px] flex items-center justify-center">
            <span className="bw-heading text-red-100 tracking-[0.35em] text-2xl md:text-3xl animate-pulse">
              MATCH POINT
            </span>
          </div>
        ) : (
          <BadmintonLedChyron sponsors={sponsorLogos} tournamentName={tournamentName} />
        )}
      </footer>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreboardMetaRow({
  matchName,
  games,
}: {
  matchName: string | null;
  games: BadmintonMatchState["games"];
}) {
  const completed = games.filter((g) => g.phase === "completed");
  if (!matchName && completed.length === 0) return null;

  return (
    <div className="badminton-score-history px-[3%] grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-t border-white/10 bg-black/45">
      <div className="min-w-0 justify-self-start">
        {matchName ? (
          <p
            className="bw-caption text-white/75 bw-name-full"
            style={{ fontSize: "var(--score-player-meta)" }}
          >
            {matchName}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {completed.map((g) => (
          <div
            key={g.gameNumber}
            className="flex items-center gap-1.5 bg-white/10 border border-white/15 rounded px-2.5 py-1"
          >
            <span
              className="bw-caption text-white/55"
              style={{ fontSize: "var(--score-player-meta)" }}
            >
              G{g.gameNumber}
            </span>
            <span
              className="bw-display-l text-[length:var(--score-game-count)]"
              style={fixedScoreStyle()}
            >
              {g.leftScore}
            </span>
            <span className="text-white/35 text-[length:var(--score-player-meta)]">–</span>
            <span
              className="bw-display-l text-[length:var(--score-game-count)]"
              style={fixedScoreStyle()}
            >
              {g.rightScore}
            </span>
          </div>
        ))}
      </div>

      <div aria-hidden className="justify-self-end" />
    </div>
  );
}

function ServePip({ active, className }: { active: boolean; className?: string }) {
  return (
    <span
      className={cn("badminton-serve-pip", active && "badminton-serve-pip--active", className)}
      aria-hidden
    />
  );
}

interface PlayerBlockProps {
  side: "left" | "right";
  info: BadmintonMatchState["leftSide"];
  matchKind: BadmintonMatchState["matchKind"];
  gamesWon: number;
  isServing: boolean;
  servingPlayerLabel?: string | null;
  isWinner: boolean;
  flash: boolean;
  gameWinFlash: boolean;
  gamesToWin: number;
  heat: boolean;
  compact?: boolean;
}

function PlayerBlock({
  side,
  info,
  matchKind,
  gamesWon,
  isServing,
  servingPlayerLabel,
  isWinner,
  flash,
  gameWinFlash,
  gamesToWin,
  heat,
  compact = false,
}: PlayerBlockProps) {
  const isLeft = side === "left";
  const franchiseName = resolveFranchiseName(info);
  const franchiseLogoUrl = resolveFranchiseLogoUrl(info);
  const identity = identityFromSideInfo(info);
  const isPair = isPairMatchKind(matchKind);
  /* Outer-edge alignment uses the available side space so names stay clear of the score */
  const towardEdge = isLeft ? "start" : "end";

  return (
    <div
      className={cn(
        "badminton-score-side-panel flex flex-col shrink-0 min-w-0 relative",
        towardEdge === "end" ? "items-end" : "items-start",
        heat && "badminton-score-side-panel--heat",
        isWinner && "badminton-score-side-panel--winner",
      )}
      style={
        {
          ...(isLeft
            ? { "--side-heat": "rgba(255, 215, 0, 0.14)" }
            : { "--side-heat": "rgba(224, 176, 255, 0.14)" }),
        } as CSSProperties
      }
    >
      <div
        className={cn(
          "badminton-score-identity-card",
          isPair && "badminton-score-identity-card--pair",
          towardEdge === "end" ? "items-end text-right" : "items-start text-left",
          isWinner && "badminton-score-identity-card--winner",
        )}
      >
        <div className="badminton-score-identity-photo relative shrink-0">
          <SidePlayerPhotos
            info={info}
            matchKind={matchKind}
            side={side}
            size="broadcast"
            flash={flash}
            gameWinFlash={gameWinFlash}
          />
          {isServing ? (
            <div
              className="badminton-serve-badge absolute -bottom-1.5 left-1/2 -translate-x-1/2"
              aria-label="Serving"
              title="Serving"
            >
              <ServePip active />
              <span className="bw-label">SERVE</span>
            </div>
          ) : null}
        </div>

        <div
          className={cn(
            "badminton-score-identity-copy flex flex-col w-full min-w-0",
            towardEdge === "end" ? "items-end" : "items-start",
          )}
        >
          <TeamPlayerCard
            identity={identity}
            size="md"
            tone="led"
            layout="stack"
            align={towardEdge}
            showBadge={Boolean(franchiseName)}
            className="w-full max-w-full"
            playerClassName={cn(
              "badminton-score-player-name bw-heading",
              isPair && "badminton-score-player-name--pair",
            )}
            teamClassName="badminton-score-team-name bw-label opacity-95 w-full max-w-full"
          />
          {/* Compact multi-court: SERVE badge on photo already covers this — hide to avoid a
              redundant repeat of the player's name in yellow directly under the pair name. */}
          {servingPlayerLabel && !compact ? (
            <p
              className="bw-meta text-[#ffd700] mt-0.5"
              style={{ fontSize: "var(--score-player-meta)" }}
            >
              {servingPlayerLabel}
            </p>
          ) : null}
          {!compact ? (
            <div
              className={cn(
                "flex items-center gap-1.5 mt-0.5",
                towardEdge === "end" && "flex-row-reverse",
              )}
            >
              {!franchiseLogoUrl && info.flagUrl ? (
                <img
                  src={info.flagUrl}
                  alt={info.countryCode}
                  loading="lazy"
                  decoding="async"
                  className="w-auto rounded-sm"
                  style={{ height: "var(--score-player-meta)" }}
                />
              ) : null}
              {info.sponsorLogoUrl ? (
                <img
                  src={info.sponsorLogoUrl}
                  alt={info.sponsorName ?? "Sponsor"}
                  loading="lazy"
                  decoding="async"
                  className="w-auto object-contain opacity-80"
                  style={{ height: "var(--score-player-meta)" }}
                />
              ) : null}
            </div>
          ) : null}
          {info.countryName && !compact ? (
            <p
              className="bw-meta opacity-80 bw-name-full w-full text-[#ffd700]/75"
              style={{ fontSize: "var(--score-player-meta)" }}
            >
              {info.countryName}
            </p>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "badminton-score-games-won badminton-score-games-won--glam flex items-center",
          towardEdge === "end" && "flex-row-reverse",
        )}
        style={
          {
            "--gw-tint": "rgba(255, 215, 0, 0.14)",
            "--gw-border": "rgba(255, 215, 0, 0.32)",
          } as CSSProperties
        }
      >
        <span
          className="badminton-score-games-won-label bw-caption whitespace-nowrap"
          style={{ fontSize: "var(--score-player-meta)" }}
        >
          Games
        </span>
        <div
          className="flex items-center"
          style={{ gap: "calc(var(--score-panel-gap) * 0.75)" }}
        >
          {Array.from({ length: gamesToWin }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-full border-2 transition-all duration-500",
                gameWinFlash && i === gamesWon - 1 && "scale-150 animate-pulse",
              )}
              style={{
                width: "var(--score-game-dot)",
                height: "var(--score-game-dot)",
                ...fixedGameDotStyle(i < gamesWon, side),
              }}
            />
          ))}
        </div>
        <span
          className="bw-meta"
          style={{
            fontSize: "var(--score-game-count)",
            color: "#ffd700",
            textShadow: "0 0 10px rgba(255,215,0,0.5)",
          }}
        >
          {gamesWon}
        </span>
      </div>
    </div>
  );
}

function CentrePanel({
  state,
  isDoubles,
  serverLabel,
  receiverLabel,
  isDeuce,
  urgencyKind,
  urgencySide,
  pointFlash,
  compact = false,
}: {
  state: BadmintonMatchState;
  isDoubles?: boolean;
  serverLabel?: string | null;
  receiverLabel?: string | null;
  isDeuce: boolean;
  urgencyKind: "game" | "match" | null;
  urgencySide: BadmintonSide | null;
  pointFlash: FlashSide;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "badminton-score-centre flex flex-col items-center min-w-0",
        compact && "badminton-score-centre--compact",
      )}
    >
      <div
        className="badminton-score-centre-score flex items-center justify-center relative"
        style={{ gap: "calc(var(--score-panel-gap) * 1.2)" }}
      >
        <ScoreDigit
          score={state.leftScore}
          active={state.matchStatus === "live"}
          celebrate={pointFlash === "left"}
        />
        <div
          className="text-white/25 font-black leading-none"
          style={{ fontSize: "var(--score-colon-size)" }}
        >
          :
        </div>
        <ScoreDigit
          score={state.rightScore}
          active={state.matchStatus === "live"}
          celebrate={pointFlash === "right"}
        />
        {pointFlash ? (
          <span
            className="badminton-point-burst bw-heading"
            key={`${pointFlash}-${state.leftScore}-${state.rightScore}`}
          >
            +1
          </span>
        ) : null}
      </div>

      {/* Compact multi-court: the court bar above already shows "Game N" — skip the
          duplicate pill here so it doesn't repeat (and crowd the score digits). */}
      {!compact ? (
        <div
          className="bg-white/10 border border-white/20 rounded-full"
          style={{
            padding: "calc(var(--score-game-pill) * 0.45) calc(var(--score-game-pill) * 1.6)",
          }}
        >
          <span
            className="bw-heading text-white/85"
            style={{ fontSize: "var(--score-game-pill)" }}
          >
            Game {state.currentGame}
          </span>
        </div>
      ) : null}

      <div
        className="badminton-score-series flex items-center"
        style={{ gap: "calc(var(--score-panel-gap) * 0.75)" }}
        aria-label={`Games ${state.gamesLeft} to ${state.gamesRight}`}
      >
        <span className="bw-caption text-white/60" style={{ fontSize: "0.85em" }}>
          Series
        </span>
        <span
          className="bw-display-l tabular-nums text-[#ffd700]"
          style={{ fontSize: "var(--score-game-count)" }}
        >
          {state.gamesLeft}
        </span>
        <span className="text-white/35">–</span>
        <span
          className="bw-display-l tabular-nums text-white"
          style={{ fontSize: "var(--score-game-count)" }}
        >
          {state.gamesRight}
        </span>
      </div>

      {/* Compact multi-court: SERVE badge on photo already covers this — hide to avoid clip. */}
      {!compact && isDoubles && serverLabel ? (
        <div
          className="badminton-score-serve-line flex flex-col items-center gap-0.5"
          style={{ fontSize: "var(--score-player-meta)" }}
        >
          <div className="flex items-center gap-2">
            <ServePip active />
            <span className="bw-label text-white/55">Serving</span>
            <span className="bw-meta text-[#ffd700]">{serverLabel}</span>
          </div>
          {receiverLabel ? (
            <div className="flex items-center gap-2">
              <span className="badminton-receive-pip" aria-hidden />
              <span className="bw-label text-white/55">Receiving</span>
              <span className="bw-meta text-[#ffd700]/80">{receiverLabel}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!compact && !isDoubles ? (
        <div
          className="flex items-center"
          style={{ gap: "calc(var(--score-panel-gap) * 0.7)" }}
        >
          <ServePip active={state.servingSide === "left"} />
          <span
            className="bw-label text-white/45"
            style={{ fontSize: "var(--score-player-meta)" }}
          >
            Serving
          </span>
          <ServePip active={state.servingSide === "right"} />
        </div>
      ) : null}

      {urgencyKind && urgencySide ? (
        <div
          className={cn(
            "badminton-urgency-banner",
            urgencyKind === "match"
              ? "badminton-urgency-banner--match"
              : "badminton-urgency-banner--game",
          )}
        >
          <span className="bw-heading">
            {urgencyKind === "match" ? "MATCH POINT" : "GAME POINT"}
          </span>
        </div>
      ) : null}

      {isDeuce && !urgencyKind ? (
        <div className="badminton-urgency-banner badminton-urgency-banner--deuce">
          <span className="bw-heading">DEUCE</span>
        </div>
      ) : null}
    </div>
  );
}

function ScoreDigit({
  score,
  active,
  celebrate,
}: {
  score: number;
  active: boolean;
  celebrate?: boolean;
}) {
  return (
    <div
      className={cn(
        "badminton-score-digit bw-display-xl font-black leading-none tabular-nums tracking-tighter transition-all duration-200",
        celebrate && "badminton-score-digit--celebrate",
      )}
      style={fixedScoreStyle(active)}
    >
      {score}
    </div>
  );
}

function TimeoutOverlay({
  side: _side,
  player,
}: {
  side: BadmintonSide;
  player: BadmintonMatchState["leftSide"];
}) {
  const identity = identityFromSideInfo(player);
  return (
    <div className="badminton-moment-overlay z-[26]">
      <div
        className="badminton-moment-card border"
        style={{
          backgroundColor: BIDWAR_SCOREBOARD_SHELL,
          borderColor: BIDWAR_BROADCAST_YELLOW_BORDER,
        }}
      >
        <p
          className="bw-label mb-3 tracking-[0.35em]"
          style={{ color: BIDWAR_BROADCAST_YELLOW_MUTED }}
        >
          Timeout
        </p>
        <p className="bw-heading text-white text-5xl md:text-6xl mb-4">TIMEOUT</p>
        <TeamPlayerCard
          identity={identity}
          size="lg"
          tone="led"
          align="center"
          playerClassName="bw-heading text-3xl text-white"
          teamClassName="bw-label text-white/55"
        />
      </div>
    </div>
  );
}

function IntervalOverlay({
  currentGame,
  leftScore,
  rightScore,
}: {
  currentGame: number;
  leftScore: number;
  rightScore: number;
}) {
  return (
    <div className="badminton-moment-overlay z-[25]">
      <div
        className="badminton-moment-card border"
        style={{
          backgroundColor: BIDWAR_SCOREBOARD_SHELL,
          borderColor: "rgba(255,255,255,0.15)",
        }}
      >
        <p
          className="bw-label mb-3 tracking-[0.35em]"
          style={{ color: BIDWAR_BROADCAST_YELLOW_MUTED }}
        >
          Interval
        </p>
        <p className="bw-heading text-white text-5xl md:text-6xl mb-4">INTERVAL</p>
        <p className="bw-meta text-white/60 text-xl mb-2">Game {currentGame}</p>
        <div
          className="bw-display-l text-5xl"
          style={{ ...fixedScoreStyle(), color: BIDWAR_BROADCAST_YELLOW }}
        >
          {leftScore} – {rightScore}
        </div>
      </div>
    </div>
  );
}

function GameWinOverlay({
  side: _side,
  player,
  score,
  gameNumber,
}: {
  side: BadmintonSide;
  player: BadmintonMatchState["leftSide"];
  score: { winner: number; loser: number };
  gameNumber: number;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[28] bg-black/50">
      <div
        className="relative overflow-hidden rounded-3xl px-16 py-8 text-center border shadow-[0_12px_48px_rgba(0,0,0,0.65)] animate-[badmintonMomentIn_0.4s_ease-out_forwards]"
        style={{
          backgroundColor: BIDWAR_SCOREBOARD_SHELL,
          borderColor: BIDWAR_BROADCAST_YELLOW_BORDER,
        }}
      >
        <p
          className="bw-label text-sm mb-2 tracking-[0.2em]"
          style={{ color: BIDWAR_BROADCAST_YELLOW_MUTED }}
        >
          Game {gameNumber} Won
        </p>
        <div className="mb-3 flex justify-center">
          <TeamPlayerCard
            identity={identityFromSideInfo(player)}
            size="lg"
            tone="led"
            align="center"
            playerClassName="bw-heading text-4xl text-white"
            teamClassName="bw-label text-white/55"
          />
        </div>
        <div
          className="bw-display-l text-5xl"
          style={{ ...fixedScoreStyle(), color: BIDWAR_BROADCAST_YELLOW }}
        >
          {score.winner} – {score.loser}
        </div>
      </div>
    </div>
  );
}

function MatchWinOverlay({
  side,
  player,
  gamesLeft,
  gamesRight,
  games,
  resultReason,
  compact = false,
}: {
  side: BadmintonSide;
  player: BadmintonMatchState["leftSide"];
  gamesLeft: number;
  gamesRight: number;
  games: BadmintonMatchState["games"];
  resultReason?: BadmintonMatchState["resultReason"];
  compact?: boolean;
}) {
  const completedGames = games.filter((g) => g.phase === "completed");
  const identity = identityFromSideInfo(player);
  const subtitle =
    resultReason && resultReason !== "normal"
      ? resultReason.replace(/_/g, " ")
      : "Match Winner";

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/75 backdrop-blur-sm">
      <div
        className={cn(
          "relative overflow-hidden text-center w-full border shadow-[0_12px_48px_rgba(0,0,0,0.65)] animate-[badmintonMomentIn_0.45s_ease-out_forwards]",
          compact
            ? "rounded-2xl px-6 py-4 max-w-xl"
            : "rounded-3xl px-16 py-10 max-w-3xl",
        )}
        style={{
          backgroundColor: BIDWAR_SCOREBOARD_SHELL,
          borderColor: BIDWAR_BROADCAST_YELLOW_BORDER,
        }}
      >
        <div className={cn("badminton-winner-seal mx-auto", compact ? "mb-2" : "mb-5")}>
          <span className="bw-heading">WINNER</span>
        </div>

        <p
          className={cn(
            "bw-label text-white/50 uppercase tracking-[0.3em]",
            compact ? "text-[10px] mb-2" : "text-xs mb-4",
          )}
        >
          {subtitle}
        </p>

        {player.photoUrl && !compact ? (
          <img
            src={player.photoUrl}
            alt={identity.playerName}
            className="w-28 h-28 rounded-2xl mx-auto mb-4 object-cover border-4 shadow-[0_0_28px_rgba(255,215,0,0.35)]"
            style={{ borderColor: BIDWAR_BROADCAST_YELLOW }}
          />
        ) : null}

        <div className={cn("flex justify-center", compact ? "mb-1" : "mb-2")}>
          <TeamPlayerCard
            identity={identity}
            size={compact ? "md" : "xl"}
            tone="led"
            align="center"
            playerClassName={cn(
              "bw-heading text-white leading-tight",
              compact ? "text-2xl" : "text-5xl",
            )}
            teamClassName="bw-label text-white/55"
          />
        </div>

        {player.countryName && !compact ? (
          <p
            className="bw-meta text-lg mb-6"
            style={{ color: BIDWAR_BROADCAST_YELLOW_MUTED }}
          >
            {player.countryName}
          </p>
        ) : null}

        <div
          className={cn(
            "inline-block border border-white/10",
            compact ? "rounded-xl px-4 py-2 mb-2" : "rounded-2xl px-8 py-4 mb-6",
          )}
          style={{ backgroundColor: BIDWAR_SCOREBOARD_PANEL }}
        >
          <span
            className={cn("bw-display-l", compact ? "text-3xl" : "text-5xl")}
            style={{
              ...fixedScoreStyle(side === "left"),
              color: side === "left" ? BIDWAR_BROADCAST_YELLOW : undefined,
            }}
          >
            {gamesLeft}
          </span>
          <span className={cn("text-white/30 mx-3", compact ? "text-xl" : "text-3xl")}>–</span>
          <span
            className={cn("bw-display-l", compact ? "text-3xl" : "text-5xl")}
            style={{
              ...fixedScoreStyle(side === "right"),
              color: side === "right" ? BIDWAR_BROADCAST_YELLOW : undefined,
            }}
          >
            {gamesRight}
          </span>
        </div>

        {!compact ? (
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {completedGames.map((g) => (
              <div
                key={g.gameNumber}
                className="rounded-lg px-3 py-2 border border-white/10"
                style={{ backgroundColor: BIDWAR_SCOREBOARD_INSET }}
              >
                <span className="text-white/45 text-xs block text-center mb-1">
                  G{g.gameNumber}
                </span>
                <span className="font-bold text-white text-sm">
                  {g.leftScore}–{g.rightScore}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
