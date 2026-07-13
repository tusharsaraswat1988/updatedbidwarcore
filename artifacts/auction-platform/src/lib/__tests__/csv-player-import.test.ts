import { describe, expect, it } from "vitest";
import {
  buildCsvTemplateExampleRow,
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

const footballCatalog: SportSpecCatalog = {
  sportSlug: "football",
  roles: [{ id: 2, roleName: "Forward" }],
  groupsByRole: new Map([
    [
      "forward",
      [
        { id: 21, roleId: 2, roleName: "Forward", groupName: "Preferred Foot", displayOrder: 0 },
      ],
    ],
  ]),
  allGroupNames: ["Preferred Foot"],
};

const cricketCatalog: SportSpecCatalog = {
  sportSlug: "cricket",
  roles: [{ id: 3, roleName: "Batsman" }],
  groupsByRole: new Map([
    [
      "batsman",
      [
        { id: 31, roleId: 3, roleName: "Batsman", groupName: "Batting Hand", displayOrder: 0 },
      ],
    ],
  ]),
  allGroupNames: ["Batting Hand"],
};

describe("csv-player-import", () => {
  it("builds dynamic headers from spec catalog", () => {
    const headers = buildCsvTemplateHeaders(badmintonCatalog);
    expect(headers).toContain("playing_hand");
    expect(headers).toContain("playing_style");
    expect(headers).not.toContain("battingStyle");
  });

  it("excludes cricheroUrl from non-cricket templates", () => {
    expect(buildCsvTemplateHeaders(footballCatalog)).not.toContain("cricheroUrl");
    expect(buildCsvTemplateHeaders(badmintonCatalog)).not.toContain("cricheroUrl");
    expect(buildCsvTemplateHeaders(cricketCatalog)).toContain("cricheroUrl");
  });

  it("builds sport-specific example rows without cricket fields for football", () => {
    const headers = buildCsvTemplateHeaders(footballCatalog);
    const example = buildCsvTemplateExampleRow(footballCatalog);
    expect(headers).toContain("preferred_foot");
    expect(example).toContain("Forward");
    expect(example).toContain("Right");
    expect(example).not.toContain("crichero");
    expect(example.split(",").length).toBe(headers.split(",").length);
  });

  it("parses dynamic spec columns into specifications[]", () => {
    const csv = [
      buildCsvTemplateHeaders(badmintonCatalog),
      "Test Player,100000,Singles Player,Delhi,25,M,,,,9999999999,,,Left Hand,Attacking",
    ].join("\n");

    const rows = parsePlayerCsv(csv, badmintonCatalog);
    expect(rows[0]?.specifications).toEqual([
      { specGroupId: 11, value: "Left Hand" },
      { specGroupId: 12, value: "Attacking" },
    ]);
    expect(rows[0]?.cricheroUrl).toBeUndefined();
  });

  it("ignores cricheroUrl when parsing non-cricket CSV that still includes the column", () => {
    const csv = [
      "name,basePrice,role,mobileNumber,cricheroUrl,preferred_foot",
      "Football Player,100000,Forward,9876543210,https://crichero.com/x,Left",
    ].join("\n");

    const rows = parsePlayerCsv(csv, footballCatalog);
    expect(rows[0]?.cricheroUrl).toBeUndefined();
    expect(rows[0]?.specifications).toEqual([{ specGroupId: 21, value: "Left" }]);
  });

  it("keeps cricheroUrl when parsing cricket CSV", () => {
    const csv = [
      buildCsvTemplateHeaders(cricketCatalog),
      "Rohit,1000000,Batsman,Mumbai,36,M,45,L,,9876543210,,,https://crichero.com/rohit,Right-hand",
    ].join("\n");

    const rows = parsePlayerCsv(csv, cricketCatalog);
    expect(rows[0]?.cricheroUrl).toBe("https://crichero.com/rohit");
    expect(rows[0]?.specifications).toEqual([{ specGroupId: 31, value: "Right-hand" }]);
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
