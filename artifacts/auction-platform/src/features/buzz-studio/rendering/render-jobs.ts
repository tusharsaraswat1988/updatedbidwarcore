/**
 * Buzz Studio — Render Job Contract
 *
 * A RenderJob is the unit of work submitted to the renderer.
 * It carries everything the renderer needs to produce an image:
 *   - which template to render (templateId)
 *   - what data to render (contract)
 *   - what format to output (format)
 *   - what dimensions to produce (aspectRatio / width / height)
 *
 * The renderer never calls the database. It only reads the RenderJob.
 * The contract field is `unknown` at this layer because the pipeline
 * is template-agnostic — callers narrow the type via templateId before
 * passing to the renderer.
 *
 * Future flow:
 *   SoldPlayerContract
 *         ↓  (wrapped by createRenderJob)
 *       RenderJob
 *         ↓  (submitted to renderer queue)
 *       RenderResult
 *
 * Dependencies: registry/template-types, rendering/render-types
 */

import type { BuzzTemplateType } from "../registry/template-types";
import type { RenderFormat } from "./render-types";

/* ─── RenderJob ──────────────────────────────────────────────────────────── */

/**
 * A single render request — the atomic input to the render pipeline.
 *
 * @example
 * const job: RenderJob = {
 *   jobId: crypto.randomUUID(),
 *   templateId: BuzzTemplateType.SOLD_PLAYER,
 *   format: RenderFormat.PNG,
 *   contract: soldPlayerContract,
 *   aspectRatio: "1:1",
 *   createdAt: new Date().toISOString(),
 * };
 */
export interface RenderJob {
  /**
   * Unique identifier for this render job.
   * Recommended format: UUID v4.
   * Used as the correlation key across RenderResult, StoredAsset, and ShareMetadata.
   */
  jobId: string;

  /**
   * Which template to render.
   * The renderer uses this to resolve the correct React component
   * from the template registry — no switch statements required.
   */
  templateId: BuzzTemplateType;

  /**
   * Output image format.
   * @default RenderFormat.PNG
   */
  format: RenderFormat;

  /**
   * The template data contract.
   * Typed as `unknown` at the pipeline boundary — the renderer narrows
   * this to the correct contract type via templateId.
   *
   * Example values:
   *   SoldPlayerContract, PlayerSpotlightContract, MvpCardContract, …
   */
  contract: unknown;

  /**
   * Target aspect ratio for output dimensions.
   * Must match one of the values in the template's BuzzTemplateDefinition.aspectRatios.
   *
   * Examples: "1:1", "9:16", "16:9", "4:5"
   * The renderer maps this to concrete pixel dimensions.
   *
   * @default "1:1"
   */
  aspectRatio?: string;

  /**
   * Explicit output width in pixels.
   * When provided alongside height, overrides aspectRatio-based dimension lookup.
   * Useful for custom resolutions (e.g. OG image 1200×630).
   */
  width?: number;

  /**
   * Explicit output height in pixels.
   * See width for usage notes.
   */
  height?: number;

  /**
   * ISO 8601 timestamp when this job was created.
   * Used for audit trails and queue ordering.
   */
  createdAt?: string;
}

/* ─── RenderJobStatus ────────────────────────────────────────────────────── */

/**
 * Minimal status envelope returned immediately after job submission.
 * The full result is obtained via pollRenderStatus(jobId).
 */
export interface RenderJobSubmission {
  jobId: string;
  /** Queue position if available. Undefined for synchronous renderers. */
  queuePosition?: number;
  /** Estimated completion time in milliseconds. */
  estimatedMs?: number;
}
