/**
 * Assemble RuleEngineInput for Runtime Prepare — caller-side only.
 * Forbidden: DB loads inside Rule Engine. Parts must already be resolved.
 */

import { CatalogRegistry } from "../catalog/registry.ts";
import type { RuntimeSnapshot } from "../runtime-match/types.ts";
import { buildRuleResolutionContextFromParts } from "./context-builder.ts";
import type { RuleEngineInput } from "./types.ts";
import { RULE_ENGINE_INPUT_VERSION } from "./versions.ts";

export type PrepareResolveBindings = {
  sportId: string;
  variantId: string | null | undefined;
  competitionTypeId: string | null | undefined;
  ruleProfileId: string | null | undefined;
  ruleProfileVersion: string | null | undefined;
  presentationProfileId?: string | null | undefined;
  presentationProfileVersion?: string | null | undefined;
};

/**
 * Resolve tournament catalog columns (incl. legacy) into concrete bindings
 * suitable for Snapshot refs + RuleResolutionContext.
 */
export function resolvePrepareCatalogBindings(row: PrepareResolveBindings) {
  return CatalogRegistry.resolveLegacyBindings({
    sport: row.sportId,
    variantId: row.variantId,
    competitionTypeId: row.competitionTypeId,
    ruleProfileId: row.ruleProfileId,
    ruleProfileVersion: row.ruleProfileVersion,
    presentationProfileId: row.presentationProfileId,
    presentationProfileVersion: row.presentationProfileVersion,
  });
}

/**
 * Build RuleEngineInput for PREPARE against an already-built Runtime Snapshot.
 * Snapshot ruleProfile ref MUST match context.ruleProfile (verified by engine).
 */
export function buildPrepareRuleEngineInput(
  snapshot: RuntimeSnapshot,
  bindings: ReturnType<typeof resolvePrepareCatalogBindings>,
): RuleEngineInput {
  const context = buildRuleResolutionContextFromParts({
    sportId: bindings.sportId,
    variantId: bindings.variantId,
    competitionTypeId: bindings.competitionTypeId,
    ruleProfile: {
      id: bindings.ruleProfileId,
      version: bindings.ruleProfileVersion,
    },
    profileFamilyId: bindings.ruleProfileId,
    resolutionMode: "PREPARE",
  });

  return {
    inputVersion: RULE_ENGINE_INPUT_VERSION,
    snapshot,
    context,
    // PREPARE auto-compiles; explicit for clarity at the sole cutover site.
    compile: true,
  };
}
