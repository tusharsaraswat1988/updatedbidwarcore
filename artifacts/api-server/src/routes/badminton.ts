/**
 * Badminton API Routes
 *
 * All routes mounted at: /api/tournaments/:id/badminton/
 *
 * Endpoints:
 *   Players CRUD
 *   Courts CRUD
 *   Categories CRUD
 *   Registrations CRUD
 *   Fixtures management
 *   Match scoring (start, point, undo, timeout, end)
 *   Live SSE stream
 *   Analytics
 */

import { Router, type Request } from "express";
import { z } from "zod";
import { eq, and, asc, desc, count, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonPlayersTable,
  badmintonCourtsTable,
  badmintonCategoriesTable,
  badmintonRegistrationsTable,
  badmintonDrawsTable,
  badmintonFixturesTable,
  badmintonMatchDetailsTable,
  scoringMatchesTable,
  tournamentsTable,
} from "@workspace/db";
import { isOrganizerOrAdmin } from "../middleware/require-organizer";
import {
  BadmintonServiceError,
  awardPoint,
  createBadmintonMatch,
  getLiveBadmintonMatches,
  handleRetirement,
  handleTimeout,
  handleWalkover,
  replayMatch,
  startBadmintonMatch,
  undoLastPoint,
} from "../lib/badminton-service";
import {
  addBadmintonSseClient,
  broadcastBadmintonMatchUpdate,
  broadcastTournamentUpdate,
} from "../lib/badminton-broadcast";
import type { BadmintonMatchStartedPayload } from "@workspace/badminton-core";
import { STANDARD_FORMAT, BEST_OF_5_FORMAT } from "@workspace/badminton-core";

const router = Router({ mergeParams: true });

type MergedParams = Record<string, string>;

function parseId(v: string | undefined) {
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

function tid(req: Request): number | null {
  return parseId((req.params as MergedParams).id);
}

function actorFrom(req: Request, usedPin: boolean) {
  if (req.jwtUser?.isAdmin) return { type: "admin", id: "admin" };
  if (usedPin) return { type: "scorer_pin", id: "pin" };
  return { type: "organizer", id: req.jwtUser?.organizerAccountId?.toString() ?? "organizer" };
}

async function canWriteBadminton(
  req: Request,
  tournamentId: number,
  scorerPin?: string,
): Promise<{ ok: true; usedPin: boolean } | { ok: false }> {
  if (isOrganizerOrAdmin(req, tournamentId)) return { ok: true, usedPin: false };
  if (!scorerPin) return { ok: false };

  const [match] = await db
    .select({ scorerPin: badmintonMatchDetailsTable.scorerPin })
    .from(badmintonMatchDetailsTable)
    .where(eq(badmintonMatchDetailsTable.tournamentId, tournamentId))
    .limit(1);

  if (match?.scorerPin && match.scorerPin === scorerPin) {
    return { ok: true, usedPin: true };
  }
  return { ok: false };
}

// ─── SSE stream ───────────────────────────────────────────────────────────────

router.get("/stream", (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad tournament id" });

  const matchId = req.query.matchId ? parseId(req.query.matchId as string) : null;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const client = {
    res,
    matchId: matchId ?? 0,
    tournamentId,
  };

  addBadmintonSseClient(client);

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
  });
});

// ─── Players ─────────────────────────────────────────────────────────────────

router.get("/players", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const players = await db
    .select()
    .from(badmintonPlayersTable)
    .where(eq(badmintonPlayersTable.tournamentId, tournamentId))
    .orderBy(asc(badmintonPlayersTable.lastName), asc(badmintonPlayersTable.firstName));

  res.json(players);
});

router.post("/players", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    displayName: z.string().max(200).optional(),
    shortName: z.string().max(50).optional(),
    countryCode: z.string().max(3).optional(),
    countryName: z.string().max(100).optional(),
    stateName: z.string().max(100).optional(),
    academyName: z.string().max(200).optional(),
    dateOfBirth: z.string().optional(),
    ageGroup: z.string().max(20).optional(),
    gender: z.string().max(10).optional(),
    handedness: z.string().max(1).optional(),
    mobile: z.string().max(20).optional(),
    email: z.string().max(200).optional(),
    photoUrl: z.string().max(500).optional(),
    flagUrl: z.string().max(500).optional(),
    teamColor: z.string().max(10).optional(),
    worldRanking: z.number().int().optional(),
    nationalRanking: z.number().int().optional(),
    bwfCode: z.string().max(20).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const [player] = await db
    .insert(badmintonPlayersTable)
    .values({ tournamentId, ...parsed.data })
    .returning();

  broadcastTournamentUpdate(tournamentId, { type: "player_created", player });
  res.status(201).json(player);
});

router.get("/players/:playerId", async (req, res) => {
  const tournamentId = tid(req);
  const playerId = parseId((req.params as MergedParams).playerId);
  if (!tournamentId || !playerId) return void res.status(400).json({ error: "bad id" });

  const [player] = await db
    .select()
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.id, playerId),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!player) return void res.status(404).json({ error: "player not found" });
  res.json(player);
});

router.patch("/players/:playerId", async (req, res) => {
  const tournamentId = tid(req);
  const playerId = parseId((req.params as MergedParams).playerId);
  if (!tournamentId || !playerId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const [player] = await db
    .update(badmintonPlayersTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonPlayersTable.id, playerId),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  if (!player) return void res.status(404).json({ error: "player not found" });
  res.json(player);
});

router.delete("/players/:playerId", async (req, res) => {
  const tournamentId = tid(req);
  const playerId = parseId((req.params as MergedParams).playerId);
  if (!tournamentId || !playerId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  await db
    .delete(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.id, playerId),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    );

  res.json({ deleted: true });
});

// ─── Courts ──────────────────────────────────────────────────────────────────

router.get("/courts", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const courts = await db
    .select()
    .from(badmintonCourtsTable)
    .where(eq(badmintonCourtsTable.tournamentId, tournamentId))
    .orderBy(asc(badmintonCourtsTable.sortOrder), asc(badmintonCourtsTable.name));

  res.json(courts);
});

router.post("/courts", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    name: z.string().min(1).max(100),
    shortName: z.string().max(10).optional(),
    location: z.string().max(200).optional(),
    sortOrder: z.number().int().optional(),
    streamUrl: z.string().max(500).optional(),
    hasDisplay: z.boolean().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const [court] = await db
    .insert(badmintonCourtsTable)
    .values({ tournamentId, ...parsed.data })
    .returning();

  res.status(201).json(court);
});

router.patch("/courts/:courtId", async (req, res) => {
  const tournamentId = tid(req);
  const courtId = parseId((req.params as MergedParams).courtId);
  if (!tournamentId || !courtId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const [court] = await db
    .update(badmintonCourtsTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonCourtsTable.id, courtId),
        eq(badmintonCourtsTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  if (!court) return void res.status(404).json({ error: "court not found" });
  broadcastTournamentUpdate(tournamentId, { type: "court_updated", court });
  res.json(court);
});

router.delete("/courts/:courtId", async (req, res) => {
  const tournamentId = tid(req);
  const courtId = parseId((req.params as MergedParams).courtId);
  if (!tournamentId || !courtId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  await db
    .delete(badmintonCourtsTable)
    .where(
      and(
        eq(badmintonCourtsTable.id, courtId),
        eq(badmintonCourtsTable.tournamentId, tournamentId),
      ),
    );

  res.json({ deleted: true });
});

// ─── Categories ───────────────────────────────────────────────────────────────

router.get("/categories", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const categories = await db
    .select()
    .from(badmintonCategoriesTable)
    .where(eq(badmintonCategoriesTable.tournamentId, tournamentId))
    .orderBy(asc(badmintonCategoriesTable.sortOrder), asc(badmintonCategoriesTable.name));

  res.json(categories);
});

router.post("/categories", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    name: z.string().min(1).max(200),
    code: z.string().max(20).optional(),
    matchType: z.enum(["singles", "doubles", "mixed_doubles"]).default("singles"),
    ageGroup: z.string().max(20).optional(),
    gender: z.string().max(10).optional(),
    drawType: z.enum(["knockout", "round_robin", "group_knockout"]).default("knockout"),
    numSeeds: z.number().int().min(0).max(32).default(0),
    maxPlayers: z.number().int().optional(),
    entryFee: z.number().int().optional(),
    colorCode: z.string().max(10).optional(),
    matchFormatJson: z.object({
      totalGames: z.number(),
      pointsPerGame: z.number(),
      deuceAt: z.number(),
      maxPoints: z.number(),
      midGameSideChange: z.boolean(),
    }).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const [cat] = await db
    .insert(badmintonCategoriesTable)
    .values({ tournamentId, ...parsed.data })
    .returning();

  res.status(201).json(cat);
});

router.patch("/categories/:catId", async (req, res) => {
  const tournamentId = tid(req);
  const catId = parseId((req.params as MergedParams).catId);
  if (!tournamentId || !catId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const [cat] = await db
    .update(badmintonCategoriesTable)
    .set({ ...req.body, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonCategoriesTable.id, catId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  if (!cat) return void res.status(404).json({ error: "category not found" });
  res.json(cat);
});

// ─── Registrations ────────────────────────────────────────────────────────────

router.get("/categories/:catId/registrations", async (req, res) => {
  const tournamentId = tid(req);
  const catId = parseId((req.params as MergedParams).catId);
  if (!tournamentId || !catId) return void res.status(400).json({ error: "bad id" });

  const regs = await db
    .select({
      registration: badmintonRegistrationsTable,
      player1: badmintonPlayersTable,
    })
    .from(badmintonRegistrationsTable)
    .leftJoin(
      badmintonPlayersTable,
      eq(badmintonPlayersTable.id, badmintonRegistrationsTable.player1Id),
    )
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, catId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
      ),
    )
    .orderBy(asc(badmintonRegistrationsTable.seedNumber));

  res.json(regs);
});

router.post("/categories/:catId/registrations", async (req, res) => {
  const tournamentId = tid(req);
  const catId = parseId((req.params as MergedParams).catId);
  if (!tournamentId || !catId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    player1Id: z.number().int(),
    player2Id: z.number().int().optional(),
    seedNumber: z.number().int().min(1).max(32).optional(),
    status: z.enum(["pending", "accepted", "withdrawn"]).default("accepted"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const [reg] = await db
    .insert(badmintonRegistrationsTable)
    .values({ tournamentId, categoryId: catId, ...parsed.data })
    .returning();

  res.status(201).json(reg);
});

// ─── Fixtures ────────────────────────────────────────────────────────────────

router.get("/fixtures", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const categoryId = req.query.categoryId ? parseId(req.query.categoryId as string) : null;

  const whereConditions = [eq(badmintonFixturesTable.tournamentId, tournamentId)];
  if (categoryId) {
    whereConditions.push(eq(badmintonFixturesTable.categoryId, categoryId));
  }

  const fixtures = await db
    .select()
    .from(badmintonFixturesTable)
    .where(and(...whereConditions))
    .orderBy(asc(badmintonFixturesTable.id));

  res.json(fixtures);
});

// Generate fixtures for a category (knockout draw)
router.post("/categories/:catId/generate-draw", async (req, res) => {
  const tournamentId = tid(req);
  const catId = parseId((req.params as MergedParams).catId);
  if (!tournamentId || !catId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const [category] = await db
    .select()
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, catId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!category) return void res.status(404).json({ error: "category not found" });

  const registrations = await db
    .select()
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, catId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        eq(badmintonRegistrationsTable.status, "accepted"),
      ),
    );

  if (registrations.length < 2) {
    return void res.status(400).json({ error: "Need at least 2 players to generate draw" });
  }

  const fixtures = generateKnockoutDraw(tournamentId, catId, registrations);

  // Insert draw
  const [draw] = await db
    .insert(badmintonDrawsTable)
    .values({
      tournamentId,
      categoryId: catId,
      roundName: "Main Draw",
      roundNumber: 1,
      totalRounds: Math.ceil(Math.log2(registrations.length)),
      drawKind: "knockout_round",
      status: "active",
    })
    .returning();

  const insertedFixtures = await db
    .insert(badmintonFixturesTable)
    .values(fixtures.map((f) => ({ ...f, drawId: draw.id })))
    .returning();

  await db
    .update(badmintonCategoriesTable)
    .set({ phase: "live", updatedAt: new Date() })
    .where(eq(badmintonCategoriesTable.id, catId));

  res.status(201).json({ draw, fixtures: insertedFixtures });
});

// ─── Matches ──────────────────────────────────────────────────────────────────

router.get("/matches", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const matches = await getLiveBadmintonMatches(tournamentId);
  res.json(matches);
});

router.post("/matches", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });
  if (!isOrganizerOrAdmin(req, tournamentId)) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    categoryId: z.number().int().optional(),
    fixtureId: z.number().int().optional(),
    courtId: z.number().int().optional(),
    courtNumber: z.string().max(20).optional(),
    matchNumber: z.string().max(20).optional(),
    matchLabel: z.string().max(200).optional(),
    roundName: z.string().max(100).optional(),
    matchType: z.enum(["singles", "doubles", "mixed_doubles"]).default("singles"),
    matchFormatJson: z.object({
      totalGames: z.number(),
      pointsPerGame: z.number(),
      deuceAt: z.number(),
      maxPoints: z.number(),
      midGameSideChange: z.boolean(),
    }).optional(),
    leftSideJson: z.record(z.unknown()),
    rightSideJson: z.record(z.unknown()),
    scorerPin: z.string().max(20).optional(),
    scorerName: z.string().max(100).optional(),
    refereeName: z.string().max(100).optional(),
    umpireName: z.string().max(100).optional(),
    scheduledAt: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const match = await createBadmintonMatch({
    tournamentId,
    ...parsed.data,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
  });

  broadcastTournamentUpdate(tournamentId, { type: "match_created", matchId: match.id });
  res.status(201).json(match);
});

router.get("/matches/:matchId", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  const state = await replayMatch(matchId);
  if (!state) return void res.status(404).json({ error: "match not found" });

  const [detail] = await db
    .select()
    .from(badmintonMatchDetailsTable)
    .where(eq(badmintonMatchDetailsTable.scoringMatchId, matchId))
    .limit(1);

  res.json({ state, detail });
});

// ─── Scoring actions ──────────────────────────────────────────────────────────

router.post("/matches/:matchId/start", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await canWriteBadminton(req, tournamentId, req.headers["x-scorer-pin"] as string);
  if (!auth.ok) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    matchKind: z.enum(["singles", "doubles", "mixed_doubles"]),
    format: z.object({
      totalGames: z.number(),
      pointsPerGame: z.number(),
      deuceAt: z.number(),
      maxPoints: z.number(),
      midGameSideChange: z.boolean(),
    }).optional(),
    leftSide: z.object({
      label: z.string(),
      shortLabel: z.string(),
      countryCode: z.string().optional(),
      countryName: z.string().optional(),
      photoUrl: z.string().optional(),
      flagUrl: z.string().optional(),
      teamColor: z.string().optional(),
      playerIds: z.array(z.number()),
    }),
    rightSide: z.object({
      label: z.string(),
      shortLabel: z.string(),
      countryCode: z.string().optional(),
      countryName: z.string().optional(),
      photoUrl: z.string().optional(),
      flagUrl: z.string().optional(),
      teamColor: z.string().optional(),
      playerIds: z.array(z.number()),
    }),
    firstServer: z.enum(["left", "right"]),
    courtNumber: z.string().optional(),
    matchLabel: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await startBadmintonMatch(
      matchId,
      {
        ...parsed.data,
        format: parsed.data.format ?? STANDARD_FORMAT,
      } as BadmintonMatchStartedPayload,
      actorFrom(req, auth.usedPin),
    );

    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(400).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/point", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await canWriteBadminton(req, tournamentId, req.headers["x-scorer-pin"] as string);
  if (!auth.ok) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    side: z.enum(["left", "right"]),
    rallyLength: z.number().int().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await awardPoint(
      matchId,
      parsed.data.side,
      actorFrom(req, auth.usedPin),
      { rallyLength: parsed.data.rallyLength },
    );

    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(400).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/undo", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await canWriteBadminton(req, tournamentId, req.headers["x-scorer-pin"] as string);
  if (!auth.ok) return void res.status(403).json({ error: "forbidden" });

  try {
    const state = await undoLastPoint(matchId, actorFrom(req, auth.usedPin));
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(400).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/timeout", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await canWriteBadminton(req, tournamentId, req.headers["x-scorer-pin"] as string);
  if (!auth.ok) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    action: z.enum(["start", "end"]),
    side: z.enum(["left", "right"]).optional(),
    kind: z.enum(["regular", "medical"]).default("regular"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleTimeout(
      matchId,
      parsed.data.action,
      parsed.data.side ?? null,
      parsed.data.kind,
      actorFrom(req, auth.usedPin),
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(400).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/retirement", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await canWriteBadminton(req, tournamentId, req.headers["x-scorer-pin"] as string);
  if (!auth.ok) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    retiringSide: z.enum(["left", "right"]),
    reason: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleRetirement(
      matchId,
      parsed.data.retiringSide,
      actorFrom(req, auth.usedPin),
      parsed.data.reason,
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(400).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/walkover", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await canWriteBadminton(req, tournamentId, req.headers["x-scorer-pin"] as string);
  if (!auth.ok) return void res.status(403).json({ error: "forbidden" });

  const schema = z.object({
    winningSide: z.enum(["left", "right"]),
    reason: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleWalkover(
      matchId,
      parsed.data.winningSide,
      actorFrom(req, auth.usedPin),
      parsed.data.reason,
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(400).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

// ─── Dashboard / Analytics ───────────────────────────────────────────────────

router.get("/dashboard", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const [
    totalPlayers,
    totalCourts,
    totalCategories,
    matchStats,
  ] = await Promise.all([
    db
      .select({ count: count() })
      .from(badmintonPlayersTable)
      .where(eq(badmintonPlayersTable.tournamentId, tournamentId)),
    db
      .select({ count: count() })
      .from(badmintonCourtsTable)
      .where(eq(badmintonCourtsTable.tournamentId, tournamentId)),
    db
      .select({ count: count() })
      .from(badmintonCategoriesTable)
      .where(eq(badmintonCategoriesTable.tournamentId, tournamentId)),
    db
      .select({
        status: scoringMatchesTable.status,
        count: count(),
      })
      .from(scoringMatchesTable)
      .where(
        and(
          eq(scoringMatchesTable.tournamentId, tournamentId),
          eq(scoringMatchesTable.sportSlug, "badminton"),
        ),
      )
      .groupBy(scoringMatchesTable.status),
  ]);

  const matchStatMap: Record<string, number> = {};
  for (const row of matchStats) {
    matchStatMap[row.status] = Number(row.count);
  }

  const liveMatches = await db
    .select({
      match: scoringMatchesTable,
      detail: badmintonMatchDetailsTable,
    })
    .from(scoringMatchesTable)
    .leftJoin(
      badmintonMatchDetailsTable,
      eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
    )
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, "badminton"),
        eq(scoringMatchesTable.status, "live"),
      ),
    );

  res.json({
    totalPlayers: Number(totalPlayers[0]?.count ?? 0),
    totalCourts: Number(totalCourts[0]?.count ?? 0),
    totalCategories: Number(totalCategories[0]?.count ?? 0),
    matchesScheduled: matchStatMap["scheduled"] ?? 0,
    matchesLive: matchStatMap["live"] ?? 0,
    matchesCompleted: matchStatMap["completed"] ?? 0,
    liveMatches: liveMatches.map(({ match, detail }: { match: typeof scoringMatchesTable.$inferSelect; detail: typeof badmintonMatchDetailsTable.$inferSelect | null }) => ({
      ...match,
      detail: detail ?? null,
      state: detail?.stateSnapshotJson ?? null,
    })),
  });
});

// ─── Draw generator helper ────────────────────────────────────────────────────

function generateKnockoutDraw(
  tournamentId: number,
  categoryId: number,
  registrations: Array<{ id: number; seedNumber: number | null }>,
): Array<{
  tournamentId: number;
  categoryId: number;
  drawId: number;
  slotNumber: number;
  registrationAId: number | null;
  registrationBId: number | null;
  status: string;
}> {
  // Sort: seeds first, then unseeded
  const seeds = registrations
    .filter((r) => r.seedNumber !== null)
    .sort((a, b) => (a.seedNumber ?? 99) - (b.seedNumber ?? 99));
  const unseeded = registrations
    .filter((r) => r.seedNumber === null)
    .sort(() => Math.random() - 0.5);

  const ordered = [...seeds, ...unseeded];
  const n = ordered.length;

  // Find next power of 2
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const byes = bracketSize - n;

  // Build bracket slots
  const slots: Array<number | null> = [];
  for (let i = 0; i < bracketSize; i++) {
    slots.push(i < n ? ordered[i].id : null);
  }

  // Create first-round fixtures
  const fixtures = [];
  for (let i = 0; i < bracketSize; i += 2) {
    fixtures.push({
      tournamentId,
      categoryId,
      drawId: 0,
      slotNumber: Math.floor(i / 2) + 1,
      registrationAId: slots[i] ?? null,
      registrationBId: slots[i + 1] ?? null,
      status: slots[i] && slots[i + 1] ? "scheduled" : "walkover",
    });
  }

  return fixtures;
}

export default router;
