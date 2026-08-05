import { BUSINESS_STAGE_CATALOG } from "./business-stages/index.ts";
import { RULE_CATEGORY_CATALOG } from "./categories/index.ts";
import { COMPETITION_TYPE_CATALOG } from "./competition/index.ts";
import { RULE_DEFINITION_CATALOG } from "./definitions/index.ts";
import {
  PRESENTATION_CAPABILITY_PROFILE_CATALOG,
  PRESENTATION_DEFINITION_CATALOG,
  PRESENTATION_PROFILE_CATALOG,
} from "./presentation/index.ts";
import {
  DEFAULT_REGISTRATION_MODE_BY_COMPETITION,
  REGISTRATION_MODE_CATALOG,
} from "./registration-modes/index.ts";
import {
  presentationResolveResultOk,
  resolvePresentationProfile,
  type PresentationResolveContext,
} from "./resolve/presentation-resolver.ts";
import { resolveResultOk, resolveRuleProfile } from "./resolve/resolver.ts";
import type { ResolveContext, ResolveResult, ValidationIssue } from "./resolve/types.ts";
import type { PresentationEngineResult } from "../presentation-engine/types.ts";
import { RULE_PROFILE_CATALOG } from "./rules/index.ts";
import { SPORT_CATALOG } from "./sports/index.ts";
import {
  DEFAULT_TEAM_FORMATION_BY_COMPETITION,
  TEAM_FORMATION_STRATEGY_CATALOG,
} from "./team-formation/index.ts";
import { ADVANCEMENT_RULE_CATALOG } from "./advancement-rules/index.ts";
import { FIXTURE_NODE_KIND_CATALOG } from "./fixture-node-kinds/index.ts";
import { FIXTURE_TYPE_CATALOG } from "./fixture-types/index.ts";
import { MATCH_ROLE_CATALOG } from "./match-roles/index.ts";
import { MATCH_TYPE_CATALOG } from "./match-types/index.ts";
import { RESOURCE_KIND_CATALOG } from "./resource-kinds/index.ts";
import { SCHEDULING_STRATEGY_CATALOG } from "./scheduling-strategies/index.ts";
import { TEAM_ROLE_CATALOG } from "./team-roles/index.ts";
import { TEAM_TYPE_CATALOG } from "./team-types/index.ts";
import {
  LEGACY_COMPETITION_TYPE_ID,
  LEGACY_PROFILE,
  LEGACY_VARIANT_ID,
  type AdvancementRuleCatalogEntry,
  type BusinessStageCatalogEntry,
  type CatalogEntryBase,
  type CatalogRecommendation,
  type CatalogValidationResult,
  type CompetitionTypeCatalogEntry,
  type FixtureNodeKindCatalogEntry,
  type FixtureTypeCatalogEntry,
  type ListProfilesFilter,
  type MatchRoleCatalogEntry,
  type MatchTypeCatalogEntry,
  type PresentationCapabilityProfileEntry,
  type PresentationDefinitionEntry,
  type PresentationProfileCatalogEntry,
  type RegistrationModeCatalogEntry,
  type ResourceKindCatalogEntry,
  type ResolvedTournamentBindings,
  type RuleCategoryEntry,
  type RuleDefinitionEntry,
  type RuleProfileCatalogEntry,
  type SchedulingStrategyCatalogEntry,
  type SportCatalogEntry,
  type SuggestDefaultsInput,
  type TeamFormationStrategyCatalogEntry,
  type TeamRoleCatalogEntry,
  type TeamTypeCatalogEntry,
  type TournamentBindingColumns,
  type TournamentCreateBindings,
  type VariantCatalogEntry,
} from "./types.ts";
import { VARIANT_CATALOG } from "./variants/index.ts";
import { compareSemver, isSemver } from "./versioning/semver.ts";

function supportsToken(supported: readonly string[], token: string): boolean {
  return supported.includes("*") || supported.includes(token);
}

function isActiveForPicker(entry: CatalogEntryBase, includeDeprecated: boolean): boolean {
  if (entry.status === "deprecated" || entry.status === "legacy") {
    return includeDeprecated;
  }
  return true;
}

function recommendationRank(rec: CatalogRecommendation | undefined): number {
  if (rec === "auto_suggested") return 0;
  if (rec === "recommended") return 1;
  if (rec === "advanced") return 2;
  return 3;
}

function sortForWizard<T extends CatalogEntryBase>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const rank = recommendationRank(a.recommendation) - recommendationRank(b.recommendation);
    if (rank !== 0) return rank;
    return a.displayName.localeCompare(b.displayName);
  });
}

function pickProfileVersion(
  entries: readonly { id: string; version: string; status: string }[],
  id: string,
  version?: string | null,
): { id: string; version: string } | null {
  const matches = entries.filter((e) => e.id === id);
  if (matches.length === 0) return null;
  if (version) {
    const exact = matches.find((e) => e.version === version);
    if (!exact) return null;
    return { id: exact.id, version: exact.version };
  }
  const active = matches.filter((e) => e.status !== "deprecated" && e.status !== "legacy");
  const pool = active.length > 0 ? active : matches;
  const chosen = [...pool].sort((a, b) => {
    try {
      return compareSemver(b.version, a.version);
    } catch {
      return b.version.localeCompare(a.version);
    }
  })[0];
  return chosen ? { id: chosen.id, version: chosen.version } : null;
}

function profileCompatible(
  entry: RuleProfileCatalogEntry | PresentationProfileCatalogEntry,
  sportId: string,
  variantId: string,
  competitionTypeId: string,
): boolean {
  if (entry.sportId !== sportId) return false;
  if (!supportsToken(entry.supportedVariants, variantId)) return false;
  if (!supportsToken(entry.supportedCompetitionTypes, competitionTypeId)) return false;
  return true;
}

/**
 * Platform Catalog Registry — sole gateway for Tournament Creation catalogs.
 * Do not import pack files from UI or route handlers; use this API only.
 */
export const CatalogRegistry = {
  listSportsForCreation(includeDeprecated = false): SportCatalogEntry[] {
    return sortForWizard(
      SPORT_CATALOG.filter((s) => isActiveForPicker(s, includeDeprecated)),
    );
  },

  getSport(sportId: string): SportCatalogEntry | null {
    return SPORT_CATALOG.find((s) => s.id === sportId) ?? null;
  },

  listVariants(sportId: string, includeDeprecated = false): VariantCatalogEntry[] {
    return sortForWizard(
      VARIANT_CATALOG.filter(
        (v) => v.sportId === sportId && isActiveForPicker(v, includeDeprecated),
      ),
    );
  },

  getVariant(variantId: string): VariantCatalogEntry | null {
    return VARIANT_CATALOG.find((v) => v.id === variantId) ?? null;
  },

  listCompetitionTypes(sportId?: string, includeDeprecated = false): CompetitionTypeCatalogEntry[] {
    const sport = sportId ? this.getSport(sportId) : null;
    return sortForWizard(
      COMPETITION_TYPE_CATALOG.filter((c) => {
        if (!isActiveForPicker(c, includeDeprecated)) return false;
        if (!sport) return true;
        return sport.supportedCompetitionTypes.includes(c.id);
      }),
    );
  },

  getCompetitionType(competitionTypeId: string): CompetitionTypeCatalogEntry | null {
    return COMPETITION_TYPE_CATALOG.find((c) => c.id === competitionTypeId) ?? null;
  },

  listRuleCategories(): RuleCategoryEntry[] {
    return [...RULE_CATEGORY_CATALOG].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getRuleDefinition(id: string, version?: string | null): RuleDefinitionEntry | null {
    const matches = RULE_DEFINITION_CATALOG.filter((d) => d.id === id);
    if (matches.length === 0) return null;
    if (version) return matches.find((d) => d.version === version) ?? null;
    return [...matches].sort((a, b) => compareSemver(b.version, a.version))[0] ?? null;
  },

  getRuleDefinitions(filter: {
    sportId: string;
    categoryId?: string;
  }): RuleDefinitionEntry[] {
    return RULE_DEFINITION_CATALOG.filter((d) => {
      if (d.sportId !== filter.sportId) return false;
      if (filter.categoryId && d.categoryId !== filter.categoryId) return false;
      return d.status !== "deprecated";
    });
  },

  listRuleProfileFamilies(filter: ListProfilesFilter): string[] {
    const profiles = this.listRuleProfiles(filter);
    return [...new Set(profiles.map((p) => p.familyId))].sort();
  },

  listRuleProfileVersions(familyId: string): RuleProfileCatalogEntry[] {
    return RULE_PROFILE_CATALOG.filter((p) => p.familyId === familyId).sort((a, b) =>
      compareSemver(b.version, a.version),
    );
  },

  listRuleProfiles(filter: ListProfilesFilter): RuleProfileCatalogEntry[] {
    const includeDeprecated = filter.includeDeprecated === true;
    return sortForWizard(
      RULE_PROFILE_CATALOG.filter(
        (p) =>
          isActiveForPicker(p, includeDeprecated) &&
          profileCompatible(p, filter.sportId, filter.variantId, filter.competitionTypeId),
      ),
    );
  },

  getRuleProfile(id: string, version?: string | null): RuleProfileCatalogEntry | null {
    const picked = pickProfileVersion(RULE_PROFILE_CATALOG, id, version);
    if (!picked) return null;
    return (
      RULE_PROFILE_CATALOG.find(
        (p) => p.id === picked.id && p.version === picked.version,
      ) ?? null
    );
  },

  listPresentationProfiles(filter: ListProfilesFilter): PresentationProfileCatalogEntry[] {
    const includeDeprecated = filter.includeDeprecated === true;
    return sortForWizard(
      PRESENTATION_PROFILE_CATALOG.filter(
        (p) =>
          isActiveForPicker(p, includeDeprecated) &&
          profileCompatible(p, filter.sportId, filter.variantId, filter.competitionTypeId),
      ),
    );
  },

  getPresentationProfile(
    id: string,
    version?: string | null,
  ): PresentationProfileCatalogEntry | null {
    const picked = pickProfileVersion(PRESENTATION_PROFILE_CATALOG, id, version);
    if (!picked) return null;
    return (
      PRESENTATION_PROFILE_CATALOG.find(
        (p) => p.id === picked.id && p.version === picked.version,
      ) ?? null
    );
  },

  listPresentationDefinitions(filter?: {
    sportId?: string;
  }): PresentationDefinitionEntry[] {
    return PRESENTATION_DEFINITION_CATALOG.filter((d) => {
      if (filter?.sportId && d.sportId !== "*" && d.sportId !== filter.sportId) {
        return false;
      }
      return d.status !== "deprecated";
    }).sort((a, b) => a.id.localeCompare(b.id));
  },

  listCapabilityProfiles(): PresentationCapabilityProfileEntry[] {
    return [...PRESENTATION_CAPABILITY_PROFILE_CATALOG].sort((a, b) =>
      a.id.localeCompare(b.id),
    );
  },

  getCapabilityProfile(
    id: string,
    version?: string | null,
  ): PresentationCapabilityProfileEntry | null {
    const matches = PRESENTATION_CAPABILITY_PROFILE_CATALOG.filter((p) => p.id === id);
    if (matches.length === 0) return null;
    if (version) return matches.find((p) => p.version === version) ?? null;
    return [...matches].sort((a, b) => compareSemver(b.version, a.version))[0] ?? null;
  },

  suggestDefaults(input: SuggestDefaultsInput): {
    ruleProfile: RuleProfileCatalogEntry | null;
    presentationProfile: PresentationProfileCatalogEntry | null;
  } {
    const rules = this.listRuleProfiles(input);
    const presentations = this.listPresentationProfiles(input);
    const pickBest = <T extends CatalogEntryBase>(list: T[]): T | null => {
      if (list.length === 0) return null;
      const recommended = list.find((e) => e.recommendation === "recommended");
      if (recommended) return recommended;
      const auto = list.find((e) => e.recommendation === "auto_suggested");
      if (auto) return auto;
      return list[0] ?? null;
    };
    return {
      ruleProfile: pickBest(rules),
      presentationProfile: pickBest(presentations),
    };
  },

  /**
   * Validate create-time bindings. Profiles must exist and support
   * sport + variant + competition.
   */
  validateCreateBindings(input: {
    sportId: string;
    variantId: string;
    competitionTypeId: string;
    ruleProfileId: string;
    ruleProfileVersion?: string | null;
    presentationProfileId: string;
    presentationProfileVersion?: string | null;
  }): CatalogValidationResult {
    const sport = this.getSport(input.sportId);
    if (!sport) {
      return { ok: false, error: `Unknown sport: ${input.sportId}` };
    }
    if (sport.status === "deprecated" || sport.status === "legacy") {
      return { ok: false, error: `Sport is deprecated: ${input.sportId}` };
    }

    const variant = this.getVariant(input.variantId);
    if (!variant) {
      return { ok: false, error: `Unknown variant: ${input.variantId}` };
    }
    if (variant.sportId !== input.sportId) {
      return { ok: false, error: "Variant does not belong to selected sport" };
    }
    if (!sport.supportedVariants.includes(variant.id)) {
      return { ok: false, error: "Sport does not support selected variant" };
    }

    const competition = this.getCompetitionType(input.competitionTypeId);
    if (!competition) {
      return { ok: false, error: `Unknown competition type: ${input.competitionTypeId}` };
    }
    if (!sport.supportedCompetitionTypes.includes(competition.id)) {
      return { ok: false, error: "Sport does not support selected competition type" };
    }
    if (!supportsToken(variant.supportedCompetitionTypes, competition.id)) {
      return { ok: false, error: "Variant does not support selected competition type" };
    }

    const rule = this.getRuleProfile(input.ruleProfileId, input.ruleProfileVersion);
    if (!rule) {
      return {
        ok: false,
        error: input.ruleProfileVersion
          ? `Unknown rule profile ${input.ruleProfileId}@${input.ruleProfileVersion}`
          : `Unknown rule profile: ${input.ruleProfileId}`,
      };
    }
    if (rule.status === "deprecated" || rule.status === "legacy") {
      return { ok: false, error: `Rule profile is deprecated: ${rule.id}` };
    }
    if (!profileCompatible(rule, input.sportId, input.variantId, input.competitionTypeId)) {
      return {
        ok: false,
        error: "Rule profile does not support selected sport, variant, or competition",
      };
    }

    const presentation = this.getPresentationProfile(
      input.presentationProfileId,
      input.presentationProfileVersion,
    );
    if (!presentation) {
      return {
        ok: false,
        error: input.presentationProfileVersion
          ? `Unknown presentation profile ${input.presentationProfileId}@${input.presentationProfileVersion}`
          : `Unknown presentation profile: ${input.presentationProfileId}`,
      };
    }
    if (presentation.status === "deprecated" || presentation.status === "legacy") {
      return {
        ok: false,
        error: `Presentation profile is deprecated: ${presentation.id}`,
      };
    }
    if (
      !profileCompatible(
        presentation,
        input.sportId,
        input.variantId,
        input.competitionTypeId,
      )
    ) {
      return {
        ok: false,
        error:
          "Presentation profile does not support selected sport, variant, or competition",
      };
    }

    const bindings: TournamentCreateBindings = {
      sportId: input.sportId,
      variantId: input.variantId,
      competitionTypeId: input.competitionTypeId,
      ruleProfileId: rule.id,
      ruleProfileVersion: rule.version,
      presentationProfileId: presentation.id,
      presentationProfileVersion: presentation.version,
    };
    return { ok: true, bindings };
  },

  validateRuleProfile(input: {
    sportId: string;
    variantId: string;
    competitionTypeId: string;
    profileId: string;
    profileVersion: string;
    profileFamilyId?: string;
  }): { ok: boolean; issues: ValidationIssue[] } {
    const familyId = input.profileFamilyId ?? input.profileId;
    const result = this.resolveRuleProfilePreview({
      sportId: input.sportId,
      variantId: input.variantId,
      competitionTypeId: input.competitionTypeId,
      profileFamilyId: familyId,
      profileId: input.profileId,
      profileVersion: input.profileVersion,
      resolutionMode: "VALIDATE",
    });
    return { ok: resolveResultOk(result), issues: result.validation };
  },

  resolveRuleProfilePreview(ctx: ResolveContext): ResolveResult {
    return resolveRuleProfile(ctx);
  },

  validatePresentationProfile(input: {
    sportId: string;
    variantId: string;
    competitionTypeId: string;
    profileId: string;
    profileVersion: string;
    matchTypeId?: string;
  }): { ok: boolean; result: PresentationEngineResult } {
    const result = this.resolvePresentationProfilePreview({
      sportId: input.sportId,
      variantId: input.variantId,
      competitionTypeId: input.competitionTypeId,
      profileId: input.profileId,
      profileVersion: input.profileVersion,
      matchTypeId: input.matchTypeId,
      resolutionMode: "VALIDATE",
    });
    return { ok: presentationResolveResultOk(result), result };
  },

  resolvePresentationProfilePreview(
    ctx: PresentationResolveContext,
  ): PresentationEngineResult {
    return resolvePresentationProfile(ctx);
  },

  /**
   * Resolve stored tournament columns for engines.
   * Null / missing bindings become Legacy Profile — never null to Rule Engine.
   */
  resolveLegacyBindings(row: TournamentBindingColumns): ResolvedTournamentBindings {
    const hasAny =
      !!row.variantId ||
      !!row.competitionTypeId ||
      !!row.ruleProfileId ||
      !!row.presentationProfileId;

    if (!hasAny) {
      return {
        sportId: row.sport || "cricket",
        variantId: LEGACY_VARIANT_ID,
        competitionTypeId: LEGACY_COMPETITION_TYPE_ID,
        ruleProfileId: LEGACY_PROFILE.id,
        ruleProfileVersion: LEGACY_PROFILE.version,
        presentationProfileId: LEGACY_PROFILE.id,
        presentationProfileVersion: LEGACY_PROFILE.version,
        isLegacy: true,
      };
    }

    return {
      sportId: row.sport || "cricket",
      variantId: row.variantId || LEGACY_VARIANT_ID,
      competitionTypeId: row.competitionTypeId || LEGACY_COMPETITION_TYPE_ID,
      ruleProfileId: row.ruleProfileId || LEGACY_PROFILE.id,
      ruleProfileVersion: row.ruleProfileVersion || LEGACY_PROFILE.version,
      presentationProfileId: row.presentationProfileId || LEGACY_PROFILE.id,
      presentationProfileVersion:
        row.presentationProfileVersion || LEGACY_PROFILE.version,
      isLegacy: !row.ruleProfileId || !row.presentationProfileId,
    };
  },

  /** Group profiles for wizard sections. */
  groupByRecommendation<T extends CatalogEntryBase>(
    entries: T[],
  ): {
    autoSuggested: T[];
    recommended: T[];
    advanced: T[];
  } {
    return {
      autoSuggested: entries.filter((e) => e.recommendation === "auto_suggested"),
      recommended: entries.filter((e) => e.recommendation === "recommended"),
      advanced: entries.filter(
        (e) => e.recommendation === "advanced" || !e.recommendation,
      ),
    };
  },

  requiresAuctionEconomics(competitionTypeId: string): boolean {
    return this.getCompetitionType(competitionTypeId)?.requiresAuctionEconomics ?? false;
  },

  listRegistrationModes(
    competitionTypeId?: string,
    includeDeprecated = false,
  ): RegistrationModeCatalogEntry[] {
    const entries = REGISTRATION_MODE_CATALOG.filter((e) =>
      isActiveForPicker(e, includeDeprecated),
    );
    if (!competitionTypeId) return sortForWizard([...entries]);
    return sortForWizard(
      entries.filter((e) => supportsToken(e.supportedCompetitionTypes, competitionTypeId)),
    );
  },

  getRegistrationMode(id: string): RegistrationModeCatalogEntry | undefined {
    return REGISTRATION_MODE_CATALOG.find((e) => e.id === id);
  },

  /** Suggested registration mode id — recommendation only; never auto-persist. */
  suggestRegistrationModeId(competitionTypeId: string): string | null {
    const preferred = DEFAULT_REGISTRATION_MODE_BY_COMPETITION[competitionTypeId];
    if (preferred && this.listRegistrationModes(competitionTypeId).some((m) => m.id === preferred)) {
      return preferred;
    }
    return this.listRegistrationModes(competitionTypeId)[0]?.id ?? null;
  },

  listTeamFormationStrategies(
    competitionTypeId?: string,
    includeDeprecated = false,
  ): TeamFormationStrategyCatalogEntry[] {
    const entries = TEAM_FORMATION_STRATEGY_CATALOG.filter((e) =>
      isActiveForPicker(e, includeDeprecated),
    );
    if (!competitionTypeId) return sortForWizard([...entries]);
    return sortForWizard(
      entries.filter((e) => supportsToken(e.supportedCompetitionTypes, competitionTypeId)),
    );
  },

  getTeamFormationStrategy(id: string): TeamFormationStrategyCatalogEntry | undefined {
    return TEAM_FORMATION_STRATEGY_CATALOG.find((e) => e.id === id);
  },

  suggestTeamFormationStrategyId(competitionTypeId: string): string | null {
    const preferred = DEFAULT_TEAM_FORMATION_BY_COMPETITION[competitionTypeId];
    if (
      preferred &&
      this.listTeamFormationStrategies(competitionTypeId).some((s) => s.id === preferred)
    ) {
      return preferred;
    }
    return this.listTeamFormationStrategies(competitionTypeId)[0]?.id ?? null;
  },

  listBusinessStages(): BusinessStageCatalogEntry[] {
    return [...BUSINESS_STAGE_CATALOG].sort((a, b) => a.sortOrder - b.sortOrder);
  },

  getBusinessStage(id: string): BusinessStageCatalogEntry | undefined {
    return BUSINESS_STAGE_CATALOG.find((e) => e.id === id);
  },

  listTeamTypes(includeDeprecated = false): TeamTypeCatalogEntry[] {
    return sortForWizard(
      TEAM_TYPE_CATALOG.filter((e) => isActiveForPicker(e, includeDeprecated)),
    );
  },

  getTeamType(id: string): TeamTypeCatalogEntry | undefined {
    return TEAM_TYPE_CATALOG.find((e) => e.id === id);
  },

  listTeamRoles(includeDeprecated = false): TeamRoleCatalogEntry[] {
    return TEAM_ROLE_CATALOG.filter((e) => isActiveForPicker(e, includeDeprecated));
  },

  getTeamRole(id: string): TeamRoleCatalogEntry | undefined {
    return TEAM_ROLE_CATALOG.find((e) => e.id === id);
  },

  listMatchTypes(includeDeprecated = false): MatchTypeCatalogEntry[] {
    return sortForWizard(
      MATCH_TYPE_CATALOG.filter((e) => isActiveForPicker(e, includeDeprecated)),
    );
  },

  getMatchType(id: string): MatchTypeCatalogEntry | undefined {
    return MATCH_TYPE_CATALOG.find((e) => e.id === id);
  },

  listMatchRoles(
    scope?: "side" | "official",
    includeDeprecated = false,
  ): MatchRoleCatalogEntry[] {
    return MATCH_ROLE_CATALOG.filter((e) => {
      if (!isActiveForPicker(e, includeDeprecated)) return false;
      if (scope && e.scope !== scope) return false;
      return true;
    });
  },

  getMatchRole(id: string): MatchRoleCatalogEntry | undefined {
    return MATCH_ROLE_CATALOG.find((e) => e.id === id);
  },

  listFixtureTypes(includeDeprecated = false): FixtureTypeCatalogEntry[] {
    return sortForWizard(
      FIXTURE_TYPE_CATALOG.filter((e) => isActiveForPicker(e, includeDeprecated)),
    );
  },

  getFixtureType(id: string): FixtureTypeCatalogEntry | undefined {
    return FIXTURE_TYPE_CATALOG.find((e) => e.id === id);
  },

  listFixtureNodeKinds(includeDeprecated = false): FixtureNodeKindCatalogEntry[] {
    return FIXTURE_NODE_KIND_CATALOG.filter((e) => isActiveForPicker(e, includeDeprecated));
  },

  getFixtureNodeKind(id: string): FixtureNodeKindCatalogEntry | undefined {
    return FIXTURE_NODE_KIND_CATALOG.find((e) => e.id === id);
  },

  listAdvancementRules(includeDeprecated = false): AdvancementRuleCatalogEntry[] {
    return sortForWizard(
      ADVANCEMENT_RULE_CATALOG.filter((e) => isActiveForPicker(e, includeDeprecated)),
    );
  },

  getAdvancementRule(id: string): AdvancementRuleCatalogEntry | undefined {
    return ADVANCEMENT_RULE_CATALOG.find((e) => e.id === id);
  },

  listResourceKinds(includeDeprecated = false): ResourceKindCatalogEntry[] {
    return sortForWizard(
      RESOURCE_KIND_CATALOG.filter((e) => isActiveForPicker(e, includeDeprecated)),
    );
  },

  getResourceKind(id: string): ResourceKindCatalogEntry | undefined {
    return RESOURCE_KIND_CATALOG.find((e) => e.id === id);
  },

  listSchedulingStrategies(includeDeprecated = false): SchedulingStrategyCatalogEntry[] {
    return sortForWizard(
      SCHEDULING_STRATEGY_CATALOG.filter((e) => isActiveForPicker(e, includeDeprecated)),
    );
  },

  getSchedulingStrategy(id: string): SchedulingStrategyCatalogEntry | undefined {
    return SCHEDULING_STRATEGY_CATALOG.find((e) => e.id === id);
  },

  /** Catalog quality: no orphan definitions / orphan profile values. */
  assertCatalogIntegrity(): { ok: boolean; issues: string[] } {
    const issues: string[] = [];
    const defIds = new Set(RULE_DEFINITION_CATALOG.map((d) => `${d.id}@${d.version}`));
    const usedDefs = new Set<string>();

    for (const profile of RULE_PROFILE_CATALOG) {
      if (!isSemver(profile.version)) {
        issues.push(`Profile ${profile.id} has non-semver version ${profile.version}`);
      }
      for (const entry of profile.values) {
        const key = `${entry.definitionId}@${entry.definitionVersion}`;
        if (!defIds.has(key)) {
          issues.push(
            `Profile ${profile.id}@${profile.version} references missing definition ${key}`,
          );
        } else {
          usedDefs.add(key);
        }
        const categoryOk = RULE_CATEGORY_CATALOG.some((c) => {
          const def = RULE_DEFINITION_CATALOG.find(
            (d) => d.id === entry.definitionId && d.version === entry.definitionVersion,
          );
          return def ? c.id === def.categoryId : false;
        });
        if (!categoryOk && defIds.has(key)) {
          // category presence already on definition; skip duplicate noise
        }
      }
    }

    for (const def of RULE_DEFINITION_CATALOG) {
      const key = `${def.id}@${def.version}`;
      if (!usedDefs.has(key)) {
        issues.push(`Orphan definition ${key} is not referenced by any profile`);
      }
      if (!RULE_CATEGORY_CATALOG.some((c) => c.id === def.categoryId)) {
        issues.push(`Definition ${key} references unknown category ${def.categoryId}`);
      }
    }

    return { ok: issues.length === 0, issues };
  },
};

export type CatalogRegistryApi = typeof CatalogRegistry;
