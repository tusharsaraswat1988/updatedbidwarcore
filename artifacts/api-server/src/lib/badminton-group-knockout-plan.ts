/**
 * Group stage + knockout planning (no DB) — Sprint 4 / S4-01.
 * RR within groups, then empty KO bracket for group winners.
 */

import {
  planKnockoutBracket,
  type PlannedKnockoutFixture,
  type PlannedKnockoutRound,
} from "./badminton-knockout-plan";
import {
  planRoundRobin,
  splitIntoGroups,
  type PlannedRrFixture,
  type PlannedRrPlan,
} from "./badminton-round-robin-plan";

export type GroupQualifierRef = {
  groupId: string;
  label: string;
  rank: number;
};

export type PlannedGroupStage = {
  groupId: string;
  label: string;
  registrationIds: number[];
  plan: PlannedRrPlan;
};

export type PlannedKoFixtureWithQualifier = PlannedKnockoutFixture & {
  qualifierMeta?: {
    A?: GroupQualifierRef;
    B?: GroupQualifierRef;
  };
};

export type PlannedKoRoundWithQualifier = Omit<PlannedKnockoutRound, "fixtures"> & {
  fixtures: PlannedKoFixtureWithQualifier[];
};

export type PlannedGroupKnockout = {
  groups: PlannedGroupStage[];
  /** Qualifiers that feed the KO (one per group by default). */
  qualifiers: GroupQualifierRef[];
  knockout: PlannedKoRoundWithQualifier[];
};

export type GroupKnockoutOptions = {
  /** Preferred number of groups (default 4, clamped). */
  groupCount?: number;
  /** Alternative: target size per group → derives groupCount. */
  groupSize?: number;
  /** How many advance from each group (default 1). */
  qualifyPerGroup?: number;
};

/**
 * Split entries into groups, plan RR inside each, then plan a KO bracket
 * sized to the number of qualifiers. KO R1 sides are TBD (null IDs) —
 * filled later when group winners are known.
 */
export function planGroupKnockout(
  registrationIds: number[],
  options?: GroupKnockoutOptions,
): PlannedGroupKnockout {
  const groups = splitIntoGroups(registrationIds, {
    groupCount: options?.groupCount,
    groupSize: options?.groupSize,
  });

  const qualifyPerGroup = Math.max(1, options?.qualifyPerGroup ?? 1);
  const groupStages: PlannedGroupStage[] = groups.map((g) => ({
    groupId: g.groupId,
    label: g.label,
    registrationIds: g.registrationIds,
    plan:
      g.registrationIds.length >= 2
        ? planRoundRobin(g.registrationIds)
        : { totalRounds: 0, fixtures: [] as PlannedRrFixture[], byeByRound: [] },
  }));

  const qualifiers: GroupQualifierRef[] = [];
  for (const g of groupStages) {
    for (let rank = 1; rank <= qualifyPerGroup; rank++) {
      qualifiers.push({ groupId: g.groupId, label: g.label, rank });
    }
  }

  // Build KO with placeholder IDs, then clear them so fixtures stay TBD.
  const placeholderRegs = qualifiers.map((_, i) => ({
    id: -(i + 1),
    seedNumber: i + 1,
  }));

  const rawKnockout =
    placeholderRegs.length >= 2 ? planKnockoutBracket(placeholderRegs) : [];

  const knockout: PlannedKoRoundWithQualifier[] = rawKnockout.map((round, roundIdx) => {
    const fixtures: PlannedKoFixtureWithQualifier[] = round.fixtures.map((f) => ({
      ...f,
      registrationAId: null,
      registrationBId: null,
      status: "unscheduled",
    }));

    // Annotate R1 with which group qualifier each side awaits.
    if (roundIdx === 0 && qualifiers.length > 0) {
      const bracketSize = fixtures.length * 2;
      const slots: Array<number | null> = [];
      for (let i = 0; i < qualifiers.length; i++) slots.push(-(i + 1));
      while (slots.length < bracketSize) slots.push(null);

      for (let i = 0; i < fixtures.length; i++) {
        const aSlot = slots[i * 2] ?? null;
        const bSlot = slots[i * 2 + 1] ?? null;
        const aQ =
          aSlot != null && aSlot < 0 ? qualifiers[-aSlot - 1] : undefined;
        const bQ =
          bSlot != null && bSlot < 0 ? qualifiers[-bSlot - 1] : undefined;
        const fixture = fixtures[i]!;
        if ((aQ && !bQ) || (!aQ && bQ)) {
          fixture.status = "walkover";
        }
        fixture.qualifierMeta = {
          ...(aQ ? { A: aQ } : {}),
          ...(bQ ? { B: bQ } : {}),
        };
      }
    }

    return {
      roundNumber: round.roundNumber,
      roundName: round.roundName,
      fixtures,
    };
  });

  return { groups: groupStages, qualifiers, knockout };
}
