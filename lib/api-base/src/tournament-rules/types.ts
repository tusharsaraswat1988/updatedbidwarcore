/**
 * Tournament / category / stage match-format configuration.
 *
 * Sport-specific payloads (BadmintonMatchFormat, CricketMatchFormat, …)
 * live in the `format` field — this layer stays sport-agnostic.
 *
 * ── Architecture lock (Phase 1 + product rules) ─────────────────────────────
 *
 * TWO INDEPENDENT CONCEPTS (do not overload):
 *
 *   Tournament Format  = HOW the tournament / category is structured
 *     Examples: League, Knockout, Round Robin, Swiss, Double Elimination
 *     Type: TournamentFormatKey
 *
 *   Draw Stage         = WHERE a match sits inside that structure
 *     Examples: League, Round Robin, Pre Quarter, Quarter Final,
 *               Semi Final, Third Place, Final
 *     Type: DrawStageKey
 *
 * Same English words may appear in both vocabularies (e.g. "League",
 * "Round Robin") but they are different types and different meanings:
 *
 *   Tournament Format = Knockout          → Stage = Quarter Final
 *   Tournament Format = League            → Stage = League
 *   Tournament Format = Swiss             → Stage = Round Robin
 *
 * Never use DrawStageKey to represent Tournament Format.
 * Match-format inheritance keys off DrawStageKey only (via fixture /
 * manual stage selection) — not off TournamentFormatKey.
 *
 * Hierarchy (Stage always belongs to a Category — never tournament-global):
 *
 *   Tournament
 *     → Tournament Default Match Format   (scoring rules: points / best-of)
 *       → Category
 *         → Tournament Format             (draw structure — independent)
 *         → Stage (category-scoped, system-generated keys only)
 *           → Match (stamped copy)
 *             → MATCH_STARTED (freeze)
 *
 * Resolution precedence (highest first) for scoring Match Format:
 *   startOverride → match → stage → category → tournament → STANDARD_FORMAT
 *
 * Draw stages are SYSTEM GENERATED:
 *   - Organizers never create, rename, or invent stage keys.
 *   - Fixture Source Adapters that produce bracket structure (e.g. Auto Generate)
 *     assign DrawStageKey values to fixtures (League, Round Robin, Pre Quarter,
 *     Quarter Final, Semi Final, Third Place, Final).
 *   - Fixture.stageKey is the authoritative source for format inheritance
 *     when a match is created from a fixture.
 *
 * Organizer responsibility (per category, per stage):
 *   - "Use Tournament Default"  OR  "Override Match Format"
 *   - Never manually assign stage keys to auto-generated fixtures.
 *
 * Match creation from fixture:
 *   Fixture.stageKey → resolve effective format → stamp match_format_json
 *   → freeze on MATCH_STARTED
 *
 * Manual match creation (legacy compatibility — prefer fixture-based create):
 *   - Optional Stage dropdown (system keys only).
 *   - Default = Exhibition / Friendly (no stage) → no stage layer;
 *     inherits category default then tournament default.
 *   - Target architecture: Create Match → ensure Fixture → create Match from Fixture.
 *
 * Organizer UI language (Phase 3+): DRAW_STAGE_LABELS +
 * "Use Tournament Default" | "Override Match Format" — never "Stage Rule".
 *
 * Companion product lifecycle (Tournament / Match states, edit locks):
 *   docs/product-state-contract.md
 *   ./product-state-contract.ts
 *
 * After MATCH_STARTED, the event-sourced format is authoritative —
 * changing tournament / category / stage / match JSON must never rewrite
 * a live match.
 */

export type TournamentSportSlug =
  | "badminton"
  | "cricket"
  | "football"
  | "volleyball"
  | (string & {});

/**
 * Stored under `tournaments.scoring_settings_json.tournamentRules`.
 * Product: Tournament Default Match Format (existing Match Format page).
 */
export type TournamentRulesConfig<TFormat = Record<string, unknown>> = {
  sport: TournamentSportSlug;
  /** Named preset id for the active sport (e.g. "standard_bwf", "custom"). */
  presetId: string;
  /** Sport-specific format payload. */
  format: TFormat;
  /** Cross-sport optional flags (reserved; unused until needed). */
  options?: {
    suddenDeath?: boolean;
  };
};

/**
 * HOW a tournament / category draw is structured.
 *
 * Independent of DrawStageKey (WHERE a match sits). Do not overload stages
 * for this. Vocabulary only in Phase 1 — not wired into match-format
 * inheritance or schema persistence here.
 *
 * Related existing field (badminton): categories.draw_type — keep concepts
 * aligned when that surface is formalized for multi-sport reuse.
 */
export const TOURNAMENT_FORMAT_KEYS = [
  "league",
  "knockout",
  "round_robin",
  "swiss",
  "double_elimination",
] as const;

export type TournamentFormatKey = (typeof TOURNAMENT_FORMAT_KEYS)[number];

/** Organizer-facing labels for Tournament Format (structure), not draw stages. */
export const TOURNAMENT_FORMAT_LABELS: Record<TournamentFormatKey, string> = {
  league: "League",
  knockout: "Knockout",
  round_robin: "Round Robin",
  swiss: "Swiss",
  double_elimination: "Double Elimination",
};

export function isTournamentFormatKey(value: unknown): value is TournamentFormatKey {
  return (
    typeof value === "string" &&
    (TOURNAMENT_FORMAT_KEYS as readonly string[]).includes(value)
  );
}

/**
 * Closed set of system-generated draw stage keys (WHERE a match belongs).
 * Independent of TournamentFormatKey (HOW the tournament is structured).
 * A stage always exists inside a category — never as a tournament-level entity.
 * Organizers never create or rename these; Fixture Source Adapters that build
 * brackets assign them to fixtures (organizers may optionally pick one for
 * legacy manual matches without a fixture).
 *
 * String overlap with TournamentFormatKey (e.g. "league", "round_robin") is
 * intentional English reuse — typed separately; never treat them as the same.
 */
export const DRAW_STAGE_KEYS = [
  "league",
  "round_robin",
  "pre_quarter",
  "quarter_final",
  "semi_final",
  "third_place",
  "final",
] as const;

export type DrawStageKey = (typeof DRAW_STAGE_KEYS)[number];

/**
 * Manual match with no draw stage (Exhibition / Friendly).
 * Not a DrawStageKey — contributes nothing to the stage cascade layer.
 */
export const MANUAL_MATCH_NO_STAGE = null;

/** Organizer-facing labels — use these in UI instead of technical key names. */
export const DRAW_STAGE_LABELS: Record<DrawStageKey, string> = {
  league: "League Matches",
  round_robin: "Round Robin",
  pre_quarter: "Pre Quarter",
  quarter_final: "Quarter Final",
  semi_final: "Semi Final",
  third_place: "Third Place",
  final: "Final",
};

/** Label for manual matches with no stage key. */
export const MANUAL_MATCH_NO_STAGE_LABEL = "Exhibition / Friendly";

/**
 * Stage selection on manual match create:
 * a system DrawStageKey, or null = Exhibition / Friendly (no stage layer).
 */
export type ManualMatchStageSelection = DrawStageKey | null;

export function isDrawStageKey(value: unknown): value is DrawStageKey {
  return (
    typeof value === "string" &&
    (DRAW_STAGE_KEYS as readonly string[]).includes(value)
  );
}

/** Normalize optional stage input; unknown strings → null (no stage). */
export function parseManualMatchStageSelection(
  value: unknown,
): ManualMatchStageSelection {
  if (value == null || value === "") return null;
  return isDrawStageKey(value) ? value : null;
}

/**
 * Per-stage format choice for one category.
 * Persistence shape for Phase 2 (`stage_format_rules_json` or equivalent).
 *
 * mode "use_tournament_default" → contribute nothing to the cascade (fall through).
 * mode "override" → `format` (and optional `presetId`) wins over tournament default.
 */
export type CategoryStageFormatConfig<TFormat = Record<string, unknown>> = {
  mode: "use_tournament_default" | "override";
  presetId?: string;
  format?: TFormat;
};

/** Map of stage key → config for one category. Omitted keys inherit tournament default. */
export type CategoryStageFormatMap<TFormat = Record<string, unknown>> = Partial<
  Record<DrawStageKey, CategoryStageFormatConfig<TFormat>>
>;

/**
 * Format contribution from a category stage config.
 * "use_tournament_default" / missing / non-override → null (cascade continues).
 */
export function formatFromCategoryStageConfig<TFormat>(
  config: CategoryStageFormatConfig<TFormat> | null | undefined,
): TFormat | null {
  if (!config || config.mode !== "override") return null;
  if (!config.format || typeof config.format !== "object") return null;
  return config.format;
}

/**
 * Look up a category's stage config and return its cascade contribution.
 */
export function resolveCategoryStageFormat<TFormat>(
  map: CategoryStageFormatMap<TFormat> | null | undefined,
  stageKey: DrawStageKey | null | undefined,
): TFormat | null {
  if (!map || !stageKey) return null;
  return formatFromCategoryStageConfig(map[stageKey]);
}

/**
 * Inheritance cascade sources.
 * Precedence (highest first): startOverride → match → stage → category → tournament.
 */
export type FormatResolutionSources<TFormat> = {
  tournament?: TFormat | null;
  /**
   * Category default (`badminton_categories.match_format_json`).
   * Kept for future Category Default without breaking compatibility.
   */
  category?: TFormat | null;
  /**
   * Resolved format from a category-scoped stage override.
   * Pass null / omit until Phase 2 loads CategoryStageFormatMap.
   */
  stage?: TFormat | null;
  match?: TFormat | null;
  startOverride?: TFormat | null;
};

export function resolveInheritedFormat<TFormat>(
  sources: FormatResolutionSources<TFormat>,
): TFormat | null {
  return (
    sources.startOverride ??
    sources.match ??
    sources.stage ??
    sources.category ??
    sources.tournament ??
    null
  );
}

/** Read tournamentRules from scoring_settings_json without validating sport payload. */
export function readTournamentRulesFromSettings(
  scoringSettingsJson: Record<string, unknown> | null | undefined,
): TournamentRulesConfig | null {
  const raw = scoringSettingsJson?.tournamentRules;
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.sport !== "string" || typeof obj.presetId !== "string") return null;
  if (!obj.format || typeof obj.format !== "object") return null;
  return {
    sport: obj.sport,
    presetId: obj.presetId,
    format: obj.format as Record<string, unknown>,
    ...(obj.options && typeof obj.options === "object"
      ? { options: obj.options as TournamentRulesConfig["options"] }
      : {}),
  };
}
