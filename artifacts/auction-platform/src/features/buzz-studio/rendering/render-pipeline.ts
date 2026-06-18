/**
 * Buzz Studio — Render Pipeline
 *
 * The canonical pipeline interface for the full render → store → share flow.
 *
 * Each function in this file defines a pipeline stage.
 * Implementations are NOT provided here — this file is the contract boundary.
 * Future renderer, storage, and share implementations plug in by replacing
 * the stubs below.
 *
 * Full pipeline:
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ 1. createRenderJob()   — wrap contract into a RenderJob │
 *   │ 2. submitRenderJob()   — send to renderer queue         │
 *   │ 3. pollRenderStatus()  — check job completion           │
 *   │ 4. storeRenderResult() — upload image to storage        │
 *   │ 5. createShareMetadata()— generate public share URL     │
 *   │ 6. getShareByJobId()   — retrieve share for a job       │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Callers never import storage SDKs, renderer libraries, or share-page logic.
 * They call these functions and receive typed contracts.
 *
 * When to implement each stage:
 *   Phase 9  — submitRenderJob / pollRenderStatus (PNG renderer)
 *   Phase 10 — storeRenderResult (storage adapter)
 *   Phase 11 — createShareMetadata / getShareByJobId (share pages)
 *   Phase 12 — WhatsApp delivery (uses ShareMetadata.whatsappCaption)
 */

import type { RenderJob, RenderJobSubmission } from "./render-jobs";
import type { RenderResult } from "./render-results";
import type { StoredAsset } from "./storage-contracts";
import type { ShareMetadata, ShareRequest } from "./share-contracts";
import { RenderFormat, RenderStatus } from "./render-types";
import type { BuzzTemplateType } from "../registry/template-types";

/* ─── NotImplementedError ────────────────────────────────────────────────── */

/**
 * Thrown by pipeline stubs that have not yet been implemented.
 * Distinct from a generic Error so callers can handle it specifically
 * and know the missing implementation is intentional (phase-gated).
 */
export class NotImplementedError extends Error {
  readonly stage: string;

  constructor(stage: string) {
    super(
      `Render pipeline stage "${stage}" is not yet implemented. ` +
      `This stub will be replaced in a future phase.`
    );
    this.name = "NotImplementedError";
    this.stage = stage;
  }
}

/* ─── Stage 1: createRenderJob ───────────────────────────────────────────── */

/**
 * Wraps a template contract into a RenderJob.
 *
 * This is the entry point to the pipeline. Callers provide the template
 * type, the contract, and optional format/dimension overrides. The job
 * is returned immediately and can be inspected before submission.
 *
 * Implementation note (Phase 9):
 *   Replace the body with jobId generation (crypto.randomUUID()) and
 *   validation that templateId maps to an enabled template in the registry.
 *
 * @example
 * const job = createRenderJob({
 *   jobId: crypto.randomUUID(),
 *   templateId: BuzzTemplateType.SOLD_PLAYER,
 *   format: RenderFormat.PNG,
 *   contract: soldPlayerContract,
 *   aspectRatio: "1:1",
 *   createdAt: new Date().toISOString(),
 * });
 */
export function createRenderJob(job: RenderJob): RenderJob {
  return job;
}

/* ─── Stage 2: submitRenderJob ───────────────────────────────────────────── */

/**
 * Submits a RenderJob to the renderer queue.
 *
 * The renderer resolves the template component from the registry,
 * calls the headless render engine (e.g. Satori → Sharp), and
 * produces a RenderResult with a temporary fileUrl.
 *
 * Implementation note (Phase 9):
 *   - Use getTemplateById(job.templateId) to resolve the component.
 *   - Pass component + contract to the headless renderer.
 *   - Return RenderJobSubmission immediately; result available via pollRenderStatus.
 *
 * @throws NotImplementedError until Phase 9
 */
export async function submitRenderJob(
  job: RenderJob
): Promise<RenderJobSubmission> {
  throw new NotImplementedError("submitRenderJob");
}

/* ─── Stage 3: pollRenderStatus ──────────────────────────────────────────── */

/**
 * Polls the renderer for the current status of a job.
 *
 * For synchronous renderers, this returns immediately with a COMPLETED
 * or FAILED result. For async queue-based renderers, callers should
 * poll with a backoff strategy.
 *
 * Implementation note (Phase 9):
 *   Store RenderResults in a job store (in-memory, KV, or DB).
 *   Return the stored result for the given jobId.
 *
 * @throws NotImplementedError until Phase 9
 */
export async function pollRenderStatus(
  jobId: string
): Promise<RenderResult> {
  throw new NotImplementedError("pollRenderStatus");
}

/* ─── Stage 4: storeRenderResult ─────────────────────────────────────────── */

/**
 * Uploads a completed render result to durable storage.
 *
 * Reads the image bytes from RenderResult.fileUrl, uploads to the
 * configured storage provider, and returns a StoredAsset with a
 * permanent publicUrl.
 *
 * Implementation note (Phase 10):
 *   Inject an AssetStorageProvider implementation (R2, S3, Firebase).
 *   The provider interface ensures no vendor lock-in at the call site.
 *
 * @throws NotImplementedError until Phase 10
 */
export async function storeRenderResult(
  result: RenderResult
): Promise<StoredAsset> {
  throw new NotImplementedError("storeRenderResult");
}

/* ─── Stage 5: createShareMetadata ──────────────────────────────────────── */

/**
 * Generates public share metadata for a stored asset.
 *
 * Produces a ShareMetadata record with a short shareId, a share page URL,
 * an optional download URL, and a pre-formatted WhatsApp caption.
 *
 * downloadEnabled defaults to true — players must be able to download
 * their card to share on WhatsApp and other platforms.
 *
 * Implementation note (Phase 11):
 *   Generate a short shareId (e.g. "buzz_" + nanoid(6)).
 *   Persist the ShareMetadata to the database for share page resolution.
 *   Return the full metadata with shareUrl and downloadUrl populated.
 *
 * @throws NotImplementedError until Phase 11
 */
export function createShareMetadata(
  asset: StoredAsset,
  request?: Partial<ShareRequest>
): ShareMetadata {
  throw new NotImplementedError("createShareMetadata");
}

/* ─── Stage 6: getShareByJobId ───────────────────────────────────────────── */

/**
 * Retrieves the ShareMetadata for a given render job.
 *
 * Useful for re-sharing a previously rendered card without re-rendering.
 * Returns null if no share exists for the jobId.
 *
 * Implementation note (Phase 11):
 *   Query the share metadata store by jobId.
 *
 * @throws NotImplementedError until Phase 11
 */
export async function getShareByJobId(
  jobId: string
): Promise<ShareMetadata | null> {
  throw new NotImplementedError("getShareByJobId");
}

/* ─── Stage 7: runFullPipeline ───────────────────────────────────────────── */

/**
 * Convenience function that runs all pipeline stages in sequence.
 *
 * Intended for simple one-shot use cases:
 *   given a contract, produce a share URL in one call.
 *
 * Full pipeline:
 *   contract → RenderJob → submit → poll → store → share
 *
 * Implementation note (Phase 11 after all stages are implemented):
 *   Compose submitRenderJob → pollRenderStatus → storeRenderResult
 *   → createShareMetadata in sequence with error handling.
 *
 * @throws NotImplementedError until all pipeline stages are implemented
 */
export async function runFullPipeline(options: {
  templateId: BuzzTemplateType;
  contract: unknown;
  format?: RenderFormat;
  aspectRatio?: string;
}): Promise<ShareMetadata> {
  throw new NotImplementedError("runFullPipeline");
}

/* ─── Pipeline result helpers ────────────────────────────────────────────── */

/**
 * Returns true if a RenderResult represents a successful completed render.
 */
export function isRenderComplete(result: RenderResult): boolean {
  return result.status === RenderStatus.COMPLETED && result.fileUrl != null;
}

/**
 * Returns true if a RenderResult represents a failed render.
 */
export function isRenderFailed(result: RenderResult): boolean {
  return result.status === RenderStatus.FAILED;
}

/**
 * Returns true if a RenderResult is still in progress.
 */
export function isRenderPending(result: RenderResult): boolean {
  return (
    result.status === RenderStatus.PENDING ||
    result.status === RenderStatus.PROCESSING
  );
}
