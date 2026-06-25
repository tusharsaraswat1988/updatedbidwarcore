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
 */

import type { BadmintonMatchState } from "@workspace/badminton-core";
import { useEffect, useRef, useState } from "react";
import {
  resolveFranchiseLogoUrl,
  resolveFranchiseName,
  isPairMatchKind,
  currentReceiverLabel,
  currentServerLabel,
} from "@workspace/badminton-core";
import { SidePlayerNames, SidePlayerPhotos } from "@/components/badminton/side-players";
import { DirectorStatusBanner } from "@/components/badminton/director-status-banner";
import { cn } from "@/lib/utils";
import { SponsorCarousel } from "@/components/display/sponsor-carousel";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
  BIDWAR_BROADCAST_YELLOW_MUTED,
  BIDWAR_BROADCAST_YELLOW_SOFT,
} from "@/lib/bidwar-broadcast-colors";

type OverlayType = "compact" | "full" | "intro" | "winner" | "sponsor";

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

function overlayServeSideShellClass(isServing: boolean, isFlash: boolean) {
  return cn(
    "relative transition-[background-color,box-shadow,border-color] duration-500 ease-out",
    isServing && !isFlash && "badminton-serve-side--active border-2 border-[#ffd700]/45",
    isFlash && "badminton-serve-side--flash border-2 border-[#ffd700]/70",
    !isServing && "border-2 border-transparent bg-white/[0.015]",
  );
}

/** OBS-safe anchor positions per overlay variant. */
export function overlayPlacementClass(type: OverlayType, _withBottomTicker = false): string {
  switch (type) {
    case "full":
      return "bottom-0 left-0 right-0 w-full";
    case "compact":
      return "bottom-[5vh] left-1/2 -translate-x-1/2 max-w-[min(960px,96vw)]";
    case "intro":
    case "winner":
      return "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2";
    case "sponsor":
      return "bottom-[6vh] left-1/2 -translate-x-1/2";
    default:
      return "bottom-[5vh] left-1/2 -translate-x-1/2";
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
      return <SponsorOverlay sponsorLogos={sponsorLogos} tournamentName={tournamentName} />;
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

// ── Compact Overlay — lower-third score bar ───────────────────────────────────

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
  const displayMatchName =
    matchLabel?.trim() ||
    `${state.leftSide.label} vs ${state.rightSide.label}`;
  const flashSide = useServeSideFlash(state.servingSide);

  return (
    <div
      className="inline-flex flex-col gap-2 w-full"
      style={{ fontFamily: "'Barlow Condensed', 'Inter', system-ui, sans-serif" }}
    >
      <DirectorStatusBanner state={state} />
      {matchLabel || displayMatchName ? (
        <p className="text-center text-white/70 text-xs font-semibold uppercase tracking-[0.18em] truncate px-2">
          {displayMatchName}
        </p>
      ) : null}
      <div className="inline-flex items-stretch rounded-xl overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.55)] border border-white/10 mx-auto max-w-full">
      {/* Left side */}
      <div
        className={cn(
          "flex items-center gap-3 bg-[#101013]/95 px-4 py-3 min-w-[180px]",
          overlayServeSideShellClass(
            state.servingSide === "left",
            flashSide === "left",
          ),
        )}
      >
        {(!isDoubles && state.servingSide === "left") && (
          <div className="w-2 h-2 rounded-full bg-[#ffd700] flex-none animate-pulse relative z-10" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-tight truncate">
            {state.leftSide.label}
          </p>
          {state.leftSide.countryCode && (
            <p className="text-white/45 text-[10px] font-semibold uppercase tracking-widest">
              {state.leftSide.countryCode}
            </p>
          )}
        </div>
        {/* Game dots */}
        <div className="flex flex-col gap-0.5">
          {Array.from({ length: state.format.totalGames }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                i < state.gamesLeft ? "bg-white" : "bg-white/15",
              )}
            />
          ))}
        </div>
        <div className="text-white text-4xl font-black leading-none tabular-nums w-10 text-center">
          {state.leftScore}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center bg-[#101013]/95 px-3 min-w-[72px]">
        <div className="flex flex-col items-center gap-1">
          {isLive && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-[9px] font-black tracking-widest">LIVE</span>
            </div>
          )}
          <span className="text-white/40 text-xs font-semibold">G{state.currentGame}</span>
          {isDoubles && serverLabel && (
            <span className="text-[#ffd700] text-[8px] font-bold truncate max-w-[80px]">🟡 {serverLabel}</span>
          )}
          {isDoubles && receiverLabel && (
            <span className="text-white/50 text-[8px] font-bold truncate max-w-[80px]">👁 {receiverLabel}</span>
          )}
          {courtNumber && (
            <span className="text-white/25 text-[9px] font-medium">Court {courtNumber}</span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div
        className={cn(
          "flex items-center gap-3 bg-[#101013]/95 px-4 py-3 min-w-[180px] flex-row-reverse",
          overlayServeSideShellClass(
            state.servingSide === "right",
            flashSide === "right",
          ),
        )}
      >
        {(!isDoubles && state.servingSide === "right") && (
          <div className="w-2 h-2 rounded-full bg-[#ffd700] flex-none animate-pulse relative z-10" />
        )}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-white font-black text-base leading-tight truncate">
            {state.rightSide.label}
          </p>
          {state.rightSide.countryCode && (
            <p className="text-white/45 text-[10px] font-semibold uppercase tracking-widest">
              {state.rightSide.countryCode}
            </p>
          )}
        </div>
        {/* Game dots */}
        <div className="flex flex-col gap-0.5">
          {Array.from({ length: state.format.totalGames }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                i < state.gamesRight ? "bg-white" : "bg-white/15",
              )}
            />
          ))}
        </div>
        <div className="text-white text-4xl font-black leading-none tabular-nums w-10 text-center">
          {state.rightScore}
        </div>
      </div>
    </div>
      {showPlatformCredit ? (
        <p className="text-center text-[9px] font-bold uppercase tracking-[0.22em] text-white/25 mt-1">
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

  return (
    <div
      className="w-full flex flex-col gap-2"
      style={{ fontFamily: "'Barlow Condensed', 'Inter', system-ui, sans-serif" }}
    >
      <DirectorStatusBanner state={state} />

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
            playerLabel={state.leftSide.label}
            score={state.leftScore}
            gamesWon={state.gamesLeft}
            isServing={state.servingSide === "left"}
            isServeFlash={flashSide === "left"}
            isWinner={state.winnerSide === "left"}
            format={state.format}
          />

          <div className="w-px bg-white/10 shrink-0" aria-hidden />

          <FullOverlaySide
            align="right"
            playerLabel={state.rightSide.label}
            score={state.rightScore}
            gamesWon={state.gamesRight}
            isServing={state.servingSide === "right"}
            isServeFlash={flashSide === "right"}
            isWinner={state.winnerSide === "right"}
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
  playerLabel,
  score,
  gamesWon,
  isServing,
  isServeFlash,
  isWinner,
  format,
}: {
  align: "left" | "right";
  playerLabel: string;
  score: number;
  gamesWon: number;
  isServing: boolean;
  isServeFlash: boolean;
  isWinner: boolean;
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

      <span
        className={cn(
          "font-black text-white text-sm sm:text-base min-w-0 flex-1 truncate",
          isRight ? "text-right" : "text-left",
        )}
        title={playerLabel}
      >
        {playerLabel}
      </span>

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

      <span
        className={cn(
          "text-2xl sm:text-3xl font-black tabular-nums leading-none text-white shrink-0",
          isWinner && "text-[#ffd700]",
        )}
      >
        {score}
      </span>
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
  const franchiseName = resolveFranchiseName(info);
  const franchiseLogoUrl = resolveFranchiseLogoUrl(info);

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
        <SidePlayerNames
          info={info}
          matchKind={matchKind}
          side={side}
          stacked
          className="text-base"
        />
        {franchiseName && (
          <p className="text-white/40 text-[10px] font-medium mt-0.5">Franchise: {franchiseName}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          {franchiseLogoUrl && (
            <img src={franchiseLogoUrl} alt="" loading="lazy" className="h-4 w-4 object-contain" />
          )}
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

  return (
    <div
      className={cn(
        "rounded-3xl overflow-hidden shadow-2xl w-[480px]",
        isLeft
          ? "bg-gradient-to-br from-[#0d1e4a]/95 to-[#0a3080]/90"
          : "bg-gradient-to-br from-[#1a052e]/95 to-[#3a0a5e]/90",
        "border",
        isLeft ? "border-[#ffc400]/20" : "border-[#ff6b6b]/20",
      )}
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      <div className="p-8 text-center">
        <div className="text-5xl mb-3">🏆</div>
        <p className="text-white/40 text-xs font-bold uppercase tracking-[0.4em] mb-2">
          {tournamentName ?? "Match Winner"}
        </p>

        {winner.photoUrl && (
          <img
            src={winner.photoUrl}
            alt={winner.label}
            className="w-20 h-20 rounded-full mx-auto mb-4 object-cover border-4 border-[#ffd700]/50"
          />
        )}

        <h2 className="text-3xl font-black text-white mb-1">{winner.label}</h2>

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
}: {
  sponsorLogos: SponsorLogo[];
  tournamentName?: string;
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
      <SponsorCarousel logos={sponsorLogos} />
    </div>
  );
}
