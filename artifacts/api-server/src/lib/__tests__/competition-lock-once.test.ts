import { describe, expect, it } from "vitest";
import {
  buildCompetitionPlanPayload,
  resolveCompetitionConfiguration,
  resolveTransitionRequest,
  validateCompetitionConfiguration,
} from "@workspace/platform-core/competition";
import { CatalogRegistry } from "@workspace/platform-core/catalog";

describe("EPIC-03 competition foundation helpers", () => {
  it("lists registration modes for auction", () => {
    const modes = CatalogRegistry.listRegistrationModes("auction");
    expect(modes.some((m) => m.id === "individual")).toBe(true);
    expect(CatalogRegistry.suggestRegistrationModeId("auction")).toBe("individual");
  });

  it("blocks freeze when registration mode missing", () => {
    const config = resolveCompetitionConfiguration({
      id: 1,
      sport: "cricket",
      competitionTypeId: "auction",
    });
    const validation = validateCompetitionConfiguration(config);
    expect(validation.errorCount).toBeGreaterThan(0);
  });

  it("builds plan payload for lock", () => {
    const config = resolveCompetitionConfiguration({
      id: 1,
      sport: "cricket",
      competitionTypeId: "auction",
      registrationModeId: "individual",
      teamFormationStrategyId: "auction",
    });
    const validation = validateCompetitionConfiguration(config);
    expect(validation.errorCount).toBe(0);
    const payload = buildCompetitionPlanPayload(config, validation);
    expect(payload.registrationModeId).toBe("individual");
    expect(payload.businessStageId).toBe("configuration_locked");
  });

  it("transition rules request draw_ready for auction", () => {
    const config = resolveCompetitionConfiguration({
      id: 1,
      competitionTypeId: "auction",
    });
    expect(resolveTransitionRequest(config, "configuration_locked").requestedTournamentState).toBe(
      "draw_ready",
    );
  });
});
