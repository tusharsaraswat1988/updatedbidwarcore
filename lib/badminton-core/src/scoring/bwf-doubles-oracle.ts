/**
 * Independent BWF doubles service oracle.
 *
 * Used to cross-check the scoring engine — implements the same laws with
 * a separate code path from doubles-court.ts so simulation tests catch drift.
 *
 * BWF Laws referenced:
 * - Law 10.3.1  Rally point scoring
 * - Law 10.3.2  Server and receiver positions at start of game (0-0 → right court)
 * - Law 10.3.3  After rally: serving side wins → same server, partners swap on serving side
 * - Law 10.3.4  Receiving side wins → become serving side; former serving side partners swap
 * - Law 10.5    Service court determined by serving side's score (even=right, odd=left)
 * - Law 10.6    Receiver in diagonally opposite service court
 */

import type { BadmintonSide } from "../types";
import type { DoublesCourtPositionsState, SideCourtPositions } from "./types";

export type DoublesRallySnapshot = {
  leftScore: number;
  rightScore: number;
  servingSide: BadmintonSide;
  servingPlayerIndex: 0 | 1;
  receivingSide: BadmintonSide;
  receivingPlayerIndex: 0 | 1;
  courtPositions: DoublesCourtPositionsState;
};

export type BwfRuleViolation = {
  ruleId: string;
  message: string;
};

export type ServiceTransferKind =
  | "retain_same_server"
  | "transfer_to_rally_winner"
  | "initial";

function otherSide(side: BadmintonSide): BadmintonSide {
  return side === "left" ? "right" : "left";
}

function otherPlayer(index: 0 | 1): 0 | 1 {
  return index === 0 ? 1 : 0;
}

function leftCourtPlayer(pos: SideCourtPositions): 0 | 1 {
  return otherPlayer(pos.rightCourtPlayerIndex);
}

function cloneCourt(court: DoublesCourtPositionsState): DoublesCourtPositionsState {
  return {
    left: { ...court.left },
    right: { ...court.right },
  };
}

function exchangePartnersOnSide(
  court: DoublesCourtPositionsState,
  side: BadmintonSide,
): DoublesCourtPositionsState {
  const next = cloneCourt(court);
  const pos = next[side];
  next[side] = { rightCourtPlayerIndex: leftCourtPlayer(pos) };
  return next;
}

/** Which service court (left/right half) the player index occupies on a side. */
export function serviceCourtOfPlayer(
  side: BadmintonSide,
  playerIndex: 0 | 1,
  court: DoublesCourtPositionsState,
): "left" | "right" {
  const pos = court[side];
  return playerIndex === pos.rightCourtPlayerIndex ? "right" : "left";
}

/** BWF: server determined by serving side score parity. */
export function bwfServerIndexForScore(
  sideScore: number,
  positions: SideCourtPositions,
): 0 | 1 {
  const fromRightCourt = sideScore % 2 === 0;
  return fromRightCourt ? positions.rightCourtPlayerIndex : leftCourtPlayer(positions);
}

/** BWF: receiver diagonally opposite server. */
export function bwfReceiverIndexForServer(
  serverIndex: 0 | 1,
  serverPositions: SideCourtPositions,
  receiverPositions: SideCourtPositions,
): 0 | 1 {
  const serverInRight = serverIndex === serverPositions.rightCourtPlayerIndex;
  return serverInRight ? receiverPositions.rightCourtPlayerIndex : leftCourtPlayer(receiverPositions);
}

export function createInitialSnapshot(
  servingSide: BadmintonSide,
  serverPlayerIndex: 0 | 1,
  receivingSide: BadmintonSide,
  receiverPlayerIndex: 0 | 1,
): DoublesRallySnapshot {
  const court: DoublesCourtPositionsState = {
    left:
      servingSide === "left"
        ? { rightCourtPlayerIndex: serverPlayerIndex }
        : { rightCourtPlayerIndex: receiverPlayerIndex },
    right:
      servingSide === "right"
        ? { rightCourtPlayerIndex: serverPlayerIndex }
        : { rightCourtPlayerIndex: receiverPlayerIndex },
  };

  return {
    leftScore: 0,
    rightScore: 0,
    servingSide,
    servingPlayerIndex: serverPlayerIndex,
    receivingSide,
    receivingPlayerIndex: receiverPlayerIndex,
    courtPositions: court,
  };
}

/**
 * Independent reference step — applies one rally outcome using BWF laws only.
 * `servingSideBeforeRally` is who served the rally that just ended.
 */
export function bwfReferenceAfterRally(
  before: DoublesRallySnapshot,
  rallyWinner: BadmintonSide,
  servingSideBeforeRally: BadmintonSide,
): DoublesRallySnapshot {
  const leftScore = rallyWinner === "left" ? before.leftScore + 1 : before.leftScore;
  const rightScore = rallyWinner === "right" ? before.rightScore + 1 : before.rightScore;

  let court = cloneCourt(before.courtPositions);

  // BWF: partner exchange on the side that was serving when receiving side wins;
  // when serving side wins, partners on serving side also exchange (same server, alternate court).
  court = exchangePartnersOnSide(court, servingSideBeforeRally);

  const newServingSide = rallyWinner;
  const newReceivingSide = otherSide(newServingSide);
  const servingScore = newServingSide === "left" ? leftScore : rightScore;

  const servingPositions = court[newServingSide];
  const receivingPositions = court[newReceivingSide];

  const servingPlayerIndex = bwfServerIndexForScore(servingScore, servingPositions);
  const receivingPlayerIndex = bwfReceiverIndexForServer(
    servingPlayerIndex,
    servingPositions,
    receivingPositions,
  );

  return {
    leftScore,
    rightScore,
    servingSide: newServingSide,
    servingPlayerIndex,
    receivingSide: newReceivingSide,
    receivingPlayerIndex,
    courtPositions: court,
  };
}

export function classifyServiceTransfer(
  before: DoublesRallySnapshot,
  after: DoublesRallySnapshot,
  servingSideBeforeRally: BadmintonSide,
  rallyWinner: BadmintonSide,
): ServiceTransferKind {
  if (before.leftScore === 0 && before.rightScore === 0 && after.leftScore + after.rightScore === 1) {
    return rallyWinner === servingSideBeforeRally ? "retain_same_server" : "transfer_to_rally_winner";
  }
  if (rallyWinner === servingSideBeforeRally) {
    return "retain_same_server";
  }
  return "transfer_to_rally_winner";
}

/** Validate snapshot satisfies all BWF doubles service invariants. */
export function validateBwfDoublesSnapshot(snapshot: DoublesRallySnapshot): BwfRuleViolation[] {
  const violations: BwfRuleViolation[] = [];
  const {
    leftScore,
    rightScore,
    servingSide,
    servingPlayerIndex,
    receivingSide,
    receivingPlayerIndex,
    courtPositions,
  } = snapshot;

  if (leftScore < 0 || rightScore < 0) {
    violations.push({ ruleId: "10.3.1", message: "Scores cannot be negative" });
  }

  if (receivingSide !== otherSide(servingSide)) {
    violations.push({
      ruleId: "10.1.2",
      message: `Receiving side (${receivingSide}) must oppose serving side (${servingSide})`,
    });
  }

  const servingScore = servingSide === "left" ? leftScore : rightScore;
  const expectedServer = bwfServerIndexForScore(servingScore, courtPositions[servingSide]);
  if (servingPlayerIndex !== expectedServer) {
    violations.push({
      ruleId: "10.5",
      message:
        `Server P${servingPlayerIndex} on ${servingSide} at score ${servingScore} — ` +
        `expected P${expectedServer} (${servingScore % 2 === 0 ? "right" : "left"} service court)`,
    });
  }

  const serverCourt = serviceCourtOfPlayer(servingSide, servingPlayerIndex, courtPositions);
  const receiverCourt = serviceCourtOfPlayer(receivingSide, receivingPlayerIndex, courtPositions);
  const expectedReceiver = bwfReceiverIndexForServer(
    servingPlayerIndex,
    courtPositions[servingSide],
    courtPositions[receivingSide],
  );

  if (receivingPlayerIndex !== expectedReceiver) {
    violations.push({
      ruleId: "10.6",
      message:
        `Receiver P${receivingPlayerIndex} — expected P${expectedReceiver} ` +
        `(diagonal to server in ${serverCourt} court)`,
    });
  }

  // Diagonal: server right → receiver right; server left → receiver left
  if (serverCourt !== receiverCourt) {
    violations.push({
      ruleId: "10.6",
      message: `Receiver must be diagonal: server ${serverCourt} court, receiver ${receiverCourt} court`,
    });
  }

  // At 0-0 start, server must be in right service court
  if (leftScore === 0 && rightScore === 0) {
    if (serviceCourtOfPlayer(servingSide, servingPlayerIndex, courtPositions) !== "right") {
      violations.push({
        ruleId: "10.3.2",
        message: "At 0-0 the server must start in the right service court",
      });
    }
  }

  return violations;
}

/** Validate service transfer rules between consecutive snapshots. */
export function validateServiceTransfer(
  before: DoublesRallySnapshot,
  after: DoublesRallySnapshot,
  servingSideBeforeRally: BadmintonSide,
  rallyWinner: BadmintonSide,
): BwfRuleViolation[] {
  const violations: BwfRuleViolation[] = [];
  const transfer = classifyServiceTransfer(before, after, servingSideBeforeRally, rallyWinner);

  if (transfer === "retain_same_server") {
    if (after.servingSide !== servingSideBeforeRally) {
      violations.push({
        ruleId: "10.3.3",
        message: "Serving side won — service must stay with same pair",
      });
    }
    if (after.servingPlayerIndex !== before.servingPlayerIndex) {
      violations.push({
        ruleId: "10.3.3",
        message:
          `Serving side won — same player must continue serving ` +
          `(was P${before.servingPlayerIndex}, got P${after.servingPlayerIndex})`,
      });
    }
  }

  if (transfer === "transfer_to_rally_winner") {
    if (after.servingSide !== rallyWinner) {
      violations.push({
        ruleId: "10.3.4",
        message: "Receiving side won — service must transfer to rally winner",
      });
    }
    // Former serving side partners must have exchanged
    const beforePos = before.courtPositions[servingSideBeforeRally];
    const afterPos = after.courtPositions[servingSideBeforeRally];
    const expectedSwap = { rightCourtPlayerIndex: leftCourtPlayer(beforePos) };
    if (afterPos.rightCourtPlayerIndex !== expectedSwap.rightCourtPlayerIndex) {
      violations.push({
        ruleId: "10.3.4",
        message: "Former serving side partners must exchange positions when receiving side wins",
      });
    }
  }

  // Score must increment by exactly 1 for rally winner
  const leftDelta = after.leftScore - before.leftScore;
  const rightDelta = after.rightScore - before.rightScore;
  if (rallyWinner === "left" && (leftDelta !== 1 || rightDelta !== 0)) {
    violations.push({ ruleId: "10.3.1", message: "Left won rally but score delta invalid" });
  }
  if (rallyWinner === "right" && (rightDelta !== 1 || leftDelta !== 0)) {
    violations.push({ ruleId: "10.3.1", message: "Right won rally but score delta invalid" });
  }

  return violations;
}

export function snapshotsEqual(a: DoublesRallySnapshot, b: DoublesRallySnapshot): boolean {
  return (
    a.leftScore === b.leftScore &&
    a.rightScore === b.rightScore &&
    a.servingSide === b.servingSide &&
    a.servingPlayerIndex === b.servingPlayerIndex &&
    a.receivingSide === b.receivingSide &&
    a.receivingPlayerIndex === b.receivingPlayerIndex &&
    a.courtPositions.left.rightCourtPlayerIndex === b.courtPositions.left.rightCourtPlayerIndex &&
    a.courtPositions.right.rightCourtPlayerIndex === b.courtPositions.right.rightCourtPlayerIndex
  );
}

export function snapshotFromEngineState(state: {
  leftScore: number;
  rightScore: number;
  doublesServe?: {
    servingSide: BadmintonSide;
    servingPlayerIndex: 0 | 1;
    receivingSide: BadmintonSide;
    receivingPlayerIndex: 0 | 1;
    courtPositions: DoublesCourtPositionsState;
  };
}): DoublesRallySnapshot | null {
  const ds = state.doublesServe;
  if (!ds) return null;
  return {
    leftScore: state.leftScore,
    rightScore: state.rightScore,
    servingSide: ds.servingSide,
    servingPlayerIndex: ds.servingPlayerIndex,
    receivingSide: ds.receivingSide,
    receivingPlayerIndex: ds.receivingPlayerIndex,
    courtPositions: ds.courtPositions,
  };
}
