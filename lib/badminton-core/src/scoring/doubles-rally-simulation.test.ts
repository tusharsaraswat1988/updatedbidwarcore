/**
 * Full rally-by-rally BWF doubles simulation.
 *
 * Setup: Team A (left) serves first — A1 serves to B1.
 * Runs 50+ rally-win sequences through the production scoring engine and
 * cross-checks every transition against an independent BWF oracle.
 *
 * Generates: lib/badminton-core/test-reports/doubles-rally-simulation-report.txt
 */

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdAwardPoint } from "../commands";
import { BadmintonEventType, type BadmintonMatchStartedPayload } from "../events/badminton";
import { replayBadmintonEvents } from "../reducer/reducer";
import type { BadmintonEventEnvelope, BadmintonMatchMeta, BadmintonMatchState, BadmintonSide } from "../types";
import { STANDARD_FORMAT } from "../types";
import {
  bwfReferenceAfterRally,
  classifyServiceTransfer,
  snapshotFromEngineState,
  snapshotsEqual,
  type BwfRuleViolation,
  type DoublesRallySnapshot,
  type ServiceTransferKind,
  serviceCourtOfPlayer,
  validateBwfDoublesSnapshot,
  validateServiceTransfer,
} from "./bwf-doubles-oracle";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "../../test-reports/doubles-rally-simulation-report.txt");

// Team A = left (A1=0, A2=1), Team B = right (B1=0, B2=1)
const TEAM_A: BadmintonSide = "left";
const TEAM_B: BadmintonSide = "right";

const leftSide = {
  label: "A1 / A2",
  shortLabel: "A",
  playerIds: [1, 2],
  players: [
    { label: "A1", shortLabel: "A1" },
    { label: "A2", shortLabel: "A2" },
  ],
};

const rightSide = {
  label: "B1 / B2",
  shortLabel: "B",
  playerIds: [3, 4],
  players: [
    { label: "B1", shortLabel: "B1" },
    { label: "B2", shortLabel: "B2" },
  ],
};

const MATCH_START: BadmintonMatchStartedPayload = {
  matchKind: "doubles",
  format: STANDARD_FORMAT,
  leftSide,
  rightSide,
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

type RallyTransition = {
  rallyNumber: number;
  rallyWinner: BadmintonSide | null;
  before: DoublesRallySnapshot;
  after: DoublesRallySnapshot;
  servingSideBeforeRally: BadmintonSide | null;
  serviceTransfer: ServiceTransferKind;
  violations: BwfRuleViolation[];
  engineMatchesOracle: boolean;
};

type SequenceResult = {
  id: string;
  label: string;
  winners: BadmintonSide[];
  transitions: RallyTransition[];
  passed: boolean;
};

function playerName(side: BadmintonSide, index: 0 | 1): string {
  if (side === TEAM_A) return index === 0 ? "A1" : "A2";
  return index === 0 ? "B1" : "B2";
}

function sideLabel(side: BadmintonSide): string {
  return side === TEAM_A ? "Team A" : "Team B";
}

function winnerLabel(side: BadmintonSide): string {
  return side === TEAM_A ? "A" : "B";
}

function formatCourt(snapshot: DoublesRallySnapshot): string {
  function cell(side: BadmintonSide, court: "left" | "right") {
    const pos = snapshot.courtPositions[side];
    const idx = court === "right" ? pos.rightCourtPlayerIndex : (pos.rightCourtPlayerIndex === 0 ? 1 : 0);
    const name = playerName(side, idx as 0 | 1);
    const tags: string[] = [];
    if (snapshot.servingSide === side && snapshot.servingPlayerIndex === idx) tags.push("S");
    if (snapshot.receivingSide === side && snapshot.receivingPlayerIndex === idx) tags.push("R");
    return tags.length ? `${name}(${tags.join("")})` : name;
  }

  return [
    "┌─────────┬─────────┐",
    `│ ${cell(TEAM_A, "left").padEnd(7)} │ ${cell(TEAM_A, "right").padEnd(7)} │  Team A`,
    "├─────────┼─────────┤",
    `│ ${cell(TEAM_B, "left").padEnd(7)} │ ${cell(TEAM_B, "right").padEnd(7)} │  Team B`,
    "└─────────┴─────────┘",
  ].join("\n");
}

function formatSnapshot(snapshot: DoublesRallySnapshot, indent = "  "): string[] {
  const serverCourt = serviceCourtOfPlayer(
    snapshot.servingSide,
    snapshot.servingPlayerIndex,
    snapshot.courtPositions,
  );
  const receiverCourt = serviceCourtOfPlayer(
    snapshot.receivingSide,
    snapshot.receivingPlayerIndex,
    snapshot.courtPositions,
  );

  return [
    `${indent}Score:     ${snapshot.leftScore}-${snapshot.rightScore}  (Team A - Team B)`,
    `${indent}Serving:   ${playerName(snapshot.servingSide, snapshot.servingPlayerIndex)} (${sideLabel(snapshot.servingSide)}, ${serverCourt} service court)`,
    `${indent}Receiving: ${playerName(snapshot.receivingSide, snapshot.receivingPlayerIndex)} (${sideLabel(snapshot.receivingSide)}, ${receiverCourt} service court)`,
    `${indent}Court:`,
    ...formatCourt(snapshot)
      .split("\n")
      .map((line) => `${indent}  ${line}`),
  ];
}

function formatTransfer(kind: ServiceTransferKind): string {
  switch (kind) {
    case "initial":
      return "Initial serve";
    case "retain_same_server":
      return "Service retained — same server continues (partners swapped on serving side)";
    case "transfer_to_rally_winner":
      return "Service transferred — rally winner's pair now serves (former serving pair swapped)";
  }
}

function startLiveMatch(): BadmintonMatchState {
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
  return replayBadmintonEvents(META, events);
}

/** Simulate a sequence by accumulating events from match start. */
function simulateSequence(id: string, label: string, winners: BadmintonSide[]): SequenceResult {
  let state = startLiveMatch();
  const transitions: RallyTransition[] = [];

  let before = snapshotFromEngineState(state)!;
  const initialViolations = validateBwfDoublesSnapshot(before);
  transitions.push({
    rallyNumber: 0,
    rallyWinner: null,
    before,
    after: before,
    servingSideBeforeRally: null,
    serviceTransfer: "initial",
    violations: initialViolations,
    engineMatchesOracle: initialViolations.length === 0,
  });

  const eventLog: BadmintonEventEnvelope[] = [
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
  state = replayBadmintonEvents(META, eventLog);

  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const servingSideBeforeRally = before.servingSide;

    const result = cmdAwardPoint(state, winner);
    if (!result.ok) {
      transitions.push({
        rallyNumber: i + 1,
        rallyWinner: winner,
        before,
        after: before,
        servingSideBeforeRally,
        serviceTransfer: "transfer_to_rally_winner",
        violations: [{ ruleId: "ENGINE", message: result.error }],
        engineMatchesOracle: false,
      });
      break;
    }

    for (const e of result.events) {
      eventLog.push({
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

    state = replayBadmintonEvents(META, eventLog);
    const after = snapshotFromEngineState(state)!;

    const oracleAfter = bwfReferenceAfterRally(before, winner, servingSideBeforeRally);
    const invariantViolations = [
      ...validateBwfDoublesSnapshot(after),
      ...validateServiceTransfer(before, after, servingSideBeforeRally, winner),
    ];

    const engineMatchesOracle = snapshotsEqual(after, oracleAfter);
    if (!engineMatchesOracle) {
      invariantViolations.push({
        ruleId: "ORACLE",
        message: "Engine state diverges from independent BWF reference implementation",
      });
    }

    const serviceTransfer = classifyServiceTransfer(before, after, servingSideBeforeRally, winner);

    transitions.push({
      rallyNumber: i + 1,
      rallyWinner: winner,
      before,
      after,
      servingSideBeforeRally,
      serviceTransfer,
      violations: invariantViolations,
      engineMatchesOracle,
    });

    before = after;

    // Stop if game ended (21+ with 2 clear) — don't run past game boundary in short sims
    if (state.matchStatus !== "live") break;
  }

  const passed = transitions.every((t) => t.violations.length === 0 && t.engineMatchesOracle);
  return { id, label, winners, transitions, passed };
}

function generateAllBinarySequences(length: number): BadmintonSide[][] {
  const results: BadmintonSide[][] = [];
  const total = 2 ** length;
  for (let mask = 0; mask < total; mask++) {
    const seq: BadmintonSide[] = [];
    for (let bit = 0; bit < length; bit++) {
      seq.push(mask & (1 << bit) ? TEAM_B : TEAM_A);
    }
    results.push(seq);
  }
  return results;
}

function generateNamedSequences(): Array<{ id: string; label: string; winners: BadmintonSide[] }> {
  const named: Array<{ id: string; label: string; winners: BadmintonSide[] }> = [];

  // Long serving streak — Team A wins 10 in a row
  named.push({
    id: "streak-a10",
    label: "Team A wins 10 consecutive rallies (same server throughout)",
    winners: Array(10).fill(TEAM_A),
  });

  // Alternating
  named.push({
    id: "alt-12",
    label: "Strict alternation A,B,A,B… for 12 rallies",
    winners: Array.from({ length: 12 }, (_, i) => (i % 2 === 0 ? TEAM_A : TEAM_B)),
  });

  // Receive-side break pattern
  named.push({
    id: "break-b5",
    label: "A serves 3, B breaks 5, A wins 2",
    winners: [TEAM_A, TEAM_A, TEAM_A, TEAM_B, TEAM_B, TEAM_B, TEAM_B, TEAM_B, TEAM_A, TEAM_A],
  });

  // Deuce approach (stop before game end at 21)
  named.push({
    id: "deuce-approach",
    label: "Rally to 20-19 (one point before game win)",
    winners: [
      ...Array(19).fill(TEAM_A),
      ...Array(19).fill(TEAM_B),
      TEAM_A,
    ],
  });

  // Two blocks of side dominance
  named.push({
    id: "blocks-7-7",
    label: "A wins 7, B wins 7",
    winners: [...Array(7).fill(TEAM_A), ...Array(7).fill(TEAM_B)],
  });

  // Pseudo-random fixed seeds
  for (let seed = 1; seed <= 8; seed++) {
    const winners: BadmintonSide[] = [];
    let x = seed * 1103515245 + 12345;
    for (let r = 0; r < 8; r++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      winners.push(x % 2 === 0 ? TEAM_A : TEAM_B);
    }
    named.push({
      id: `prng-seed${seed}`,
      label: `PRNG seed ${seed} — 8 rallies`,
      winners,
    });
  }

  return named;
}

function buildAllSequences(): Array<{ id: string; label: string; winners: BadmintonSide[] }> {
  const sequences: Array<{ id: string; label: string; winners: BadmintonSide[] }> = [];

  // 64 combinations × 6 rallies = 64 sequences
  const binary6 = generateAllBinarySequences(6);
  binary6.forEach((winners, i) => {
    sequences.push({
      id: `bin6-${String(i).padStart(3, "0")}`,
      label: `6-rally pattern #${i + 1}: ${winners.map(winnerLabel).join("")}`,
      winners,
    });
  });

  // 32 combinations × 7 rallies
  const binary7 = generateAllBinarySequences(7);
  binary7.forEach((winners, i) => {
    sequences.push({
      id: `bin7-${String(i).padStart(3, "0")}`,
      label: `7-rally pattern #${i + 1}: ${winners.map(winnerLabel).join("")}`,
      winners,
    });
  });

  sequences.push(...generateNamedSequences());

  return sequences;
}

function formatSequenceReport(result: SequenceResult): string {
  const lines: string[] = [];
  const status = result.passed ? "PASS" : "FAIL";

  lines.push(`${"=".repeat(72)}`);
  lines.push(`Sequence: ${result.id}  [${status}]`);
  lines.push(`Label:    ${result.label}`);
  lines.push(`Pattern:  ${result.winners.map(winnerLabel).join(" → ") || "(initial only)"}`);
  lines.push("");

  for (const t of result.transitions) {
    if (t.rallyNumber === 0) {
      lines.push("── Initial state (0-0, Team A serves, A1 → B1) ──");
      lines.push(...formatSnapshot(t.after));
      if (t.violations.length) {
        lines.push("  ✗ Violations:");
        for (const v of t.violations) lines.push(`    [${v.ruleId}] ${v.message}`);
      } else {
        lines.push("  ✓ BWF invariants satisfied");
      }
      lines.push("");
      continue;
    }

    lines.push(`── Rally ${t.rallyNumber}: ${sideLabel(t.rallyWinner!)} wins ──`);
    lines.push(`  Service transfer: ${formatTransfer(t.serviceTransfer)}`);
    lines.push("");
    lines.push("  Before:");
    lines.push(...formatSnapshot(t.before, "    "));
    lines.push("");
    lines.push("  After:");
    lines.push(...formatSnapshot(t.after, "    "));

    if (t.violations.length === 0 && t.engineMatchesOracle) {
      lines.push("");
      lines.push("  ✓ Score, server, receiver, court positions, service transfer — all valid");
    } else {
      lines.push("");
      lines.push("  ✗ Violations:");
      for (const v of t.violations) lines.push(`    [${v.ruleId}] ${v.message}`);
    }
    lines.push("");
  }

  const rallyCount = result.transitions.filter((t) => t.rallyNumber > 0).length;
  const passCount = result.transitions.filter(
    (t) => t.violations.length === 0 && t.engineMatchesOracle,
  ).length;
  lines.push(`Summary: ${passCount}/${result.transitions.length} checkpoints passed (${rallyCount} rallies)`);
  lines.push("");

  return lines.join("\n");
}

function generateFullReport(results: SequenceResult[]): string {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const totalRallies = results.reduce(
    (sum, r) => sum + r.transitions.filter((t) => t.rallyNumber > 0).length,
    0,
  );
  const totalCheckpoints = results.reduce((sum, r) => sum + r.transitions.length, 0);

  const header = [
    "╔══════════════════════════════════════════════════════════════════════╗",
    "║       BWF DOUBLES RALLY-BY-RALLY SIMULATION REPORT                   ║",
    "╚══════════════════════════════════════════════════════════════════════╝",
    "",
    "Setup:",
    "  Team A (left):  A1, A2",
    "  Team B (right): B1, B2",
    "  Toss: Team A wins → chooses Serve",
    "  First server:   A1 (Team A, right service court at 0-0)",
    "  First receiver: B1 (Team B, diagonal right service court)",
    "",
    "Validation after every rally:",
    "  • Score increment (Law 10.3.1)",
    "  • Server in correct service court for score parity (Law 10.5)",
    "  • Receiver diagonal to server (Law 10.6)",
    "  • Service retention when serving side wins (Law 10.3.3)",
    "  • Service transfer + partner swap when receiving side wins (Law 10.3.4)",
    "  • Cross-check vs independent BWF reference oracle",
    "",
    "Summary:",
    `  Sequences run:     ${results.length}`,
    `  Sequences passed:  ${passed}`,
    `  Sequences failed:  ${failed}`,
    `  Total rallies:     ${totalRallies}`,
    `  Total checkpoints: ${totalCheckpoints}`,
    "",
  ].join("\n");

  const body = results.map(formatSequenceReport).join("\n");

  const failedList =
    failed > 0
      ? [
          "FAILED SEQUENCES:",
          ...results.filter((r) => !r.passed).map((r) => `  • ${r.id}: ${r.label}`),
          "",
        ].join("\n")
      : "All sequences passed.\n";

  return `${header}\n${body}\n${"=".repeat(72)}\n${failedList}`;
}

describe("BWF doubles rally-by-rally simulation", () => {
  const sequences = buildAllSequences();

  it(`runs ${sequences.length} rally sequences (50+ required) with full BWF validation`, () => {
    expect(sequences.length).toBeGreaterThanOrEqual(50);

    const results = sequences.map((s) => simulateSequence(s.id, s.label, s.winners));
    const report = generateFullReport(results);

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, report, "utf-8");

    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed);

    // Print compact summary to test output
    console.log("\n" + report.split("\n").slice(0, 25).join("\n"));
    console.log(`\n… full report written to ${REPORT_PATH}\n`);

    if (failed.length > 0) {
      console.log("Failed sequences:");
      for (const f of failed.slice(0, 5)) {
        console.log(`  ${f.id}: ${f.transitions.find((t) => t.violations.length)?.violations[0]?.message}`);
      }
    }

    expect(failed.length, `${failed.length} sequences failed — see ${REPORT_PATH}`).toBe(0);
    expect(passed).toBe(sequences.length);
  });

  it("validates the canonical example: A1 serves to B1, mixed 8-rally sequence", () => {
    const winners: BadmintonSide[] = [TEAM_A, TEAM_A, TEAM_B, TEAM_B, TEAM_A, TEAM_B, TEAM_A, TEAM_A];
    const result = simulateSequence("canonical-8", "Canonical 8-rally demo", winners);

    expect(result.passed).toBe(true);
    expect(result.transitions[0].after.servingPlayerIndex).toBe(0);
    expect(result.transitions[0].after.receivingPlayerIndex).toBe(0);
    expect(playerName(result.transitions[0].after.servingSide, result.transitions[0].after.servingPlayerIndex)).toBe(
      "A1",
    );
    expect(
      playerName(result.transitions[0].after.receivingSide, result.transitions[0].after.receivingPlayerIndex),
    ).toBe("B1");

    // After A wins first rally: same server A1
    expect(result.transitions[1].after.servingPlayerIndex).toBe(0);
    expect(result.transitions[1].serviceTransfer).toBe("retain_same_server");
  });
});

export { simulateSequence, generateFullReport, buildAllSequences, REPORT_PATH };
