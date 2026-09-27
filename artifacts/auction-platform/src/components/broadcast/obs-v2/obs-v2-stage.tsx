import { forwardRef, useMemo, type CSSProperties, type HTMLAttributes } from "react";
import "./broadcast.css";
import { BroadcastStage } from "./BroadcastStage";
import type { BroadcastFrame, CricketScoreModel } from "./contracts";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";
import { ObsV2EventGraphic } from "./obs-v2-event-graphic";
import {
  MOCK_OBS_V2_STAGE_DATA,
  MOCK_OBS_V2_BROADCAST_MESSAGE,
  type ObsV2StageData,
  type ObsV2BroadcastMessageData,
} from "./types";
import { deriveBranding } from "./branding";
import { OBS_V2 } from "./obs-v2-tokens";

export interface ObsV2StageProps extends HTMLAttributes<HTMLDivElement> {
  /** Master Lovable BroadcastFrame (if already adapted) */
  frame?: BroadcastFrame;
  /** Master broadcast data model (backward compatibility with legacy V2 stage data). */
  data?: ObsV2StageData;
  /** Transient live broadcast event (FOUR, SIX, WICKET, MILESTONE, etc.) */
  activeEvent?: ObsV2BroadcastEvent | null;
  /** Visual prototype broadcast message plate. */
  broadcastMessage?: ObsV2BroadcastMessageData | null;
  /** When true, renders safe-area boundary lines and zone markers */
  showSafeGuides?: boolean;
  /** Responsive scale factor (e.g. 0.5 for previewing in small containers) */
  scale?: number;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2Stage — Master 1920×1080 Cricket & Auction Broadcast Stage
 *
 * Implements the new Lovable Broadcast Overlay Design System:
 * - HeaderFrame (0–96px): Tournament Brand, BidWar Live Brand, Associate Rail, Title Sponsor
 * - CAMERA SAFE AREA (96–880px): 100% TRANSPARENT VIEWPORT
 * - Lower Third (880–1040px): Modular scene panels (Cricket, Auction, Sold, Unsold, Break, Summary, Top5, Team)
 * - FooterBar (1040–1080px): Status chip, Team/Sponsor Ticker, CRR stat, Connection status
 */
export const ObsV2Stage = forwardRef<HTMLDivElement, ObsV2StageProps>(
  function ObsV2Stage(
    {
      frame: directFrame,
      data = MOCK_OBS_V2_STAGE_DATA,
      activeEvent = null,
      broadcastMessage = MOCK_OBS_V2_BROADCAST_MESSAGE,
      showSafeGuides = false,
      scale = 1,
      className = "",
      style,
      ...rest
    },
    ref,
  ) {
    // If a direct Lovable frame was passed, use it; otherwise map legacy ObsV2StageData
    const resolvedFrame: BroadcastFrame = useMemo(() => {
      if (directFrame) return directFrame;

      const branding = deriveBranding(
        data.header.tournamentName || "BidWar Cricket",
        data.header.tournamentLogoUrl || null,
      );

      const isLive = data.header.live ?? true;
      const feedStatus = data.connectionStatus === "reconnecting"
        ? "stale"
        : data.connectionStatus === "disconnected"
          ? "disconnected"
          : "live";

      const battingTeam = {
        name: data.scorebug.battingTeam?.name || "Titans Cricket Club",
        short: data.scorebug.battingTeam?.shortCode || "TIT",
        logoUrl: data.scorebug.battingTeam?.logoUrl || undefined,
      };

      const bowlingTeamShort = data.scorebug.bowlingTeam?.shortCode || "RS";

      const cricketModel: CricketScoreModel = {
        battingTeam,
        bowlingTeamShort,
        runs: data.scorebug.runs ?? 124,
        wickets: data.scorebug.wickets ?? 4,
        overs: String(data.scorebug.overs ?? "17.3"),
        maxOvers: data.scorebug.maxOvers ?? 20,
        crr: parseFloat(String(data.scorebug.crr ?? "7.08")) || 0,
        striker: {
          name: "Mayank Pahuja",
          runs: 48,
          balls: 26,
          onStrike: true,
        },
        nonStriker: {
          name: "Rohan Mehra",
          runs: 28,
          balls: 18,
          onStrike: false,
        },
        bowler: {
          name: "Anubhav Bassi",
          wickets: 2,
          runs: 34,
          overs: "3.3",
        },
        thisOver: [
          { kind: "run", label: "1" },
          { kind: "four", label: "4" },
          { kind: "dot", label: "0" },
          { kind: "six", label: "6" },
          { kind: "wicket", label: "W" },
        ],
        status: {
          chip: isLive ? (data.header.statusLabel || "LIVE") : "STANDBY",
          text: data.scorebug.statusText || `${branding.tournamentName} ${branding.tournamentAccent}`.trim(),
        },
      };

      return {
        branding,
        sponsors: [
          { id: "ld", name: "Lions Diamond", tier: "title", label: "Official Partner" },
          { id: "a1", name: "Apex Cement", tier: "associate" },
          { id: "a2", name: "Nova Energy", tier: "associate" },
          { id: "a3", name: "Kite Mobile", tier: "associate" },
        ],
        teams: [
          { teamId: "t1", name: "Titans CC", short: "TIT", purseRemaining: 42000000, playersBought: 9, slotsRemaining: 6 },
          { teamId: "t2", name: "Royal Strikers", short: "RS", purseRemaining: 38500000, playersBought: 11, slotsRemaining: 4 },
        ],
        settings: { performanceMode: false, showTicker: true },
        feed: { status: feedStatus },
        scene: "CRICKET",
        model: cricketModel,
      };
    }, [directFrame, data]);

    const canvasTransform = scale && scale !== 1 ? `scale(${scale})` : undefined;

    return (
      <div
        ref={ref}
        className={`bw-obs-root relative overflow-hidden ${className}`}
        style={{
          width: scale !== 1 ? `${1920 * scale}px` : "1920px",
          height: scale !== 1 ? `${1080 * scale}px` : "1080px",
          background: "transparent",
          ...style,
        }}
        {...rest}
      >
        <div
          style={{
            width: "1920px",
            height: "1080px",
            transform: canvasTransform,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {/* Master Lovable Broadcast Stage */}
          <BroadcastStage frame={resolvedFrame} />

          {/* Real-time Transient Event Graphic (Camera Safe Area: 96–880px, strictly centered) */}
          {activeEvent && (
            <div
              style={{
                position: "absolute",
                top: OBS_V2.canvas.headerHeight,
                left: 0,
                right: 0,
                height: OBS_V2.canvas.cameraHeight,
                zIndex: 60,
                pointerEvents: "none",
              }}
            >
              <ObsV2EventGraphic event={activeEvent} />
            </div>
          )}

          {/* Safe Guides Overlay for Visual Calibration */}
          {showSafeGuides && (
            <div className="bw-safe-guide" aria-hidden>
              CAMERA SAFE AREA — 100% TRANSPARENT
            </div>
          )}
        </div>
      </div>
    );
  },
);
