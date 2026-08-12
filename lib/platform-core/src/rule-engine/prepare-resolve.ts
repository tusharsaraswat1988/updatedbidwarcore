/**
 * Assemble RuleEngineInput for Runtime Prepare — caller-side only.
 * Forbidden: DB loads inside Rule Engine. Parts must already be resolved.
 */

import { CatalogRegistry } from "../catalog/registry.ts";
import type { ConcreteRuleValue } from "../catalog/types.ts";
import type { RuntimeSnapshot } from "../runtime-match/types.ts";
import { buildRuleResolutionContextFromParts } from "./context-builder.ts";
import { overrideDocKey } from "./hash.ts";
import type { RuleEngineInput, RuleOverrideDocument } from "./types.ts";
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

export type PrepareTournamentRuleOverrides = {
  values: Readonly<Record<string, ConcreteRuleValue>>;
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
 * Optional tournamentOverrides attach the EPIC-09 tournament_override layer.
 */
export function buildPrepareRuleEngineInput(
  snapshot: RuntimeSnapshot,
  bindings: ReturnType<typeof resolvePrepareCatalogBindings>,
  tournamentOverrides?: PrepareTournamentRuleOverrides | null,
): RuleEngineInput {
  const hasOverrides =
    tournamentOverrides?.values && Object.keys(tournamentOverrides.values).length > 0;

  const overrideDocuments: Record<string, RuleOverrideDocument> | undefined = hasOverrides
    ? {
        [overrideDocKey("__inline_tournament__", "1.0.0")]: {
          values: tournamentOverrides!.values,
        },
      }
    : undefined;

  const context = buildRuleResolutionContextFromParts({
    sportId: bindings.sportId,
    variantId: bindings.variantId,
    competitionTypeId: bindings.competitionTypeId,
    ruleProfile: {
      id: bindings.ruleProfileId,
      version: bindings.ruleProfileVersion,
    },
    profileFamilyId: bindings.ruleProfileId,
    tournamentOverrideRef: hasOverrides
      ? { id: "__inline_tournament__", version: "1.0.0" }
      : undefined,
    resolutionMode: "PREPARE",
  });

  return {
    inputVersion: RULE_ENGINE_INPUT_VERSION,
    snapshot,
    context,
    overrideDocuments,
    // PREPARE auto-compiles; explicit for clarity at the sole cutover site.
    compile: true,
  };
}
