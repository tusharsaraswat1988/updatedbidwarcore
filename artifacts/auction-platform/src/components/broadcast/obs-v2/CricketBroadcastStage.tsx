import { AnimatePresence, motion } from "framer-motion";
import type { BroadcastFrame, CricketScoreModel } from "./contracts";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";
import { ObsV2EventGraphic } from "./obs-v2-event-graphic";
import {
  AssociateSponsorScorebug,
  BidWarLiveBrand,
  HeaderAccents,
  HeaderEnergy,
  HeaderFrame,
  LiveBroadcastBug,
  TitleSponsor,
  TournamentBrand,
} from "./header/Header";
import { CricketScorebar } from "./lower/Cricket";
import { WaitingScene } from "./lower/Scenes";
import {
  ConnectionStatus,
  FooterBar,
  FooterStatus,
  SponsorTicker,
} from "./footer/Footer";
import { OBS_V2 } from "./obs-v2-tokens";

export interface CricketBroadcastStageProps {
  frame: BroadcastFrame;
  activeEvent?: ObsV2BroadcastEvent | null;
  className?: string;
  hideLower?: boolean;
  hideFooter?: boolean;
  hideAssociateSponsor?: boolean;
}

/**
 * CricketBroadcastStage — Authoritative 1920×1080 Cricket Broadcast Stage
 *
 * Dedicated Cricket-only presentation layer.
 * Zero dependency on Auction scenes or Auction scene switching.
 *
 * Protected Zones:
 * - HEADER (0–96px, z-30): Tournament Branding, Centered BidWar Logo, Right-anchored Title Sponsor
 * - LIVE BUG (y: 102px, right: 72px): Compact television live broadcast bug just below header
 * - ASSOCIATE SPONSOR (y: 844px, right: 72px): Frameless associate sponsor directly above scorebug on the right
 * - CAMERA SAFE AREA (96–880px, z-40/z-50): 100% transparent live viewport.
 *   Hosts transient Central Event Impact & temporary Mid-Screen Slates.
 * - LOWER THIRD / SCOREBUG (880–1040px, z-20): Persistent live Cricket scorebug with CRR next to Overs
 * - FOOTER BAR (1040–1080px, z-20): Match status chip, Running Sponsor ticker patti, Connection monitor
 */
export function CricketBroadcastStage({
  frame,
  activeEvent,
  className = "",
  hideLower = false,
  hideFooter = false,
  hideAssociateSponsor = false,
}: CricketBroadcastStageProps) {
  const title = frame.sponsors.find((s) => s.tier === "title") || frame.sponsors[0];
  const associates = frame.sponsors.filter((s) => s.id !== title?.id);
  const isCricketScene = frame.scene === "CRICKET";
  const cricketModel = isCricketScene ? (frame.model as CricketScoreModel) : null;

  return (
    <div
      className={`bw-stage cricket-broadcast-stage relative overflow-hidden select-none ${className}`}
      data-perf={frame.settings.performanceMode ? "on" : "off"}
      data-broadcast-scene={frame.scene}
      style={{
        width: "1920px",
        height: "1080px",
        background: "transparent",
        position: "relative",
      }}
    >
      {/* ── ZONE 1: HEADER (0–96px, z-30, Protected Zone) ── */}
      <HeaderFrame>
        <HeaderEnergy />
        <HeaderAccents />
        <TournamentBrand branding={frame.branding} />
        <BidWarLiveBrand feed={frame.feed.status} showLive={false} />

        {/* Right-aligned title sponsor strictly anchored to the right side */}
        <div
          className="bw-header-sponsors-right"
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "24px",
            zIndex: 10,
          }}
        >
          {title && <TitleSponsor sponsor={title} />}
        </div>
      </HeaderFrame>

      {/* Compact LIVE bug just below header on the right */}
      <LiveBroadcastBug feed={frame.feed.status} />

      {/* ── ZONE 2: CAMERA SAFE AREA (96–880px) ── */}
      {/* Central Event Impact Layer (Authoritative Single Render Location) */}
      <div
        className="bw-camera-impact-zone pointer-events-none absolute inset-x-0"
        style={{
          top: `${OBS_V2.canvas.headerHeight}px`,
          bottom: `${OBS_V2.canvas.lowerThirdHeight + OBS_V2.canvas.footerHeight}px`,
          zIndex: OBS_V2.layer.eventFlash,
          overflow: "hidden",
        }}
      >
        <ObsV2EventGraphic event={activeEvent ?? null} />
      </div>

      {/* Frameless Associate Sponsor docked right above footer scoreboard on the right */}
      {!hideLower && associates.length > 0 && (
        <AssociateSponsorScorebug sponsors={associates} hidden={hideAssociateSponsor} />
      )}

      {/* ── ZONE 3: LOWER THIRD / SCOREBUG (880–1040px, z-20, Protected Zone) ── */}
      {!hideLower && (
        <section
          className="bw-lower"
          style={{
            position: "absolute",
            top: "880px",
            height: "160px",
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
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="bw-scene-enter"
              style={{ width: "100%", height: "100%" }}
            >
              {isCricketScene && cricketModel ? (
                <CricketScorebar model={cricketModel} />
              ) : (
                <WaitingScene
                  model={
                    frame.scene === "WAITING"
                      ? (frame.model as any)
                      : {
                          headline: frame.branding.tournamentName
                            ? `${frame.branding.tournamentName} CRICKET`
                            : "BIDWAR CRICKET LIVE",
                          subline: "STANDBY FOR MATCH",
                        }
                  }
                />
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      {/* ── ZONE 4: FOOTER BAR (1040–1080px, z-20, Protected Zone) ── */}
      {!hideFooter && (
        <div
          style={{
            position: "absolute",
            top: "1040px",
            height: "40px",
            left: 0,
            right: 0,
            zIndex: OBS_V2.layer.scorebug,
          }}
        >
          <FooterBar
            left={
              isCricketScene && cricketModel ? (
                <FooterStatus chip={cricketModel.status.chip} text={cricketModel.status.text} />
              ) : (
                <FooterStatus
                  chip="STANDBY"
                  text={
                    frame.branding.tournamentAccent
                      ? `${frame.branding.tournamentName} ${frame.branding.tournamentAccent}`
                      : frame.branding.tournamentName
                  }
                />
              )
            }
            center={<SponsorTicker sponsors={frame.sponsors} />}
            right={
              <ConnectionStatus status={frame.feed.status} seconds={frame.feed.secondsSinceUpdate} />
            }
          />
        </div>
      )}
    </div>
  );
}
