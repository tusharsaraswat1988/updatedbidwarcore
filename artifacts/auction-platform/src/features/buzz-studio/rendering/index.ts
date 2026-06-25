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

/* ─── Poster render context (preview + export) ───────────────────────────── */
export type {
  BuzzRenderMode,
  BuzzAspectRatio,
  BuzzTemplateRenderProps,
  BuzzRenderContext,
} from "./buzz-render-context";
export {
  BUZZ_EXPORT_DIMENSIONS,
  isBuzzAspectRatio,
  resolveBuzzExportDimensions,
  hasRenderFrame,
  pickRenderContext,
  canvasH,
  canvasW,
} from "./buzz-render-context";
export type { PosterSpacing } from "./poster-layout";
export {
  posterSpacing,
  isLandscapePoster,
  isTallPoster,
  heroTitleSize,
  heroLogoSize,
  secondaryLabelSize,
  bodyLabelSize,
} from "./poster-layout";

/* ─── Asset-driven layout schema (Phase 18) ─────────────────────────────── */
export type {
  PosterZoneId,
  PosterZoneRect,
  PosterZoneStackSpec,
  PosterZoneSpec,
  TemplateLayoutDefinition,
  TemplateLayoutSchema,
} from "./template-layout-schema";
export type { TemplateLayoutMode } from "./template-layout-schema";
export { backgroundImageKeyForRatio, isZoneRect, templateBackgroundImageKey } from "./template-layout-schema";
export { PosterAbsoluteZone } from "./poster-absolute-zone";
export type {
  TemplateFrameRect,
  TemplatePlaceholderFrames,
  TemplateFrameMetadataEntry,
} from "./template-frame-schema";
export {
  frameToZoneRect,
  resolveFramePixels,
} from "./template-frame-schema";
export {
  getTemplatePlaceholderFrames,
  getTemplateFrameMetadataEntry,
} from "./template-frame-registry";
export {
  FramePhoto,
  FrameLogo,
  FramePlayerName,
  FrameAmount,
  FrameRank,
  fitNameFontSize,
  fitAmountFontSize,
} from "./poster-content-frame";
export {
  TEMPLATE_LAYOUT_SCHEMAS,
  getTemplateLayout,
  getTemplateLayoutSchema,
} from "./template-layout-registry";
export {
  POSTER_TOKENS,
  PosterZoneStack,
  PosterImage,
  PosterMicroLabel,
  PosterTitle,
  PosterAmount,
  PosterRank,
  PosterMetaLine,
  TournamentHeader,
  StatBlock,
  TeamIdentityRow,
  BidwarFooter,
  posterSizes,
  posterTextAlign,
  posterFlexAlign,
} from "./poster-primitives";

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
