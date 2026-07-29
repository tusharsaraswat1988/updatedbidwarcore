/**
 * Minimal RR / group standings from completed fixtures — Sprint 4 / S4-01.
 * Pure helper (no DB). Wins/losses from winnerRegistrationId on completed rows.
 */

export type StandingsFixtureInput = {
  registrationAId: number | null;
  registrationBId: number | null;
  winnerRegistrationId?: number | null;
  status: string;
  /** Optional group key when fixtures are tagged via collection.groupId. */
  groupId?: string | null;
};

export type StandingsRow = {
  registrationId: number;
  played: number;
  wins: number;
  losses: number;
  /** Win percentage 0–100, or null when played === 0. */
  winPct: number | null;
};

export type GroupStandings = {
  groupId: string | null;
  rows: StandingsRow[];
};

function isCompletedStatus(status: string): boolean {
  return status === "completed" || status === "walkover";
}

/**
 * Compute W-L standings for a set of fixtures (typically one RR category or group).
 * Only completed / walkover fixtures with a winner count.
 */
export function computeRoundRobinStandings(
  fixtures: StandingsFixtureInput[],
  registrationIds?: number[],
): StandingsRow[] {
  const stats = new Map<number, { played: number; wins: number; losses: number }>();

  const ensure = (id: number) => {
    if (!stats.has(id)) stats.set(id, { played: 0, wins: 0, losses: 0 });
    return stats.get(id)!;
  };

  if (registrationIds) {
    for (const id of registrationIds) ensure(id);
  }

  for (const f of fixtures) {
    if (!isCompletedStatus(f.status)) continue;
    const a = f.registrationAId;
    const b = f.registrationBId;
    const winner = f.winnerRegistrationId;
    if (a == null || b == null || winner == null) continue;
    if (winner !== a && winner !== b) continue;

    const loser = winner === a ? b : a;
    const w = ensure(winner);
    const l = ensure(loser);
    w.played += 1;
    w.wins += 1;
    l.played += 1;
    l.losses += 1;
  }

  const rows: StandingsRow[] = [...stats.entries()].map(([registrationId, s]) => ({
    registrationId,
    played: s.played,
    wins: s.wins,
    losses: s.losses,
    winPct: s.played > 0 ? Math.round((s.wins / s.played) * 1000) / 10 : null,
  }));

  rows.sort(
    (x, y) =>
      y.wins - x.wins ||
      x.losses - y.losses ||
      y.played - x.played ||
      x.registrationId - y.registrationId,
  );

  return rows;
}

/**
 * Group fixtures by groupId and compute standings per group.
 * Fixtures without groupId land in a single `null` bucket (full RR).
 */
export function computeGroupedStandings(
  fixtures: StandingsFixtureInput[],
): GroupStandings[] {
  const byGroup = new Map<string | null, StandingsFixtureInput[]>();
  for (const f of fixtures) {
    const key = f.groupId ?? null;
    const list = byGroup.get(key) ?? [];
    list.push(f);
    byGroup.set(key, list);
  }

  const out: GroupStandings[] = [];
  for (const [groupId, list] of byGroup) {
    out.push({ groupId, rows: computeRoundRobinStandings(list) });
  }

  out.sort((a, b) => {
    if (a.groupId == null) return 1;
    if (b.groupId == null) return -1;
    return a.groupId.localeCompare(b.groupId);
  });

  return out;
}
