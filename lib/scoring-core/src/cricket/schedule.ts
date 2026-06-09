export type ScheduledFixture = {
  homeTeamId: number;
  awayTeamId: number;
  roundName: string;
  roundIndex: number;
  bracketRound?: number;
  bracketSlot?: number;
  groupName?: string;
};

/** Single round-robin (circle method). Each team plays every other once. */
export function generateRoundRobinSchedule(teamIds: number[]): ScheduledFixture[] {
  if (teamIds.length < 2) return [];

  const teams = [...teamIds];
  const hasBye = teams.length % 2 === 1;
  if (hasBye) teams.push(-1);

  const n = teams.length;
  const rounds = n - 1;
  const out: ScheduledFixture[] = [];
  let rotation = [...teams];

  for (let round = 0; round < rounds; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = rotation[i]!;
      const away = rotation[n - 1 - i]!;
      if (home === -1 || away === -1) continue;
      const homeTeamId = round % 2 === 0 ? home : away;
      const awayTeamId = round % 2 === 0 ? away : home;
      out.push({
        homeTeamId,
        awayTeamId,
        roundName: `Round ${round + 1}`,
        roundIndex: round,
      });
    }
    rotation = [rotation[0]!, rotation[n - 1]!, ...rotation.slice(1, n - 1)];
  }

  return out;
}

/** Standard seeded knockout bracket (power-of-2 with byes for top seeds). */
export function generateKnockoutSchedule(teamIds: number[]): ScheduledFixture[] {
  if (teamIds.length < 2) return [];

  const bracketSize = 2 ** Math.ceil(Math.log2(teamIds.length));
  const slots: Array<number | null> = teamIds.map((id) => id);
  while (slots.length < bracketSize) slots.push(null);

  const out: ScheduledFixture[] = [];
  let roundIndex = 0;
  let size = bracketSize;

  while (size >= 2) {
    const roundName =
      size === 2
        ? "Final"
        : size === 4
          ? "Semi Final"
          : size === 8
            ? "Quarter Final"
            : `Round of ${size}`;
    for (let i = 0; i < size; i += 2) {
      const slot = i / 2;
      const home = slots[i] ?? null;
      const away = slots[i + 1] ?? null;
      if (home != null && away != null) {
        out.push({
          homeTeamId: home,
          awayTeamId: away,
          roundName,
          roundIndex,
          bracketRound: roundIndex,
          bracketSlot: slot,
        });
      }
    }
    size /= 2;
    roundIndex++;
    slots.length = size;
    for (let i = 0; i < size; i++) slots[i] = null;
  }

  return out;
}

export function generateGroupStageSchedules(
  groups: Array<{ name: string; teamIds: number[] }>,
): ScheduledFixture[] {
  const out: ScheduledFixture[] = [];
  for (const group of groups) {
    const fixtures = generateRoundRobinSchedule(group.teamIds);
    for (const f of fixtures) {
      out.push({
        ...f,
        roundName: `${group.name} — ${f.roundName}`,
        groupName: group.name,
      });
    }
  }
  return out;
}

export function distributeMatchDates(
  fixtures: ScheduledFixture[],
  startDateIso: string,
  matchesPerDay: number,
): Array<ScheduledFixture & { scheduledAt: string }> {
  const start = new Date(startDateIso);
  return fixtures.map((f, index) => {
    const dayOffset = Math.floor(index / Math.max(1, matchesPerDay));
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(14, 0, 0, 0);
    return { ...f, scheduledAt: d.toISOString() };
  });
}
