import { RULE_CATEGORY_CATALOG } from "../categories/index.ts";
import { RULE_DEFINITION_CATALOG } from "../definitions/index.ts";
import { RULE_PROFILE_CATALOG } from "../rules/index.ts";
import type {
  ConcreteRuleValue,
  RuleDefinitionEntry,
  RuleProfileCatalogEntry,
} from "../types.ts";
import { isSemver } from "../versioning/semver.ts";
import { computeSnapshotHash } from "./hash.ts";
import type {
  ResolveContext,
  ResolveLayerId,
  ResolveResult,
  ResolvedRuleEntry,
  ValidationIssue,
} from "./types.ts";
import { validateConcreteValue } from "./validate-value.ts";

const SUPPORTED_BINDING_TYPES: Readonly<Record<string, readonly string[]>> = {
  cricket: ["cricket_platform_defaults"],
  badminton: ["badminton_match_format"],
  football: ["football_platform_defaults"],
};

function supportsToken(supported: readonly string[], token: string): boolean {
  return supported.includes("*") || supported.includes(token);
}

function getDefinition(id: string, version?: string | null): RuleDefinitionEntry | null {
  const matches = RULE_DEFINITION_CATALOG.filter((d) => d.id === id);
  if (matches.length === 0) return null;
  if (version) return matches.find((d) => d.version === version) ?? null;
  return [...matches].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
}

function getProfile(id: string, version?: string | null): RuleProfileCatalogEntry | null {
  const matches = RULE_PROFILE_CATALOG.filter((p) => p.id === id);
  if (matches.length === 0) return null;
  if (version) return matches.find((p) => p.version === version) ?? null;
  const active = matches.filter((p) => p.status !== "deprecated" && p.status !== "legacy");
  const pool = active.length > 0 ? active : matches;
  return [...pool].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
}

function emptySnapshot(ctx: ResolveContext, issues: ValidationIssue[]): ResolveResult {
  const snapshot = {
    sportId: ctx.sportId,
    variantId: ctx.variantId,
    competitionTypeId: ctx.competitionTypeId,
    profileFamilyId: ctx.profileFamilyId,
    profileId: ctx.profileId,
    profileVersion: ctx.profileVersion,
    values: [] as ResolvedRuleEntry[],
    runtimeBinding: {
      runtimeBindingType: "unknown",
      runtimeBindingId: "unknown",
    },
    provenance: {
      layersApplied: [] as ResolveLayerId[],
      overridesApplied: { tournament: false, match: false },
    },
    snapshotHash: "invalid",
    resolvedAt: new Date(0).toISOString(),
  };
  return {
    snapshot,
    validation: issues,
    warnings: issues.filter((i) => i.severity === "WARNING"),
    summary: {
      profileLabel: ctx.profileId,
      profileStatus: "unknown",
      valueCount: 0,
      errorCount: issues.filter((i) => i.severity === "ERROR").length,
      warningCount: issues.filter((i) => i.severity === "WARNING").length,
      infoCount: issues.filter((i) => i.severity === "INFO").length,
      runtimeBindingType: "unknown",
      runtimeBindingId: "unknown",
    },
    snapshotHash: "invalid",
  };
}

/**
 * Pure, deterministic Rule Resolver.
 * Catalog reads only — no I/O, no adapter calls, no snapshot mutation by adapters.
 */
export function resolveRuleProfile(ctx: ResolveContext): ResolveResult {
  const issues: ValidationIssue[] = [];

  if (ctx.resolutionMode !== "PREVIEW" && ctx.resolutionMode !== "VALIDATE") {
    issues.push({
      severity: "ERROR",
      code: "MODE_UNSUPPORTED",
      message: `Resolution mode ${ctx.resolutionMode} is not implemented in EPIC-02`,
    });
    return emptySnapshot(ctx, issues);
  }

  if (!isSemver(ctx.profileVersion)) {
    issues.push({
      severity: "ERROR",
      code: "INVALID_SEMVER",
      message: `Profile version must be semver MAJOR.MINOR.PATCH, got: ${ctx.profileVersion}`,
      path: "profileVersion",
    });
  }

  const profile = getProfile(ctx.profileId, ctx.profileVersion);
  if (!profile) {
    issues.push({
      severity: "ERROR",
      code: "UNKNOWN_PROFILE",
      message: `Unknown rule profile ${ctx.profileId}@${ctx.profileVersion}`,
      path: "profileId",
    });
    return emptySnapshot(ctx, issues);
  }

  if (profile.familyId !== ctx.profileFamilyId && ctx.profileFamilyId !== profile.id) {
    issues.push({
      severity: "ERROR",
      code: "FAMILY_MISMATCH",
      message: `Profile family mismatch: expected ${ctx.profileFamilyId}, got ${profile.familyId}`,
      path: "profileFamilyId",
    });
  }

  if (profile.sportId !== ctx.sportId) {
    issues.push({
      severity: "ERROR",
      code: "SPORT_INCOMPATIBLE",
      message: "Rule profile does not support selected sport",
    });
  }
  if (!supportsToken(profile.supportedVariants, ctx.variantId)) {
    issues.push({
      severity: "ERROR",
      code: "VARIANT_INCOMPATIBLE",
      message: "Rule profile does not support selected variant",
    });
  }
  if (!supportsToken(profile.supportedCompetitionTypes, ctx.competitionTypeId)) {
    issues.push({
      severity: "ERROR",
      code: "COMPETITION_INCOMPATIBLE",
      message: "Rule profile does not support selected competition",
    });
  }

  if (profile.status === "deprecated") {
    issues.push({
      severity: "WARNING",
      code: "PROFILE_DEPRECATED",
      message: `Rule profile is deprecated: ${profile.id}`,
    });
  } else if (profile.status === "beta") {
    issues.push({
      severity: "INFO",
      code: "PROFILE_BETA",
      message: `Rule profile is beta: ${profile.id}`,
    });
  } else if (profile.status === "legacy") {
    issues.push({
      severity: "INFO",
      code: "PROFILE_LEGACY",
      message: `Rule profile is legacy: ${profile.id}`,
    });
  }

  const allowedBindings = SUPPORTED_BINDING_TYPES[ctx.sportId] ?? [];
  if (!allowedBindings.includes(profile.runtimeBinding.runtimeBindingType)) {
    issues.push({
      severity: "ERROR",
      code: "BINDING_UNSUPPORTED",
      message: `Unsupported runtimeBindingType ${profile.runtimeBinding.runtimeBindingType} for sport ${ctx.sportId}`,
      path: "runtimeBinding",
    });
  }

  const sportDefs = RULE_DEFINITION_CATALOG.filter((d) => d.sportId === ctx.sportId);
  const profileValueByDef = new Map(
    profile.values.map((v) => [v.definitionId, v] as const),
  );

  const resolved: ResolvedRuleEntry[] = [];
  const layersApplied: ResolveLayerId[] = ["platform", "sport", "variant", "profile"];

  for (const definition of sportDefs) {
    const category = RULE_CATEGORY_CATALOG.find((c) => c.id === definition.categoryId);
    if (!category) {
      issues.push({
        severity: "ERROR",
        code: "UNKNOWN_CATEGORY",
        message: `Unknown category ${definition.categoryId} on definition ${definition.id}`,
        path: definition.id,
      });
      continue;
    }

    const entry = profileValueByDef.get(definition.id);
    if (entry) {
      const def = getDefinition(entry.definitionId, entry.definitionVersion);
      if (!def) {
        issues.push({
          severity: "ERROR",
          code: "UNKNOWN_DEFINITION",
          message: `Unknown rule definition ${entry.definitionId}@${entry.definitionVersion}`,
          path: entry.definitionId,
        });
        continue;
      }

      let layer: ResolveLayerId = "profile";
      let concrete: ConcreteRuleValue;
      let fromProfile: ResolvedRuleEntry["resolvedFromProfile"] = {
        familyId: profile.familyId,
        profileId: profile.id,
        profileVersion: profile.version,
      };

      if (entry.value === "inherit") {
        concrete = def.defaultValue;
        layer = "platform";
        fromProfile = null;
      } else {
        concrete = entry.value;
        issues.push(...validateConcreteValue(def, concrete));
      }

      // Tournament / match overrides — interface only (apply when present)
      if (ctx.tournamentOverrides?.values?.[definition.id] !== undefined) {
        concrete = ctx.tournamentOverrides.values[definition.id]!;
        layer = "tournament_override";
        fromProfile = null;
        if (!layersApplied.includes("tournament_override")) {
          layersApplied.push("tournament_override");
        }
      }
      if (ctx.matchOverrides?.values?.[definition.id] !== undefined) {
        concrete = ctx.matchOverrides.values[definition.id]!;
        layer = "match_override";
        fromProfile = null;
        if (!layersApplied.includes("match_override")) {
          layersApplied.push("match_override");
        }
      }

      resolved.push({
        definitionId: def.id,
        definitionVersion: def.version,
        resolvedValue: concrete,
        resolvedFromLayer: layer,
        resolvedFromProfile: fromProfile,
      });
    } else {
      // Omitted → inherit platform default
      resolved.push({
        definitionId: definition.id,
        definitionVersion: definition.version,
        resolvedValue: definition.defaultValue,
        resolvedFromLayer: "platform",
        resolvedFromProfile: null,
      });
    }
  }

  // Unknown profile values (orphan keys)
  for (const entry of profile.values) {
    if (!sportDefs.some((d) => d.id === entry.definitionId)) {
      issues.push({
        severity: "ERROR",
        code: "UNKNOWN_DEFINITION",
        message: `Profile references unknown definition ${entry.definitionId}`,
        path: entry.definitionId,
      });
    }
  }

  // Dependency / conflict checks on resolved concrete values
  const valueMap = new Map(resolved.map((r) => [r.definitionId, r.resolvedValue]));
  for (const entry of resolved) {
    const def = getDefinition(entry.definitionId, entry.definitionVersion);
    if (!def) continue;
    for (const dep of def.dependencies ?? []) {
      const depVal = valueMap.get(dep);
      if (depVal === false || depVal === null || depVal === undefined) {
        if (entry.resolvedValue === true) {
          issues.push({
            severity: "ERROR",
            code: "DEPENDENCY_UNSATISFIED",
            message: `${def.id} requires ${dep}`,
            path: def.id,
          });
        }
      }
    }
    for (const conflict of def.conflicts ?? []) {
      if (entry.resolvedValue === true && valueMap.get(conflict) === true) {
        issues.push({
          severity: "ERROR",
          code: "CONFLICT",
          message: `${def.id} conflicts with ${conflict}`,
          path: def.id,
        });
      }
    }
  }

  const snapshotHash = computeSnapshotHash({
    profileId: profile.id,
    profileVersion: profile.version,
    runtimeBindingType: profile.runtimeBinding.runtimeBindingType,
    runtimeBindingId: profile.runtimeBinding.runtimeBindingId,
    values: resolved,
  });

  // Metadata only — excluded from snapshotHash and equality comparisons.
  const resolvedAt = new Date().toISOString();

  const snapshot = {
    sportId: ctx.sportId,
    variantId: ctx.variantId,
    competitionTypeId: ctx.competitionTypeId,
    profileFamilyId: profile.familyId,
    profileId: profile.id,
    profileVersion: profile.version,
    values: resolved,
    runtimeBinding: profile.runtimeBinding,
    provenance: {
      layersApplied,
      overridesApplied: {
        tournament: !!ctx.tournamentOverrides?.values,
        match: !!ctx.matchOverrides?.values,
      },
    },
    snapshotHash,
    resolvedAt,
  };

  const warnings = issues.filter((i) => i.severity === "WARNING");
  return {
    snapshot,
    validation: issues,
    warnings,
    summary: {
      profileLabel: profile.displayName,
      profileStatus: profile.status,
      valueCount: resolved.length,
      errorCount: issues.filter((i) => i.severity === "ERROR").length,
      warningCount: warnings.length,
      infoCount: issues.filter((i) => i.severity === "INFO").length,
      runtimeBindingType: profile.runtimeBinding.runtimeBindingType,
      runtimeBindingId: profile.runtimeBinding.runtimeBindingId,
    },
    snapshotHash,
  };
}

export function resolveResultOk(result: ResolveResult): boolean {
  return result.validation.every((i) => i.severity !== "ERROR");
}
