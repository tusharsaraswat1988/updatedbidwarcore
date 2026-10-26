import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { afterAll, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";

const require = createRequire(path.resolve(import.meta.dirname, "../../../../lib/db/package.json"));
const pg = require("pg") as typeof import("pg");
import { auctionSessionsTable } from "@workspace/db/schema";
import { ledOverlaySessionPatch } from "../lib/led-overlay-patch";
import {
  commitPresentationContext,
  presentationWriteFailure,
} from "../lib/presentation-context-write";

function databaseUrlFromEnvFile(): string {
  const envPath = path.resolve(import.meta.dirname, "../../../../.env");
  const text = fs.readFileSync(envPath, "utf8");
  const match = text.match(/^DATABASE_URL=(.*)$/m);
  if (!match) throw new Error("DATABASE_URL is missing from the repo env file");
  let value = match[1].trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  return value;
}

const TOURNAMENT_A = 2_147_483_001;
const TOURNAMENT_B = 2_147_483_002;
const pool = new pg.Pool({
  connectionString: databaseUrlFromEnvFile(),
  max: 4,
  connectionTimeoutMillis: 10_000,
});
const database = drizzle(pool);

async function resetRow(tournamentId: number, obsContextJson: string | null) {
  await database
    .insert(auctionSessionsTable)
    .values({ tournamentId, status: "idle", obsContextJson })
    .onConflictDoUpdate({
      target: auctionSessionsTable.tournamentId,
      set: { obsContextJson, status: "idle" },
    });
}

async function stored(tournamentId: number) {
  const [row] = await database
    .select({ obsContextJson: auctionSessionsTable.obsContextJson })
    .from(auctionSessionsTable)
    .where(eq(auctionSessionsTable.tournamentId, tournamentId))
    .limit(1);
  return row?.obsContextJson ? JSON.parse(row.obsContextJson) as {
    context: string;
    selectedTeamId: number | null;
    revision: number;
  } : null;
}

describe("presentation context compare-and-set", () => {
  afterAll(async () => {
    await database
      .delete(auctionSessionsTable)
      .where(inArray(auctionSessionsTable.tournamentId, [TOURNAMENT_A, TOURNAMENT_B]));
    await pool.end();
  });

  it("rejects a caller that does not send a revision and leaves the row unchanged", async () => {
    await resetRow(TOURNAMENT_A, null);
    const result = await commitPresentationContext(database, {
      tournamentId: TOURNAMENT_A,
      context: "top5",
      selectedTeamId: null,
      overlayPatch: ledOverlaySessionPatch("top5"),
    });
    expect(result).toEqual({ ok: false, code: "presentation_revision_required" });
    expect(presentationWriteFailure("presentation_revision_required").status).toBe(400);
    expect(await stored(TOURNAMENT_A)).toBeNull();
  });

  it("accepts sequential operator selections and rejects a stale revision afterwards", async () => {
    await resetRow(TOURNAMENT_A, null);
    const first = await commitPresentationContext(database, {
      tournamentId: TOURNAMENT_A,
      expectedRevision: 0,
      context: "top5",
      selectedTeamId: null,
      overlayPatch: ledOverlaySessionPatch("top5"),
    });
    const second = await commitPresentationContext(database, {
      tournamentId: TOURNAMENT_A,
      expectedRevision: 1,
      context: "team",
      selectedTeamId: 19,
      overlayPatch: ledOverlaySessionPatch("team"),
    });
    const stale = await commitPresentationContext(database, {
      tournamentId: TOURNAMENT_A,
      expectedRevision: 1,
      context: "top5",
      selectedTeamId: null,
      overlayPatch: ledOverlaySessionPatch("top5"),
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(stale).toEqual({ ok: false, code: "stale_presentation" });
    expect(presentationWriteFailure("stale_presentation").status).toBe(409);
    expect(await stored(TOURNAMENT_A)).toEqual({
      context: "team",
      selectedTeamId: 19,
      revision: 2,
    });
  });

  it("lets only one of two concurrent writes from the same revision commit", async () => {
    await resetRow(TOURNAMENT_A, JSON.stringify({ context: "auction", selectedTeamId: null, revision: 4 }));
    const [top5, team] = await Promise.all([
      commitPresentationContext(database, {
        tournamentId: TOURNAMENT_A,
        expectedRevision: 4,
        context: "top5",
        selectedTeamId: null,
        overlayPatch: ledOverlaySessionPatch("top5"),
      }),
      commitPresentationContext(database, {
        tournamentId: TOURNAMENT_A,
        expectedRevision: 4,
        context: "team",
        selectedTeamId: null,
        overlayPatch: ledOverlaySessionPatch("team"),
      }),
    ]);

    const winners = [top5, team].filter((result) => result.ok);
    expect(winners).toHaveLength(1);
    const saved = await stored(TOURNAMENT_A);
    expect(saved?.revision).toBe(5);
    expect(saved?.context).toBe(winners[0] && winners[0].ok ? winners[0].presentation.context : "");
  });

  it("keeps presentation revisions independent per tournament", async () => {
    await resetRow(TOURNAMENT_A, null);
    await resetRow(TOURNAMENT_B, null);
    const [a, b] = await Promise.all([
      commitPresentationContext(database, {
        tournamentId: TOURNAMENT_A,
        expectedRevision: 0,
        context: "top5",
        selectedTeamId: null,
        overlayPatch: ledOverlaySessionPatch("top5"),
      }),
      commitPresentationContext(database, {
        tournamentId: TOURNAMENT_B,
        expectedRevision: 0,
        context: "team",
        selectedTeamId: 17,
        overlayPatch: ledOverlaySessionPatch("team"),
      }),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(await stored(TOURNAMENT_A)).toMatchObject({ context: "top5", revision: 1 });
    expect(await stored(TOURNAMENT_B)).toMatchObject({ context: "team", selectedTeamId: 17, revision: 1 });
  });
});
