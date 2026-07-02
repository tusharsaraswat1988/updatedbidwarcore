import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<void>) => fn({})),
  },
  pool: { query: vi.fn() },
  playerSpecValuesTable: {
    playerId: "player_id",
    specGroupId: "spec_group_id",
    valueText: "value_text",
  },
  roleSpecGroupsTable: { id: "id", groupName: "group_name", displayOrder: "display_order" },
  sportRolesTable: { id: "id", roleName: "role_name", sportId: "sport_id", active: "active" },
  sportsTable: { id: "id", slug: "slug", active: "active" },
  tournamentsTable: { id: "id", sport: "sport" },
}));

import {
  legacyFieldsFromSpecifications,
  specificationsFromLegacyFields,
  buildSpecificationsForSave,
  type PlayerSpecification,
} from "../lib/player-specification-service";

describe("player specification pure functions", () => {
  const groups = [
    { id: 10, groupName: "Playing Hand", displayOrder: 1, optional: true },
    { id: 11, groupName: "Playing Style", displayOrder: 2, optional: true },
    { id: 12, groupName: "Experience", displayOrder: 3, optional: true },
    { id: 13, groupName: "Court Preference", displayOrder: 4, optional: true },
  ];

  it("maps legacy fields to specifications by display order", () => {
    const specs = specificationsFromLegacyFields(groups, {
      battingStyle: "Right Hand",
      bowlingStyle: "Attacking",
      specialization: "Advanced",
    });
    expect(specs).toEqual([
      { specGroupId: 10, value: "Right Hand" },
      { specGroupId: 11, value: "Attacking" },
      { specGroupId: 12, value: "Advanced" },
    ]);
  });

  it("maps specifications back to legacy fields (first three only)", () => {
    const specifications: PlayerSpecification[] = [
      { specGroupId: 10, groupName: "Playing Hand", displayOrder: 1, value: "Right Hand" },
      { specGroupId: 11, groupName: "Playing Style", displayOrder: 2, value: "Attacking" },
      { specGroupId: 12, groupName: "Experience", displayOrder: 3, value: "Advanced" },
      { specGroupId: 13, groupName: "Court Preference", displayOrder: 4, value: "Singles" },
    ];
    expect(legacyFieldsFromSpecifications(specifications)).toEqual({
      battingStyle: "Right Hand",
      bowlingStyle: "Attacking",
      specialization: "Advanced",
    });
  });

  it("supports cricket legacy triple", () => {
    const cricketGroups = [
      { id: 1, groupName: "Batting Style", displayOrder: 1, optional: true },
      { id: 2, groupName: "Bowling Style", displayOrder: 2, optional: true },
      { id: 3, groupName: "Specialization", displayOrder: 3, optional: true },
    ];
    const specs = specificationsFromLegacyFields(cricketGroups, {
      battingStyle: "Right Hand Batsman",
      bowlingStyle: "Right Arm Medium",
      specialization: "All-Rounder",
    });
    expect(specs).toHaveLength(3);
    expect(specs.map((s) => s.value)).toEqual([
      "Right Hand Batsman",
      "Right Arm Medium",
      "All-Rounder",
    ]);
  });
});

describe("buildSpecificationsForSave — persistence payload sizes", () => {
  it("save 1 spec from explicit specifications array", async () => {
    const specs = await buildSpecificationsForSave(1, "Player", {
      specifications: [{ specGroupId: 1, value: "Right Hand" }],
    });
    expect(specs).toHaveLength(1);
  });

  it("save 3 specs", async () => {
    const specs = await buildSpecificationsForSave(1, "Player", {
      specifications: [
        { specGroupId: 1, value: "A" },
        { specGroupId: 2, value: "B" },
        { specGroupId: 3, value: "C" },
      ],
    });
    expect(specs).toHaveLength(3);
  });

  it("save 10 specs without duplicate group ids", async () => {
    const input = Array.from({ length: 10 }, (_, i) => ({
      specGroupId: i + 1,
      value: `Spec ${i + 1}`,
    }));
    input.push({ specGroupId: 5, value: "Spec 5 updated" });
    const specs = await buildSpecificationsForSave(1, "Player", { specifications: input });
    expect(specs).toHaveLength(10);
    expect(specs.find((s) => s.specGroupId === 5)?.value).toBe("Spec 5 updated");
  });
});

describe("backfill mapping", () => {
  it("cricket player legacy triple maps to three groups", () => {
    const cricketGroups = [
      { id: 1, groupName: "Batting Style", displayOrder: 1, optional: true },
      { id: 2, groupName: "Bowling Style", displayOrder: 2, optional: true },
      { id: 3, groupName: "Specialization", displayOrder: 3, optional: true },
    ];
    const specs = specificationsFromLegacyFields(cricketGroups, {
      battingStyle: "Left Hand",
      bowlingStyle: "Spin",
      specialization: "Bowler",
    });
    expect(specs).toHaveLength(3);
  });

  it("badminton player maps first three legacy slots; fourth requires normalized input", () => {
    const badmintonGroups = [
      { id: 42, groupName: "Playing Hand", displayOrder: 1, optional: false },
      { id: 43, groupName: "Playing Style", displayOrder: 2, optional: true },
      { id: 44, groupName: "Experience", displayOrder: 3, optional: true },
      { id: 45, groupName: "Court Preference", displayOrder: 4, optional: true },
    ];
    const fromLegacy = specificationsFromLegacyFields(badmintonGroups, {
      battingStyle: "Right Hand",
      bowlingStyle: "Attacking",
      specialization: "Advanced",
    });
    expect(fromLegacy).toHaveLength(3);
    expect(fromLegacy.map((s) => s.specGroupId)).toEqual([42, 43, 44]);
  });
});

describe("dual-write feature flag", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("is enabled by default when env is unset", async () => {
    vi.stubEnv("PLAYER_SPECS_V2_ENABLED", "");
    const { isPlayerSpecsV2Enabled } = await import("@workspace/api-base");
    expect(isPlayerSpecsV2Enabled()).toBe(true);
  });

  it("is enabled when PLAYER_SPECS_V2_ENABLED=true", async () => {
    vi.stubEnv("PLAYER_SPECS_V2_ENABLED", "true");
    const { isPlayerSpecsV2Enabled } = await import("@workspace/api-base");
    expect(isPlayerSpecsV2Enabled()).toBe(true);
  });
});

describe("resolveLegacyFieldsForInsert dual-write", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("returns legacy fields unchanged when flag is off", async () => {
    vi.stubEnv("PLAYER_SPECS_V2_ENABLED", "false");
    const { resolveLegacyFieldsForInsert } = await import("../lib/player-spec-response");
    const result = await resolveLegacyFieldsForInsert(1, "Player", {
      battingStyle: "Right Hand",
      specifications: [{ specGroupId: 99, value: "Singles" }],
    });
    expect(result).toEqual({
      battingStyle: "Right Hand",
      bowlingStyle: null,
      specialization: null,
    });
  });
});

describe("buildSpecificationsForSave edit flow merge", () => {
  it("prefers explicit specifications array over legacy fields", async () => {
    const specs = await buildSpecificationsForSave(5, "Player", {
      battingStyle: "Legacy Hand",
      specifications: [
        { specGroupId: 42, value: "Right Hand" },
        { specGroupId: 43, value: "Attacking" },
        { specGroupId: 44, value: "Advanced" },
        { specGroupId: 45, value: "Singles Court" },
      ],
    });
    expect(specs).toHaveLength(4);
    expect(specs.find((s) => s.specGroupId === 45)?.value).toBe("Singles Court");
  });
});
