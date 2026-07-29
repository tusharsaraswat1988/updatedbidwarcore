import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * S3-04 — structural guards without a live DB.
 * Ensures organizer match delete stays transactional and deletes details
 * before/with the match (no orphan badminton_match_details).
 */
describe("S3-04 deleteBadmintonMatch transactional contract", () => {
  const source = readFileSync(
    resolve(__dirname, "../lib/badminton-service.ts"),
    "utf8",
  );

  const start = source.indexOf("export async function deleteBadmintonMatch");
  const next = source.indexOf("\nexport async function", start + 1);
  const deleteFn = source.slice(start, next === -1 ? source.length : next);

  it("wraps match delete in db.transaction", () => {
    expect(deleteFn).toContain("await db.transaction(async (tx) =>");
  });

  it("deletes match_details inside the transaction before scoring_matches", () => {
    const detailsIdx = deleteFn.indexOf(".delete(badmintonMatchDetailsTable)");
    const matchIdx = deleteFn.indexOf(".delete(scoringMatchesTable)");
    expect(detailsIdx).toBeGreaterThan(-1);
    expect(matchIdx).toBeGreaterThan(-1);
    expect(detailsIdx).toBeLessThan(matchIdx);
  });

  it("deletes scoring_events inside the same transaction", () => {
    expect(deleteFn).toContain(".delete(scoringEventsTable)");
  });

  it("documents forensic history forfeiture and deferred FK", () => {
    expect(deleteFn).toMatch(/forfeits forensic/i);
    expect(deleteFn).toMatch(/FK follow-up \(deferred\)/i);
  });
});
