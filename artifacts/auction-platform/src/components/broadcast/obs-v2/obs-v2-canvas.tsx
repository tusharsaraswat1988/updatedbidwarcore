import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { OBS_V2, getObsV2CssVariables } from "./obs-v2-tokens";

export interface ObsV2CanvasProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  /** When true, renders safe-area boundary guides (for preview/director consoles) */
  showSafeGuides?: boolean;
  /** Responsive scale factor (0 to 1) for fitting 1920x1080 within preview viewports */
  scale?: number;
  /** Broadcast phase data attribute */
  phase?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2Canvas — The 1920×1080 Broadcast Viewport
 *
 * Provides:
 * - Authoritative 1920×1080 pixel dimensions (16:9).
 * - Full injection of `--obs-v2-*` CSS variables into component subtree.
 * - Guaranteed transparent background for OBS Browser Source chroma keying.
 * - Broadcast-safe area guides for developer inspection & operator preview.
 */
export const ObsV2Canvas = forwardRef<HTMLDivElement, ObsV2CanvasProps>(
  function ObsV2Canvas(
    {
      children,
      showSafeGuides = false,
      scale,
      phase,
      className = "",
      style,
      ...rest
    },
    ref,
  ) {
    const cssVars = getObsV2CssVariables() as CSSProperties;

    const baseStyle: CSSProperties = {
      ...cssVars,
      width: OBS_V2.canvas.width,
      height: OBS_V2.canvas.height,
      backgroundColor: "transparent",
      color: OBS_V2.color.text,
      fontFamily: OBS_V2.typography.family.body,
      position: "relative",
      overflow: "hidden",
      userSelect: "none",
      WebkitUserSelect: "none",
      ...(scale != null && scale !== 1
        ? {
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }
        : {}),
      ...style,
    };

    return (
      <div
        ref={ref}
        className={`obs-v2-canvas ${className}`}
        style={baseStyle}
        data-broadcast-canvas="1920x1080"
        data-broadcast-v2="true"
        data-broadcast-phase={phase}
        {...rest}
      >
        {children}

        {/* Action-Safe Guides (Overlayed for preview/director calibration) */}
        {showSafeGuides ? (
          <div
            className="pointer-events-none absolute z-[999]"
            style={{
              top: OBS_V2.canvas.safeY,
              left: OBS_V2.canvas.safeX,
              right: OBS_V2.canvas.safeX,
              bottom: OBS_V2.canvas.safeY,
              border: `1px dashed ${OBS_V2.color.brandBorder}`,
            }}
          >
            <span
              className="absolute top-1 left-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: OBS_V2.color.brand }}
            >
              Action Safe 1920×1080 (96px, 54px)
            </span>
          </div>
        ) : null}
      </div>
    );
  },
);
