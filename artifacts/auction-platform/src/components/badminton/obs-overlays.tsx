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

type OverlayType = "compact" | "full" | "intro" | "winner" | "sponsor";

interface OverlayProps {
  type: OverlayType;
  state: BadmintonMatchState;
  tournamentName?: string;
  tournamentLogoUrl?: string;
  courtNumber?: string;
  matchLabel?: string;
  roundName?: string;
  sponsorLogos?: string[];
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
}: OverlayProps) {
  switch (type) {
    case "compact":
      return (
        <CompactOverlay
          state={state}
          courtNumber={courtNumber}
          matchLabel={matchLabel}
        />
      );
    case "full":
      return (
        <FullOverlay
          state={state}
          tournamentName={tournamentName}
          logoUrl={tournamentLogoUrl}
          courtNumber={courtNumber}
          roundName={roundName}
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
}: {
  state: BadmintonMatchState;
  courtNumber?: string;
  matchLabel?: string;
}) {
  const isLive = state.matchStatus === "live";
  const isDoubles = isPairMatchKind(state.matchKind);
  const serverLabel = isDoubles ? currentServerLabel(state) : null;
  const receiverLabel = isDoubles ? currentReceiverLabel(state) : null;

  return (
    <div className="inline-flex flex-col gap-2">
      <DirectorStatusBanner state={state} />
      <div
      className="inline-flex items-stretch rounded-xl overflow-hidden shadow-2xl"
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      {/* Left side */}
      <div className="flex items-center gap-3 bg-[#0a1628]/95 px-4 py-3 min-w-[200px]">
        {(!isDoubles && state.servingSide === "left") && (
          <div className="w-2 h-2 rounded-full bg-[#ffd700] flex-none animate-pulse" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-base leading-tight truncate">
            {state.leftSide.shortLabel}
          </p>
          {state.leftSide.countryCode && (
            <p className="text-[#4fc3f7] text-[10px] font-semibold uppercase tracking-widest">
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
                i < state.gamesLeft ? "bg-[#00e5ff]" : "bg-white/15",
              )}
            />
          ))}
        </div>
        <div className="text-[#00e5ff] text-4xl font-black leading-none tabular-nums w-10 text-center">
          {state.leftScore}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center justify-center bg-[#131f3a]/95 px-3">
        <div className="flex flex-col items-center gap-1">
          {isLive && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400 text-[9px] font-black tracking-widest">LIVE</span>
            </div>
          )}
          <span className="text-white/30 text-xs font-light">G{state.currentGame}</span>
          {isDoubles && serverLabel && (
            <span className="text-[#ffd700] text-[8px] font-bold truncate max-w-[80px]">🟡 {serverLabel}</span>
          )}
          {isDoubles && receiverLabel && (
            <span className="text-[#4fc3f7] text-[8px] font-bold truncate max-w-[80px]">👁 {receiverLabel}</span>
          )}
          {courtNumber && (
            <span className="text-white/20 text-[9px] font-medium">C{courtNumber}</span>
          )}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3 bg-[#1a0828]/95 px-4 py-3 min-w-[200px] flex-row-reverse">
        {(!isDoubles && state.servingSide === "right") && (
          <div className="w-2 h-2 rounded-full bg-[#ffd700] flex-none animate-pulse" />
        )}
        <div className="flex-1 min-w-0 text-right">
          <p className="text-white font-black text-base leading-tight truncate">
            {state.rightSide.shortLabel}
          </p>
          {state.rightSide.countryCode && (
            <p className="text-[#ce93d8] text-[10px] font-semibold uppercase tracking-widest">
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
                i < state.gamesRight ? "bg-[#ff6b6b]" : "bg-white/15",
              )}
            />
          ))}
        </div>
        <div className="text-[#ff6b6b] text-4xl font-black leading-none tabular-nums w-10 text-center">
          {state.rightScore}
        </div>
      </div>
    </div>
    </div>
  );
}

// ── Full Overlay — complete match panel ────────────────────────────────────────

function FullOverlay({
  state,
  tournamentName,
  logoUrl,
  courtNumber,
  roundName,
}: {
  state: BadmintonMatchState;
  tournamentName?: string;
  logoUrl?: string;
  courtNumber?: string;
  roundName?: string;
}) {
  const completedGames = state.games.filter((g) => g.phase === "completed");

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-2xl w-[520px]"
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      {/* Header */}
      <div className="bg-[#0d1529]/95 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="logo" className="h-6 w-auto" />
          ) : (
            <div className="w-5 h-5 rounded bg-white/20" />
          )}
          <span className="text-white/70 text-xs font-semibold uppercase tracking-widest">
            {tournamentName ?? "Badminton"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {roundName && (
            <span className="text-white/40 text-[10px]">{roundName}</span>
          )}
          {courtNumber && (
            <span className="bg-white/10 text-white/60 text-[10px] font-bold px-2 py-0.5 rounded">
              Court {courtNumber}
            </span>
          )}
          {state.matchStatus === "live" && (
            <div className="flex items-center gap-1 bg-red-600/80 rounded px-1.5 py-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span className="text-white text-[9px] font-black tracking-wider">LIVE</span>
            </div>
          )}
        </div>
      </div>

      {/* Player rows */}
      <div className="bg-[#0a1020]/92">
        {/* Left */}
        <FullOverlayRow
          side="left"
          label={state.leftSide.label}
          shortLabel={state.leftSide.shortLabel}
          countryCode={state.leftSide.countryCode}
          countryName={state.leftSide.countryName}
          score={state.leftScore}
          gamesWon={state.gamesLeft}
          isServing={state.servingSide === "left"}
          isWinner={state.winnerSide === "left"}
          format={state.format}
          completedGames={completedGames.map((g) => ({ score: g.leftScore, won: g.winner === "left" }))}
        />

        <div className="h-px bg-white/5" />

        {/* Right */}
        <FullOverlayRow
          side="right"
          label={state.rightSide.label}
          shortLabel={state.rightSide.shortLabel}
          countryCode={state.rightSide.countryCode}
          countryName={state.rightSide.countryName}
          score={state.rightScore}
          gamesWon={state.gamesRight}
          isServing={state.servingSide === "right"}
          isWinner={state.winnerSide === "right"}
          format={state.format}
          completedGames={completedGames.map((g) => ({ score: g.rightScore, won: g.winner === "right" }))}
        />
      </div>

    </div>
  );
}

function FullOverlayRow({
  side,
  label,
  countryCode,
  countryName,
  score,
  gamesWon,
  isServing,
  isWinner,
  format,
  completedGames,
}: {
  side: "left" | "right";
  label: string;
  shortLabel: string;
  countryCode?: string;
  countryName?: string;
  score: number;
  gamesWon: number;
  isServing: boolean;
  isWinner: boolean;
  format: { totalGames: number };
  completedGames: Array<{ score: number; won: boolean }>;
}) {
  const isLeft = side === "left";

  return (
    <div className="flex items-center px-4 py-3 gap-3">
      {/* Serve pip */}
      <div className="w-3 flex-none">
        {isServing && (
          <div className="w-2 h-2 rounded-full bg-[#ffd700] animate-pulse mx-auto" />
        )}
      </div>

      {/* Name + country */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-black text-sm leading-tight truncate">{label}</p>
        {countryName && (
          <p className={cn(
            "text-[10px] font-semibold uppercase tracking-wider",
            isLeft ? "text-[#4fc3f7]/70" : "text-[#ce93d8]/70",
          )}>
            {countryCode ?? countryName}
          </p>
        )}
      </div>

      {/* Per-game scores */}
      <div className="flex items-center gap-1.5">
        {completedGames.map((g, i) => (
          <div
            key={i}
            className={cn(
              "text-xs font-bold w-7 h-7 rounded flex items-center justify-center",
              g.won
                ? isLeft
                  ? "bg-[#00e5ff]/20 text-[#00e5ff]"
                  : "bg-[#ff6b6b]/20 text-[#ff6b6b]"
                : "bg-white/5 text-white/30",
            )}
          >
            {g.score}
          </div>
        ))}
      </div>

      {/* Games won */}
      <div className="flex items-center gap-0.5">
        {Array.from({ length: format.totalGames }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "w-2 h-2 rounded-full",
              i < gamesWon
                ? isLeft ? "bg-[#00e5ff]" : "bg-[#ff6b6b]"
                : "bg-white/10",
            )}
          />
        ))}
      </div>

      {/* Current game score */}
      <div className={cn(
        "text-3xl font-black tabular-nums w-10 text-center leading-none",
        isLeft ? "text-[#00e5ff]" : "text-[#ff6b6b]",
        isWinner && "text-[#ffd700]",
      )}>
        {score}
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
        isLeft ? "border-[#00e5ff]/20" : "border-[#ff6b6b]/20",
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
          <span className={cn("text-4xl font-black", isLeft ? "text-[#00e5ff]" : "text-[#ff6b6b]")}>
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
  sponsorLogos: string[];
  tournamentName?: string;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden bg-[#0a1020]/90 border border-white/10 px-6 py-4 flex items-center gap-6 shadow-2xl"
      style={{ fontFamily: "'Inter', 'system-ui', sans-serif" }}
    >
      {tournamentName && (
        <span className="text-white/40 text-xs font-bold uppercase tracking-widest whitespace-nowrap">
          Supported by
        </span>
      )}
      {sponsorLogos.map((logo, i) => (
        <img
          key={i}
          src={logo}
          alt={`Sponsor ${i + 1}`}
          className="h-10 w-auto object-contain opacity-80"
        />
      ))}
    </div>
  );
}
