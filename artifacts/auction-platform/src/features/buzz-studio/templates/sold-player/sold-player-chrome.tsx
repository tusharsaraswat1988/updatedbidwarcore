/**
 * Sold Player — foreground polish (template-specific).
 * Does not alter layout zones, contracts, or background assets.
 */

import React from "react";
import { defaultBuzzTheme as theme } from "../../theme/buzz-theme";
import { Gradients } from "../../design-system/gradients";
import { monogramFor } from "../../asset-engine/monogram-generator";
import { POSTER_TOKENS } from "../../rendering/poster-primitives";

const PT = POSTER_TOKENS;
const GOLD = theme.primaryGold;
const GOLD_DEEP = theme.secondaryGold;
const GOLD_LIGHT = "#FDE68A";
const GOLD_PALE = "#FEF3C7";

const READABILITY_SHADOW =
  "0 2px 12px rgba(0,0,0,0.68), 0 1px 4px rgba(0,0,0,0.82)";

const PRICE_GRADIENT = `linear-gradient(180deg, ${GOLD_PALE} 0%, ${GOLD_LIGHT} 22%, ${GOLD} 52%, ${GOLD_DEEP} 100%)`;

type BackplateVariant = "glass" | "price" | "subtle";

/** Glass / readability backplate — 8–10% transparency, soft border, blur. */
export function SoldReadabilityBackplate({
  children,
  align = "center",
  insetX = 14,
  insetY = 8,
  gap = 0,
  variant = "subtle",
}: {
  children: React.ReactNode;
  align?: "left" | "center" | "right" | "flex-start";
  insetX?: number;
  insetY?: number;
  gap?: number;
  variant?: BackplateVariant;
}) {
  const itemsAlign =
    align === "left" || align === "flex-start"
      ? "flex-start"
      : align === "right"
        ? "flex-end"
        : "center";

  const plateStyle: React.CSSProperties =
    variant === "glass"
      ? {
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.09) 0%, rgba(0,0,0,0.09) 100%)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 16,
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          boxShadow:
            "0 4px 20px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.08)",
        }
      : variant === "price"
        ? {
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.14) 100%)",
            border: "1px solid rgba(251,191,36,0.14)",
            borderRadius: 14,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow:
              "0 6px 24px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.05)",
          }
        : {
            background:
              "linear-gradient(180deg, rgba(0,0,0,0.27) 0%, rgba(0,0,0,0.17) 100%)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          };

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        flexDirection: "column",
        alignItems: itemsAlign,
        maxWidth: "100%",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: `-${insetY}px -${insetX}px`,
          pointerEvents: "none",
          ...plateStyle,
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: itemsAlign,
          gap: gap > 0 ? gap : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Hero player — ~12% larger, lifted, dual gold ring, radial glow, depth. */
export function SoldPlayerHeroPhoto({
  name,
  url,
  size,
}: {
  name: string;
  url?: string | null;
  size: number;
}) {
  const photoSize = Math.round(size * 1.12);
  const outerRing = Math.max(3, Math.round(photoSize * 0.02));
  const innerRing = Math.max(2, Math.round(photoSize * 0.01));
  const blur = Math.max(10, Math.round(photoSize * 0.065));
  const lift = -Math.round(photoSize * 0.012);

  const photoNode = url ? (
    <img
      src={url}
      alt={name}
      draggable={false}
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        objectFit: "cover",
        objectPosition: "center top",
        display: "block",
      }}
    />
  ) : (
    <span
      style={{
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: Gradients.DarkPremium,
        fontFamily: PT.font,
        fontSize: `${Math.round(photoSize * 0.34)}px`,
        fontWeight: 900,
        color: "rgba(255,255,255,0.72)",
        letterSpacing: "0.06em",
        userSelect: "none",
      }}
    >
      {monogramFor(name, "player").initials}
    </span>
  );

  return (
    <div
      style={{
        position: "relative",
        width: photoSize,
        height: photoSize,
        flexShrink: 0,
        marginTop: lift,
        zIndex: 1,
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-12%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(251,191,36,0.27) 0%, rgba(217,119,6,0.11) 42%, transparent 74%)",
          filter: `blur(${blur}px)`,
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: "-6%",
          borderRadius: "50%",
          boxShadow:
            "0 12px 40px rgba(0,0,0,0.5), 0 0 32px rgba(251,191,36,0.14)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          padding: outerRing,
          background: Gradients.AuctionGlow,
          boxSizing: "border-box",
          boxShadow: "0 8px 28px rgba(0,0,0,0.42)",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            padding: innerRing,
            background: `linear-gradient(135deg, ${GOLD_LIGHT} 0%, ${GOLD_DEEP} 100%)`,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              overflow: "hidden",
              background: "#0a0a0a",
              boxShadow:
                "inset 0 4px 12px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.4)",
            }}
          >
            {photoNode}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SoldPlayerName({
  children,
  size,
  align = "center",
}: {
  children: React.ReactNode;
  size: number;
  align?: "left" | "center" | "right";
}) {
  return (
    <h1
      style={{
        margin: 0,
        padding: `0 ${Math.round(size * 0.12)}px`,
        fontFamily: PT.font,
        fontSize: `${size}px`,
        fontWeight: 900,
        color: "#FFFFFF",
        letterSpacing: "0.06em",
        lineHeight: 1.02,
        textTransform: "uppercase",
        textAlign: align,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        textShadow: READABILITY_SHADOW,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {children}
    </h1>
  );
}

export function SoldPlayerPrice({
  label,
  value,
  labelSize,
  valueSize,
  align = "center",
}: {
  label?: string;
  value: string;
  labelSize: number;
  valueSize: number;
  align?: "left" | "center" | "right";
}) {
  const itemsAlign =
    align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
  const soldForSize = Math.max(9, Math.round(labelSize * 0.78));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: itemsAlign,
        gap: Math.round(labelSize * 0.85),
        textAlign: align,
        padding: `${Math.round(valueSize * 0.08)}px 0`,
      }}
    >
      {label ? (
        <span
          style={{
            fontFamily: PT.font,
            fontSize: `${soldForSize}px`,
            fontWeight: 600,
            color: "rgba(255,255,255,0.48)",
            letterSpacing: "0.36em",
            textTransform: "uppercase",
            lineHeight: 1,
            textShadow: "0 1px 5px rgba(0,0,0,0.55)",
          }}
        >
          {label}
        </span>
      ) : null}
      <span
        style={{
          fontFamily: PT.font,
          fontSize: `${valueSize}px`,
          fontWeight: 900,
          letterSpacing: "0.02em",
          lineHeight: 0.92,
          background: PRICE_GRADIENT,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          color: GOLD,
          WebkitTextFillColor: "transparent",
          filter:
            "drop-shadow(0 3px 10px rgba(0,0,0,0.5)) drop-shadow(0 0 22px rgba(251,191,36,0.2))",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/** "SOLD TO" label — sits between price and team block. */
export function SoldToLabel({ size }: { size: number }) {
  return (
    <span
      style={{
        fontFamily: PT.font,
        fontSize: `${size}px`,
        fontWeight: 600,
        color: "rgba(255,255,255,0.44)",
        letterSpacing: "0.28em",
        textTransform: "uppercase",
        lineHeight: 1,
        textShadow: "0 1px 4px rgba(0,0,0,0.45)",
      }}
    >
      SOLD TO
    </span>
  );
}

/** Compact team block — logo, name, bid count. */
export function SoldTeamSection({
  teamName,
  teamLogoUrl,
  logoSize,
  nameSize,
  bidCountLabel,
  align = "center",
}: {
  teamName: string;
  teamLogoUrl?: string | null;
  logoSize: number;
  nameSize: number;
  bidCountLabel?: string | null;
  align?: "left" | "center";
}) {
  const itemsAlign = align === "left" ? "flex-start" : "center";
  const { initials } = monogramFor(teamName, "team");
  const badgeRadius = Math.round(logoSize * 0.28);
  const logoPad = Math.max(6, Math.round(logoSize * 0.18));

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: itemsAlign,
        gap: Math.round(nameSize * 0.28),
        width: "fit-content",
        maxWidth: "78%",
        padding: `${Math.round(nameSize * 0.32)}px ${Math.round(nameSize * 0.48)}px`,
        borderRadius: 12,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(0,0,0,0.06) 100%)",
        border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(5px)",
        WebkitBackdropFilter: "blur(5px)",
        boxShadow:
          "0 3px 14px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: logoPad,
          borderRadius: badgeRadius,
          background:
            "linear-gradient(145deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.16) 100%)",
          border: "1px solid rgba(251,191,36,0.22)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {teamLogoUrl ? (
          <img
            src={teamLogoUrl}
            alt={teamName}
            draggable={false}
            style={{
              width: logoSize,
              height: logoSize,
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <span
            style={{
              width: logoSize,
              height: logoSize,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: PT.font,
              fontSize: `${Math.round(logoSize * 0.38)}px`,
              fontWeight: 800,
              color: GOLD,
              letterSpacing: "0.04em",
            }}
          >
            {initials}
          </span>
        )}
      </div>
      <span
        style={{
          fontFamily: PT.font,
          fontSize: `${nameSize}px`,
          fontWeight: 800,
          color: "rgba(255,255,255,0.92)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          lineHeight: 1.05,
          textAlign: align === "left" ? "left" : "center",
          textShadow: READABILITY_SHADOW,
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "100%",
          whiteSpace: "nowrap",
        }}
      >
        {teamName}
      </span>
      {bidCountLabel ? (
        <span
          style={{
            fontFamily: PT.font,
            fontSize: `${Math.max(8, Math.round(nameSize * 0.52))}px`,
            fontWeight: 500,
            color: "rgba(255,255,255,0.38)",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            lineHeight: 1.1,
            textShadow: "0 1px 3px rgba(0,0,0,0.4)",
          }}
        >
          {bidCountLabel}
        </span>
      ) : null}
    </div>
  );
}

export function SoldTournamentHeader({
  logoUrl,
  name,
  logoSize,
  nameSize,
  microSize,
}: {
  logoUrl?: string | null;
  name?: string | null;
  logoSize: number;
  nameSize: number;
  microSize: number;
}) {
  const hasLogo = !!logoUrl;
  const hasName = !!name && name.trim().length > 0;
  if (!hasLogo && !hasName) return null;

  const boostedLogo = Math.round(logoSize * 1.23);
  const boostedName = Math.round(nameSize * 1.38);
  const presentsSize = Math.max(9, Math.round(microSize * 0.92));
  const nameToPresentsGap = Math.round(microSize * 0.92);
  const headerGap = Math.round(microSize * 0.95);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: headerGap,
        width: "100%",
        position: "relative",
        zIndex: 4,
        marginBottom: Math.round(microSize * 1.05),
        paddingBottom: Math.round(microSize * 0.25),
      }}
    >
      {hasLogo ? (
        <img
          src={logoUrl}
          alt={name ?? "Tournament"}
          draggable={false}
          style={{
            width: boostedLogo,
            height: boostedLogo,
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.42))",
          }}
        />
      ) : null}
      {hasName ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: nameToPresentsGap,
          }}
        >
          <span
            style={{
              margin: 0,
              fontFamily: PT.font,
              fontSize: `${boostedName}px`,
              fontWeight: 800,
              color: "rgba(255,255,255,0.98)",
              letterSpacing: "0.11em",
              textTransform: "uppercase",
              textAlign: "center",
              lineHeight: 1.12,
              textShadow: READABILITY_SHADOW,
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily: PT.font,
              fontSize: `${presentsSize}px`,
              fontWeight: 600,
              color: "rgba(251,191,36,0.88)",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              lineHeight: 1,
              textShadow: "0 1px 4px rgba(0,0,0,0.45)",
            }}
          >
            PRESENTS
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Sold-player size boosts (layout ratios unchanged). */
export function soldPlayerSizes(base: {
  microSize: number;
  bodySize: number;
  labelSize: number;
  titleSize: number;
  heroPhotoSize: number;
  tournLogoSize: number;
  tournNameSize: number;
  amountSize: number;
}) {
  return {
    ...base,
    tournNameSize: Math.round(base.tournNameSize * 1.12),
    amountSize: Math.round(base.amountSize * 1.31),
    teamNameSize: Math.round(base.bodySize * 1.02),
    teamLogoSize: Math.max(40, Math.round(base.bodySize * 2.05)),
  };
}

/** Vertical rhythm between stacked sections (ratio-safe). */
export function soldPlayerSectionGap(sectionGap: number, factor = 1): number {
  return Math.round(sectionGap * factor);
}
