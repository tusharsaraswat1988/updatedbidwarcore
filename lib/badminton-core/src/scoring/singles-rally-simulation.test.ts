/**
 * Singles scoring audit — 500+ rally live vs replay simulation.
 *
 * Generates: lib/badminton-core/test-reports/singles-rally-simulation-report.txt
 */

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdAwardPoint, cmdUndoLastPoint } from "../commands";
import { BadmintonEventType, type BadmintonMatchStartedPayload } from "../events/badminton";
import { getUndoTargetSequences } from "../replay/undo-targets";
import { replayBadmintonEvents, reduceBadminton } from "../reducer/reducer";
import type { BadmintonEventEnvelope, BadmintonMatchMeta, BadmintonMatchState, BadmintonSide } from "../types";
import { STANDARD_FORMAT } from "../types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "../../test-reports/singles-rally-simulation-report.txt");

const LEFT: BadmintonSide = "left";
const RIGHT: BadmintonSide = "right";

const SINGLES_START: BadmintonMatchStartedPayload = {
  matchKind: "singles",
  format: STANDARD_FORMAT,
  leftSide: { label: "Player A", shortLabel: "A", playerIds: [1] },
  rightSide: { label: "Player B", shortLabel: "B", playerIds: [2] },
  firstServer: LEFT,
};

const META: BadmintonMatchMeta = {
  matchId: 1,
  tournamentId: 1,
  matchKind: "singles",
  format: STANDARD_FORMAT,
};

type Checkpoint = {
  sequenceId: string;
  rallyNumber: number;
  live: BadmintonMatchState;
  replay: BadmintonMatchState;
  mismatches: string[];
};

type SequenceResult = {
  id: string;
  label: string;
  winners: BadmintonSide[];
  checkpoints: Checkpoint[];
  passed: boolean;
};

function compareSinglesState(live: BadmintonMatchState, replay: BadmintonMatchState): string[] {
  const mismatches: string[] = [];

  const fields: Array<keyof BadmintonMatchState> = [
    "leftScore",
    "rightScore",
    "servingSide",
    "currentGame",
    "gamesLeft",
    "gamesRight",
    "matchStatus",
    "totalRallies",
    "inInterval",
    "winnerSide",
  ];

  for (const field of fields) {
    if (live[field] !== replay[field]) {
      mismatches.push(`${String(field)}: live=${String(live[field])} replay=${String(replay[field])}`);
    }
  }

  if (live.games.length !== replay.games.length) {
    mismatches.push(`games.length: live=${live.games.length} replay=${replay.games.length}`);
  }

  if (live.activeTimeout?.side !== replay.activeTimeout?.side) {
    mismatches.push(
      `activeTimeout: live=${live.activeTimeout?.side ?? "null"} replay=${replay.activeTimeout?.side ?? "null"}`,
    );
  }

  return mismatches;
}

function startEvents(): BadmintonEventEnvelope[] {
  return [
    {
      matchId: 1,
      tournamentId: 1,
      sportSlug: "badminton",
      eventType: BadmintonEventType.MATCH_STARTED,
      eventVersion: 1,
      sequence: 1,
      actorType: "system",
      payload: SINGLES_START,
    },
  ];
}

function simulateSequence(id: string, label: string, winners: BadmintonSide[]): SequenceResult {
  let events = startEvents();
  let liveState = replayBadmintonEvents(META, events);
  const checkpoints: Checkpoint[] = [];
  let seq = 2;

  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i]!;
    const result = cmdAwardPoint(liveState, winner);
    if (!result.ok) break;

    for (const e of result.events) {
      liveState = reduceBadminton(liveState, {
        matchId: 1,
        tournamentId: 1,
        sportSlug: "badminton",
        eventType: e.eventType,
        eventVersion: 1,
        sequence: seq,
        actorType: "system",
        payload: e.payload,
      });
      events.push({
        matchId: 1,
        tournamentId: 1,
        sportSlug: "badminton",
        eventType: e.eventType,
        eventVersion: 1,
        sequence: seq,
        actorType: "system",
        payload: e.payload,
      });
      seq++;
    }

    const replayState = replayBadmintonEvents(META, events);
    const mismatches = compareSinglesState(liveState, replayState);

    checkpoints.push({
      sequenceId: id,
      rallyNumber: i + 1,
      live: liveState,
      replay: replayState,
      mismatches,
    });

    if (liveState.matchStatus !== "live") break;
  }

  const passed = checkpoints.every((c) => c.mismatches.length === 0);
  return { id, label, winners, checkpoints, passed };
}

function generateBinarySequences(length: number): BadmintonSide[][] {
  const results: BadmintonSide[][] = [];
  const total = 2 ** length;
  for (let mask = 0; mask < total; mask++) {
    const seq: BadmintonSide[] = [];
    for (let bit = 0; bit < length; bit++) {
      seq.push(mask & (1 << bit) ? RIGHT : LEFT);
    }
    results.push(seq);
  }
  return results;
}

function playGameToWin(side: BadmintonSide, maxRallies = 35): BadmintonSide[] {
  const winners: BadmintonSide[] = [];
  let left = 0;
  let right = 0;

  while (winners.length < maxRallies) {
    const over =
      (left >= 21 && left - right >= 2) ||
      (right >= 21 && right - left >= 2) ||
      left >= 30 ||
      right >= 30;
    if (over) break;
    winners.push(side);
    if (side === LEFT) left++;
    else right++;
  }

  return winners;
}

function buildAllSequences(): Array<{ id: string; label: string; winners: BadmintonSide[] }> {
  const sequences: Array<{ id: string; label: string; winners: BadmintonSide[] }> = [];

  for (const len of [6, 7, 8]) {
    generateBinarySequences(len).forEach((winners, i) => {
      sequences.push({
        id: `bin${len}-${String(i).padStart(3, "0")}`,
        label: `${len}-rally pattern #${i + 1}`,
        winners,
      });
    });
  }

  sequences.push({
    id: "deuce-22-20",
    label: "Deuce to 22-20",
    winners: [
      ...Array(20).fill(LEFT),
      ...Array(20).fill(RIGHT),
      LEFT,
      LEFT,
    ] as BadmintonSide[],
  });

  sequences.push({
    id: "bo3-left-2-1",
    label: "Best of 3: left wins 2-1",
    winners: [...playGameToWin(LEFT), ...playGameToWin(RIGHT), ...playGameToWin(LEFT, 30)],
  });

  sequences.push({
    id: "bo3-right-2-0",
    label: "Best of 3: right wins 2-0",
    winners: [...playGameToWin(RIGHT), ...playGameToWin(RIGHT)],
  });

  sequences.push({
    id: "bo3-deciding-deuce",
    label: "Best of 3 deciding game deuce",
    winners: [
      ...playGameToWin(LEFT),
      ...playGameToWin(RIGHT),
      ...Array(20).fill(LEFT),
      ...Array(20).fill(RIGHT),
      LEFT,
      LEFT,
    ] as BadmintonSide[],
  });

  return sequences;
}

function formatReport(results: SequenceResult[]): string {
  const totalCheckpoints = results.reduce((n, r) => n + r.checkpoints.length, 0);
  const totalRallies = totalCheckpoints;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const mismatchCheckpoints = results.flatMap((r) =>
    r.checkpoints.filter((c) => c.mismatches.length > 0),
  );

  const lines = [
    "╔══════════════════════════════════════════════════════════════════════╗",
    "║           SINGLES RALLY SIMULATION — LIVE vs REPLAY AUDIT             ║",
    "╚══════════════════════════════════════════════════════════════════════╝",
    "",
    "Summary:",
    `  Sequences run:       ${results.length}`,
    `  Sequences passed:    ${passed}`,
    `  Sequences failed:    ${failed}`,
    `  Total rally checks:  ${totalRallies}`,
    `  Mismatch checkpoints: ${mismatchCheckpoints.length}`,
    "",
  ];

  if (mismatchCheckpoints.length > 0) {
    lines.push("MISMATCHES:");
    for (const c of mismatchCheckpoints.slice(0, 20)) {
      lines.push(`  ${c.sequenceId} rally ${c.rallyNumber}: ${c.mismatches.join("; ")}`);
    }
    lines.push("");
  } else {
    lines.push("All live vs replay checkpoints matched.");
    lines.push("");
  }

  const failedSequences = results.filter((r) => !r.passed);
  if (failedSequences.length > 0) {
    lines.push("Failed sequences:");
    for (const f of failedSequences.slice(0, 10)) {
      const first = f.checkpoints.find((c) => c.mismatches.length > 0);
      lines.push(`  ${f.id}: ${first?.mismatches.join("; ") ?? "unknown"}`);
    }
  }

  return lines.join("\n");
}

describe("Singles scoring audit — 500+ rally live vs replay", () => {
  const sequences = buildAllSequences();

  it(`runs ${sequences.length} sequences with ${sequences.reduce((n, s) => n + s.winners.length, 0)}+ rally checks`, () => {
    expect(sequences.length).toBeGreaterThanOrEqual(50);

    const results = sequences.map((s) => simulateSequence(s.id, s.label, s.winners));
    const report = formatReport(results);

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, report, "utf-8");

    const totalRallies = results.reduce((n, r) => n + r.checkpoints.length, 0);
    expect(totalRallies).toBeGreaterThanOrEqual(500);

    const failed = results.filter((r) => !r.passed);
    expect(failed.length, report).toBe(0);
  });
});

describe("Singles reconstruction probes", () => {
  it("POINT_WON-only log does NOT reconstruct game transitions", () => {
    let events = startEvents();
    let state = replayBadmintonEvents(META, events);

    for (let i = 0; i < 21; i++) {
      const result = cmdAwardPoint(state, LEFT);
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const pointOnly = result.events.find((e) => e.eventType === BadmintonEventType.POINT_WON)!;
      events.push({
        matchId: 1,
        tournamentId: 1,
        sportSlug: "badminton",
        eventType: BadmintonEventType.POINT_WON,
        eventVersion: 1,
        sequence: i + 2,
        actorType: "system",
        payload: pointOnly.payload,
      });
      state = replayBadmintonEvents(META, events);
    }

    expect(state.leftScore).toBe(21);
    expect(state.currentGame).toBe(1);
    expect(state.gamesLeft).toBe(0);
    expect(state.matchStatus).toBe("live");
  });

  it("undo reconstructs singles state after game-winning rally", () => {
    let events = startEvents();
    let state = replayBadmintonEvents(META, events);

    for (let i = 0; i < 21; i++) {
      const result = cmdAwardPoint(state, LEFT);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      let seq = events.length + 1;
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
      }
      state = replayBadmintonEvents(META, events);
    }

    expect(state.currentGame).toBe(2);

    const targets = getUndoTargetSequences(events);
    const undo = cmdUndoLastPoint(state, targets);
    expect(undo.ok).toBe(true);
    if (!undo.ok) return;

    events.push({
      matchId: 1,
      tournamentId: 1,
      sportSlug: "badminton",
      eventType: BadmintonEventType.POINT_UNDONE,
      eventVersion: 1,
      sequence: events.length + 1,
      actorType: "system",
      payload: undo.events[0]!.payload,
    });

    const afterUndo = replayBadmintonEvents(META, events);
    expect(afterUndo.currentGame).toBe(1);
    expect(afterUndo.leftScore).toBe(20);
    expect(afterUndo.gamesLeft).toBe(0);
    expect(afterUndo.servingSide).toBe(LEFT);
  });

  it("servingSide equals last rally winner on every replayed point", () => {
    const result = simulateSequence("serve-check", "serve invariant", [
      LEFT,
      LEFT,
      RIGHT,
      RIGHT,
      LEFT,
    ]);
    expect(result.passed).toBe(true);
    for (const cp of result.checkpoints) {
      const lastWinner = result.winners[cp.rallyNumber - 1]!;
      expect(cp.replay.servingSide).toBe(lastWinner);
    }
  });
});

export { simulateSequence, buildAllSequences, compareSinglesState, REPORT_PATH };
