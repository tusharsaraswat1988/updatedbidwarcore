import { RULE_PROFILE_CATALOG } from "../rules/index.ts";
import { RuleEngine } from "../../rule-engine/engine.ts";
import { overrideDocKey } from "../../rule-engine/hash.ts";
import type { RuleEngineInput, RuleOverrideDocument } from "../../rule-engine/types.ts";
import { RULE_ENGINE_INPUT_VERSION } from "../../rule-engine/versions.ts";
import type {
  ResolveContext,
  ResolveLayerId,
  ResolveResult,
  ResolvedRuleEntry,
  ValidationIssue,
} from "./types.ts";

function lookupProfile(id: string, version: string) {
  return RULE_PROFILE_CATALOG.find((p) => p.id === id && p.version === version) ?? null;
}

/**
 * Map EPIC-02 ResolveContext → RuleEngineInput.
 * CatalogRegistry owns discovery; Rule Engine owns computation.
 * Preview/validate façades force mode — every path calls RuleEngine.resolve().
 */
export function resolveContextToEngineInput(
  ctx: ResolveContext,
  mode: "PREVIEW" | "VALIDATE",
): RuleEngineInput {
  const overrideDocuments: Record<string, RuleOverrideDocument> = {};
  let tournamentOverrideRef: { id: string; version: string } | undefined;
  let matchOverrideRef: { id: string; version: string } | undefined;

  if (ctx.tournamentOverrides?.values) {
    tournamentOverrideRef = { id: "__inline_tournament__", version: "1.0.0" };
    overrideDocuments[overrideDocKey("__inline_tournament__", "1.0.0")] = {
      values: ctx.tournamentOverrides.values,
    };
  }
  if (ctx.matchOverrides?.values) {
    matchOverrideRef = { id: "__inline_match__", version: "1.0.0" };
    overrideDocuments[overrideDocKey("__inline_match__", "1.0.0")] = {
      values: ctx.matchOverrides.values,
    };
  }

  return {
    inputVersion: RULE_ENGINE_INPUT_VERSION,
    snapshot: null,
    context: {
      sportId: ctx.sportId,
      variantId: ctx.variantId,
      competitionTypeId: ctx.competitionTypeId,
      ruleProfile: { id: ctx.profileId, version: ctx.profileVersion },
      profileFamilyId: ctx.profileFamilyId,
      tournamentOverrideRef,
      matchOverrideRef,
      resolutionMode: mode,
    },
    overrideDocuments,
    compile: false,
  };
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
      overridesApplied: { competition: false, tournament: false, match: false },
    },
    snapshotHash: "invalid",
    resolvedAt: "1970-01-01T00:00:00.000Z",
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
 * EPIC-02 façade — permanently delegates computation to RuleEngine.resolve().
 * Organizer preview/validate always use PREVIEW/VALIDATE modes (forced).
 */
export function resolveRuleProfile(ctx: ResolveContext): ResolveResult {
  const mode =
    ctx.resolutionMode === "VALIDATE" || ctx.resolutionMode === "MIGRATION"
      ? "VALIDATE"
      : "PREVIEW";

  const engineResult = RuleEngine.resolve(resolveContextToEngineInput(ctx, mode));
  const issues = [
    ...engineResult.diagnostics.validation.structural,
    ...engineResult.diagnostics.validation.semantic,
  ];

  if (!engineResult.resolvedRuleSnapshot) {
    return emptySnapshot(ctx, issues);
  }

  const snapshot = engineResult.resolvedRuleSnapshot;
  const warnings = issues.filter((i) => i.severity === "WARNING");
  const profile = lookupProfile(snapshot.profileId, snapshot.profileVersion);
  return {
    snapshot,
    validation: issues,
    warnings,
    summary: {
      profileLabel: profile?.displayName ?? snapshot.profileId,
      profileStatus: profile?.status ?? "unknown",
      valueCount: snapshot.values.length,
      errorCount: issues.filter((i) => i.severity === "ERROR").length,
      warningCount: warnings.length,
      infoCount: issues.filter((i) => i.severity === "INFO").length,
      runtimeBindingType: snapshot.runtimeBinding.runtimeBindingType,
      runtimeBindingId: snapshot.runtimeBinding.runtimeBindingId,
    },
    snapshotHash: snapshot.snapshotHash,
  };
}

export function resolveResultOk(result: ResolveResult): boolean {
  return result.validation.every((i) => i.severity !== "ERROR");
}
