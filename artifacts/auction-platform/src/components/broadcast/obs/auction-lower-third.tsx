import { memo } from "react";
import { motion } from "framer-motion";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
  BIDWAR_BROADCAST_YELLOW_SOFT,
} from "@/lib/bidwar-broadcast-colors";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";
import { BROADCAST_OVERLAY_PANEL_PADDING_X } from "@/lib/broadcast-overlay";
import type { AuctionSceneModel } from "../director/types";
import { CountdownRing } from "./countdown-ring";
import { HexPhoto } from "./hex-photo";
import { BID_PULSE_DURATION_MS, OBS_BID_PANEL } from "./obs-tokens";

type AuctionLowerThirdProps = {
  model: AuctionSceneModel;
  formatAmount: (n: number) => string;
  freezeBidUpdates: boolean;
  dimmed: boolean;
  bottomOffset: number;
};

export const AuctionLowerThird = memo(function AuctionLowerThird({
  model,
  formatAmount: _formatAmount,
  freezeBidUpdates,
  dimmed,
  bottomOffset,
}: AuctionLowerThirdProps) {
  const player = model.player;
  if (!player) return null;

  const isActive = model.phase === "live";
  const hasBid = !!model.bidTeamName;
  const panelAccent = BIDWAR_BROADCAST_YELLOW;
  const teamAccent = model.bidColor || panelAccent;
  const borderAccent = isActive && hasBid ? teamAccent : isActive ? panelAccent : "rgba(255,255,255,0.1)";

  return (
    <motion.div
      key={player.name}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: dimmed ? 0.4 : 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 0,
        right: 0,
        zIndex: 30,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: 24,
          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          background: "rgba(0,0,0,0.94)",
          borderTop: `3px solid ${borderAccent}`,
          boxShadow: isActive
            ? `0 -4px 40px ${hasBid ? `${teamAccent}44` : `${panelAccent}33`}`
            : "none",
          padding: `${OBS_BID_PANEL.paddingY}px ${BROADCAST_OVERLAY_PANEL_PADDING_X}px`,
          display: "flex",
          alignItems: "center",
          gap: OBS_BID_PANEL.contentGap,
        }}
      >
        <HexPhoto
          src={player.photoUrl}
          color={isActive ? (hasBid ? teamAccent : panelAccent) : "#666"}
          size={OBS_BID_PANEL.hexSize}
          playerTag={player.playerTag}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: OBS_BID_PANEL.statusGap,
            }}
          >
            {isActive ? (
              <>
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: hasBid ? teamAccent : "#22c55e",
                    animation: "livePulse 1s infinite",
                    boxShadow: hasBid ? `0 0 8px ${teamAccent}` : undefined,
                  }}
                />
                <span
                  style={{
                    fontSize: OBS_BID_PANEL.statusFont,
                    fontWeight: 700,
                    color: hasBid ? teamAccent : "#22c55e",
                    letterSpacing: "0.25em",
                  }}
                >
                  LIVE AUCTION
                </span>
              </>
            ) : (
              <span
                style={{
                  fontSize: OBS_BID_PANEL.statusFont,
                  fontWeight: 700,
                  color: "#71717a",
                  letterSpacing: "0.25em",
                }}
              >
                UP NEXT
              </span>
            )}
          </div>

          <div
            style={{
              fontSize: OBS_BID_PANEL.nameFont,
              fontWeight: 900,
              color: "#fff",
              lineHeight: 1.05,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              textTransform: "uppercase",
              letterSpacing: OBS_BID_PANEL.nameLetterSpacing,
              textShadow: "0 2px 8px rgba(0,0,0,0.9)",
              WebkitFontSmoothing: "antialiased",
              textRendering: "optimizeLegibility",
            }}
          >
            {player.name}
          </div>

          {(() => {
            const tt = getTagTheme(player.playerTag);
            return tt ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  marginTop: OBS_BID_PANEL.tagMt,
                  padding: `${OBS_BID_PANEL.tagPy}px ${OBS_BID_PANEL.tagPx}px`,
                  borderRadius: 999,
                  fontSize: OBS_BID_PANEL.tagFont,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  background: tt.bg,
                  border: `1.5px solid ${tt.border}`,
                  color: tt.color,
                  boxShadow: `0 0 10px ${tt.glow}`,
                  animation: TAG_PULSE_ANIMATION,
                }}
              >
                {tt.label}
              </div>
            ) : null;
          })()}

          <div
            style={{
              fontSize: OBS_BID_PANEL.metaFont,
              color: "rgba(255,255,255,0.80)",
              marginTop: OBS_BID_PANEL.metaMt,
              display: "flex",
              gap: 10,
            }}
          >
            {player.category && <span>{player.category}</span>}
            {player.city && <span style={{ opacity: 0.6 }}>· {player.city}</span>}
          </div>

          <div
            style={{
              marginTop: OBS_BID_PANEL.baseMt,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(0,0,0,0.55)",
              border: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
              borderRadius: 6,
              padding: `${OBS_BID_PANEL.basePy}px ${OBS_BID_PANEL.basePx}px`,
            }}
          >
            <div
              style={{ width: 5, height: 5, borderRadius: "50%", background: panelAccent }}
            />
            <span
              style={{
                fontSize: OBS_BID_PANEL.baseLabelFont,
                color: BIDWAR_BROADCAST_YELLOW,
                fontWeight: 700,
                letterSpacing: "0.12em",
              }}
            >
              BASE VALUE
            </span>
            <span
              style={{
                fontSize: OBS_BID_PANEL.baseValueFont,
                color: "#fff",
                fontWeight: 800,
                fontFamily: "monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {player.basePriceLabel}
            </span>
          </div>
        </div>

        <div
          style={{
            width: 1,
            height: OBS_BID_PANEL.dividerHeight,
            background: "rgba(255,255,255,0.08)",
            flexShrink: 0,
          }}
        />

        <div
          style={{
            textAlign: "right",
            flexShrink: 0,
            minWidth: OBS_BID_PANEL.bidSectionMinW,
          }}
        >
          {hasBid ? (
            <BidBlock
              label="CURRENT BID"
              amount={model.bidAmountLabel}
              color={teamAccent}
              teamName={model.bidTeamName}
              teamLogoSrc={model.bidTeamLogoSrc}
              animateAmount={!freezeBidUpdates}
            />
          ) : (
            <div>
              <div
                style={{
                  fontSize: OBS_BID_PANEL.bidLabelFont,
                  color: "rgba(255,255,255,0.95)",
                  fontWeight: 800,
                  letterSpacing: "0.18em",
                  marginBottom: OBS_BID_PANEL.bidLabelMb,
                }}
              >
                OPENING BID
              </div>
              <div
                style={{
                  fontSize: OBS_BID_PANEL.bidFont,
                  fontWeight: 900,
                  color: "rgba(255,255,255,0.95)",
                  lineHeight: 1,
                  textShadow: "0 2px 10px rgba(0,0,0,0.9)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {model.bidAmountLabel}
              </div>
              <div
                style={{
                  fontSize: OBS_BID_PANEL.hintFont,
                  color: "rgba(255,255,255,0.80)",
                  marginTop: OBS_BID_PANEL.bidTeamMt,
                }}
              >
                Waiting for first bid...
              </div>
            </div>
          )}
        </div>

        {isActive && !freezeBidUpdates && model.timerEndsAt && (
          <>
            <div
              style={{
                width: 1,
                height: OBS_BID_PANEL.dividerHeight,
                background: "rgba(255,255,255,0.08)",
                flexShrink: 0,
              }}
            />
            <CountdownRing timerEndsAt={model.timerEndsAt} size={OBS_BID_PANEL.countdownSize} />
          </>
        )}
      </div>
    </motion.div>
  );
});

function BidBlock({
  label,
  amount,
  color,
  teamName,
  teamLogoSrc,
  animateAmount,
}: {
  label: string;
  amount: string;
  color: string;
  teamName: string | null;
  teamLogoSrc: string | null;
  animateAmount: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: OBS_BID_PANEL.bidLabelFont,
          color: "rgba(255,255,255,0.92)",
          fontWeight: 800,
          letterSpacing: "0.18em",
          marginBottom: OBS_BID_PANEL.bidLabelMb,
        }}
      >
        {label}
      </div>
      {animateAmount ? (
        <motion.div
          key={amount}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: BID_PULSE_DURATION_MS / 1000, ease: "easeOut" }}
          style={{
            fontSize: OBS_BID_PANEL.bidFont,
            fontWeight: 900,
            color,
            lineHeight: 1,
            textShadow: "0 2px 12px rgba(0,0,0,0.95)",
            filter: `drop-shadow(0 0 14px ${color}99)`,
            fontVariantNumeric: "tabular-nums",
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {amount}
        </motion.div>
      ) : (
        <div
          style={{
            fontSize: OBS_BID_PANEL.bidFont,
            fontWeight: 900,
            color,
            lineHeight: 1,
            textShadow: "0 2px 12px rgba(0,0,0,0.95)",
            filter: `drop-shadow(0 0 14px ${color}99)`,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {amount}
        </div>
      )}
      {teamName && (
        <div
          style={{
            marginTop: OBS_BID_PANEL.bidTeamMt,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          {teamLogoSrc && (
            <img
              src={teamLogoSrc}
              alt=""
              style={{ height: OBS_BID_PANEL.teamLogoH, objectFit: "contain" }}
            />
          )}
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: color,
              flexShrink: 0,
              boxShadow: `0 0 6px ${color}`,
            }}
          />
          <span
            style={{
              fontSize: OBS_BID_PANEL.teamFont,
              color,
              fontWeight: 700,
            }}
          >
            {teamName}
          </span>
        </div>
      )}
    </div>
  );
}
