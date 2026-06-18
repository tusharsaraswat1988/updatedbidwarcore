/**
 * Buzz Studio — Rendering Module
 *
 * Public API for the render pipeline layer.
 * Import from here — never from individual rendering files.
 *
 * Usage examples:
 *
 *   import {
 *     RenderFormat,
 *     RenderStatus,
 *     createRenderJob,
 *     runFullPipeline,
 *     ShareChannel,
 *   } from "@/features/buzz-studio/rendering";
 *
 * Pipeline stage availability:
 *   createRenderJob()      — available now (returns job as-is)
 *   submitRenderJob()      — Phase 9  (PNG renderer)
 *   pollRenderStatus()     — Phase 9  (PNG renderer)
 *   storeRenderResult()    — Phase 10 (storage adapter)
 *   createShareMetadata()  — Phase 11 (share pages)
 *   getShareByJobId()      — Phase 11 (share pages)
 *   runFullPipeline()      — Phase 11 (all stages composed)
 */

/* ─── Enums ──────────────────────────────────────────────────────────────── */
export { RenderFormat, RenderStatus } from "./render-types";
export { ShareChannel } from "./share-contracts";

/* ─── Types: Render Jobs ─────────────────────────────────────────────────── */
export type { RenderJob, RenderJobSubmission } from "./render-jobs";

/* ─── Types: Render Results ──────────────────────────────────────────────── */
export type { RenderResult } from "./render-results";

/* ─── Types: Storage ─────────────────────────────────────────────────────── */
export type { StoredAsset, AssetStorageProvider } from "./storage-contracts";

/* ─── Types: Share ───────────────────────────────────────────────────────── */
export type { ShareMetadata, ShareRequest } from "./share-contracts";

/* ─── Pipeline Functions ─────────────────────────────────────────────────── */
export {
  NotImplementedError,
  createRenderJob,
  submitRenderJob,
  pollRenderStatus,
  storeRenderResult,
  createShareMetadata,
  getShareByJobId,
  runFullPipeline,
  isRenderComplete,
  isRenderFailed,
  isRenderPending,
} from "./render-pipeline";
