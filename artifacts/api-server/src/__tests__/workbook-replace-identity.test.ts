import { describe, expect, it } from "vitest";
import {
  resolvePlayerIdentity,
  findPlayersMissingFromWorkbook,
  assessReplaceIdentityCoverage,
  getReplaceDataSafetyError,
} from "@workspace/api-base/tournament-workbook";
import { normalizeMobile } from "@workspace/api-base/tournament-workbook";
import { validateWorkbook } from "@workspace/api-base/tournament-workbook";
import type { ParsedWorkbook } from "@workspace/api-base/tournament-workbook";

const existingPlayers = [
  { id: 1, name: "Male One", mobileNumber: "9000000001", email: null, age: null },
  { id: 2, name: "Female One", mobileNumber: "9000000002", email: null, age: null },
  { id: 73, name: "Star Player", mobileNumber: "9000000073", email: null, age: null },
];

describe("workbook replace identity", () => {
  it("matches by BidWar Player ID even when mobile column is corrupted", () => {
    const row = {
      "BidWar Player ID": 73,
      "Player Name": "Star Player",
      Mobile: 9.87654e9,
    };
    const identity = resolvePlayerIdentity(row, existingPlayers, "TEST");
    expect(identity.isNew).toBe(false);
    expect(identity.playerId).toBe(73);
    expect(identity.strategy).toBe("player_id");
  });

  it("normalizes numeric mobile cells from Excel", () => {
    expect(normalizeMobile(9000000001)).toBe("9000000001");
    expect(normalizeMobile(9.000000001e9)).toBe("9000000001");
  });

  it("blocks replace when no workbook rows match existing players", () => {
    const playerRows = Array.from({ length: 62 }, (_, i) => ({
      "Player Name": `Player ${i}`,
      Mobile: "",
      "Registration Code": "",
    }));

    const coverage = assessReplaceIdentityCoverage(playerRows, existingPlayers, "TEST");
    const error = getReplaceDataSafetyError(coverage, existingPlayers.length);
    expect(error).toMatch(/matched 0 of 3 existing players/i);
  });

  it("validateWorkbook fails replace import when identity coverage is too low", () => {
    const workbook: ParsedWorkbook = {
      sheets: {
        "03_Players": [
          { "Player Name": "Only Unmatched", Mobile: "9999999999", "Base Value": 5000 },
        ],
      },
      version: "1",
      sourceType: "excel",
      manifest: null,
    };

    const result = validateWorkbook(workbook, {
      tournamentId: 1,
      minBid: 5000,
      bidValueMode: "player",
      bidValueOptions: [5000],
      categoryNames: new Map(),
      teamNames: new Map(),
      existingPlayers,
      mode: "replace_data",
      sport: "cricket",
    });

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === "REPLACE_IDENTITY_COVERAGE_TOO_LOW")).toBe(true);
  });

  it("findPlayersMissingFromWorkbook keeps matched ids from player id column", () => {
    const playerRows = [
      { "BidWar Player ID": 1, "Player Name": "Male One", Mobile: "9000000001" },
    ];
    const missing = findPlayersMissingFromWorkbook(playerRows, existingPlayers, "TEST");
    expect(missing.map((p) => p.id).sort()).toEqual([2, 73]);
  });
});
