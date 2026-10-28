/**
 * Pure knockout bracket planning (no DB) — BWF-compliant Seeding and Progression.
 */

export type PlannedKnockoutFixture = {
  slotNumber: number;
  registrationAId: number | null;
  registrationBId: number | null;
  status: string;
  /** Temp key linking this fixture to a next-round slot before IDs exist. */
  advancesToRoundSlot?: { roundNumber: number; slotNumber: number; as: "A" | "B" } | null;
};

export type PlannedKnockoutRound = {
  roundNumber: number;
  roundName: string;
  fixtures: PlannedKnockoutFixture[];
};

export type PlanKnockoutOptions = {
  /** Optional seed for reproducible draws (number or string). */
  randomSeed?: number | string;
  /** If true, unseeded entrants are placed deterministically by ID ascending. */
  deterministic?: boolean;
};

const ROUND_NAMES: Record<number, string> = {
  1: "Final",
  2: "Semi-Finals",
  4: "Quarter-Finals",
  8: "Round of 16",
  16: "Round of 32",
  32: "Round of 64",
};

export function knockoutRoundName(
  fixturesInRound: number,
  roundNumber: number,
  totalRounds: number,
): string {
  const known = ROUND_NAMES[fixturesInRound];
  if (known) return known;
  if (roundNumber === totalRounds) return "Final";
  return `Round ${roundNumber}`;
}

/**
 * Generate canonical BWF seed placement line order for a bracket of size N (N = 2^k).
 * E.g. for N=4 -> [1, 4, 3, 2] (Match 1: 1 vs 4, Match 2: 3 vs 2)
 * for N=8 -> [1, 8, 5, 4, 3, 6, 7, 2]
 * Seed 1 is at Line 0 (top half).
 * Seed 2 is at Line N-1 (bottom half).
 * Seeds 3 and 4 occupy balanced quarters in opposite halves.
 */
export function getCanonicalSeedOrder(bracketSize: number): number[] {
  if (bracketSize <= 1) return [1];
  let order = [1, 2];
  while (order.length < bracketSize) {
    const nextSize = order.length * 2;
    const nextOrder: number[] = [];
    for (let i = 0; i < order.length; i++) {
      if (i % 2 === 0) {
        nextOrder.push(order[i]!);
        nextOrder.push(nextSize + 1 - order[i]!);
      } else {
        nextOrder.push(nextSize + 1 - order[i]!);
        nextOrder.push(order[i]!);
      }
    }
    order = nextOrder;
  }
  return order;
}

function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
}

/**
 * Build a full single-elimination bracket with progression links.
 * Seed 1 and Seed 2 are strictly in opposite halves.
 * Non-power-of-two byes oppose the highest seeds so that no null-vs-null match is created.
 */
export function planKnockoutBracket(
  registrations: Array<{ id: number; seedNumber: number | null }>,
  options?: PlanKnockoutOptions,
): PlannedKnockoutRound[] {
  if (!registrations || registrations.length < 2) {
    throw new Error("Knockout bracket requires at least 2 entrants");
  }

  // 1. Validate seeds
  const seenSeeds = new Set<number>();
  for (const r of registrations) {
    if (r.seedNumber != null) {
      if (r.seedNumber < 1 || !Number.isInteger(r.seedNumber)) {
        throw new Error(`Invalid seed number: ${r.seedNumber}. Must be a positive integer.`);
      }
      if (seenSeeds.has(r.seedNumber)) {
        throw new Error(`Duplicate seed number: ${r.seedNumber}. Seeds must be unique.`);
      }
      if (r.seedNumber > registrations.length) {
        throw new Error(
          `Seed number ${r.seedNumber} exceeds registration count ${registrations.length}.`,
        );
      }
      seenSeeds.add(r.seedNumber);
    }
  }

  const entrantCount = registrations.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(entrantCount, 2))));
  const totalRounds = Math.log2(bracketSize);
  const byeCount = bracketSize - entrantCount;

  const canonicalOrder = getCanonicalSeedOrder(bracketSize);

  // 2. Identify bye slots (byes oppose the top seeds 1 .. byeCount)
  // Each match m (0 <= m < bracketSize / 2) has lines 2*m and 2*m + 1.
  const isBye = new Array<boolean>(bracketSize).fill(false);
  for (let seed = 1; seed <= byeCount; seed++) {
    const lineIndex = canonicalOrder.indexOf(seed);
    if (lineIndex !== -1) {
      const opponentLine = lineIndex % 2 === 0 ? lineIndex + 1 : lineIndex - 1;
      isBye[opponentLine] = true;
    }
  }

  // 3. Place seeded entrants into their canonical slots
  const slots = new Array<number | null>(bracketSize).fill(null);
  const assignedRegIds = new Set<number>();

  const seeds = registrations
    .filter((r) => r.seedNumber !== null)
    .sort((a, b) => (a.seedNumber ?? 999) - (b.seedNumber ?? 999));

  for (const seedReg of seeds) {
    const lineIndex = canonicalOrder.indexOf(seedReg.seedNumber!);
    if (lineIndex !== -1 && !isBye[lineIndex]) {
      slots[lineIndex] = seedReg.id;
      assignedRegIds.add(seedReg.id);
    }
  }

  // 4. Collect remaining unseeded entrants
  const unseeded = registrations.filter((r) => !assignedRegIds.has(r.id));

  // Determine shuffle / sort strategy for unseeded entrants
  if (options?.deterministic) {
    unseeded.sort((a, b) => a.id - b.id);
  } else {
    const seedVal =
      options?.randomSeed != null
        ? typeof options.randomSeed === "string"
          ? stringToSeed(options.randomSeed)
          : options.randomSeed
        : registrations.reduce((acc, r) => (Math.imul(31, acc) + r.id) | 0, 98765);
    const rng = mulberry32(seedVal);
    // Fisher-Yates shuffle
    for (let i = unseeded.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const temp = unseeded[i]!;
      unseeded[i] = unseeded[j]!;
      unseeded[j] = temp;
    }
  }

  // 5. Fill remaining available lines with unseeded entrants
  let unseededIdx = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (!isBye[i] && slots[i] === null) {
      if (unseededIdx < unseeded.length) {
        slots[i] = unseeded[unseededIdx]!.id;
        unseededIdx++;
      }
    }
  }

  // 6. Build Round 1 fixtures
  const rounds: PlannedKnockoutRound[] = [];
  const r1Fixtures: PlannedKnockoutFixture[] = [];

  for (let i = 0; i < bracketSize; i += 2) {
    const slotNumber = Math.floor(i / 2) + 1;
    const a = slots[i] ?? null;
    const b = slots[i + 1] ?? null;
    const nextSlot = Math.ceil(slotNumber / 2);
    const as: "A" | "B" = slotNumber % 2 === 1 ? "A" : "B";

    r1Fixtures.push({
      slotNumber,
      registrationAId: a,
      registrationBId: b,
      status: a && b ? "unscheduled" : "walkover",
      advancesToRoundSlot:
        totalRounds > 1 ? { roundNumber: 2, slotNumber: nextSlot, as } : null,
    });
  }

  rounds.push({
    roundNumber: 1,
    roundName: knockoutRoundName(r1Fixtures.length, 1, totalRounds),
    fixtures: r1Fixtures,
  });

  // 7. Build subsequent round fixtures
  let fixturesPrev = r1Fixtures.length;
  for (let roundNumber = 2; roundNumber <= totalRounds; roundNumber++) {
    const count = fixturesPrev / 2;
    const fixtures: PlannedKnockoutFixture[] = [];
    for (let slotNumber = 1; slotNumber <= count; slotNumber++) {
      const nextSlot = Math.ceil(slotNumber / 2);
      const as: "A" | "B" = slotNumber % 2 === 1 ? "A" : "B";
      fixtures.push({
        slotNumber,
        registrationAId: null,
        registrationBId: null,
        status: "unscheduled",
        advancesToRoundSlot:
          roundNumber < totalRounds
            ? { roundNumber: roundNumber + 1, slotNumber: nextSlot, as }
            : null,
      });
    }
    rounds.push({
      roundNumber,
      roundName: knockoutRoundName(fixtures.length, roundNumber, totalRounds),
      fixtures,
    });
    fixturesPrev = count;
  }

  return rounds;
}
