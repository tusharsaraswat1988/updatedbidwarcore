import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";

export type WeddingBallOutcome = "0" | "1" | "2" | "3" | "4" | "6" | "W" | "WD" | "NB" | "" | "PENDING";

export interface WeddingBallPillProps extends React.HTMLAttributes<HTMLDivElement> {
  outcome?: WeddingBallOutcome | string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WeddingBallPill
 * Circular delivery outcome indicator for the ball-by-ball sequence in the lower third.
 */
export const WeddingBallPill = React.forwardRef<HTMLDivElement, WeddingBallPillProps>(
  function WeddingBallPill(
    {
      outcome = "",
      size = WEDDING_TOKENS.canvas.scoreboard.ballPillSize,
      className = "",
      style,
      ...rest
    },
    ref
  ) {
    const clean = String(outcome || "").trim().toUpperCase();
    const isFour = clean === "4";
    const isSix = clean === "6";
    const isWicket = clean === "W" || clean.startsWith("W");
    const isEmpty = !clean || clean === "PENDING";

    // Dynamic styling based on ball outcome
    let background = "transparent";
    let border = `1px solid ${WEDDING_TOKENS.color.gold.border}`;
    let textColor = WEDDING_TOKENS.color.charcoal.ink;
    let textShadow = "none";

    if (isEmpty) {
      border = `1px dashed ${WEDDING_TOKENS.color.gold.hairline}`;
    } else if (isFour) {
      background = "linear-gradient(135deg, #F3CA68 0%, #D9981E 100%)";
      border = `1.5px solid ${WEDDING_TOKENS.color.gold.rich}`;
      textColor = "#2D1E04";
    } else if (isSix) {
      background = "linear-gradient(135deg, #1A6B4E 0%, #0F4230 100%)";
      border = `1.5px solid ${WEDDING_TOKENS.color.gold.borderStrong}`;
      textColor = WEDDING_TOKENS.color.ivory.pure;
      textShadow = "0 1px 2px rgba(0,0,0,0.5)";
    } else if (isWicket) {
      background = "linear-gradient(135deg, #9C1F37 0%, #6E1225 100%)";
      border = `1.5px solid ${WEDDING_TOKENS.color.gold.rich}`;
      textColor = WEDDING_TOKENS.color.ivory.pure;
      textShadow = "0 1px 2px rgba(0,0,0,0.5)";
    } else {
      // Normal run or dot
      background = WEDDING_TOKENS.color.ivory.pure;
      border = `1px solid ${WEDDING_TOKENS.color.gold.hairline}`;
      textColor = clean === "0" ? WEDDING_TOKENS.color.charcoal.muted : WEDDING_TOKENS.color.charcoal.ink;
    }

    return (
      <div
        ref={ref}
        className={`wedding-ball-pill inline-flex items-center justify-center rounded-full select-none ${className}`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          minWidth: `${size}px`,
          background,
          border,
          color: textColor,
          fontFamily: WEDDING_TOKENS.typography.family.sans,
          fontSize: `${WEDDING_TOKENS.typography.scale.ballPill.fontSize}px`,
          fontWeight: WEDDING_TOKENS.typography.scale.ballPill.fontWeight,
          lineHeight: 1,
          boxShadow: isFour || isSix || isWicket ? "0 2px 6px rgba(0,0,0,0.2)" : "none",
          textShadow,
          ...style,
        }}
        data-ball-outcome={clean || "empty"}
        {...rest}
      >
        {!isEmpty ? clean : null}
      </div>
    );
  }
);
