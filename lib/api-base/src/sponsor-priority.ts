/**
 * Sponsor priority — single source of truth for sponsor hierarchy across
 * Auction, Scoring, Streaming, Website, Reports, Mobile, OBS, LED, etc.
 *
 * Tournament sponsors are stored as JSON arrays on `tournaments.sponsor_logos`.
 * Master sponsors (`master_sponsors`) use the same priority fields at row level.
 *
 * Future organiser-controlled visibility (showOnAuctionScreen, etc.) should
 * filter *after* priority ordering via `applySponsorVisibility()` (stub below).
 */

/** Ordered sponsor tiers — extend here when new categories ship. */
export enum SponsorPriorityType {
  TITLE = "TITLE",
  CO_SPONSOR = "CO_SPONSOR",
  PLATINUM = "PLATINUM",
  GOLD = "GOLD",
  SILVER = "SILVER",
  BRONZE = "BRONZE",
  NORMAL = "NORMAL",
}

/** Lower number = higher display priority within the global sort order. */
export const SPONSOR_TIER_SORT_ORDER: Record<SponsorPriorityType, number> = {
  [SponsorPriorityType.TITLE]: 0,
  [SponsorPriorityType.CO_SPONSOR]: 1,
  [SponsorPriorityType.PLATINUM]: 2,
  [SponsorPriorityType.GOLD]: 3,
  [SponsorPriorityType.SILVER]: 4,
  [SponsorPriorityType.BRONZE]: 5,
  [SponsorPriorityType.NORMAL]: 6,
};

/** Numeric weight used when comparing sponsors (higher = more prominent). */
export const SPONSOR_TIER_WEIGHT: Record<SponsorPriorityType, number> = {
  [SponsorPriorityType.TITLE]: 700,
  [SponsorPriorityType.CO_SPONSOR]: 600,
  [SponsorPriorityType.PLATINUM]: 500,
  [SponsorPriorityType.GOLD]: 400,
  [SponsorPriorityType.SILVER]: 300,
  [SponsorPriorityType.BRONZE]: 200,
  [SponsorPriorityType.NORMAL]: 0,
};

export const SPONSOR_VALIDATION_ERRORS = {
  titleLimit: "Only one Title Sponsor is allowed.",
  coSponsorLimit: "Maximum 3 Co Sponsors are allowed.",
  mutualExclusivity: "A sponsor cannot be both Title Sponsor and Co Sponsor.",
} as const;

/** Tournament / display sponsor entry (JSON in sponsor_logos). */
export interface SponsorLogo {
  url: string;
  name?: string;
  /** Legacy free-text label (e.g. "Title Sponsor") — used for display fallback. */
  type?: string;
  isTitleSponsor?: boolean;
  isCoSponsor?: boolean;
  /** Tie-breaker within the same tier (higher first). */
  sponsorPriority?: number;
  /** Future tier — when set, takes precedence over legacy `type` string. */
  priorityType?: SponsorPriorityType | string;
  /** Cloudinary public_id — stored on upload for safe cleanup on replace/remove. */
  publicId?: string;
}

/** Master sponsor row shape (subset used by validation). */
export interface MasterSponsorPriorityFields {
  isTitleSponsor?: boolean;
  isCoSponsor?: boolean;
  sponsorPriority?: number;
  priorityType?: SponsorPriorityType | string | null;
}

/**
 * Future visibility engine — not implemented; architecture hook only.
 * Filter sponsors per surface after priority ordering.
 */
export interface SponsorVisibilitySettings {
  showOnAuctionScreen?: boolean;
  showOnScoreboard?: boolean;
  showOnWebsite?: boolean;
  showOnOverlay?: boolean;
  showOnLED?: boolean;
  showOnReports?: boolean;
}

const LEGACY_TYPE_PATTERNS: Array<{ pattern: RegExp; tier: SponsorPriorityType }> = [
  { pattern: /title\s*sponsor/i, tier: SponsorPriorityType.TITLE },
  { pattern: /co[\s-]*sponsor/i, tier: SponsorPriorityType.CO_SPONSOR },
  { pattern: /platinum/i, tier: SponsorPriorityType.PLATINUM },
  { pattern: /\bgold\b/i, tier: SponsorPriorityType.GOLD },
  { pattern: /silver/i, tier: SponsorPriorityType.SILVER },
  { pattern: /bronze/i, tier: SponsorPriorityType.BRONZE },
];

function isKnownPriorityType(value: string): value is SponsorPriorityType {
  return Object.values(SponsorPriorityType).includes(value as SponsorPriorityType);
}

function legacyTierFromType(type: string | undefined): SponsorPriorityType | null {
  if (!type?.trim()) return null;
  for (const { pattern, tier } of LEGACY_TYPE_PATTERNS) {
    if (pattern.test(type)) return tier;
  }
  return null;
}

/** Resolve the canonical tier for a sponsor entry. */
export function resolveSponsorPriorityType(
  sponsor: SponsorLogo | MasterSponsorPriorityFields,
): SponsorPriorityType {
  if (sponsor.isTitleSponsor === true) return SponsorPriorityType.TITLE;
  if (sponsor.isCoSponsor === true) return SponsorPriorityType.CO_SPONSOR;

  const explicit = sponsor.priorityType;
  if (typeof explicit === "string" && isKnownPriorityType(explicit)) {
    return explicit;
  }

  const legacyType =
    "type" in sponsor ? legacyTierFromType(sponsor.type) : null;
  if (legacyType) return legacyType;

  return SponsorPriorityType.NORMAL;
}

/** Computed numeric priority for sorting (tier weight + user tie-breaker). */
export function computeSponsorPriorityScore(
  sponsor: SponsorLogo | MasterSponsorPriorityFields,
): number {
  const tier = resolveSponsorPriorityType(sponsor);
  const tierWeight = SPONSOR_TIER_WEIGHT[tier];
  const tieBreaker =
    typeof sponsor.sponsorPriority === "number" && Number.isFinite(sponsor.sponsorPriority)
      ? sponsor.sponsorPriority
      : 0;
  return tierWeight + tieBreaker;
}

/** Normalize raw JSON entry with defaults. */
export function normalizeSponsorEntry(entry: unknown): SponsorLogo | null {
  if (!entry || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  const url = typeof e.url === "string" ? e.url.trim() : "";
  if (!url) return null;

  const isTitleSponsor = e.isTitleSponsor === true;
  const isCoSponsor = e.isCoSponsor === true;
  const sponsorPriority =
    typeof e.sponsorPriority === "number" && Number.isFinite(e.sponsorPriority)
      ? e.sponsorPriority
      : 0;

  const priorityType =
    typeof e.priorityType === "string" && isKnownPriorityType(e.priorityType)
      ? e.priorityType
      : undefined;

  return {
    url,
    name: typeof e.name === "string" ? e.name : "",
    type: typeof e.type === "string" ? e.type : "",
    isTitleSponsor,
    isCoSponsor,
    sponsorPriority,
    priorityType,
  };
}

export function normalizeSponsorLogos(raw: unknown): SponsorLogo[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeSponsorEntry)
    .filter((s): s is SponsorLogo => s !== null);
}

export function parseSponsorLogos(json: string | null | undefined): SponsorLogo[] {
  if (!json) return [];
  try {
    return normalizeSponsorLogos(JSON.parse(json));
  } catch {
    return [];
  }
}

export type PrioritizedSponsor = SponsorLogo & {
  priorityType: SponsorPriorityType;
  priorityScore: number;
};

function comparePrioritizedSponsors(a: PrioritizedSponsor, b: PrioritizedSponsor): number {
  const tierDiff =
    SPONSOR_TIER_SORT_ORDER[a.priorityType] - SPONSOR_TIER_SORT_ORDER[b.priorityType];
  if (tierDiff !== 0) return tierDiff;

  const scoreDiff = b.priorityScore - a.priorityScore;
  if (scoreDiff !== 0) return scoreDiff;

  const nameA = a.name?.trim() ?? "";
  const nameB = b.name?.trim() ?? "";
  return nameA.localeCompare(nameB);
}

/**
 * Return sponsors sorted by priority hierarchy:
 * Title → Co Sponsors → Platinum → Gold → Silver → Bronze → Normal
 */
export function getSponsorsByPriority(
  sponsors: readonly SponsorLogo[],
): PrioritizedSponsor[] {
  return sponsors
    .map((sponsor) => {
      const priorityType = resolveSponsorPriorityType(sponsor);
      return {
        ...sponsor,
        priorityType,
        priorityScore: computeSponsorPriorityScore(sponsor),
      };
    })
    .toSorted(comparePrioritizedSponsors);
}

/** Primary (highest-priority) sponsor for single-logo slots. */
export function getPrimarySponsor(
  sponsors: readonly SponsorLogo[],
): PrioritizedSponsor | null {
  const ordered = getSponsorsByPriority(sponsors);
  return ordered[0] ?? null;
}

export type SponsorValidationResult =
  | { ok: true }
  | { ok: false; error: string };

/** Validate sponsor list for create / update / bulk update. */
export function validateSponsorList(
  sponsors: readonly SponsorLogo[],
): SponsorValidationResult {
  let titleCount = 0;
  let coCount = 0;

  for (const sponsor of sponsors) {
    const isTitle = sponsor.isTitleSponsor === true;
    const isCo = sponsor.isCoSponsor === true;

    if (isTitle && isCo) {
      return { ok: false, error: SPONSOR_VALIDATION_ERRORS.mutualExclusivity };
    }
    if (isTitle) titleCount += 1;
    if (isCo) coCount += 1;
  }

  if (titleCount > 1) {
    return { ok: false, error: SPONSOR_VALIDATION_ERRORS.titleLimit };
  }
  if (coCount > 3) {
    return { ok: false, error: SPONSOR_VALIDATION_ERRORS.coSponsorLimit };
  }

  return { ok: true };
}

/** Validate and normalize sponsor JSON string for API persistence. */
export function validateAndSerializeSponsorLogos(
  json: string | null | undefined,
): SponsorValidationResult & { serialized?: string | null } {
  if (json == null || json === "") {
    return { ok: true, serialized: null };
  }

  const sponsors = parseSponsorLogos(json);
  const validation = validateSponsorList(sponsors);
  if (!validation.ok) return validation;

  return { ok: true, serialized: JSON.stringify(sponsors) };
}

/** Validate master sponsor row fields (global master_sponsors table). */
export function validateMasterSponsorPriority(
  input: MasterSponsorPriorityFields,
  existingSponsors: readonly MasterSponsorPriorityFields[],
  excludeId?: string,
): SponsorValidationResult {
  const merged = [
    ...existingSponsors.filter((s) => {
      if (!excludeId) return true;
      return (s as { id?: string }).id !== excludeId;
    }),
    input,
  ];

  const asLogos: SponsorLogo[] = merged.map((s) => ({
    url: "placeholder",
    isTitleSponsor: s.isTitleSponsor === true,
    isCoSponsor: s.isCoSponsor === true,
    sponsorPriority: s.sponsorPriority ?? 0,
    priorityType: s.priorityType ?? undefined,
  }));

  return validateSponsorList(asLogos);
}

/** Ticker label — names only; sponsors without a name are omitted. */
export function formatSponsorTickerSegment(logo: SponsorLogo): string | null {
  const name = logo.name?.trim();
  return name || null;
}

export function buildSponsorTickerText(logos: readonly SponsorLogo[]): string {
  const ordered = getSponsorsByPriority(logos);
  const names = ordered.map(formatSponsorTickerSegment).filter((n): n is string => !!n);
  if (!names.length) return "";
  return names.join(" • ") + " • ";
}

/**
 * Central branding service — extend with visibility filtering when the
 * organiser-controlled visibility engine ships.
 */
export const brandingService = {
  getSponsorsByPriority,
  getPrimarySponsor,
  validateSponsorList,
  parseSponsorLogos,
  normalizeSponsorLogos,
  resolveSponsorPriorityType,
  computeSponsorPriorityScore,
} as const;
