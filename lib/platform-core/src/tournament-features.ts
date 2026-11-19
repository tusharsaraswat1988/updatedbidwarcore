/**
 * Tournament feature flags — generic module enablement per tournament.
 *
 * Stored as JSON on the tournaments row (`features_json`).
 * Only `buzzStudio` is wired today; other keys are reserved for future modules.
 *
 * Backward compatibility: missing or null JSON resolves to all flags false.
 */

/** Per-tournament feature toggles. All keys optional in storage; resolved to booleans at read time. */
export interface TournamentFeatures {
  /** Future: Owner App access for this tournament. */
  ownerApp?: boolean;
  /** Future: per-tournament scoring module flag (distinct from platform SCORING env). */
  scoring?: boolean;
  /** Future: sponsorship hub. */
  sponsorshipHub?: boolean;
  /** Future: analytics module. */
  analytics?: boolean;
  /**
   * WhatsApp push messaging & notification service for this tournament.
   * If explicitly false, all outbound automated player-sold alerts,
   * blast dispatches, and WhatsApp push templates are suppressed.
   */
  whatsappNotifications?: boolean;
  /**
   * Royal Wedding Edition OBS Broadcast Stage (V3).
   * When true, unlocks the luxury Indian wedding broadcast overlay link
   * with custom Bride's XI vs Groom's XI presentation.
   */
  weddingBroadcast?: boolean;
  /**
   * Master toggle for Live Player Auction History across live surfaces.
   * Defaults to true (pre-enabled).
   */
  liveAuctionHistory?: boolean;
  /**
   * Display player auction history in Team Owner Bidding Panel (owner-app).
   * Defaults to true (pre-enabled).
   */
  ownerAppHistory?: boolean;
  /**
   * Display player auction history on OBS V2 Broadcast Overlay.
   * Defaults to true (pre-enabled).
   */
  obsHistory?: boolean;
  /**
   * Display player auction history on Live LED Stage Screen.
   * Defaults to true (pre-enabled).
   */
  ledHistory?: boolean;
  /** Admin-promoted hero on the public fan homepage. */
  featuredEnabled?: boolean;
  featuredStartDate?: string | null;
  featuredEndDate?: string | null;
  featuredPriority?: number;
  /** Organizer live stream URL and visibility toggle. */
  liveStreamEnabled?: boolean;
  liveStreamUrl?: string | null;
}

/** Canonical defaults when a tournament has no features_json row yet. */
export const TOURNAMENT_FEATURE_DEFAULTS: Readonly<Required<TournamentFeatures>> = {
  ownerApp: false,
  scoring: false,
  sponsorshipHub: false,
  analytics: false,
  whatsappNotifications: true,
  weddingBroadcast: false,
  liveAuctionHistory: true,
  ownerAppHistory: true,
  obsHistory: true,
  ledHistory: true,
  featuredEnabled: false,
  featuredStartDate: null,
  featuredEndDate: null,
  featuredPriority: 0,
  liveStreamEnabled: false,
  liveStreamUrl: null,
};

const BOOLEAN_FEATURE_KEYS = [
  "ownerApp",
  "scoring",
  "sponsorshipHub",
  "analytics",
  "whatsappNotifications",
  "weddingBroadcast",
  "liveAuctionHistory",
  "ownerAppHistory",
  "obsHistory",
  "ledHistory",
] as const;

function readHero(src: Record<string, unknown>) {
  const priority = src.featuredPriority;
  return {
    featuredEnabled: src.featuredEnabled === true,
    featuredStartDate: typeof src.featuredStartDate === "string" && src.featuredStartDate ? src.featuredStartDate : null,
    featuredEndDate: typeof src.featuredEndDate === "string" && src.featuredEndDate ? src.featuredEndDate : null,
    featuredPriority: typeof priority === "number" && Number.isFinite(priority) ? priority : 0,
  };
}

function readFlag(
  src: Partial<TournamentFeatures> | Record<string, unknown>,
  key: (typeof BOOLEAN_FEATURE_KEYS)[number],
): boolean {
  const s = src as Record<string, unknown>;
  if (
    key === "whatsappNotifications" ||
    key === "liveAuctionHistory" ||
    key === "ownerAppHistory" ||
    key === "obsHistory" ||
    key === "ledHistory"
  ) {
    return s[key] !== false;
  }
  return s[key] === true;
}

/**
 * Normalize raw DB/API JSON into a stable TournamentFeatures object.
 * Unknown keys are ignored; missing keys default to false (or true for whatsappNotifications).
 * Homepage hero fields are kept so an admin save is not stripped on the next read.
 */
export function resolveTournamentFeatures(
  raw: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): TournamentFeatures {
  const src = (raw ?? {}) as Record<string, unknown>;
  const resolved: Record<string, boolean> = {};
  for (const key of BOOLEAN_FEATURE_KEYS) {
    resolved[key] = readFlag(src, key);
  }
  return {
    ...TOURNAMENT_FEATURE_DEFAULTS,
    ...resolved,
    ...readHero(src),
    liveStreamEnabled: src.liveStreamEnabled === true,
    liveStreamUrl: typeof src.liveStreamUrl === "string" && src.liveStreamUrl.trim() ? src.liveStreamUrl.trim() : null,
  };
}

/**
 * Merge a partial patch into existing features (shallow merge per key).
 */
export function mergeTournamentFeatures(
  existing: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
  patch: Partial<TournamentFeatures>,
): TournamentFeatures {
  const base = resolveTournamentFeatures(existing);
  const merged: Record<string, unknown> = { ...base, ...patch };
  for (const key of BOOLEAN_FEATURE_KEYS) {
    if (patch[key] !== undefined) {
      merged[key] = patch[key];
    }
  }
  return resolveTournamentFeatures(merged);
}

/** Deprecated: Buzz Studio is permanently removed. Always returns false. */
export function isBuzzStudioEnabled(
  _features?: Partial<TournamentFeatures> | null | undefined,
): boolean {
  return false;
}

/**
 * Helper to check if WhatsApp notifications are enabled for tournament features.
 * Defaults to true unless explicitly false.
 */
export function isWhatsAppNotificationsEnabled(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): boolean {
  if (!features) return true;
  return resolveTournamentFeatures(features).whatsappNotifications !== false;
}

/**
 * Helper to check if Royal Wedding Broadcast (V3) is enabled for tournament features.
 * Defaults to false unless explicitly enabled by Admin.
 */
export function isWeddingBroadcastEnabled(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): boolean {
  if (!features) return false;
  return resolveTournamentFeatures(features).weddingBroadcast === true;
}

/** Master toggle check: Live Player Auction History across all live surfaces. */
export function isLiveAuctionHistoryEnabled(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): boolean {
  const f = resolveTournamentFeatures(features);
  return f.liveAuctionHistory !== false;
}

/** Surface check: Owner App live player auction history. */
export function isOwnerAppHistoryEnabled(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): boolean {
  const f = resolveTournamentFeatures(features);
  return f.liveAuctionHistory !== false && f.ownerAppHistory !== false;
}

/** Surface check: OBS V2 live player auction history. */
export function isObsHistoryEnabled(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): boolean {
  const f = resolveTournamentFeatures(features);
  return f.liveAuctionHistory !== false && f.obsHistory !== false;
}

/** Surface check: Live LED Screen live player auction history. */
export function isLedHistoryEnabled(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): boolean {
  const f = resolveTournamentFeatures(features);
  return f.liveAuctionHistory !== false && f.ledHistory !== false;
}

/** Zod-compatible partial schema keys for API validation. */
export const tournamentFeaturesSchemaShape = {
  ownerApp: "boolean",
  scoring: "boolean",
  sponsorshipHub: "boolean",
  analytics: "boolean",
  whatsappNotifications: "boolean",
  weddingBroadcast: "boolean",
  liveAuctionHistory: "boolean",
  ownerAppHistory: "boolean",
  obsHistory: "boolean",
  ledHistory: "boolean",
} as const;
