import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { BroadcastFrame, CricketScoreModel } from "../obs-v2/contracts";
import type { ObsV2BroadcastEvent } from "../obs-v2/obs-v2-events";
import { AssociateSponsorScorebug } from "../obs-v2/header/Header";
import { LiveStreamingPartnerBug } from "@/components/broadcast/obs/live-streaming-partner-bug";
import { FooterBar, FooterStatus, SponsorTicker, ConnectionStatus } from "../obs-v2/footer/Footer";
import { splitBroadcastSponsors } from "../obs-v2/branding";
import { OBS_V2 } from "../obs-v2/obs-v2-tokens";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";
import { WeddingHeader } from "./WeddingHeader";
import { WeddingScorebug } from "./WeddingScorebug";
import { WeddingDecorativeLayer } from "./WeddingDecorativeLayer";
import { WeddingEventGraphic } from "./WeddingEventGraphic";

export interface WeddingCricketBroadcastStageProps {
  frame: BroadcastFrame;
  activeEvent?: ObsV2BroadcastEvent | null;
  className?: string;
  hideLower?: boolean;
  hideFooter?: boolean;
  hideAssociateSponsor?: boolean;
  weddingBranding?: {
    cupTitle?: string;
    coupleTitle?: string;
    brideTeamName?: string;
    groomTeamName?: string;
  };
}

/**
 * Waiting / Standby Plaque for Wedding Broadcast
 */
function WeddingWaitingPlaque({ headline, subline }: { headline: string; subline?: string }) {
  return (
    <div
      className="wedding-waiting-plaque mx-auto flex flex-col items-center justify-center text-center p-6"
      style={{
        width: `${WEDDING_TOKENS.canvas.scoreboard.width}px`,
        height: `${WEDDING_TOKENS.canvas.scoreboard.totalHeight}px`,
        background: WEDDING_TOKENS.color.gradient.parchment,
        border: `1.5px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
        borderRadius: "16px",
        boxShadow: WEDDING_TOKENS.depth.shadow.parchment,
      }}
    >
      <span
        className="text-[13px] font-bold uppercase tracking-widest text-[#801830]"
        style={{ fontFamily: WEDDING_TOKENS.typography.family.sans }}
      >
        MATCH STANDBY
      </span>
      <h2
        className="text-[28px] font-bold text-neutral-800 mt-1"
        style={{ fontFamily: WEDDING_TOKENS.typography.family.serif }}
      >
        {headline}
      </h2>
      {subline && (
        <p
          className="text-[14px] text-neutral-600 tracking-wider uppercase mt-0.5"
          style={{ fontFamily: WEDDING_TOKENS.typography.family.sans }}
        >
          {subline}
        </p>
      )}
    </div>
  );
}

/**
 * WeddingCricketBroadcastStage
 * Authoritative 1920×1080 Royal Wedding Edition Cricket Broadcast Stage.
 *
 * Implements:
 * - 4-zone broadcast geometry:
 *     ZONE 1 (Header: 0–96px): Centered Royal Wedding Plaque & Live Bug
 *     ZONE 2 (Camera Safe: 96–880px): 100% transparent live viewport + WeddingEventGraphic
 *     ZONE 3 (Lower-Third: 880–1040px): 1240×160px Royal Wedding Scorebug
 *     ZONE 4 (Footer: 1040–1080px): Subtle luxury footer with match status & sponsors
 * - Clean integration with existing BroadcastFrame and CricketScoreModel
 * - Camera safety and transparency preservation
 * - Bespoke Wedding celebratory motion layer (SIX, FOUR, WICKET, MATCH_WON)
 */
export function WeddingCricketBroadcastStage({
  frame,
  activeEvent,
  className = "",
  hideLower = false,
  hideFooter = false,
  hideAssociateSponsor = false,
  weddingBranding,
}: WeddingCricketBroadcastStageProps) {
  const { liveStreaming, associates } = splitBroadcastSponsors(frame.sponsors);
  const isCricketScene = frame.scene === "CRICKET";
  const cricketModel = isCricketScene ? (frame.model as CricketScoreModel) : null;

  return (
    <div
      className={`bw-stage wedding-cricket-broadcast-stage relative overflow-hidden select-none ${className}`}
      data-broadcast-theme="wedding"
      data-broadcast-scene={frame.scene}
      style={{
        width: `${OBS_V2.canvas.width}px`,
        height: `${OBS_V2.canvas.height}px`,
        background: "transparent",
        position: "relative",
      }}
    >
      {/* ── AMBIENT DECORATIVE LAYER (OUTSIDE CAMERA SAFE LINE-OF-SIGHT) ── */}
      <WeddingDecorativeLayer showAmbientGlow={true} />

      {/* ── ZONE 1: WEDDING HEADER (0–96px, z-30) ── */}
      <WeddingHeader
        branding={frame.branding}
        feedStatus={frame.feed.status}
        weddingBranding={weddingBranding}
      />

      {/* ── ZONE 2: CAMERA SAFE AREA (96–880px, 100% TRANSPARENT) ── */}
      {/* Live Streaming Partner Bug — docked safely on the lower left above scorebug */}
      <LiveStreamingPartnerBug
        sponsor={
          liveStreaming
            ? { name: liveStreaming.name, logoUrl: liveStreaming.logoUrl }
            : null
        }
        style={{ left: 72, bottom: 216 }}
      />

      {/* Central Event Impact Layer for Sixes, Fours, Wickets, and Match Victory */}
      <div
        className="wedding-camera-impact-zone pointer-events-none absolute inset-x-0"
        style={{
          position: "absolute",
          top: `${OBS_V2.canvas.headerHeight}px`,
          left: 0,
          right: 0,
          height: `${OBS_V2.canvas.cameraHeight}px`,
          zIndex: 60,
          pointerEvents: "none",
        }}
      >
        <WeddingEventGraphic event={activeEvent ?? null} />
      </div>

      {/* Associate Sponsor docked above scorebug on the right */}
      {!hideLower && associates.length > 0 && (
        <AssociateSponsorScorebug sponsors={associates} hidden={hideAssociateSponsor} />
      )}

      {/* ── ZONE 3: LOWER THIRD SCOREBUG (880–1040px, z-20) ── */}
      {!hideLower && (
        <section
          className="wedding-lower-third-zone"
          style={{
            position: "absolute",
            top: "880px",
            height: `${OBS_V2.canvas.scorebugHeight}px`,
            left: 0,
            right: 0,
            zIndex: OBS_V2.layer.scorebug,
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={frame.scene}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              style={{ width: "100%", height: "100%" }}
            >
              {isCricketScene && cricketModel ? (
                <WeddingScorebug model={cricketModel} />
              ) : (
                <WeddingWaitingPlaque
                  headline={
                    frame.branding.tournamentName
                      ? `${frame.branding.tournamentName} CRICKET`
                      : "THE WEDDING CRICKET CUP"
                  }
                  subline="STANDBY FOR NEXT MATCH"
                />
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      {/* ── ZONE 4: FOOTER BAR (1040–1080px, z-20) ── */}
      {!hideFooter && (
        <footer
          className="wedding-footer-bar"
          style={{
            position: "absolute",
            top: "1040px",
            height: `${OBS_V2.canvas.footerHeight}px`,
            left: 0,
            right: 0,
            zIndex: OBS_V2.layer.scorebug,
            background: "linear-gradient(180deg, #1C1917 0%, #120E0C 100%)",
            borderTop: `1px solid ${WEDDING_TOKENS.color.gold.border}`,
          }}
        >
          <FooterBar
            left={
              isCricketScene && cricketModel ? (
                <FooterStatus
                  chip={cricketModel.status.chip}
                  text={cricketModel.status.text}
                />
              ) : (
                <FooterStatus
                  chip="STANDBY"
                  text={
                    frame.branding.tournamentAccent
                      ? `${frame.branding.tournamentName} · ${frame.branding.tournamentAccent}`
                      : frame.branding.tournamentName || "THE WEDDING CRICKET CUP"
                  }
                />
              )
            }
            center={<SponsorTicker sponsors={frame.sponsors} />}
            right={
              <ConnectionStatus
                status={frame.feed.status}
                seconds={frame.feed.secondsSinceUpdate}
              />
            }
          />
        </footer>
      )}
    </div>
  );
}
