/**
 * Buzz Studio — Template Layout Schema (Phase 18)
 *
 * Templates are content injectors, not design generators.
 * Designers own the visual style via background assets; this schema
 * defines where dynamic content is placed on the canvas.
 *
 * Pipeline: Background Asset → Dynamic Images → Dynamic Text → Footer Branding
 *
 * backgroundImage is resolved at render time from Creative Assets Manager
 * (settings key buzz_studio_bg_{aspectRatio}) — never stored in contracts.
 */

import type { BuzzAspectRatio } from "./buzz-render-context";
import { BuzzTemplateType } from "../registry/template-types";
import type { TemplatePlaceholderFrames } from "./template-frame-schema";

/** Semantic content slots BidWar may render on top of a background asset. */
export type PosterZoneId =
  | "tournamentLogo"
  | "tournamentName"
  | "playerPhoto"
  | "playerName"
  | "playerMeta"
  | "teamLogo"
  | "teamName"
  | "amount"
  | "rank"
  | "statusLabel"
  | "title"
  | "subtitle"
  | "statsRow"
  | "leaderboard"
  | "footerBranding";

/** Normalized rectangle (0–1) relative to the poster content area. */
export interface PosterZoneRect {
  x: number;
  y: number;
  width: number;
  height: number;
  align?: "left" | "center" | "right";
  valign?: "top" | "center" | "bottom";
}

/**
 * Flex-stack zone spec for portrait/landscape poster compositions.
 * Used when templates stack zones vertically (Team Reveal pattern).
 */
export interface PosterZoneStackSpec {
  flex?: number;
  minHeightRatio?: number;
  align?: "center" | "flex-start" | "flex-end" | "stretch";
  justify?: "center" | "flex-start" | "flex-end" | "space-between";
}

export type PosterZoneSpec = PosterZoneRect | PosterZoneStackSpec;

export function isZoneRect(spec: PosterZoneSpec): spec is PosterZoneRect {
  return "x" in spec && "y" in spec;
}

/**
 * Layout definition for one template at one aspect ratio.
 *
 * @example
 * {
 *   aspectRatio: "1:1",
 *   backgroundImageKey: "buzz_studio_bg_1:1",
 *   zones: {
 *     playerPhoto: { flex: 1, align: "center" },
 *     playerName: { minHeightRatio: 0.12, align: "center" },
 *     teamLogo: { minHeightRatio: 0.08, align: "center" },
 *     amount: { minHeightRatio: 0.1, align: "center" },
 *   },
 * }
 */
/** Stack = flex columns (global backgrounds). Absolute = fixed frames on template art. */
export type TemplateLayoutMode = "stack" | "absolute";

export interface TemplateLayoutDefinition {
  templateId: BuzzTemplateType;
  aspectRatio: BuzzAspectRatio;
  /** Global fallback settings key — buzz_studio_bg_{aspectRatio} */
  backgroundImageKey: string;
  /** Optional template-specific key — buzz_studio_bg_{templateId}_{aspectRatio} */
  templateBackgroundImageKey?: string;
  layoutMode?: TemplateLayoutMode;
  /** Absolute placeholder frames — used when layoutMode is "absolute" */
  frames?: TemplatePlaceholderFrames;
  /** Flex-stack zones — used when layoutMode is "stack" */
  zones: Partial<Record<PosterZoneId, PosterZoneSpec>>;
}

export interface TemplateLayoutSchema {
  templateId: BuzzTemplateType;
  layouts: TemplateLayoutDefinition[];
}

/** Resolve the global settings key used by Creative Assets Manager for a ratio. */
export function backgroundImageKeyForRatio(aspectRatio: BuzzAspectRatio): string {
  return `buzz_studio_bg_${aspectRatio}`;
}

/** Template-specific background key — separate from global uploads. */
export function templateBackgroundImageKey(
  templateId: BuzzTemplateType,
  aspectRatio: BuzzAspectRatio,
): string {
  return `buzz_studio_bg_${templateId}_${aspectRatio}`;
}
