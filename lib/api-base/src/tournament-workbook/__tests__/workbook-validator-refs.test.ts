import { describe, expect, it } from "vitest";
import { validateWorkbook } from "../workbook-validator";
import type { ParsedWorkbook } from "../types";

describe("validateWorkbook ref names", () => {
  it("accepts categories added on 02_Categories before they exist in DB", () => {
    const workbook: ParsedWorkbook = {
      sheets: {
        "02_Categories": [{ "Category Name": "Males" }, { "Category Name": "Females" }],
        "03_Players": [
          {
            "Player Name": "Test Player",
            Mobile: "9000000001",
            Category: "Males",
            "Base Value": 5000,
          },
        ],
      },
      manifest: null,
    };

    const result = validateWorkbook(workbook, {
      tournamentId: 1,
      minBid: 5000,
      bidValueMode: "player",
      bidValueOptions: [5000, 10000, 25000, 50000],
      categoryNames: new Map(),
      teamNames: new Map(),
      existingPlayers: [
        {
          id: 1,
          name: "Test Player",
          mobileNumber: "9000000001",
          email: null,
          age: null,
        },
      ],
      mode: "dry_run",
      sport: "cricket",
    });

    const categoryErrors = result.issues.filter(
      (i) => i.severity === "error" && i.column === "Category",
    );
    expect(categoryErrors).toHaveLength(0);
  });
});
