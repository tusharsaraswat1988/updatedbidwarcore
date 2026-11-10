import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";

export type WeddingSurfaceVariant =
  | "parchment"
  | "parchmentInset"
  | "bride"
  | "groom"
  | "emerald"
  | "medallion";

export interface WeddingSurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: WeddingSurfaceVariant;
  elevation?: "flat" | "subtle" | "parchment" | "elevated" | "dramatic";
  hasRim?: boolean;
  radius?: keyof typeof WEDDING_TOKENS.geometry.radius;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WeddingSurface
 * Reusable surface container for wedding broadcast cards, team pods,
 * score boxes, and stats ribbons.
 */
export const WeddingSurface = React.forwardRef<HTMLDivElement, WeddingSurfaceProps>(
  function WeddingSurface(
    {
      variant = "parchment",
      elevation = "parchment",
      hasRim = true,
      radius = "lg",
      children,
      className = "",
      style,
      ...rest
    },
    ref
  ) {
    // Resolve background based on variant
    const background =
      variant === "parchment"
        ? WEDDING_TOKENS.color.gradient.parchment
        : variant === "parchmentInset"
        ? WEDDING_TOKENS.color.gradient.parchmentInset
        : variant === "bride"
        ? WEDDING_TOKENS.color.gradient.brideVelvet
        : variant === "groom"
        ? WEDDING_TOKENS.color.gradient.groomVelvet
        : variant === "emerald"
        ? WEDDING_TOKENS.color.emerald.base
        : WEDDING_TOKENS.color.gradient.vsMedallion;

    // Resolve shadow
    const boxShadow =
      elevation === "flat"
        ? "none"
        : elevation === "subtle"
        ? WEDDING_TOKENS.depth.shadow.subtle
        : elevation === "parchment"
        ? WEDDING_TOKENS.depth.shadow.parchment
        : elevation === "elevated"
        ? WEDDING_TOKENS.depth.shadow.elevated
        : WEDDING_TOKENS.depth.shadow.dramatic;

    // Resolve rim border
    const border = hasRim
      ? variant === "bride" || variant === "groom"
        ? `1.5px solid ${WEDDING_TOKENS.color.gold.borderStrong}`
        : variant === "parchmentInset"
        ? `1px solid ${WEDDING_TOKENS.color.ivory.dim}`
        : `1px solid ${WEDDING_TOKENS.color.gold.border}`
      : "none";

    const borderRadius = `${WEDDING_TOKENS.geometry.radius[radius]}px`;

    return (
      <div
        ref={ref}
        className={`wedding-surface relative overflow-hidden ${className}`}
        style={{
          background,
          border,
          borderRadius,
          boxShadow,
          ...style,
        }}
        data-wedding-surface={variant}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
