import React from "react";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";
import { WeddingTeamAvatar } from "./WeddingIllustratedAvatar";
import { WeddingTeamTitle } from "./WeddingTypography";

export interface WeddingTeamPlaqueProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  shortCode?: string;
  logoUrl?: string | null;
  side?: "bride" | "groom" | "neutral";
  position?: "left" | "right";
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * WeddingTeamPlaque
 * Team presentation plaque with royal velvet gradient, gold scalloped frame,
 * and arched avatar alcove.
 *
 * Sidedness logic:
 * - If `side` is explicitly provided ("bride" or "groom"), it strictly honors it.
 * - Otherwise falls back to inspecting team name substrings.
 * - `position` controls physical placement (left plaque vs right plaque), ensuring
 *   avatars stay cleanly anchored to the outer edges.
 */
export const WeddingTeamPlaque = React.forwardRef<HTMLDivElement, WeddingTeamPlaqueProps>(
  function WeddingTeamPlaque(
    {
      name,
      shortCode,
      logoUrl,
      side,
      position,
      width = WEDDING_TOKENS.canvas.scoreboard.teamBadgeWidth,
      height = WEDDING_TOKENS.canvas.scoreboard.mainStripHeight,
      className = "",
      style,
      ...rest
    },
    ref
  ) {
    const isBrideExplicit = side === "bride";
    const isGroomExplicit = side === "groom";

    const isBride = isBrideExplicit
      ? true
      : isGroomExplicit
      ? false
      : name.toLowerCase().includes("bride") ||
        name.toLowerCase().includes("girl") ||
        name.toLowerCase().includes("ladkiwale") ||
        !name.toLowerCase().includes("groom");

    const background = isBride
      ? WEDDING_TOKENS.color.gradient.brideVelvet
      : WEDDING_TOKENS.color.gradient.groomVelvet;

    // Position determines layout: "left" plaque has avatar on left, "right" plaque has avatar on right
    const isLeft = position ? position === "left" : (side === "bride" || isBride);

    return (
      <div
        ref={ref}
        className={`wedding-team-plaque relative flex items-center select-none overflow-hidden ${
          isLeft ? "flex-row justify-start" : "flex-row-reverse justify-start"
        } ${className}`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          background,
          border: `1.5px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
          borderRadius: isLeft ? "20px 8px 8px 20px" : "8px 20px 20px 8px",
          boxShadow: isBride
            ? "inset 0 1px 3px rgba(255, 235, 199, 0.25), 0 4px 14px rgba(74, 14, 24, 0.4)"
            : "inset 0 1px 3px rgba(255, 235, 199, 0.25), 0 4px 14px rgba(15, 22, 43, 0.4)",
          padding: "0 12px",
          ...style,
        }}
        data-team-side={isBride ? "bride" : "groom"}
        data-team-position={isLeft ? "left" : "right"}
        {...rest}
      >
        {/* Inner delicate gold hairline */}
        <div
          className="pointer-events-none absolute inset-[3px]"
          style={{
            border: `0.75px solid ${WEDDING_TOKENS.color.gold.hairline}`,
            borderRadius: isLeft ? "17px 6px 6px 17px" : "6px 17px 17px 6px",
          }}
        />

        {/* Arched Avatar Alcove */}
        <div
          className="relative flex items-center justify-center rounded-full shrink-0"
          style={{
            width: "68px",
            height: "68px",
            background: "radial-gradient(circle, rgba(255, 253, 249, 0.15) 0%, rgba(0, 0, 0, 0.2) 100%)",
            border: `1.5px solid ${WEDDING_TOKENS.color.gold.champagne}`,
            boxShadow: `0 0 8px ${WEDDING_TOKENS.color.gold.glow}`,
          }}
        >
          <WeddingTeamAvatar
            logoUrl={logoUrl}
            teamName={name}
            side={isBride ? "bride" : "groom"}
            size={58}
          />
        </div>

        {/* Team Name Label */}
        <div
          className={`flex flex-col ${isLeft ? "ml-3 text-left" : "mr-3 text-right"} flex-1 overflow-hidden`}
        >
          <WeddingTeamTitle
            variant="ivory"
            className="truncate text-[22px] leading-tight"
            style={{
              textShadow: "0 2px 4px rgba(0,0,0,0.6)",
              fontStyle: "italic",
            }}
          >
            {name || shortCode || (isBride ? "Bride's XI" : "Groom's XI")}
          </WeddingTeamTitle>

          {shortCode && shortCode !== name && (
            <span
              className="text-[11px] font-semibold tracking-widest uppercase opacity-80"
              style={{
                color: WEDDING_TOKENS.color.gold.pale,
                fontFamily: WEDDING_TOKENS.typography.family.sans,
              }}
            >
              {shortCode}
            </span>
          )}
        </div>
      </div>
    );
  }
);
