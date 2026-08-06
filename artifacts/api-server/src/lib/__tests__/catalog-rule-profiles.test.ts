import { describe, expect, it } from "vitest";
import {
  CatalogRegistry,
  resolveResultOk,
} from "@workspace/platform-core/catalog";

describe("catalog rule profile product APIs (registry contract)", () => {
  it("lists profiles for cricket box auction", () => {
    const profiles = CatalogRegistry.listRuleProfiles({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
    });
    expect(profiles.some((p) => p.id === "cricket.box.corporate_standard")).toBe(true);
    expect(profiles.every((p) => p.values.length > 0)).toBe(true);
  });

  it("resolve preview returns ResolveResult shape", () => {
    const result = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "badminton",
      variantId: "badminton.standard",
      competitionTypeId: "registered_teams",
      profileFamilyId: "badminton.standard_bwf",
      profileId: "badminton.standard_bwf",
      profileVersion: "1.0.0",
      resolutionMode: "PREVIEW",
    });
    expect(resolveResultOk(result)).toBe(true);
    expect(result.snapshotHash).toBeTruthy();
    expect(result.summary.runtimeBindingType).toBe("badminton_match_format");
    expect(result.snapshot.values.length).toBeGreaterThan(0);
  });
});
