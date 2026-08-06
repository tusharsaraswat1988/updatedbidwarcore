/**
 * Compatibility Adapter — temporary migration bridge only.
 *
 * PresentationExecutionPolicy → legacy theme/layout paint DTO for existing
 * display / overlay / live-score surfaces.
 * NOT a second Presentation Engine. Future removal must require zero Presentation Engine changes.
 *
 * Maps semantic contract values onto today's production defaults so renderers keep working
 * without redesign (Phase 1 — no behaviour change).
 */

import type { PresentationExecutionPolicy } from "./execution-policy.ts";

/** Legacy DisplayThemeName ids used by front-end DISPLAY_THEMES. */
export type CompatibilityDisplayThemeId =
  | "stadium-gold"
  | "royal-sapphire"
  | "emerald-cup"
  | "crimson-final";

/** Legacy broadcast theme ids. */
export type CompatibilityBroadcastThemeId = "gold" | "crimson" | "premium-dark";

/**
 * Temporary projection consumed by existing theme / layout helpers.
 * Concrete CSS values mirror current stadium-gold production defaults.
 */
export type CompatibilityPresentationPaintJson = {
  /** Marker — never treat as Snapshot / Catalog authority. */
  source: "presentation_execution_policy";
  displayThemeId: CompatibilityDisplayThemeId;
  stagePreset: "gold" | "sapphire" | "emerald" | "crimson";
  broadcastTheme: CompatibilityBroadcastThemeId;
  accentColor: string;
  backgroundColor: string;
  accentGlow: string;
  scoreFontToken: string;
  safeAreaBottomPx: number;
  sponsorStripEnabled: boolean;
  tickerEnabled: boolean;
  animationEnabled: boolean;
  clockEnabled: boolean;
  primaryScoreEnabled: boolean;
  /** Identity echo for session/renderer bind without importing the engine. */
  presentationResolutionId: string;
  presentationHash: string;
  presentationVersion: string;
};

const DEFAULT_ACCENT = "#FFD700";
const DEFAULT_BG = "#050507";
const DEFAULT_GLOW = "rgba(255, 215, 0, 0.35)";
/** Matches existing sponsor ribbon safe inset used by display surfaces. */
const DEFAULT_SAFE_AREA_BOTTOM_PX = 12;

function featureEnabled(
  policy: PresentationExecutionPolicy,
  featureId: string,
  fallback: boolean,
): boolean {
  const hit = policy.features.find((f) => f.featureId === featureId);
  if (!hit) return fallback;
  return hit.state === "enabled" || hit.state === "forced";
}

function tokenString(
  policy: PresentationExecutionPolicy,
  tokenId: string,
  fallback: string,
): string {
  const hit = policy.tokens.find((t) => t.tokenId === tokenId);
  if (hit && typeof hit.value === "string") return hit.value;
  return fallback;
}

/**
 * Project PresentationExecutionPolicy → temporary paint JSON for legacy renderers.
 * Phase 1 locks visual defaults to current stadium-gold production look.
 */
export function projectPresentationExecutionPolicyToPaintJson(
  policy: PresentationExecutionPolicy,
): CompatibilityPresentationPaintJson {
  return Object.freeze({
    source: "presentation_execution_policy" as const,
    displayThemeId: "stadium-gold",
    stagePreset: "gold",
    broadcastTheme: "gold",
    accentColor: DEFAULT_ACCENT,
    backgroundColor: DEFAULT_BG,
    accentGlow: DEFAULT_GLOW,
    scoreFontToken: tokenString(policy, "presentation.token.font.score", "font.score"),
    safeAreaBottomPx: DEFAULT_SAFE_AREA_BOTTOM_PX,
    sponsorStripEnabled: featureEnabled(
      policy,
      "presentation.feature.sponsor_strip",
      true,
    ),
    tickerEnabled: featureEnabled(policy, "presentation.feature.ticker", true),
    animationEnabled: featureEnabled(policy, "presentation.feature.animation", false),
    clockEnabled: featureEnabled(policy, "presentation.feature.clock", true),
    primaryScoreEnabled: featureEnabled(
      policy,
      "presentation.feature.primary_score",
      true,
    ),
    presentationResolutionId: policy.presentationResolutionId,
    presentationHash: policy.presentationHash,
    presentationVersion: policy.presentationVersion,
  });
}
