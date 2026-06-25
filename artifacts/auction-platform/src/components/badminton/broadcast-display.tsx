/**
 * Badminton Broadcast Display
 *
 * Designed for LED screens, projectors, and streaming.
 * Inspired by BWF World Championships, Olympic broadcasts,
 * and international federation graphics standards.
 *
 * Readable from 50+ feet. High contrast. 16:9 optimized.
 */

import { useState, useEffect, useRef } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { resolveFranchiseLogoUrl, resolveFranchiseName, isPairMatchKind, currentReceiverLabel, currentServerLabel } from "@workspace/badminton-core";
import { SidePlayerNames, SidePlayerPhotos } from "@/components/badminton/side-players";
import { DoublesCourtDisplay } from "@/components/badminton/doubles-court-display";
import { type ScoreBoardSponsor } from "@/components/badminton/score-board-sponsor-panel";
import { cn } from "@/lib/utils";
import { DirectorStatusBanner } from "@/components/badminton/director-status-banner";
import { BadmintonLedChyron, BadmintonLedTopStrip } from "@/components/badminton/badminton-led-chrome";
import {
  badmintonLedSurfaceStyle,
  fixedGameDotStyle,
  fixedScoreStyle,
  fixedServeStyle,
} from "@/components/badminton/badminton-led-theme";
import type { SponsorLogo } from "@/lib/sponsor-logo";

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
  const [gameWinFlash, setGameWinFlash] = useState<"left" | "right" | null>(null);
  const [matchWinFlash, setMatchWinFlash] = useState<"left" | "right" | null>(null);
  const [pointFlash, setPointFlash] = useState<"left" | "right" | null>(null);
  const prevStateRef = useRef<BadmintonMatchState | null>(null);
  const prevScoreRef = useRef({ left: 0, right: 0 });

  // Detect state changes for animations
  useEffect(() => {
    const prev = prevStateRef.current;
    if (!prev) {
      prevStateRef.current = state;
      prevScoreRef.current = { left: state.leftScore, right: state.rightScore };
      return;
    }

    // Point scored
    if (state.leftScore > prevScoreRef.current.left) {
      setPointFlash("left");
      setTimeout(() => setPointFlash(null), 800);
    } else if (state.rightScore > prevScoreRef.current.right) {
      setPointFlash("right");
      setTimeout(() => setPointFlash(null), 800);
    }

    // Game won
    const prevGamesLeft = prev.gamesLeft;
    const prevGamesRight = prev.gamesRight;
    if (state.gamesLeft > prevGamesLeft) {
      setGameWinFlash("left");
      setTimeout(() => setGameWinFlash(null), 3000);
    } else if (state.gamesRight > prevGamesRight) {
      setGameWinFlash("right");
      setTimeout(() => setGameWinFlash(null), 3000);
    }

    // Match won
    if (state.matchStatus === "completed" && prev.matchStatus !== "completed") {
      setMatchWinFlash(state.winnerSide ?? null);
    }

    prevStateRef.current = state;
    prevScoreRef.current = { left: state.leftScore, right: state.rightScore };
  }, [state]);

  const isTimeout = !!state.activeTimeout;
  const isDoubles = isPairMatchKind(state.matchKind);
  const serverLabel = isDoubles ? currentServerLabel(state) : null;
  const receiverLabel = isDoubles ? currentReceiverLabel(state) : null;
  const displayMatchName =
    matchLabel?.trim() ||
    `${state.leftSide.shortLabel} vs ${state.rightSide.shortLabel}`;

  return (
    <div
      className="badminton-led-surface absolute inset-0 overflow-hidden font-['Barlow_Condensed'] led-display-tv grid grid-rows-[auto_1fr_auto]"
      style={badmintonLedSurfaceStyle}
    >
      {/* Animated background grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
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
        leftLabel={state.leftSide.shortLabel}
        rightLabel={state.rightSide.shortLabel}
        scoreBoardSponsor={scoreBoardSponsor}
      />

      {/* MAIN SCORE AREA — fixed palette; theme picker does not affect readability */}
      <div
        className="relative z-10 min-h-0 flex items-center justify-between py-2 bg-[#070708]"
        style={{ paddingLeft: "var(--score-zone-px)", paddingRight: "var(--score-zone-px)" }}
      >
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
          <DirectorStatusBanner state={state} />
        </div>
        {/* Left player block */}
        <PlayerBlock
          side="left"
          info={state.leftSide}
          matchKind={state.matchKind}
          score={state.leftScore}
          gamesWon={state.gamesLeft}
          isServing={!isDoubles && state.servingSide === "left"}
          servingPlayerLabel={
            isDoubles && state.doublesServe?.servingSide === "left" ? serverLabel : null
          }
          isWinner={state.winnerSide === "left"}
          flash={pointFlash === "left"}
          gameWinFlash={gameWinFlash === "left"}
          format={state.format}
        />

        {/* Centre panel */}
        <CentrePanel
          state={state}
          matchName={displayMatchName}
          isTimeout={isTimeout}
          timeoutSide={state.activeTimeout?.side}
          isDoubles={isDoubles}
          serverLabel={serverLabel}
          receiverLabel={receiverLabel}
        />

        {/* Right player block */}
        <PlayerBlock
          side="right"
          info={state.rightSide}
          matchKind={state.matchKind}
          score={state.rightScore}
          gamesWon={state.gamesRight}
          isServing={!isDoubles && state.servingSide === "right"}
          servingPlayerLabel={
            isDoubles && state.doublesServe?.servingSide === "right" ? serverLabel : null
          }
          isWinner={state.winnerSide === "right"}
          flash={pointFlash === "right"}
          gameWinFlash={gameWinFlash === "right"}
          format={state.format}
        />
      </div>

      <footer className="relative z-20 flex flex-col shrink-0">
        <GameHistoryRow games={state.games} />
        <BadmintonLedChyron sponsors={sponsorLogos} tournamentName={tournamentName} />
      </footer>

      {/* Game win overlay */}
      {gameWinFlash && (
        <GameWinOverlay
          side={gameWinFlash}
          player={gameWinFlash === "left" ? state.leftSide : state.rightSide}
          score={gameWinFlash === "left"
            ? { winner: state.leftScore, loser: state.rightScore }
            : { winner: state.rightScore, loser: state.leftScore }
          }
        />
      )}

      {/* Match win overlay */}
      {matchWinFlash && (
        <MatchWinOverlay
          side={matchWinFlash}
          player={matchWinFlash === "left" ? state.leftSide : state.rightSide}
          gamesLeft={state.gamesLeft}
          gamesRight={state.gamesRight}
          games={state.games}
        />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function GameHistoryRow({ games }: { games: BadmintonMatchState["games"] }) {
  const completed = games.filter((g) => g.phase === "completed");
  if (completed.length === 0) return null;

  return (
    <div className="px-[3%] py-2 flex items-center justify-center gap-3 border-t border-white/5 bg-black/30">
      <span
        className="shrink-0 font-semibold uppercase tracking-[0.18em] text-white/45"
        style={{ fontSize: "var(--score-player-meta)" }}
      >
        Completed Games
      </span>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {completed.map((g) => (
          <div
            key={g.gameNumber}
            className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded px-3 py-1.5"
          >
            <span
              className="text-white/40 font-mono uppercase tracking-wider"
              style={{ fontSize: "var(--score-player-meta)" }}
            >
              G{g.gameNumber}
            </span>
            <span className="font-['Bebas_Neue'] text-[length:var(--score-game-count)] tabular-nums" style={fixedScoreStyle()}>{g.leftScore}</span>
            <span className="text-white/30 text-[length:var(--score-player-meta)]">–</span>
            <span className="font-['Bebas_Neue'] text-[length:var(--score-game-count)] tabular-nums" style={fixedScoreStyle()}>{g.rightScore}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PlayerBlockProps {
  side: "left" | "right";
  info: BadmintonMatchState["leftSide"];
  matchKind: BadmintonMatchState["matchKind"];
  score: number;
  gamesWon: number;
  isServing: boolean;
  /** Doubles — highlight specific serving player name instead of whole side. */
  servingPlayerLabel?: string | null;
  isWinner: boolean;
  flash: boolean;
  gameWinFlash: boolean;
  format: { totalGames: number };
}

function PlayerBlock({
  side,
  info,
  matchKind,
  score,
  gamesWon,
  isServing,
  servingPlayerLabel,
  isWinner,
  flash,
  gameWinFlash,
  format,
}: PlayerBlockProps) {
  const isLeft = side === "left";
  const franchiseName = resolveFranchiseName(info);
  const franchiseLogoUrl = resolveFranchiseLogoUrl(info);

  return (
    <div
      className={cn(
        "flex flex-col w-[35%]",
        isLeft ? "items-start" : "items-end",
      )}
      style={{ gap: "var(--score-panel-gap)" }}
    >
      <div className="relative">
        <SidePlayerPhotos
          info={info}
          matchKind={matchKind}
          side={side}
          size="broadcast"
          flash={flash}
          gameWinFlash={gameWinFlash}
        />
        {isServing && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#ffd700] rounded-full px-2 py-0.5 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-white" />
          </div>
        )}
        {servingPlayerLabel && (
          <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#ffd700] rounded-full px-2 py-0.5">
            <span className="text-[10px] font-bold text-black whitespace-nowrap">🟡 {servingPlayerLabel}</span>
          </div>
        )}
      </div>

      {/* Name + team + country */}
      <div className={cn("flex flex-col gap-1", isLeft ? "items-start" : "items-end")}>
        <div className={cn("flex items-center gap-2", !isLeft && "flex-row-reverse")}>
          {franchiseLogoUrl && (
            <img
              src={franchiseLogoUrl}
              alt={franchiseName ?? "Franchise"}
              loading="lazy"
              decoding="async"
              className="object-contain"
              style={{ height: "calc(var(--score-player-meta) * 1.4)", width: "calc(var(--score-player-meta) * 1.4)" }}
            />
          )}
          {!franchiseLogoUrl && info.flagUrl && (
            <img
              src={info.flagUrl}
              alt={info.countryCode}
              loading="lazy"
              decoding="async"
              className="w-auto rounded-sm"
              style={{ height: "var(--score-player-meta)" }}
            />
          )}
          {info.sponsorLogoUrl && (
            <img
              src={info.sponsorLogoUrl}
              alt={info.sponsorName ?? "Sponsor"}
              loading="lazy"
              decoding="async"
              className="w-auto object-contain opacity-80"
              style={{ height: "var(--score-player-meta)" }}
            />
          )}
        </div>
        <SidePlayerNames
          info={info}
          matchKind={matchKind}
          side={side}
          stacked
          className="badminton-score-player-name"
        />
        {franchiseName && (
          <p className={cn(
            "font-semibold uppercase tracking-[0.1em] text-white/40",
          )}
          style={{ fontSize: "var(--score-player-meta)" }}
          >
            Franchise: {franchiseName}
          </p>
        )}
        {info.countryName && (
          <p className={cn(
            "font-bold uppercase tracking-[0.15em]",
            isLeft ? "text-[#ffc400]" : "text-[#ce93d8]",
          )}
          style={{ fontSize: "var(--score-player-meta)" }}
          >
            {info.countryName}
          </p>
        )}
      </div>

      {/* Games won indicator */}
      <div className={cn("flex items-center", !isLeft && "flex-row-reverse")} style={{ gap: "calc(var(--score-panel-gap) * 0.65)" }}>
        {Array.from({ length: format.totalGames }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-full border-2 transition-all duration-500",
              gameWinFlash && i === gamesWon - 1 && "scale-150 animate-pulse",
            )}
            style={{
              width: "var(--score-game-dot)",
              height: "var(--score-game-dot)",
              ...fixedGameDotStyle(i < gamesWon),
            }}
          />
        ))}
        <span
          className="font-black text-white/60 ml-1"
          style={{ fontSize: "var(--score-game-count)" }}
        >
          {gamesWon}
        </span>
      </div>
    </div>
  );
}

function CentrePanel({
  state,
  matchName,
  isTimeout,
  timeoutSide,
  isDoubles,
  serverLabel,
  receiverLabel,
}: {
  state: BadmintonMatchState;
  matchName: string;
  isTimeout: boolean;
  timeoutSide?: string;
  isDoubles?: boolean;
  serverLabel?: string | null;
  receiverLabel?: string | null;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center"
      style={{ gap: "var(--score-panel-gap)", minWidth: "min(28vw, 320px)" }}
    >
      <p
        className="text-white font-bold uppercase tracking-[0.12em] text-center leading-tight max-w-[min(32vw,420px)]"
        style={{ fontSize: "calc(var(--score-player-meta) * 1.35)" }}
      >
        {matchName}
      </p>

      {!isDoubles && (
        <div className="flex items-center" style={{ gap: "calc(var(--score-panel-gap) * 0.85)" }}>
          <div
            className="rotate-45"
            style={{
              width: "var(--score-serve-diamond)",
              height: "var(--score-serve-diamond)",
              ...fixedServeStyle(state.servingSide === "left"),
            }}
          />
          <span
            className="text-white/30 uppercase tracking-widest font-semibold"
            style={{ fontSize: "var(--score-player-meta)" }}
          >
            vs
          </span>
          <div
            className="rotate-45"
            style={{
              width: "var(--score-serve-diamond)",
              height: "var(--score-serve-diamond)",
              ...fixedServeStyle(state.servingSide === "right"),
            }}
          />
        </div>
      )}

      {isDoubles && serverLabel && (
        <div
          className="flex flex-col items-center gap-1"
          style={{ fontSize: "var(--score-player-meta)" }}
        >
          <div className="flex items-center gap-2">
            <span className="text-[#ffd700]">🟡</span>
            <span className="text-white/50">Serving:</span>
            <span className="font-bold text-[#ffd700]">{serverLabel}</span>
          </div>
          {receiverLabel && (
            <div className="flex items-center gap-2">
              <span className="text-[#ffc400]">👁</span>
              <span className="text-white/50">Receiving:</span>
              <span className="font-bold text-[#ffc400]">{receiverLabel}</span>
            </div>
          )}
        </div>
      )}

      {isDoubles && state.doublesServe && (
        <DoublesCourtDisplay state={state} variant="mini" className="max-w-[min(220px,22vw)]" />
      )}

      {/* Main scores — large */}
      <div className="flex items-center" style={{ gap: "calc(var(--score-panel-gap) * 1.1)" }}>
        <ScoreDigit
          score={state.leftScore}
          active={state.matchStatus === "live"}
        />
        <div
          className="text-white/20 font-thin leading-none"
          style={{ fontSize: "var(--score-colon-size)" }}
        >
          :
        </div>
        <ScoreDigit
          score={state.rightScore}
          active={state.matchStatus === "live"}
        />
      </div>

      {/* Game indicator */}
      <div
        className="bg-white/5 border border-white/10 rounded-full"
        style={{ padding: "calc(var(--score-game-pill) * 0.45) calc(var(--score-game-pill) * 1.6)" }}
      >
        <span
          className="text-white/60 font-semibold"
          style={{ fontSize: "var(--score-game-pill)" }}
        >
          Game {state.currentGame}
        </span>
      </div>

      {/* Deuce indicator */}
      {state.leftScore >= state.format.deuceAt && state.rightScore >= state.format.deuceAt && (
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-1">
          <span className="text-amber-300 text-xs font-black tracking-widest">DEUCE</span>
        </div>
      )}

      {/* Interval indicator */}
      {state.inInterval && (
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-full px-3 py-1">
          <span className="text-blue-300 text-xs font-black tracking-widest">INTERVAL</span>
        </div>
      )}
    </div>
  );
}

function ScoreDigit({ score, active }: { score: number; active: boolean }) {
  return (
    <div
      className="badminton-score-digit font-black leading-none tabular-nums tracking-tighter transition-all duration-200"
      style={fixedScoreStyle(active)}
    >
      {score}
    </div>
  );
}

function GameWinOverlay({
  side,
  player,
  score,
}: {
  side: "left" | "right";
  player: { label: string; countryName?: string };
  score: { winner: number; loser: number };
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl px-16 py-8 text-center",
          "animate-[fadeInScale_0.4s_ease-out_forwards]",
          side === "left"
            ? "bg-gradient-to-br from-[#ffc400]/80 to-[#ffc400]/40 border border-[#ffc400]/40"
            : "bg-gradient-to-br from-[#7c3aed]/80 to-[#ff6b6b]/40 border border-[#ff6b6b]/40",
          "shadow-2xl backdrop-blur-xl",
        )}
      >
        <p className="text-white/60 text-sm font-bold uppercase tracking-[0.3em] mb-2">Game Won</p>
        <h2 className="text-4xl font-black text-white mb-3">{player.label}</h2>
        <div className="text-5xl font-black" style={fixedScoreStyle()}>
          {score.winner} – {score.loser}
        </div>
        {player.countryName && (
          <p className="text-white/50 text-sm mt-2 uppercase tracking-widest">{player.countryName}</p>
        )}
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
}: {
  side: "left" | "right";
  player: { label: string; countryName?: string; photoUrl?: string };
  gamesLeft: number;
  gamesRight: number;
  games: BadmintonMatchState["games"];
}) {
  const completedGames = games.filter((g) => g.phase === "completed");

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/70 backdrop-blur-sm">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl px-20 py-12 text-center max-w-2xl w-full border shadow-2xl",
          side === "left"
            ? "bg-gradient-to-br from-[#051533] to-[#0a2060] border-[#ffc400]/30"
            : "bg-gradient-to-br from-[#180523] to-[#330a4a] border-[#ff6b6b]/30",
        )}
      >
        {/* Trophy animation */}
        <div className="text-7xl mb-4 animate-bounce">🏆</div>

        <p className="text-white/50 text-xs font-bold uppercase tracking-[0.4em] mb-4">Match Winner</p>

        {player.photoUrl && (
          <img
            src={player.photoUrl}
            alt={player.label}
            className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-[#ffd700]"
          />
        )}

        <h1 className="text-5xl font-black text-white mb-2 leading-tight">{player.label}</h1>

        {player.countryName && (
          <p className={cn(
            "text-lg font-bold uppercase tracking-[0.2em] mb-6",
            side === "left" ? "text-[#ffc400]" : "text-[#ce93d8]",
          )}>
            {player.countryName}
          </p>
        )}

        {/* Games score */}
        <div className="bg-white/5 rounded-2xl px-8 py-4 mb-6 inline-block">
          <span className="text-5xl font-black" style={fixedScoreStyle(side === "left")}>
            {gamesLeft}
          </span>
          <span className="text-white/30 text-3xl mx-3">–</span>
          <span
            className="text-5xl font-black"
            style={fixedScoreStyle(side === "right")}
          >
            {gamesRight}
          </span>
        </div>

        {/* Individual game scores */}
        <div className="flex items-center justify-center gap-3">
          {completedGames.map((g) => (
            <div key={g.gameNumber} className="bg-white/8 rounded-lg px-3 py-2">
              <span className="text-white/40 text-xs block text-center mb-1">G{g.gameNumber}</span>
              <span className="font-bold text-white text-sm">
                {g.leftScore}–{g.rightScore}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
