/**
 * Scorer assistance — automated verification for singles, doubles, mixed doubles.
 *
 * Generates: lib/badminton-core/test-reports/scorer-assistance-report.txt
 */

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cmdAcknowledgeCourtChange,
  cmdAwardPoint,
  cmdEndInterval,
  cmdEndTimeout,
  cmdStartInterval,
  cmdStartMatch,
  cmdStartTimeout,
} from "../commands";
import { BadmintonEventType, type BadmintonMatchStartedPayload } from "../events/badminton";
import { reduceBadminton } from "../reducer/reducer";
import { createInitialBadmintonState } from "../reducer/state";
import type { BadmintonMatchMeta, BadmintonMatchState, BadmintonSide } from "../types";
import { STANDARD_FORMAT } from "../types";
import {
  deriveScorerAssistance,
  deriveVoiceAssistPrompts,
  detectGamePointSide,
  detectMatchPointSide,
  isCourtChangeRequired,
  isIntervalDue,
  resolveReceiverLabel,
  resolveServerLabel,
} from "./scorer-assistance";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "../../test-reports/scorer-assistance-report.txt");

const META: BadmintonMatchMeta = {
  matchId: 1,
  tournamentId: 1,
  matchKind: "singles",
  format: STANDARD_FORMAT,
};

const SINGLES_START: BadmintonMatchStartedPayload = {
  matchKind: "singles",
  format: STANDARD_FORMAT,
  leftSide: { label: "Abhinav Keshri", shortLabel: "AK", playerIds: [1] },
  rightSide: { label: "Priyank Singh", shortLabel: "PS", playerIds: [2] },
  firstServer: "left",
};

const DOUBLES_START: BadmintonMatchStartedPayload = {
  matchKind: "doubles",
  format: STANDARD_FORMAT,
  leftSide: {
    label: "Team A",
    shortLabel: "A",
    playerIds: [1, 2],
    players: [
      { label: "Abhinav Keshri", shortLabel: "AK" },
      { label: "Player A2", shortLabel: "A2" },
    ],
  },
  rightSide: {
    label: "Team B",
    shortLabel: "B",
    playerIds: [3, 4],
    players: [
      { label: "Priyank Singh", shortLabel: "PS" },
      { label: "Player B2", shortLabel: "B2" },
    ],
  },
  firstServer: "left",
  doublesSetup: {
    tossWinnerSide: "left",
    tossDecision: "serve",
    firstServingSide: "left",
    firstServerPlayerIndex: 0,
    firstReceivingSide: "right",
    firstReceiverPlayerIndex: 0,
  },
};

const MIXED_START: BadmintonMatchStartedPayload = {
  ...DOUBLES_START,
  matchKind: "mixed_doubles",
};

type Checkpoint = { label: string; passed: boolean; detail: string };

const report: Checkpoint[] = [];

function record(label: string, passed: boolean, detail: string) {
  report.push({ label, passed, detail });
  expect(passed, detail).toBe(true);
}

function applyCommands(
  meta: BadmintonMatchMeta,
  start: BadmintonMatchStartedPayload,
  sides: BadmintonSide[],
): BadmintonMatchState {
  let state = createInitialBadmintonState(meta);
  const startResult = cmdStartMatch(state, start);
  expect(startResult.ok).toBe(true);
  if (!startResult.ok) return state;

  let seq = 0;
  for (const event of startResult.events) {
    seq += 1;
    state = reduceBadminton(state, {
      matchId: meta.matchId,
      tournamentId: meta.tournamentId,
      sportSlug: "badminton",
      eventType: event.eventType,
      eventVersion: 1,
      sequence: seq,
      actorType: "scorer_pin",
      payload: event.payload,
    });
  }

  for (const side of sides) {
    const result = cmdAwardPoint(state, side);
    expect(result.ok).toBe(true);
    if (!result.ok) break;
    for (const event of result.events) {
      seq += 1;
      state = reduceBadminton(state, {
        matchId: meta.matchId,
        tournamentId: meta.tournamentId,
        sportSlug: "badminton",
        eventType: event.eventType,
        eventVersion: 1,
        sequence: seq,
        actorType: "scorer_pin",
        payload: event.payload,
      });
    }
  }

  return state;
}

function playToScore(
  meta: BadmintonMatchMeta,
  start: BadmintonMatchStartedPayload,
  leftTarget: number,
  rightTarget: number,
  preferSide: BadmintonSide = "left",
): BadmintonMatchState {
  const sides: BadmintonSide[] = [];
  let left = 0;
  let right = 0;
  while (left < leftTarget || right < rightTarget) {
    if (left < leftTarget && (right >= rightTarget || preferSide === "left" || left <= right)) {
      sides.push("left");
      left += 1;
    } else if (right < rightTarget) {
      sides.push("right");
      right += 1;
    }
  }
  return applyCommands(meta, start, sides);
}

describe("Scorer assistance — singles", () => {
  it("shows server/receiver labels and accurate confidence panel", () => {
    const state = applyCommands({ ...META, matchKind: "singles" }, SINGLES_START, ["left", "left"]);
    record(
      "Singles server label",
      resolveServerLabel(state) === "Abhinav Keshri",
      `Expected Abhinav Keshri, got ${resolveServerLabel(state)}`,
    );
    record(
      "Singles receiver label",
      resolveReceiverLabel(state) === "Priyank Singh",
      `Expected Priyank Singh, got ${resolveReceiverLabel(state)}`,
    );

    const snapshot = deriveScorerAssistance(state);
    record(
      "Singles panel score",
      snapshot.panel.leftScore === 2 && snapshot.panel.rightScore === 0,
      `Panel score ${snapshot.panel.leftScore}-${snapshot.panel.rightScore}`,
    );
    record(
      "Singles panel games won",
      snapshot.panel.gamesLeft === 0 && snapshot.panel.gamesRight === 0,
      `Games ${snapshot.panel.gamesLeft}-${snapshot.panel.gamesRight}`,
    );
  });

  it("detects game point and match point banners", () => {
    const gamePointState = playToScore(
      { ...META, matchKind: "singles" },
      SINGLES_START,
      20,
      19,
      "left",
    );
    record(
      "Singles game point side",
      detectGamePointSide(gamePointState) === "left",
      `Game point side ${detectGamePointSide(gamePointState)}`,
    );

    const gamePointSnapshot = deriveScorerAssistance(gamePointState);
    record(
      "Singles game point banner",
      gamePointSnapshot.banners.some((b) => b.kind === "game_point"),
      `Banners: ${gamePointSnapshot.banners.map((b) => b.kind).join(", ")}`,
    );

    const matchPointRallies: BadmintonSide[] = [
      ...Array(21).fill("left"),
      ...Array(21).fill("right"),
      ...Array(20).fill("left"),
      ...Array(18).fill("right"),
    ] as BadmintonSide[];
    const matchState = applyCommands({ ...META, matchKind: "singles" }, SINGLES_START, matchPointRallies);

    record(
      "Singles match point side",
      detectMatchPointSide(matchState) === "left",
      `Match point at ${matchState.leftScore}-${matchState.rightScore}, games ${matchState.gamesLeft}-${matchState.gamesRight}`,
    );

    const matchSnapshot = deriveScorerAssistance(matchState);
    record(
      "Singles match point banner",
      matchSnapshot.banners.some((b) => b.kind === "match_point"),
      `Banners: ${matchSnapshot.banners.map((b) => b.kind).join(", ")}`,
    );
  });

  it("detects deciding-game interval and court change prompts", () => {
    let state = applyCommands({ ...META, matchKind: "singles" }, SINGLES_START, []);
    const game1: BadmintonSide[] = Array(21).fill("left") as BadmintonSide[];
    state = applyCommands({ ...META, matchKind: "singles" }, SINGLES_START, game1);
    const game2: BadmintonSide[] = Array(21).fill("right") as BadmintonSide[];
    for (const side of game2) {
      const result = cmdAwardPoint(state, side);
      expect(result.ok).toBe(true);
      if (!result.ok) break;
      let seq = state.lastSequence ?? 0;
      for (const event of result.events) {
        seq += 1;
        state = reduceBadminton(state, {
          matchId: 1,
          tournamentId: 1,
          sportSlug: "badminton",
          eventType: event.eventType,
          eventVersion: 1,
          sequence: seq,
          actorType: "scorer_pin",
          payload: event.payload,
        });
      }
    }

    const intervalState = playToScore(
      { ...META, matchKind: "singles" },
      SINGLES_START,
      11,
      8,
      "left",
    );
    const rebuilt = applyCommands({ ...META, matchKind: "singles" }, SINGLES_START, [
      ...Array(21).fill("left"),
      ...Array(21).fill("right"),
      ...Array(11).fill("left"),
    ] as BadmintonSide[]);

    record(
      "Singles interval due at 11 in deciding game",
      isIntervalDue(rebuilt),
      `intervalDue=${isIntervalDue(rebuilt)} score=${rebuilt.leftScore}-${rebuilt.rightScore} game=${rebuilt.currentGame}`,
    );
    record(
      "Singles court change required",
      isCourtChangeRequired(rebuilt),
      `courtChange=${isCourtChangeRequired(rebuilt)}`,
    );

    const snapshot = deriveScorerAssistance(rebuilt);
    record(
      "Singles interval banner",
      snapshot.banners.some((b) => b.kind === "interval_due"),
      `Banners: ${snapshot.banners.map((b) => b.label).join(" | ")}`,
    );
    record(
      "Singles court change banner",
      snapshot.banners.some((b) => b.kind === "court_change_required"),
      `Banners: ${snapshot.banners.map((b) => b.label).join(" | ")}`,
    );

    const ack = cmdAcknowledgeCourtChange(rebuilt);
    record("Singles court change ack command", ack.ok === true, ack.ok ? "ok" : (ack as { error: string }).error);

    const voice = deriveVoiceAssistPrompts(snapshot);
    record(
      "Singles voice prompts include interval and court change",
      voice.includes("Interval") && voice.includes("Court Change"),
      voice.join(", "),
    );

    void intervalState;
  });
});

describe("Scorer assistance — doubles", () => {
  const meta: BadmintonMatchMeta = { ...META, matchKind: "doubles" };

  it("shows player-level server and receiver", () => {
    const state = applyCommands(meta, DOUBLES_START, []);
    record(
      "Doubles server label at toss",
      resolveServerLabel(state) === "Abhinav Keshri",
      resolveServerLabel(state),
    );
    record(
      "Doubles receiver label at toss",
      resolveReceiverLabel(state) === "Priyank Singh",
      resolveReceiverLabel(state),
    );
  });

  it("detects game point and match point", () => {
    const gamePointState = playToScore(meta, DOUBLES_START, 20, 17, "left");
    const snapshot = deriveScorerAssistance(gamePointState);
    record(
      "Doubles game point banner",
      snapshot.banners.some((b) => b.kind === "game_point"),
      snapshot.banners.map((b) => b.label).join(" | "),
    );
  });

  it("blocks scoring during interval and after timeout until ready", () => {
    const deciding = applyCommands(meta, DOUBLES_START, [
      ...Array(21).fill("left"),
      ...Array(21).fill("right"),
      ...Array(11).fill("left"),
    ] as BadmintonSide[]);

    const intervalStart = cmdStartInterval(deciding);
    expect(intervalStart.ok).toBe(true);
    let state = deciding;
    if (intervalStart.ok) {
      let seq = state.lastSequence ?? 0;
      for (const event of intervalStart.events) {
        seq += 1;
        state = reduceBadminton(state, {
          matchId: 1,
          tournamentId: 1,
          sportSlug: "badminton",
          eventType: event.eventType,
          eventVersion: 1,
          sequence: seq,
          actorType: "scorer_pin",
          payload: event.payload,
        });
      }
    }

    record(
      "Doubles scoring blocked in interval",
      deriveScorerAssistance(state).scoringBlocked === true,
      `scoringBlocked=${deriveScorerAssistance(state).scoringBlocked}`,
    );

    const timeoutStart = cmdStartTimeout(deciding, "left");
    expect(timeoutStart.ok).toBe(true);
    let timeoutState = deciding;
    if (timeoutStart.ok) {
      let seq = timeoutState.lastSequence ?? 0;
      for (const event of timeoutStart.events) {
        seq += 1;
        timeoutState = reduceBadminton(timeoutState, {
          matchId: 1,
          tournamentId: 1,
          sportSlug: "badminton",
          eventType: event.eventType,
          eventVersion: 1,
          sequence: seq,
          actorType: "scorer_pin",
          payload: event.payload,
        });
      }
    }
    record(
      "Doubles scoring blocked during timeout",
      deriveScorerAssistance(timeoutState).scoringBlocked === true,
      `blockReason=${deriveScorerAssistance(timeoutState).scoringBlockReason}`,
    );

    const endTimeout = cmdEndTimeout(timeoutState);
    expect(endTimeout.ok).toBe(true);
    if (endTimeout.ok) {
      let seq = timeoutState.lastSequence ?? 0;
      for (const event of endTimeout.events) {
        seq += 1;
        timeoutState = reduceBadminton(timeoutState, {
          matchId: 1,
          tournamentId: 1,
          sportSlug: "badminton",
          eventType: event.eventType,
          eventVersion: 1,
          sequence: seq,
          actorType: "scorer_pin",
          payload: event.payload,
        });
      }
    }
    record(
      "Doubles needs ready confirm after timeout",
      deriveScorerAssistance(timeoutState, { readyToScore: false }).scoringBlocked === true,
      "readyToScore=false blocks scoring",
    );
  });
});

describe("Scorer assistance — mixed doubles", () => {
  const meta: BadmintonMatchMeta = { ...META, matchKind: "mixed_doubles" };

  it("shows server/receiver and interval assistance", () => {
    const state = applyCommands(meta, MIXED_START, ["right", "right"]);
    record(
      "Mixed doubles server label present",
      resolveServerLabel(state).length > 0,
      resolveServerLabel(state),
    );
    record(
      "Mixed doubles receiver label present",
      resolveReceiverLabel(state).length > 0,
      resolveReceiverLabel(state),
    );

    const deciding = applyCommands(meta, MIXED_START, [
      ...Array(21).fill("left"),
      ...Array(21).fill("right"),
      ...Array(11).fill("left"),
    ] as BadmintonSide[]);

    const snapshot = deriveScorerAssistance(deciding);
    record(
      "Mixed doubles interval due",
      snapshot.intervalDue === true,
      `intervalDue=${snapshot.intervalDue}`,
    );

    const intervalStart = cmdStartInterval(deciding);
    record(
      "Mixed doubles interval start command",
      intervalStart.ok === true,
      intervalStart.ok ? "ok" : (intervalStart as { error: string }).error,
    );

    let intervalState = deciding;
    if (intervalStart.ok) {
      let seq = intervalState.lastSequence ?? 0;
      for (const event of intervalStart.events) {
        seq += 1;
        intervalState = reduceBadminton(intervalState, {
          matchId: 1,
          tournamentId: 1,
          sportSlug: "badminton",
          eventType: event.eventType,
          eventVersion: 1,
          sequence: seq,
          actorType: "scorer_pin",
          payload: event.payload,
        });
      }
    }

    const endInterval = cmdEndInterval(intervalState);
    record(
      "Mixed doubles interval end command",
      endInterval.ok === true,
      endInterval.ok ? "ok" : (endInterval as { error: string }).error,
    );

    const voice = deriveVoiceAssistPrompts(snapshot);
    record(
      "Mixed doubles voice assist prompts",
      voice.length >= 2,
      voice.join(", "),
    );
  });
});

describe("Scorer assistance report", () => {
  it("writes report file", () => {
    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    const lines = [
      "SCORER ASSISTANCE TEST REPORT",
      `Generated: ${new Date().toISOString()}`,
      "",
      ...report.map(
        (r, i) =>
          `${i + 1}. [${r.passed ? "PASS" : "FAIL"}] ${r.label}\n   ${r.detail}`,
      ),
      "",
      `Total: ${report.length} | Passed: ${report.filter((r) => r.passed).length} | Failed: ${report.filter((r) => !r.passed).length}`,
    ];
    writeFileSync(REPORT_PATH, lines.join("\n"), "utf-8");
    expect(report.every((r) => r.passed)).toBe(true);
  });
});
