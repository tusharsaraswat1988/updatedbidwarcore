import { memo } from "react";
import { motion } from "framer-motion";
import { BIDWAR_BROADCAST_YELLOW } from "@/lib/bidwar-broadcast-colors";
import { BROADCAST_OVERLAY_PANEL_PADDING_X } from "@/lib/broadcast-overlay";
import type { SoldSceneModel, UnsoldSceneModel } from "../director/types";
import { HexPhoto } from "./hex-photo";
import { OBS_BID_PANEL, SOLD_SEQUENCE } from "./obs-tokens";

type OutcomeLowerThirdProps = {
  model: SoldSceneModel | UnsoldSceneModel;
  formatAmount: (n: number) => string;
  bottomOffset: number;
};

const stampEase = [0.34, 1.2, 0.64, 1] as const;

/** Sold/unsold — same lower-third patti; sold uses staged in-panel animation. */
export const OutcomeLowerThird = memo(function OutcomeLowerThird({
  model,
  formatAmount,
  bottomOffset,
}: OutcomeLowerThirdProps) {
  const isSold = model.kind === "SOLD";
  const accent = isSold ? model.teamColor : "#ef4444";
  const gold = BIDWAR_BROADCAST_YELLOW;
  const { player } = model;

  return (
    <motion.div
      key={`${model.kind}-${player.name}`}
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
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
          position: "relative",
          background: "rgba(0,0,0,0.94)",
          borderTop: `3px solid ${accent}`,
          boxShadow: `0 -4px 40px ${accent}33`,
          padding: `${OBS_BID_PANEL.paddingY}px ${BROADCAST_OVERLAY_PANEL_PADDING_X}px`,
          display: "flex",
          alignItems: "center",
          gap: OBS_BID_PANEL.contentGap,
        }}
      >
        {isSold && (
          <motion.div
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55, 0] }}
            transition={{
              duration: SOLD_SEQUENCE.goldPulseMs / 1000,
              ease: "easeOut",
            }}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `radial-gradient(ellipse at 50% 0%, ${gold}55 0%, transparent 70%)`,
              boxShadow: `inset 0 0 40px ${gold}33`,
            }}
          />
        )}

        <motion.div
          initial={{ opacity: 0, scale: 0.85, rotate: -10 }}
          animate={{ opacity: 1, scale: 1, rotate: -3 }}
          transition={{
            delay: isSold ? SOLD_SEQUENCE.stampDelayMs / 1000 : 0,
            duration: isSold ? SOLD_SEQUENCE.stampDurationMs / 1000 : 0.35,
            ease: stampEase,
          }}
          style={{
            flexShrink: 0,
            fontFamily: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
            fontSize: 36,
            fontWeight: 900,
            letterSpacing: "0.06em",
            color: isSold ? gold : accent,
            textShadow: isSold ? `0 0 20px ${gold}aa` : `0 0 20px ${accent}`,
            border: `3px solid ${isSold ? gold : accent}`,
            padding: "4px 14px",
            borderRadius: 8,
            lineHeight: 1,
          }}
        >
          {isSold ? "SOLD" : "UNSOLD"}
        </motion.div>

        <HexPhoto
          src={player.photoUrl}
          color={accent}
          size={OBS_BID_PANEL.hexSize}
          playerTag={player.playerTag}
        />

        <div style={{ flex: 1, minWidth: 0 }}>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: isSold ? SOLD_SEQUENCE.teamDelayMs / 1000 : 0.15,
              duration: isSold ? SOLD_SEQUENCE.teamDurationMs / 1000 : 0.35,
              ease: "easeOut",
            }}
          >
            <div
              style={{
                fontSize: OBS_BID_PANEL.statusFont,
                fontWeight: 700,
                color: accent,
                letterSpacing: "0.22em",
                marginBottom: OBS_BID_PANEL.statusGap,
              }}
            >
              {isSold ? "PLAYER SOLD" : "PLAYER UNSOLD"}
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
              }}
            >
              {player.name}
            </div>
            <div
              style={{
                fontSize: OBS_BID_PANEL.metaFont,
                color: isSold ? accent : "rgba(255,255,255,0.75)",
                fontWeight: isSold ? 700 : 500,
                marginTop: OBS_BID_PANEL.metaMt,
              }}
            >
              {isSold
                ? `Acquired by ${model.teamName}`
                : model.reason ?? "Returns to the player pool"}
            </div>
          </motion.div>
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
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: isSold ? SOLD_SEQUENCE.priceDelayMs / 1000 : 0.25,
              duration: isSold ? SOLD_SEQUENCE.priceDurationMs / 1000 : 0.35,
              ease: stampEase,
            }}
          >
            <div
              style={{
                fontSize: OBS_BID_PANEL.bidLabelFont,
                color: isSold ? gold : "rgba(255,255,255,0.85)",
                fontWeight: 800,
                letterSpacing: "0.18em",
                marginBottom: OBS_BID_PANEL.bidLabelMb,
              }}
            >
              {isSold ? "SOLD FOR" : "RESULT"}
            </div>
            <div
              style={{
                fontSize: OBS_BID_PANEL.bidFont,
                fontWeight: 900,
                color: isSold ? gold : accent,
                lineHeight: 1,
                textShadow: "0 2px 12px rgba(0,0,0,0.95)",
                filter: isSold ? `drop-shadow(0 0 14px ${gold}88)` : `drop-shadow(0 0 12px ${accent}88)`,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {isSold ? formatAmount(model.soldAmount) : "UNSOLD"}
            </div>
            {isSold && model.teamLogoSrc && (
              <div
                style={{
                  marginTop: OBS_BID_PANEL.bidTeamMt,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 6px ${accent}`,
                  }}
                />
                <img
                  src={model.teamLogoSrc}
                  alt=""
                  style={{ height: OBS_BID_PANEL.teamLogoH + 4, objectFit: "contain" }}
                />
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
});
