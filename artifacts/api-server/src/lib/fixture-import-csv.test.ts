import { describe, expect, it } from "vitest";
import {
  buildAliasesForRegistration,
  buildImportedFixtureMeta,
  buildRegistrationAliasMap,
  parseDrawCsv,
  resolveImportFixtures,
  sideLabelJson,
} from "./fixture-import-csv";

/** Golden sample — headers + two QF fixtures with mixed name forms. */
const GOLDEN_CSV = `round,slot,player_a,player_b
Quarter Finals,1,Anita Rao,Ben Cruz
Quarter Finals,2,Chris Diaz / Dana Lee,Eve Ng
`;

describe("parseDrawCsv", () => {
  it("parses golden CSV sample with round,slot,player_a,player_b", () => {
    const rows = parseDrawCsv(GOLDEN_CSV);
    expect(rows).toEqual([
      {
        roundName: "Quarter Finals",
        slotNumber: 1,
        playerA: "Anita Rao",
        playerB: "Ben Cruz",
        rowNumber: 1,
      },
      {
        roundName: "Quarter Finals",
        slotNumber: 2,
        playerA: "Chris Diaz / Dana Lee",
        playerB: "Eve Ng",
        rowNumber: 2,
      },
    ]);
  });

  it("accepts side_a / side_b header aliases", () => {
    const rows = parseDrawCsv(`side_a,side_b\nAlice,Bob\n`);
    expect(rows).toHaveLength(1);
    expect(rows[0].playerA).toBe("Alice");
    expect(rows[0].playerB).toBe("Bob");
  });

  it("rejects missing player columns", () => {
    expect(() => parseDrawCsv(`name,score\nA,1\n`)).toThrow(/player_a/);
  });
});

describe("resolveImportFixtures", () => {
  it("resolves known names to registration IDs and keeps label-only for unknowns", () => {
    const entries = [
      buildAliasesForRegistration({
        registrationId: 10,
        player1: { firstName: "Anita", lastName: "Rao", displayName: "Anita Rao" },
      }),
      buildAliasesForRegistration({
        registrationId: 11,
        player1: { firstName: "Ben", lastName: "Cruz", displayName: "Ben Cruz" },
      }),
      buildAliasesForRegistration({
        registrationId: 20,
        player1: { firstName: "Chris", lastName: "Diaz", displayName: "Chris Diaz" },
        player2: { firstName: "Dana", lastName: "Lee", displayName: "Dana Lee" },
      }),
    ];
    const aliasMap = buildRegistrationAliasMap(entries);
    const rows = parseDrawCsv(GOLDEN_CSV);
    const resolved = resolveImportFixtures(rows, aliasMap);

    expect(resolved[0].sideA).toEqual({ registrationId: 10, label: "Anita Rao" });
    expect(resolved[0].sideB).toEqual({ registrationId: 11, label: "Ben Cruz" });
    expect(resolved[1].sideA).toEqual({
      registrationId: 20,
      label: "Chris Diaz / Dana Lee",
    });
    // Eve Ng is not in the category — label-only
    expect(resolved[1].sideB).toEqual({ registrationId: null, label: "Eve Ng" });

    const meta = buildImportedFixtureMeta(resolved[1]);
    expect(meta.sideA).toEqual(sideLabelJson("Chris Diaz / Dana Lee"));
    expect(meta.sideB).toEqual(sideLabelJson("Eve Ng"));
    expect(meta.roundName).toBe("Quarter Finals");
  });
});
