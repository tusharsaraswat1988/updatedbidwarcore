import { memo } from "react";
import type { BidTimelineEntry } from "./types";
import { BROADCAST_FONTS } from "./tokens";

type BidTimelineProps = {
  entries: BidTimelineEntry[];
  formatAmount: (n: number) => string;
  accentColor: string;
};

export const BidTimeline = memo(function BidTimeline({
  entries,
  formatAmount,
  accentColor,
}: BidTimelineProps) {
  if (!entries.length) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        gap: 0,
        overflow: "hidden",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          background: accentColor,
          color: "#0a0a0a",
          fontFamily: BROADCAST_FONTS.display,
          fontSize: 13,
          letterSpacing: "0.15em",
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        BIDS
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 0,
          overflow: "hidden",
          flex: 1,
        }}
      >
        {entries.slice(-6).map((e, i) => (
          <div
            key={e.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRight: i < entries.length - 1 ? "1px solid rgba(255,255,255,0.06)" : undefined,
              opacity: i === entries.length - 1 ? 1 : 0.55,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: e.teamColor ?? accentColor,
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>{e.teamName}</span>
            <span
              style={{
                fontFamily: BROADCAST_FONTS.mono,
                fontSize: 13,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                color: accentColor,
              }}
            >
              {formatAmount(e.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
});
