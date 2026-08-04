import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "../registry.ts";
import { BadmintonRuntimeAdapter } from "../../runtime/adapters/badminton.ts";
import { CricketRuntimeAdapter } from "../../runtime/adapters/cricket.ts";
import { resolveResultOk } from "./resolver.ts";

describe("RuleResolver", () => {
  it("resolves outdoor T20 with provenance and stable hash", () => {
    const a = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "cricket",
      variantId: "cricket.outdoor",
      competitionTypeId: "auction",
      profileFamilyId: "cricket.outdoor.t20_standard",
      profileId: "cricket.outdoor.t20_standard",
      profileVersion: "1.0.0",
      resolutionMode: "PREVIEW",
    });
    const b = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "cricket",
      variantId: "cricket.outdoor",
      competitionTypeId: "auction",
      profileFamilyId: "cricket.outdoor.t20_standard",
      profileId: "cricket.outdoor.t20_standard",
      profileVersion: "1.0.0",
      resolutionMode: "PREVIEW",
    });

    expect(resolveResultOk(a)).toBe(true);
    expect(a.snapshotHash).toBe(b.snapshotHash);
    expect(a.snapshot.snapshotHash).toBe(a.snapshotHash);

    const overs = a.snapshot.values.find(
      (v) => v.definitionId === "cricket.match.overs_per_innings",
    );
    expect(overs?.resolvedValue).toBe(20);
    expect(overs?.resolvedFromLayer).toBe("profile");
    expect(overs?.resolvedFromProfile?.profileId).toBe("cricket.outdoor.t20_standard");
  });

  it("marks deprecated profile as WARNING", () => {
    const result = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "cricket",
      variantId: "cricket.box",
      competitionTypeId: "auction",
      profileFamilyId: "cricket.box.legacy_retired",
      profileId: "cricket.box.legacy_retired",
      profileVersion: "1.0.0",
      resolutionMode: "VALIDATE",
    });
    expect(result.warnings.some((i) => i.code === "PROFILE_DEPRECATED")).toBe(true);
  });

  it("rejects unknown profile with ERROR", () => {
    const result = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "cricket",
      variantId: "cricket.outdoor",
      competitionTypeId: "auction",
      profileFamilyId: "missing",
      profileId: "missing",
      profileVersion: "1.0.0",
      resolutionMode: "PREVIEW",
    });
    expect(resolveResultOk(result)).toBe(false);
    expect(result.validation.some((i) => i.code === "UNKNOWN_PROFILE")).toBe(true);
  });

  it("rejects unsupported resolution modes", () => {
    const result = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "cricket",
      variantId: "cricket.outdoor",
      competitionTypeId: "auction",
      profileFamilyId: "cricket.outdoor.t20_standard",
      profileId: "cricket.outdoor.t20_standard",
      profileVersion: "1.0.0",
      resolutionMode: "MATCH_START",
    });
    expect(resolveResultOk(result)).toBe(false);
    expect(result.validation.some((i) => i.code === "MODE_UNSUPPORTED")).toBe(true);
  });

  it("inherits omitted/inherit values from platform defaults", () => {
    const result = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "cricket",
      variantId: "cricket.custom",
      competitionTypeId: "practice",
      profileFamilyId: "cricket.custom.blank",
      profileId: "cricket.custom.blank",
      profileVersion: "1.0.0",
      resolutionMode: "PREVIEW",
    });
    expect(resolveResultOk(result)).toBe(true);
    const overs = result.snapshot.values.find(
      (v) => v.definitionId === "cricket.match.overs_per_innings",
    );
    expect(overs?.resolvedValue).toBe(20);
    expect(overs?.resolvedFromLayer).toBe("platform");
  });
});

describe("RuntimeAdapters", () => {
  it("maps badminton.standard_bwf to BWF format DTO", () => {
    const resolved = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "badminton",
      variantId: "badminton.standard",
      competitionTypeId: "registered_teams",
      profileFamilyId: "badminton.standard_bwf",
      profileId: "badminton.standard_bwf",
      profileVersion: "1.0.0",
      resolutionMode: "PREVIEW",
    });
    const dto = BadmintonRuntimeAdapter.translate(resolved.snapshot);
    expect(dto.ok).toBe(true);
    if (dto.ok) {
      expect(dto.dto.presetId).toBe("standard_bwf");
      expect(dto.dto.format).toEqual({
        totalGames: 3,
        pointsPerGame: 21,
        deuceAt: 20,
        maxPoints: 30,
        midGameSideChange: true,
      });
    }
  });

  it("maps badminton.fast_match preset numbers", () => {
    const resolved = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "badminton",
      variantId: "badminton.standard",
      competitionTypeId: "registered_teams",
      profileFamilyId: "badminton.fast_match",
      profileId: "badminton.fast_match",
      profileVersion: "1.0.0",
      resolutionMode: "PREVIEW",
    });
    const dto = BadmintonRuntimeAdapter.translate(resolved.snapshot);
    expect(dto.ok).toBe(true);
    if (dto.ok) {
      expect(dto.dto).toEqual({
        presetId: "fast_match",
        format: {
          totalGames: 3,
          pointsPerGame: 15,
          deuceAt: 14,
          maxPoints: 21,
          midGameSideChange: true,
        },
      });
    }
  });

  it("documents cricket outdoor T20 current defaults", () => {
    const resolved = CatalogRegistry.resolveRuleProfilePreview({
      sportId: "cricket",
      variantId: "cricket.outdoor",
      competitionTypeId: "auction",
      profileFamilyId: "cricket.outdoor.t20_standard",
      profileId: "cricket.outdoor.t20_standard",
      profileVersion: "1.0.0",
      resolutionMode: "PREVIEW",
    });
    const dto = CricketRuntimeAdapter.translate(resolved.snapshot);
    expect(dto.ok).toBe(true);
    if (dto.ok) {
      expect(dto.dto.oversLimit).toBe(20);
      expect(dto.dto.maxWickets).toBe(10);
      expect(dto.dto.playingSquadSize).toBe(11);
      expect(dto.dto.lbwEnabled).toBe(true);
    }
  });
});

describe("Catalog integrity", () => {
  it("has no orphan definitions or orphan profile values", () => {
    const result = CatalogRegistry.assertCatalogIntegrity();
    expect(result.issues).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("lists categories and definitions via registry", () => {
    expect(CatalogRegistry.listRuleCategories().length).toBeGreaterThan(5);
    expect(
      CatalogRegistry.getRuleDefinitions({ sportId: "cricket" }).length,
    ).toBeGreaterThan(5);
    expect(CatalogRegistry.getRuleDefinition("cricket.match.overs_per_innings")?.type).toBe(
      "integer",
    );
  });
});
