import {
  ASSET_EPOCH,
  type CatalogRecommendation,
  type CatalogStatus,
  type DeclarativeRuntimeBinding,
  type RuleProfileCatalogEntry,
  type RuleProfileValueEntry,
} from "../types.ts";

export function ruleProfile(input: {
  id: string;
  familyId?: string;
  version?: string;
  sportId: string;
  displayName: string;
  description: string;
  supportedCompetitionTypes: readonly string[];
  supportedVariants: readonly string[];
  status?: CatalogStatus;
  recommendation?: CatalogRecommendation;
  tags?: readonly string[];
  author?: string;
  values: readonly RuleProfileValueEntry[];
  runtimeBinding: DeclarativeRuntimeBinding;
}): RuleProfileCatalogEntry {
  const familyId = input.familyId ?? input.id;
  return {
    kind: "rule_profile",
    id: input.id,
    familyId,
    version: input.version ?? "1.0.0",
    sportId: input.sportId,
    displayName: input.displayName,
    description: input.description,
    supportedCompetitionTypes: input.supportedCompetitionTypes,
    supportedVariants: input.supportedVariants,
    status: input.status ?? "active",
    recommendation: input.recommendation,
    tags: input.tags ?? [],
    author: input.author ?? "platform",
    createdAt: ASSET_EPOCH,
    updatedAt: ASSET_EPOCH,
    values: input.values,
    runtimeBinding: input.runtimeBinding,
  };
}
