import { forwardRef, useState, type CSSProperties, type HTMLAttributes } from "react";
import { OBS_V2 } from "./obs-v2-tokens";
import { ObsV2Rail } from "./obs-v2-rail";
import { ObsV2Surface } from "./obs-v2-surface";
import { ObsV2Text, ObsV2Label } from "./obs-v2-typography";
import type { ObsV2HeaderData } from "./types";

export interface ObsV2HeaderProps extends HTMLAttributes<HTMLDivElement> {
  data?: ObsV2HeaderData;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2Header — 64px Television Broadcast Structural Top Header
 *
 * Implements:
 * - 64px fixed broadcast top strip anchored edge-to-edge.
 * - BidWar platform identity + Tournament / Match context hierarchy.
 * - Restrained broadcast live indicator (subtle non-flashing indicator).
 * - Continuous 2px bottom structural brand rail (#FFD700).
 * - Safe margin padding (96px left and right).
 */
export const ObsV2Header = forwardRef<HTMLDivElement, ObsV2HeaderProps>(
  function ObsV2Header({ data, className = "", style, ...rest }, ref) {
    const [logoFailed, setLogoFailed] = useState(false);

    const tournamentName = data?.tournamentName || "BidWar Cricket";
    const matchContext = data?.matchContext || "Live Match";
    const isLive = data?.live ?? false;
    const statusLabel = data?.statusLabel || (isLive ? "LIVE" : "STANDBY");

    return (
      <header
        ref={ref}
        className={`obs-v2-header absolute top-0 left-0 right-0 z-30 select-none ${className}`}
        style={{
          height: `${OBS_V2.canvas.headerHeight}px`,
          zIndex: OBS_V2.layer.header,
          ...style,
        }}
        data-header-height={OBS_V2.canvas.headerHeight}
        {...rest}
      >
        {/* Surface Background */}
        <div
          className="relative flex h-full w-full items-center justify-between"
          style={{
            background: OBS_V2.color.gradient.chassis,
            paddingLeft: `${OBS_V2.canvas.safeX}px`,
            paddingRight: `${OBS_V2.canvas.safeX}px`,
          }}
        >
          {/* ========================================================= */}
          {/* LEFT: BIDWAR PLATFORM IDENTITY + TOURNAMENT CONTEXT       */}
          {/* ========================================================= */}
          <div className="flex items-center gap-4">
            {/* BidWar Platform Mark */}
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-normal tracking-wide"
                style={{
                  fontFamily: OBS_V2.typography.family.display,
                  color: OBS_V2.color.brand,
                  letterSpacing: OBS_V2.typography.tracking.wide,
                }}
              >
                BIDWAR
              </span>
              <span
                className="inline-block h-4 w-[2px] opacity-40"
                style={{ backgroundColor: OBS_V2.color.brand }}
              />
            </div>

            {/* Vertical Divider */}
            <div
              className="h-6 w-[1px]"
              style={{ backgroundColor: OBS_V2.color.dividerVertical }}
            />

            {/* Tournament Identity (Content, not platform) */}
            <div className="flex items-center gap-2">
              {data?.tournamentLogoUrl && !logoFailed ? (
                <img
                  src={data.tournamentLogoUrl}
                  alt=""
                  className="h-8 w-8 object-contain"
                  onError={() => setLogoFailed(true)}
                />
              ) : null}
              <ObsV2Text
                variant="value"
                color="primary"
                className="font-semibold uppercase tracking-wider text-sm"
              >
                {tournamentName}
              </ObsV2Text>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CENTER: MATCH / STAGE CONTEXT                             */}
          {/* ========================================================= */}
          <div className="flex items-center">
            <ObsV2Surface
              level="inset"
              className="px-4 py-1.5 flex items-center gap-2"
              style={{
                borderRadius: OBS_V2.geometry.radius.sm,
                borderColor: OBS_V2.color.hairline,
              }}
            >
              <ObsV2Label color="secondary">
                {matchContext}
              </ObsV2Label>
            </ObsV2Surface>
          </div>

          {/* ========================================================= */}
          {/* RIGHT: RESTRAINED LIVE INDICATOR                          */}
          {/* ========================================================= */}
          <div className="flex items-center gap-3">
            {isLive ? (
              <div
                className="flex items-center gap-2 px-3 py-1 rounded"
                style={{
                  backgroundColor: OBS_V2.color.infoSoft,
                  border: `1px solid ${OBS_V2.color.infoBorder}`,
                }}
              >
                {/* Subtle static indicator dot — broadcast professional, non-pulsing */}
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: OBS_V2.color.info }}
                />
                <ObsV2Label
                  style={{
                    color: OBS_V2.color.info,
                    letterSpacing: OBS_V2.typography.tracking.wider,
                  }}
                >
                  {statusLabel}
                </ObsV2Label>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 px-3 py-1 rounded"
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.05)",
                  border: `1px solid ${OBS_V2.color.hairline}`,
                }}
              >
                <ObsV2Label color="muted">
                  {statusLabel}
                </ObsV2Label>
              </div>
            )}
          </div>
        </div>

        {/* Continuous Structural 2px Bottom Rail */}
        <ObsV2Rail variant="brand" thickness="standard" />
      </header>
    );
  },
);
