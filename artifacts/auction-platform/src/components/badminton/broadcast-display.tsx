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
import {
  ScoreBoardSponsorPanel,
  type ScoreBoardSponsor,
  hasScoreBoardSponsor,
} from "@/components/badminton/score-board-sponsor-panel";
import { cn } from "@/lib/utils";
import { DirectorStatusBanner } from "@/components/badminton/director-status-banner";

interface BroadcastDisplayProps {
  state: BadmintonMatchState;
  tournamentName?: string;
  tournamentLogoUrl?: string;
  courtNumber?: string;
  matchNumber?: string;
  roundName?: string;
  sponsorLogos?: string[];
  scoreBoardSponsor?: ScoreBoardSponsor | null;
}

export function BroadcastDisplay({
  state,
  tournamentName = "Badminton Tournament",
  tournamentLogoUrl,
  courtNumber,
  matchNumber,
  roundName,
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

  const isLive = state.matchStatus === "live";
  const isTimeout = !!state.activeTimeout;
  const isDoubles = isPairMatchKind(state.matchKind);
  const serverLabel = isDoubles ? currentServerLabel(state) : null;
  const receiverLabel = isDoubles ? currentReceiverLabel(state) : null;
  const showScoreBoardSponsor = hasScoreBoardSponsor(scoreBoardSponsor) && scoreBoardSponsor;

  return (
    <div className="relative w-full h-full bg-[#050a17] overflow-hidden font-sans">
      {/* Animated background grid */}
      <div className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "60px 60px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#0070f3]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-[#7c3aed]/10 rounded-full blur-3xl pointer-events-none" />

      {/* TOP BAR — Tournament info + scoreboard sponsor (top-right) */}
      <TopBar
        tournamentName={tournamentName}
        logoUrl={tournamentLogoUrl}
        courtNumber={courtNumber}
        matchNumber={matchNumber}
        roundName={roundName}
        matchStatus={state.matchStatus}
        isTimeout={isTimeout}
        timeoutSide={state.activeTimeout?.side}
        leftSide={state.leftSide}
        rightSide={state.rightSide}
        scoreBoardSponsor={scoreBoardSponsor}
      />

      {/* Director status banner (paused, retired, etc.) */}
      <div className="absolute top-[72px] left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4">
        <DirectorStatusBanner state={state} />
      </div>

      {/* MAIN SCORE AREA */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-between px-[5%] pb-[100px]",
          showScoreBoardSponsor ? "pt-[132px]" : "pt-[80px]",
        )}
      >
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

      {/* BOTTOM BAR — sponsor logos + game history */}
      <BottomBar
        games={state.games}
        sponsorLogos={sponsorLogos}
        tournamentName={tournamentName}
      />

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

function TopBar({
  tournamentName,
  logoUrl,
  courtNumber,
  matchNumber,
  roundName,
  matchStatus,
  isTimeout,
  timeoutSide,
  leftSide,
  rightSide,
  scoreBoardSponsor,
}: {
  tournamentName: string;
  logoUrl?: string;
  courtNumber?: string;
  matchNumber?: string;
  roundName?: string;
  matchStatus: string;
  isTimeout: boolean;
  timeoutSide?: string;
  leftSide: { shortLabel: string };
  rightSide: { shortLabel: string };
  scoreBoardSponsor?: ScoreBoardSponsor | null;
}) {
  const showScoreBoardSponsor = hasScoreBoardSponsor(scoreBoardSponsor) && scoreBoardSponsor;

  return (
    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
      {showScoreBoardSponsor && (
        <div className="px-6 pt-3 flex justify-end">
          <ScoreBoardSponsorPanel
            sponsor={scoreBoardSponsor}
            variant="bar"
            className="max-w-[360px]"
          />
        </div>
      )}

      <div
        className={cn(
          "flex items-center justify-between px-6",
          showScoreBoardSponsor ? "h-[56px]" : "h-[72px]",
        )}
      >
      {/* Left — tournament branding */}
      <div className="flex items-center gap-3">
        {logoUrl ? (
          <img src={logoUrl} alt="logo" className="h-10 w-auto object-contain" />
        ) : (
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white/60">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2a10 10 0 110 20A10 10 0 0112 2z" fillRule="evenodd" clipRule="evenodd" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
        )}
        <div>
          <p className="text-white font-bold text-sm leading-tight">{tournamentName}</p>
          <p className="text-white/40 text-[11px]">{roundName ?? "Badminton"}</p>
        </div>
      </div>

      {/* Centre — status */}
      <div className="flex items-center gap-4">
        {courtNumber && (
          <div className="bg-white/8 rounded-lg px-3 py-1.5">
            <p className="text-white/40 text-[10px] uppercase tracking-widest text-center">Court</p>
            <p className="text-white font-black text-lg leading-none text-center">{courtNumber}</p>
          </div>
        )}
        {matchNumber && (
          <div className="bg-white/8 rounded-lg px-3 py-1.5">
            <p className="text-white/40 text-[10px] uppercase tracking-widest text-center">Match</p>
            <p className="text-white font-black text-lg leading-none text-center">{matchNumber}</p>
          </div>
        )}
        {isTimeout && (
          <div className="bg-amber-500/20 border border-amber-500/40 rounded-full px-4 py-1.5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-300 text-sm font-bold">
              TIMEOUT — {timeoutSide === "left" ? leftSide.shortLabel : rightSide.shortLabel}
            </span>
          </div>
        )}
      </div>

      {/* Right — live indicator */}
      <div className="flex items-center gap-2">
        {matchStatus === "live" && !isTimeout && (
          <div className="bg-red-600 rounded-full px-3 py-1 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-white text-xs font-black tracking-wider">LIVE</span>
          </div>
        )}
        {matchStatus === "completed" && (
          <div className="bg-green-600/30 border border-green-500/40 rounded-full px-3 py-1">
            <span className="text-green-300 text-xs font-black">FINAL</span>
          </div>
        )}
      </div>
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
        "flex flex-col items-center gap-4 w-[35%]",
        isLeft ? "items-start" : "items-end",
      )}
    >
      <div className="relative">
        <SidePlayerPhotos
          info={info}
          matchKind={matchKind}
          side={side}
          size="lg"
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
              className="h-6 w-6 object-contain"
            />
          )}
          {!franchiseLogoUrl && info.flagUrl && (
            <img
              src={info.flagUrl}
              alt={info.countryCode}
              loading="lazy"
              decoding="async"
              className="h-5 w-auto rounded-sm"
            />
          )}
          {info.sponsorLogoUrl && (
            <img
              src={info.sponsorLogoUrl}
              alt={info.sponsorName ?? "Sponsor"}
              loading="lazy"
              decoding="async"
              className="h-5 w-auto object-contain opacity-80"
            />
          )}
        </div>
        <SidePlayerNames
          info={info}
          matchKind={matchKind}
          side={side}
          stacked
        />
        {franchiseName && (
          <p className={cn(
            "text-[10px] font-semibold uppercase tracking-[0.1em] text-white/40",
          )}>
            Franchise: {franchiseName}
          </p>
        )}
        {info.countryName && (
          <p className={cn(
            "text-sm font-bold uppercase tracking-[0.15em]",
            isLeft ? "text-[#4fc3f7]" : "text-[#ce93d8]",
          )}>
            {info.countryName}
          </p>
        )}
      </div>

      {/* Games won indicator */}
      <div className={cn("flex items-center gap-2", !isLeft && "flex-row-reverse")}>
        {Array.from({ length: format.totalGames }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-4 h-4 rounded-full border-2 transition-all duration-500",
              i < gamesWon
                ? isLeft
                  ? "bg-[#00e5ff] border-[#00e5ff] shadow-md shadow-[#00e5ff]/40"
                  : "bg-[#ff6b6b] border-[#ff6b6b] shadow-md shadow-[#ff6b6b]/40"
                : "bg-transparent border-white/20",
              gameWinFlash && i === gamesWon - 1 && "scale-150 animate-pulse",
            )}
          />
        ))}
        <span className="text-lg font-black text-white/60 ml-1">{gamesWon}</span>
      </div>
    </div>
  );
}

function CentrePanel({
  state,
  isTimeout,
  timeoutSide,
  isDoubles,
  serverLabel,
  receiverLabel,
}: {
  state: BadmintonMatchState;
  isTimeout: boolean;
  timeoutSide?: string;
  isDoubles?: boolean;
  serverLabel?: string | null;
  receiverLabel?: string | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 min-w-[200px]">
      {!isDoubles && (
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-3 h-3 rotate-45",
            state.servingSide === "left"
              ? "bg-[#ffd700] shadow-md shadow-[#ffd700]/60"
              : "bg-white/10",
          )} />
          <span className="text-white/30 text-xs uppercase tracking-widest font-semibold">vs</span>
          <div className={cn(
            "w-3 h-3 rotate-45",
            state.servingSide === "right"
              ? "bg-[#ffd700] shadow-md shadow-[#ffd700]/60"
              : "bg-white/10",
          )} />
        </div>
      )}

      {isDoubles && serverLabel && (
        <div className="flex flex-col items-center gap-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-[#ffd700]">🟡</span>
            <span className="text-white/50">Serving:</span>
            <span className="font-bold text-[#ffd700]">{serverLabel}</span>
          </div>
          {receiverLabel && (
            <div className="flex items-center gap-2">
              <span className="text-[#4fc3f7]">👁</span>
              <span className="text-white/50">Receiving:</span>
              <span className="font-bold text-[#4fc3f7]">{receiverLabel}</span>
            </div>
          )}
        </div>
      )}

      {isDoubles && state.doublesServe && (
        <DoublesCourtDisplay state={state} variant="mini" className="max-w-[180px]" />
      )}

      {/* Main scores — large */}
      <div className="flex items-center gap-4">
        <ScoreDigit
          score={state.leftScore}
          side="left"
          active={state.matchStatus === "live"}
        />
        <div className="text-white/20 text-4xl font-thin">:</div>
        <ScoreDigit
          score={state.rightScore}
          side="right"
          active={state.matchStatus === "live"}
        />
      </div>

      {/* Game indicator */}
      <div className="bg-white/5 border border-white/10 rounded-full px-4 py-1.5">
        <span className="text-white/60 text-xs font-semibold">
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

function ScoreDigit({ score, side, active }: { score: number; side: "left" | "right"; active: boolean }) {
  return (
    <div
      className={cn(
        "text-[100px] font-black leading-none tabular-nums tracking-tighter",
        "transition-all duration-200",
        side === "left"
          ? "text-[#00e5ff] drop-shadow-[0_0_30px_rgba(0,229,255,0.5)]"
          : "text-[#ff6b6b] drop-shadow-[0_0_30px_rgba(255,107,107,0.5)]",
        !active && "opacity-40",
      )}
    >
      {score}
    </div>
  );
}

function BottomBar({
  games,
  sponsorLogos,
  tournamentName,
}: {
  games: BadmintonMatchState["games"];
  sponsorLogos: string[];
  tournamentName: string;
}) {
  const completed = games.filter((g) => g.phase === "completed");

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[80px] bg-gradient-to-t from-black/70 to-transparent flex items-end pb-4 px-6 z-20">
      <div className="relative flex items-end justify-between w-full gap-4">
        {/* Game scores history */}
        <div className="flex items-center gap-3 flex-none max-w-[32%]">
          {completed.map((g) => (
            <div
              key={g.gameNumber}
              className="flex items-center gap-1.5 bg-white/8 border border-white/10 rounded-lg px-3 py-1.5"
            >
              <span className="text-xs text-white/40 font-medium">G{g.gameNumber}</span>
              <span className="font-black text-[#00e5ff] text-sm">{g.leftScore}</span>
              <span className="text-white/30 text-xs">–</span>
              <span className="font-black text-[#ff6b6b] text-sm">{g.rightScore}</span>
            </div>
          ))}
        </div>

        {/* Rotating sponsor logos + tournament label */}
        <div className="flex items-center gap-4 flex-none ml-auto">
          <div className="flex items-center gap-4">
            {sponsorLogos.map((logo, i) => (
              <img
                key={i}
                src={logo}
                alt="sponsor"
                className="h-8 w-auto object-contain opacity-70"
              />
            ))}
          </div>
          <div className="text-white/20 text-[10px] font-medium uppercase tracking-widest">
            {tournamentName}
          </div>
        </div>
      </div>
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
            ? "bg-gradient-to-br from-[#0070f3]/80 to-[#00e5ff]/40 border border-[#00e5ff]/40"
            : "bg-gradient-to-br from-[#7c3aed]/80 to-[#ff6b6b]/40 border border-[#ff6b6b]/40",
          "shadow-2xl backdrop-blur-xl",
        )}
      >
        <p className="text-white/60 text-sm font-bold uppercase tracking-[0.3em] mb-2">Game Won</p>
        <h2 className="text-4xl font-black text-white mb-3">{player.label}</h2>
        <div className={cn(
          "text-5xl font-black",
          side === "left" ? "text-[#00e5ff]" : "text-[#ff6b6b]",
        )}>
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
          "relative overflow-hidden rounded-3xl px-20 py-12 text-center max-w-2xl w-full",
          side === "left"
            ? "bg-gradient-to-br from-[#051533] to-[#0a2060]"
            : "bg-gradient-to-br from-[#180523] to-[#330a4a]",
          "border",
          side === "left" ? "border-[#00e5ff]/30" : "border-[#ff6b6b]/30",
          "shadow-2xl",
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
            side === "left" ? "text-[#4fc3f7]" : "text-[#ce93d8]",
          )}>
            {player.countryName}
          </p>
        )}

        {/* Games score */}
        <div className="bg-white/5 rounded-2xl px-8 py-4 mb-6 inline-block">
          <span className={cn(
            "text-5xl font-black",
            side === "left" ? "text-[#00e5ff]" : "text-[#ff6b6b]",
          )}>
            {gamesLeft}
          </span>
          <span className="text-white/30 text-3xl mx-3">–</span>
          <span className={cn(
            "text-5xl font-black",
            side === "right" ? "text-[#ff6b6b]" : "text-[#00e5ff] opacity-40",
          )}>
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
