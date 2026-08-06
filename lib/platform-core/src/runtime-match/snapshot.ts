import type {
  FrozenRef,
  RuntimeSnapshot,
  RuntimeSnapshotReferences,
} from "./types.ts";
import { RUNTIME_SNAPSHOT_SCHEMA_VERSION } from "./types.ts";

export type SnapshotRefInput = {
  ruleProfileId?: string | null;
  ruleProfileVersion?: number | string | null;
  presentationProfileId?: string | null;
  presentationProfileVersion?: number | string | null;
  competitionId?: string | null;
  competitionVersion?: number | string | null;
  fixtureId?: string | null;
  fixtureVersion?: number | string | null;
  fixtureNodeId?: string | null;
  matchBlueprintId?: string | null;
  schedulingPlanId?: string | null;
  schedulingVersion?: number | string | null;
  scheduleSlotId?: string | null;
  resourceAssignmentIds?: readonly { id: string; version?: number | string | null }[];
  sideIds?: readonly { id: string; version?: number | string | null }[];
  officialIds?: readonly { id: string; version?: number | string | null }[];
  matchConfigurationVersion?: number | null;
  matchId: string;
};

function ref(id: string | null | undefined, version: number | string | null | undefined): FrozenRef | null {
  if (!id) return null;
  return { id, version: version ?? null };
}

export function buildSnapshotReferences(input: SnapshotRefInput): RuntimeSnapshotReferences {
  return {
    ruleProfile: ref(input.ruleProfileId, input.ruleProfileVersion),
    presentationProfile: ref(input.presentationProfileId, input.presentationProfileVersion),
    competition: ref(input.competitionId, input.competitionVersion),
    fixture: ref(input.fixtureId, input.fixtureVersion),
    fixtureNode: ref(input.fixtureNodeId, null),
    matchBlueprint: ref(input.matchBlueprintId, null),
    schedulingPlan: ref(input.schedulingPlanId, input.schedulingVersion),
    scheduleSlot: ref(input.scheduleSlotId, null),
    resourceAssignments: (input.resourceAssignmentIds ?? []).map((r) => ({
      id: r.id,
      version: r.version ?? null,
    })),
    sides: (input.sideIds ?? []).map((r) => ({
      id: r.id,
      version: r.version ?? null,
    })),
    officials: (input.officialIds ?? []).map((r) => ({
      id: r.id,
      version: r.version ?? null,
    })),
    matchConfiguration: input.matchConfigurationVersion != null
      ? { id: input.matchId, version: input.matchConfigurationVersion }
      : null,
  };
}

export function buildRuntimeSnapshot(args: {
  matchId: string;
  tournamentId: number;
  snapshotVersion: number;
  createdAt: string;
  createdBy: string | null;
  references: RuntimeSnapshotReferences;
}): RuntimeSnapshot {
  return {
    matchId: args.matchId,
    tournamentId: args.tournamentId,
    snapshotVersion: args.snapshotVersion,
    snapshotSchemaVersion: RUNTIME_SNAPSHOT_SCHEMA_VERSION,
    createdAt: args.createdAt,
    createdBy: args.createdBy,
    references: args.references,
  };
}

/** Snapshots are immutable — never mutate; callers must allocate a new version. */
export function assertSnapshotImmutable(_snapshot: RuntimeSnapshot): void {
  // Documented invariant for call sites / tests. No in-place mutation APIs exist.
}
