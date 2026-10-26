import { forwardRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import { OBS_V2 } from "./obs-v2-tokens";
import { ObsV2Rail } from "./obs-v2-rail";
import { ObsV2Surface } from "./obs-v2-surface";
import {
  ObsV2Text,
  ObsV2ScoreNum,
  ObsV2Label,
  ObsV2Value,
} from "./obs-v2-typography";
import type { ObsV2ScorebugData } from "./types";

export interface ObsV2ScorebugProps extends HTMLAttributes<HTMLDivElement> {
  data?: ObsV2ScorebugData;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2Scorebug — 140px Cricket Television Broadcast Scorebug
 *
 * Implements:
 * - 140px fixed vertical allocation (104px Primary Strip + 36px Context Ribbon).
 * - Continuous 2px top structural BidWar Gold rail (#FFD700).
 * - Dominant 72px score numerals with tabular/mono precision.
 * - Graceful degradation for loading, pre-match, standby, and partial data states.
 * - Safe margin padding (96px left and right).
 */
export const ObsV2Scorebug = forwardRef<HTMLDivElement, ObsV2ScorebugProps>(
  function ObsV2Scorebug({ data, className = "", style, ...rest }, ref) {
    const [logoFailed, setLogoFailed] = useState(false);

    const isLoading = data?.isLoading === true;
    const phase = data?.phase || "live";
    const runs = data?.runs;
    const wickets = data?.wickets;
    const overs = data?.overs;
    const target = data?.target;
    const needRuns = data?.needRuns;
    const ballsRemaining = data?.ballsRemaining;
    const crr = data?.crr;
    const rrr = data?.rrr;
    const statusText = data?.statusText;

    const batting = data?.battingTeam;
    const bowling = data?.bowlingTeam;

    // Determine state mode
    const hasLiveScore = runs != null && wickets != null;
    const isPreMatch = phase === "pre_match";
    const isStandby = phase === "no_live" || (!hasLiveScore && !isPreMatch && !isLoading);

    return (
      <footer
        ref={ref}
        className={`obs-v2-scorebug absolute bottom-0 left-0 right-0 select-none ${className}`}
        style={{
          height: `${OBS_V2.canvas.scorebugHeight}px`,
          zIndex: OBS_V2.layer.scorebug,
          ...style,
        }}
        data-scorebug-height={OBS_V2.canvas.scorebugHeight}
        data-scorebug-phase={phase}
        {...rest}
      >
        {/* Continuous 2px Top Structural BidWar Gold Rail */}
        <ObsV2Rail variant="brand" thickness="standard" />

        {/* Chassis Background */}
        <div
          className="flex flex-col w-full h-full"
          style={{ background: OBS_V2.color.obsidian }}
        >
          {/* ========================================================= */}
          {/* CASE A: INITIAL FEED CONNECTING / SYNCING                 */}
          {/* ========================================================= */}
          {isLoading ? (
            <div
              className="flex h-full w-full items-center justify-between"
              style={{
                paddingLeft: `${OBS_V2.canvas.safeX}px`,
                paddingRight: `${OBS_V2.canvas.safeX}px`,
              }}
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-2.5 w-2.5 rounded-full animate-pulse"
                  style={{ backgroundColor: OBS_V2.color.brand }}
                />
                <ObsV2Text
                  variant="value"
                  color="secondary"
                  className="font-bold tracking-widest text-xs uppercase"
                >
                  {statusText || "CONNECTING TO LIVE CRICKET FEED..."}
                </ObsV2Text>
              </div>
              <ObsV2Surface
                level="inset"
                className="px-4 py-1.5"
                style={{ borderColor: OBS_V2.color.hairline }}
              >
                <ObsV2Label color="muted">
                  BROADCAST ENGINE READY
                </ObsV2Label>
              </ObsV2Surface>
            </div>
          ) : isStandby ? (
            /* ========================================================= */
            /* CASE B: STANDBY / NO ACTIVE LIVE MATCH                    */
            /* ========================================================= */
            <div
              className="flex h-full w-full items-center justify-between"
              style={{
                paddingLeft: `${OBS_V2.canvas.safeX}px`,
                paddingRight: `${OBS_V2.canvas.safeX}px`,
              }}
            >
              <div className="flex flex-col justify-center">
                <ObsV2Label
                  style={{ color: OBS_V2.color.brand }}
                >
                  LIVE BROADCAST FEED
                </ObsV2Label>
                <ObsV2Text
                  variant="title"
                  color="primary"
                  className="font-normal tracking-wider mt-0.5"
                >
                  {statusText || "WAITING FOR NEXT FIXTURE"}
                </ObsV2Text>
              </div>
              <ObsV2Surface
                level="elevated"
                className="px-4 py-2"
                style={{ borderColor: OBS_V2.color.hairline }}
              >
                <ObsV2Label color="secondary">
                  CHANNEL ONLINE
                </ObsV2Label>
              </ObsV2Surface>
            </div>
          ) : isPreMatch ? (
            /* ========================================================= */
            /* CASE C: PRE-MATCH BUILD-UP                                */
            /* ========================================================= */
            <div
              className="flex h-full w-full items-center justify-between"
              style={{
                paddingLeft: `${OBS_V2.canvas.safeX}px`,
                paddingRight: `${OBS_V2.canvas.safeX}px`,
              }}
            >
              <div className="flex items-center gap-6">
                {/* Team A Badge */}
                {batting ? (
                  <div className="flex items-center gap-3">
                    <ObsV2Surface
                      level="elevated"
                      chamfer="sm"
                      className="flex h-12 w-12 items-center justify-center p-1"
                      style={{
                        borderLeft: `3px solid ${batting.color || OBS_V2.color.brand}`,
                      }}
                    >
                      <ObsV2Text variant="headline" color="brand" className="font-bold">
                        {batting.shortCode.slice(0, 3)}
                      </ObsV2Text>
                    </ObsV2Surface>
                    <ObsV2Text variant="value" color="primary" className="font-bold">
                      {batting.name}
                    </ObsV2Text>
                  </div>
                ) : null}

                <ObsV2Label color="muted" className="text-base font-bold">
                  VS
                </ObsV2Label>

                {/* Team B Badge */}
                {bowling ? (
                  <div className="flex items-center gap-3">
                    <ObsV2Surface
                      level="elevated"
                      chamfer="sm"
                      className="flex h-12 w-12 items-center justify-center p-1"
                      style={{
                        borderLeft: `3px solid ${bowling.color || OBS_V2.color.neutral}`,
                      }}
                    >
                      <ObsV2Text variant="headline" color="secondary" className="font-bold">
                        {bowling.shortCode.slice(0, 3)}
                      </ObsV2Text>
                    </ObsV2Surface>
                    <ObsV2Text variant="value" color="primary" className="font-bold">
                      {bowling.name}
                    </ObsV2Text>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center">
                <ObsV2Surface
                  level="inset"
                  className="px-5 py-2"
                  style={{ borderColor: OBS_V2.color.brandBorder }}
                >
                  <ObsV2Label color="brand">
                    {statusText || "MATCH STARTING SOON"}
                  </ObsV2Label>
                </ObsV2Surface>
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* CASE D: LIVE SCORE STRIP (104px) + CONTEXT RIBBON (36px)  */
            /* ========================================================= */
            <>
              {/* 1. PRIMARY SCORE STRIP (104px) */}
              <div
                className="flex items-center justify-between"
                style={{
                  height: `${OBS_V2.canvas.scorebugStripHeight}px`,
                  paddingLeft: `${OBS_V2.canvas.safeX}px`,
                  paddingRight: `${OBS_V2.canvas.safeX}px`,
                  borderBottom: `1px solid ${OBS_V2.color.divider}`,
                }}
              >
                {/* A. LEFT: TEAM CREST + DOMINANT SCORE NUMERALS */}
                <div className="flex items-center gap-6">
                  {/* Team Insignia Badge */}
                  {batting ? (
                    <ObsV2Surface
                      level="elevated"
                      chamfer="sm"
                      className="flex h-16 w-16 items-center justify-center p-1.5"
                      style={{
                        borderLeft: `3px solid ${batting.color || OBS_V2.color.brand}`,
                      }}
                    >
                      {batting.logoUrl && !logoFailed ? (
                        <img
                          src={batting.logoUrl}
                          alt=""
                          className="h-full w-full object-contain"
                          onError={() => setLogoFailed(true)}
                        />
                      ) : (
                        <ObsV2Text
                          variant="headline"
                          color="brand"
                          className="font-bold tracking-wider"
                        >
                          {batting.shortCode.slice(0, 3)}
                        </ObsV2Text>
                      )}
                    </ObsV2Surface>
                  ) : null}

                  {/* Dominant Score Display (Runs / Wickets) */}
                  <div className="flex items-baseline gap-2">
                    <ObsV2ScoreNum color="primary">
                      {runs}
                    </ObsV2ScoreNum>
                    <span
                      className="text-4xl font-light"
                      style={{
                        color: OBS_V2.color.textMuted,
                        fontFamily: OBS_V2.typography.family.display,
                      }}
                    >
                      /
                    </span>
                    <span
                      className="text-5xl font-normal"
                      style={{
                        color: OBS_V2.color.brand,
                        fontFamily: OBS_V2.typography.family.display,
                      }}
                    >
                      {wickets}
                    </span>
                  </div>

                  {/* Vertical Divider */}
                  <div
                    className="h-12 w-[1px] ml-2"
                    style={{ backgroundColor: OBS_V2.color.dividerVertical }}
                  />

                  {/* Overs Metric */}
                  {overs != null ? (
                    <div className="flex flex-col justify-center">
                      <ObsV2Label color="muted">
                        OVERS
                      </ObsV2Label>
                      <ObsV2Text
                        variant="headline"
                        color="primary"
                        tabularNums
                        className="mt-0.5"
                      >
                        {overs}
                      </ObsV2Text>
                    </div>
                  ) : null}
                </div>

                {/* B. RIGHT: CONTEXTUAL SITUATION METRIC (Target / Need) */}
                <div className="flex items-center gap-4">
                  {target != null && target > 0 ? (
                    <ObsV2Surface
                      level="inset"
                      className="flex flex-col items-end px-5 py-2.5 rounded"
                      style={{
                        borderColor: OBS_V2.color.brandBorder,
                        background: OBS_V2.color.gradient.inset,
                      }}
                    >
                      <ObsV2Label style={{ color: OBS_V2.color.brand }}>
                        TARGET
                      </ObsV2Label>
                      <ObsV2Text
                        variant="headline"
                        color="primary"
                        tabularNums
                        className="mt-0.5"
                      >
                        {target}
                      </ObsV2Text>
                    </ObsV2Surface>
                  ) : null}

                  {needRuns != null && ballsRemaining != null ? (
                    <div className="flex flex-col items-end justify-center pl-3">
                      <ObsV2Label color="secondary">
                        CHASE EQUATION
                      </ObsV2Label>
                      <ObsV2Value
                        color="brand"
                        className="font-bold text-sm tracking-wide mt-0.5"
                      >
                        NEED {needRuns} RUNS IN {ballsRemaining}B
                      </ObsV2Value>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* 2. CONTEXTUAL RIBBON (36px) */}
              <div
                className="flex items-center justify-between"
                style={{
                  height: `${OBS_V2.canvas.scorebugRibbonHeight}px`,
                  paddingLeft: `${OBS_V2.canvas.safeX}px`,
                  paddingRight: `${OBS_V2.canvas.safeX}px`,
                  background: OBS_V2.color.carbon,
                }}
              >
                {/* Run Rates (CRR / RRR) */}
                <div className="flex items-center gap-4">
                  {crr != null ? (
                    <div className="flex items-center gap-1.5">
                      <ObsV2Label color="muted">
                        CRR
                      </ObsV2Label>
                      <ObsV2Text
                        variant="bodySm"
                        color="secondary"
                        tabularNums
                        className="font-semibold"
                      >
                        {crr}
                      </ObsV2Text>
                    </div>
                  ) : null}

                  {rrr != null ? (
                    <>
                      <span
                        className="text-xs"
                        style={{ color: OBS_V2.color.divider }}
                      >
                        ·
                      </span>
                      <div className="flex items-center gap-1.5">
                        <ObsV2Label color="muted">
                          RRR
                        </ObsV2Label>
                        <ObsV2Text
                          variant="bodySm"
                          color="brand"
                          tabularNums
                          className="font-semibold"
                        >
                          {rrr}
                        </ObsV2Text>
                      </div>
                    </>
                  ) : null}
                </div>

                {/* Match Situation Text / Status Banner */}
                {statusText ? (
                  <div className="flex items-center gap-2">
                    <ObsV2Text
                      variant="bodySm"
                      color="secondary"
                      className="font-bold uppercase tracking-widest text-[11px]"
                    >
                      {statusText}
                    </ObsV2Text>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      </footer>
    );
  },
);
