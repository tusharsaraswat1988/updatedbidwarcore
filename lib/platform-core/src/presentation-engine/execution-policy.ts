/**
 * PresentationExecutionPolicy — runtime-facing presentation contract.
 *
 * Derived once at Runtime Prepare from ResolvedPresentationContract.
 * NOT a second Presentation Engine, Presentation Profile, or Snapshot.
 * Authority remains ResolvedPresentationContract; this is the runtime face.
 */

import type {
  FeatureState,
  ResolvedPresentationContract,
  ResolvedToken,
  SlotState,
} from "./types.ts";

export const PRESENTATION_EXECUTION_POLICY_SCHEMA_VERSION = "1.0.0";

export type PresentationExecutionToken = {
  readonly tokenId: string;
  readonly value: string | number | boolean | null;
};

export type PresentationExecutionFeature = {
  readonly featureId: string;
  readonly state: FeatureState["state"];
};

export type PresentationExecutionSlot = {
  readonly slotId: string;
  readonly regionId: string;
  readonly occupied: boolean;
  readonly featureId: string | null;
};

/**
 * Runtime-facing presentation contract bound for one Prepare cycle.
 * Identity fields pin ResolvedPresentationContract without embedding bodies on Snapshot.
 */
export type PresentationExecutionPolicy = {
  readonly schemaVersion: string;
  readonly presentationResolutionId: string;
  readonly presentationHash: string;
  readonly presentationVersion: string;
  readonly sportId: string;
  readonly variantId: string;
  readonly competitionTypeId: string;
  readonly tokens: readonly PresentationExecutionToken[];
  readonly features: readonly PresentationExecutionFeature[];
  readonly slots: readonly PresentationExecutionSlot[];
};

function tokenValue(token: ResolvedToken): string | number | boolean | null {
  const v = token.value;
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
    return v;
  }
  return String(v);
}

function mapSlots(slots: readonly SlotState[]): readonly PresentationExecutionSlot[] {
  return Object.freeze(
    slots.map((s) =>
      Object.freeze({
        slotId: s.slotId,
        regionId: s.regionId,
        occupied: s.occupied,
        featureId: s.featureId,
      }),
    ),
  );
}

/**
 * Derive PresentationExecutionPolicy from compiled ResolvedPresentationContract.
 * Pure — no I/O, no CatalogRegistry, no Snapshot mutation.
 */
export function buildPresentationExecutionPolicy(
  contract: ResolvedPresentationContract,
): PresentationExecutionPolicy {
  return Object.freeze({
    schemaVersion: PRESENTATION_EXECUTION_POLICY_SCHEMA_VERSION,
    presentationResolutionId: contract.resolutionId,
    presentationHash: contract.semanticHash,
    presentationVersion: contract.presentationContractVersion,
    sportId: contract.sportId,
    variantId: contract.variantId,
    competitionTypeId: contract.competitionTypeId,
    tokens: Object.freeze(
      contract.tokens.map((t) =>
        Object.freeze({
          tokenId: t.tokenId,
          value: tokenValue(t),
        }),
      ),
    ),
    features: Object.freeze(
      contract.features.map((f) =>
        Object.freeze({
          featureId: f.featureId,
          state: f.state,
        }),
      ),
    ),
    slots: mapSlots(contract.slots),
  });
}
