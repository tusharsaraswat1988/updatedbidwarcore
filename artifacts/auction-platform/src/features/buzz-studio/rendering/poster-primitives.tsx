/**
 * Buzz Studio — Poster Primitives (Phase 18)
 *
 * Content-only rendering building blocks for asset-driven templates.
 * No cards, gradients, glow, frames, borders, or decorative UI —
 * only dynamic images and typography placed on designer backgrounds.
 */

import React from "react";
import { defaultBuzzTheme as t } from "../theme/buzz-theme";
import { monogramFor } from "../asset-engine/monogram-generator";
import type { AssetKind } from "../asset-engine/asset-types";
import type { BuzzRenderContext } from "./buzz-render-context";
import { canvasH } from "./buzz-render-context";
import type { PosterZoneSpec, PosterZoneStackSpec } from "./template-layout-schema";
import { isZoneRect } from "./template-layout-schema";

function resolveStackLayout(spec?: PosterZoneSpec): {
  flex?: number;
  minHeight?: number;
  alignItems: React.CSSProperties["alignItems"];
  justifyContent: React.CSSProperties["justifyContent"];
} {
  if (!spec) {
    return { alignItems: "center", justifyContent: "center" };
  }
  if (isZoneRect(spec)) {
    const alignItems =
      spec.align === "left" ? "flex-start"
      : spec.align === "right" ? "flex-end"
      : "center";
    const justifyContent =
      spec.valign === "top" ? "flex-start"
      : spec.valign === "bottom" ? "flex-end"
      : "center";
    return { flex: 0, alignItems, justifyContent };
  }
  const stack = spec as PosterZoneStackSpec;
  return {
    flex: stack.flex ?? 0,
    alignItems: stack.align ?? "center",
    justifyContent: stack.justify ?? "center",
  };
}

/** Typography tokens — content layer only, no surfaces. */
export const POSTER_TOKENS = {
  font: "system-ui, sans-serif",
  white: "#FFFFFF",
  gold: t.primaryGold,
  ghost: "rgba(255,255,255,0.40)",
} as const;

const PT = POSTER_TOKENS;

/* ─── Zone stack wrapper ─────────────────────────────────────────────────── */

export function PosterZoneStack({
  spec,
  ctx,
  children,
}: {
  spec?: PosterZoneSpec;
  ctx?: BuzzRenderContext;
  children: React.ReactNode;
}) {
  const layout = resolveStackLayout(spec);
  const minHeight =
    spec && !isZoneRect(spec) && spec.minHeightRatio && ctx
      ? canvasH(ctx.renderHeight, spec.minHeightRatio, 48, 200)
      : undefined;

  return (
    <div
      style={{
        flex: layout.flex ?? 0,
        flexShrink: layout.flex === 0 ? 0 : undefined,
        minHeight,
        display: "flex",
        flexDirection: "column",
        alignItems: layout.alignItems,
        justifyContent: layout.justifyContent,
        width: "100%",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ─── Dynamic images (player / team / tournament) ────────────────────────── */

export function PosterImage({
  name,
  url,
  size,
  kind,
  alt,
  fill,
}: {
  name: string;
  url?: string | null;
  size?: number;
  kind: AssetKind;
  alt?: string;
  /** When true, fills the parent zone (100% width/height). */
  fill?: boolean;
}) {
  const imgStyle: React.CSSProperties = fill
    ? {
        width: "100%",
        height: "100%",
        objectFit: kind === "player" ? "cover" : "contain",
        objectPosition: "center",
        display: "block",
      }
    : {
        width: size,
        height: size,
        objectFit: kind === "player" ? "cover" : "contain",
        objectPosition: "center",
        display: "block",
        flexShrink: 0,
        borderRadius: kind === "player" ? "50%" : 0,
      };

  if (url) {
    return (
      <img
        src={url}
        alt={alt ?? name}
        draggable={false}
        style={imgStyle}
      />
    );
  }

  const boxSize = fill ? "100%" : size!;
  const { initials } = monogramFor(name, kind);
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: boxSize,
        height: boxSize,
        borderRadius: kind === "player" && !fill ? "50%" : 0,
        fontFamily: PT.font,
        fontSize: fill ? "clamp(1rem, 4vw, 2rem)" : `${Math.round(size! * 0.38)}px`,
        fontWeight: 900,
        color: "rgba(255,255,255,0.70)",
        letterSpacing: "0.06em",
        lineHeight: 1,
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

/* ─── Typography ───────────────────────────────────────────────────────── */

export function PosterMicroLabel({
  children,
  size,
  gold = false,
}: {
  children: React.ReactNode;
  size: number;
  gold?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: PT.font,
        fontSize: `${size}px`,
        fontWeight: 700,
        color: gold ? PT.gold : PT.ghost,
        letterSpacing: "0.24em",
        textTransform: "uppercase",
        lineHeight: 1,
      }}
    >
      {children}
    </span>
  );
}

export function PosterTitle({
  children,
  size,
  align = "center",
  gold = false,
}: {
  children: React.ReactNode;
  size: number;
  align?: "left" | "center" | "right";
  gold?: boolean;
}) {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: PT.font,
        fontSize: `${size}px`,
        fontWeight: 900,
        color: gold ? PT.gold : PT.white,
        letterSpacing: "0.07em",
        lineHeight: 0.95,
        textTransform: "uppercase",
        textAlign: align,
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {children}
    </h1>
  );
}

export function PosterAmount({
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
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        gap: Math.round(labelSize * 0.5),
        textAlign: align,
      }}
    >
      {label ? <PosterMicroLabel size={labelSize}>{label}</PosterMicroLabel> : null}
      <span
        style={{
          fontFamily: PT.font,
          fontSize: `${valueSize}px`,
          fontWeight: 800,
          color: PT.gold,
          letterSpacing: "0.04em",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function PosterRank({
  rank,
  size,
}: {
  rank: number;
  size: number;
}) {
  return (
    <PosterMicroLabel size={size} gold>
      #{rank}
    </PosterMicroLabel>
  );
}

export function PosterMetaLine({
  children,
  size,
}: {
  children: React.ReactNode;
  size: number;
}) {
  return (
    <span
      style={{
        fontFamily: PT.font,
        fontSize: `${size}px`,
        fontWeight: 600,
        color: PT.ghost,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        lineHeight: 1.2,
        textAlign: "center",
      }}
    >
      {children}
    </span>
  );
}

/* ─── Tournament header ──────────────────────────────────────────────────── */

export function TournamentHeader({
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

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: Math.round(microSize * 0.7),
        width: "100%",
      }}
    >
      {hasLogo ? (
        <PosterImage name={name ?? "Tournament"} url={logoUrl} size={logoSize} kind="tournament" />
      ) : null}
      {hasName ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(microSize * 0.35) }}>
          <PosterTitle size={nameSize}>{name}</PosterTitle>
          <PosterMicroLabel size={microSize} gold>
            PRESENTS
          </PosterMicroLabel>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Stat block (label + value, pure text) ──────────────────────────────── */

export function StatBlock({
  label,
  value,
  gold = false,
  align = "center",
  labelSize,
  valueSize,
}: {
  label: string;
  value: string | number;
  gold?: boolean;
  align?: "center" | "left";
  labelSize: number;
  valueSize: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "left" ? "flex-start" : "center",
        gap: Math.round(labelSize * 0.55),
      }}
    >
      <PosterMicroLabel size={labelSize}>{label}</PosterMicroLabel>
      <span
        style={{
          fontFamily: PT.font,
          fontSize: `${valueSize}px`,
          fontWeight: 700,
          color: gold ? PT.gold : PT.white,
          letterSpacing: "0.04em",
          lineHeight: 1.1,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: "18ch",
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─── Team row (logo + name, no card chrome) ─────────────────────────────── */

export function TeamIdentityRow({
  teamName,
  teamLogoUrl,
  logoSize,
  nameSize,
  label,
  labelSize,
  align = "center",
}: {
  teamName: string;
  teamLogoUrl?: string | null;
  logoSize: number;
  nameSize: number;
  label?: string;
  labelSize?: number;
  align?: "left" | "center";
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: align === "left" ? "flex-start" : "center",
        gap: Math.round((labelSize ?? nameSize) * 0.6),
      }}
    >
      {label && labelSize ? <PosterMicroLabel size={labelSize}>{label}</PosterMicroLabel> : null}
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(nameSize * 0.6) }}>
        <PosterImage name={teamName} url={teamLogoUrl} size={logoSize} kind="team" />
        <PosterTitle size={nameSize} align={align === "left" ? "left" : "center"}>
          {teamName}
        </PosterTitle>
      </div>
    </div>
  );
}

/* ─── BIDWAR footer mark ─────────────────────────────────────────────────── */

export function BidwarFooter({ size }: { size: number }) {
  return (
    <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
      <PosterMicroLabel size={size}>BIDWAR</PosterMicroLabel>
    </div>
  );
}

/* ─── Sizing helpers ─────────────────────────────────────────────────────── */

export function posterSizes(ctx: BuzzRenderContext) {
  const microSize = canvasH(ctx.renderHeight, 0.013, 11, 15);
  return {
    microSize,
    bodySize: canvasH(ctx.renderHeight, 0.022, 16, 24),
    labelSize: canvasH(ctx.renderHeight, 0.018, 14, 20),
    titleSize: ctx.aspectRatio === "16:9"
      ? canvasH(ctx.renderHeight, 0.105, 80, 128)
      : canvasH(ctx.renderHeight, 0.085, 78, 122),
    heroPhotoSize: ctx.aspectRatio === "16:9"
      ? canvasH(ctx.renderHeight, 0.42, 280, 420)
      : canvasH(ctx.renderHeight, 0.24, 200, 280),
    tournLogoSize: canvasH(ctx.renderHeight, 0.085, 72, 112),
    tournNameSize: canvasH(ctx.renderHeight, 0.018, 15, 22),
    teamLogoSize: ctx.aspectRatio === "16:9"
      ? canvasH(ctx.renderHeight, 0.46, 320, 480)
      : canvasH(ctx.renderHeight, 0.24, 205, 270),
    footerSize: canvasH(ctx.renderHeight, 0.016, 13, 19),
    amountSize: canvasH(ctx.renderHeight, 0.055, 36, 56),
  };
}

export function posterTextAlign(landscape: boolean): "left" | "center" {
  return landscape ? "left" : "center";
}

export function posterFlexAlign(landscape: boolean): "flex-start" | "center" {
  return landscape ? "flex-start" : "center";
}
