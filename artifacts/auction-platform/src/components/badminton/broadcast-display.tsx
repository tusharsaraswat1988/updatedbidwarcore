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
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { resolveFranchiseLogoUrl, resolveFranchiseName, isPairMatchKind, currentReceiverLabel, currentServerLabel } from "@workspace/badminton-core";
import { SidePlayerPhotos } from "@/components/badminton/side-players";
import { DoublesCourtDisplay } from "@/components/badminton/doubles-court-display";
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
    `${formatTeamPlayerLine(identityFromSideInfo(state.leftSide, { preferShort: true }))} vs ${formatTeamPlayerLine(identityFromSideInfo(state.rightSide, { preferShort: true }))}`;

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
        leftLabel={formatTeamPlayerLine(identityFromSideInfo(state.leftSide, { preferShort: true }))}
        rightLabel={formatTeamPlayerLine(identityFromSideInfo(state.rightSide, { preferShort: true }))}
        scoreBoardSponsor={scoreBoardSponsor}
      />

      {/* MAIN SCORE AREA — unified horizontal composition: player ↔ score ↔ player */}
      <div className="badminton-score-stage relative z-10 min-h-0 flex bg-[#070708]">
        <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
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
    <div className="badminton-score-history px-[3%] flex items-center justify-center gap-2 border-t border-white/5 bg-black/30">
      <span
        className="bw-caption shrink-0 text-white/45"
        style={{ fontSize: "var(--score-player-meta)" }}
      >
        Completed Games
      </span>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {completed.map((g) => (
          <div
            key={g.gameNumber}
            className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded px-2.5 py-1"
          >
            <span
              className="bw-caption text-white/40"
              style={{ fontSize: "var(--score-player-meta)" }}
            >
              G{g.gameNumber}
            </span>
            <span className="bw-display-l text-[length:var(--score-game-count)]" style={fixedScoreStyle()}>{g.leftScore}</span>
            <span className="text-white/30 text-[length:var(--score-player-meta)]">–</span>
            <span className="bw-display-l text-[length:var(--score-game-count)]" style={fixedScoreStyle()}>{g.rightScore}</span>
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
  const identity = identityFromSideInfo(info);
  const isPair = isPairMatchKind(matchKind);

  /* Face inward toward score so L/R identity reads as one match unit */
  const towardScore = isLeft ? "end" : "start";

  return (
    <div
      className={cn(
        "badminton-score-side-panel flex flex-col shrink-0 min-w-0",
        towardScore === "end" ? "items-end" : "items-start",
      )}
    >
      {/* Single identity card — photo + name as one visual unit */}
      <div
        className={cn(
          "badminton-score-identity-card",
          isPair && "badminton-score-identity-card--pair",
          towardScore === "end" ? "items-end text-right" : "items-start text-left",
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
          {(isServing || servingPlayerLabel) && (
            <div
              className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-[#ffd700] rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(255,215,0,0.65)]"
              style={{ width: "1.6rem", height: "1.6rem", fontSize: "0.9rem" }}
              aria-label="Serving"
              title="Serving"
            >
              🏸
            </div>
          )}
        </div>

        <div
          className={cn(
            "badminton-score-identity-copy flex flex-col w-full min-w-0",
            towardScore === "end" ? "items-end" : "items-start",
          )}
        >
          <TeamPlayerCard
            identity={identity}
            size="md"
            tone="led"
            layout="stack"
            align={towardScore}
            showBadge={Boolean(franchiseName)}
            className="w-full max-w-full"
            playerClassName={cn(
              "badminton-score-player-name bw-heading",
              isPair && "badminton-score-player-name--pair",
            )}
            teamClassName="bw-label opacity-80 w-full max-w-full"
          />
          <div className={cn("flex items-center gap-1.5 mt-0.5", towardScore === "end" && "flex-row-reverse")}>
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
          {info.countryName && (
            <p
              className={cn(
                "bw-meta opacity-80 truncate w-full",
                isLeft ? "text-[#ffc400]" : "text-[#ce93d8]",
              )}
              style={{ fontSize: "var(--score-player-meta)" }}
            >
              {info.countryName}
            </p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "badminton-score-games-won badminton-score-games-won--glam flex items-center",
          towardScore === "end" && "flex-row-reverse",
        )}
        style={{
          ...(isLeft
            ? { "--gw-tint": "rgba(255, 215, 0, 0.16)", "--gw-border": "rgba(255, 215, 0, 0.35)" }
            : { "--gw-tint": "rgba(224, 176, 255, 0.16)", "--gw-border": "rgba(224, 176, 255, 0.35)" }) as CSSProperties,
        }}
      >
        <span className="badminton-score-games-won-label bw-caption whitespace-nowrap">
          Games
        </span>
        <div className="flex items-center" style={{ gap: "calc(var(--score-panel-gap) * 0.5)" }}>
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
                ...fixedGameDotStyle(i < gamesWon, side),
              }}
            />
          ))}
        </div>
        <span
          className="bw-meta"
          style={{
            fontSize: "var(--score-game-count)",
            color: isLeft ? "#ffd700" : "#e0b0ff",
            textShadow: isLeft
              ? "0 0 10px rgba(255,215,0,0.55)"
              : "0 0 10px rgba(224,176,255,0.5)",
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
    <div className="badminton-score-centre flex flex-col items-center min-w-0">
      {/* P1 — Current score (breathing room preserved below digits) */}
      <div
        className="badminton-score-centre-score flex items-center justify-center"
        style={{ gap: "calc(var(--score-panel-gap) * 0.75)" }}
      >
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

      {/* P3 — Game number (anchored to score) */}
      <div
        className="bg-white/5 border border-white/10 rounded-full"
        style={{ padding: "calc(var(--score-game-pill) * 0.35) calc(var(--score-game-pill) * 1.4)" }}
      >
        <span
          className="bw-heading text-white/70"
          style={{ fontSize: "var(--score-game-pill)" }}
        >
          Game {state.currentGame}
        </span>
      </div>

      {/* P4 — Serving indicator (shuttlecock) */}
      {!isDoubles && (
        <div className="flex items-center" style={{ gap: "calc(var(--score-panel-gap) * 0.7)" }}>
          <span
            className="transition-all duration-300 leading-none"
            style={{
              fontSize: "var(--score-serve-diamond)",
              opacity: state.servingSide === "left" ? 1 : 0.22,
              transform: state.servingSide === "left" ? "scale(1.2)" : "scale(0.85)",
              filter:
                state.servingSide === "left"
                  ? "drop-shadow(0 0 8px rgba(255,215,0,0.65))"
                  : "none",
            }}
            aria-hidden
          >
            🏸
          </span>
          <span
            className="bw-label text-white/30"
            style={{ fontSize: "var(--score-player-meta)" }}
          >
            Serving
          </span>
          <span
            className="transition-all duration-300 leading-none"
            style={{
              fontSize: "var(--score-serve-diamond)",
              opacity: state.servingSide === "right" ? 1 : 0.22,
              transform: state.servingSide === "right" ? "scale(1.2)" : "scale(0.85)",
              filter:
                state.servingSide === "right"
                  ? "drop-shadow(0 0 8px rgba(255,215,0,0.65))"
                  : "none",
            }}
            aria-hidden
          >
            🏸
          </span>
        </div>
      )}

      {isDoubles && serverLabel && (
        <div
          className="flex flex-col items-center gap-0.5"
          style={{ fontSize: "var(--score-player-meta)" }}
        >
          <div className="flex items-center gap-2">
            <span aria-hidden>🏸</span>
            <span className="bw-label text-white/50">Serving:</span>
            <span className="bw-meta text-[#ffd700]">{serverLabel}</span>
          </div>
          {receiverLabel && (
            <div className="flex items-center gap-2">
              <span className="text-[#ffc400]">👁</span>
              <span className="bw-label text-white/50">Receiving:</span>
              <span className="bw-meta text-[#ffc400]">{receiverLabel}</span>
            </div>
          )}
        </div>
      )}

      {isDoubles && state.doublesServe && (
        <DoublesCourtDisplay state={state} variant="mini" className="max-w-[min(215px,21vw)]" />
      )}

      <p
        className="bw-caption text-white/55 text-center max-w-[min(36vw,480px)]"
        style={{ fontSize: "var(--score-player-meta)" }}
      >
        {matchName}
      </p>

      {state.leftScore >= state.format.deuceAt && state.rightScore >= state.format.deuceAt && (
        <div className="bg-amber-500/20 border border-amber-500/30 rounded-full px-3.5 py-1">
          <span className="bw-label text-amber-300 text-sm">DEUCE</span>
        </div>
      )}

      {state.inInterval && (
        <div className="bg-blue-500/20 border border-blue-500/30 rounded-full px-3.5 py-1">
          <span className="bw-label text-blue-300 text-sm">INTERVAL</span>
        </div>
      )}
    </div>
  );
}

function ScoreDigit({ score, active }: { score: number; active: boolean }) {
  return (
    <div
      className="badminton-score-digit bw-display-xl font-black leading-none tabular-nums tracking-tighter transition-all duration-200"
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
  player: BadmintonMatchState["leftSide"];
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
        <p className="bw-label text-white/60 text-sm mb-2">Game Won</p>
        <div className="mb-3 flex justify-center">
          <TeamPlayerCard
            identity={identityFromSideInfo(player)}
            size="lg"
            tone="led"
            align="center"
            playerClassName="bw-heading text-4xl text-white"
            teamClassName="bw-label text-white/70"
          />
        </div>
        <div className="bw-display-l text-5xl" style={fixedScoreStyle()}>
          {score.winner} – {score.loser}
        </div>
        {player.countryName && (
          <p className="bw-caption text-white/50 text-sm mt-2">{player.countryName}</p>
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
  player: BadmintonMatchState["leftSide"];
  gamesLeft: number;
  gamesRight: number;
  games: BadmintonMatchState["games"];
}) {
  const completedGames = games.filter((g) => g.phase === "completed");
  const identity = identityFromSideInfo(player);

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

        <p className="bw-label text-white/50 text-xs mb-4">Match Winner</p>

        {player.photoUrl && (
          <img
            src={player.photoUrl}
            alt={identity.playerName}
            className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-4 border-[#ffd700]"
          />
        )}

        <div className="mb-2 flex justify-center">
          <TeamPlayerCard
            identity={identity}
            size="xl"
            tone="led"
            align="center"
            playerClassName="bw-heading text-5xl text-white leading-tight"
            teamClassName="bw-label text-white/70"
          />
        </div>

        {player.countryName && (
          <p className={cn(
            "bw-meta text-lg mb-6",
            side === "left" ? "text-[#ffc400]" : "text-[#ce93d8]",
          )}>
            {player.countryName}
          </p>
        )}

        {/* Games score */}
        <div className="bg-white/5 rounded-2xl px-8 py-4 mb-6 inline-block">
          <span className="bw-display-l text-5xl" style={fixedScoreStyle(side === "left")}>
            {gamesLeft}
          </span>
          <span className="text-white/30 text-3xl mx-3">–</span>
          <span
            className="bw-display-l text-5xl"
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
