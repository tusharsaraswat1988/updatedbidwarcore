/**
 * BidWar Broadcast Director — OBS lower-third overlay system.
 */
export type {
  BroadcastSceneId,
  BroadcastSettings,
  BroadcastTheme,
  OutcomeSnapshot,
  BidTimelineEntry,
  SummaryStats,
} from "./types";
export { DEFAULT_BROADCAST_SETTINGS } from "./types";
export {
  resolveBroadcastSettings,
  saveBroadcastSettings,
  buildObsOverlayUrl,
  broadcastSettingsToSearchParams,
} from "./broadcast-settings";
export { useObsBrowserSource } from "./use-obs-browser-source";
export { useBroadcastDirector } from "./use-broadcast-director";
export {
  BroadcastDirector,
  broadcastDirector,
} from "./director/broadcast-director";
export type {
  BroadcastFrame,
  BroadcastOutputTarget,
  BroadcastSceneModel,
  DirectorContext,
} from "./director/types";
export { adaptFrameForOutput, registerOutputAdapter } from "./director/output-adapters";
export { BroadcastLayout } from "./broadcast-layout";
export { BroadcastControlPanel } from "./broadcast-control-panel";
export { broadcastDirectorDiagnostics } from "./director/diagnostics";
export type { BroadcastDirectorDiagnostics } from "./director/diagnostics";

/** @deprecated Use useBroadcastDirector */
export { useBroadcastDirector as useBroadcastStateManager } from "./use-broadcast-director";
/** @deprecated Use BroadcastDirector */
export { BroadcastDirector as BroadcastStateManager } from "./director/broadcast-director";
