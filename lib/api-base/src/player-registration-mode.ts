import {
  resolvePlayerBidFields,
  type BidValuePlayerInput,
  type BidValueTournamentConfig,
} from "./bid-value";

/**
 * How public player registration is used for a tournament.
 * Independent of catalog `registration_mode_id` (individual/team/hybrid).
 *
 * Default `auction` preserves existing BidWar registration.
 * `scoring` is tournament/scoring participation without auction workflow.
 */
export const PLAYER_REGISTRATION_MODES = ["auction", "scoring"] as const;
export type PlayerRegistrationMode = (typeof PLAYER_REGISTRATION_MODES)[number];

export const DEFAULT_PLAYER_REGISTRATION_MODE: PlayerRegistrationMode = "auction";

/** How tournament categories (divisions) appear on public registration. */
export const REGISTRATION_CATEGORY_MODES = [
  "hidden",
  "player_select",
  "organizer_assign",
] as const;
export type RegistrationCategoryMode = (typeof REGISTRATION_CATEGORY_MODES)[number];

export const DEFAULT_REGISTRATION_CATEGORY_MODE: RegistrationCategoryMode = "hidden";

export function parsePlayerRegistrationMode(
  raw: string | null | undefined,
): PlayerRegistrationMode {
  return raw === "scoring" ? "scoring" : DEFAULT_PLAYER_REGISTRATION_MODE;
}

export function isScoringPlayerRegistration(
  raw: string | null | undefined,
): boolean {
  return parsePlayerRegistrationMode(raw) === "scoring";
}

export function isAuctionPlayerRegistration(
  raw: string | null | undefined,
): boolean {
  return parsePlayerRegistrationMode(raw) === "auction";
}

export function parseRegistrationCategoryMode(
  raw: string | null | undefined,
): RegistrationCategoryMode {
  if (raw === "player_select" || raw === "organizer_assign") return raw;
  return DEFAULT_REGISTRATION_CATEGORY_MODE;
}

/** Player may choose a category on the public form. */
export function shouldShowPublicCategorySelect(
  mode: RegistrationCategoryMode,
): boolean {
  return mode === "player_select";
}

/** Accept `categoryId` from public registration (ignore crafted values otherwise). */
export function shouldAcceptPublicCategoryId(
  mode: RegistrationCategoryMode,
): boolean {
  return mode === "player_select";
}

/** Auction registration keeps the historical optional categoryId API. Scoring follows policy. */
export function shouldAcceptPublicRegistrationCategoryId(
  registrationMode: PlayerRegistrationMode,
  categoryMode: RegistrationCategoryMode,
): boolean {
  if (registrationMode === "auction") return true;
  return shouldAcceptPublicCategoryId(categoryMode);
}

/** Organizer scoring surfaces may assign/edit category except when the policy is hidden. */
export function shouldShowOrganizerCategoryControls(
  mode: RegistrationCategoryMode,
): boolean {
  return mode === "player_select" || mode === "organizer_assign";
}

const SCORING_FORBIDDEN_ASSIGNMENT_STATUSES = new Set(["sold", "unsold", "retained"]);

/**
 * Scoring-mode team assignment must never create an auction sold/retained/unsold state.
 * Withdrawn stays on the dedicated withdraw endpoint.
 */
export function coerceScoringModePlayerStatus(
  requested: string | undefined,
  existingStatus: string,
): string {
  const candidate = requested ?? existingStatus;
  if (SCORING_FORBIDDEN_ASSIGNMENT_STATUSES.has(candidate)) {
    return "available";
  }
  return candidate;
}

export type PlayerRosterAssignmentType = "unsold_replacement" | "transfer";

/**
 * PTA assignment type for organizer player PATCH.
 * Auction: existing sold → unsold_replacement, otherwise team change → transfer.
 * Scoring: team change → transfer only (never fake a sold state).
 */
export function resolvePlayerRosterAssignmentType(opts: {
  registrationMode: PlayerRegistrationMode;
  requestedStatus: string | undefined;
  existingStatus: string;
  existingTeamId: number | null;
  nextTeamId: number | null | undefined;
}): PlayerRosterAssignmentType | undefined {
  if (opts.registrationMode === "scoring") {
    if (opts.nextTeamId == null || opts.nextTeamId === undefined) return undefined;
    if (opts.nextTeamId === opts.existingTeamId) return undefined;
    return "transfer";
  }
  if (opts.requestedStatus === "sold" && opts.existingStatus !== "sold") {
    return "unsold_replacement";
  }
  if (opts.nextTeamId !== undefined && opts.existingTeamId !== opts.nextTeamId) {
    return "transfer";
  }
  return undefined;
}

/**
 * Public registration category payload.
 * Omitted (undefined) means "do not change".
 * Explicit null means "Assign later / no category".
 */
export function publicRegistrationCategoryIdPayload(
  showSelect: boolean,
  selectedId: string | null | undefined,
): number | null | undefined {
  if (!showSelect) return undefined;
  const raw = selectedId?.trim() ?? "";
  if (!raw || raw === "none") return null;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Resolve bid columns for public registration.
 * Scoring mode never runs auction bid-value assignment.
 */
export function resolvePublicRegistrationBidFields(
  registrationMode: PlayerRegistrationMode,
  tournament: BidValueTournamentConfig,
  input: BidValuePlayerInput,
) {
  if (registrationMode === "scoring") {
    return {
      ok: true as const,
      fields: {
        basePrice: tournament.minBid,
        selectedBidValue: null,
        bidValueSource: "system" as const,
      },
    };
  }
  return resolvePlayerBidFields(tournament, input);
}
