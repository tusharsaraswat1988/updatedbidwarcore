/**
 * Pre-match toss saved at match create/edit — used at Start to skip the court toss wizard.
 */

import { isPairMatchKind } from "@workspace/badminton-core";

export type BadmintonSideRef = "left" | "right";
export type TossDecision = "serve" | "receive";
export type PlayerIndex = 0 | 1;

/** Singles: only first server side. */
export type SinglesPreMatchToss = {
  firstServer: BadmintonSideRef;
};

/** Doubles / mixed: full toss + first server/receiver. */
export type DoublesPreMatchToss = {
  tossWinnerSide: BadmintonSideRef;
  tossDecision: TossDecision;
  firstServingSide: BadmintonSideRef;
  firstServerPlayerIndex: PlayerIndex;
  firstReceivingSide: BadmintonSideRef;
  firstReceiverPlayerIndex: PlayerIndex;
};

export type PreMatchToss = SinglesPreMatchToss | DoublesPreMatchToss;

export function deriveServingSides(
  tossWinnerSide: BadmintonSideRef,
  tossDecision: TossDecision,
): { firstServingSide: BadmintonSideRef; firstReceivingSide: BadmintonSideRef } {
  const firstServingSide: BadmintonSideRef =
    tossDecision === "serve" ? tossWinnerSide : tossWinnerSide === "left" ? "right" : "left";
  const firstReceivingSide: BadmintonSideRef =
    firstServingSide === "left" ? "right" : "left";
  return { firstServingSide, firstReceivingSide };
}

export function isDoublesPreMatchToss(toss: PreMatchToss): toss is DoublesPreMatchToss {
  return "tossWinnerSide" in toss && "tossDecision" in toss;
}

export function isSinglesPreMatchToss(toss: PreMatchToss): toss is SinglesPreMatchToss {
  return "firstServer" in toss && !("tossWinnerSide" in toss);
}

export function parsePreMatchToss(raw: unknown): PreMatchToss | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  if (o.firstServer === "left" || o.firstServer === "right") {
    if (o.tossWinnerSide != null) {
      // Prefer doubles shape when both present
    } else {
      return { firstServer: o.firstServer };
    }
  }

  if (
    (o.tossWinnerSide === "left" || o.tossWinnerSide === "right") &&
    (o.tossDecision === "serve" || o.tossDecision === "receive")
  ) {
    const derived = deriveServingSides(o.tossWinnerSide, o.tossDecision);
    const firstServingSide =
      o.firstServingSide === "left" || o.firstServingSide === "right"
        ? o.firstServingSide
        : derived.firstServingSide;
    const firstReceivingSide =
      o.firstReceivingSide === "left" || o.firstReceivingSide === "right"
        ? o.firstReceivingSide
        : derived.firstReceivingSide;
    const serverIdx = o.firstServerPlayerIndex;
    const receiverIdx = o.firstReceiverPlayerIndex;
    if (serverIdx !== 0 && serverIdx !== 1) return null;
    if (receiverIdx !== 0 && receiverIdx !== 1) return null;
    return {
      tossWinnerSide: o.tossWinnerSide,
      tossDecision: o.tossDecision,
      firstServingSide,
      firstReceivingSide,
      firstServerPlayerIndex: serverIdx,
      firstReceiverPlayerIndex: receiverIdx,
    };
  }

  if (o.firstServer === "left" || o.firstServer === "right") {
    return { firstServer: o.firstServer };
  }

  return null;
}

/** True when toss is complete enough to start without the wizard. */
export function isPreMatchTossComplete(matchType: string, toss: PreMatchToss | null): boolean {
  if (!toss) return false;
  if (isPairMatchKind(matchType)) {
    return isDoublesPreMatchToss(toss);
  }
  return isSinglesPreMatchToss(toss);
}

export function buildDoublesTossFromForm(input: {
  tossWinnerSide: BadmintonSideRef;
  tossDecision: TossDecision;
  firstServerPlayerIndex: PlayerIndex;
  firstReceiverPlayerIndex: PlayerIndex;
}): DoublesPreMatchToss {
  const { firstServingSide, firstReceivingSide } = deriveServingSides(
    input.tossWinnerSide,
    input.tossDecision,
  );
  return {
    tossWinnerSide: input.tossWinnerSide,
    tossDecision: input.tossDecision,
    firstServingSide,
    firstReceivingSide,
    firstServerPlayerIndex: input.firstServerPlayerIndex,
    firstReceiverPlayerIndex: input.firstReceiverPlayerIndex,
  };
}
