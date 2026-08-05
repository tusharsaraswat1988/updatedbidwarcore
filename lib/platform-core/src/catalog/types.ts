/**
 * Platform Catalog — product assets for Tournament Creation + Rule Profiles.
 * Tournament stores only ids + versions; catalogs own definitions.
 */

/** Lifecycle status for catalog assets (not selection emphasis). */
export type CatalogStatus = "active" | "beta" | "deprecated" | "legacy";

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

export type RegistrationModeCatalogEntry = CatalogEntryBase & {
  kind: "registration_mode";
};

export type TeamFormationStrategyCatalogEntry = CatalogEntryBase & {
  kind: "team_formation";
};

/** Team Type — platform identity kind (EPIC-04). */
export type TeamTypeCatalogEntry = CatalogEntryBase & {
  kind: "team_type";
};

/**
 * Team Role — membership role (EPIC-04).
 * Constraints live on the catalog entry; validators must read these fields.
 */
export type TeamRoleCatalogEntry = CatalogEntryBase & {
  kind: "team_role";
  /** When true, at least one member with this role is required to lock. */
  required: boolean;
  /** When false, at most maxCount members may hold this role. */
  multipleAllowed: boolean;
  /** Max holders; null = unlimited when multipleAllowed. */
  maxCount: number | null;
};

/** Match Type — platform contest kind (EPIC-05). */
export type MatchTypeCatalogEntry = CatalogEntryBase & {
  kind: "match_type";
};

export type MatchRoleScope = "side" | "official";

/**
 * Match Role — side or official role (EPIC-05).
 * Never home/away/team_a/player_a — those are presentation labels.
 */
export type MatchRoleCatalogEntry = CatalogEntryBase & {
  kind: "match_role";
  scope: MatchRoleScope;
  required: boolean;
  multipleAllowed: boolean;
  maxCount: number | null;
};

export type BusinessStageCatalogEntry = CatalogEntryBase & {
  kind: "business_stage";
  sortOrder: number;
};

/** Rule value types — extensible from day one. */
export type RuleValueType =
  | "integer"
  | "boolean"
  | "enum"
  | "duration"
  | "percentage"
  | "decimal"
  | "string"
  | "list"
  | "object"
  | "custom";

export type ConcreteRuleValue =
  | string
  | number
  | boolean
  | null
  | readonly ConcreteRuleValue[]
  | { readonly [key: string]: ConcreteRuleValue };

export type RuleCategoryEntry = {
  id: string;
  version: string;
  displayName: string;
  description: string;
  status: CatalogStatus;
  sortOrder: number;
};

export type RuleDefinitionValidation = {
  required?: boolean;
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
};

export type RuleDefinitionEntry = {
  id: string;
  version: string;
  status: CatalogStatus;
  name: string;
  description: string;
  categoryId: string;
  sportId: string;
  type: RuleValueType;
  defaultValue: ConcreteRuleValue;
  allowedValues?: readonly ConcreteRuleValue[];
  validation?: RuleDefinitionValidation;
  dependencies?: readonly string[];
  conflicts?: readonly string[];
  futureCompatible: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RuleProfileValueEntry = {
  definitionId: string;
  definitionVersion: string;
  value: ConcreteRuleValue | "inherit";
};

/** Declarative runtime binding metadata — never adapter classes. */
export type DeclarativeRuntimeBinding = {
  runtimeBindingType: string;
  runtimeBindingId: string;
  metadata?: Readonly<Record<string, string | number | boolean>>;
};

export type RuleProfileCatalogEntry = CatalogEntryBase & {
  kind: "rule_profile";
  sportId: string;
  familyId: string;
  tags: readonly string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  values: readonly RuleProfileValueEntry[];
  runtimeBinding: DeclarativeRuntimeBinding;
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

export const ASSET_EPOCH = "2026-08-04T00:00:00.000Z";
