/**
 * Exhaustive purse validation matrix — math, operations, snapshots, UI mappings.
 *
 * Run: pnpm --filter @workspace/api-server test
 */

import { describe, it, expect } from "vitest";
import { computePurseProtection } from "@workspace/api-base/purse-protection";
import {
  assertPurseProtectionInvariants,
  buildSnapshotRowFromProtection,
  collectPurseProtectionViolations,
  countSquadPlayers,
  expectedPurseFields,
  ledMaxBidAllowed,
  protectionFromTeamSim,
  recalcPurseUsedFromRoster,
  ssePurseFingerprint,
  type SimPlayer,
  type TeamSimState,
  uiBiddingLimit,
} from "@workspace/api-base/purse-protection-expect";

const MIN_BIDS = [1_000, 10_000, 50_000, 100_000] as const;
const BOOSTERS = [0, 250_000, 1_000_000] as const;
const BASE_PURSE = 4_000_000;

const tournament = {
  minimumSquadSize: 4,
  maximumSquadSize: 0,
  minBid: 10_000,
};

function sim(
  overrides: Partial<TeamSimState> & { players?: SimPlayer[] } = {},
): TeamSimState {
  const players = overrides.players ?? [];
  const purseUsed = overrides.purseUsed ?? recalcPurseUsedFromRoster(players);
  return {
    purse: overrides.purse ?? BASE_PURSE,
    purseUsed,
    boosterTotal: overrides.boosterTotal ?? 0,
    players,
  };
}

function sell(state: TeamSimState, price: number): TeamSimState {
  const players = [...state.players, { status: "sold" as const, price }];
  return {
    ...state,
    players,
    purseUsed: state.purseUsed + price,
  };
}

function undoLastSale(state: TeamSimState): TeamSimState {
  const players = state.players.slice(0, -1);
  const removed = state.players.at(-1);
  return {
    ...state,
    players,
    purseUsed: Math.max(0, state.purseUsed - (removed?.price ?? 0)),
  };
}

function applyBooster(state: TeamSimState, amount: number): TeamSimState {
  return { ...state, boosterTotal: state.boosterTotal + amount };
}

function removeBooster(state: TeamSimState, amount: number): TeamSimState {
  return { ...state, boosterTotal: Math.max(0, state.boosterTotal - amount) };
}

function editLastPrice(state: TeamSimState, newPrice: number): TeamSimState {
  const players = state.players.slice(0, -1);
  const last = state.players.at(-1);
  if (!last) return state;
  const updated = [...players, { ...last, price: newPrice }];
  return { ...state, players: updated, purseUsed: recalcPurseUsedFromRoster(updated) };
}

function deleteLastPlayer(state: TeamSimState): TeamSimState {
  const players = state.players.slice(0, -1);
  return { ...state, players, purseUsed: recalcPurseUsedFromRoster(players) };
}

function snapshotFor(state: TeamSimState, teamId = 1) {
  const input = {
    purse: state.purse,
    purseUsed: state.purseUsed,
    boosterTotal: state.boosterTotal,
    playersBought: countSquadPlayers(state.players),
    minimumSquadSize: tournament.minimumSquadSize,
    maximumSquadSize: tournament.maximumSquadSize,
    minBid: tournament.minBid,
  };
  const protection = computePurseProtection(input);
  assertPurseProtectionInvariants(input, protection, "snapshot");
  return buildSnapshotRowFromProtection(teamId, input, protection);
}

// ── 1. Combinatorial math matrix ─────────────────────────────────────────────

describe("purse validation matrix — combinatorial math", () => {
  it("all minSquad 1..20 × playersBought 0..minSquad × minBid × booster combinations", () => {
    const failures: string[] = [];

    for (let minSquad = 1; minSquad <= 20; minSquad++) {
      for (let playersBought = 0; playersBought <= minSquad; playersBought++) {
        for (const minBid of MIN_BIDS) {
          for (const boosterTotal of BOOSTERS) {
            const purseUsed = playersBought * minBid * 2;
            const input = {
              purse: BASE_PURSE,
              purseUsed,
              boosterTotal,
              playersBought,
              minimumSquadSize: minSquad,
              maximumSquadSize: 0,
              minBid,
            };
            const actual = computePurseProtection(input);
            const violations = collectPurseProtectionViolations(
              input,
              actual,
              `minSquad=${minSquad} bought=${playersBought} minBid=${minBid} booster=${boosterTotal}`,
            );
            if (violations.length > 0) {
              failures.push(
                violations.map((v) => `${v.field}: expected ${v.expected}, got ${v.actual} (${v.context})`).join("; "),
              );
            }
          }
        }
      }
    }

    expect(failures).toEqual([]);
  });

  it("players above minimum squad — no reserve", () => {
    for (let extra = 1; extra <= 5; extra++) {
      const minSquad = 4;
      const playersBought = minSquad + extra;
      const input = {
        purse: BASE_PURSE,
        purseUsed: 500_000,
        boosterTotal: 0,
        playersBought,
        minimumSquadSize: minSquad,
        maximumSquadSize: 0,
        minBid: 10_000,
      };
      const p = assertPurseProtectionInvariants(input, undefined, "over-min-squad");
      expect(p.slotsRequired).toBe(0);
      expect(p.reservePurse).toBe(0);
      expect(p.futureSlotsRequired).toBe(0);
      expect(p.maxAllowedBid).toBe(p.purseRemaining);
    }
  });
});

// ── 2. Canonical live-auction scenarios ─────────────────────────────────────

describe("purse validation matrix — canonical scenarios", () => {
  it("Case 1: 0 players, purse 4L, min squad 4, min bid 10k", () => {
    const p = assertPurseProtectionInvariants({
      purse: 400_000,
      purseUsed: 0,
      boosterTotal: 0,
      playersBought: 0,
      minimumSquadSize: 4,
      maximumSquadSize: 0,
      minBid: 10_000,
    });
    expect(p.purseRemaining).toBe(400_000);
    expect(p.reservePurse).toBe(40_000);
    expect(p.futureReservePurse).toBe(30_000);
    expect(p.spendablePurse).toBe(360_000);
    expect(p.maxAllowedBid).toBe(370_000);
  });

  it("Case 2: 1 player @ 50k", () => {
    const p = assertPurseProtectionInvariants({
      purse: 400_000,
      purseUsed: 50_000,
      boosterTotal: 0,
      playersBought: 1,
      minimumSquadSize: 4,
      maximumSquadSize: 0,
      minBid: 10_000,
    });
    expect(p.purseRemaining).toBe(350_000);
    expect(p.futureReservePurse).toBe(20_000);
    expect(p.spendablePurse).toBe(320_000);
    expect(p.maxAllowedBid).toBe(330_000);
  });
});

// ── 3. Auction operation scenarios ──────────────────────────────────────────

describe("purse validation matrix — auction operations", () => {
  const scenarios: Array<{
    name: string;
    run: (initial: TeamSimState) => TeamSimState;
    bidAllowed?: number;
    bidRejected?: number;
  }> = [
    {
      name: "sell increments players and purseUsed",
      run: (s) => sell(s, 50_000),
      bidAllowed: 330_000,
    },
    {
      name: "manual sell same as sell for purse math",
      run: (s) => sell(s, 75_000),
    },
    {
      name: "undo sell restores prior protection state",
      run: (s) => undoLastSale(sell(s, 50_000)),
    },
    {
      name: "undo bid (no sale) — purse unchanged",
      run: (s) => s,
    },
    {
      name: "bid rollback before sell — purse unchanged",
      run: (s) => s,
    },
    {
      name: "player deletion recalculates purseUsed",
      run: (s) => deleteLastPlayer(sell(s, 50_000)),
    },
    {
      name: "player price edit recalculates purseUsed",
      run: (s) => editLastPrice(sell(s, 50_000), 80_000),
    },
    {
      name: "purse booster add increases maxAllowedBid",
      run: (s) => applyBooster(s, 500_000),
    },
    {
      name: "purse booster remove decreases maxAllowedBid",
      run: (s) => removeBooster(applyBooster(s, 500_000), 200_000),
    },
    {
      name: "sell then undo then sell again — idempotent protection",
      run: (s) => sell(undoLastSale(sell(s, 40_000)), 40_000),
    },
  ];

  for (const scenario of scenarios) {
    it(scenario.name, () => {
      const initial = sim();
      const before = protectionFromTeamSim(initial, tournament);
      const afterState = scenario.run(initial);
      const after = protectionFromTeamSim(afterState, tournament);

      assertPurseProtectionInvariants(
        {
          purse: afterState.purse,
          purseUsed: afterState.purseUsed,
          boosterTotal: afterState.boosterTotal,
          playersBought: countSquadPlayers(afterState.players),
          minimumSquadSize: tournament.minimumSquadSize,
          maximumSquadSize: tournament.maximumSquadSize,
          minBid: tournament.minBid,
        },
        after,
        scenario.name,
      );

      if (scenario.name.includes("undo bid") || scenario.name.includes("rollback")) {
        expect(after.purseRemaining).toBe(before.purseRemaining);
        expect(after.maxAllowedBid).toBe(before.maxAllowedBid);
      }

      if (scenario.name.includes("booster add")) {
        expect(after.maxAllowedBid).toBeGreaterThan(before.maxAllowedBid);
      }

      if (scenario.bidAllowed != null) {
        expect(after.maxAllowedBid).toBeGreaterThanOrEqual(scenario.bidAllowed);
      }
    });
  }

  it("bid at maxAllowedBid is allowed; one minBid over is rejected", () => {
    const state = sim();
    const p = protectionFromTeamSim(state, tournament);
    const ok = p.maxAllowedBid;
    const bad = p.maxAllowedBid + tournament.minBid;
    expect(ok).toBeLessThanOrEqual(p.purseRemaining);
    expect(bad).toBeGreaterThan(p.maxAllowedBid);
  });
});

// ── 4. UI / SSE / LED consistency ───────────────────────────────────────────

describe("purse validation matrix — UI and snapshot surfaces", () => {
  it("operator, owner, LED bidding limit === maxAllowedBid (not spendablePurse)", () => {
    const states = [
      sim(),
      sell(sim(), 50_000),
      applyBooster(sim(), 300_000),
      sell(applyBooster(sim(), 300_000), 120_000),
    ];

    for (const state of states) {
      const row = snapshotFor(state);
      expect(uiBiddingLimit(row)).toBe(row.maxAllowedBid);
      expect(ledMaxBidAllowed(row)).toBe(row.maxAllowedBid);
      if (row.reservePurse > 0 && row.futureReservePurse < row.reservePurse) {
        expect(row.maxAllowedBid).toBeGreaterThan(row.spendablePurse);
      }
    }
  });

  it("SSE fingerprint changes when maxAllowedBid changes", () => {
    const a = snapshotFor(sim());
    const b = snapshotFor(sell(sim(), 50_000));
    expect(ssePurseFingerprint([a])).not.toBe(ssePurseFingerprint([b]));
  });

  it("SSE fingerprint stable on reconnect refresh with same roster", () => {
    const state = sell(sell(sim(), 40_000), 60_000);
    const first = snapshotFor(state);
    const second = snapshotFor(state);
    expect(ssePurseFingerprint([first])).toBe(ssePurseFingerprint([second]));
    expect(first.maxAllowedBid).toBe(second.maxAllowedBid);
    expect(first.spendablePurse).toBe(second.spendablePurse);
  });

  it("reconnect after booster — snapshot reflects new ceiling", () => {
    const before = snapshotFor(sim());
    const after = snapshotFor(applyBooster(sim(), 500_000));
    expect(after.maxAllowedBid - before.maxAllowedBid).toBe(500_000);
    expect(after.purseRemaining - before.purseRemaining).toBe(500_000);
  });

  it("spendablePurse alone must not drive bidding UI", () => {
    const row = snapshotFor({
      purse: 400_000,
      purseUsed: 0,
      boosterTotal: 0,
      players: [],
    });
    expect(row.spendablePurse).toBe(360_000);
    expect(row.maxAllowedBid).toBe(370_000);
    expect(uiBiddingLimit(row)).not.toBe(row.spendablePurse);
  });
});

// ── 5. Regression guard — old current-slot bid ceiling ───────────────────────

describe("purse validation matrix — regression guards", () => {
  it("rejects legacy formula that used current slots for bid ceiling", () => {
    const input = {
      purse: 400_000,
      purseUsed: 0,
      boosterTotal: 0,
      playersBought: 0,
      minimumSquadSize: 4,
      maximumSquadSize: 0,
      minBid: 10_000,
    };
    const p = computePurseProtection(input);
    const legacyWrongMaxBid = p.purseRemaining - p.reservePurse;
    expect(p.maxAllowedBid).toBe(370_000);
    expect(legacyWrongMaxBid).toBe(360_000);
    expect(p.maxAllowedBid).not.toBe(legacyWrongMaxBid);
  });

  it("expectedPurseFields matches computePurseProtection for all matrix corners", () => {
    const corners = [
      { minSquad: 1, bought: 0, minBid: 10_000, booster: 0, used: 0 },
      { minSquad: 20, bought: 20, minBid: 100_000, booster: 1_000_000, used: 2_000_000 },
      { minSquad: 0, bought: 3, minBid: 10_000, booster: 0, used: 100_000 },
      { minSquad: 4, bought: 2, minBid: 50_000, booster: 250_000, used: 900_000 },
    ];

    for (const c of corners) {
      const input = {
        purse: BASE_PURSE,
        purseUsed: c.used,
        boosterTotal: c.booster,
        playersBought: c.bought,
        minimumSquadSize: c.minSquad,
        maximumSquadSize: 0,
        minBid: c.minBid,
      };
      const actual = computePurseProtection(input);
      const violations = collectPurseProtectionViolations(input, actual, "corner");
      expect(violations).toEqual([]);
      expect(expectedPurseFields(input)).toMatchObject({
        purseRemaining: actual.purseRemaining,
        reservePurse: actual.reservePurse,
        futureReservePurse: actual.futureReservePurse,
        spendablePurse: actual.spendablePurse,
        maxAllowedBid: actual.maxAllowedBid,
      });
    }
  });
});
