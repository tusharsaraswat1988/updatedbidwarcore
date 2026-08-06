import type {
  ConcretePresentationValue,
  PresentationCapabilityProfileEntry,
  PresentationProfileCatalogEntry,
} from "../catalog/types.ts";
import type { FrozenRef, RuntimeSnapshot } from "../runtime-match/types.ts";

export type {
  ConcretePresentationValue,
  FrozenRef,
  RuntimeSnapshot,
  PresentationCapabilityProfileEntry,
};

export type EngineIssueKind = "invalid" | "unresolvable" | "warning" | "info";

export type EngineIssue = {
  kind: EngineIssueKind;
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
  path?: string;
  origin?: string;
};

export type PresentationResolutionMode =
  | "PREVIEW"
  | "VALIDATE"
  | "CREATE"
  | "PREPARE"
  | "MATCH_START"
  | "MIGRATION";

export type CompilationMode = "NONE" | "AUTO" | "REQUIRED";

export type PresentationResolveLayerId =
  | "platform"
  | "sport"
  | "variant"
  | "profile"
  | "competition_override"
  | "tournament_override"
  | "match_override";

export type PresentationResolutionContext = {
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  readonly matchTypeId?: string;
  readonly presentationProfile: FrozenRef;
  readonly ruleProfile?: FrozenRef;
  readonly tournamentOverrideRef?: FrozenRef;
  readonly competitionOverrideRef?: FrozenRef;
  readonly matchOverrideRef?: FrozenRef;
  readonly resolutionMode: PresentationResolutionMode;
};

export type PresentationOverrideDocument = {
  readonly values: Readonly<Record<string, ConcretePresentationValue>>;
};

export type PresentationEngineInput = {
  readonly inputVersion: string;
  readonly snapshot: RuntimeSnapshot | null;
  readonly context: PresentationResolutionContext;
  readonly compilationMode?: CompilationMode;
  readonly overrideDocuments?: Readonly<Record<string, PresentationOverrideDocument>>;
};

export type FeatureState = {
  readonly featureId: string;
  readonly state: "enabled" | "disabled" | "forced";
  readonly reasonCode?: string;
  readonly reasonPath?: string;
  readonly resolvedBy?: string;
};

export type SlotState = {
  readonly slotId: string;
  readonly regionId: string;
  readonly occupied: boolean;
  readonly featureId: string | null;
  readonly reason?: string;
};

export type ResolvedToken = {
  readonly tokenId: string;
  readonly definitionVersion: string;
  readonly value: ConcretePresentationValue;
};

export type ResolvedStyle = {
  readonly styleId: string;
  readonly definitionVersion: string;
  readonly tokenBindings: readonly { readonly tokenId: string }[];
};

export type PresentationRegionNode = {
  readonly regionId: string;
  readonly styleId: string | null;
  readonly slotIds: readonly string[];
};

export type PresentationRegionEdge = {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
};

export type PresentationRegionGraph = {
  readonly nodes: readonly PresentationRegionNode[];
  readonly edges: readonly PresentationRegionEdge[];
};

export type GraphReport = {
  readonly nodes: readonly { readonly id: string }[];
  readonly edges: readonly { readonly from: string; readonly to: string }[];
  readonly topologicalOrder: readonly string[];
  readonly graphHash: string;
  readonly results: readonly {
    readonly from: string;
    readonly to: string;
    readonly status: "satisfied" | "unsatisfied" | "cycle" | "dangling";
  }[];
};

export type ResolvedPresentationSnapshot = {
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  readonly matchTypeId?: string;
  readonly profileFamilyId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly values: readonly {
    readonly definitionId: string;
    readonly definitionVersion: string;
    readonly resolvedValue: ConcretePresentationValue;
    readonly resolvedFromLayer: PresentationResolveLayerId;
  }[];
  readonly provenance: {
    readonly layersApplied: readonly PresentationResolveLayerId[];
    readonly overridesApplied: {
      readonly competition: boolean;
      readonly tournament: boolean;
      readonly match: boolean;
    };
  };
  readonly snapshotHash: string;
  readonly resolvedAt: string;
};

export type ResolvedPresentationContract = {
  readonly schemaVersion: string;
  readonly presentationContractVersion: string;
  readonly semanticHash: string;
  readonly resolutionId: string;
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  readonly matchTypeId?: string;
  readonly tokens: readonly ResolvedToken[];
  readonly styles: readonly ResolvedStyle[];
  readonly features: readonly FeatureState[];
  readonly slots: readonly SlotState[];
  readonly regions: PresentationRegionGraph;
  readonly layoutGraph: GraphReport;
  readonly styleGraph: GraphReport;
};

export type AdaptedPresentationContract = ResolvedPresentationContract & {
  readonly adaptationHash: string;
  readonly disabledByCapability: readonly string[];
};

export type StageId =
  | "input"
  | "compatibility"
  | "structural"
  | "resolution"
  | "semantic_compilation"
  | "capability_adaptation";

export type StageResult = {
  readonly stage: StageId;
  readonly started: boolean;
  readonly completed: boolean;
  readonly success: boolean;
  readonly warnings: readonly EngineIssue[];
  readonly errors: readonly EngineIssue[];
  readonly durationMs?: number;
};

export type CompilationReport = {
  readonly compiled: boolean;
  readonly compilerVersion: string;
  readonly contractVersion: string;
  readonly semanticHash: string | null;
  readonly durationMs?: number;
  readonly warnings: readonly EngineIssue[];
};

export type PresentationEngineDiagnostics = {
  readonly stages: readonly StageResult[];
  readonly issues: readonly EngineIssue[];
  readonly layoutGraph: GraphReport | null;
  readonly styleGraph: GraphReport | null;
  readonly compatible: boolean;
};

export type PresentationEngineResult = {
  readonly ok: boolean;
  readonly resolutionId: string | null;
  readonly engineVersion: string;
  readonly schemaVersion: string;
  readonly inputVersion: string;
  readonly contractVersion: string | null;
  readonly resolvedPresentationSnapshot: ResolvedPresentationSnapshot | null;
  readonly resolvedPresentationContract: ResolvedPresentationContract | null;
  readonly stages: readonly StageResult[];
  readonly compilation: CompilationReport | null;
  readonly diagnostics: PresentationEngineDiagnostics;
  readonly durationMs?: number;
};

export type CapabilityCompilerResult = {
  readonly ok: boolean;
  readonly adaptedPresentationContract: AdaptedPresentationContract | null;
  readonly adaptationHash: string | null;
  readonly stages: readonly StageResult[];
  readonly diagnostics: { readonly issues: readonly EngineIssue[] };
  readonly durationMs?: number;
  readonly engineVersion: string;
  readonly schemaVersion: string;
  readonly contractVersion: string | null;
};

export type { PresentationProfileCatalogEntry };
