import type { ConcreteRuleValue, DeclarativeRuntimeBinding } from "../types.ts";

export type ResolutionMode =
  | "PREVIEW"
  | "CREATE"
  | "PREPARE"
  | "MATCH_START"
  | "VALIDATE"
  | "MIGRATION";

export type ResolveLayerId =
  | "platform"
  | "sport"
  | "variant"
  | "profile"
  | "competition_override"
  | "tournament_override"
  | "match_override";

export type ValidationIssueOrigin =
  | "definition"
  | "profile"
  | "override"
  | "dependency"
  | "conflictPolicy"
  | "snapshot"
  | "context"
  | "catalog"
  | "engine";

export type TournamentRuleOverrides = {
  values?: Readonly<Record<string, ConcreteRuleValue>>;
};

export type MatchRuleOverrides = {
  values?: Readonly<Record<string, ConcreteRuleValue>>;
};

export type ResolveContext = {
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  readonly profileFamilyId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly tournamentOverrides?: TournamentRuleOverrides;
  readonly matchOverrides?: MatchRuleOverrides;
  readonly resolutionMode: ResolutionMode;
};

export type ValidationSeverity = "ERROR" | "WARNING" | "INFO";

export type ValidationIssue = {
  severity: ValidationSeverity;
  code: string;
  message: string;
  path?: string;
  origin?: ValidationIssueOrigin;
};

export type ResolvedRuleEntry = {
  definitionId: string;
  definitionVersion: string;
  resolvedValue: ConcreteRuleValue;
  resolvedFromLayer: ResolveLayerId;
  resolvedFromProfile: {
    familyId: string;
    profileId: string;
    profileVersion: string;
  } | null;
};

export type ResolvedRuleSnapshot = {
  sportId: string;
  variantId: string;
  competitionTypeId?: string;
  profileFamilyId: string;
  profileId: string;
  profileVersion: string;
  values: readonly ResolvedRuleEntry[];
  runtimeBinding: DeclarativeRuntimeBinding;
    provenance: {
      layersApplied: readonly ResolveLayerId[];
      overridesApplied: {
        competition: boolean;
        tournament: boolean;
        match: boolean;
      };
    };
  snapshotHash: string;
  resolvedAt: string;
};

export type ResolveSummary = {
  profileLabel: string;
  profileStatus: string;
  valueCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  runtimeBindingType: string;
  runtimeBindingId: string;
};

export type ResolveResult = {
  snapshot: ResolvedRuleSnapshot;
  validation: ValidationIssue[];
  warnings: ValidationIssue[];
  summary: ResolveSummary;
  snapshotHash: string;
};
