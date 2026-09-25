import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { OBS_V2 } from "./obs-v2-tokens";

export type ObsV2SurfaceLevel = "surface" | "elevated" | "hero" | "inset";
export type ObsV2SurfaceRail = "none" | "brand" | "info" | "danger" | "warning" | "success";
export type ObsV2SurfaceChamfer = "none" | "sm" | "md" | "lg";
export type ObsV2SurfaceChamferPos = "top-right" | "both-right" | "slanted";

export interface ObsV2SurfaceProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** Surface elevation level in the obsidian hierarchy */
  level?: ObsV2SurfaceLevel;
  /** Integrated broadcast accent rail */
  rail?: ObsV2SurfaceRail;
  /** Rail placement */
  railPosition?: "top" | "bottom" | "left" | "right";
  /** Controlled broadcast geometric cut */
  chamfer?: ObsV2SurfaceChamfer;
  /** Chamfer placement style */
  chamferPosition?: ObsV2SurfaceChamferPos;
  /** Glow intensity based on rail/brand color */
  glow?: boolean;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2Surface — Authoritative Layered Dark Obsidian Surface
 *
 * Implements:
 * - Subdued obsidian/carbon gradient backgrounds (never flat grey or washed out).
 * - High-precision borders and top-edge specular hairlines.
 * - Restrained broadcast geometry (chamfers, controlled radii).
 * - Optional structural accent rail (e.g. 2px BidWar Gold).
 */
export const ObsV2Surface = forwardRef<HTMLDivElement, ObsV2SurfaceProps>(
  function ObsV2Surface(
    {
      children,
      level = "surface",
      rail = "none",
      railPosition = "top",
      chamfer = "none",
      chamferPosition = "top-right",
      glow = false,
      className = "",
      style,
      ...rest
    },
    ref,
  ) {
    // 1. Resolve background & border based on level
    let background: string = OBS_V2.color.gradient.panel;
    let border = `1px solid ${OBS_V2.color.standard}`;
    let shadow: string = OBS_V2.depth.shadow.standard;
    let borderRadius: number | string = OBS_V2.geometry.radius.sm;

    if (level === "elevated") {
      background = OBS_V2.color.gradient.elevated;
      border = `1px solid ${OBS_V2.color.strong}`;
      shadow = OBS_V2.depth.shadow.elevated;
    } else if (level === "hero") {
      background = OBS_V2.color.gradient.hero;
      border = `1px solid ${OBS_V2.color.brandBorder}`;
      shadow = OBS_V2.depth.shadow.hero;
    } else if (level === "inset") {
      background = OBS_V2.color.gradient.inset;
      border = `1px solid ${OBS_V2.color.hairline}`;
      shadow = OBS_V2.depth.shadow.inset;
    }

    // 2. Resolve chamfer cut
    let clipPath: string | undefined;
    if (chamfer !== "none") {
      borderRadius = 0; // Chamfers override normal border-radius
      const size =
        chamfer === "sm"
          ? OBS_V2.geometry.chamfer.sm
          : chamfer === "lg"
            ? OBS_V2.geometry.chamfer.lg
            : OBS_V2.geometry.chamfer.md;

      if (chamferPosition === "top-right") {
        clipPath = OBS_V2.geometry.chamfer.clipTopRight(size);
      } else if (chamferPosition === "both-right") {
        clipPath = OBS_V2.geometry.chamfer.clipBothRight(size);
      } else if (chamferPosition === "slanted") {
        clipPath = OBS_V2.geometry.chamfer.clipSlanted(size * 2);
      }
    }

    // 3. Resolve Rail Color
    let railColor: string | null = null;
    if (rail === "brand") railColor = OBS_V2.color.brand;
    else if (rail === "info") railColor = OBS_V2.color.info;
    else if (rail === "danger") railColor = OBS_V2.color.danger;
    else if (rail === "warning") railColor = OBS_V2.color.warning;
    else if (rail === "success") railColor = OBS_V2.color.success;

    // 4. Resolve Ambient Glow
    let boxShadow = shadow;
    if (glow && railColor) {
      boxShadow = `${shadow}, 0 0 16px ${
        rail === "brand"
          ? OBS_V2.color.brandGlow
          : rail === "danger"
            ? OBS_V2.color.dangerGlow
            : rail === "info"
              ? OBS_V2.color.infoGlow
              : rail === "success"
                ? OBS_V2.color.successGlow
                : OBS_V2.color.warningGlow
      }`;
    }

    const surfaceStyle: CSSProperties = {
      background,
      border,
      borderRadius,
      boxShadow,
      clipPath,
      position: "relative",
      ...style,
    };

    return (
      <div
        ref={ref}
        className={`obs-v2-surface ${className}`}
        style={surfaceStyle}
        data-surface-level={level}
        data-surface-rail={rail}
        {...rest}
      >
        {/* Integrated Accent Rail */}
        {railColor ? (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              ...(railPosition === "top"
                ? {
                    top: 0,
                    left: 0,
                    right: 0,
                    height: OBS_V2.geometry.rail.standard,
                    backgroundColor: railColor,
                  }
                : railPosition === "bottom"
                  ? {
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: OBS_V2.geometry.rail.standard,
                      backgroundColor: railColor,
                    }
                  : railPosition === "left"
                    ? {
                        top: 0,
                        bottom: 0,
                        left: 0,
                        width: OBS_V2.geometry.rail.standard,
                        backgroundColor: railColor,
                      }
                    : {
                        top: 0,
                        bottom: 0,
                        right: 0,
                        width: OBS_V2.geometry.rail.standard,
                        backgroundColor: railColor,
                      }),
            }}
          />
        ) : null}

        {children}
      </div>
    );
  },
);
