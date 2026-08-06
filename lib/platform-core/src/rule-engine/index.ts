/**
 * EPIC-09 Rule Engine — public surface.
 * CatalogRegistry owns discovery; Rule Engine owns computation.
 */

export { RuleEngine, resolve, preview, validate, ruleEngineResultOk } from "./engine.ts";
export { buildRuleResolutionContextFromParts } from "./context-builder.ts";
export type { RuleResolutionContextParts } from "./context-builder.ts";
export {
  RULE_ENGINE_VERSION,
  RULE_ENGINE_INPUT_VERSION,
  RUNTIME_RULES_VERSION,
  RUNTIME_RULES_SCHEMA_VERSION,
} from "./versions.ts";

export type {
  RuleEngineInput,
  RuleEngineResult,
  RuleEngineDiagnostics,
  RuleResolutionContext,
  RuleResolutionMode,
  ResolvedRuntimeRules,
  ExecutableRule,
  RuleOverrideDocument,
  ConflictPolicy,
  ConflictStrategyId,
  ConflictOutcome,
  ResolutionReport,
  ValidationReport,
  DependencyReport,
  ConflictReport,
  CompatibilityReport,
} from "./types.ts";
