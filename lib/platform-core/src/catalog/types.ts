/**
 * Platform Catalog — product assets for Tournament Creation.
 * Tournament stores only ids + versions; catalogs own definitions.
 */

export type CatalogStatus = "default" | "beta" | "deprecated";

/** Wizard / picker emphasis — not persisted on tournaments. */
export type CatalogRecommendation = "auto_suggested" | "recommended" | "advanced";

export type CatalogEntryBase = {
  id: string;
  version: string;
  displayName: string;
  description: string;
  /** Competition type ids this entry supports. Use ["*"] for all. */
  supportedCompetitionTypes: readonly string[];
  /** Variant ids this entry supports. Use ["*"] for all variants of its sport. */
  supportedVariants: readonly string[];
  status: CatalogStatus;
  recommendation?: CatalogRecommendation;
};

export type SportCatalogEntry = CatalogEntryBase & {
  kind: "sport";
};

export type VariantCatalogEntry = CatalogEntryBase & {
  kind: "variant";
  sportId: string;
};

export type CompetitionTypeCatalogEntry = CatalogEntryBase & {
  kind: "competition";
  /** When true, create flow may collect auction purse/bid fields. */
  requiresAuctionEconomics: boolean;
};

export type RuleProfileCatalogEntry = CatalogEntryBase & {
  kind: "rule_profile";
  sportId: string;
  /** UI-only preview metadata — never written onto tournaments. */
  preview?: Record<string, unknown>;
};

export type PresentationProfileCatalogEntry = CatalogEntryBase & {
  kind: "presentation_profile";
  sportId: string;
  /** UI-only preview metadata — never written onto tournaments. */
  preview?: Record<string, unknown>;
};

export type TournamentCreateBindings = {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  ruleProfileId: string;
  ruleProfileVersion: string;
  presentationProfileId: string;
  presentationProfileVersion: string;
};

export type TournamentBindingColumns = {
  sport: string | null | undefined;
  variantId: string | null | undefined;
  competitionTypeId: string | null | undefined;
  ruleProfileId: string | null | undefined;
  ruleProfileVersion: string | null | undefined;
  presentationProfileId: string | null | undefined;
  presentationProfileVersion: string | null | undefined;
};

export type ResolvedTournamentBindings = {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  ruleProfileId: string;
  ruleProfileVersion: string;
  presentationProfileId: string;
  presentationProfileVersion: string;
  /** True when bindings came from Legacy Profile fallback. */
  isLegacy: boolean;
};

export type CatalogValidationResult =
  | { ok: true; bindings: TournamentCreateBindings }
  | { ok: false; error: string };

export type SuggestDefaultsInput = {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
};

export type ListProfilesFilter = {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  /** When false, deprecated profiles are omitted (default true = omit). */
  includeDeprecated?: boolean;
};

/** Stable Legacy Profile identity for pre-EPIC-01 tournaments. */
export const LEGACY_PROFILE = {
  id: "platform.legacy",
  version: "1.0.0",
  displayName: "Legacy Profile",
  description:
    "Compatibility binding for tournaments created before platform catalog bindings existed.",
} as const;

export const LEGACY_VARIANT_ID = "platform.legacy_variant";
export const LEGACY_COMPETITION_TYPE_ID = "platform.legacy_competition";
