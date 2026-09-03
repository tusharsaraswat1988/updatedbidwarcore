import { computeEffectiveCapacity } from "./purse-capacity";
import type { PurseProtectionInput, PurseProtectionResult } from "./purse-protection";
import { computePurseProtection } from "./purse-protection";

export type PurseFieldSnapshot = Pick<
  PurseProtectionResult,
  | "purseRemaining"
  | "reservePurse"
  | "futureReservePurse"
  | "spendablePurse"
  | "maxAllowedBid"
  | "slotsRequired"
  | "futureSlotsRequired"
  | "futurePlayersBought"
  | "playersBought"
  | "effectiveCapacity"
>;

export function expectedPurseFields(input: PurseProtectionInput): PurseFieldSnapshot {
  const effectiveCapacity = computeEffectiveCapacity(input.purse, input.boosterTotal);
  const purseRemaining = effectiveCapacity - input.purseUsed;
  const minSquad = input.minimumSquadSize;
  const minBid = input.minBid;

  if (minSquad === 0) {
    return {
      effectiveCapacity,
      purseRemaining,
      playersBought: input.playersBought,
      slotsRequired: 0,
      reservePurse: 0,
      spendablePurse: purseRemaining,
      futurePlayersBought: input.playersBought + 1,
      futureSlotsRequired: 0,
      futureReservePurse: 0,
      maxAllowedBid: purseRemaining,
    };
  }

  const slotsRequired = Math.max(0, minSquad - input.playersBought);
  const futurePlayersBought = input.playersBought + 1;
  const futureSlotsRequired = Math.max(0, minSquad - futurePlayersBought);
  const reservePurse = slotsRequired * minBid;
  const futureReservePurse = futureSlotsRequired * minBid;
  const spendablePurse =
    slotsRequired === 0 ? purseRemaining : Math.max(0, purseRemaining - reservePurse);
  const maxAllowedBid = Math.max(0, purseRemaining - futureReservePurse);

  return {
    effectiveCapacity,
    purseRemaining,
    playersBought: input.playersBought,
    slotsRequired,
    reservePurse,
    spendablePurse,
    futurePlayersBought,
    futureSlotsRequired,
    futureReservePurse,
    maxAllowedBid,
  };
}

export type PurseInvariantViolation = {
  field: string;
  expected: number;
  actual: number;
  context: string;
};

export function collectPurseProtectionViolations(
  input: PurseProtectionInput,
  actual: PurseProtectionResult,
  context = "",
): PurseInvariantViolation[] {
  const expected = expectedPurseFields(input);
  const violations: PurseInvariantViolation[] = [];
  const fields: (keyof PurseFieldSnapshot)[] = [
    "effectiveCapacity",
    "purseRemaining",
    "playersBought",
    "slotsRequired",
    "reservePurse",
    "spendablePurse",
    "futurePlayersBought",
    "futureSlotsRequired",
    "futureReservePurse",
    "maxAllowedBid",
  ];

  for (const field of fields) {
    if (actual[field] !== expected[field]) {
      violations.push({
        field,
        expected: expected[field],
        actual: actual[field],
        context,
      });
    }
  }

  if (actual.maxAllowedBid < actual.spendablePurse && input.minimumSquadSize > 0) {
    // Future reserve is always <= current reserve when buying one player.
    violations.push({
      field: "maxAllowedBid>=spendablePurse",
      expected: actual.spendablePurse,
      actual: actual.maxAllowedBid,
      context: `${context} (bid ceiling must not be below current spendable)`,
    });
  }

  if (actual.purseRemaining < 0) {
    violations.push({
      field: "purseRemaining>=0",
      expected: 0,
      actual: actual.purseRemaining,
      context,
    });
  }

  return violations;
}

export function assertPurseProtectionInvariants(
  input: PurseProtectionInput,
  actual?: PurseProtectionResult,
  context = "",
): PurseProtectionResult {
  const result = actual ?? computePurseProtection(input);
  const violations = collectPurseProtectionViolations(input, result, context);
  if (violations.length > 0) {
    const detail = violations
      .map((v) => `${v.field}: expected ${v.expected}, got ${v.actual} (${v.context})`)
      .join("\n");
    throw new Error(`Purse invariant violation(s):\n${detail}`);
  }
  return result;
}

/** Snapshot row shape used by operator, owner SSE, and LED feeds. */
export type PurseSnapshotRow = PurseFieldSnapshot & {
  teamId: number;
  purseUsed: number;
  originalPurse: number;
  boosterTotal: number;
};

export function buildSnapshotRowFromProtection(
  teamId: number,
  input: PurseProtectionInput,
  protection: PurseProtectionResult,
): PurseSnapshotRow {
  return {
    teamId,
    originalPurse: protection.originalPurse,
    boosterTotal: protection.boosterTotal,
    effectiveCapacity: protection.effectiveCapacity,
    purseUsed: input.purseUsed,
    purseRemaining: protection.purseRemaining,
    playersBought: protection.playersBought,
    slotsRequired: protection.slotsRequired,
    reservePurse: protection.reservePurse,
    spendablePurse: protection.spendablePurse,
    futurePlayersBought: protection.futurePlayersBought,
    futureSlotsRequired: protection.futureSlotsRequired,
    futureReservePurse: protection.futureReservePurse,
    maxAllowedBid: protection.maxAllowedBid,
  };
}

/** Operator / owner / LED bidding-limit display must use maxAllowedBid. */
export function uiBiddingLimit(row: PurseSnapshotRow): number {
  return row.maxAllowedBid;
}

/** Owner/Organizer reserve column must show current reservePurse, not futureReservePurse. */
export function uiReserveDisplay(row: Pick<PurseSnapshotRow, "reservePurse">): number {
  return row.reservePurse;
}

export type OwnerSquadRequirement = {
  /** Playing squad (sold + retained, excluding non-playing). Null if unknown. */
  totalInSquad: number | null;
  /** Remaining to minimum. Null when min is disabled (0) or sizes unknown. */
  minDue: number | null;
  /** Remaining to maximum. Null when max is disabled (0) or sizes unknown. */
  maxDue: number | null;
};

/**
 * Authoritative playing-squad count for Owner LiveBid remaining min/max.
 *
 * `teamPurse.playersBought` is already sold + retained (non-playing excluded).
 * Do not add `retainedCount` on top — that double-counts retained players.
 */
export function resolveOwnerPlayingSquadTotal(input: {
  /** Snapshot playing-squad count (`teamPurse.playersBought`). */
  playersBought?: number | null;
  /** Playing retained count from the roster list (NPM already excluded). */
  retainedPlayingCount?: number;
  /** Playing bought/sold count from the roster list (NPM already excluded). */
  boughtPlayingCount?: number;
  rosterLoaded?: boolean;
}): number | null {
  const snapshot = input.playersBought;
  if (snapshot != null && Number.isFinite(snapshot) && snapshot >= 0) {
    return Math.floor(snapshot);
  }
  if (input.rosterLoaded) {
    return Math.max(0, (input.retainedPlayingCount ?? 0) + (input.boughtPlayingCount ?? 0));
  }
  return null;
}

/**
 * Owner LiveBid squad summary — remaining min/max after current playing squad.
 * Does not change purse-protection / reserve / maxAllowedBid mathematics.
 */
export function resolveOwnerSquadRequirement(input: {
  minimumSquadSize?: number | null;
  maximumSquadSize?: number | null;
  /** Authoritative playing-squad count (`teamPurse.playersBought`). */
  totalInSquad?: number | null;
}): OwnerSquadRequirement {
  const total = input.totalInSquad;
  if (total == null || !Number.isFinite(total) || total < 0) {
    return { totalInSquad: null, minDue: null, maxDue: null };
  }

  const minSize = input.minimumSquadSize ?? 0;
  const maxSize = input.maximumSquadSize ?? 0;
  const safeTotal = Math.max(0, Math.floor(total));

  return {
    totalInSquad: safeTotal,
    minDue: minSize > 0 ? Math.max(0, minSize - safeTotal) : null,
    maxDue: maxSize > 0 ? Math.max(0, maxSize - safeTotal) : null,
  };
}

export function ownerSquadMinSubline(minDue: number | null): string | null {
  if (minDue == null) return null;
  if (minDue === 0) return "Minimum reached";
  return `${minDue} more needed`;
}

export function ownerSquadMaxSubline(maxDue: number | null): string | null {
  if (maxDue == null) return null;
  if (maxDue === 0) return "Squad full";
  return maxDue === 1 ? "1 slot left" : `${maxDue} slots left`;
}

/** Live snapshot row as seen by Owner/Organizer clients (0 is a valid calculated reserve). */
export type PurseSnapshotLike = {
  teamId: number;
  purseRemaining?: number;
  reservePurse?: number;
  maxAllowedBid?: number;
  spendablePurse?: number;
  slotsRequired?: number;
  futureReservePurse?: number;
  futureSlotsRequired?: number;
  purseUsed?: number;
  effectiveCapacity?: number;
  purse?: number;
  originalPurse?: number;
  boosterTotal?: number;
};

/**
 * True when the snapshot carries calculated purse-protection fields.
 * `reservePurse = 0` is a real value (minimum squad already filled) — not "missing".
 */
export function hasAuthoritativePurseFields(
  row: PurseSnapshotLike | null | undefined,
): row is PurseSnapshotLike & {
  reservePurse: number;
  maxAllowedBid: number;
  purseRemaining: number;
} {
  return (
    row != null &&
    typeof row.reservePurse === "number" &&
    typeof row.maxAllowedBid === "number" &&
    typeof row.purseRemaining === "number"
  );
}

/** Embedded auction-state purses are usable only when they carry protection fields. */
export function shouldPreferEmbeddedTeamPurses(
  embedded: PurseSnapshotLike[] | null | undefined,
): boolean {
  return Array.isArray(embedded) && embedded.length > 0 && embedded.some(hasAuthoritativePurseFields);
}

/**
 * Prefer embedded live purses when they carry protection fields; otherwise use
 * the analytics query. An empty embedded array must not hide query data.
 */
export function selectAuthoritativeTeamPurse<T extends PurseSnapshotLike>(
  teamId: number,
  embedded: T[] | null | undefined,
  queried: T[] | null | undefined,
): T | undefined {
  const embeddedRow = embedded?.find((t) => t.teamId === teamId);
  const queriedRow = queried?.find((t) => t.teamId === teamId);
  if (hasAuthoritativePurseFields(embeddedRow)) return embeddedRow;
  if (hasAuthoritativePurseFields(queriedRow)) return queriedRow;
  return embeddedRow ?? queriedRow;
}

export type OwnerLiveBidFooterPurse = {
  totalPurse: number;
  totalSpent: number;
  boosterTotal: number;
  purseRemaining: number;
  /** null = snapshot not loaded; 0 = calculated empty reserve. */
  reservePurse: number | null;
  /** null = snapshot not loaded; do not substitute purseRemaining. */
  maxAllowedBid: number | null;
};

/**
 * Owner LiveBid footer mapping. Reserve = current reservePurse.
 * Max Bid = maxAllowedBid. Missing snapshot is null, not a silent 0 / full-purse fallback.
 */
export function resolveOwnerLiveBidFooterPurse(
  teamPurse: PurseSnapshotLike | null | undefined,
  team: { purse: number; purseUsed?: number },
  override?: { totalPurse?: number; boosterTotal?: number; maxAllowedBid?: number } | null,
): OwnerLiveBidFooterPurse {
  const totalPurse = override?.totalPurse ?? teamPurse?.effectiveCapacity ?? teamPurse?.purse ?? team.purse;
  const totalSpent = teamPurse?.purseUsed ?? team.purseUsed ?? 0;
  const boosterTotal = override?.boosterTotal ?? teamPurse?.boosterTotal ?? 0;
  const derivedRemaining = Math.max(0, totalPurse - totalSpent);

  if (!hasAuthoritativePurseFields(teamPurse)) {
    return {
      totalPurse,
      totalSpent,
      boosterTotal,
      purseRemaining: derivedRemaining,
      reservePurse: null,
      maxAllowedBid: override?.maxAllowedBid ?? null,
    };
  }

  return {
    totalPurse,
    totalSpent,
    boosterTotal,
    purseRemaining: teamPurse.purseRemaining,
    reservePurse: teamPurse.reservePurse,
    maxAllowedBid: override?.maxAllowedBid ?? teamPurse.maxAllowedBid,
  };
}

/** SSE cache fingerprint — must change when bid ceiling changes. */
export function ssePurseFingerprint(rows: PurseSnapshotRow[]): string {
  return JSON.stringify(rows.map((t) => `${t.teamId}:${t.playersBought}:${t.maxAllowedBid}`));
}

/** LED team-wise card max bid column. */
export function ledMaxBidAllowed(row: PurseSnapshotRow): number {
  return row.maxAllowedBid;
}

export type SimPlayer = {
  status: "sold" | "retained";
  price: number;
  isNonPlayingMember?: boolean;
};

export type TeamSimState = {
  purse: number;
  purseUsed: number;
  boosterTotal: number;
  players: SimPlayer[];
};

export function recalcPurseUsedFromRoster(players: SimPlayer[]): number {
  return players.reduce((sum, p) => sum + p.price, 0);
}

export function countSquadPlayers(players: SimPlayer[]): number {
  return players.filter((p) => !p.isNonPlayingMember).length;
}

export function protectionFromTeamSim(
  state: TeamSimState,
  tournament: { minimumSquadSize: number; maximumSquadSize: number; minBid: number },
): PurseProtectionResult {
  return computePurseProtection({
    purse: state.purse,
    purseUsed: state.purseUsed,
    boosterTotal: state.boosterTotal,
    playersBought: countSquadPlayers(state.players),
    minimumSquadSize: tournament.minimumSquadSize,
    maximumSquadSize: tournament.maximumSquadSize,
    minBid: tournament.minBid,
  });
}
