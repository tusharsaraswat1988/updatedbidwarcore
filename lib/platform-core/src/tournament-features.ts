/**
 * Tournament feature flags — generic module enablement per tournament.
 *
 * Stored as JSON on the tournaments row (`features_json`).
 * Backward compatibility: missing or null JSON resolves to all flags false (or sensible defaults).
 */

import { isAuctionEnabled, isScoringEnabled, type TournamentModuleFlags } from "./tournament-modules";
import { validateBroadcastUrl, type BroadcastPlatform } from "./broadcast-url-validator";

export type { BroadcastPlatform };

export type BroadcastStatus = "live" | "upcoming" | "ended";

export interface BroadcastLinkConfig {
  url: string;
  platform?: BroadcastPlatform;
  enabled: boolean;
  status: BroadcastStatus;
  title?: string;
}

export interface TournamentBroadcastConfig {
  auction?: BroadcastLinkConfig | null;
  scoring?: BroadcastLinkConfig | null;
}

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
  /**
   * Tournament discovery visibility:
   * - "public": Discoverable on /fan, indexed by crawlers, accessible via direct link.
   * - "unlisted": Excluded from /fan discovery and search, accessible via direct link/QR.
   * - "private": Excluded from /fan, requires Organizer Auth or spectator PIN.
   * Defaults to "public" for backward compatibility with legacy tournaments.
   */
  visibility?: TournamentVisibility;
  /**
   * Fan Arena Discovery Opt-In (Phase 5).
   * When true, organizer requests this tournament to be curated and discovered on /fan.
   * Final eligibility requires server-side checks (public, licensed/approved, not admin-locked, etc.).
   */
  fanArenaOptIn?: boolean;
  /**
   * BidWar Admin Curation Approval for Fan Arena (Phase 5).
   * When true, explicitly approved by BidWar admin for discovery.
   * Reuses licenseStatus = 'active' as licensed status.
   */
  fanArenaApproved?: boolean;
  /**
   * Tournament-wide Broadcast Links configuration (Phase 5).
   */
  broadcast?: TournamentBroadcastConfig;
  /**
   * Match-specific broadcast links indexed by matchId (Phase 5).
   */
  matchBroadcasts?: Record<string, BroadcastLinkConfig>;
}

export type TournamentVisibility = "public" | "unlisted" | "private";

export function resolveTournamentVisibility(
  raw: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): TournamentVisibility {
  const v = raw?.visibility;
  if (v === "unlisted" || v === "private") {
    return v;
  }
  return "public";
}

/** Canonical defaults when a tournament has no features_json row yet. */
export const TOURNAMENT_FEATURE_DEFAULTS: Readonly<Required<Omit<TournamentFeatures, "broadcast" | "matchBroadcasts">>> = {
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
  visibility: "public",
  fanArenaOptIn: false,
  fanArenaApproved: false,
};

const FEATURE_BOOLEAN_KEYS: (keyof Omit<TournamentFeatures, "visibility" | "broadcast" | "matchBroadcasts">)[] = [
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
  "fanArenaOptIn",
  "fanArenaApproved",
];

function readFlag(
  src: Partial<TournamentFeatures> | Record<string, unknown>,
  key: keyof Omit<TournamentFeatures, "visibility" | "broadcast" | "matchBroadcasts">,
): boolean {
  if (
    key === "whatsappNotifications" ||
    key === "liveAuctionHistory" ||
    key === "ownerAppHistory" ||
    key === "obsHistory" ||
    key === "ledHistory"
  ) {
    return src[key] !== false;
  }
  return src[key] === true;
}

function sanitizeBroadcastConfig(raw: unknown): TournamentBroadcastConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const res: TournamentBroadcastConfig = {};

  const sanitizeLink = (linkRaw: unknown): BroadcastLinkConfig | null => {
    if (!linkRaw || typeof linkRaw !== "object") return null;
    const l = linkRaw as Record<string, unknown>;
    const url = typeof l.url === "string" ? l.url.trim() : "";
    if (!url) return null;

    const validated = validateBroadcastUrl(url);
    if (!validated.valid || !validated.normalizedUrl) return null;

    const status: BroadcastStatus =
      l.status === "upcoming" || l.status === "ended" ? l.status : "live";
    const enabled = l.enabled !== false;
    const title = typeof l.title === "string" && l.title.trim() ? l.title.trim() : undefined;

    return {
      url: validated.normalizedUrl,
      platform: validated.platform,
      enabled,
      status,
      title,
    };
  };

  if ("auction" in obj) {
    res.auction = sanitizeLink(obj.auction);
  }
  if ("scoring" in obj) {
    res.scoring = sanitizeLink(obj.scoring);
  }
  return res;
}

function sanitizeMatchBroadcasts(raw: unknown): Record<string, BroadcastLinkConfig> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const res: Record<string, BroadcastLinkConfig> = {};

  for (const [key, val] of Object.entries(obj)) {
    if (!val || typeof val !== "object") continue;
    const l = val as Record<string, unknown>;
    const url = typeof l.url === "string" ? l.url.trim() : "";
    if (!url) continue;

    const validated = validateBroadcastUrl(url);
    if (!validated.valid || !validated.normalizedUrl) continue;

    const status: BroadcastStatus =
      l.status === "upcoming" || l.status === "ended" ? l.status : "live";
    const enabled = l.enabled !== false;
    const title = typeof l.title === "string" && l.title.trim() ? l.title.trim() : undefined;

    res[key] = {
      url: validated.normalizedUrl,
      platform: validated.platform,
      enabled,
      status,
      title,
    };
  }

  return res;
}

/**
 * Normalize raw DB/API JSON into a stable TournamentFeatures object.
 * Unknown keys are ignored; missing keys default to false (or true for whatsappNotifications/history).
 */
export function resolveTournamentFeatures(
  raw: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): TournamentFeatures {
  const src = raw ?? {};
  const resolved = {} as Record<string, unknown>;
  for (const key of FEATURE_BOOLEAN_KEYS) {
    resolved[key] = readFlag(src, key);
  }
  resolved.visibility = resolveTournamentVisibility(src);

  if ("broadcast" in src) {
    resolved.broadcast = sanitizeBroadcastConfig(src.broadcast);
  }
  if ("matchBroadcasts" in src) {
    resolved.matchBroadcasts = sanitizeMatchBroadcasts(src.matchBroadcasts);
  }

  return resolved as TournamentFeatures;
}

/**
 * Merge a partial patch into existing features (shallow merge per key).
 */
export function mergeTournamentFeatures(
  existing: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
  patch: Partial<TournamentFeatures>,
): TournamentFeatures {
  const base = resolveTournamentFeatures(existing);
  const merged: Record<string, unknown> = { ...base };
  for (const key of FEATURE_BOOLEAN_KEYS) {
    if (patch[key] !== undefined) {
      merged[key] = patch[key];
    }
  }
  if (patch.visibility !== undefined) {
    merged.visibility = patch.visibility;
  }
  if (patch.broadcast !== undefined) {
    merged.broadcast = sanitizeBroadcastConfig(patch.broadcast);
  }
  if (patch.matchBroadcasts !== undefined) {
    merged.matchBroadcasts = sanitizeMatchBroadcasts(patch.matchBroadcasts);
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

/** Helper: Check if organizer has opted in to Fan Arena listing. */
export function isFanArenaOptedIn(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): boolean {
  const f = resolveTournamentFeatures(features);
  return f.fanArenaOptIn === true;
}

/** Helper: Check if tournament is explicitly approved by BidWar for Fan Arena. */
export function isFanArenaApproved(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): boolean {
  const f = resolveTournamentFeatures(features);
  return f.fanArenaApproved === true;
}

/** Helper: Extract active public broadcast links for display (only enabled, non-ended, valid URL ones). */
export function resolvePublicBroadcasts(
  features?: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): { auction?: BroadcastLinkConfig; scoring?: BroadcastLinkConfig } | undefined {
  const f = resolveTournamentFeatures(features);
  const b = f.broadcast;
  if (!b) return undefined;

  const isValidUrl = (url?: string) => Boolean(url && /^https?:\/\/.+/i.test(url.trim()));

  const auction =
    b.auction &&
    b.auction.enabled !== false &&
    b.auction.status !== "ended" &&
    isValidUrl(b.auction.url)
      ? b.auction
      : undefined;

  const scoring =
    b.scoring &&
    b.scoring.enabled !== false &&
    b.scoring.status !== "ended" &&
    isValidUrl(b.scoring.url)
      ? b.scoring
      : undefined;

  if (!auction && !scoring) return undefined;
  return { auction, scoring };
}

/**
 * Result of evaluating tournament eligibility for the curated Fan Arena (/fan).
 */
export interface FanArenaEligibilityResult {
  eligible: boolean;
  reasons: string[];
  details: {
    isPublic: boolean;
    isLicensedOrApproved: boolean;
    isOptedIn: boolean;
    isModuleEnabled: boolean;
    isNotAdminLocked: boolean;
    isNotTest: boolean;
    qualifiesLifecycle: boolean;
  };
}

/**
 * Canonical 7-point server-side evaluator for Fan Arena Curation Discovery (/fan).
 *
 * Rules:
 * 1. Tournament is public.
 * 2. Tournament is licensed (licenseStatus = 'active') or explicitly approved by BidWar (fanArenaApproved = true).
 * 3. Organizer has opted in to Fan Arena discovery (fanArenaOptIn = true).
 * 4. Auction or Scoring is enabled.
 * 5. Tournament is not admin-locked.
 * 6. Tournament is not a test, simulation, demo, or internal event.
 * 7. Tournament lifecycle qualifies for discovery (not archived or cancelled).
 */
export function evaluateFanArenaEligibility(
  tournament: {
    name: string;
    auctionCode?: string | null;
    licenseStatus?: string | null;
    adminLocked?: boolean;
    status?: string;
    auctionEnabled?: boolean;
    scoringEnabled?: boolean;
    featuresJson?: unknown;
  },
): FanArenaEligibilityResult {
  const features = resolveTournamentFeatures(tournament.featuresJson as any);
  const visibility = resolveTournamentVisibility(tournament.featuresJson as any);

  const isPublic = visibility === "public";
  const isLicensedOrApproved =
    tournament.licenseStatus === "active" || features.fanArenaApproved === true;
  const isOptedIn = features.fanArenaOptIn === true;
  const isModuleEnabled = isAuctionEnabled(tournament) || isScoringEnabled(tournament);
  const isNotAdminLocked = tournament.adminLocked !== true;

  const lowerName = (tournament.name || "").toLowerCase();
  const lowerCode = (tournament.auctionCode || "").toLowerCase();
  const isNotTest = !(
    lowerName.includes("[test]") ||
    lowerName.includes("demo tournament") ||
    lowerName.includes("internal test") ||
    lowerName.startsWith("sim_") ||
    lowerName.includes("testing") ||
    lowerCode.startsWith("test") ||
    lowerCode.startsWith("demo")
  );

  const status = tournament.status || "setup";
  const qualifiesLifecycle = status !== "archived" && status !== "cancelled";

  const reasons: string[] = [];
  if (!isPublic) {
    reasons.push("Tournament visibility is not public (unlisted or private).");
  }
  if (!isLicensedOrApproved) {
    reasons.push("Tournament requires a BidWar live license or curation approval.");
  }
  if (!isOptedIn) {
    reasons.push("Organizer has not opted in to Fan Arena listing.");
  }
  if (!isModuleEnabled) {
    reasons.push("Neither Auction nor Scoring module is enabled.");
  }
  if (!isNotAdminLocked) {
    reasons.push("Tournament is locked by administrator.");
  }
  if (!isNotTest) {
    reasons.push("Tournament is marked as a test, demo, or simulation event.");
  }
  if (!qualifiesLifecycle) {
    reasons.push(`Tournament lifecycle status '${status}' does not qualify.`);
  }

  const eligible = reasons.length === 0;

  return {
    eligible,
    reasons,
    details: {
      isPublic,
      isLicensedOrApproved,
      isOptedIn,
      isModuleEnabled,
      isNotAdminLocked,
      isNotTest,
      qualifiesLifecycle,
    },
  };
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
  fanArenaOptIn: "boolean",
  fanArenaApproved: "boolean",
} as const;
