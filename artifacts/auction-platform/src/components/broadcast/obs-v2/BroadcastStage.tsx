import { AnimatePresence, motion } from "framer-motion";
import { BroadcastFrameProvider, useBroadcastDirector } from "./director";
import type { BroadcastFrame } from "./contracts";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";
import { ObsV2EventGraphic } from "./obs-v2-event-graphic";
import {
  AssociateSponsorRail,
  BidWarLiveBrand,
  HeaderAccents,
  HeaderEnergy,
  HeaderFrame,
  TitleSponsor,
  TournamentBrand,
} from "./header/Header";
import { CricketScorebar } from "./lower/Cricket";
import {
  AuctionScene,
  BreakScene,
  SoldScene,
  SummaryScene,
  TeamScene,
  Top5Scene,
  UnsoldScene,
  WaitingScene,
} from "./lower/Scenes";
import {
  ConnectionStatus,
  FooterBar,
  FooterStat,
  FooterStatus,
  SponsorTicker,
  TeamTicker,
} from "./footer/Footer";

export interface BroadcastStageProps {
  frame?: BroadcastFrame;
  activeEvent?: ObsV2BroadcastEvent | null;
  className?: string;
  hideLower?: boolean;
  hideFooter?: boolean;
}

/**
 * 1920x1080 OBS canvas. Three zones:
 *   header   0–96
 *   CAMERA SAFE AREA 96–880 — intentionally no element rendered here
 *   lower third 880–1040, footer 1040–1080
 */
export function BroadcastStage({
  frame,
  activeEvent,
  className,
  hideLower = false,
  hideFooter = false,
}: BroadcastStageProps = {}) {
  if (frame) {
    return (
      <BroadcastFrameProvider frame={frame}>
        <BroadcastStageInner
          activeEvent={activeEvent}
          className={className}
          hideLower={hideLower}
          hideFooter={hideFooter}
        />
      </BroadcastFrameProvider>
    );
  }
  return (
    <BroadcastStageInner
      activeEvent={activeEvent}
      className={className}
      hideLower={hideLower}
      hideFooter={hideFooter}
    />
  );
}

function BroadcastStageInner({
  activeEvent,
  className,
  hideLower = false,
  hideFooter = false,
}: {
  activeEvent?: ObsV2BroadcastEvent | null;
  className?: string;
  hideLower?: boolean;
  hideFooter?: boolean;
}) {
  const frame = useBroadcastDirector();
  const title = frame.sponsors.find((s) => s.tier === "title");
  const associates = frame.sponsors.filter((s) => s.tier === "associate");

  return (
    <div
      className={`bw-stage ${className ?? ""}`}
      data-perf={frame.settings.performanceMode ? "on" : "off"}
      data-broadcast-scene={frame.scene}
    >
      <HeaderFrame>
        <HeaderEnergy />
        <HeaderAccents />
        <TournamentBrand branding={frame.branding} />
        <BidWarLiveBrand feed={frame.feed.status} />
        <AssociateSponsorRail sponsors={associates} />
        <TitleSponsor sponsor={title} />
      </HeaderFrame>

      {/* CAMERA SAFE AREA: nothing is rendered between y=96 and y=880. */}

      {/* Layer: Event Graphic (Transient Flash / Overlay) */}
      {activeEvent && (
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 200,
            zIndex: 50,
          }}
        >
          <ObsV2EventGraphic event={activeEvent} />
        </div>
      )}

      {!hideLower && (
        <section className="bw-lower">
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
              <SceneSwitch frame={frame} />
            </motion.div>
          </AnimatePresence>
        </section>
      )}

      {!hideFooter && (
        <FooterBar
          left={<FooterLeft frame={frame} />}
          center={frame.settings.showTicker ? <FooterTicker frame={frame} /> : null}
          right={<FooterRight frame={frame} />}
        />
      )}
    </div>
  );
}

/** Scene selection is purely a render of frame.scene — BidWar controls transitions. */
function SceneSwitch({ frame }: { frame: BroadcastFrame }) {
  switch (frame.scene) {
    case "CRICKET":
      return <CricketScorebar model={frame.model} />;
    case "WAITING":
      return <WaitingScene model={frame.model} />;
    case "AUCTION":
      return <AuctionScene model={frame.model} />;
    case "SOLD":
      return <SoldScene model={frame.model} />;
    case "UNSOLD":
      return <UnsoldScene model={frame.model} />;
    case "BREAK":
      return <BreakScene model={frame.model} sponsor={frame.sponsors.find((s) => s.tier === "title")} />;
    case "SUMMARY":
      return <SummaryScene model={frame.model} />;
    case "TOP5":
      return <Top5Scene model={frame.model} />;
    case "TEAM":
      return <TeamScene model={frame.model} />;
  }
}

const SCENE_CHIP: Record<BroadcastFrame["scene"], string> = {
  CRICKET: "LIVE",
  WAITING: "STANDBY",
  AUCTION: "AUCTION",
  SOLD: "SOLD",
  UNSOLD: "UNSOLD",
  BREAK: "BREAK",
  SUMMARY: "SUMMARY",
  TOP5: "TOP 5",
  TEAM: "TEAM",
};

function FooterLeft({ frame }: { frame: BroadcastFrame }) {
  if (frame.scene === "CRICKET") {
    return <FooterStatus chip={frame.model.status.chip} text={frame.model.status.text} />;
  }
  const subtitle = frame.branding.tournamentAccent
    ? `${frame.branding.tournamentName} ${frame.branding.tournamentAccent}`
    : frame.branding.tournamentName;
  return <FooterStatus chip={SCENE_CHIP[frame.scene]} text={subtitle} />;
}

function FooterTicker({ frame }: { frame: BroadcastFrame }) {
  const auctionish = ["AUCTION", "SOLD", "UNSOLD", "TEAM", "WAITING"].includes(frame.scene);
  return auctionish && frame.teams.length ? (
    <TeamTicker teams={frame.teams} />
  ) : (
    <SponsorTicker sponsors={frame.sponsors} />
  );
}

function FooterRight({ frame }: { frame: BroadcastFrame }) {
  return (
    <>
      <ConnectionStatus status={frame.feed.status} seconds={frame.feed.secondsSinceUpdate} />
      {frame.scene === "CRICKET" && <FooterStat label="CRR" value={frame.model.crr.toFixed(2)} />}
    </>
  );
}
