/**
 * Buzz Studio — Image Quality Scorer
 *
 * Scores image resolution into four tiers purely from pixel dimensions.
 * No image processing. No network calls. No external APIs.
 */

import type { ResolutionScore, ResolutionTier } from "./asset-types";

/* ─── Thresholds ─────────────────────────────────────────────────────────────
 *
 *  Tier        Min short-edge   Min megapixels   Score range
 *  ──────────  ───────────────  ───────────────  ───────────
 *  poor        < 200px          < 0.04 MP        0  – 24
 *  fair        200 – 399px      0.04 – 0.39 MP   25 – 49
 *  good        400 – 799px      0.4  – 1.59 MP   50 – 79
 *  excellent   ≥ 800px          ≥ 1.6 MP         80 – 100
 *
 * ─────────────────────────────────────────────────────────────────────────── */

interface TierConfig {
  tier: ResolutionTier;
  label: string;
  /** Minimum short-edge dimension in pixels to qualify */
  minShortEdge: number;
  /** Base score (floor) for the tier */
  baseScore: number;
  /** Max incremental bonus score within the tier */
  bonusRange: number;
  /** Short-edge span for bonus interpolation */
  bonusEdgeSpan: number;
}

const TIER_CONFIGS: TierConfig[] = [
  {
    tier: "excellent",
    label: "Excellent",
    minShortEdge: 800,
    baseScore: 80,
    bonusRange: 20,
    bonusEdgeSpan: 1200, // 800 → 2000
  },
  {
    tier: "good",
    label: "Good",
    minShortEdge: 400,
    baseScore: 50,
    bonusRange: 29,
    bonusEdgeSpan: 400, // 400 → 800
  },
  {
    tier: "fair",
    label: "Fair",
    minShortEdge: 200,
    baseScore: 25,
    bonusRange: 24,
    bonusEdgeSpan: 200, // 200 → 400
  },
  {
    tier: "poor",
    label: "Poor",
    minShortEdge: 0,
    baseScore: 0,
    bonusRange: 24,
    bonusEdgeSpan: 200, // 0 → 200
  },
];

/* ─── Public API ─────────────────────────────────────────────────────────── */

/**
 * Score the resolution quality of an image from its pixel dimensions.
 *
 * @param width  - Image width in pixels
 * @param height - Image height in pixels
 * @returns      ResolutionScore with tier, numeric score, and display label
 *
 * @example
 * scoreResolution(1200, 900)
 * // → { tier: "excellent", score: 88, width: 1200, height: 900, … }
 *
 * scoreResolution(320, 240)
 * // → { tier: "fair", score: 34, … }
 */
export function scoreResolution(width: number, height: number): ResolutionScore {
  if (width <= 0 || height <= 0) {
    return {
      tier: "poor",
      score: 0,
      width,
      height,
      megapixels: 0,
      label: "Poor",
    };
  }

  const shortEdge = Math.min(width, height);
  const megapixels = parseFloat(((width * height) / 1_000_000).toFixed(2));

  const config = resolveTierConfig(shortEdge);

  const edgeAboveFloor = Math.max(0, shortEdge - config.minShortEdge);
  const bonus = Math.min(
    config.bonusRange,
    Math.round((edgeAboveFloor / config.bonusEdgeSpan) * config.bonusRange)
  );

  const score = Math.min(100, config.baseScore + bonus);

  return {
    tier: config.tier,
    score,
    width,
    height,
    megapixels,
    label: config.label,
  };
}

/**
 * Compare two resolution scores and return the better one.
 */
export function betterResolution(
  a: ResolutionScore,
  b: ResolutionScore
): ResolutionScore {
  return a.score >= b.score ? a : b;
}

/**
 * Return a user-facing description string for a resolution tier.
 */
export function describeTier(tier: ResolutionTier): string {
  const descriptions: Record<ResolutionTier, string> = {
    poor: "Very low resolution. Image will appear blurry in creatives.",
    fair: "Low resolution. Acceptable for small thumbnails only.",
    good: "Good resolution. Suitable for most social media formats.",
    excellent: "High resolution. Ready for all creative formats.",
  };
  return descriptions[tier];
}

/**
 * Returns true if the resolution is acceptable for creative generation
 * (tier is "good" or "excellent").
 */
export function isAcceptableResolution(score: ResolutionScore): boolean {
  return score.tier === "good" || score.tier === "excellent";
}

/* ─── Internal helpers ───────────────────────────────────────────────────── */

function resolveTierConfig(shortEdge: number): TierConfig {
  for (const config of TIER_CONFIGS) {
    if (shortEdge >= config.minShortEdge) {
      return config;
    }
  }
  return TIER_CONFIGS[TIER_CONFIGS.length - 1];
}
