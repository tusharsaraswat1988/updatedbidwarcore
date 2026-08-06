import { describe, expect, it } from "vitest";
import {
  resolveCatalogBindingsForCreate,
} from "../tournament-catalog-bindings";

describe("resolveCatalogBindingsForCreate", () => {
  it("allows legacy create with no binding fields", () => {
    const result = resolveCatalogBindingsForCreate("cricket", {});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columns.ruleProfileId).toBeNull();
      expect(result.columns.variantId).toBeNull();
    }
  });

  it("requires full binding set when any field is present", () => {
    const result = resolveCatalogBindingsForCreate("cricket", {
      variantId: "cricket.outdoor",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid badminton bindings", () => {
    const result = resolveCatalogBindingsForCreate("badminton", {
      variantId: "badminton.standard",
      competitionTypeId: "registered_teams",
      ruleProfileId: "badminton.standard_bwf",
      presentationProfileId: "presentation.badminton.standard",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columns.ruleProfileId).toBe("badminton.standard_bwf");
      expect(result.columns.presentationProfileVersion).toBe("1.0.0");
    }
  });

  it("rejects invalid combination", () => {
    const result = resolveCatalogBindingsForCreate("cricket", {
      variantId: "cricket.outdoor",
      competitionTypeId: "auction",
      ruleProfileId: "cricket.box.corporate_standard",
      presentationProfileId: "presentation.cricket.outdoor",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts confirmed registration mode with full bindings", () => {
    const result = resolveCatalogBindingsForCreate("badminton", {
      variantId: "badminton.standard",
      competitionTypeId: "registered_teams",
      ruleProfileId: "badminton.standard_bwf",
      presentationProfileId: "presentation.badminton.standard",
      registrationModeId: "team",
      teamFormationStrategyId: "manual",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.columns.registrationModeId).toBe("team");
      expect(result.columns.teamFormationStrategyId).toBe("manual");
    }
  });

  it("rejects unknown registration mode id", () => {
    const unknown = resolveCatalogBindingsForCreate("badminton", {
      variantId: "badminton.standard",
      competitionTypeId: "registered_teams",
      ruleProfileId: "badminton.standard_bwf",
      presentationProfileId: "presentation.badminton.standard",
      registrationModeId: "not_a_real_mode",
    });
    expect(unknown.ok).toBe(false);
  });
});
