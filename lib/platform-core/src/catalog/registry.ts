import { COMPETITION_TYPE_CATALOG } from "./competition/index.ts";
import { PRESENTATION_PROFILE_CATALOG } from "./presentation/index.ts";
import { RULE_PROFILE_CATALOG } from "./rules/index.ts";
import { SPORT_CATALOG } from "./sports/index.ts";
import {
  LEGACY_COMPETITION_TYPE_ID,
  LEGACY_PROFILE,
  LEGACY_VARIANT_ID,
  type CatalogEntryBase,
  type CatalogRecommendation,
  type CatalogValidationResult,
  type CompetitionTypeCatalogEntry,
  type ListProfilesFilter,
  type PresentationProfileCatalogEntry,
  type ResolvedTournamentBindings,
  type RuleProfileCatalogEntry,
  type SportCatalogEntry,
  type SuggestDefaultsInput,
  type TournamentBindingColumns,
  type TournamentCreateBindings,
  type VariantCatalogEntry,
} from "./types.ts";
import { VARIANT_CATALOG } from "./variants/index.ts";

function supportsToken(supported: readonly string[], token: string): boolean {
  return supported.includes("*") || supported.includes(token);
}

function isActiveForPicker(entry: CatalogEntryBase, includeDeprecated: boolean): boolean {
  if (entry.status === "deprecated") return includeDeprecated;
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
  // Prefer non-deprecated newest by version string (semver-ish lexical is enough for catalog packs).
  const active = matches.filter((e) => e.status !== "deprecated");
  const pool = active.length > 0 ? active : matches;
  const chosen = [...pool].sort((a, b) => b.version.localeCompare(a.version))[0];
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
    if (sport.status === "deprecated") {
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
    if (rule.status === "deprecated") {
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
    if (presentation.status === "deprecated") {
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
};

export type CatalogRegistryApi = typeof CatalogRegistry;
