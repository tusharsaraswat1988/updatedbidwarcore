/**
 * Buzz Studio — Frame System
 *
 * Reusable circular/rounded frame components for player images,
 * team logos, and avatars. Each frame handles:
 *
 *   - Image rendering (when imageUrl is present)
 *   - Monogram fallback (when imageUrl is absent)
 *   - Gold border ring
 *   - Ambient glow behind the ring (for large frames)
 *
 * Frames accept initials as an explicit string — the caller resolves
 * the monogram via the asset-engine. LogoSlot (logo-slots.tsx) does
 * this automatically from a name + kind.
 *
 * No business logic. No auction imports. Inline styles only.
 */

import React from "react";
import type { CSSProperties } from "react";
import { defaultBuzzTheme } from "../theme/buzz-theme";
import { Gradients } from "./gradients";

const t = defaultBuzzTheme;

/* ─── Size presets ───────────────────────────────────────────────────────── */

export type FrameSize = "xs" | "sm" | "md" | "lg" | "xl";

/** Maps size keys to CSS width/height values. */
const FRAME_SIZE_MAP: Record<FrameSize, string> = {
  xs: "28px",
  sm: "40px",
  md: "80px",
  lg: "clamp(120px, 38%, 220px)",
  xl: "clamp(160px, 45%, 280px)",
};

/** Font size for initials text, matched to frame size. */
const INITIALS_FONT_MAP: Record<FrameSize, string> = {
  xs: "0.5rem",
  sm: "0.75rem",
  md: "clamp(1.25rem, 3vw, 2rem)",
  lg: "clamp(1.75rem, 6vw, 3.5rem)",
  xl: "clamp(2.25rem, 8vw, 4.5rem)",
};

function resolveSize(size: FrameSize | string): string {
  return FRAME_SIZE_MAP[size as FrameSize] ?? size;
}

function resolveInitialsFontSize(size: FrameSize | string): string {
  return INITIALS_FONT_MAP[size as FrameSize] ?? "1rem";
}

/* ─── PlayerFrame ────────────────────────────────────────────────────────── */

export interface PlayerFrameProps {
  /** Player image URL. If absent, renders the monogram fallback. */
  imageUrl?: string;
  /** Pre-computed initials string (e.g. "RS"). Use playerMonogram() to derive. */
  initials: string;
  /** Alt text for the image element. */
  alt?: string;
  /**
   * Frame size preset or a custom CSS length string.
   * @default "lg"
   */
  size?: FrameSize | string;
  /** Extra styles applied to the outermost wrapper div. */
  style?: CSSProperties;
}

/**
 * Large circular frame with gold gradient ring and ambient glow.
 * Primary avatar for player spotlight, MVP, and sold cards.
 *
 * @example
 * <PlayerFrame imageUrl={playerImageUrl} initials="RS" alt="Rahul Sharma" />
 * <PlayerFrame initials="VK" size="xl" />
 */
export function PlayerFrame({
  imageUrl,
  initials,
  alt,
  size = "lg",
  style,
}: PlayerFrameProps) {
  const resolvedSize = resolveSize(size);
  const fontSize = resolveInitialsFontSize(size);
  const showGlow = size === "lg" || size === "xl";

  return (
    <div
      style={{
        position: "relative",
        width: resolvedSize,
        height: resolvedSize,
        flexShrink: 0,
        ...style,
      }}
    >
      {/* Ambient gold glow — only for large frames */}
      {showGlow && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "-12px",
            borderRadius: "50%",
            background: Gradients.GoldGlow,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
      )}

      {/* Gold gradient ring */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          padding: "3px",
          background: Gradients.AuctionGlow,
          boxSizing: "border-box",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={alt ?? initials}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              objectFit: "cover",
              objectPosition: "top center",
              display: "block",
            }}
          />
        ) : (
          <div
            aria-label={alt ?? `${initials} initials`}
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "50%",
              background: Gradients.DarkPremium,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize,
                fontWeight: 800,
                color: t.primaryGold,
                letterSpacing: "0.05em",
                fontFamily: "system-ui, sans-serif",
                userSelect: "none",
              }}
            >
              {initials}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── TeamFrame ──────────────────────────────────────────────────────────── */

export interface TeamFrameProps {
  imageUrl?: string;
  initials: string;
  alt?: string;
  /** Size in pixels. @default 32 */
  size?: number;
  style?: CSSProperties;
}

/**
 * Small circular frame for team logos.
 * Subtle gold border, monogram fallback.
 *
 * @example
 * <TeamFrame initials="VW" size={32} />
 * <TeamFrame imageUrl={teamLogoUrl} initials="MI" />
 */
export function TeamFrame({
  imageUrl,
  initials,
  alt,
  size = 32,
  style,
}: TeamFrameProps) {
  const px = `${size}px`;
  const fontSize = `${Math.max(8, Math.round(size * 0.32))}px`;

  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius: "50%",
        border: `1.5px solid ${t.primaryGold}50`,
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt ?? initials}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          aria-label={alt ?? `${initials} initials`}
          style={{
            width: "100%",
            height: "100%",
            background: Gradients.MonogramSurface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize,
              fontWeight: 800,
              color: t.primaryGold,
              letterSpacing: "0.04em",
              fontFamily: "system-ui, sans-serif",
              userSelect: "none",
            }}
          >
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── LogoFrame ──────────────────────────────────────────────────────────── */

export type LogoFrameShape = "circle" | "rounded";
export type LogoFrameBorder = "gold" | "subtle" | "none";

export interface LogoFrameProps {
  imageUrl?: string;
  initials: string;
  alt?: string;
  /** Size in pixels. @default 48 */
  size?: number;
  /** @default "circle" */
  shape?: LogoFrameShape;
  /** @default "subtle" */
  borderVariant?: LogoFrameBorder;
  style?: CSSProperties;
}

/**
 * Flexible logo frame supporting both circle and rounded-rect shapes.
 * Used for tournament logos, sponsor marks, and generic brand marks.
 *
 * @example
 * <LogoFrame initials="BW" size={64} shape="rounded" borderVariant="gold" />
 */
export function LogoFrame({
  imageUrl,
  initials,
  alt,
  size = 48,
  shape = "circle",
  borderVariant = "subtle",
  style,
}: LogoFrameProps) {
  const px = `${size}px`;
  const borderRadius = shape === "circle" ? "50%" : `${Math.round(size * 0.22)}px`;
  const fontSize = `${Math.max(10, Math.round(size * 0.3))}px`;

  const borderStyles: Record<LogoFrameBorder, CSSProperties> = {
    gold:   { border: `1.5px solid ${t.primaryGold}60` },
    subtle: { border: "1px solid rgba(255,255,255,0.10)" },
    none:   { border: "none" },
  };

  return (
    <div
      style={{
        width: px,
        height: px,
        borderRadius,
        overflow: "hidden",
        flexShrink: 0,
        ...borderStyles[borderVariant],
        ...style,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt ?? initials}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          aria-label={alt ?? `${initials} logo`}
          style={{
            width: "100%",
            height: "100%",
            background: Gradients.MonogramSurface,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize,
              fontWeight: 800,
              color: t.primaryGold,
              letterSpacing: "0.04em",
              fontFamily: "system-ui, sans-serif",
              userSelect: "none",
            }}
          >
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── AvatarFrame ────────────────────────────────────────────────────────── */

export interface AvatarFrameProps {
  imageUrl?: string;
  initials: string;
  alt?: string;
  /**
   * Frame size preset or custom CSS length.
   * @default "md"
   */
  size?: FrameSize | string;
  style?: CSSProperties;
}

/**
 * Medium-size general purpose avatar frame.
 * Less prominent than PlayerFrame — no ambient glow, lighter border.
 * Used for secondary players, bench slots, or list avatars.
 *
 * @example
 * <AvatarFrame initials="SK" size="sm" />
 */
export function AvatarFrame({
  imageUrl,
  initials,
  alt,
  size = "md",
  style,
}: AvatarFrameProps) {
  const resolvedSize = resolveSize(size);
  const fontSize = resolveInitialsFontSize(size);

  return (
    <div
      style={{
        width: resolvedSize,
        height: resolvedSize,
        borderRadius: "50%",
        border: `1.5px solid ${t.primaryGold}35`,
        overflow: "hidden",
        flexShrink: 0,
        ...style,
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={alt ?? initials}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <div
          aria-label={alt ?? `${initials} avatar`}
          style={{
            width: "100%",
            height: "100%",
            background: Gradients.DarkPremium,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <span
            style={{
              fontSize,
              fontWeight: 800,
              color: t.primaryGold,
              letterSpacing: "0.05em",
              fontFamily: "system-ui, sans-serif",
              userSelect: "none",
            }}
          >
            {initials}
          </span>
        </div>
      )}
    </div>
  );
}
