import {
  aggregateTournamentPlayerStats,
  derivedCricketStats,
  type CricketCareerStats,
  type PlayerMatchAppearance,
  type PlayerMatchStatsInput,
} from "./leaderboard";

/**
 * Canonical cricket statistics projection.
 *
 * The scorecard ledger is the source of truth. Tournament and career totals
 * are a pure function of that ledger plus the current identity map. Replacing
 * a match's rows and projecting again replaces the contribution. It never
 * adds the match on top of a previous total.
 */

export type PlayerIdentityResolution =
  | { status: "resolved"; masterPlayerId: string }
  | { status: "unresolved" }
  | { status: "ambiguous"; masterPlayerIds: string[] };

export type AssignmentSnapshot = {
  tournamentId: number;
  opaquePlayerId: number;
  masterPlayerId: string;
  isActive: boolean;
  assignedAtMs: number;
};

export type CanonicalLedgerRow = PlayerMatchStatsInput & {
  tournamentId: number;
};

export type MatchAppearance = PlayerMatchAppearance & {
  tournamentId: number;
};

export type ScopedCricketAggregate = {
  masterPlayerId: string;
  tournamentId: number | null;
  stats: CricketCareerStats;
};

export type StoredStatisticRow = {
  id: number;
  playerId: string;
  sport: string;
  tournamentId: number | null;
  matchesPlayed: number;
};

export type StatisticUpsert = {
  playerId: string;
  sport: "cricket";
  tournamentId: number | null;
  matchesPlayed: number;
  pointsScored: number;
  stats: CricketCareerStats;
};

export type StatisticWritePlan = {
  upserts: StatisticUpsert[];
  deleteIds: number[];
  /** Opaque players skipped because identity was missing or pointed at more than one person. */
  excluded: Array<{
    tournamentId: number;
    opaquePlayerId: number;
    status: "unresolved" | "ambiguous";
    masterPlayerIds?: string[];
  }>;
};

export function identityKey(tournamentId: number, opaquePlayerId: number): string {
  return `${tournamentId}:${opaquePlayerId}`;
}

/**
 * Latest active assignment wins. Two active assignments to different people
 * are ambiguous and are not attributed. With no active row, a single historical
 * person is used. Historical rows that disagree are also ambiguous.
 */
export function resolveOpaquePlayerIdentities(
  assignments: AssignmentSnapshot[],
): Map<string, PlayerIdentityResolution> {
  const grouped = new Map<string, AssignmentSnapshot[]>();
  for (const assignment of assignments) {
    if (!Number.isInteger(assignment.opaquePlayerId) || assignment.opaquePlayerId <= 0) continue;
    if (!assignment.masterPlayerId) continue;
    const key = identityKey(assignment.tournamentId, assignment.opaquePlayerId);
    const rows = grouped.get(key) ?? [];
    rows.push(assignment);
    grouped.set(key, rows);
  }

  const resolved = new Map<string, PlayerIdentityResolution>();
  for (const [key, rows] of grouped) {
    const active = rows.filter((row) => row.isActive);
    const pool = active.length > 0 ? active : rows;
    const masters = [...new Set(pool.map((row) => row.masterPlayerId))];
    if (masters.length > 1) {
      resolved.set(key, { status: "ambiguous", masterPlayerIds: masters.sort() });
      continue;
    }
    const latest = [...pool].sort((a, b) => b.assignedAtMs - a.assignedAtMs)[0];
    if (!latest) {
      resolved.set(key, { status: "unresolved" });
      continue;
    }
    resolved.set(key, { status: "resolved", masterPlayerId: latest.masterPlayerId });
  }
  return resolved;
}

const SYNTHETIC_PLAYER_ID = 1;

function remap(row: PlayerMatchStatsInput): PlayerMatchStatsInput {
  return { ...row, playerId: SYNTHETIC_PLAYER_ID };
}

/**
 * Build tournament and career totals for every resolved player.
 * Unresolved and ambiguous scorecard rows are reported and omitted.
 */
export function buildCanonicalCricketAggregates(input: {
  ledger: CanonicalLedgerRow[];
  appearances?: MatchAppearance[];
  identities: Map<string, PlayerIdentityResolution>;
}): { scoped: ScopedCricketAggregate[]; excluded: StatisticWritePlan["excluded"] } {
  const excluded: StatisticWritePlan["excluded"] = [];
  const seenExcluded = new Set<string>();

  function noteExcluded(
    tournamentId: number,
    opaquePlayerId: number,
    resolution: PlayerIdentityResolution | undefined,
  ) {
    const key = identityKey(tournamentId, opaquePlayerId);
    if (seenExcluded.has(key)) return;
    seenExcluded.add(key);
    if (!resolution || resolution.status === "unresolved") {
      excluded.push({ tournamentId, opaquePlayerId, status: "unresolved" });
      return;
    }
    if (resolution.status === "ambiguous") {
      excluded.push({
        tournamentId,
        opaquePlayerId,
        status: "ambiguous",
        masterPlayerIds: resolution.masterPlayerIds,
      });
    }
  }

  const byMaster = new Map<
    string,
    {
      careerRows: PlayerMatchStatsInput[];
      careerAppearances: PlayerMatchAppearance[];
      tournaments: Map<
        number,
        { rows: PlayerMatchStatsInput[]; appearances: PlayerMatchAppearance[] }
      >;
    }
  >();

  function bucket(masterPlayerId: string, tournamentId: number) {
    let master = byMaster.get(masterPlayerId);
    if (!master) {
      master = { careerRows: [], careerAppearances: [], tournaments: new Map() };
      byMaster.set(masterPlayerId, master);
    }
    let tournament = master.tournaments.get(tournamentId);
    if (!tournament) {
      tournament = { rows: [], appearances: [] };
      master.tournaments.set(tournamentId, tournament);
    }
    return { master, tournament };
  }

  for (const row of input.ledger) {
    const resolution = input.identities.get(identityKey(row.tournamentId, row.playerId));
    if (!resolution || resolution.status !== "resolved") {
      noteExcluded(row.tournamentId, row.playerId, resolution);
      continue;
    }
    const { master, tournament } = bucket(resolution.masterPlayerId, row.tournamentId);
    const remapped = remap(row);
    master.careerRows.push(remapped);
    tournament.rows.push(remapped);
  }

  for (const appearance of input.appearances ?? []) {
    const resolution = input.identities.get(
      identityKey(appearance.tournamentId, appearance.playerId),
    );
    if (!resolution || resolution.status !== "resolved") {
      noteExcluded(appearance.tournamentId, appearance.playerId, resolution);
      continue;
    }
    const { master, tournament } = bucket(resolution.masterPlayerId, appearance.tournamentId);
    const remapped = { ...appearance, playerId: SYNTHETIC_PLAYER_ID };
    master.careerAppearances.push(remapped);
    tournament.appearances.push(remapped);
  }

  const scoped: ScopedCricketAggregate[] = [];
  for (const [masterPlayerId, master] of byMaster) {
    const career = aggregateTournamentPlayerStats(master.careerRows, {
      appearances: master.careerAppearances,
    }).get(SYNTHETIC_PLAYER_ID);
    if (career && career.matches > 0) {
      scoped.push({
        masterPlayerId,
        tournamentId: null,
        stats: derivedCricketStats(career),
      });
    }
    for (const [tournamentId, tournament] of master.tournaments) {
      const aggregate = aggregateTournamentPlayerStats(tournament.rows, {
        appearances: tournament.appearances,
      }).get(SYNTHETIC_PLAYER_ID);
      if (!aggregate || aggregate.matches <= 0) continue;
      scoped.push({
        masterPlayerId,
        tournamentId,
        stats: derivedCricketStats(aggregate),
      });
    }
  }

  scoped.sort((a, b) => {
    const player = a.masterPlayerId.localeCompare(b.masterPlayerId);
    if (player !== 0) return player;
    return (a.tournamentId ?? -1) - (b.tournamentId ?? -1);
  });

  return { scoped, excluded };
}

function scopeKey(playerId: string, tournamentId: number | null): string {
  return tournamentId == null ? `${playerId}:career` : `${playerId}:tournament:${tournamentId}`;
}

function isEmptyBaseline(row: StoredStatisticRow): boolean {
  return row.tournamentId != null && row.matchesPlayed <= 0;
}

/**
 * Diff the desired cricket projection against stored rows.
 * Non-cricket rows are never deleted. Empty tournament baselines with no
 * matches are kept so roster setup is not wiped. Cricket rows for players
 * who no longer have a contribution are deleted.
 *
 * Pass `affectedMasterIds` for an incremental refresh. Omit it to reconcile
 * every cricket row.
 */
export function planCricketStatisticWrites(input: {
  existing: StoredStatisticRow[];
  scoped: ScopedCricketAggregate[];
  affectedMasterIds?: string[];
}): StatisticWritePlan {
  const affected = input.affectedMasterIds ? new Set(input.affectedMasterIds) : null;
  const desired = new Map<string, ScopedCricketAggregate>();
  for (const scope of input.scoped) {
    if (affected && !affected.has(scope.masterPlayerId)) continue;
    desired.set(scopeKey(scope.masterPlayerId, scope.tournamentId), scope);
  }

  const upserts: StatisticUpsert[] = [...desired.values()].map((scope) => ({
    playerId: scope.masterPlayerId,
    sport: "cricket" as const,
    tournamentId: scope.tournamentId,
    matchesPlayed: scope.stats.matches,
    pointsScored: scope.stats.runs,
    stats: scope.stats,
  }));

  const deleteIds: number[] = [];
  const keptScope = new Set<string>();
  for (const row of input.existing) {
    if (row.sport !== "cricket") continue;
    if (affected && !affected.has(row.playerId)) continue;
    const key = scopeKey(row.playerId, row.tournamentId);
    if (!desired.has(key)) {
      if (!isEmptyBaseline(row)) deleteIds.push(row.id);
      continue;
    }
    // Postgres treats NULL tournament ids as distinct, so career rows can
    // already be duplicated. Keep one row and delete the rest.
    if (keptScope.has(key)) {
      deleteIds.push(row.id);
      continue;
    }
    keptScope.add(key);
  }

  return { upserts, deleteIds, excluded: [] };
}

/**
 * Masters whose cricket cache must be rewritten after one match changes.
 * Includes the current scorecard, the current playing XI, the previous
 * attribution stored on the ledger, and anyone who already has a tournament
 * cache row. The last group is what drops a player who left the XI.
 */
export function mastersToRefreshForMatch(input: {
  tournamentId: number;
  assignments: AssignmentSnapshot[];
  previousMasterIds: Array<string | null | undefined>;
  ledgerOpaqueIds: number[];
  playingXiIds: number[];
  cachedMasterIds: string[];
}): string[] {
  const opaqueIds = new Set<number>();
  for (const id of [...input.ledgerOpaqueIds, ...input.playingXiIds]) {
    if (Number.isInteger(id) && id > 0) opaqueIds.add(id);
  }
  const masters = new Set<string>();
  for (const id of [...input.previousMasterIds, ...input.cachedMasterIds]) {
    if (id) masters.add(id);
  }
  for (const row of input.assignments) {
    if (row.tournamentId !== input.tournamentId || !opaqueIds.has(row.opaquePlayerId)) continue;
    if (row.masterPlayerId) masters.add(row.masterPlayerId);
  }
  return [...masters].sort();
}

export function applyStatisticPlan(
  existing: StoredStatisticRow[],
  plan: Pick<StatisticWritePlan, "upserts" | "deleteIds">,
): StoredStatisticRow[] {
  const deleted = new Set(plan.deleteIds);
  const next = existing.filter((row) => !deleted.has(row.id));
  for (const upsert of plan.upserts) {
    const index = next.findIndex(
      (row) =>
        row.playerId === upsert.playerId &&
        row.sport === upsert.sport &&
        row.tournamentId === upsert.tournamentId,
    );
    if (index >= 0) {
      next[index] = {
        ...next[index]!,
        matchesPlayed: upsert.matchesPlayed,
      };
      continue;
    }
    const id = next.reduce((max, row) => Math.max(max, row.id), 0) + 1;
    next.push({
      id,
      playerId: upsert.playerId,
      sport: upsert.sport,
      tournamentId: upsert.tournamentId,
      matchesPlayed: upsert.matchesPlayed,
    });
  }
  return next;
}
