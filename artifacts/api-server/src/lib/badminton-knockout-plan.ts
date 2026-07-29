/**
 * Pure knockout bracket planning (no DB) — Sprint 1 / C5.
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
 * Build a full single-elimination bracket with progression links.
 * Round 1 has players; later rounds have TBD slots linked via advancesToRoundSlot.
 */
export function planKnockoutBracket(
  registrations: Array<{ id: number; seedNumber: number | null }>,
): PlannedKnockoutRound[] {
  const seeds = registrations
    .filter((r) => r.seedNumber !== null)
    .sort((a, b) => (a.seedNumber ?? 99) - (b.seedNumber ?? 99));
  const unseeded = registrations
    .filter((r) => r.seedNumber === null)
    .sort(() => Math.random() - 0.5);

  const ordered = [...seeds, ...unseeded];
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(ordered.length, 2))));
  const totalRounds = Math.log2(bracketSize);
  const slots: Array<number | null> = ordered
    .map((r) => r.id)
    .concat(Array(bracketSize - ordered.length).fill(null));

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
