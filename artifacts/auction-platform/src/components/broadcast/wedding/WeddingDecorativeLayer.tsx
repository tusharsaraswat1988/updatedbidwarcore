import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";

export interface WeddingDecorativeLayerProps extends React.HTMLAttributes<HTMLDivElement> {
  showAmbientGlow?: boolean;
  showTopVignette?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WeddingDecorativeLayer
 * Broadcast background ambient layer providing soft royal warmth
 * while strictly maintaining 100% camera transparency in the safe action zone.
 */
export const WeddingDecorativeLayer = React.forwardRef<HTMLDivElement, WeddingDecorativeLayerProps>(
  function WeddingDecorativeLayer(
    {
      showAmbientGlow = true,
      showTopVignette = false,
      className = "",
      style,
      ...rest
    },
    ref
  ) {
    return (
      <div
        ref={ref}
        aria-hidden="true"
        className={`wedding-decorative-layer pointer-events-none absolute inset-0 select-none overflow-hidden ${className}`}
        style={{
          zIndex: WEDDING_TOKENS.layer.ambientLights,
          ...style,
        }}
        {...rest}
      >
        {/* Soft Golden Header Aura — gently emphasizes the tournament plaque */}
        {showAmbientGlow && (
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            style={{
              width: "800px",
              height: "220px",
              background: "radial-gradient(ellipse at top, rgba(229, 195, 120, 0.18) 0%, transparent 70%)",
            }}
          />
        )}

        {/* Soft Golden Scoreboard Aura — anchors the lower third without darkening camera safe area */}
        {showAmbientGlow && (
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{
              width: "1380px",
              height: "240px",
              background: "radial-gradient(ellipse at bottom, rgba(212, 175, 55, 0.12) 0%, transparent 70%)",
            }}
          />
        )}

        {/* Optional subtle top edge vignette for non-transparent preview backdrops */}
        {showTopVignette && (
          <div
            className="absolute top-0 left-0 right-0 h-16"
            style={{
              background: "linear-gradient(180deg, rgba(30, 20, 16, 0.25) 0%, transparent 100%)",
            }}
          />
        )}
      </div>
    );
  }
);
