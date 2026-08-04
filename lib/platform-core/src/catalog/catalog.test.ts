import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "./registry.ts";
import { LEGACY_PROFILE } from "./types.ts";

describe("CatalogRegistry", () => {
  it("lists sports without exposing deprecated by default", () => {
    const sports = CatalogRegistry.listSportsForCreation();
    expect(sports.some((s) => s.id === "cricket")).toBe(true);
    expect(sports.some((s) => s.id === "badminton")).toBe(true);
    expect(sports.every((s) => s.status !== "deprecated")).toBe(true);
  });

  it("lists cricket variants including box / outdoor / tennis_ball / indoor / custom", () => {
    const ids = CatalogRegistry.listVariants("cricket").map((v) => v.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "cricket.outdoor",
        "cricket.box",
        "cricket.tennis_ball",
        "cricket.indoor",
        "cricket.custom",
      ]),
    );
  });

  it("rejects unknown variants", () => {
    const result = CatalogRegistry.validateCreateBindings({
      sportId: "cricket",
      variantId: "cricket.does_not_exist",
      competitionTypeId: "auction",
      ruleProfileId: "cricket.outdoor.t20_standard",
      presentationProfileId: "presentation.cricket.outdoor",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Unknown variant/);
  });

  it("rejects rule profile incompatible with variant", () => {
    const result = CatalogRegistry.validateCreateBindings({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
      ruleProfileId: "cricket.outdoor.t20_standard",
      presentationProfileId: "presentation.cricket.corporate_box",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Rule profile does not support/);
  });

  it("rejects presentation profile for wrong sport", () => {
    const result = CatalogRegistry.validateCreateBindings({
      sportId: "badminton",
      variantId: "badminton.standard",
      competitionTypeId: "registered_teams",
      ruleProfileId: "badminton.standard_bwf",
      presentationProfileId: "presentation.cricket.outdoor",
    });
    expect(result.ok).toBe(false);
  });

  it("accepts valid cricket box + corporate pack combination", () => {
    const result = CatalogRegistry.validateCreateBindings({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
      ruleProfileId: "cricket.box.corporate_standard",
      presentationProfileId: "presentation.cricket.corporate_box",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.bindings.ruleProfileVersion).toBe("1.0.0");
      expect(result.bindings.presentationProfileVersion).toBe("1.0.0");
    }
  });

  it("suggests recommended defaults", () => {
    const suggested = CatalogRegistry.suggestDefaults({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
    });
    expect(suggested.ruleProfile?.recommendation).toBe("recommended");
    expect(suggested.presentationProfile?.id).toBeTruthy();
  });

  it("resolves null tournament columns to Legacy Profile", () => {
    const resolved = CatalogRegistry.resolveLegacyBindings({
      sport: "cricket",
      variantId: null,
      competitionTypeId: null,
      ruleProfileId: null,
      ruleProfileVersion: null,
      presentationProfileId: null,
      presentationProfileVersion: null,
    });
    expect(resolved.isLegacy).toBe(true);
    expect(resolved.ruleProfileId).toBe(LEGACY_PROFILE.id);
    expect(resolved.presentationProfileId).toBe(LEGACY_PROFILE.id);
  });

  it("groups profiles into auto / recommended / advanced", () => {
    const profiles = CatalogRegistry.listRuleProfiles({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
    });
    const grouped = CatalogRegistry.groupByRecommendation(profiles);
    expect(
      grouped.autoSuggested.length +
        grouped.recommended.length +
        grouped.advanced.length,
    ).toBe(profiles.length);
  });

  it("picks latest non-deprecated version when version omitted", () => {
    const profile = CatalogRegistry.getRuleProfile("cricket.box.corporate_standard");
    expect(profile?.version).toBe("1.0.0");
  });

  it("returns null for unknown version upgrades", () => {
    expect(
      CatalogRegistry.getRuleProfile("cricket.box.corporate_standard", "9.9.9"),
    ).toBeNull();
  });

  it("filters competition types by sport support", () => {
    const cricket = CatalogRegistry.listCompetitionTypes("cricket").map((c) => c.id);
    expect(cricket).toEqual(
      expect.arrayContaining(["auction", "registered_teams", "hybrid", "practice"]),
    );
  });

  it("hides deprecated profiles from create lists but can include them when asked", () => {
    const active = CatalogRegistry.listRuleProfiles({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
    });
    expect(active.some((p) => p.id === "cricket.box.legacy_retired")).toBe(false);

    const withDeprecated = CatalogRegistry.listRuleProfiles({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
      includeDeprecated: true,
    });
    expect(withDeprecated.some((p) => p.id === "cricket.box.legacy_retired")).toBe(true);

    const createWithDeprecated = CatalogRegistry.validateCreateBindings({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
      ruleProfileId: "cricket.box.legacy_retired",
      presentationProfileId: "presentation.cricket.corporate_box",
    });
    expect(createWithDeprecated.ok).toBe(false);
    if (!createWithDeprecated.ok) {
      expect(createWithDeprecated.error).toMatch(/deprecated/i);
    }
  });
});

