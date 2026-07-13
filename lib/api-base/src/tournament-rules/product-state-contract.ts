/**
 * Product State Contract — sport-agnostic lifecycle vocabulary.
 *
 * STATUS: Architecture lock only. Not enforced by APIs, schema, or UI yet.
 * Future sports MUST reuse these product states; sport-specific status fields
 * may map onto this contract but must not invent parallel lifecycles.
 *
 * Companion narrative: docs/product-state-contract.md
 *
 * Related (independent) concepts — do not conflate:
 *   - Tournament Format (HOW draw is structured) — TournamentFormatKey
 *   - Draw Stage (WHERE a match sits) — DrawStageKey
 *   - Tournament Default Match Format (scoring rules) — TournamentRulesConfig
 *   - This file: product lifecycle states and edit locks
 */

// ─── Tournament product lifecycle ───────────────────────────────────────────

/**
 * Tournament product states (ordered).
 *
 * Draft → Setup → Draw Ready → Match Scheduling → Ready To Start
 *   → Live → Completed → Archived
 */
export const TOURNAMENT_PRODUCT_STATES = [
  "draft",
  "setup",
  "draw_ready",
  "match_scheduling",
  "ready_to_start",
  "live",
  "completed",
  "archived",
] as const;

export type TournamentProductState = (typeof TOURNAMENT_PRODUCT_STATES)[number];

export const TOURNAMENT_PRODUCT_STATE_LABELS: Record<TournamentProductState, string> = {
  draft: "Draft",
  setup: "Setup",
  draw_ready: "Draw Ready",
  match_scheduling: "Match Scheduling",
  ready_to_start: "Ready To Start",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
};

export function isTournamentProductState(value: unknown): value is TournamentProductState {
  return (
    typeof value === "string" &&
    (TOURNAMENT_PRODUCT_STATES as readonly string[]).includes(value)
  );
}

/** Valid forward transitions only (no skips except where noted). */
export const TOURNAMENT_PRODUCT_TRANSITIONS: Record<
  TournamentProductState,
  readonly TournamentProductState[]
> = {
  draft: ["setup"],
  setup: ["draw_ready", "draft"],
  draw_ready: ["match_scheduling", "setup"],
  match_scheduling: ["ready_to_start", "draw_ready"],
  ready_to_start: ["live", "match_scheduling"],
  live: ["completed"],
  completed: ["archived"],
  archived: [],
};

// ─── Match product lifecycle ────────────────────────────────────────────────

/**
 * Match product states (ordered).
 *
 * Draft → Scheduled → Court Assigned → Ready → Live → Completed → Verified
 *
 * Scoring freeze: MATCH_STARTED (engine) occurs on transition into Live
 * (or at the start command that makes the match Live). Format is frozen then.
 */
export const MATCH_PRODUCT_STATES = [
  "draft",
  "scheduled",
  "court_assigned",
  "ready",
  "live",
  "completed",
  "verified",
] as const;

export type MatchProductState = (typeof MATCH_PRODUCT_STATES)[number];

export const MATCH_PRODUCT_STATE_LABELS: Record<MatchProductState, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  court_assigned: "Court Assigned",
  ready: "Ready",
  live: "Live",
  completed: "Completed",
  verified: "Verified",
};

export function isMatchProductState(value: unknown): value is MatchProductState {
  return (
    typeof value === "string" &&
    (MATCH_PRODUCT_STATES as readonly string[]).includes(value)
  );
}

/**
 * Valid match transitions.
 * Backward moves allowed only before Live (except cancel/void paths — out of scope).
 */
export const MATCH_PRODUCT_TRANSITIONS: Record<
  MatchProductState,
  readonly MatchProductState[]
> = {
  draft: ["scheduled"],
  scheduled: ["court_assigned", "draft"],
  court_assigned: ["ready", "scheduled"],
  ready: ["live", "court_assigned"],
  live: ["completed"],
  completed: ["verified"],
  verified: [],
};

// ─── Editable modules (lock targets) ────────────────────────────────────────

/**
 * Product modules that become locked at defined tournament/match points.
 * Sport-agnostic names for organizer surfaces.
 */
export const PRODUCT_EDIT_MODULES = [
  "branding",
  "players",
  "categories",
  "tournament_match_format",
  "draw_generation",
  "court_assignment",
] as const;

export type ProductEditModule = (typeof PRODUCT_EDIT_MODULES)[number];

export const PRODUCT_EDIT_MODULE_LABELS: Record<ProductEditModule, string> = {
  branding: "Branding",
  players: "Players",
  categories: "Categories",
  tournament_match_format: "Tournament Match Format",
  draw_generation: "Draw Generation",
  court_assignment: "Court Assignment",
};

/**
 * Earliest tournament product state at which the module is locked for normal
 * organizers (admin override out of scope). Soft guidance until Phase 2+
 * enforcement.
 *
 * lockedFrom = state where edits become blocked inclusive.
 * null = remains editable through Completed (then archived freezes everything).
 */
export const PRODUCT_MODULE_LOCK_FROM: Record<
  ProductEditModule,
  TournamentProductState | null
> = {
  /** Soft branding tweaks OK until Live; structural rebrand freezes at Live. */
  branding: "live",
  /** Entries / roster changes freeze once draws are treated as ready. */
  players: "draw_ready",
  /** Category structure freezes before draw generation finalizes. */
  categories: "draw_ready",
  /**
   * Tournament Default Match Format freezes when any match can start.
   * Stage overrides for not-yet-started matches may follow stricter rules later.
   */
  tournament_match_format: "ready_to_start",
  /** Regenerating draws blocked once scheduling has begun. */
  draw_generation: "match_scheduling",
  /** Court assignment remains editable while scheduling / ready; freezes at Live. */
  court_assignment: "live",
};

/**
 * Match-level lock: after this match state (inclusive), the stamped match
 * scoring format and sides must not change via cascade edits.
 */
export const MATCH_FORMAT_LOCKED_FROM: MatchProductState = "live";

/**
 * Match-level lock: roster / side identity locked from Ready onward
 * (pre-start lineup confirmation). Court may still move until Live per
 * PRODUCT_MODULE_LOCK_FROM.court_assignment.
 */
export const MATCH_ROSTER_LOCKED_FROM: MatchProductState = "ready";
