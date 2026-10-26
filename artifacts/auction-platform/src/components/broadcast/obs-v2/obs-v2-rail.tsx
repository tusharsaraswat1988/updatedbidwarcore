import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { OBS_V2 } from "./obs-v2-tokens";

export type ObsV2RailVariant =
  | "brand"
  | "info"
  | "danger"
  | "warning"
  | "success"
  | "neutral"
  | "divider";

export type ObsV2RailThickness = "hairline" | "standard" | "hero";

export interface ObsV2RailProps extends HTMLAttributes<HTMLDivElement> {
  variant?: ObsV2RailVariant;
  thickness?: ObsV2RailThickness;
  orientation?: "horizontal" | "vertical";
  gleam?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2Rail — Structural Broadcast Accent Rail
 *
 * Implements:
 * - High-contrast continuous 2px television rules (e.g. #FFD700 BidWar Gold top rail).
 * - Semantic alerts (Wicket Red, Free Hit Cyan, Milestone Green).
 * - Section dividers and vertical rails.
 */
export const ObsV2Rail = forwardRef<HTMLDivElement, ObsV2RailProps>(
  function ObsV2Rail(
    {
      variant = "brand",
      thickness = "standard",
      orientation = "horizontal",
      gleam = false,
      className = "",
      style,
      ...rest
    },
    ref,
  ) {
    const size =
      thickness === "hairline"
        ? OBS_V2.geometry.rail.hairline
        : thickness === "hero"
          ? OBS_V2.geometry.rail.hero
          : OBS_V2.geometry.rail.standard;

    let backgroundColor: string = OBS_V2.color.brand;
    if (variant === "info") backgroundColor = OBS_V2.color.info;
    else if (variant === "danger") backgroundColor = OBS_V2.color.danger;
    else if (variant === "warning") backgroundColor = OBS_V2.color.warning;
    else if (variant === "success") backgroundColor = OBS_V2.color.success;
    else if (variant === "neutral") backgroundColor = OBS_V2.color.neutral;
    else if (variant === "divider") backgroundColor = OBS_V2.color.divider;

    const baseStyle: CSSProperties = {
      backgroundColor,
      position: "relative",
      overflow: "hidden",
      ...(orientation === "horizontal"
        ? {
            width: "100%",
            height: `${size}px`,
          }
        : {
            height: "100%",
            width: `${size}px`,
          }),
      ...style,
    };

    return (
      <div
        ref={ref}
        className={`obs-v2-rail ${className}`}
        style={baseStyle}
        data-rail-variant={variant}
        data-rail-thickness={thickness}
        {...rest}
      >
        {gleam && variant === "brand" ? (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: OBS_V2.color.gradient.brandGleam,
            }}
          />
        ) : null}
      </div>
    );
  },
);
