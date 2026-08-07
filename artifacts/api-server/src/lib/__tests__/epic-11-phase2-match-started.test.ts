/**
 * EPIC-11 Phase 2 — MATCH_STARTED payload forced from MatchMeta.
 */
import { describe, expect, it } from "vitest";
import {
  RUNTIME_EXECUTION_POLICY_SOURCE,
  buildMatchMetaFromRules,
} from "@workspace/scoring-core";

describe("EPIC-11 Phase 2 MATCH_STARTED from policy MatchMeta", () => {
  it("forces oversLimit from RuntimeExecutionPolicy-derived MatchMeta", () => {
    const meta = buildMatchMetaFromRules({
      matchId: 10,
      tournamentId: 1,
      homeTeamId: 1,
      awayTeamId: 2,
      rules: {
        overs: 6,
        maxWickets: 10,
        playingSquadSize: 8,
        benchSize: 2,
        lbwEnabled: false,
        freeHitEnabled: true,
        retireAtRuns: 30,
        source: RUNTIME_EXECUTION_POLICY_SOURCE,
      },
      ruleResolution: {
        resolutionId: "res",
        rulesHash: "hash",
        runtimeRulesVersion: "1.0.0",
        snapshotVersion: 3,
      },
    });

    // Mirrors scoring-service appendScoringEvent MATCH_STARTED rewrite.
    const clientPayload = {
      tossWinnerTeamId: 1,
      electedTo: "bat",
      oversLimit: 20, // stale UI default — must be overwritten
    };
    const serverPayload = {
      ...clientPayload,
      oversLimit: meta.oversLimit,
    };

    expect(meta.executionRulesSource).toBe(RUNTIME_EXECUTION_POLICY_SOURCE);
    expect(serverPayload.oversLimit).toBe(6);
    expect(serverPayload.oversLimit).not.toBe(20);
  });
});
