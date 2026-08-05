import { describe, expect, it } from "vitest";
import { resolveCompetitionConfiguration } from "./configuration.ts";
import { buildCompetitionPlanPayload } from "./plan.ts";
import {
  mapAuctionPlayersToParticipants,
  mapBadmintonRegistrationsToParticipants,
} from "./participant-bridges.ts";
import { resolveTransitionRequest } from "./transition-rules.ts";
import { validateCompetitionConfiguration } from "./validation.ts";

describe("Competition Configuration", () => {
  it("resolves working configuration from tournament columns", () => {
    const config = resolveCompetitionConfiguration({
      id: 42,
      sport: "cricket",
      competitionTypeId: "auction",
      registrationModeId: "individual",
      teamFormationStrategyId: "auction",
      squadRulesJson: { minPlayers: 11, maxPlayers: 15 },
    });
    expect(config.tournamentId).toBe(42);
    expect(config.registrationModeId).toBe("individual");
    expect(config.squadRules.minPlayers).toBe(11);
    expect(config.businessStageId).toBe("registration_planning");
    expect(config.locked).toBe(false);
  });

  it("blocks ready when registration mode missing", () => {
    const config = resolveCompetitionConfiguration({
      id: 1,
      sport: "cricket",
      competitionTypeId: "auction",
    });
    const result = validateCompetitionConfiguration(config);
    expect(result.errorCount).toBeGreaterThan(0);
    expect(result.issues.some((i) => i.code === "REGISTRATION_MODE_REQUIRED")).toBe(true);
    expect(result.readiness).toBe("not_ready");
  });

  it("allows ready when core fields are compatible", () => {
    const config = resolveCompetitionConfiguration({
      id: 1,
      sport: "cricket",
      competitionTypeId: "auction",
      registrationModeId: "individual",
      teamFormationStrategyId: "auction",
      variantId: "cricket.outdoor",
      ruleProfileId: "cricket.outdoor.standard",
    });
    const result = validateCompetitionConfiguration(config);
    expect(result.errorCount).toBe(0);
    expect(result.readiness === "ready" || result.readiness === "almost_ready").toBe(true);
  });

  it("freezes plan payload with zero errors only path", () => {
    const config = resolveCompetitionConfiguration({
      id: 1,
      sport: "cricket",
      competitionTypeId: "auction",
      registrationModeId: "individual",
      teamFormationStrategyId: "auction",
    });
    const validation = validateCompetitionConfiguration(config);
    expect(validation.errorCount).toBe(0);
    const payload = buildCompetitionPlanPayload(config, validation, "2026-08-05T00:00:00.000Z");
    expect(payload.registrationModeId).toBe("individual");
    expect(payload.businessStageId).toBe("configuration_locked");
    expect(payload.ruleProfileId).toBeNull();
  });
});

describe("Transition Rules", () => {
  it("requests draw_ready for auction by default", () => {
    const config = resolveCompetitionConfiguration({
      id: 1,
      competitionTypeId: "auction",
    });
    const req = resolveTransitionRequest(config, "configuration_locked");
    expect(req.requestedTournamentState).toBe("draw_ready");
  });

  it("requests ready_to_start for practice", () => {
    const config = resolveCompetitionConfiguration({
      id: 1,
      competitionTypeId: "practice",
    });
    const req = resolveTransitionRequest(config, "configuration_locked");
    expect(req.requestedTournamentState).toBe("ready_to_start");
  });
});

describe("Sport Bridges", () => {
  it("maps auction players to participants", () => {
    const participants = mapAuctionPlayersToParticipants("cricket", [
      { id: 7, name: "Rohit", status: "available" },
    ]);
    expect(participants[0]?.id).toBe("auction-player:7");
    expect(participants[0]?.kind).toBe("individual");
    expect(participants[0]?.registration?.status).toBe("accepted");
  });

  it("maps badminton registrations to participants", () => {
    const participants = mapBadmintonRegistrationsToParticipants("badminton", [
      {
        id: 3,
        status: "accepted",
        player1Name: "A",
        player2Name: "B",
        matchType: "doubles",
      },
    ]);
    expect(participants[0]?.id).toBe("badminton-registration:3");
    expect(participants[0]?.kind).toBe("team");
    expect(participants[0]?.displayName).toContain("A");
  });
});
