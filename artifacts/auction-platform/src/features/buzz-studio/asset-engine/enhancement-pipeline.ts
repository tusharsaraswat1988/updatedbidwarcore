/**
 * Buzz Studio — Enhancement Pipeline
 *
 * Architectural skeleton for the future asset enhancement pipeline.
 *
 * Phase 1: pure architecture — all operations return stub/no-op results.
 * Phase 2: real implementations will be slotted in per operation type.
 *
 * NO external API calls. NO image processing. NO network requests.
 */

import type {
  EnhancementOperation,
  EnhancementPipelineResult,
  EnhancementStatus,
  EnhancementStep,
  AssetDescriptor,
  AssetHealthScore,
} from "./asset-types";
import { analyzeAsset } from "./asset-analyzer";

/* ─── Operation registry ─────────────────────────────────────────────────── */

/**
 * Metadata for each enhancement operation.
 * Phase 2 will attach a real `execute` function to each entry.
 */
interface OperationMeta {
  operation: EnhancementOperation;
  /** Human label for UI display */
  label: string;
  /** One-line description */
  description: string;
  /** Whether this operation requires the image to be present */
  requiresImage: boolean;
  /** Phase where this operation will be implemented */
  availableInPhase: number;
}

export const OPERATION_REGISTRY: Readonly<Record<EnhancementOperation, OperationMeta>> = {
  BACKGROUND_REMOVAL: {
    operation: "BACKGROUND_REMOVAL",
    label: "Background Removal",
    description: "Remove image background to isolate the subject.",
    requiresImage: true,
    availableInPhase: 2,
  },
  UPSCALE: {
    operation: "UPSCALE",
    label: "Upscale",
    description: "Increase image resolution using AI upscaling.",
    requiresImage: true,
    availableInPhase: 3,
  },
  COMPRESS: {
    operation: "COMPRESS",
    label: "Compress",
    description: "Reduce file size while preserving visual quality.",
    requiresImage: true,
    availableInPhase: 2,
  },
  CROP_SQUARE: {
    operation: "CROP_SQUARE",
    label: "Crop to Square",
    description: "Smart-crop image to a 1:1 aspect ratio.",
    requiresImage: true,
    availableInPhase: 2,
  },
  FORMAT_CONVERT: {
    operation: "FORMAT_CONVERT",
    label: "Convert Format",
    description: "Convert image to PNG or WebP for transparency support.",
    requiresImage: true,
    availableInPhase: 2,
  },
};

/* ─── Pipeline builder ───────────────────────────────────────────────────── */

/**
 * Build an enhancement plan from an asset's health score.
 * Returns the list of operations that should be applied, in order.
 *
 * Phase 1: purely determines WHICH steps are needed.
 * Actual execution is stubbed — all steps are returned as "pending".
 *
 * @example
 * const steps = buildPipeline(asset, health);
 * // → [{ operation: "FORMAT_CONVERT", status: "pending" }, …]
 */
export function buildPipeline(
  asset: AssetDescriptor,
  health: AssetHealthScore
): EnhancementStep[] {
  const steps: EnhancementStep[] = [];

  const issueCodes = new Set(health.issues.map((i) => i.code));
  const recCodes = new Set(health.recommendations.map((r) => r.code));

  /* Format conversion must happen first */
  if (recCodes.has("USE_PNG_OR_WEBP")) {
    steps.push(pendingStep("FORMAT_CONVERT"));
  }

  /* Background removal (requires transparency-capable format) */
  if (issueCodes.has("NO_TRANSPARENCY") || recCodes.has("REMOVE_BACKGROUND")) {
    steps.push(pendingStep("BACKGROUND_REMOVAL"));
  }

  /* Crop before upscale so upscale works on the correct region */
  if (issueCodes.has("ASPECT_RATIO_MISMATCH") || recCodes.has("CROP_TO_SQUARE")) {
    steps.push(pendingStep("CROP_SQUARE"));
  }

  /* Upscale low-res assets */
  if (issueCodes.has("LOW_RESOLUTION") && asset.imageUrl) {
    steps.push(pendingStep("UPSCALE"));
  }

  /* Compress large files — always last */
  if (issueCodes.has("OVERSIZED_FILE") || recCodes.has("COMPRESS_FILE")) {
    steps.push(pendingStep("COMPRESS"));
  }

  return steps;
}

/**
 * Convenience: analyse an asset and immediately build its enhancement plan.
 *
 * @example
 * const result = planEnhancement({ id: "p1", kind: "player", imageUrl: "…", width: 200, height: 250, format: "jpg" });
 * // → { assetId: "p1", steps: [{…}], isComplete: false, outputUrl: undefined }
 */
export function planEnhancement(asset: AssetDescriptor): EnhancementPipelineResult {
  const health = analyzeAsset(asset);
  const steps = buildPipeline(asset, health);

  return {
    assetId: asset.id,
    steps,
    isComplete: steps.length === 0,
    outputUrl: undefined,
  };
}

/**
 * Stub executor — marks every step as "skipped" in Phase 1.
 * Phase 2 will replace this with real per-operation handlers.
 *
 * @param plan - A pipeline result produced by planEnhancement()
 * @returns    Updated pipeline result with all steps marked skipped
 */
export function executeStub(
  plan: EnhancementPipelineResult
): EnhancementPipelineResult {
  const steps: EnhancementStep[] = plan.steps.map((step) => ({
    ...step,
    status: "skipped" as EnhancementStatus,
    completedAt: new Date().toISOString(),
    errorMessage: "Not implemented in Phase 1.",
  }));

  return {
    ...plan,
    steps,
    isComplete: false,
    outputUrl: undefined,
  };
}

/* ─── Pipeline status helpers ────────────────────────────────────────────── */

/**
 * Count steps by their current status.
 */
export function summarisePipeline(result: EnhancementPipelineResult): {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
  skipped: number;
} {
  const counts = { total: 0, pending: 0, inProgress: 0, completed: 0, failed: 0, skipped: 0 };

  for (const step of result.steps) {
    counts.total++;
    switch (step.status) {
      case "pending":      counts.pending++;     break;
      case "in_progress":  counts.inProgress++;  break;
      case "completed":    counts.completed++;    break;
      case "failed":       counts.failed++;       break;
      case "skipped":      counts.skipped++;      break;
    }
  }

  return counts;
}

/**
 * Returns true if the pipeline has no enhancement steps to run
 * (asset is already optimal).
 */
export function isPipelineEmpty(result: EnhancementPipelineResult): boolean {
  return result.steps.length === 0;
}

/* ─── Internal helpers ───────────────────────────────────────────────────── */

function pendingStep(operation: EnhancementOperation): EnhancementStep {
  return { operation, status: "pending" };
}
