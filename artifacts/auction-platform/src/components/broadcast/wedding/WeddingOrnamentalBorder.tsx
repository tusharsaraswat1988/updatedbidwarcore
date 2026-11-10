import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";

export interface WeddingOrnamentalBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  variant?: "gold" | "subtle" | "double" | "burgundy" | "navy";
  hasFlourishes?: boolean;
  insetOffset?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Corner flourish SVG ornament — lightweight, crisp vector filigree
 */
function CornerFlourish({ position }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) {
  const transform =
    position === "top-right"
      ? "scale(-1, 1)"
      : position === "bottom-left"
      ? "scale(1, -1)"
      : position === "bottom-right"
      ? "scale(-1, -1)"
      : undefined;

  const style: React.CSSProperties = {
    position: "absolute",
    width: "18px",
    height: "18px",
    pointerEvents: "none",
    top: position.startsWith("top") ? "3px" : undefined,
    bottom: position.startsWith("bottom") ? "3px" : undefined,
    left: position.endsWith("left") ? "3px" : undefined,
    right: position.endsWith("right") ? "3px" : undefined,
    transform,
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
      aria-hidden="true"
    >
      <path
        d="M2 22V8C2 4.68629 4.68629 2 8 2H22"
        stroke={WEDDING_TOKENS.color.gold.rich}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="8" cy="8" r="2" fill={WEDDING_TOKENS.color.gold.champagne} />
      <path
        d="M5 14C5 9.02944 9.02944 5 14 5"
        stroke={WEDDING_TOKENS.color.gold.pale}
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * WeddingOrnamentalBorder
 * Provides a double-lined gold ornamental border with corner flourishes
 * for luxury wedding plaques, score pods, and team badges.
 */
export const WeddingOrnamentalBorder = React.forwardRef<HTMLDivElement, WeddingOrnamentalBorderProps>(
  function WeddingOrnamentalBorder(
    {
      children,
      variant = "gold",
      hasFlourishes = false,
      insetOffset = 4,
      className = "",
      style,
      ...rest
    },
    ref
  ) {
    const borderColor =
      variant === "gold"
        ? WEDDING_TOKENS.color.gold.border
        : variant === "double"
        ? WEDDING_TOKENS.color.gold.borderStrong
        : variant === "burgundy"
        ? WEDDING_TOKENS.color.burgundy.base
        : variant === "navy"
        ? WEDDING_TOKENS.color.navy.base
        : WEDDING_TOKENS.color.gold.hairline;

    return (
      <div
        ref={ref}
        className={`wedding-ornamental-border relative ${className}`}
        style={{
          border: `1.5px solid ${borderColor}`,
          borderRadius: `${WEDDING_TOKENS.geometry.radius.lg}px`,
          boxShadow: WEDDING_TOKENS.depth.shadow.subtle,
          ...style,
        }}
        {...rest}
      >
        {/* Inner delicate hairline frame */}
        <div
          className="absolute pointer-events-none rounded-[inherit]"
          style={{
            top: `${insetOffset}px`,
            left: `${insetOffset}px`,
            right: `${insetOffset}px`,
            bottom: `${insetOffset}px`,
            border: `0.75px solid ${WEDDING_TOKENS.color.gold.hairline}`,
            borderRadius: `${Math.max(2, WEDDING_TOKENS.geometry.radius.lg - insetOffset)}px`,
          }}
        />

        {/* Optional corner flourishes */}
        {hasFlourishes && (
          <>
            <CornerFlourish position="top-left" />
            <CornerFlourish position="top-right" />
            <CornerFlourish position="bottom-left" />
            <CornerFlourish position="bottom-right" />
          </>
        )}

        {children}
      </div>
    );
  }
);
