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
