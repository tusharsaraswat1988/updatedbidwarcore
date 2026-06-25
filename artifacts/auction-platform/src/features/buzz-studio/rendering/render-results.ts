/**
 * Buzz Studio — Render Result Contract
 *
 * A RenderResult is produced by the renderer after a RenderJob completes.
 * It carries the job outcome: status, location of the output file,
 * and metadata about the produced image.
 *
 * The jobId links a result back to its originating RenderJob,
 * and forward to its StoredAsset and ShareMetadata.
 *
 * Future flow:
 *   RenderJob
 *       ↓  (renderer processes)
 *   RenderResult          ← this file
 *       ↓  (storeRenderResult)
 *   StoredAsset
 *
 * Dependencies: rendering/render-types only.
 */

import type { RenderStatus } from "./render-types";

/* ─── RenderResult ───────────────────────────────────────────────────────── */

/**
 * The outcome of a completed (or failed) render job.
 *
 * @example — successful result
 * {
 *   jobId: "abc-123",
 *   status: RenderStatus.COMPLETED,
 *   fileUrl: "blob:...",   // temporary renderer-local URL before storage upload
 *   fileSizeBytes: 184320,
 *   width: 1080,
 *   height: 1080,
 *   generatedAt: "2026-06-18T12:34:56.789Z"
 * }
 *
 * @example — failed result
 * {
 *   jobId: "abc-123",
 *   status: RenderStatus.FAILED,
 *   error: "Template component threw during render",
 *   generatedAt: "2026-06-18T12:34:56.789Z"
 * }
 */
export interface RenderResult {
  /**
   * Correlation key — links back to the originating RenderJob
   * and forward to StoredAsset.
   */
  jobId: string;

  /**
   * Current lifecycle state of this result.
   * COMPLETED means fileUrl is populated and safe to use.
   * FAILED means error is populated.
   */
  status: RenderStatus;

  /**
   * Temporary URL of the rendered file.
   * Populated only when status === COMPLETED.
   *
   * This URL is ephemeral (renderer-local or short-lived object URL).
   * The storage layer reads from this URL and writes to a durable location,
   * producing a StoredAsset.publicUrl.
   */
  fileUrl?: string;

  /**
   * MIME type of the output file.
   * e.g. "image/png", "image/jpeg", "image/webp"
   */
  mimeType?: string;

  /**
   * File size in bytes. Used for storage quota checks and analytics.
   */
  fileSizeBytes?: number;

  /**
   * Output width in pixels.
   */
  width?: number;

  /**
   * Output height in pixels.
   */
  height?: number;

  /**
   * ISO 8601 timestamp when the render completed or failed.
   */
  generatedAt?: string;

  /**
   * Human-readable error description. Populated only when status === FAILED.
   * Renderer implementations should populate this with actionable detail.
   */
  error?: string;
}
