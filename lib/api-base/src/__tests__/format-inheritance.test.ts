import { describe, expect, it } from "vitest";
import {
  DRAW_STAGE_KEYS,
  DRAW_STAGE_LABELS,
  MANUAL_MATCH_NO_STAGE,
  MANUAL_MATCH_NO_STAGE_LABEL,
  MATCH_FORMAT_LOCKED_FROM,
  MATCH_PRODUCT_STATES,
  MATCH_ROSTER_LOCKED_FROM,
  PRODUCT_MODULE_LOCK_FROM,
  TOURNAMENT_FORMAT_KEYS,
  TOURNAMENT_FORMAT_LABELS,
  TOURNAMENT_PRODUCT_STATES,
  formatFromCategoryStageConfig,
  isDrawStageKey,
  isMatchProductState,
  isTournamentFormatKey,
  isTournamentProductState,
  parseManualMatchStageSelection,
  resolveCategoryStageFormat,
  resolveInheritedFormat,
  type CategoryStageFormatMap,
  type DrawStageKey,
  type TournamentFormatKey,
} from "../tournament-rules";

const tournament = { points: 21, games: 3 };
const category = { points: 21, games: 1 };
const stage = { points: 15, games: 1 };
const match = { points: 11, games: 1 };
const start = { points: 30, games: 1 };

describe("resolveInheritedFormat", () => {
  it("returns null when no sources are set", () => {
    expect(resolveInheritedFormat({})).toBeNull();
  });

  it("uses tournament when nothing else is set", () => {
    expect(resolveInheritedFormat({ tournament })).toEqual(tournament);
  });

  it("prefers category over tournament", () => {
    expect(resolveInheritedFormat({ tournament, category })).toEqual(category);
  });

  it("prefers stage over category and tournament", () => {
    expect(
      resolveInheritedFormat({ tournament, category, stage }),
    ).toEqual(stage);
  });

  it("prefers match stamp over stage", () => {
    expect(
      resolveInheritedFormat({ tournament, category, stage, match }),
    ).toEqual(match);
  });

  it("prefers start override over everything", () => {
    expect(
      resolveInheritedFormat({
        tournament,
        category,
        stage,
        match,
        startOverride: start,
      }),
    ).toEqual(start);
  });

  it("skips null layers and continues the cascade", () => {
    expect(
      resolveInheritedFormat({
        tournament,
        category: null,
        stage: null,
        match: null,
        startOverride: null,
      }),
    ).toEqual(tournament);
  });
});

describe("category stage format helpers", () => {
  const map: CategoryStageFormatMap<{ points: number; games: number }> = {
    league: { mode: "override", presetId: "custom", format: stage },
    final: { mode: "use_tournament_default" },
  };

  it("formatFromCategoryStageConfig ignores use_tournament_default", () => {
    expect(
      formatFromCategoryStageConfig({ mode: "use_tournament_default" }),
    ).toBeNull();
  });

  it("formatFromCategoryStageConfig returns override format", () => {
    expect(
      formatFromCategoryStageConfig({
        mode: "override",
        format: stage,
      }),
    ).toEqual(stage);
  });

  it("resolveCategoryStageFormat reads category-scoped map by stage key", () => {
    expect(resolveCategoryStageFormat(map, "league")).toEqual(stage);
    expect(resolveCategoryStageFormat(map, "final")).toBeNull();
    expect(resolveCategoryStageFormat(map, "semi_final")).toBeNull();
    expect(resolveCategoryStageFormat(map, null)).toBeNull();
  });
});

describe("tournament format vs draw stage", () => {
  it("keeps structure keys distinct from stage keys", () => {
    expect(isTournamentFormatKey("knockout")).toBe(true);
    expect(isTournamentFormatKey("swiss")).toBe(true);
    expect(isTournamentFormatKey("double_elimination")).toBe(true);
    expect(isDrawStageKey("knockout")).toBe(false);
    expect(isDrawStageKey("swiss")).toBe(false);
    expect(isDrawStageKey("quarter_final")).toBe(true);
    expect(isTournamentFormatKey("quarter_final")).toBe(false);
    expect(TOURNAMENT_FORMAT_LABELS.knockout).toBe("Knockout");
    expect(DRAW_STAGE_LABELS.quarter_final).toBe("Quarter Final");
  });

  it("allows overlapping English labels as separate typed concepts", () => {
    const structureLeague: TournamentFormatKey = "league";
    const stageLeague: DrawStageKey = "league";
    expect(isTournamentFormatKey(structureLeague)).toBe(true);
    expect(isDrawStageKey(stageLeague)).toBe(true);
    expect(TOURNAMENT_FORMAT_KEYS).toContain("round_robin");
    expect(DRAW_STAGE_KEYS).toContain("round_robin");
    // Structure-only keys never appear in the stage vocabulary.
    expect(DRAW_STAGE_KEYS.includes("knockout" as DrawStageKey)).toBe(false);
    expect(TOURNAMENT_FORMAT_KEYS.includes("final" as TournamentFormatKey)).toBe(false);
  });
});

describe("draw stage vocabulary", () => {
  it("exposes stable system-generated stage keys and organizer labels", () => {
    expect(DRAW_STAGE_KEYS).toContain("league");
    expect(DRAW_STAGE_KEYS).toContain("final");
    expect(DRAW_STAGE_LABELS.league).toBe("League Matches");
    expect(DRAW_STAGE_LABELS.quarter_final).toBe("Quarter Final");
    expect(DRAW_STAGE_LABELS.final).toBe("Final");
    expect(MANUAL_MATCH_NO_STAGE).toBeNull();
    expect(MANUAL_MATCH_NO_STAGE_LABEL).toBe("Exhibition / Friendly");
  });

  it("isDrawStageKey guards unknown / invented stage names", () => {
    expect(isDrawStageKey("semi_final")).toBe(true);
    expect(isDrawStageKey("championship")).toBe(false);
    expect(isDrawStageKey(null)).toBe(false);
  });

  it("parseManualMatchStageSelection defaults unknown to Exhibition (no stage)", () => {
    expect(parseManualMatchStageSelection(null)).toBeNull();
    expect(parseManualMatchStageSelection("")).toBeNull();
    expect(parseManualMatchStageSelection("final")).toBe("final");
    expect(parseManualMatchStageSelection("Custom Round")).toBeNull();
  });

  it("null stageKey contributes nothing — tournament/category cascade only", () => {
    expect(resolveCategoryStageFormat({ league: { mode: "override", format: stage } }, null)).toBeNull();
    expect(
      resolveInheritedFormat({
        tournament,
        category,
        stage: resolveCategoryStageFormat(
          { league: { mode: "override", format: stage } },
          MANUAL_MATCH_NO_STAGE,
        ),
      }),
    ).toEqual(category);
  });
});

describe("product state contract vocabulary", () => {
  it("locks tournament and match lifecycle order", () => {
    expect(TOURNAMENT_PRODUCT_STATES).toEqual([
      "draft",
      "setup",
      "draw_ready",
      "match_scheduling",
      "ready_to_start",
      "live",
      "completed",
      "archived",
    ]);
    expect(MATCH_PRODUCT_STATES).toEqual([
      "draft",
      "scheduled",
      "court_assigned",
      "ready",
      "live",
      "completed",
      "verified",
    ]);
    expect(isTournamentProductState("ready_to_start")).toBe(true);
    expect(isMatchProductState("court_assigned")).toBe(true);
    expect(isTournamentProductState("verified")).toBe(false);
  });

  it("documents module and match lock points", () => {
    expect(PRODUCT_MODULE_LOCK_FROM.players).toBe("draw_ready");
    expect(PRODUCT_MODULE_LOCK_FROM.categories).toBe("draw_ready");
    expect(PRODUCT_MODULE_LOCK_FROM.tournament_match_format).toBe("ready_to_start");
    expect(PRODUCT_MODULE_LOCK_FROM.draw_generation).toBe("match_scheduling");
    expect(PRODUCT_MODULE_LOCK_FROM.court_assignment).toBe("live");
    expect(PRODUCT_MODULE_LOCK_FROM.branding).toBe("live");
    expect(MATCH_FORMAT_LOCKED_FROM).toBe("live");
    expect(MATCH_ROSTER_LOCKED_FROM).toBe("ready");
  });
});
