/**
 * Cricket OBS Master Scorebug (~140px: 104px Primary Strip + 36px Context Ribbon)
 * Professional linear sports television broadcast chyron.
 * 
 * Strict Hierarchy:
 * 1. SCORE (Dominant Bebas Neue numerals, team insignia & overs)
 * 2. BATTERS (Two clean, high-contrast player rows with geometric gold striker marker)
 * 3. BOWLER (Bowler figures, economy & 28px chamfered structural over-train tiles)
 * 4. ONE CONTEXTUAL METRIC (Single dominant situation metric: Partnership, Target, or Winner)
 * 
 * Structural Rail:
 * - 2px BidWar Gold top rule
 * - Deep Obsidian (#050508) & Carbon (#0C0D14) physical broadcast chassis
 * - Subtle vertical section dividers
 * - Zero emojis, zero circular balls, zero rainbow gradients, zero rounded-xl/2xl cards.
 */

import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
  BIDWAR_SCOREBOARD_INSET,
} from "@/lib/bidwar-broadcast-colors";
import { BROADCAST_OVERLAY_SAFE_INSET_X } from "@/lib/broadcast-overlay";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

export function CricketObsScorebug({ vm }: { vm: CricketObsViewModel }) {
  const batting = vm.batting;
  const bowling = vm.bowling;
  const striker = vm.striker;
  const nonStriker = vm.nonStriker;
  const bowler = vm.bowler;

  const isChase = vm.phase === "chase";
  const needRuns = vm.needRuns;
  const ballsLeft = vm.ballsRemaining;

  const partnershipRuns = vm.partnershipRuns;
  const partnershipBalls = vm.partnershipBalls;

  const isTargetReached =
    vm.target != null && vm.runs >= vm.target && (needRuns === 0 || needRuns == null);
  const isCompleted = vm.phase === "completed" || isTargetReached;

  return (
    <div
      className="relative z-30 w-full select-none shadow-2xl"
      style={{
        background: BIDWAR_SCOREBOARD_SHELL,
        fontFamily: BROADCAST_FONTS.body,
      }}
    >
      {/* 2px Continuous Broadcast Gold Structural Rail */}
      <div
        className="h-[2px] w-full"
        style={{
          background: BIDWAR_BROADCAST_YELLOW,
        }}
      />

      {/* 1. PRIMARY TELEVISION SCORE STRIP (104px) */}
      <div
        className="flex h-[104px] items-stretch justify-between"
        style={{
          paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
          paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        }}
      >
        {/* ========================================================= */}
        {/* A. LEFT: TEAM + DOMINANT SCORE + OVERS (~420px)            */}
        {/* ========================================================= */}
        <div
          className="flex items-center gap-4 pr-6 border-r border-white/10 min-w-[380px] max-w-[440px]"
          style={{ background: "rgba(5, 5, 8, 0.4)" }}
        >
          {/* Team Crest Badge */}
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border p-1"
            style={{
              background: BIDWAR_SCOREBOARD_PANEL,
              borderColor: batting?.color ? batting.color : "rgba(255, 215, 0, 0.4)",
            }}
          >
            {batting?.logoUrl ? (
              <img
                src={batting.logoUrl}
                alt=""
                className="h-full w-full object-contain"
              />
            ) : (
              <span
                className="text-2xl font-normal text-[#FFD700]"
                style={{ fontFamily: BROADCAST_FONTS.display }}
              >
                {batting?.shortCode?.slice(0, 3) || "BAT"}
              </span>
            )}
          </div>

          {/* Team Identity & Matchup */}
          <div className="flex flex-col justify-center min-w-0">
            <span
              className="text-3xl font-normal uppercase tracking-wide text-white leading-none"
              style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.04em" }}
            >
              {batting?.shortCode || "BAT"}
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/50 mt-1">
              v {bowling?.shortCode || "BOWL"}
            </span>
          </div>

          {/* DOMINANT SCORE NUMERALS + OVERS */}
          <div className="ml-auto flex flex-col items-end justify-center pl-2 text-right">
            <div
              className="flex items-baseline font-normal text-white leading-none tracking-tight"
              style={{ fontFamily: BROADCAST_FONTS.display }}
            >
              <span className="text-5xl tabular-nums text-white drop-shadow">
                {vm.runs}
              </span>
              <span className="mx-1 text-4xl text-[#FFD700] font-light">-</span>
              <span className="text-5xl tabular-nums text-[#FFD700] drop-shadow">
                {vm.wickets}
              </span>
            </div>
            <div
              className="mt-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-[#FFD700]"
              style={{ fontFamily: BROADCAST_FONTS.mono }}
            >
              <span>{vm.oversDisplay}</span>
              <span className="text-white/40">OV</span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* B. CENTER-LEFT: BATTERS CREASE (~440px)                   */}
        {/* ========================================================= */}
        <div className="flex flex-1 flex-col justify-center px-6 border-r border-white/10 min-w-[380px]">
          {/* Row 1: Striker */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
              {/* Geometric Active Striker Marker (No Emojis) */}
              <span className="h-2 w-2 rotate-45 bg-[#FFD700] shrink-0" />
              <span className="truncate text-base font-bold uppercase tracking-wide text-[#FFD700]">
                {striker?.name || "Striker"}
              </span>
            </div>

            <div
              className="flex items-center gap-2 text-xs font-bold tabular-nums"
              style={{ fontFamily: BROADCAST_FONTS.mono }}
            >
              <span className="text-xl font-bold text-white leading-none">
                {striker?.runs ?? 0}
              </span>
              <span className="text-xs text-white/60 font-medium">
                ({striker?.balls ?? 0}b)
              </span>
              {striker?.strikeRate != null && (
                <span className="text-[11px] text-white/40 font-normal pl-1">
                  SR {striker.strikeRate.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          <div className="h-[1px] w-full bg-white/5 my-0.5" />

          {/* Row 2: Non-Striker */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2 min-w-0 max-w-[220px]">
              {/* Invisible spacer for alignment */}
              <span className="h-2 w-2 shrink-0 opacity-0" />
              <span className="truncate text-base font-bold uppercase tracking-wide text-white/85">
                {nonStriker?.name || "Non-Striker"}
              </span>
            </div>

            <div
              className="flex items-center gap-2 text-xs font-bold tabular-nums"
              style={{ fontFamily: BROADCAST_FONTS.mono }}
            >
              <span className="text-xl font-bold text-white/90 leading-none">
                {nonStriker?.runs ?? 0}
              </span>
              <span className="text-xs text-white/50 font-medium">
                ({nonStriker?.balls ?? 0}b)
              </span>
              {nonStriker?.strikeRate != null && (
                <span className="text-[11px] text-white/30 font-normal pl-1">
                  SR {nonStriker.strikeRate.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* C. CENTER-RIGHT: BOWLER SPELL & OVER TRAIN (~420px)       */}
        {/* ========================================================= */}
        <div className="flex flex-1 flex-col justify-center px-6 border-r border-white/10 min-w-[380px]">
          {/* Bowler Details */}
          <div className="flex items-center justify-between py-0.5">
            <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#06B6D4]">
                BOWL
              </span>
              <span className="truncate text-base font-bold uppercase tracking-wide text-white">
                {bowler?.name || "Bowler"}
              </span>
            </div>

            <div
              className="flex items-center gap-2 text-xs font-bold tabular-nums"
              style={{ fontFamily: BROADCAST_FONTS.mono }}
            >
              <span className="text-base text-[#FFD700]">
                {bowler ? `${bowler.wickets}-${bowler.runsConceded}` : "0-0"}
              </span>
              <span className="text-xs text-white/60">
                ({bowler?.overs || "0.0"} ov)
              </span>
              <span className="text-white/30">|</span>
              <span className="text-xs text-[#06B6D4]">
                ECON {bowler?.economy != null ? bowler.economy.toFixed(1) : "—"}
              </span>
            </div>
          </div>

          <div className="h-[1px] w-full bg-white/5 my-0.5" />

          {/* 28px Chamfered Square Over Tiles */}
          <div className="flex items-center gap-2 py-0.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 mr-1">
              THIS OVER
            </span>
            <div className="flex items-center gap-1.5">
              {vm.thisOverLabels.length === 0 ? (
                <span className="text-xs text-white/40 font-mono">—</span>
              ) : (
                vm.thisOverLabels.map((ball, idx) => {
                  const isWicket = ball === "W";
                  const isSix = ball === "6";
                  const isFour = ball === "4";
                  const isExtra = ball.includes("Wd") || ball.includes("Nb");
                  const isDot = ball === "·" || ball === "0";

                  let bg = BIDWAR_SCOREBOARD_PANEL;
                  let color = "#FFFFFF";
                  let border = "1px solid rgba(255,255,255,0.12)";

                  if (isWicket) {
                    bg = "#E11D48";
                    color = "#FFFFFF";
                    border = "1px solid #E11D48";
                  } else if (isSix) {
                    bg = BIDWAR_BROADCAST_YELLOW;
                    color = "#050508";
                    border = "1px solid #FFD700";
                  } else if (isFour) {
                    bg = BIDWAR_SCOREBOARD_INSET;
                    color = "#FFD700";
                    border = "1px solid #FFD700";
                  } else if (isExtra) {
                    bg = BIDWAR_SCOREBOARD_INSET;
                    color = "#06B6D4";
                    border = "1px solid rgba(6,182,212,0.4)";
                  } else if (isDot) {
                    bg = BIDWAR_SCOREBOARD_INSET;
                    color = "rgba(255,255,255,0.45)";
                  }

                  return (
                    <span
                      key={`${ball}-${idx}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold tabular-nums"
                      style={{
                        background: bg,
                        color: color,
                        border: border,
                        fontFamily: BROADCAST_FONTS.mono,
                      }}
                    >
                      {ball}
                    </span>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* D. RIGHT: ONE CONTEXTUAL INFORMATION BLOCK (~280px)       */}
        {/* ========================================================= */}
        <div
          className="flex flex-col items-center justify-center pl-6 min-w-[240px] max-w-[280px] text-center"
          style={{ background: "rgba(5, 5, 8, 0.4)" }}
        >
          {isCompleted ? (
            /* CONTEXT 1: MATCH COMPLETED */
            <div className="space-y-0.5">
              <span
                className="text-xs font-bold uppercase tracking-widest text-[#FFD700]"
                style={{ fontFamily: BROADCAST_FONTS.body }}
              >
                {vm.resultText?.toLowerCase().includes("walkover") ? "WALKOVER AWARDED" : "MATCH COMPLETED"}
              </span>
              <div
                className="text-2xl font-normal uppercase text-[#FFD700] leading-tight"
                style={{ fontFamily: BROADCAST_FONTS.display }}
              >
                {vm.winner?.name || batting?.name || "CHAMPIONS"}
              </div>
              <p className="text-[11px] font-semibold text-white/80">
                {vm.resultText || "VICTORY ACHIEVED"}
              </p>
            </div>
          ) : isChase && needRuns != null && ballsLeft != null ? (
            /* CONTEXT 2: CHASE TARGET & EQUATION */
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[#06B6D4]">
                TARGET {vm.target}
              </span>
              <div
                className="flex items-baseline justify-center gap-1.5"
                style={{ fontFamily: BROADCAST_FONTS.mono }}
              >
                <span className="text-3xl font-bold text-[#FFD700]">
                  {needRuns}
                </span>
                <span className="text-xs font-semibold text-white/70">
                  OFF {ballsLeft}B
                </span>
              </div>
              <div
                className="text-[11px] font-bold uppercase text-[#06B6D4]"
                style={{ fontFamily: BROADCAST_FONTS.mono }}
              >
                REQ RR {vm.rrr || "—"}
              </div>
            </div>
          ) : (
            /* CONTEXT 3: 1ST INNINGS PARTNERSHIP */
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
                PARTNERSHIP
              </span>
              <div
                className="flex items-baseline justify-center gap-1.5"
                style={{ fontFamily: BROADCAST_FONTS.mono }}
              >
                <span className="text-3xl font-bold text-[#FFD700]">
                  {partnershipRuns}
                </span>
                <span className="text-xs font-medium text-white/70">
                  OFF {partnershipBalls}B
                </span>
              </div>
              <div
                className="text-[11px] font-bold uppercase text-[#FFD700]"
                style={{ fontFamily: BROADCAST_FONTS.mono }}
              >
                CRR {vm.crr || "0.00"}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. CONTEXTUAL TICKER RIBBON (36px) */}
      <div
        className="flex h-[36px] items-center justify-between border-t border-white/10 text-xs font-bold uppercase tracking-wide text-white"
        style={{
          background: BIDWAR_SCOREBOARD_INSET,
          paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
          paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
          fontFamily: BROADCAST_FONTS.body,
        }}
      >
        {/* Left Side Context Statement */}
        <div className="flex items-center gap-4">
          {isCompleted ? (
            <span className="text-[#FFD700] font-bold">
              FINAL: {vm.resultText || `${batting?.name || "BATTERS"} WON THE MATCH`}
            </span>
          ) : isChase && needRuns != null && ballsLeft != null ? (
            <span className="text-[#FFD700] font-bold">
              CHASE: NEED {needRuns} RUNS OFF {ballsLeft} BALLS {vm.target != null ? `(TARGET ${vm.target})` : ""}
            </span>
          ) : vm.firstInningsScoreLine ? (
            <span>
              <strong className="text-[#FFD700]">1ST INNINGS:</strong> {vm.firstInningsScoreLine}
            </span>
          ) : vm.tossText ? (
            <span>
              <strong className="text-[#FFD700]">TOSS:</strong> {vm.tossText}
            </span>
          ) : (
            <span className="text-white/60">BIDWAR CRICKET BROADCAST</span>
          )}

          {/* Special Delivery Alerts */}
          {vm.freeHitActive && !isCompleted && (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase text-[#06B6D4] bg-cyan-950/80 border border-cyan-500/40">
              FREE HIT
            </span>
          )}

          {vm.superBallActive && !isCompleted && (
            <span className="px-2 py-0.5 text-[10px] font-black uppercase text-[#FFD700] bg-yellow-950/80 border border-yellow-500/40">
              SUPER BALL (2X)
            </span>
          )}
        </div>

        {/* Right Side Rates */}
        <div
          className="flex items-center gap-4 text-xs font-bold tabular-nums"
          style={{ fontFamily: BROADCAST_FONTS.mono }}
        >
          {vm.crr && <span>CRR <span className="text-[#FFD700]">{vm.crr}</span></span>}
          {isChase && vm.rrr && !isCompleted && <span>RRR <span className="text-[#E11D48]">{vm.rrr}</span></span>}
          {!isChase && vm.projectedScore && !isCompleted && <span>PROJ <span className="text-[#06B6D4]">{vm.projectedScore}</span></span>}
          {vm.powerplayText && !isCompleted && (
            <span className="text-[10px] font-bold text-white/70 border-l border-white/20 pl-3">
              {vm.powerplayText}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
