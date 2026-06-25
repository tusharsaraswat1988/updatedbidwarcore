/**
 * Badminton Realtime Sync — sequence-guarded cross-screen consistency.
 *
 * Simulates Operator + OBS + Broadcast Display on the same SSE stream.
 * Uses applyMatchStateIfNewer (production guard from useBadmintonMatch).
 *
 * Generates: lib/badminton-core/test-reports/badminton-realtime-sync-report.txt
 */

import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cmdAwardPoint, cmdStartMatch } from "../commands";
import { type BadmintonMatchStartedPayload } from "../events/badminton";
import {
  applyMatchStateIfNewer,
  mergeMatchStateCache,
} from "../match-state-guard";
import { reduceBadminton } from "../reducer/reducer";
import { createInitialBadmintonState } from "../reducer/state";
import type { BadmintonMatchState, BadmintonSide } from "../types";
import {
  diffSyncSnapshots,
  extractSyncSnapshot,
  syncSnapshotsEqual,
  type BadmintonSyncSnapshot,
} from "../sync-snapshot";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPORT_PATH = join(__dirname, "../../test-reports/badminton-realtime-sync-report.txt");

const TOURNAMENT_ID = 100;
const MATCH_ID = 42;
const RALLY_COUNT = 100;
const DUPLICATE_INJECTIONS = 10;
const OUT_OF_ORDER_INJECTIONS = 10;

type ScreenRole = "operator" | "obs" | "display";

type SseDelivery = {
  sequence: number;
  deliveredAtMs: number;
  applied: boolean;
  rejectReason?: "duplicate" | "stale";
};

class SimulatedScreen {
  readonly role: ScreenRole;
  state: BadmintonMatchState | null = null;
  detail: unknown = null;
  sseReceived: SseDelivery[] = [];
  stateRegressions = 0;

  constructor(role: ScreenRole) {
    this.role = role;
  }

  private guardedApply(incoming: BadmintonMatchState): boolean {
    const beforeSeq = this.state?.lastSequence ?? 0;
    const result = applyMatchStateIfNewer(this.state, incoming);
    const afterSeq = result.state.lastSequence ?? 0;
    if (this.state != null && afterSeq < beforeSeq) {
      this.stateRegressions += 1;
    }
    this.state = result.state;
    return result.applied;
  }

  /** Operator: optimistic update (always ahead — no guard). */
  applyOptimistic(next: BadmintonMatchState): void {
    this.state = next;
  }

  /** Operator: POST response — guarded like production mergeMatchStateCache. */
  applyPostResponse(next: BadmintonMatchState): void {
    const merged = mergeMatchStateCache(
      this.state ? { state: this.state, detail: this.detail } : null,
      next,
    );
    this.state = merged.state;
    this.detail = merged.detail;
  }

  /** All screens: SSE match_state — guarded. */
  applySse(next: BadmintonMatchState, atMs: number): void {
    const beforeSeq = this.state?.lastSequence ?? 0;
    const applied = this.guardedApply(next);
    const rejectReason =
      !applied && next.lastSequence === beforeSeq
        ? "duplicate"
        : !applied
          ? "stale"
          : undefined;
    this.sseReceived.push({
      sequence: next.lastSequence,
      deliveredAtMs: atMs,
      applied,
      rejectReason,
    });
  }

  /** Reconnect bootstrap via REST (always accept when empty; guarded when not). */
  applyReconnectSnapshot(next: BadmintonMatchState): void {
    this.guardedApply(next);
  }

  snapshot(): BadmintonSyncSnapshot | null {
    return this.state ? extractSyncSnapshot(this.state) : null;
  }
}

const SYNC_TEST_FORMAT = {
  totalGames: 1,
  pointsPerGame: 150,
  deuceAt: 149,
  maxPoints: 200,
  midGameSideChange: false,
};

const DOUBLES_START: BadmintonMatchStartedPayload = {
  matchKind: "doubles",
  format: SYNC_TEST_FORMAT,
  leftSide: {
    label: "A1 / A2",
    shortLabel: "A",
    playerIds: [1, 2],
    players: [
      { label: "A1", shortLabel: "A1" },
      { label: "A2", shortLabel: "A2" },
    ],
  },
  rightSide: {
    label: "B1 / B2",
    shortLabel: "B",
    playerIds: [3, 4],
    players: [
      { label: "B1", shortLabel: "B1" },
      { label: "B2", shortLabel: "B2" },
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

function applyCommandEvents(
  state: BadmintonMatchState,
  events: Array<{ eventType: string; payload: Record<string, unknown> }>,
): BadmintonMatchState {
  let next = state;
  let seq = state.lastSequence ?? 0;
  for (const event of events) {
    seq += 1;
    next = reduceBadminton(next, {
      matchId: MATCH_ID,
      tournamentId: TOURNAMENT_ID,
      sportSlug: "badminton",
      eventType: event.eventType,
      eventVersion: 1,
      sequence: seq,
      actorType: "scorer",
      payload: event.payload,
    });
  }
  return next;
}

function startDoublesMatch(): BadmintonMatchState {
  let state = createInitialBadmintonState({
    matchId: MATCH_ID,
    tournamentId: TOURNAMENT_ID,
    matchKind: "doubles",
    format: SYNC_TEST_FORMAT,
  });
  const start = cmdStartMatch(state, DOUBLES_START);
  if (!start.ok) throw new Error(start.error);
  return applyCommandEvents(state, start.events);
}

function rallyWinnerFor(rallyIndex: number): BadmintonSide {
  const pattern = rallyIndex % 7;
  if (pattern === 0 || pattern === 1) return "left";
  if (pattern === 2 || pattern === 3 || pattern === 4) return "right";
  return rallyIndex % 2 === 0 ? "left" : "right";
}

type AuthoritativeStep = {
  rally: number;
  state: BadmintonMatchState;
  snapshot: BadmintonSyncSnapshot;
  committedAtMs: number;
};

function awardRally(state: BadmintonMatchState, rally: number): BadmintonMatchState | null {
  if (state.matchStatus !== "live") return null;
  const side = rallyWinnerFor(rally);
  const result = cmdAwardPoint(state, side);
  if (!result.ok) return null;
  return applyCommandEvents(state, result.events);
}

function buildAuthoritativeTimeline(rallyCount: number): AuthoritativeStep[] {
  let state = startDoublesMatch();
  const steps: AuthoritativeStep[] = [];
  let t = 0;

  for (let rally = 1; rally <= rallyCount; rally++) {
    const next = awardRally(state, rally);
    if (!next) break;
    state = next;
    t += 3;
    steps.push({
      rally,
      state,
      snapshot: extractSyncSnapshot(state),
      committedAtMs: t,
    });
  }
  return steps;
}

function initScreens(): SimulatedScreen[] {
  const initial = startDoublesMatch();
  return (["operator", "obs", "display"] as ScreenRole[]).map((role) => {
    const s = new SimulatedScreen(role);
    s.state = initial;
    return s;
  });
}

function verifyAllScreens(
  screens: SimulatedScreen[],
  auth: BadmintonSyncSnapshot,
  rally: number,
): Array<{ rally: number; role: ScreenRole; diffs: string[] }> {
  const failures: Array<{ rally: number; role: ScreenRole; diffs: string[] }> = [];
  for (const screen of screens) {
    const snap = screen.snapshot();
    if (!snap || !syncSnapshotsEqual(snap, auth)) {
      failures.push({
        rally,
        role: screen.role,
        diffs: snap ? diffSyncSnapshots(auth, snap) : ["no state"],
      });
    }
  }
  return failures;
}

function injectionRallies(count: number, offset: number, stride: number): Set<number> {
  const rallies = new Set<number>();
  for (let i = 0; i < count; i++) {
    rallies.add(offset + i * stride);
  }
  return rallies;
}

type SimulationResult = {
  ralliesCompleted: number;
  mismatches: Array<{ rally: number; role: ScreenRole; diffs: string[] }>;
  duplicateDeliveries: number;
  outOfOrderDeliveries: number;
  stateRegressions: number;
  rejectedStale: number;
  rejectedDuplicate: number;
};

function runGuardedSimulation(opts: {
  rallyCount: number;
  duplicateRallies: Set<number>;
  outOfOrderRallies: Set<number>;
  sseDelayMs: Record<ScreenRole, number>;
  delayedDelivery?: { rally: number; delayExtraMs: number };
}): SimulationResult {
  const steps = buildAuthoritativeTimeline(opts.rallyCount);
  const screens = initScreens();
  const [operator] = screens;
  const mismatches: SimulationResult["mismatches"] = [];

  let duplicateDeliveries = 0;
  let outOfOrderDeliveries = 0;
  let rejectedStale = 0;
  let rejectedDuplicate = 0;

  for (const step of steps) {
    const { rally, state, snapshot, committedAtMs } = step;
    const prevState = rally > 1 ? steps[rally - 2].state : state;

    operator.applyOptimistic(state);
    operator.applyPostResponse(state);

    for (const screen of screens) {
      const delay = opts.sseDelayMs[screen.role];
      screen.applySse(state, committedAtMs + delay);
    }

    if (opts.duplicateRallies.has(rally)) {
      for (const screen of screens) {
        const delivery = screen.applySse.bind(screen);
        const before = screen.sseReceived.length;
        delivery(state, committedAtMs + opts.sseDelayMs[screen.role] + 1);
        const last = screen.sseReceived[screen.sseReceived.length - 1];
        if (!last.applied && last.rejectReason === "duplicate") {
          rejectedDuplicate += 1;
        }
        duplicateDeliveries += 1;
        void before;
      }
    }

    if (opts.outOfOrderRallies.has(rally) && rally > 1) {
      const staleState = prevState;
      for (const screen of screens) {
        screen.applySse(staleState, committedAtMs + opts.sseDelayMs[screen.role] + 5);
        const last = screen.sseReceived[screen.sseReceived.length - 1];
        if (!last.applied && last.rejectReason === "stale") {
          rejectedStale += 1;
        }
        outOfOrderDeliveries += 1;
      }
    }

    if (opts.delayedDelivery?.rally === rally && rally > 2) {
      const delayedState = steps[rally - 3].state;
      for (const screen of screens) {
        screen.applySse(
          delayedState,
          committedAtMs + opts.delayedDelivery.delayExtraMs,
        );
        const last = screen.sseReceived[screen.sseReceived.length - 1];
        if (!last.applied && last.rejectReason === "stale") {
          rejectedStale += 1;
        }
      }
    }

    mismatches.push(...verifyAllScreens(screens, snapshot, rally));
  }

  return {
    ralliesCompleted: steps.length,
    mismatches,
    duplicateDeliveries,
    outOfOrderDeliveries,
    stateRegressions: screens.reduce((n, s) => n + s.stateRegressions, 0),
    rejectedStale,
    rejectedDuplicate,
  };
}

const DEFAULT_DELAYS: Record<ScreenRole, number> = {
  operator: 2,
  obs: 8,
  display: 12,
};

describe("Badminton realtime sequence guard", () => {
  it("1. duplicate SSE — ignores replays, no divergence", () => {
    const steps = buildAuthoritativeTimeline(20);
    const obs = new SimulatedScreen("obs");
    obs.state = startDoublesMatch();

    for (const step of steps) {
      obs.applySse(step.state, step.committedAtMs);
      obs.applySse(step.state, step.committedAtMs + 1);
    }

    const last = steps[steps.length - 1];
    expect(obs.snapshot()).toEqual(last.snapshot);
    expect(obs.sseReceived.filter((d) => d.rejectReason === "duplicate").length).toBe(20);
    expect(obs.stateRegressions).toBe(0);
  });

  it("2. out-of-order SSE — stale snapshot rejected", () => {
    const steps = buildAuthoritativeTimeline(15);
    const display = new SimulatedScreen("display");
    display.state = startDoublesMatch();

    for (const step of steps) {
      display.applySse(step.state, step.committedAtMs + 1);
      if (step.rally > 1) {
        display.applySse(steps[step.rally - 2].state, step.committedAtMs + 2);
      }
    }

    expect(display.snapshot()).toEqual(steps[steps.length - 1].snapshot);
    expect(display.sseReceived.some((d) => d.rejectReason === "stale")).toBe(true);
    expect(display.stateRegressions).toBe(0);
  });

  it("3. reconnect — stale bootstrap ignored when client is ahead", () => {
    const steps = buildAuthoritativeTimeline(30);
    const obs = new SimulatedScreen("obs");
    obs.state = steps[19].state;

    obs.applyReconnectSnapshot(steps[14].state);
    expect(obs.state?.lastSequence).toBe(steps[19].state.lastSequence);

    obs.applyReconnectSnapshot(steps[25].state);
    expect(obs.snapshot()).toEqual(steps[25].snapshot);
  });

  it("4. delayed delivery — older event arrives after newer", () => {
    const steps = buildAuthoritativeTimeline(25);
    const display = new SimulatedScreen("display");
    display.state = steps[0].state;

    display.applySse(steps[10].state, 100);
    display.applySse(steps[12].state, 101);
    display.applySse(steps[11].state, 102);

    expect(display.snapshot()).toEqual(steps[12].snapshot);
    expect(display.sseReceived.filter((d) => d.rejectReason === "stale").length).toBeGreaterThan(0);
  });

  it("5. rapid scoring — 100 rallies, all screens converge", () => {
    const result = runGuardedSimulation({
      rallyCount: RALLY_COUNT,
      duplicateRallies: new Set(),
      outOfOrderRallies: new Set(),
      sseDelayMs: DEFAULT_DELAYS,
    });

    expect(result.ralliesCompleted).toBe(RALLY_COUNT);
    expect(result.mismatches).toHaveLength(0);
    expect(result.stateRegressions).toBe(0);
  });

  it("combined: 100 rallies + 10 duplicates + 10 out-of-order → 0 mismatches", () => {
    const dupRallies = injectionRallies(DUPLICATE_INJECTIONS, 5, 10);
    const oooRallies = injectionRallies(OUT_OF_ORDER_INJECTIONS, 8, 10);

    const result = runGuardedSimulation({
      rallyCount: RALLY_COUNT,
      duplicateRallies: dupRallies,
      outOfOrderRallies: oooRallies,
      sseDelayMs: DEFAULT_DELAYS,
      delayedDelivery: { rally: 55, delayExtraMs: 500 },
    });

    const report = [
      "BADMINTON REALTIME SYNC — SEQUENCE GUARD ENABLED",
      "",
      `Rallies: ${result.ralliesCompleted} / ${RALLY_COUNT}`,
      `Duplicate SSE injections: ${result.duplicateDeliveries} (${DUPLICATE_INJECTIONS} rallies × 3 screens)`,
      `Out-of-order SSE injections: ${result.outOfOrderDeliveries} (${OUT_OF_ORDER_INJECTIONS} rallies × 3 screens)`,
      `Rejected duplicates: ${result.rejectedDuplicate}`,
      `Rejected stale/OOO: ${result.rejectedStale}`,
      `State regressions: ${result.stateRegressions}`,
      `Cross-screen mismatches: ${result.mismatches.length}`,
      "",
      result.mismatches.length === 0
        ? "PASS — score, server, receiver, court positions identical on operator, OBS, display after every rally."
        : "FAIL — see mismatch details in test output.",
    ].join("\n");

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, report, "utf-8");

    expect(result.ralliesCompleted).toBe(RALLY_COUNT);
    expect(result.duplicateDeliveries).toBe(DUPLICATE_INJECTIONS * 3);
    expect(result.outOfOrderDeliveries).toBe(OUT_OF_ORDER_INJECTIONS * 3);
    expect(result.mismatches).toHaveLength(0);
    expect(result.stateRegressions).toBe(0);
    expect(result.rejectedDuplicate).toBeGreaterThanOrEqual(DUPLICATE_INJECTIONS * 3);
    expect(result.rejectedStale).toBeGreaterThanOrEqual(OUT_OF_ORDER_INJECTIONS * 3);
  });
});
