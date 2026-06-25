import { describe, expect, it } from "vitest";
import {
  buildCsvTemplateHeaders,
  parsePlayerCsv,
  type SportSpecCatalog,
} from "../csv-player-import";

const badmintonCatalog: SportSpecCatalog = {
  sportSlug: "badminton",
  roles: [{ id: 1, roleName: "Singles Player" }],
  groupsByRole: new Map([
    [
      "singles player",
      [
        { id: 11, roleId: 1, roleName: "Singles Player", groupName: "Playing Hand", displayOrder: 0 },
        { id: 12, roleId: 1, roleName: "Singles Player", groupName: "Playing Style", displayOrder: 1 },
      ],
    ],
  ]),
  allGroupNames: ["Playing Hand", "Playing Style"],
};

describe("csv-player-import", () => {
  it("builds dynamic headers from spec catalog", () => {
    const headers = buildCsvTemplateHeaders(badmintonCatalog);
    expect(headers).toContain("playing_hand");
    expect(headers).toContain("playing_style");
    expect(headers).not.toContain("battingStyle");
  });

  it("parses dynamic spec columns into specifications[]", () => {
    const csv = [
      buildCsvTemplateHeaders(badmintonCatalog),
      "Test Player,100000,Singles Player,Delhi,25,M,,,,9999999999,,,,Left Hand,Attacking",
    ].join("\n");

    const rows = parsePlayerCsv(csv, badmintonCatalog);
    expect(rows[0]?.specifications).toEqual([
      { specGroupId: 11, value: "Left Hand" },
      { specGroupId: 12, value: "Attacking" },
    ]);
  });

  it("accepts legacy battingStyle headers for backward compatibility", () => {
    const csv = [
      "name,basePrice,role,battingStyle,bowlingStyle,specialization,mobileNumber",
      "Legacy Player,100000,Batsman,Right Hand,Medium,All-rounder,9876543210",
    ].join("\n");

    const rows = parsePlayerCsv(csv, null);
    expect(rows[0]?.battingStyle).toBe("Right Hand");
    expect(rows[0]?.bowlingStyle).toBe("Medium");
  });
});
