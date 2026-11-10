import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";
import { WeddingTeamPlaque } from "./WeddingTeamPlaque";
import { WeddingBallPill } from "./WeddingBallPill";
import { WeddingAnimatedValue } from "./WeddingAnimatedValue";
import {
  WeddingScoreNum,
  WeddingLabel,
  WeddingValue,
  WeddingPlayerName,
} from "./WeddingTypography";
import type { CricketScoreModel } from "../obs-v2/contracts";

export interface WeddingScorebugProps extends React.HTMLAttributes<HTMLDivElement> {
  model: CricketScoreModel;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Center "VS" Medallion
 * Antique bronze & gold circular wax seal medallion.
 */
function VsMedallion({ size = WEDDING_TOKENS.canvas.scoreboard.vsMedallionSize }: { size?: number }) {
  return (
    <div
      className="wedding-vs-medallion relative flex items-center justify-center rounded-full select-none shrink-0"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: WEDDING_TOKENS.color.gradient.vsMedallion,
        border: `2px solid ${WEDDING_TOKENS.color.gold.champagne}`,
        boxShadow: "0 2px 8px rgba(0,0,0,0.4), inset 0 1px 2px rgba(255,255,255,0.2)",
        zIndex: WEDDING_TOKENS.layer.vsMedallion,
      }}
    >
      <span
        className="text-[13px] font-bold italic"
        style={{
          fontFamily: WEDDING_TOKENS.typography.family.serif,
          color: WEDDING_TOKENS.color.gold.pale,
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
        }}
      >
        VS
      </span>
    </div>
  );
}

/**
 * Clean Overs Formatter
 * Normalizes strings like "8.4 OV" or handles ball remainder.
 */
function cleanOversDisplay(rawOvers: string | number): string {
  const str = String(rawOvers || "0.0");
  const clean = str.includes("/") ? str.split("/")[0].trim() : str.replace(/OV/i, "").trim();
  const parts = clean.split(".");
  if (parts.length === 2) {
    const o = parseInt(parts[0], 10) || 0;
    const b = parseInt(parts[1], 10) || 0;
    if (b >= 6) {
      const full = o + Math.floor(b / 6);
      const rem = b % 6;
      return rem > 0 ? `${full}.${rem}` : `${full}.0`;
    }
  }
  return clean || "0.0";
}

/**
 * WeddingScorebug
 * Authoritative 1240×160px Royal Wedding Cricket Lower-Third Scorebug
 * with smooth numeric transitions.
 */
export const WeddingScorebug = React.forwardRef<HTMLDivElement, WeddingScorebugProps>(
  function WeddingScorebug({ model, className = "", style, ...rest }, ref) {
    const {
      battingTeam,
      bowlingTeamShort,
      runs,
      wickets,
      overs,
      maxOvers,
      crr,
      rrr,
      needRuns,
      ballsRemaining,
      striker,
      nonStriker,
      bowler,
      thisOver = [],
      result,
    } = model;

    const formattedOvers = cleanOversDisplay(overs);

    // Compute dynamic team sidedness (ensures Groom batting renders navy on left, bride burgundy on right)
    const isBattingGroom =
      /groom|ladkewale/i.test(battingTeam.name || "") ||
      /gxi/i.test(battingTeam.short || "");
    const battingSide: "bride" | "groom" = isBattingGroom ? "groom" : "bride";
    const bowlingSide: "bride" | "groom" = battingSide === "groom" ? "bride" : "groom";

    // Calculate Projected Total if in 1st innings
    const isChase = Boolean(needRuns != null && ballsRemaining != null);
    const projectedScore =
      maxOvers > 0 && crr > 0 ? Math.round(crr * maxOvers) : Math.max(runs, 0);

    // Normalized 6-ball over sequence with pending circles
    const overBalls = React.useMemo(() => {
      const balls = [...thisOver];
      const totalInOver = 6;
      const padded: Array<{ label: string; kind?: string }> = balls.map((b) => ({
        label: b.label,
        kind: b.kind,
      }));
      while (padded.length < totalInOver && padded.length < 6) {
        padded.push({ label: "" }); // Empty circle
      }
      return padded;
    }, [thisOver]);

    return (
      <div
        ref={ref}
        className={`wedding-scorebug relative mx-auto flex flex-col select-none ${className}`}
        style={{
          width: `${WEDDING_TOKENS.canvas.scoreboard.width}px`,
          height: `${WEDDING_TOKENS.canvas.scoreboard.totalHeight}px`,
          zIndex: WEDDING_TOKENS.layer.scorebugPlaque,
          ...style,
        }}
        data-wedding-scorebug="true"
        {...rest}
      >
        {/* ================================================================= */}
        {/* TIER 1: MAIN SCORE STRIP (Height: 92px)                           */}
        {/* ================================================================= */}
        <div
          className="relative flex items-center justify-between w-full"
          style={{ height: `${WEDDING_TOKENS.canvas.scoreboard.mainStripHeight}px` }}
        >
          {/* 1. Left Team Plaque (Batting Team) */}
          <WeddingTeamPlaque
            name={battingTeam.name || (battingSide === "groom" ? "Groom's XI" : "Bride's XI")}
            shortCode={battingTeam.short}
            logoUrl={battingTeam.logoUrl}
            side={battingSide}
            position="left"
          />

          {/* 2. Center Score Pod Container */}
          <div
            className="relative flex items-center justify-center px-6"
            style={{
              width: `${WEDDING_TOKENS.canvas.scoreboard.scorePodWidth}px`,
              height: `${WEDDING_TOKENS.canvas.scoreboard.mainStripHeight}px`,
              background: WEDDING_TOKENS.color.gradient.parchment,
              border: `1.5px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
              borderRadius: "16px",
              boxShadow: `${WEDDING_TOKENS.depth.shadow.parchment}, 0 0 0 2px rgba(212, 175, 55, 0.2)`,
            }}
          >
            {/* Inner delicate hairline */}
            <div
              className="pointer-events-none absolute inset-[3px] rounded-[13px]"
              style={{ border: `1px solid ${WEDDING_TOKENS.color.gold.hairline}` }}
            />

            {/* Runs / Wickets Numerals with Animated Transitions */}
            <div className="flex items-baseline">
              <WeddingScoreNum
                className="text-[58px] tracking-tight leading-none"
                style={{ color: WEDDING_TOKENS.color.charcoal.ink }}
              >
                <WeddingAnimatedValue value={runs} />
              </WeddingScoreNum>
              <span
                className="text-[44px] font-light leading-none mx-0.5"
                style={{ color: WEDDING_TOKENS.color.gold.antique, fontFamily: WEDDING_TOKENS.typography.family.serif }}
              >
                /
              </span>
              <WeddingScoreNum
                className="text-[48px] leading-none"
                style={{ color: WEDDING_TOKENS.color.burgundy.base }}
              >
                <WeddingAnimatedValue value={wickets} flashColor={WEDDING_TOKENS.color.burgundy.rich} />
              </WeddingScoreNum>
            </div>

            {/* Vertical Hairline Divider */}
            <div
              className="mx-4 h-12 w-[1px]"
              style={{
                background: `linear-gradient(180deg, transparent 0%, ${WEDDING_TOKENS.color.gold.border} 50%, transparent 100%)`,
              }}
            />

            {/* Overs Section with Animated Transitions */}
            <div className="flex flex-col items-center justify-center">
              <span
                className="text-[26px] font-bold leading-tight"
                style={{
                  fontFamily: WEDDING_TOKENS.typography.family.numeric,
                  color: WEDDING_TOKENS.color.charcoal.ink,
                }}
              >
                <WeddingAnimatedValue value={formattedOvers} />
              </span>
              <WeddingLabel className="text-[10px] mt-[-2px] tracking-widest text-neutral-500">
                OVERS
              </WeddingLabel>
            </div>
          </div>

          {/* 3. Center "VS" Medallion placed at the seam between Center Score Pod and Bowling Plaque */}
          <div
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: "820px", transform: "translate(-50%, -50%)" }}
          >
            <VsMedallion />
          </div>

          {/* 4. Right Team Plaque (Bowling Team) */}
          <WeddingTeamPlaque
            name={bowlingTeamShort || (bowlingSide === "groom" ? "Groom's XI" : "Bride's XI")}
            shortCode={bowlingTeamShort}
            side={bowlingSide}
            position="right"
          />
        </div>

        {/* ================================================================= */}
        {/* TIER 2: DETAILED STATS RIBBON (Height: 68px)                       */}
        {/* ================================================================= */}
        <div
          className="relative w-full flex items-center justify-between px-6 mt-1"
          style={{
            height: `${WEDDING_TOKENS.canvas.scoreboard.statsRibbonHeight}px`,
            background: WEDDING_TOKENS.color.gradient.parchment,
            border: `1.5px solid ${WEDDING_TOKENS.color.gold.border}`,
            borderRadius: "14px",
            boxShadow: WEDDING_TOKENS.depth.shadow.parchment,
          }}
        >
          {/* Bottom Center Pointed Finial Ornament */}
          <div
            className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 w-3.5 h-3.5 rotate-45"
            style={{
              background: WEDDING_TOKENS.color.gradient.parchment,
              borderRight: `1.5px solid ${WEDDING_TOKENS.color.gold.border}`,
              borderBottom: `1.5px solid ${WEDDING_TOKENS.color.gold.border}`,
            }}
          />
          {/* Inner delicate hairline */}
          <div
            className="pointer-events-none absolute inset-[3px] rounded-[11px]"
            style={{ border: `1px solid ${WEDDING_TOKENS.color.gold.hairline}` }}
          />

          {/* Column A: In-Play Batsmen (Striker + Non-striker) */}
          <div className="flex flex-col justify-center gap-1 w-[320px] overflow-hidden">
            {/* Striker Row */}
            <div className="flex items-center justify-between pr-4">
              <WeddingPlayerName isOnStrike={true} className="text-[15px] truncate max-w-[210px]">
                {striker?.name || "Striker"}
              </WeddingPlayerName>
              <span
                className="text-[15px] font-bold tabular-nums"
                style={{
                  fontFamily: WEDDING_TOKENS.typography.family.sans,
                  color: WEDDING_TOKENS.color.charcoal.espresso,
                }}
              >
                <WeddingAnimatedValue value={striker?.runs ?? 0} />{" "}
                <small className="font-normal text-xs text-neutral-500">
                  (<WeddingAnimatedValue value={striker?.balls ?? 0} />)
                </small>
              </span>
            </div>

            {/* Non-Striker Row */}
            <div className="flex items-center justify-between pr-4">
              <WeddingPlayerName isOnStrike={false} className="text-[15px] truncate max-w-[210px]">
                {nonStriker?.name || "Non-Striker"}
              </WeddingPlayerName>
              <span
                className="text-[15px] font-bold tabular-nums"
                style={{
                  fontFamily: WEDDING_TOKENS.typography.family.sans,
                  color: WEDDING_TOKENS.color.charcoal.espresso,
                }}
              >
                <WeddingAnimatedValue value={nonStriker?.runs ?? 0} />{" "}
                <small className="font-normal text-xs text-neutral-500">
                  (<WeddingAnimatedValue value={nonStriker?.balls ?? 0} />)
                </small>
              </span>
            </div>
          </div>

          {/* Column Separator 1 */}
          <div
            className="h-10 w-[1px]"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${WEDDING_TOKENS.color.gold.border} 50%, transparent 100%)`,
            }}
          />

          {/* Column B: Match Analytics (CRR & Projected / Target Equation / Result) */}
          <div className="flex flex-col items-center justify-center w-[260px] text-center">
            {result ? (
              <div className="flex flex-col items-center">
                <WeddingLabel className="text-[10px] text-[#801830]">
                  {result.kicker || "MATCH RESULT"}
                </WeddingLabel>
                <span
                  className="text-[14px] font-bold truncate max-w-[240px]"
                  style={{
                    fontFamily: WEDDING_TOKENS.typography.family.serif,
                    color: WEDDING_TOKENS.color.charcoal.ink,
                  }}
                >
                  {result.headline}
                </span>
              </div>
            ) : isChase ? (
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-1.5">
                  <WeddingLabel className="text-[11px] text-neutral-500">CRR</WeddingLabel>
                  <WeddingValue className="text-[15px]">
                    <WeddingAnimatedValue value={crr ? crr.toFixed(2) : "—"} />
                  </WeddingValue>
                </div>
                <div className="flex items-center gap-1.5 font-bold text-[13px] text-[#801830]">
                  <span>
                    NEED <WeddingAnimatedValue value={needRuns ?? 0} /> OFF{" "}
                    <WeddingAnimatedValue value={ballsRemaining ?? 0} />
                  </span>
                  {rrr != null && rrr > 0 && (
                    <small className="text-neutral-500 font-normal">
                      (RRR {rrr.toFixed(2)})
                    </small>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <div className="flex items-center gap-2">
                  <WeddingLabel className="text-[11px] text-neutral-500">CRR</WeddingLabel>
                  <WeddingValue className="text-[15px]">
                    <WeddingAnimatedValue value={crr ? crr.toFixed(2) : "0.00"} />
                  </WeddingValue>
                </div>
                <div className="flex items-center gap-2">
                  <WeddingLabel className="text-[11px] text-neutral-500">PROJECTED</WeddingLabel>
                  <WeddingValue className="text-[15px] text-[#801830]">
                    <WeddingAnimatedValue value={projectedScore} />
                  </WeddingValue>
                </div>
              </div>
            )}
          </div>

          {/* Column Separator 2 */}
          <div
            className="h-10 w-[1px]"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${WEDDING_TOKENS.color.gold.border} 50%, transparent 100%)`,
            }}
          />

          {/* Column C: Current Bowler & This Over Ball-by-Ball sequence */}
          <div className="flex flex-col justify-center gap-1 w-[320px] pl-4">
            {/* Bowler Details */}
            <div className="flex items-center justify-between">
              <span
                className="text-[15px] font-semibold truncate max-w-[190px]"
                style={{
                  fontFamily: WEDDING_TOKENS.typography.family.serif,
                  color: WEDDING_TOKENS.color.charcoal.ink,
                }}
              >
                {bowler?.name || "Bowler"}
              </span>
              <span
                className="text-[14px] font-bold tabular-nums"
                style={{
                  fontFamily: WEDDING_TOKENS.typography.family.sans,
                  color: WEDDING_TOKENS.color.charcoal.espresso,
                }}
              >
                <WeddingAnimatedValue value={bowler?.wickets ?? 0} />-
                <WeddingAnimatedValue value={bowler?.runs ?? 0} />{" "}
                <small className="font-normal text-xs text-neutral-500">
                  (<WeddingAnimatedValue value={bowler?.overs || "0.0"} />)
                </small>
              </span>
            </div>

            {/* Over Sequence Balls */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {overBalls.map((b, idx) => (
                <WeddingBallPill key={idx} outcome={b.label} size={24} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
);
