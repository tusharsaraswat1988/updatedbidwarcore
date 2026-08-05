import { ASSET_EPOCH } from "../types.ts";
import type {
  ConcretePresentationValue,
  PresentationDefinitionEntry,
  PresentationDefinitionKind,
  PresentationProfileCatalogEntry,
  PresentationProfileValueEntry,
  PresentationValueType,
  RuleDefinitionValidation,
} from "../types.ts";

export function pdef(input: {
  id: string;
  kind: PresentationDefinitionKind;
  name: string;
  description: string;
  sportId?: string;
  type: PresentationValueType;
  defaultValue: ConcretePresentationValue;
  allowedValues?: readonly ConcretePresentationValue[];
  validation?: RuleDefinitionValidation;
  tokenIds?: readonly string[];
  featureId?: string;
  regionId?: string;
  styleId?: string;
  dependencies?: readonly string[];
  conflicts?: readonly string[];
  futureCompatible?: boolean;
  status?: PresentationDefinitionEntry["status"];
  version?: string;
}): PresentationDefinitionEntry {
  return {
    id: input.id,
    version: input.version ?? "1.0.0",
    status: input.status ?? "active",
    kind: input.kind,
    name: input.name,
    description: input.description,
    sportId: input.sportId ?? "*",
    type: input.type,
    defaultValue: input.defaultValue,
    allowedValues: input.allowedValues,
    validation: input.validation,
    tokenIds: input.tokenIds,
    featureId: input.featureId,
    regionId: input.regionId,
    styleId: input.styleId,
    dependencies: input.dependencies,
    conflicts: input.conflicts,
    futureCompatible: input.futureCompatible ?? true,
    createdAt: ASSET_EPOCH,
    updatedAt: ASSET_EPOCH,
  };
}

export function pvalue(
  definitionId: string,
  concrete: ConcretePresentationValue | "inherit",
  definitionVersion = "1.0.0",
): PresentationProfileValueEntry {
  return { definitionId, definitionVersion, value: concrete };
}

export function presentationProfile(input: {
  id: string;
  sportId: string;
  displayName: string;
  description: string;
  supportedCompetitionTypes: readonly string[];
  supportedVariants: readonly string[];
  values: readonly PresentationProfileValueEntry[];
  status?: PresentationProfileCatalogEntry["status"];
  recommendation?: PresentationProfileCatalogEntry["recommendation"];
  tags?: readonly string[];
  compatibleRuleProfileIds?: readonly string[];
  supportedMatchTypes?: readonly string[];
  preview?: Record<string, unknown>;
  version?: string;
  familyId?: string;
}): PresentationProfileCatalogEntry {
  return {
    kind: "presentation_profile",
    id: input.id,
    version: input.version ?? "1.0.0",
    sportId: input.sportId,
    familyId: input.familyId ?? input.id,
    displayName: input.displayName,
    description: input.description,
    supportedCompetitionTypes: input.supportedCompetitionTypes,
    supportedVariants: input.supportedVariants,
    status: input.status ?? "active",
    recommendation: input.recommendation,
    tags: input.tags ?? [],
    author: "platform",
    createdAt: ASSET_EPOCH,
    updatedAt: ASSET_EPOCH,
    values: input.values,
    compatibleRuleProfileIds: input.compatibleRuleProfileIds ?? ["*"],
    supportedMatchTypes: input.supportedMatchTypes ?? ["*"],
    preview: input.preview,
  };
}
