import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const scorerAuthUrl = new URL("../lib/scorer-auth.ts", import.meta.url);
const scorerLockUrl = new URL("../lib/scorer-match-locks.ts", import.meta.url);
const scoringFoundationServiceUrl = new URL("../lib/scoring-foundation-service.ts", import.meta.url);
const scorerRouteUrl = new URL("../routes/scorer.ts", import.meta.url);

const auctionRoot = new URL("../../../auction-platform/src/", import.meta.url);
const scorerApiUrl = new URL("lib/scorer-api.ts", auctionRoot);
const cricketScorerPageUrl = new URL("pages/cricket/scorer.tsx", auctionRoot);
const cricketScorerHomePageUrl = new URL("pages/cricket/scorer-home.tsx", auctionRoot);

describe("Scorer Lifecycle, Delete Invalidation, PIN Sync & Lock Takeover", () => {
  it("scorer-auth.ts exports removeScorerFromTournament that revokes sessions and unassigns", async () => {
    const src = await readFile(scorerAuthUrl, "utf8");
    expect(src).toContain("export async function removeScorerFromTournament");
    expect(src).toContain("scorerTournamentAssignmentsTable");
    expect(src).toContain("scorerSessionsTable");
    expect(src).toContain("scorerMatchLocksTable");
    expect(src).toContain("clearAllScorerLoginLockouts");
  });

  it("createScorerAccountForTournament updates PIN hash and clears lockouts for existing accounts", async () => {
    const src = await readFile(scorerAuthUrl, "utf8");
    expect(src).toContain("createScorerAccountForTournament");
    expect(src).toContain("clearAllScorerLoginLockouts(mobile)");
    expect(src).toContain("hashScorerPin(pin)");
  });

  it("scoring-foundation-service.ts calls removeScorerFromTournament on deleteScoringOfficial", async () => {
    const src = await readFile(scoringFoundationServiceUrl, "utf8");
    const fnIdx = src.indexOf("export async function deleteScoringOfficial");
    expect(fnIdx).toBeGreaterThan(-1);
    const slice = src.slice(fnIdx, fnIdx + 1200);
    expect(slice).toContain("removeScorerFromTournament");
  });

  it("scorer-match-locks.ts supports forceTakeover in acquireMatchLock", async () => {
    const src = await readFile(scorerLockUrl, "utf8");
    const fnIdx = src.indexOf("export async function acquireMatchLock");
    expect(fnIdx).toBeGreaterThan(-1);
    const slice = src.slice(fnIdx, fnIdx + 3000);
    expect(slice).toContain("forceTakeover");
    expect(slice).toContain("lock_force_takeover");
  });

  it("routes/scorer.ts accepts forceTakeover in match lock route", async () => {
    const src = await readFile(scorerRouteUrl, "utf8");
    expect(src).toContain("forceTakeover: z.boolean().optional()");
    expect(src).toContain("forceTakeover: meta.success ? meta.data.forceTakeover : undefined");
  });

  it("frontend scorer-api.ts passes forceTakeover to match lock endpoint", async () => {
    const src = await readFile(scorerApiUrl, "utf8");
    expect(src).toContain("forceTakeover?: boolean");
    expect(src).toContain("forceTakeover: meta?.forceTakeover");
  });

  it("frontend scorer.tsx has Take Over on This Device action", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    expect(src).toContain("Take Over on This Device");
    expect(src).toContain("forceTakeover: true");
  });

  it("frontend scorer-home.tsx normalizes 10-digit mobile number", async () => {
    const src = await readFile(cricketScorerHomePageUrl, "utf8");
    expect(src).toContain('.slice(-10)');
  });
});
