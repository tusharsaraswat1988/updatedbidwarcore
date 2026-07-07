import { memo } from "react";
import { motion } from "framer-motion";
import { BROADCAST_OVERLAY_PANEL_PADDING_X } from "@/lib/broadcast-overlay";
import type { SummarySceneModel } from "../director/types";
import { BROADCAST_FONTS } from "../tokens";

type SummaryLowerThirdProps = {
  model: SummarySceneModel;
  bottomOffset: number;
};

/** Compact tournament summary — stays inside the lower-third band. */
export const SummaryLowerThird = memo(function SummaryLowerThird({
  model,
  bottomOffset,
}: SummaryLowerThirdProps) {
  return (
    <motion.div
      initial={{ y: 60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 60, opacity: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 28 }}
      style={{
        position: "absolute",
        bottom: bottomOffset,
        left: 0,
        right: 0,
        zIndex: 30,
      }}
    >
      <div
        style={{
          height: 16,
          background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.45))",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          background: "rgba(0,0,0,0.92)",
          borderTop: "3px solid rgba(245,158,11,0.85)",
          padding: `18px ${BROADCAST_OVERLAY_PANEL_PADDING_X}px`,
        }}
      >
        <div
          style={{
            fontFamily: BROADCAST_FONTS.display,
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: "0.28em",
            color: "rgba(245,158,11,0.9)",
            marginBottom: 12,
          }}
        >
          {model.title}
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px 32px",
            alignItems: "center",
          }}
        >
          {model.stats.map((stat) => (
            <div key={stat.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "0.2em",
                  color: "rgba(255,255,255,0.45)",
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontFamily: BROADCAST_FONTS.display,
                  fontSize: 28,
                  fontWeight: 900,
                  color: "#fff",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
});
