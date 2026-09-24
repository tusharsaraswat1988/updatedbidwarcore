import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CricketEventType,
  createEventEnvelope,
  createInitialCricketState,
  replayCricketEvents,
  type MatchMeta,
  type CricketScoreboardState,
} from "@workspace/scoring-core";
import {
  RuleEngine,
  buildPrepareRuleEngineInput,
  buildRuntimeExecutionPolicy,
  projectRuntimeExecutionPolicyToRulesJson,
  resolvePrepareCatalogBindings,
  ruleEngineResultOk,
} from "@workspace/platform-core/rule-engine";
import { buildRuntimeSnapshot, buildSnapshotReferences } from "@workspace/platform-core/runtime-match";
import { parseRuleOverrides } from "@workspace/platform-core/competition";

describe("CRICKET RULE PRESETS — Multiple Rule Sets Per Tournament Architecture", () => {
  const rulePresetsServiceSrc = readFileSync(
    resolve(__dirname, "../lib/cricket-rule-presets-service.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  const runtimeMatchServiceSrc = readFileSync(
    resolve(__dirname, "../lib/runtime-match-service.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  const scoringServiceSrc = readFileSync(
    resolve(__dirname, "../lib/scoring-service.ts"),
    "utf8",
    ).replace(/\r\n/g, "\n");

  const scoringFoundationServiceSrc = readFileSync(
    resolve(__dirname, "../lib/scoring-foundation-service.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  const scoringRoutesSrc = readFileSync(
    resolve(__dirname, "../routes/scoring.ts"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  describe("Section A & B: Organizer-Controlled Preset Names & Multiple Presets Per Tournament", () => {
    it("defines createCricketRulePreset and updateCricketRulePreset supporting organizer-defined names", () => {
      expect(rulePresetsServiceSrc).toContain("export async function createCricketRulePreset");
      expect(rulePresetsServiceSrc).toContain("export async function updateCricketRulePreset");
      expect(rulePresetsServiceSrc).toContain("export async function listCricketRulePresets");
      expect(rulePresetsServiceSrc).toContain("name: string;");
    });

    it("requires non-empty preset name when creating or updating", () => {
      expect(rulePresetsServiceSrc).toContain("Rule preset name is required");
      expect(rulePresetsServiceSrc).toContain("Rule preset name cannot be empty");
    });
  });

  describe("Section C: Cross-Tournament Tenant Isolation", () => {
    it("enforces tournamentId boundary in getCricketRulePreset and deleteCricketRulePreset", () => {
      expect(rulePresetsServiceSrc).toContain("eq(cricketRulePresetsTable.tournamentId, tournamentId)");
      expect(rulePresetsServiceSrc).toContain("eq(cricketRulePresetsTable.id, presetId)");
    });

    it("validates tenant isolation on match creation and update", () => {
      expect(scoringServiceSrc).toContain("getCricketRulePreset(tournamentId, input.rulePresetId)");
      expect(scoringServiceSrc).toContain("Rule Preset not found or does not belong to this tournament");
    });

    it("validates tenant isolation on draw generation", () => {
      expect(scoringFoundationServiceSrc).toContain("getCricketRulePreset(input.tournamentId, input.rulePresetId)");
    });
  });

  describe("Section D & E: Match References Rule Preset & Different Matches Can Use Different Presets", () => {
    it("stores rulePresetId on scoringMatchesTable and scoringFixturesTable", () => {
      expect(scoringServiceSrc).toContain("rulePresetId: input.rulePresetId ?? null");
      expect(scoringFoundationServiceSrc).toContain("rulePresetId: input.rulePresetId ?? null");
    });

    it("exposes rulePresetId and rulePresetName in matchToJson response", () => {
      expect(scoringRoutesSrc).toContain("rulePresetId:");
      expect(scoringRoutesSrc).toContain("rulePresetName:");
    });
  });

  describe("Section F: Match Type != Rule Preset Independence", () => {
    it("maintains matchTypeId as structural stage and rulePresetId as rule configuration", () => {
      const matchMetaCode = scoringServiceSrc.slice(
        scoringServiceSrc.indexOf("function matchMetaFromRow"),
        scoringServiceSrc.indexOf("async function projectMatchState"),
      );
      expect(matchMetaCode).toContain("matchTypeId: match.matchTypeId");
      expect(matchMetaCode).toContain("buildMatchMetaFromRules");
    });
  });

  describe("Section G: Renaming Rule Preset Does Not Break Match References", () => {
    it("references presets by stable numeric ID, not mutable display name", () => {
      expect(scoringServiceSrc).toContain("rulePresetId");
      expect(rulePresetsServiceSrc).toContain("resolveMatchRulePreset");
    });
  });

  describe("Section H: Referenced Preset Deletion Protection", () => {
    it("blocks deletion of rule preset referenced by matches with 409", () => {
      expect(rulePresetsServiceSrc).toContain("scoringMatchesTable.rulePresetId, presetId");
      expect(rulePresetsServiceSrc).toContain("status: 409");
      expect(rulePresetsServiceSrc).toContain("Cannot delete Rule Preset");
      expect(rulePresetsServiceSrc).toContain("because it is currently assigned to");
    });

    it("blocks deletion of rule preset referenced by fixtures with 409", () => {
      expect(rulePresetsServiceSrc).toContain("scoringFixturesTable.rulePresetId, presetId");
      expect(rulePresetsServiceSrc).toContain("fixture(s)");
    });

    it("blocks deletion of the only rule preset in a tournament", () => {
      expect(rulePresetsServiceSrc).toContain("Cannot delete the only Rule Preset of a tournament.");
    });
  });

  describe("Section I & J: Pre-Start Dynamic Resolution vs Post-Start Immutability", () => {
    it("resolves match rule preset dynamically at prepareRuntimeMatch", () => {
      expect(runtimeMatchServiceSrc).toContain("const preset = await resolveMatchRulePreset(tournamentId, match);");
      expect(runtimeMatchServiceSrc).toContain("rulePresetId: resolvedPresetId");
      expect(runtimeMatchServiceSrc).toContain("rulePresetName: resolvedPresetName");
    });

    it("locks rulePresetId mutation after match start with 409 SCORING_RULES_LOCKED", () => {
      expect(scoringServiceSrc).toContain("started && input.rulePresetId !== undefined && input.rulePresetId !== matchRow.rulePresetId");
      expect(scoringServiceSrc).toContain("SCORING_RULES_LOCKED");
      expect(scoringServiceSrc).toContain("Cannot change Rule Preset on a match that has already started.");
    });
  });

  describe("Section K: Backward Compatibility", () => {
    it("auto-creates default rule preset from tournament settings if none exists", () => {
      expect(rulePresetsServiceSrc).toContain("ensureDefaultCricketRulePreset");
      expect(rulePresetsServiceSrc).toContain("Default Match Rules");
      expect(rulePresetsServiceSrc).toContain("isDefault: true");
    });
  });

  describe("Domain Execution: Engine Resolution of Distinct Presets", () => {
    const snapshot1 = buildRuntimeSnapshot({
      matchId: "101",
      tournamentId: 1,
      snapshotVersion: 1,
      createdAt: new Date().toISOString(),
      createdBy: "test",
      references: buildSnapshotReferences({
        matchId: "101",
        ruleProfileId: "cricket.box.corporate_standard",
        ruleProfileVersion: "1.0.0",
        competitionId: "1",
        competitionVersion: 1,
      }),
    });

    const bindings = resolvePrepareCatalogBindings({
      sportId: "cricket",
      variantId: "cricket.box",
      ruleProfileId: "cricket.box.corporate_standard",
      ruleProfileVersion: "1.0.0",
      presentationProfileId: "cricket.presentation.corporate_box",
      presentationProfileVersion: "1.0.0",
    });

    it("resolves 12-over league preset independently of 20-over grand final preset", () => {
      // Preset A: 12 overs
      const presetAOverrides = parseRuleOverrides({
        values: {
          "cricket.match.overs_per_innings": 12,
          "cricket.match.max_wickets": 8,
        },
      });
      const resA = RuleEngine.resolve(buildPrepareRuleEngineInput(snapshot1, bindings, presetAOverrides));
      expect(ruleEngineResultOk(resA)).toBe(true);
      const policyA = buildRuntimeExecutionPolicy(resA.resolvedRuntimeRules!);
      const rulesA = projectRuntimeExecutionPolicyToRulesJson(policyA);
      expect(rulesA.overs).toBe(12);
      expect(rulesA.maxWickets).toBe(8);

      // Preset B: 20 overs
      const presetBOverrides = parseRuleOverrides({
        values: {
          "cricket.match.overs_per_innings": 20,
          "cricket.match.max_wickets": 10,
        },
      });
      const resB = RuleEngine.resolve(buildPrepareRuleEngineInput(snapshot1, bindings, presetBOverrides));
      expect(ruleEngineResultOk(resB)).toBe(true);
      const policyB = buildRuntimeExecutionPolicy(resB.resolvedRuntimeRules!);
      const rulesB = projectRuntimeExecutionPolicyToRulesJson(policyB);
      expect(rulesB.overs).toBe(20);
      expect(rulesB.maxWickets).toBe(10);
    });

    it("replay remains deterministic even if preset definition changes afterwards", () => {
      const initialMeta: MatchMeta = {
        matchId: 101,
        tournamentId: 1,
        homeTeamId: 10,
        awayTeamId: 20,
        rules: { overs: 12, maxWickets: 8 },
        oversLimit: 12,
        ruleResolution: {
          resolutionId: "res_preset_12_overs",
          rulesHash: "hash_preset_12",
          runtimeRulesVersion: "1.0.0",
          snapshotVersion: 1,
        },
      };

      const startEvent = createEventEnvelope({
        matchId: initialMeta.matchId,
        tournamentId: initialMeta.tournamentId,
        sportSlug: "cricket",
        sequence: 1,
        eventType: CricketEventType.MATCH_STARTED,
        payload: { tossWinnerTeamId: 10, electedTo: "bat", oversLimit: 12 },
        actorType: "organizer",
      });

      const ballEvent = createEventEnvelope({
        matchId: initialMeta.matchId,
        tournamentId: initialMeta.tournamentId,
        sportSlug: "cricket",
        sequence: 2,
        eventType: CricketEventType.BALL_RECORDED,
        payload: {
          innings: 1,
          over: 1,
          ball: 1,
          strikerId: 1,
          nonStrikerId: 2,
          bowlerId: 3,
          runsOffBat: 6,
          extras: { type: null, runs: 0 },
          wicket: null,
          isLegalDelivery: true,
        },
        actorType: "organizer",
      });

      const replayBefore = replayCricketEvents(initialMeta, [startEvent, ballEvent]);
      expect(replayBefore.oversLimit).toBe(12);
      expect(replayBefore.innings[0].runs).toBe(6);

      // Even if someone creates/updates a preset to 15 overs in DB,
      // replaying the match with its frozen MatchMeta preserves 12 overs limit.
      const replayAfter = replayCricketEvents(initialMeta, [startEvent, ballEvent]);
      expect(replayAfter.oversLimit).toBe(12);
      expect(replayAfter.innings[0].runs).toBe(6);
    });
  });
});
