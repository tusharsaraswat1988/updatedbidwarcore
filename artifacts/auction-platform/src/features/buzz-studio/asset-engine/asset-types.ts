/**
 * Buzz Studio — Asset Engine Types
 *
 * Pure type definitions for the asset quality pipeline.
 * No processing logic. No external API contracts.
 */

/* ─── Resolution quality tiers ─────────────────────────────────────────────── */

export type ResolutionTier = "poor" | "fair" | "good" | "excellent";

export interface ResolutionScore {
  tier: ResolutionTier;
  /** Raw numeric score 0–100 */
  score: number;
  width: number;
  height: number;
  megapixels: number;
  /** Human-readable label for UI display */
  label: string;
}

/* ─── Transparency ──────────────────────────────────────────────────────────── */

export type TransparencyStatus =
  | "unknown"
  | "detected"
  | "not_detected"
  | "unsupported_format";

export interface TransparencyResult {
  status: TransparencyStatus;
  /** true only when status === "detected" */
  hasTransparency: boolean;
  /** Format that was inspected, e.g. "png", "jpg", "webp" */
  format?: string;
}

/* ─── Asset health ──────────────────────────────────────────────────────────── */

export type AssetIssueCode =
  | "LOW_RESOLUTION"
  | "NO_TRANSPARENCY"
  | "MISSING_IMAGE"
  | "UNSUPPORTED_FORMAT"
  | "ASPECT_RATIO_MISMATCH"
  | "OVERSIZED_FILE";

export type RecommendationCode =
  | "UPLOAD_HIGHER_RES"
  | "USE_PNG_OR_WEBP"
  | "REMOVE_BACKGROUND"
  | "CROP_TO_SQUARE"
  | "COMPRESS_FILE"
  | "REPLACE_WITH_MONOGRAM";

export interface AssetIssue {
  code: AssetIssueCode;
  message: string;
  /** Severity 1 (minor) – 3 (blocking) */
  severity: 1 | 2 | 3;
}

export interface AssetRecommendation {
  code: RecommendationCode;
  message: string;
}

export interface AssetHealthScore {
  /** Composite 0–100 */
  score: number;
  issues: AssetIssue[];
  recommendations: AssetRecommendation[];
  /** Convenience flag: score >= 70 and no severity-3 issues */
  isUsable: boolean;
}

/* ─── Asset descriptor (the shape callers pass in) ──────────────────────────── */

export type AssetKind = "player" | "team" | "tournament";

export interface AssetDescriptor {
  id: string;
  kind: AssetKind;
  /** URL or data-URI. Absent means the asset is missing entirely. */
  imageUrl?: string;
  /** Width in pixels, if known at call-time */
  width?: number;
  /** Height in pixels, if known at call-time */
  height?: number;
  /** Approximate file size in bytes, if known */
  fileSizeBytes?: number;
  /** e.g. "png", "jpg", "webp", "gif" */
  format?: string;
}

/* ─── Monogram ──────────────────────────────────────────────────────────────── */

export interface MonogramResult {
  /** Two (or one) uppercase initials */
  initials: string;
  /** Original input string that was parsed */
  source: string;
}

/* ─── Enhancement pipeline ──────────────────────────────────────────────────── */

export type EnhancementOperation =
  | "BACKGROUND_REMOVAL"
  | "UPSCALE"
  | "COMPRESS"
  | "CROP_SQUARE"
  | "FORMAT_CONVERT";

export type EnhancementStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

export interface EnhancementStep {
  operation: EnhancementOperation;
  status: EnhancementStatus;
  /** ISO timestamp when this step completed or failed */
  completedAt?: string;
  errorMessage?: string;
}

export interface EnhancementPipelineResult {
  assetId: string;
  steps: EnhancementStep[];
  /** true when every non-skipped step is completed */
  isComplete: boolean;
  /** Final processed image URL — populated by the render engine in Phase 2 */
  outputUrl?: string;
}
