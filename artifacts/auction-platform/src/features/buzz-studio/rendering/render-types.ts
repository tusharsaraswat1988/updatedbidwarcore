/**
 * Buzz Studio — Render Types
 *
 * Core enums for the render pipeline.
 * No imports. No dependencies. Pure values.
 *
 * Used by:
 *   RenderJob    — format field
 *   RenderResult — status field
 *   Dashboard    — status display
 *   Renderer     — output format selection
 */

/* ─── RenderFormat ───────────────────────────────────────────────────────── */

/**
 * Output image format for a render job.
 *
 * PNG   — lossless, transparency support. Default for Buzz Studio creatives.
 *         Best for WhatsApp, Instagram, Facebook downloads.
 * JPEG  — lossy, smaller file size, no transparency.
 *         Use when storage cost matters and transparency is not needed.
 * WEBP  — modern, efficient, broad browser support.
 *         Preferred for web share pages and OG images.
 */
export enum RenderFormat {
  PNG  = "png",
  JPEG = "jpeg",
  WEBP = "webp",
}

/* ─── RenderStatus ───────────────────────────────────────────────────────── */

/**
 * Lifecycle status of a render job.
 *
 * PENDING    — job created, not yet picked up by the renderer.
 * PROCESSING — renderer is actively generating the image.
 * COMPLETED  — render finished; RenderResult.fileUrl is populated.
 * FAILED     — render failed; RenderResult.error will describe why.
 *
 * State machine:
 *   PENDING → PROCESSING → COMPLETED
 *                        → FAILED
 */
export enum RenderStatus {
  PENDING    = "pending",
  PROCESSING = "processing",
  COMPLETED  = "completed",
  FAILED     = "failed",
}
