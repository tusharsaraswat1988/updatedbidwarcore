/**
 * Content frame renderer — clips images and text inside template placeholders.
 */

import React from "react";
import type { BuzzRenderContext } from "./buzz-render-context";
import { monogramFor } from "../asset-engine/monogram-generator";
import type { TemplateFrameRect } from "./template-frame-schema";
import { frameToZoneRect, resolveFramePixels } from "./template-frame-schema";
import { PosterAbsoluteZone } from "./poster-absolute-zone";

/* ─── Photo (object-fit: cover, clipped) ─────────────────────────────────── */

export function FramePhoto({
  frame,
  ctx,
  imageUrl,
  name,
}: {
  frame: TemplateFrameRect;
  ctx: BuzzRenderContext;
  imageUrl?: string | null;
  name: string;
}) {
  const { borderRadius } = resolveFramePixels(frame, ctx.renderWidth, ctx.renderHeight);

  return (
    <PosterAbsoluteZone rect={frameToZoneRect(frame)} ctx={ctx}>
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius,
          position: "relative",
          isolation: "isolate",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
            }}
          />
        ) : (
          <FramePhotoFallback name={name} />
        )}
      </div>
    </PosterAbsoluteZone>
  );
}

function FramePhotoFallback({ name }: { name: string }) {
  const { initials } = monogramFor(name, "player");
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.35)",
        fontFamily: "system-ui, sans-serif",
        fontSize: "clamp(1.5rem, 8vw, 3rem)",
        fontWeight: 900,
        color: "rgba(255,255,255,0.55)",
        letterSpacing: "0.08em",
      }}
    >
      {initials}
    </div>
  );
}

/* ─── Team logo (object-fit: contain, transparent) ───────────────────────── */

export function FrameLogo({
  frame,
  ctx,
  imageUrl,
  name,
}: {
  frame: TemplateFrameRect;
  ctx: BuzzRenderContext;
  imageUrl?: string | null;
  name: string;
}) {
  const { borderRadius } = resolveFramePixels(frame, ctx.renderWidth, ctx.renderHeight);
  const { initials } = monogramFor(name, "team");

  return (
    <PosterAbsoluteZone rect={frameToZoneRect(frame)} ctx={ctx}>
      <div
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          borderRadius,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            draggable={false}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "system-ui, sans-serif",
              fontWeight: 900,
              fontSize: "clamp(0.65rem, 3vw, 1rem)",
              color: "rgba(255,255,255,0.65)",
              letterSpacing: "0.06em",
            }}
          >
            {initials}
          </span>
        )}
      </div>
    </PosterAbsoluteZone>
  );
}

/* ─── Player name (auto-scale, max 2 lines, no photo overlap) ────────────── */

export function fitNameFontSize(
  name: string,
  frameWidthPx: number,
  frameHeightPx: number,
  maxLines = 2,
): number {
  const minSize = 14;
  const maxSize = Math.min(48, Math.floor(frameHeightPx / (maxLines * 1.2)));
  const upper = name.toUpperCase();

  for (let size = maxSize; size >= minSize; size -= 1) {
    const charWidth = size * 0.58;
    const charsPerLine = Math.max(1, Math.floor(frameWidthPx / charWidth));
    const linesNeeded = Math.ceil(upper.length / charsPerLine);
    if (linesNeeded <= maxLines) return size;
  }
  return minSize;
}

export function FramePlayerName({
  frame,
  ctx,
  name,
  role,
  fontDisplay,
  fontLabel,
  nameColor,
  roleColor,
  nameShadow,
}: {
  frame: TemplateFrameRect;
  ctx: BuzzRenderContext;
  name: string;
  role?: string | null;
  fontDisplay: string;
  fontLabel: string;
  nameColor: string;
  roleColor: string;
  nameShadow?: string;
}) {
  const px = resolveFramePixels(frame, ctx.renderWidth, ctx.renderHeight);
  const roleReserve = role ? px.height * 0.32 : 0;
  const nameAreaH = px.height - roleReserve;
  const nameSize = fitNameFontSize(name, px.width, nameAreaH, 2);
  const roleSize = role ? Math.max(9, Math.round(nameSize * 0.32)) : 0;

  return (
    <PosterAbsoluteZone rect={frameToZoneRect(frame)} ctx={ctx}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: role ? Math.round(roleSize * 0.4) : 0,
          overflow: "hidden",
          textAlign: "center",
        }}
      >
        <span
          style={{
            margin: 0,
            fontFamily: fontDisplay,
            fontSize: `${nameSize}px`,
            fontWeight: 900,
            color: nameColor,
            letterSpacing: "0.06em",
            lineHeight: 1.08,
            textTransform: "uppercase",
            width: "100%",
            maxHeight: `${nameAreaH}px`,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            textShadow: nameShadow,
          }}
        >
          {name.toUpperCase()}
        </span>
        {role ? (
          <span
            style={{
              fontFamily: fontLabel,
              fontSize: `${roleSize}px`,
              fontWeight: 600,
              color: roleColor,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            {role}
          </span>
        ) : null}
      </div>
    </PosterAbsoluteZone>
  );
}

/* ─── Amount (centered, scales to ₹9,99,999) ───────────────────────────── */

export function fitAmountFontSize(
  price: string,
  frameWidthPx: number,
  valueAreaHeightPx: number,
): number {
  let size = Math.min(52, Math.floor(valueAreaHeightPx / 1.05));
  const minSize = 18;
  while (size > minSize && price.length * size * 0.52 > frameWidthPx * 0.92) {
    size -= 2;
  }
  return size;
}

export function FrameAmount({
  frame,
  ctx,
  label,
  price,
  fontDisplay,
  fontLabel,
  labelColor,
  valueColor,
  valueShadow,
}: {
  frame: TemplateFrameRect;
  ctx: BuzzRenderContext;
  label?: string;
  price: string;
  fontDisplay: string;
  fontLabel: string;
  labelColor: string;
  valueColor: string;
  valueShadow?: string;
}) {
  const px = resolveFramePixels(frame, ctx.renderWidth, ctx.renderHeight);
  const labelSize = Math.max(8, Math.round(px.height * 0.18));
  const valueAreaH = px.height - labelSize - 4;
  const valueSize = fitAmountFontSize(price, px.width, valueAreaH);

  return (
    <PosterAbsoluteZone rect={frameToZoneRect(frame)} ctx={ctx}>
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          overflow: "hidden",
        }}
      >
        {label ? (
          <span
            style={{
              fontFamily: fontLabel,
              fontSize: `${labelSize}px`,
              fontWeight: 600,
              color: labelColor,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              lineHeight: 1,
              opacity: 0.85,
              flexShrink: 0,
            }}
          >
            {label}
          </span>
        ) : null}
        <span
          style={{
            fontFamily: fontDisplay,
            fontSize: `${valueSize}px`,
            fontWeight: 900,
            color: valueColor,
            letterSpacing: "0.02em",
            lineHeight: 1,
            textAlign: "center",
            width: "100%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            textShadow: valueShadow,
          }}
        >
          {price}
        </span>
      </div>
    </PosterAbsoluteZone>
  );
}

/* ─── Rank badge ─────────────────────────────────────────────────────────── */

export function FrameRank({
  frame,
  ctx,
  rank,
  fontDisplay,
  color,
  shadow,
}: {
  frame: TemplateFrameRect;
  ctx: BuzzRenderContext;
  rank: number;
  fontDisplay: string;
  color: string;
  shadow?: string;
}) {
  const px = resolveFramePixels(frame, ctx.renderWidth, ctx.renderHeight);
  const size = Math.min(px.width, px.height) * 0.72;

  return (
    <PosterAbsoluteZone rect={frameToZoneRect(frame)} ctx={ctx}>
      <span
        style={{
          fontFamily: fontDisplay,
          fontSize: `${Math.round(size)}px`,
          fontWeight: 900,
          color,
          letterSpacing: "0.02em",
          lineHeight: 1,
          textShadow: shadow,
        }}
      >
        {rank}
      </span>
    </PosterAbsoluteZone>
  );
}
