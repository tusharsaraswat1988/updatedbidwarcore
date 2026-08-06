import { computeResolutionId, computeRulesHash } from "../hash.ts";
import type {
  ResolutionStageResult,
  ResolvedRuntimeRules,
  RuleEngineInput,
} from "../types.ts";
import {
  RUNTIME_RULES_SCHEMA_VERSION,
  RUNTIME_RULES_VERSION,
} from "../versions.ts";

/**
 * Compilation Stage — irreversible.
 * Strips provenance / inheritance; emits self-contained executable rules.
 */
export function compileStage(
  input: RuleEngineInput,
  resolution: ResolutionStageResult,
): ResolvedRuntimeRules | null {
  if (!resolution.ok || !resolution.snapshot) return null;

  const rules = [...resolution.snapshot.values]
    .map((v) => ({
      definitionId: v.definitionId,
      definitionVersion: v.definitionVersion,
      value: v.resolvedValue,
    }))
    .sort((a, b) => a.definitionId.localeCompare(b.definitionId));

  const effective = {
    enabledDefinitions: resolution.enabledDefinitions,
    disabledDefinitions: resolution.disabledDefinitions,
    forcedValues: resolution.forcedValues,
    disabledByDependencies: resolution.disabledByDependencies,
    disabledByConflicts: resolution.disabledByConflicts,
  };

  const rulesHash = computeRulesHash({
    sportId: resolution.snapshot.sportId,
    variantId: resolution.snapshot.variantId,
    competitionTypeId: resolution.snapshot.competitionTypeId ?? input.context.competitionTypeId,
    rules,
    effective,
  });

  const resolutionId = computeResolutionId({ rulesHash, engineInput: input });

  return Object.freeze({
    schemaVersion: RUNTIME_RULES_SCHEMA_VERSION,
    runtimeRulesVersion: RUNTIME_RULES_VERSION,
    rulesHash,
    resolutionId,
    sportId: resolution.snapshot.sportId,
    variantId: resolution.snapshot.variantId,
    competitionTypeId:
      resolution.snapshot.competitionTypeId ?? input.context.competitionTypeId,
    rules: Object.freeze(rules),
    effective: Object.freeze({
      enabledDefinitions: Object.freeze([...effective.enabledDefinitions]),
      disabledDefinitions: Object.freeze([...effective.disabledDefinitions]),
      forcedValues: Object.freeze([...effective.forcedValues]),
      disabledByDependencies: Object.freeze([...effective.disabledByDependencies]),
      disabledByConflicts: Object.freeze([...effective.disabledByConflicts]),
    }),
  });
}

/** Should Compilation run for this input? */
export function shouldCompile(input: RuleEngineInput, resolutionOk: boolean): boolean {
  if (!resolutionOk) return false;
  if (typeof input.compile === "boolean") return input.compile;
  const mode = input.context.resolutionMode;
  if (mode === "PREVIEW" || mode === "VALIDATE" || mode === "MIGRATION") return false;
  return mode === "CREATE" || mode === "PREPARE" || mode === "MATCH_START";
}
