/**
 * Buzz Studio — Logo Slot System
 *
 * Data-aware wrappers over the frame components.
 * LogoSlot accepts a name + kind and resolves initials automatically
 * via the asset-engine's monogramFor() — no manual initials computation needed.
 *
 * Separation of concerns:
 *   frames.tsx   — pure visual (accepts explicit initials string)
 *   logo-slots.tsx — data-aware (accepts name+kind, computes initials)
 *
 * No business logic. No auction imports.
 */

import React from "react";
import type { CSSProperties } from "react";
import { monogramFor } from "../asset-engine/monogram-generator";
import type { AssetKind } from "../asset-engine/asset-types";
import { TeamFrame, LogoFrame, PlayerFrame, AvatarFrame } from "./frames";
import type {
  LogoFrameShape,
  LogoFrameBorder,
  FrameSize,
} from "./frames";

/* ─── LogoSlot ───────────────────────────────────────────────────────────── */

export interface LogoSlotProps {
  /** Image URL. If absent, renders a monogram fallback. */
  imageUrl?: string;
  /**
   * Display name used for monogram generation and alt text.
   * e.g. "Varanasi Warriors", "Rahul Sharma"
   */
  name: string;
  /** Determines which monogram strategy to use. */
  kind: AssetKind;
  /** Size in pixels. @default 40 */
  size?: number;
  /** @default "circle" */
  shape?: LogoFrameShape;
  /** @default "subtle" */
  borderVariant?: LogoFrameBorder;
  style?: CSSProperties;
}

/**
 * Flexible logo slot: resolves initials from name+kind, renders via LogoFrame.
 * Use when you need a generic asset display without knowing the size preset.
 *
 * @example
 * <LogoSlot name="Varanasi Warriors" kind="team" imageUrl={url} size={40} />
 * <LogoSlot name="Rahul Sharma" kind="player" size={64} shape="circle" />
 */
export function LogoSlot({
  imageUrl,
  name,
  kind,
  size = 40,
  shape = "circle",
  borderVariant = "subtle",
  style,
}: LogoSlotProps) {
  const { initials } = monogramFor(name, kind);
  return (
    <LogoFrame
      imageUrl={imageUrl}
      initials={initials}
      alt={name}
      size={size}
      shape={shape}
      borderVariant={borderVariant}
      style={style}
    />
  );
}

/* ─── PlayerSlot ─────────────────────────────────────────────────────────── */

export interface PlayerSlotProps {
  imageUrl?: string;
  playerName: string;
  size?: FrameSize | string;
  style?: CSSProperties;
}

/**
 * Player avatar slot: resolves player initials from name, renders via PlayerFrame.
 * Use this instead of calling playerMonogram() + PlayerFrame manually.
 *
 * @example
 * <PlayerSlot playerName="Rahul Sharma" size="lg" />
 * <PlayerSlot playerName="Virat Kohli" imageUrl={url} size="xl" />
 */
export function PlayerSlot({
  imageUrl,
  playerName,
  size = "lg",
  style,
}: PlayerSlotProps) {
  const { initials } = monogramFor(playerName, "player");
  return (
    <PlayerFrame
      imageUrl={imageUrl}
      initials={initials}
      alt={playerName}
      size={size}
      style={style}
    />
  );
}

/* ─── TeamSlot ───────────────────────────────────────────────────────────── */

export interface TeamSlotProps {
  imageUrl?: string;
  teamName: string;
  /** Size in pixels. @default 32 */
  size?: number;
  style?: CSSProperties;
}

/**
 * Team logo slot: resolves team initials from name, renders via TeamFrame.
 *
 * @example
 * <TeamSlot teamName="Varanasi Warriors" />
 * <TeamSlot teamName="Mumbai Indians" imageUrl={logoUrl} size={40} />
 */
export function TeamSlot({
  imageUrl,
  teamName,
  size = 32,
  style,
}: TeamSlotProps) {
  const { initials } = monogramFor(teamName, "team");
  return (
    <TeamFrame
      imageUrl={imageUrl}
      initials={initials}
      alt={teamName}
      size={size}
      style={style}
    />
  );
}

/* ─── AvatarSlot ─────────────────────────────────────────────────────────── */

export interface AvatarSlotProps {
  imageUrl?: string;
  name: string;
  kind?: AssetKind;
  size?: FrameSize | string;
  style?: CSSProperties;
}

/**
 * General-purpose avatar slot. Falls back to AvatarFrame (no glow ring).
 * Use for secondary players, bench, or list views.
 *
 * @example
 * <AvatarSlot name="Sachin Tendulkar" kind="player" size="sm" />
 */
export function AvatarSlot({
  imageUrl,
  name,
  kind = "player",
  size = "sm",
  style,
}: AvatarSlotProps) {
  const { initials } = monogramFor(name, kind);
  return (
    <AvatarFrame
      imageUrl={imageUrl}
      initials={initials}
      alt={name}
      size={size}
      style={style}
    />
  );
}
