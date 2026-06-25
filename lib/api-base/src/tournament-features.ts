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
  /** BidWar Media Center — tournament creative generation (Buzz Studio). */
  buzzStudio?: boolean;
  /** Allow organizers to download generated creatives. */
  allowCreativeDownloads?: boolean;
  /** Allow player-facing share links to expose a download button. */
  allowPlayerDownloads?: boolean;
  /** When true, rendered creatives must include a watermark. */
  watermarkRequired?: boolean;
  /** Future: Owner App access for this tournament. */
  ownerApp?: boolean;
  /** Future: per-tournament scoring module flag (distinct from platform SCORING env). */
  scoring?: boolean;
  /** Future: sponsorship hub. */
  sponsorshipHub?: boolean;
  /** Future: analytics module. */
  analytics?: boolean;
}

/** Canonical defaults when a tournament has no features_json row yet. */
export const TOURNAMENT_FEATURE_DEFAULTS: Readonly<Required<TournamentFeatures>> = {
  buzzStudio: false,
  allowCreativeDownloads: false,
  allowPlayerDownloads: false,
  watermarkRequired: false,
  ownerApp: false,
  scoring: false,
  sponsorshipHub: false,
  analytics: false,
};

const FEATURE_KEYS = Object.keys(TOURNAMENT_FEATURE_DEFAULTS) as (keyof TournamentFeatures)[];

function readFlag(
  src: Partial<TournamentFeatures> | Record<string, unknown>,
  key: keyof TournamentFeatures,
): boolean {
  if (key === "watermarkRequired") {
    return src[key] === true;
  }
  return src[key] === true;
}

/**
 * Normalize raw DB/API JSON into a stable TournamentFeatures object.
 * Unknown keys are ignored; missing keys default to false.
 */
export function resolveTournamentFeatures(
  raw: Partial<TournamentFeatures> | Record<string, unknown> | null | undefined,
): TournamentFeatures {
  const src = raw ?? {};
  const resolved = {} as Required<TournamentFeatures>;
  for (const key of FEATURE_KEYS) {
    resolved[key] = readFlag(src, key);
  }
  return resolved;
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
  for (const key of FEATURE_KEYS) {
    if (patch[key] !== undefined) {
      merged[key] = patch[key];
    }
  }
  return resolveTournamentFeatures(merged);
}

/** True when Buzz Studio / Media Center is enabled for a tournament. */
export function isBuzzStudioEnabled(
  features: Partial<TournamentFeatures> | null | undefined,
): boolean {
  return features?.buzzStudio === true;
}

/** Zod-compatible partial schema keys for API validation. */
export const tournamentFeaturesSchemaShape = {
  buzzStudio: "boolean",
  allowCreativeDownloads: "boolean",
  allowPlayerDownloads: "boolean",
  watermarkRequired: "boolean",
  ownerApp: "boolean",
  scoring: "boolean",
  sponsorshipHub: "boolean",
  analytics: "boolean",
} as const;
