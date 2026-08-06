/**
 * EPIC-11 Phase 2 — Scoring consumers of RuntimeExecutionPolicy-derived rules.
 */
import { describe, expect, it } from "vitest";
import {
  RUNTIME_EXECUTION_POLICY_SOURCE,
  availableDismissalTypes,
  buildMatchMetaFromRules,
  createInitialCricketState,
  executionLimitsFromRules,
} from "../index.ts";

const corporateBoxRules = {
  overs: 6,
  maxWickets: 10,
  playingSquadSize: 8,
  benchSize: 2,
  ballsPerOver: 6,
  ballType: "tennis",
  lbwEnabled: false,
  freeHitEnabled: true,
  retireAtRuns: 30,
  powerplayEnabled: false,
  superOverEnabled: true,
  tiesAllowed: true,
  source: RUNTIME_EXECUTION_POLICY_SOURCE,
};

describe("EPIC-11 Phase 2 — MatchMeta from RuntimeExecutionPolicy", () => {
  it("builds MatchMeta from Corporate Box policy rules without inventing defaults", () => {
    const meta = buildMatchMetaFromRules({
      matchId: 1,
      tournamentId: 9,
      homeTeamId: 10,
      awayTeamId: 20,
      rules: corporateBoxRules,
      ruleResolution: {
        resolutionId: "res_cb",
        rulesHash: "hash_cb",
        runtimeRulesVersion: "1.0.0",
        snapshotVersion: 1,
      },
    });

    expect(meta.oversLimit).toBe(6);
    expect(meta.playingSquadSize).toBe(8);
    expect(meta.benchSize).toBe(2);
    expect(meta.lbwEnabled).toBe(false);
    expect(meta.retireAtRuns).toBe(30);
    expect(meta.freeHitEnabled).toBe(true);
    expect(meta.executionRulesSource).toBe(RUNTIME_EXECUTION_POLICY_SOURCE);
    expect(meta.resolutionId).toBe("res_cb");
    expect(meta.rulesHash).toBe("hash_cb");
    expect(meta.runtimeRulesVersion).toBe("1.0.0");
  });

  it("MATCH_STARTED overs originate from policy MatchMeta (Corporate Box = 6)", () => {
    const meta = buildMatchMetaFromRules({
      matchId: 2,
      tournamentId: 9,
      homeTeamId: 1,
      awayTeamId: 2,
      rules: corporateBoxRules,
      ruleResolution: {
        resolutionId: "r",
        rulesHash: "h",
        runtimeRulesVersion: "1.0.0",
        snapshotVersion: 2,
      },
    });
    // Server forces payload.oversLimit = matchMeta.oversLimit
    const matchStartedPayload = {
      tossWinnerTeamId: 1,
      electedTo: "bat" as const,
      oversLimit: meta.oversLimit,
    };
    expect(matchStartedPayload.oversLimit).toBe(6);
    expect(meta.executionRulesSource).toBe(RUNTIME_EXECUTION_POLICY_SOURCE);
  });

  it("initial state uses policy overs/maxWickets", () => {
    const meta = buildMatchMetaFromRules({
      matchId: 3,
      tournamentId: 9,
      homeTeamId: 1,
      awayTeamId: 2,
      rules: corporateBoxRules,
    });
    const state = createInitialCricketState(meta);
    expect(state.oversLimit).toBe(6);
    expect(state.maxWickets).toBe(10);
  });

  it("removes LBW from available dismissals when lbwEnabled is false", () => {
    const types = availableDismissalTypes(false);
    expect(types).not.toContain("lbw");
    expect(types).toContain("bowled");
    expect(types).toContain("caught");

    const withLbw = availableDismissalTypes(true);
    expect(withLbw).toContain("lbw");
  });

  it("Corporate Box squad limits are 8 / 2", () => {
    const meta = buildMatchMetaFromRules({
      matchId: 4,
      tournamentId: 9,
      homeTeamId: 1,
      awayTeamId: 2,
      rules: corporateBoxRules,
    });
    expect(meta.playingSquadSize).toBe(8);
    expect(meta.benchSize).toBe(2);
    // Lineup validation: length must be <= playingSquadSize
    const xi = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(xi.length).toBeLessThanOrEqual(meta.playingSquadSize!);
    expect([1, 2].length).toBeLessThanOrEqual(meta.benchSize!);

    const limits = executionLimitsFromRules(corporateBoxRules);
    expect(limits.fromPolicy).toBe(true);
    expect(limits.oversLimit).toBe(6);
    expect(limits.playingSquadSize).toBe(8);
    expect(limits.benchSize).toBe(2);
  });

  it("respects retireAtRuns = 30 from policy", () => {
    const meta = buildMatchMetaFromRules({
      matchId: 5,
      tournamentId: 9,
      homeTeamId: 1,
      awayTeamId: 2,
      rules: corporateBoxRules,
    });
    expect(meta.retireAtRuns).toBe(30);
    const strikerRuns = 30;
    expect(strikerRuns >= (meta.retireAtRuns ?? Infinity)).toBe(true);
  });
});

describe("EPIC-11 Phase 2 — no Rule Engine / Catalog in MatchMeta builder", () => {
  it("execution-rules module does not reference RuleEngine or CatalogRegistry", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(
      new URL("../cricket/execution-rules.ts", import.meta.url),
      "utf8",
    );
    expect(src).not.toMatch(/RuleEngine/);
    expect(src).not.toMatch(/CatalogRegistry/);
    expect(src).not.toMatch(/rule-engine/);
    expect(src).not.toMatch(/@workspace\/platform-core\/catalog/);
  });

  it("cricket reducer has no Rule Engine or Catalog imports", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile(new URL("../cricket/reducer.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/RuleEngine/);
    expect(src).not.toMatch(/CatalogRegistry/);
    expect(src).not.toMatch(/@workspace\/platform-core\/rule-engine/);
    expect(src).not.toMatch(/@workspace\/platform-core\/catalog/);
  });
});
