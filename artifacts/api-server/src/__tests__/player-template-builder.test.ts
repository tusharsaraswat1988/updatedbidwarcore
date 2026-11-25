import { describe, it, expect } from "vitest";
import {
  buildTemplateColumns,
  buildPlayerTemplateExcel,
  buildPlayerTemplateCsv,
  type TemplateBuilderContext,
} from "../lib/bulk-import/player-template-builder";

describe("player-template-builder", () => {
  const mockContext: TemplateBuilderContext = {
    tournament: {
      id: 42,
      name: "Diamonds Premier League",
      sport: "cricket",
      minBid: 50000,
      currency: "INR",
    },
    categories: [
      { id: 1, name: "Diamond", minBid: 100000 },
      { id: 2, name: "Gold", minBid: 50000 },
    ],
    teams: [
      { id: 10, name: "Mumbai Warriors", shortCode: "MW" },
      { id: 11, name: "Delhi Titans", shortCode: "DT" },
    ],
    sportRoles: [
      { id: 1, roleName: "Batsman" },
      { id: 2, roleName: "Bowler" },
      { id: 3, roleName: "All Rounder" },
      { id: 4, roleName: "Wicket Keeper" },
    ],
  };

  it("builds comprehensive columns for Cricket with sport specs, categories, kit sizes, and teams", () => {
    const cols = buildTemplateColumns(mockContext);
    const keys = cols.map((c) => c.key);

    expect(keys).toContain("name");
    expect(keys).toContain("mobileNumber");
    expect(keys).toContain("category");
    expect(keys).toContain("role");
    expect(keys).toContain("basePrice");
    expect(keys).toContain("gender");
    expect(keys).toContain("jerseyNumber");
    expect(keys).toContain("jerseySize");
    expect(keys).toContain("lowerSize");
    expect(keys).toContain("team");
    expect(keys).toContain("status");
    expect(keys).toContain("retainedPrice");
    expect(keys).toContain("playerTag");
    expect(keys).toContain("batting_hand");
    expect(keys).toContain("bowling_arm");
    expect(keys).toContain("bowling_style");
    expect(keys).toContain("cricheroUrl");
    expect(keys).toContain("photoUrl");
    expect(keys).toContain("achievements");
    expect(keys).toContain("availabilityDates");

    // Check dropdown options
    const categoryCol = cols.find((c) => c.key === "category");
    expect(categoryCol?.validationList).toEqual(["Diamond", "Gold"]);

    const teamCol = cols.find((c) => c.key === "team");
    expect(teamCol?.validationList).toEqual(["Mumbai Warriors", "Delhi Titans"]);

    const roleCol = cols.find((c) => c.key === "role");
    expect(roleCol?.validationList).toEqual(["Batsman", "Bowler", "All Rounder", "Wicket Keeper"]);

    const jerseySizeCol = cols.find((c) => c.key === "jerseySize");
    expect(jerseySizeCol?.validationList).toContain("M");
    expect(jerseySizeCol?.validationList).toContain("XL");

    const lowerSizeCol = cols.find((c) => c.key === "lowerSize");
    expect(lowerSizeCol?.validationList).toContain("32");
    expect(lowerSizeCol?.validationList).toContain("34");
  });

  it("generates a valid .xlsx binary buffer with multiple sheets", async () => {
    const buffer = await buildPlayerTemplateExcel(mockContext);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(1000);

    // Verify it is a valid zip/xlsx (starts with PK)
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });

  it("generates a clean CSV with headers and sample rows", () => {
    const csv = buildPlayerTemplateCsv(mockContext);
    expect(typeof csv).toBe("string");
    const lines = csv.trim().split("\n");
    expect(lines.length).toBe(3); // header + 2 sample rows

    const header = lines[0]!;
    expect(header).toContain("name");
    expect(header).toContain("mobileNumber");
    expect(header).toContain("category");
    expect(header).toContain("team");
    expect(header).toContain("lowerSize");
    expect(header).toContain("batting_hand");
  });
});
