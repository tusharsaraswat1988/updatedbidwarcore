/**
 * Sponsor / promo media rules for cricket broadcast.
 * Pure functions only: no scoring state, no I/O.
 * Play cues carry a slot id and version. They never carry media bytes or URLs.
 */

export const SPONSOR_MEDIA_SLOT_COUNT = 4;
export const SPONSOR_IMAGE_DURATION_DEFAULT_SEC = 10;
export const SPONSOR_IMAGE_DURATION_MIN_SEC = 3;
export const SPONSOR_IMAGE_DURATION_MAX_SEC = 60;
export const SPONSOR_ORIGINAL_UPLOAD_MAX_BYTES = 500 * 1024 * 1024;
/** Hard ceiling for the prepared broadcast file. Normal spots should land well under 30 MB. */
export const SPONSOR_BROADCAST_ASSET_MAX_BYTES = 50 * 1024 * 1024;
/** A derived Cloudinary response under this size is a stub, not a playable spot. */
export const SPONSOR_BROADCAST_VIDEO_MIN_BYTES = 16 * 1024;
export const SPONSOR_DOUBLE_PLAY_WINDOW_MS = 500;

export type SponsorMediaAssetType = "image" | "video";
export type SponsorMediaDestination = "obs" | "led" | "both";
export type SponsorMediaSurface = "obs" | "led";
export type SponsorMediaProcessingStatus =
  | "empty"
  | "uploading"
  | "processing"
  | "ready"
  | "failed"
  | "disabled";
export type SponsorMediaCueAction = "play" | "stop" | "prepare";
export type SponsorPlaybackPhase = "idle" | "playing";

export type SponsorMediaCue = {
  action: SponsorMediaCueAction;
  slotId: number;
  slotNumber: number;
  version: number;
  destination: SponsorMediaDestination;
  cueId: string;
  issuedAt: number;
};

export type SponsorPlaybackState = {
  phase: SponsorPlaybackPhase;
  cueId: string | null;
  slotId: number | null;
  slotNumber: number | null;
  version: number | null;
  issuedAt: number;
};

export type SponsorReadinessSlot = {
  slotNumber: number;
  version: number;
  ready: boolean;
};

const EMPTY_PLAYBACK: SponsorPlaybackState = {
  phase: "idle",
  cueId: null,
  slotId: null,
  slotNumber: null,
  version: null,
  issuedAt: 0,
};

export function emptySponsorPlayback(): SponsorPlaybackState {
  return { ...EMPTY_PLAYBACK };
}

export function clampImageDurationSec(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(parsed)) return null;
  const rounded = Math.round(parsed);
  if (rounded < SPONSOR_IMAGE_DURATION_MIN_SEC || rounded > SPONSOR_IMAGE_DURATION_MAX_SEC) {
    return null;
  }
  return rounded;
}

export function cueIncludesSurface(
  destination: SponsorMediaDestination,
  surface: SponsorMediaSurface,
): boolean {
  return destination === "both" || destination === surface;
}

export function parseSponsorMediaCue(
  input: unknown,
  issuedAt = Date.now(),
): { ok: true; cue: SponsorMediaCue } | { ok: false; error: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "Sponsor media cue is missing" };
  }
  const body = input as Record<string, unknown>;
  if (body.broadcastUrl != null || body.url != null || body.originalUrl != null || body.data != null) {
    return { ok: false, error: "Sponsor media cue must not carry media" };
  }
  const action = body.action;
  if (action !== "play" && action !== "stop" && action !== "prepare") {
    return { ok: false, error: "Unsupported sponsor media action" };
  }
  const destination = body.destination;
  if (destination !== "obs" && destination !== "led" && destination !== "both") {
    return { ok: false, error: "Destination must be OBS, LED, or both" };
  }
  const slotNumber = Number(body.slotNumber);
  const slotId = Number(body.slotId ?? 0);
  const version = Number(body.version ?? 0);
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > SPONSOR_MEDIA_SLOT_COUNT) {
    return { ok: false, error: "Slot must be between 1 and 4" };
  }
  if (!Number.isInteger(slotId) || slotId < 0) {
    return { ok: false, error: "Invalid sponsor media slot" };
  }
  if (!Number.isInteger(version) || version < 0) {
    return { ok: false, error: "Invalid sponsor media version" };
  }
  if (action === "play" && (slotId <= 0 || version <= 0)) {
    return { ok: false, error: "Play requires a prepared sponsor asset" };
  }
  const cueId = typeof body.cueId === "string" && body.cueId.trim().length >= 8
    ? body.cueId.trim().slice(0, 80)
    : `cue-${issuedAt}-${slotNumber}`;
  const cueIssuedAt = typeof body.issuedAt === "number" && Number.isFinite(body.issuedAt)
    ? body.issuedAt
    : issuedAt;
  return {
    ok: true,
    cue: {
      action,
      slotId,
      slotNumber,
      version,
      destination,
      cueId,
      issuedAt: cueIssuedAt,
    },
  };
}

export function cueIsLightweight(cue: SponsorMediaCue): boolean {
  const raw = cue as SponsorMediaCue & { broadcastUrl?: unknown; url?: unknown; data?: unknown };
  return raw.broadcastUrl == null && raw.url == null && raw.data == null;
}

export function canPlaySponsorSlot(input: {
  destination: SponsorMediaDestination;
  processingStatus: SponsorMediaProcessingStatus | string;
  active: boolean;
  obsReady: boolean;
  ledReady: boolean;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.active || input.processingStatus === "disabled") {
    return { ok: false, reason: "This slot is turned off" };
  }
  if (input.processingStatus === "failed") {
    return { ok: false, reason: "This asset failed to prepare" };
  }
  if (input.processingStatus !== "ready") {
    return { ok: false, reason: "This asset is not ready" };
  }
  if (input.destination === "obs" && !input.obsReady) {
    return { ok: false, reason: "OBS is not ready" };
  }
  if (input.destination === "led" && !input.ledReady) {
    return { ok: false, reason: "LED scoreboard is not ready" };
  }
  if (input.destination === "both" && (!input.obsReady || !input.ledReady)) {
    if (!input.obsReady && !input.ledReady) {
      return { ok: false, reason: "OBS and LED are not ready" };
    }
    if (!input.obsReady) return { ok: false, reason: "OBS is not ready" };
    return { ok: false, reason: "LED scoreboard is not ready" };
  }
  return { ok: true };
}

export function verifyLocalAsset(input: {
  expectedVersion: number;
  expectedChecksum: string;
  expectedSize: number;
  actualVersion: number;
  actualChecksum: string;
  actualSize: number;
}): { ok: true } | { ok: false; reason: string } {
  if (input.actualVersion !== input.expectedVersion) {
    return { ok: false, reason: "Stale asset version" };
  }
  if (input.expectedSize > 0 && input.actualSize !== input.expectedSize) {
    return { ok: false, reason: "Corrupt asset" };
  }
  if (input.expectedChecksum && input.actualChecksum !== input.expectedChecksum) {
    return { ok: false, reason: "Checksum mismatch" };
  }
  if (input.actualSize <= 0) {
    return { ok: false, reason: "Missing asset" };
  }
  return { ok: true };
}

export function reduceSponsorPlayback(
  state: SponsorPlaybackState,
  cue: SponsorMediaCue,
  surface: SponsorMediaSurface,
): SponsorPlaybackState {
  if (!cueIncludesSurface(cue.destination, surface)) return state;
  if (cue.action === "prepare") return state;
  if (cue.issuedAt < state.issuedAt) return state;
  if (cue.issuedAt === state.issuedAt && cue.cueId === state.cueId) return state;

  if (cue.action === "stop") {
    return {
      phase: "idle",
      cueId: cue.cueId,
      slotId: null,
      slotNumber: null,
      version: null,
      issuedAt: cue.issuedAt,
    };
  }

  if (
    state.phase === "playing"
    && state.slotId === cue.slotId
    && state.version === cue.version
    && cue.issuedAt - state.issuedAt < SPONSOR_DOUBLE_PLAY_WINDOW_MS
  ) {
    return state;
  }

  return {
    phase: "playing",
    cueId: cue.cueId,
    slotId: cue.slotId,
    slotNumber: cue.slotNumber,
    version: cue.version,
    issuedAt: cue.issuedAt,
  };
}

export function localAssetMatchesCue(
  local: { slotId: number; version: number; verified: boolean } | null,
  cue: SponsorMediaCue,
): boolean {
  if (cue.action !== "play") return false;
  if (!local?.verified) return false;
  return local.slotId === cue.slotId && local.version === cue.version;
}

export function encodeCloudinaryPublicId(publicId: string): string {
  return publicId.split("/").map((part) => encodeURIComponent(part)).join("/");
}

export function buildCloudinaryBroadcastVideoUrl(cloudName: string, publicId: string): string {
  const id = encodeCloudinaryPublicId(publicId);
  return `https://res.cloudinary.com/${cloudName}/video/upload/c_limit,w_1920,h_1080,fps_30,vc_h264,ac_aac,br_5000k/${id}.mp4`;
}

export function buildCloudinaryPosterUrl(cloudName: string, publicId: string): string {
  const id = encodeCloudinaryPublicId(publicId);
  return `https://res.cloudinary.com/${cloudName}/video/upload/so_0,c_limit,w_1280,h_720,f_jpg,q_auto/${id}.jpg`;
}

export function explainSurfaceReadiness(input: {
  processingStatus: string;
  active: boolean;
  version: number;
  surfaceOnline: boolean;
  report: { version: number; status: string; error?: string } | null;
}): string {
  if (!input.active || input.processingStatus === "disabled") return "Off";
  if (input.processingStatus === "failed") return "Processing failed";
  if (input.processingStatus === "uploading" || input.processingStatus === "processing") return "Processing";
  if (input.processingStatus !== "ready") return "Empty";
  if (!input.surfaceOnline) return "Offline";
  if (!input.report) return "Missing asset";
  if (input.report.version !== input.version) return "Old version";
  if (input.report.status === "preparing") return "Preparing";
  if (input.report.status === "failed") return input.report.error || "Missing asset";
  if (input.report.status === "missing") return "Missing asset";
  if (input.report.status === "ready") return "Ready";
  return "Missing asset";
}

function boxPresent(bytes: Uint8Array, name: string): boolean {
  const a = name.charCodeAt(0);
  const b = name.charCodeAt(1);
  const c = name.charCodeAt(2);
  const d = name.charCodeAt(3);
  for (let i = 4; i + 4 <= bytes.length; i += 1) {
    if (bytes[i] === a && bytes[i + 1] === b && bytes[i + 2] === c && bytes[i + 3] === d) return true;
  }
  return false;
}

/**
 * True only for a finished MP4. Cloudinary can answer a transform URL with a few
 * kilobytes while a 4K source is still encoding; that body must not be marked ready.
 */
export function isPlayableBroadcastMp4(bytes: Uint8Array): boolean {
  if (bytes.length < SPONSOR_BROADCAST_VIDEO_MIN_BYTES) return false;
  if (bytes[4] !== 0x66 || bytes[5] !== 0x74 || bytes[6] !== 0x79 || bytes[7] !== 0x70) return false;
  const windowBytes = 2 * 1024 * 1024;
  const head = bytes.subarray(0, Math.min(bytes.length, windowBytes));
  const tail = bytes.subarray(Math.max(0, bytes.length - windowBytes));
  return boxPresent(head, "moov") || boxPresent(head, "mdat") || boxPresent(tail, "moov") || boxPresent(tail, "mdat");
}

export function sponsorCacheKey(tournamentId: number, slotNumber: number, version: number): string {
  return `https://bidwar.local/sponsor-cache/${tournamentId}/slot-${slotNumber}/v${version}`;
}
