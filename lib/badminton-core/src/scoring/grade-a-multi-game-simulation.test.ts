/**
 * Grade A Phase C — full best-of-3 doubles match validation vs BWF oracle.
 */

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdAwardPoint } from "../commands";
import { BadmintonEventType, type BadmintonMatchStartedPayload } from "../events/badminton";
import { replayBadmintonEvents } from "../reducer/reducer";
import type { BadmintonEventEnvelope, BadmintonMatchMeta, BadmintonSide } from "../types";
import { STANDARD_FORMAT } from "../types";
import {
  bwfReferenceAfterRally,
  snapshotFromEngineState,
  snapshotsEqual,
  validateBwfDoublesSnapshot,
  type DoublesRallySnapshot,
} from "./bwf-doubles-oracle";
import {
  buildNextGameCourtPositions,
  nextGameServerAfterGameEnd,
  opposingSide,
  receiverIndexForServer,
} from "./doubles-court";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "../../test-reports/grade-a-multi-game-doubles-report.txt");

const TEAM_A: BadmintonSide = "left";
const TEAM_B: BadmintonSide = "right";

const MATCH_START: BadmintonMatchStartedPayload = {
  matchKind: "doubles",
  format: STANDARD_FORMAT,
  leftSide: {
    label: "A1 / A2",
    shortLabel: "A",
    playerIds: [1, 2],
  },
  rightSide: {
    label: "B1 / B2",
    shortLabel: "B",
    playerIds: [3, 4],
  },
  firstServer: TEAM_A,
  doublesSetup: {
    tossWinnerSide: TEAM_A,
    tossDecision: "serve",
    firstServingSide: TEAM_A,
    firstServerPlayerIndex: 0,
    firstReceivingSide: TEAM_B,
    firstReceiverPlayerIndex: 0,
  },
};

const META: BadmintonMatchMeta = {
  matchId: 1,
  tournamentId: 1,
  matchKind: "doubles",
  format: STANDARD_FORMAT,
};

type Checkpoint = {
  label: string;
  passed: boolean;
  detail: string;
};

function playRalliesToGameWin(
  winners: BadmintonSide[],
  targetSide: BadmintonSide,
): BadmintonSide[] {
  const pattern: BadmintonSide[] = [];
  let left = 0;
  let right = 0;

  while (true) {
    const over =
      (left >= 21 && left - right >= 2) ||
      (right >= 21 && right - left >= 2) ||
      left >= 30 ||
      right >= 30;
    if (over) break;

    const winner = winners[pattern.length] ?? targetSide;
    pattern.push(winner);
    if (winner === "left") left++;
    else right++;
  }

  return pattern;
}

function simulateBestOfThree(pattern: BadmintonSide[]): {
  checkpoints: Checkpoint[];
  events: BadmintonEventEnvelope[];
  finalState: ReturnType<typeof replayBadmintonEvents>;
} {
  const checkpoints: Checkpoint[] = [];
  const events: BadmintonEventEnvelope[] = [
    {
      matchId: 1,
      tournamentId: 1,
      sportSlug: "badminton",
      eventType: BadmintonEventType.MATCH_STARTED,
      eventVersion: 1,
      sequence: 1,
      actorType: "system",
      payload: MATCH_START,
    },
  ];

  let seq = 2;
  let patternIdx = 0;
  let state = replayBadmintonEvents(META, events);
  let beforeOracle: DoublesRallySnapshot | null = snapshotFromEngineState(state);

  const recordCheckpoint = (label: string, passed: boolean, detail: string) => {
    checkpoints.push({ label, passed, detail });
  };

  recordCheckpoint("Match start", beforeOracle !== null, "Initial doubles serve state");

  for (let gameTarget = 1; gameTarget <= 3; gameTarget++) {
    const gameWinners: BadmintonSide[] = [];
    let gameEnded = false;

    while (!gameEnded && state.matchStatus === "live") {
      const winner = pattern[patternIdx++] ?? TEAM_A;
      const servingBefore = beforeOracle!.servingSide;
      const preRallyOracle = beforeOracle;

      const result = cmdAwardPoint(state, winner);
      if (!result.ok) {
        recordCheckpoint(`Game ${gameTarget} rally`, false, result.error);
        break;
      }

      for (const e of result.events) {
        events.push({
          matchId: 1,
          tournamentId: 1,
          sportSlug: "badminton",
          eventType: e.eventType,
          eventVersion: 1,
          sequence: seq++,
          actorType: "system",
          payload: e.payload,
        });

        if (e.eventType === BadmintonEventType.POINT_WON) {
          const partialState = replayBadmintonEvents(META, events);
          const afterOracle = snapshotFromEngineState(partialState);
          const oracleAfter = bwfReferenceAfterRally(preRallyOracle!, winner, servingBefore);
          const inGameOk =
            afterOracle !== null &&
            snapshotsEqual(afterOracle, oracleAfter) &&
            validateBwfDoublesSnapshot(afterOracle).length === 0;

          gameWinners.push(winner);
          recordCheckpoint(
            `Game ${gameTarget} rally ${gameWinners.length}`,
            inGameOk,
            inGameOk ? "Oracle match" : "Oracle mismatch",
          );
          beforeOracle = afterOracle;

          if (
            gameTarget === 3 &&
            afterOracle.leftScore + afterOracle.rightScore === 11 &&
            partialState.games[2]?.intervalReached
          ) {
            recordCheckpoint(
              "Game 3 side change (11 pt interval threshold)",
              partialState.games[2]?.intervalReached === true,
              `score ${afterOracle.leftScore}-${afterOracle.rightScore}`,
            );
          }
        }
      }

      state = replayBadmintonEvents(META, events);

      if (result.events.some((e) => e.eventType === BadmintonEventType.GAME_ENDED)) {
        gameEnded = true;
        recordCheckpoint(
          `Game ${gameTarget} end`,
          state.gamesLeft + state.gamesRight === gameTarget,
          `gamesLeft=${state.gamesLeft} gamesRight=${state.gamesRight}`,
        );

        if (state.matchStatus === "live" && state.doublesServe && preRallyOracle) {
          const ds = state.doublesServe;
          const lastWin = winner;
          const expectedServer = nextGameServerAfterGameEnd(
            lastWin,
            preRallyOracle.servingSide,
            preRallyOracle.servingPlayerIndex,
            lastWin,
          );
          const expectedCourt = buildNextGameCourtPositions(
            lastWin,
            expectedServer,
            preRallyOracle.courtPositions.left,
            preRallyOracle.courtPositions.right,
          );
          const recvSide = opposingSide(lastWin);
          const expectedReceiver = receiverIndexForServer(
            expectedServer,
            expectedCourt[lastWin],
            expectedCourt[recvSide],
          );

          const nextGameOk =
            ds.servingSide === lastWin &&
            ds.servingPlayerIndex === expectedServer &&
            ds.receivingPlayerIndex === expectedReceiver &&
            state.leftScore === 0 &&
            state.rightScore === 0;

          recordCheckpoint(
            `Game ${gameTarget + 1} start`,
            nextGameOk,
            `server P${ds.servingPlayerIndex}, receiver P${ds.receivingPlayerIndex}`,
          );
          beforeOracle = snapshotFromEngineState(state);
        }
      }

      if (result.events.some((e) => e.eventType === BadmintonEventType.MATCH_ENDED)) {
        recordCheckpoint(
          "Match completion",
          state.matchStatus === "completed" && state.winnerSide != null,
          `winner=${state.winnerSide} score ${state.gamesLeft}-${state.gamesRight}`,
        );
      }
    }

    if (state.matchStatus !== "live") break;
  }

  return { checkpoints, events, finalState: state };
}

describe("Grade A Phase C — best-of-3 doubles multi-game", () => {
  it("validates full match checkpoints and writes report", () => {
    const game1 = playRalliesToGameWin([], TEAM_A);
    const game2 = playRalliesToGameWin([], TEAM_B);
    const game3Pattern: BadmintonSide[] = [];
    for (let i = 0; i < 25; i++) {
      game3Pattern.push(i % 3 === 0 ? TEAM_B : TEAM_A);
    }

    const fullPattern = [...game1, ...game2, ...game3Pattern];
    const { checkpoints, finalState } = simulateBestOfThree(fullPattern);

    const passed = checkpoints.filter((c) => c.passed).length;
    const failed = checkpoints.filter((c) => !c.passed);

    const report = [
      "Grade A Phase C — Best-of-3 Doubles Multi-Game Report",
      "=".repeat(60),
      "",
      `Checkpoints: ${checkpoints.length}`,
      `Passed: ${passed}`,
      `Failed: ${failed.length}`,
      "",
      ...checkpoints.map((c) => `[${c.passed ? "PASS" : "FAIL"}] ${c.label}: ${c.detail}`),
      "",
      `Final: ${finalState.matchStatus} ${finalState.gamesLeft}-${finalState.gamesRight}`,
      "",
    ].join("\n");

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, report, "utf-8");

    if (failed.length > 0) {
      console.log(report);
    }

    expect(failed.length, report).toBe(0);
    expect(finalState.matchStatus).toBe("completed");
    expect(finalState.gamesLeft + finalState.gamesRight).toBe(3);
  });
});
