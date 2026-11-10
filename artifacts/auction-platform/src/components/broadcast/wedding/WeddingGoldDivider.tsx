import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";

export interface WeddingGoldDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  motif?: "diamond" | "knot" | "heart" | "none";
  length?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WeddingGoldDivider
 * A ceremonial gold accent divider with tapered rules and optional ornamental motifs.
 */
export const WeddingGoldDivider = React.forwardRef<HTMLDivElement, WeddingGoldDividerProps>(
  function WeddingGoldDivider(
    {
      orientation = "horizontal",
      motif = "diamond",
      length = "100%",
      className = "",
      style,
      ...rest
    },
    ref
  ) {
    const isHorizontal = orientation === "horizontal";

    if (isHorizontal) {
      return (
        <div
          ref={ref}
          role="separator"
          aria-orientation="horizontal"
          className={`wedding-gold-divider flex items-center justify-center ${className}`}
          style={{
            width: typeof length === "number" ? `${length}px` : length,
            height: "16px",
            ...style,
          }}
          {...rest}
        >
          {/* Left tapered line */}
          <div
            className="flex-1 h-[1px]"
            style={{
              background: `linear-gradient(90deg, transparent 0%, ${WEDDING_TOKENS.color.gold.border} 100%)`,
            }}
          />

          {/* Center motif */}
          {motif === "diamond" && (
            <span
              className="mx-2.5 inline-block rotate-45 transform"
              style={{
                width: "6px",
                height: "6px",
                backgroundColor: WEDDING_TOKENS.color.gold.champagne,
                border: `1px solid ${WEDDING_TOKENS.color.gold.deep}`,
                boxShadow: `0 0 6px ${WEDDING_TOKENS.color.gold.glow}`,
              }}
            />
          )}

          {motif === "heart" && (
            <span
              className="mx-2.5 text-xs select-none"
              style={{
                color: WEDDING_TOKENS.color.gold.rich,
                textShadow: `0 0 6px ${WEDDING_TOKENS.color.gold.glow}`,
              }}
            >
              ♥
            </span>
          )}

          {motif === "knot" && (
            <span
              className="mx-2 text-xs select-none"
              style={{
                color: WEDDING_TOKENS.color.gold.antique,
                letterSpacing: "0.1em",
              }}
            >
              ❖
            </span>
          )}

          {/* Right tapered line */}
          <div
            className="flex-1 h-[1px]"
            style={{
              background: `linear-gradient(90deg, ${WEDDING_TOKENS.color.gold.border} 0%, transparent 100%)`,
            }}
          />
        </div>
      );
    }

    // Vertical Divider
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation="vertical"
        className={`wedding-gold-divider flex flex-col items-center justify-center ${className}`}
        style={{
          height: typeof length === "number" ? `${length}px` : length,
          width: "16px",
          ...style,
        }}
        {...rest}
      >
        <div
          className="flex-1 w-[1px]"
          style={{
            background: `linear-gradient(180deg, transparent 0%, ${WEDDING_TOKENS.color.gold.border} 100%)`,
          }}
        />
        {motif === "diamond" && (
          <span
            className="my-1.5 inline-block rotate-45 transform"
            style={{
              width: "5px",
              height: "5px",
              backgroundColor: WEDDING_TOKENS.color.gold.champagne,
              border: `1px solid ${WEDDING_TOKENS.color.gold.deep}`,
            }}
          />
        )}
        <div
          className="flex-1 w-[1px]"
          style={{
            background: `linear-gradient(180deg, ${WEDDING_TOKENS.color.gold.border} 0%, transparent 100%)`,
          }}
        />
      </div>
    );
  }
);
