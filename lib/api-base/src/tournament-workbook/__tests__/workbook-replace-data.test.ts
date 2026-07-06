import { describe, expect, it } from "vitest";
import { findPlayersMissingFromWorkbook } from "../identity-resolver";
import { validateWorkbook } from "../workbook-validator";
import type { ParsedWorkbook } from "../types";

const existingPlayers = [
  { id: 1, name: "Male One", mobileNumber: "9000000001", email: null, age: null },
  { id: 2, name: "Female One", mobileNumber: "9000000002", email: null, age: null },
  { id: 3, name: "Male Two", mobileNumber: "9000000003", email: null, age: null },
];

describe("replace_data workbook import", () => {
  it("findPlayersMissingFromWorkbook returns players not matched in workbook", () => {
    const playerRows = [
      { "Player Name": "Male One", Mobile: "9000000001" },
      { "Player Name": "Male Two", Mobile: "9000000003" },
    ];

    const missing = findPlayersMissingFromWorkbook(playerRows, existingPlayers, "TEST");
    expect(missing.map((p) => p.id)).toEqual([2]);
  });

  it("validateWorkbook counts deletes and adds removal warnings in replace_data mode", () => {
    const workbook: ParsedWorkbook = {
      sheets: {
        "03_Players": [
          { "Player Name": "Male One", Mobile: "9000000001", "Base Value": 5000 },
          { "Player Name": "Male Two", Mobile: "9000000003", "Base Value": 5000 },
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

    expect(result.summary.deletes).toBe(1);
    expect(result.issues.some((i) => i.code === "PLAYER_WILL_BE_DELETED")).toBe(true);
    expect(result.diffs?.some((d) => d.changeType === "delete" && d.oldValue === "Female One")).toBe(true);
  });

  it("merge_data does not mark missing players for deletion", () => {
    const workbook: ParsedWorkbook = {
      sheets: {
        "03_Players": [
          { "Player Name": "Male One", Mobile: "9000000001", "Base Value": 5000 },
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
      mode: "merge_data",
      sport: "cricket",
    });

    expect(result.summary.deletes).toBe(0);
    expect(result.issues.some((i) => i.code === "PLAYER_WILL_BE_DELETED")).toBe(false);
  });
});
