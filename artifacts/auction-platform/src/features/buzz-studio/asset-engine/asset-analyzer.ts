/**
 * Buzz Studio — Asset Analyzer
 *
 * Computes a composite AssetHealthScore from an AssetDescriptor.
 * Aggregates resolution quality, transparency status, format support,
 * file-size checks, and aspect-ratio fitness into a single 0–100 score.
 *
 * No external APIs. No image processing. Pure logic over descriptor fields.
 */

import type {
  AssetDescriptor,
  AssetHealthScore,
  AssetIssue,
  AssetIssueCode,
  AssetRecommendation,
  RecommendationCode,
  TransparencyResult,
} from "./asset-types";
import { scoreResolution, isAcceptableResolution } from "./image-quality";

/* ─── Supported formats ──────────────────────────────────────────────────── */

const TRANSPARENT_FORMATS = new Set(["png", "webp", "gif", "apng", "avif"]);
const SUPPORTED_FORMATS = new Set([
  "png", "jpg", "jpeg", "webp", "gif", "avif", "heic", "heif",
]);
const PREFERRED_FORMATS = new Set(["png", "webp"]);

/* ─── Score weights (must sum to 100) ────────────────────────────────────── */
//
//  Resolution quality  → 50 pts
//  Image present       → 20 pts
//  Format fitness      → 15 pts
//  File size           → 10 pts
//  Aspect ratio        →  5 pts
//
const W_RESOLUTION = 50;
const W_PRESENT = 20;
const W_FORMAT = 15;
const W_FILESIZE = 10;
const W_ASPECT = 5;

/** Max file size before the OVERSIZED_FILE issue is raised (10 MB). */
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Ideal aspect-ratio range for player/team avatars (0.8 : 1 → 1.25 : 1). */
const IDEAL_RATIO_MIN = 0.8;
const IDEAL_RATIO_MAX = 1.25;

/* ─── Public API ─────────────────────────────────────────────────────────── */

/**
 * Analyse an asset descriptor and return a composite health score.
 *
 * @example
 * analyzeAsset({
 *   id: "p1",
 *   kind: "player",
 *   imageUrl: "https://cdn.example.com/player.png",
 *   width: 400,
 *   height: 400,
 *   format: "png",
 *   fileSizeBytes: 180_000,
 * });
 * // → { score: 95, issues: [], recommendations: [], isUsable: true }
 *
 * analyzeAsset({ id: "p2", kind: "player" });
 * // → { score: 0, issues: [MISSING_IMAGE], recommendations: [REPLACE_WITH_MONOGRAM], isUsable: false }
 */
export function analyzeAsset(asset: AssetDescriptor): AssetHealthScore {
  const issues: AssetIssue[] = [];
  const recommendations: AssetRecommendation[] = [];
  let total = 0;

  /* ── 1. Image present (20 pts) ────────────────────────────────────────── */
  if (!asset.imageUrl) {
    addIssue(issues, "MISSING_IMAGE", "No image provided for this asset.", 3);
    addRec(recommendations, "REPLACE_WITH_MONOGRAM", "Use an auto-generated monogram as a placeholder.");
    return finalise(0, issues, recommendations);
  }

  total += W_PRESENT;

  /* ── 2. Resolution (50 pts) ───────────────────────────────────────────── */
  const resScore = resolveResolutionScore(asset, issues, recommendations);
  total += Math.round((resScore / 100) * W_RESOLUTION);

  /* ── 3. Format fitness (15 pts) ──────────────────────────────────────── */
  const fmtScore = resolveFormatScore(asset, issues, recommendations);
  total += Math.round((fmtScore / 100) * W_FORMAT);

  /* ── 4. File size (10 pts) ───────────────────────────────────────────── */
  const sizeScore = resolveFileSizeScore(asset, issues, recommendations);
  total += Math.round((sizeScore / 100) * W_FILESIZE);

  /* ── 5. Aspect ratio (5 pts) ─────────────────────────────────────────── */
  const ratioScore = resolveAspectRatioScore(asset, issues, recommendations);
  total += Math.round((ratioScore / 100) * W_ASPECT);

  return finalise(Math.min(100, total), issues, recommendations);
}

/**
 * Detect whether an image format supports transparency.
 * Returns a TransparencyResult — no actual pixel inspection.
 */
export function detectTransparencySupport(format?: string): TransparencyResult {
  if (!format) {
    return { status: "unknown", hasTransparency: false };
  }

  const normalised = format.toLowerCase().replace(/^\./, "");

  if (!SUPPORTED_FORMATS.has(normalised)) {
    return {
      status: "unsupported_format",
      hasTransparency: false,
      format: normalised,
    };
  }

  const hasTransparency = TRANSPARENT_FORMATS.has(normalised);

  return {
    status: hasTransparency ? "detected" : "not_detected",
    hasTransparency,
    format: normalised,
  };
}

/**
 * Batch-analyse multiple assets and return their scores, sorted by score desc.
 */
export function batchAnalyze(
  assets: AssetDescriptor[]
): Array<{ asset: AssetDescriptor; health: AssetHealthScore }> {
  return assets
    .map((asset) => ({ asset, health: analyzeAsset(asset) }))
    .sort((a, b) => b.health.score - a.health.score);
}

/* ─── Sub-scorers ────────────────────────────────────────────────────────── */

function resolveResolutionScore(
  asset: AssetDescriptor,
  issues: AssetIssue[],
  recommendations: AssetRecommendation[]
): number {
  if (!asset.width || !asset.height) {
    // Dimensions unknown — partial credit, flag for review
    return 50;
  }

  const res = scoreResolution(asset.width, asset.height);

  if (!isAcceptableResolution(res)) {
    addIssue(
      issues,
      "LOW_RESOLUTION",
      `Image is ${res.width}×${res.height}px (${res.label}). Minimum recommended: 400px short edge.`,
      res.tier === "poor" ? 3 : 2
    );
    addRec(
      recommendations,
      "UPLOAD_HIGHER_RES",
      "Upload an image with at least 400×400px for best results."
    );
  }

  return res.score;
}

function resolveFormatScore(
  asset: AssetDescriptor,
  issues: AssetIssue[],
  recommendations: AssetRecommendation[]
): number {
  if (!asset.format) return 60; // unknown format — partial credit

  const fmt = asset.format.toLowerCase().replace(/^\./, "");

  if (!SUPPORTED_FORMATS.has(fmt)) {
    addIssue(
      issues,
      "UNSUPPORTED_FORMAT",
      `Format "${fmt}" is not supported. Use PNG, WebP, or JPEG.`,
      3
    );
    return 0;
  }

  if (!PREFERRED_FORMATS.has(fmt)) {
    const transparency = detectTransparencySupport(fmt);
    if (!transparency.hasTransparency && asset.kind !== "tournament") {
      addIssue(
        issues,
        "NO_TRANSPARENCY",
        `Format "${fmt}" does not support transparency. Background removal will not be possible.`,
        1
      );
      addRec(
        recommendations,
        "USE_PNG_OR_WEBP",
        "Re-upload as PNG or WebP to enable background removal."
      );
      return 60;
    }
  }

  return 100;
}

function resolveFileSizeScore(
  asset: AssetDescriptor,
  issues: AssetIssue[],
  recommendations: AssetRecommendation[]
): number {
  if (!asset.fileSizeBytes) return 80; // unknown — partial credit

  if (asset.fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    addIssue(
      issues,
      "OVERSIZED_FILE",
      `File is ${(asset.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB. Exceeds 10 MB limit.`,
      2
    );
    addRec(
      recommendations,
      "COMPRESS_FILE",
      "Compress the image to under 10 MB before using in creatives."
    );
    return 20;
  }

  // Gracefully scale: ideal < 2 MB
  const MB = asset.fileSizeBytes / (1024 * 1024);
  if (MB <= 2) return 100;
  if (MB <= 5) return 80;
  return 50;
}

function resolveAspectRatioScore(
  asset: AssetDescriptor,
  issues: AssetIssue[],
  recommendations: AssetRecommendation[]
): number {
  if (!asset.width || !asset.height) return 80;

  const ratio = asset.width / asset.height;

  if (ratio < IDEAL_RATIO_MIN || ratio > IDEAL_RATIO_MAX) {
    addIssue(
      issues,
      "ASPECT_RATIO_MISMATCH",
      `Aspect ratio ${ratio.toFixed(2)}:1 is outside the ideal range (0.8:1 – 1.25:1).`,
      1
    );
    addRec(
      recommendations,
      "CROP_TO_SQUARE",
      "Crop the image closer to a 1:1 ratio for best results in player cards."
    );
    return 40;
  }

  return 100;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function addIssue(
  list: AssetIssue[],
  code: AssetIssueCode,
  message: string,
  severity: 1 | 2 | 3
): void {
  if (list.some((i) => i.code === code)) return; // deduplicate
  list.push({ code, message, severity });
}

function addRec(
  list: AssetRecommendation[],
  code: RecommendationCode,
  message: string
): void {
  if (list.some((r) => r.code === code)) return; // deduplicate
  list.push({ code, message });
}

function finalise(
  score: number,
  issues: AssetIssue[],
  recommendations: AssetRecommendation[]
): AssetHealthScore {
  const hasBlocker = issues.some((i) => i.severity === 3);
  const isUsable = score >= 70 && !hasBlocker;
  return { score, issues, recommendations, isUsable };
}
