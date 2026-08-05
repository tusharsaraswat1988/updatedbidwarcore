import type {
  ConcreteRuleValue,
  ResolveLayerId,
  ResolvedRuleSnapshot,
  ValidationIssue,
  ValidationIssueOrigin,
} from "../catalog/resolve/types.ts";
import type { FrozenRef, RuntimeSnapshot } from "../runtime-match/types.ts";

export type {
  ConcreteRuleValue,
  ResolveLayerId,
  ResolvedRuleSnapshot,
  ValidationIssue,
  ValidationIssueOrigin,
  FrozenRef,
  RuntimeSnapshot,
};

export type RuleResolutionMode =
  | "PREVIEW"
  | "VALIDATE"
  | "CREATE"
  | "PREPARE"
  | "MATCH_START"
  | "MIGRATION";

export type RuleResolutionContext = {
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  readonly ruleProfile: FrozenRef;
  /** Defaults to ruleProfile.id when omitted. */
  readonly profileFamilyId?: string;
  readonly tournamentOverrideRef?: FrozenRef;
  readonly competitionOverrideRef?: FrozenRef;
  readonly matchOverrideRef?: FrozenRef;
  readonly resolutionMode: RuleResolutionMode;
};

export type RuleOverrideDocument = {
  readonly values: Readonly<Record<string, ConcreteRuleValue>>;
};

export type RuleEngineInput = {
  readonly inputVersion: string;
  readonly snapshot: RuntimeSnapshot | null;
  readonly context: RuleResolutionContext;
  /** Overrides mode default compilation behaviour when set. */
  readonly compile?: boolean;
  /** Documents keyed by `${id}@${version}` — foundation until override store exists. */
  readonly overrideDocuments?: Readonly<Record<string, RuleOverrideDocument>>;
};

export type ExecutableRule = {
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly value: ConcreteRuleValue;
};

export type ForcedValueEntry = {
  readonly definitionId: string;
  readonly value: ConcreteRuleValue;
};

export type ResolvedRuntimeRulesEffective = {
  readonly enabledDefinitions: readonly string[];
  readonly disabledDefinitions: readonly string[];
  readonly forcedValues: readonly ForcedValueEntry[];
  readonly disabledByDependencies: readonly string[];
  readonly disabledByConflicts: readonly string[];
};

export type ResolvedRuntimeRules = {
  readonly schemaVersion: string;
  readonly runtimeRulesVersion: string;
  readonly rulesHash: string;
  readonly resolutionId: string;
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  readonly rules: readonly ExecutableRule[];
  readonly effective: ResolvedRuntimeRulesEffective;
};

export type ConflictStrategyId =
  | "FAIL"
  | "DISABLE_LEFT"
  | "DISABLE_RIGHT"
  | "DISABLE_DEPENDENT"
  | "FORCE_VALUE"
  | "PREFER_LAYER";

export type ConflictPolicy = {
  readonly conflictPolicyId: string;
  readonly version: string;
  readonly priority: number;
  readonly strategy: ConflictStrategyId;
  /** Normalized undirected pair (sorted). */
  readonly pair: readonly [string, string];
  readonly forceValue?: ConcreteRuleValue;
  readonly forceDefinitionId?: string;
};

export type ConflictEffect = {
  readonly definitionId: string;
  readonly effect: "disable" | "force_value" | "error";
  readonly value?: ConcreteRuleValue;
};

export type ConflictOutcome = {
  readonly conflictId: string;
  readonly conflictPolicyId: string;
  readonly version: string;
  readonly strategy: ConflictStrategyId;
  readonly participants: readonly string[];
  readonly effects: readonly ConflictEffect[];
};

export type ResolutionReport = {
  readonly resolutionId: string | null;
  readonly engineVersion: string;
  readonly stagesCompleted: readonly ("verification" | "resolution" | "compilation")[];
  readonly layersApplied: readonly ResolveLayerId[];
  readonly overridesApplied: {
    readonly competition: boolean;
    readonly tournament: boolean;
    readonly match: boolean;
  };
  readonly compiled: boolean;
  readonly ok: boolean;
};

export type ValidationReport = {
  readonly structural: readonly ValidationIssue[];
  readonly semantic: readonly ValidationIssue[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly infoCount: number;
};

export type DependencyReport = {
  readonly nodes: readonly { readonly definitionId: string }[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly results: readonly {
    readonly definitionId: string;
    readonly dependsOn: string;
    readonly status: "satisfied" | "unsatisfied" | "cycle" | "dangling";
  }[];
  readonly topologicalOrder: readonly string[];
};

export type ConflictReport = {
  readonly policiesApplied: readonly {
    readonly conflictPolicyId: string;
    readonly version: string;
    readonly priority: number;
    readonly strategy: ConflictStrategyId;
  }[];
  readonly outcomes: readonly ConflictOutcome[];
};

export type CompatibilityReport = {
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly issues: readonly ValidationIssue[];
  readonly compatible: boolean;
};

export type RuleEngineDiagnostics = {
  readonly resolution: ResolutionReport;
  readonly validation: ValidationReport;
  readonly dependency: DependencyReport;
  readonly conflict: ConflictReport;
  readonly compatibility: CompatibilityReport;
};

export type RuleEngineResult = {
  readonly ok: boolean;
  readonly resolutionId: string | null;
  readonly engineVersion: string;
  readonly resolvedRuleSnapshot: ResolvedRuleSnapshot | null;
  readonly resolvedRuntimeRules: ResolvedRuntimeRules | null;
  readonly diagnostics: RuleEngineDiagnostics;
  readonly durationMs?: number;
};

export type VerificationStageResult = {
  readonly ok: boolean;
  readonly structural: readonly ValidationIssue[];
  readonly profileFamilyId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly shouldLoadCatalog: boolean;
};

export type ResolutionStageResult = {
  readonly ok: boolean;
  readonly snapshot: ResolvedRuleSnapshot | null;
  readonly semantic: readonly ValidationIssue[];
  readonly structuralPassthrough: readonly ValidationIssue[];
  readonly dependency: DependencyReport;
  readonly conflict: ConflictReport;
  readonly compatibility: CompatibilityReport;
  readonly layersApplied: readonly ResolveLayerId[];
  readonly overridesApplied: ResolutionReport["overridesApplied"];
  readonly disabledByDependencies: readonly string[];
  readonly disabledByConflicts: readonly string[];
  readonly forcedValues: readonly ForcedValueEntry[];
  readonly enabledDefinitions: readonly string[];
  readonly disabledDefinitions: readonly string[];
};
