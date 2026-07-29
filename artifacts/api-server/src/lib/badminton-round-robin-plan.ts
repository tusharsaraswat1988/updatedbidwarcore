/**
 * Pure round-robin planning (no DB) — Sprint 4 / S4-01.
 * Circle method adapted from cricket schedule helpers (domain-agnostic).
 */

export type PlannedRrFixture = {
  slotNumber: number;
  registrationAId: number;
  registrationBId: number;
  status: string;
  /** 0-based round index within the RR. */
  roundIndex: number;
  roundName: string;
};

export type PlannedRrPlan = {
  /** Total RR rounds (n-1 for even n; n for odd n with byes). */
  totalRounds: number;
  fixtures: PlannedRrFixture[];
  /** Registration IDs that receive a bye each round (odd N only). Empty when even. */
  byeByRound: Array<{ roundIndex: number; registrationId: number }>;
};

const BYE = -1;

/**
 * Single round-robin: each pair meets exactly once.
 * Odd N uses a phantom bye so every player sits out one match per full rotation.
 * Bye pairings are omitted from the fixture list (no walkover rows).
 */
export function planRoundRobin(registrationIds: number[]): PlannedRrPlan {
  if (registrationIds.length < 2) {
    return { totalRounds: 0, fixtures: [], byeByRound: [] };
  }

  const teams = [...registrationIds];
  const hasBye = teams.length % 2 === 1;
  if (hasBye) teams.push(BYE);

  const n = teams.length;
  const rounds = n - 1;
  const fixtures: PlannedRrFixture[] = [];
  const byeByRound: Array<{ roundIndex: number; registrationId: number }> = [];
  let rotation = [...teams];
  let slotNumber = 1;

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = rotation[i]!;
      const away = rotation[n - 1 - i]!;
      if (home === BYE || away === BYE) {
        const real = home === BYE ? away : home;
        if (real !== BYE) {
          byeByRound.push({ roundIndex: round, registrationId: real });
        }
        continue;
      }
      // Alternate home/away across rounds for balance (same as cricket circle method).
      const a = round % 2 === 0 ? home : away;
      const b = round % 2 === 0 ? away : home;
      fixtures.push({
        slotNumber: slotNumber++,
        registrationAId: a,
        registrationBId: b,
        status: "unscheduled",
        roundIndex: round,
        roundName: `Round ${round + 1}`,
      });
    }
    rotation = [rotation[0]!, rotation[n - 1]!, ...rotation.slice(1, n - 1)];
  }

  return { totalRounds: rounds, fixtures, byeByRound };
}

/** Unique unordered pair keys for validation / tests. */
export function rrPairKey(a: number, b: number): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/**
 * Split entries into `groupCount` groups as evenly as possible.
 * When `groupSize` is set, groupCount = ceil(n / groupSize).
 */
export function splitIntoGroups(
  registrationIds: number[],
  options?: { groupCount?: number; groupSize?: number },
): Array<{ groupId: string; label: string; registrationIds: number[] }> {
  const n = registrationIds.length;
  if (n === 0) return [];

  let groupCount: number;
  if (options?.groupSize != null && options.groupSize > 0) {
    groupCount = Math.max(1, Math.ceil(n / options.groupSize));
  } else if (options?.groupCount != null && options.groupCount > 0) {
    groupCount = Math.min(options.groupCount, n);
  } else {
    // Default: up to 4 groups, but never more groups than players.
    groupCount = Math.min(4, n);
  }

  // Prefer at least 2 per group when possible (except tiny fields).
  while (groupCount > 1 && Math.floor(n / groupCount) < 2) {
    groupCount -= 1;
  }

  const groups: Array<{ groupId: string; label: string; registrationIds: number[] }> = [];
  for (let i = 0; i < groupCount; i++) {
    const letter = String.fromCharCode(65 + i); // A, B, C, …
    groups.push({
      groupId: letter,
      label: `Group ${letter}`,
      registrationIds: [],
    });
  }

  // Round-robin deal keeps order/seeds balanced across groups.
  const ordered = [...registrationIds];
  for (let i = 0; i < ordered.length; i++) {
    groups[i % groupCount]!.registrationIds.push(ordered[i]!);
  }

  return groups.filter((grp) => grp.registrationIds.length > 0);
}
