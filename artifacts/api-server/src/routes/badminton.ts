/**
 * Badminton API Routes
 *
 * Tenant isolation model:
 * ─────────────────────────────────────────────────────────────────────────────
 * Every route is mounted under /api/tournaments/:id/badminton/
 * The `:id` URL parameter is the tournamentId (tenant boundary).
 *
 * READ endpoints (players, courts, categories, registrations, fixtures,
 * matches, dashboard, SSE stream) are intentionally public so that
 * audience displays, scoreboards and OBS overlays can be embedded without
 * auth.  All reads are scoped to the URL tournament; no cross-tournament
 * leakage is possible.
 *
 * WRITE endpoints (POST/PATCH/DELETE on entities and all scoring actions)
 * require EITHER:
 *   1. Admin JWT
 *   2. Tournament-specific organizer JWT  (organizer[tournamentId] === true)
 *   3. Per-match scorer PIN   (scoring actions only)
 *
 * The broad-account check (organizerAccountId) intentionally EXCLUDED from
 * badminton writes so that an organizer-account holder cannot manipulate
 * tournaments they do not own.  See requireBadmintonWrite / isTournamentOwner.
 *
 * Service layer additionally re-verifies match.tournamentId === URL tournamentId
 * on every scoring action, making IDOR impossible even if a caller somehow
 * bypasses the route-layer checks.
 */

import { Router, type Request } from "express";
import { z } from "zod";
import { eq, and, asc, count } from "drizzle-orm";
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
} from "@workspace/db";
import {
  BadmintonServiceError,
  awardPoint,
  createBadmintonMatch,
  updateBadmintonMatch,
  deleteBadmintonMatch,
  ensureBadmintonTournament,
  getLiveBadmintonMatches,
  serializeBadmintonMatchDetail,
  verifyMatchScorerPin,
  handleRetirement,
  handleTimeout,
  handleInterval,
  handleCourtChangeAck,
  handleWalkover,
  handleDisqualification,
  handlePauseMatch,
  handleResumeMatch,
  handleAddMatchNote,
  handleForceEndMatch,
  getMatchIncidentLog,
  getMatchReportData,
  replayMatch,
  startBadmintonMatch,
  undoLastPoint,
} from "../lib/badminton-service";
import { allocateTournamentInitials } from "../lib/master-sports/tournament-initials";
import {
  buildSideJsonFromBadmintonPlayer,
  listBadmintonPlayersForMatchRoster,
  listBadmintonPlayersForOrganizer,
} from "../lib/master-sports/badminton";
import {
  addBadmintonSseClient,
  broadcastBadmintonMatchUpdate,
  broadcastTournamentUpdate,
} from "../lib/badminton-broadcast";
import type { BadmintonMatchStartedPayload } from "@workspace/badminton-core";
import { STANDARD_FORMAT } from "@workspace/badminton-core";
import { scoringFeatureMiddleware } from "../lib/scoring-feature";
import { generateMatchReportPdf } from "../lib/badminton-match-report";

const router = Router({ mergeParams: true });

router.use(scoringFeatureMiddleware);

type MergedParams = Record<string, string>;

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseId(v: string | undefined): number | null {
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
  const tournamentId = tid(req);
  if (
    tournamentId &&
    req.jwtUser?.tournamentDirector?.[String(tournamentId)]
  ) {
    return {
      type: "tournament_director",
      id: req.jwtUser?.organizerAccountId?.toString() ?? "director",
    };
  }
  return {
    type: "organizer",
    id: req.jwtUser?.organizerAccountId?.toString() ?? "organizer",
  };
}

// ── Authorization ─────────────────────────────────────────────────────────────

/**
 * Tighter tournament-specific auth for badminton writes.
 *
 * Grants access ONLY when the caller is:
 *  1. An admin, OR
 *  2. Explicitly listed as organizer for THIS tournament in their JWT
 *     (organizer[tournamentId] === true).
 *
 * Deliberately does NOT grant access to any holder of organizerAccountId
 * who is not specifically authorized for this tournament.  This prevents
 * cross-tenant writes between independently-owned tournaments.
 */
function isTournamentOwner(req: Request, tournamentId: number): boolean {
  const u = req.jwtUser;
  if (!u) return false;
  if (u.isAdmin) return true;
  // Suspended organizer accounts are locked out entirely.
  const status = req.organizerAccountLicenseStatus;
  if (status === "suspended") return false;
  // Tournament-specific grant only — NOT the broad organizerAccountId path.
  // This prevents an organizer-account holder from writing to tournaments they
  // do not explicitly own.
  return !!(u.organizer?.[String(tournamentId)]);
}

/**
 * Tournament Director / Admin match administration.
 * Scorer PIN is explicitly excluded — director actions are not umpire actions.
 */
function isTournamentDirector(req: Request, tournamentId: number): boolean {
  const u = req.jwtUser;
  if (!u) return false;
  if (u.isAdmin) return true;
  const status = req.organizerAccountLicenseStatus;
  if (status === "suspended") return false;
  if (u.organizer?.[String(tournamentId)]) return true;
  return !!(u.tournamentDirector?.[String(tournamentId)]);
}

async function guardBadmintonDirector(
  req: Request,
  res: import("express").Response,
  matchId: number,
): Promise<{ tournamentId: number } | null> {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "bad id" });
    return null;
  }
  if (!(await guardBadmintonTournament(tournamentId, res))) return null;
  if (!isTournamentDirector(req, tournamentId)) {
    res.status(403).json({ error: "forbidden — tournament director access required" });
    return null;
  }
  return { tournamentId };
}

function respondBadmintonServiceError(
  res: import("express").Response,
  err: unknown,
): boolean {
  if (err instanceof BadmintonServiceError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return true;
  }
  return false;
}

/** Reject entity/scoring writes unless tournament.sport is badminton. */
async function guardBadmintonTournament(
  tournamentId: number,
  res: import("express").Response,
): Promise<boolean> {
  try {
    await ensureBadmintonTournament(tournamentId);
    return true;
  } catch (err) {
    if (respondBadmintonServiceError(res, err)) return false;
    throw err;
  }
}

/** Tournament owner write guard including badminton sport check. */
async function guardBadmintonWrite(
  req: Request,
  res: import("express").Response,
): Promise<number | null> {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "bad id" });
    return null;
  }
  if (!(await guardBadmintonTournament(tournamentId, res))) return null;
  if (!isTournamentOwner(req, tournamentId)) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  return tournamentId;
}

/** Scoring write guard: badminton sport + owner or per-match PIN. */
async function guardBadmintonScoring(
  req: Request,
  res: import("express").Response,
  matchId: number,
): Promise<{ tournamentId: number; usedPin: boolean } | null> {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "bad id" });
    return null;
  }
  if (!(await guardBadmintonTournament(tournamentId, res))) return null;

  const auth = await canWriteScoring(req, tournamentId, matchId);
  if (!auth.ok) {
    res.status(403).json({ error: "forbidden" });
    return null;
  }
  return { tournamentId, usedPin: auth.usedPin };
}

/**
 * Check write permission for a scoring action.
 *
 * Priority order:
 *  1. Tournament owner / admin  → always allowed
 *  2. Per-match scorer PIN      → only allows scoring on that specific match
 *
 * The PIN is looked up scoped to BOTH the tournamentId AND matchId,
 * preventing a PIN from one match authorising scoring on another.
 */
async function canWriteScoring(
  req: Request,
  tournamentId: number,
  matchId: number,
): Promise<{ ok: true; usedPin: boolean } | { ok: false }> {
  if (isTournamentOwner(req, tournamentId)) return { ok: true, usedPin: false };

  const pinHeader = req.headers["x-scorer-pin"] as string | undefined;
  if (!pinHeader) return { ok: false };

  // Scope PIN lookup to both tournamentId AND matchId.
  const [detail] = await db
    .select({ scorerPin: badmintonMatchDetailsTable.scorerPin })
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),      // per-match
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),    // tenant guard
      ),
    )
    .limit(1);

  if (detail?.scorerPin && detail.scorerPin === pinHeader) {
    return { ok: true, usedPin: true };
  }
  return { ok: false };
}

// ─── SSE stream ───────────────────────────────────────────────────────────────

/**
 * Public — scoreboards and OBS overlays embed this without auth.
 * Client is registered with tournamentId so broadcasts are tenant-scoped.
 */
router.get("/stream", (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad tournament id" });

  const matchId = req.query.matchId ? parseId(req.query.matchId as string) : null;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  addBadmintonSseClient({ res, matchId: matchId ?? 0, tournamentId });

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on("close", () => clearInterval(heartbeat));
});

// ─── Players ─────────────────────────────────────────────────────────────────

/** Public read — scoped by tournamentId. */
router.get("/players", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const players = await listBadmintonPlayersForOrganizer(tournamentId);

  res.json(players);
});

/** Registered roster for match creation — tournament players only, not global catalog. */
router.get("/match-roster", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const roster = await listBadmintonPlayersForMatchRoster(tournamentId);
  res.json(roster);
});

router.get("/players/:playerId/side-json", async (req, res) => {
  const tournamentId = tid(req);
  const playerId = parseId((req.params as MergedParams).playerId);
  if (!tournamentId || !playerId) return void res.status(400).json({ error: "bad id" });

  try {
    const sideJson = await buildSideJsonFromBadmintonPlayer(playerId, tournamentId);
    res.json(sideJson);
  } catch {
    res.status(404).json({ error: "Player not found" });
  }
});

const walkInPlayerBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    shortName: z.string().max(50).optional(),
    photoUrl: z.string().max(500).optional(),
    mobile: z.string().max(20).optional(),
    email: z.string().max(200).optional(),
    gender: z.enum(["M", "F"]).or(z.literal("")).optional(),
    handedness: z.enum(["R", "L"]).optional(),
    city: z.string().max(100).optional(),
    age: z.number().int().min(1).max(120).optional(),
    role: z.string().max(100).optional(),
    jerseyNumber: z.string().max(20).optional(),
    jerseySize: z.string().max(10).optional(),
    achievements: z.string().max(2000).optional(),
  })
  .refine(
    (data) => Boolean(data.name?.trim() || (data.firstName?.trim() && data.lastName?.trim())),
    { message: "Full name is required" },
  );

function splitWalkInName(name: string): { firstName: string; lastName: string } {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const spaceIdx = trimmed.lastIndexOf(" ");
  if (spaceIdx <= 0) {
    return { firstName: trimmed, lastName: trimmed };
  }
  return {
    firstName: trimmed.slice(0, spaceIdx),
    lastName: trimmed.slice(spaceIdx + 1),
  };
}

function buildWalkInMetaJson(
  input: z.infer<typeof walkInPlayerBodySchema>,
  existing?: Record<string, unknown> | null,
): Record<string, unknown> {
  const meta = { ...(existing ?? {}) };
  if (input.city !== undefined) meta.city = input.city || null;
  if (input.age !== undefined) meta.age = input.age ?? null;
  if (input.role !== undefined) meta.role = input.role || null;
  if (input.jerseyNumber !== undefined) meta.jerseyNumber = input.jerseyNumber || null;
  if (input.jerseySize !== undefined) meta.jerseySize = input.jerseySize || null;
  if (input.achievements !== undefined) meta.achievements = input.achievements || null;
  return meta;
}

async function normalizeWalkInPlayerInput(
  tournamentId: number,
  input: z.infer<typeof walkInPlayerBodySchema>,
  existing?: typeof badmintonPlayersTable.$inferSelect,
) {
  const names = input.name?.trim()
    ? splitWalkInName(input.name)
    : { firstName: input.firstName!.trim(), lastName: input.lastName!.trim() };

  const shortName =
    input.shortName?.trim() ||
    (await allocateTournamentInitials(tournamentId, {
      firstName: names.firstName,
      lastName: names.lastName,
    }));

  const metaJson = buildWalkInMetaJson(input, existing?.metaJson as Record<string, unknown> | null);

  return {
    firstName: names.firstName,
    lastName: names.lastName,
    shortName,
    photoUrl: input.photoUrl,
    mobile: input.mobile,
    email: input.email,
    gender: input.gender === "M" || input.gender === "F" ? input.gender : null,
    handedness: input.handedness,
    academyName: input.city || null,
    metaJson,
  };
}

/** Write — requires tournament owner. */
router.post("/players", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;

  const parsed = walkInPlayerBodySchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const values = await normalizeWalkInPlayerInput(tournamentId, parsed.data);

  const [player] = await db
    .insert(badmintonPlayersTable)
    .values({ tournamentId, ...values, status: "active" })
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
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const playerId = parseId((req.params as MergedParams).playerId);
  if (!playerId) return void res.status(400).json({ error: "bad id" });

  const parsed = walkInPlayerBodySchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const [existing] = await db
    .select()
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.id, playerId),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!existing) return void res.status(404).json({ error: "player not found" });

  const values = await normalizeWalkInPlayerInput(tournamentId, parsed.data, existing);

  const [player] = await db
    .update(badmintonPlayersTable)
    .set({ ...values, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonPlayersTable.id, playerId),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  res.json(player);
});

router.delete("/players/:playerId", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const playerId = parseId((req.params as MergedParams).playerId);
  if (!playerId) return void res.status(400).json({ error: "bad id" });

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
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;

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
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const courtId = parseId((req.params as MergedParams).courtId);
  if (!courtId) return void res.status(400).json({ error: "bad id" });

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
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const courtId = parseId((req.params as MergedParams).courtId);
  if (!courtId) return void res.status(400).json({ error: "bad id" });

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
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;

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
    matchFormatJson: z
      .object({
        totalGames: z.number(),
        pointsPerGame: z.number(),
        deuceAt: z.number(),
        maxPoints: z.number(),
        midGameSideChange: z.boolean(),
      })
      .optional(),
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
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const catId = parseId((req.params as MergedParams).catId);
  if (!catId) return void res.status(400).json({ error: "bad id" });

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

/**
 * Registration read — joins players scoped to the same tournament so
 * players from another tournament can never leak into this response.
 */
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
      and(
        eq(badmintonPlayersTable.id, badmintonRegistrationsTable.player1Id),
        eq(badmintonPlayersTable.tournamentId, tournamentId), // player must belong to same tenant
      ),
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

/**
 * Registration write — validates that player1Id (and optional player2Id)
 * belong to this tournament before creating the registration.
 */
router.post("/categories/:catId/registrations", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const catId = parseId((req.params as MergedParams).catId);
  if (!catId) return void res.status(400).json({ error: "bad id" });

  const schema = z.object({
    player1Id: z.number().int(),
    player2Id: z.number().int().optional(),
    seedNumber: z.number().int().min(1).max(32).optional(),
    status: z.enum(["pending", "accepted", "withdrawn"]).default("accepted"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  // Validate player1 belongs to this tournament.
  const [p1] = await db
    .select({ id: badmintonPlayersTable.id })
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.id, parsed.data.player1Id),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!p1) return void res.status(400).json({ error: "player1Id not found in this tournament" });

  // Validate player2 belongs to this tournament (doubles only).
  if (parsed.data.player2Id) {
    const [p2] = await db
      .select({ id: badmintonPlayersTable.id })
      .from(badmintonPlayersTable)
      .where(
        and(
          eq(badmintonPlayersTable.id, parsed.data.player2Id),
          eq(badmintonPlayersTable.tournamentId, tournamentId),
        ),
      )
      .limit(1);

    if (!p2) return void res.status(400).json({ error: "player2Id not found in this tournament" });
  }

  // Validate category belongs to this tournament.
  const [cat] = await db
    .select({ id: badmintonCategoriesTable.id })
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, catId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!cat) return void res.status(404).json({ error: "category not found in this tournament" });

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

  const categoryId = req.query.categoryId
    ? parseId(req.query.categoryId as string)
    : null;

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

/** Generate a knockout draw for a category. */
router.post("/categories/:catId/generate-draw", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const catId = parseId((req.params as MergedParams).catId);
  if (!catId) return void res.status(400).json({ error: "bad id" });

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

  // Fix: include tournamentId in the WHERE to prevent cross-tenant category mutation.
  await db
    .update(badmintonCategoriesTable)
    .set({ phase: "live", updatedAt: new Date() })
    .where(
      and(
        eq(badmintonCategoriesTable.id, catId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    );

  res.status(201).json({ draw, fixtures: insertedFixtures });
});

// ─── Matches ──────────────────────────────────────────────────────────────────

router.get("/matches", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const includeScorerPin = isTournamentOwner(req, tournamentId);
  const matches = await getLiveBadmintonMatches(tournamentId);
  res.json(
    matches.map(({ detail, ...rest }) => ({
      ...rest,
      detail: serializeBadmintonMatchDetail(detail, { includeScorerPin }),
    })),
  );
});

router.post("/matches", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;

  const schema = z.object({
    categoryId: z.number().int().optional(),
    fixtureId: z.number().int().optional(),
    courtId: z.number().int().optional(),
    courtNumber: z.string().max(20).optional(),
    matchNumber: z.string().max(20).optional(),
    matchLabel: z.string().max(200).optional(),
    roundName: z.string().max(100).optional(),
    matchType: z.enum(["singles", "doubles", "mixed_doubles"]).default("singles"),
    matchFormatJson: z
      .object({
        totalGames: z.number(),
        pointsPerGame: z.number(),
        deuceAt: z.number(),
        maxPoints: z.number(),
        midGameSideChange: z.boolean(),
      })
      .optional(),
    leftSideJson: z.record(z.unknown()),
    rightSideJson: z.record(z.unknown()),
    scorerPin: z.string().max(20).optional(),
    scorerName: z.string().max(100).optional(),
    umpireName: z.string().max(100).optional(),
    scheduledAt: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  // If fixtureId supplied, verify it belongs to this tournament.
  if (parsed.data.fixtureId) {
    const [fix] = await db
      .select({ id: badmintonFixturesTable.id })
      .from(badmintonFixturesTable)
      .where(
        and(
          eq(badmintonFixturesTable.id, parsed.data.fixtureId),
          eq(badmintonFixturesTable.tournamentId, tournamentId),
        ),
      )
      .limit(1);

    if (!fix) return void res.status(400).json({ error: "fixtureId not found in this tournament" });
  }

  const created = await createBadmintonMatch({
    tournamentId,
    ...parsed.data,
    scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
  });

  broadcastTournamentUpdate(tournamentId, { type: "match_created", matchId: created.match.id });
  res.status(201).json({
    ...created.match,
    detail: serializeBadmintonMatchDetail(created.detail, { includeScorerPin: true }),
  });
});

/**
 * Get a single match's current state.
 *
 * Scoped: both replayMatch AND the detail query include tournamentId.
 * A matchId from a different tournament returns 404, not its data.
 */
router.get("/matches/:matchId", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  // replayMatch now verifies match.tournamentId === tournamentId internally.
  const state = await replayMatch(matchId, tournamentId);
  if (!state) return void res.status(404).json({ error: "match not found" });

  const [detail] = await db
    .select()
    .from(badmintonMatchDetailsTable)
    .where(
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, matchId),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId), // tenant guard
      ),
    )
    .limit(1);

  res.json({
    state,
    detail: serializeBadmintonMatchDetail(detail ?? null, {
      includeScorerPin: isTournamentOwner(req, tournamentId),
    }),
  });
});

router.post("/matches/:matchId/verify-pin", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  const schema = z.object({ pin: z.string().min(4).max(20) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const ok = await verifyMatchScorerPin(tournamentId, matchId, parsed.data.pin);
  res.json({ ok });
});

router.patch("/matches/:matchId", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;

  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const schema = z.object({
    matchType: z.enum(["singles", "doubles", "mixed_doubles"]).optional(),
    courtId: z.number().int().nullable().optional(),
    courtNumber: z.string().max(20).nullable().optional(),
    matchLabel: z.string().max(200).nullable().optional(),
    roundName: z.string().max(100).nullable().optional(),
    leftSideJson: z.record(z.unknown()).optional(),
    rightSideJson: z.record(z.unknown()).optional(),
    scorerPin: z.string().max(20).optional(),
    umpireName: z.string().max(100).nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const updated = await updateBadmintonMatch(matchId, tournamentId, parsed.data);
    broadcastTournamentUpdate(tournamentId, { type: "match_updated", matchId });
    res.json({
      ...updated,
      detail: serializeBadmintonMatchDetail(updated.detail, { includeScorerPin: true }),
    });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.delete("/matches/:matchId", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;

  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  try {
    await deleteBadmintonMatch(matchId, tournamentId);
    broadcastTournamentUpdate(tournamentId, { type: "match_deleted", matchId });
    res.status(204).send();
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

// ─── Scoring actions ──────────────────────────────────────────────────────────

router.post("/matches/:matchId/start", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonScoring(req, res, matchId);
  if (!auth) return;
  const { tournamentId, usedPin } = auth;

  const schema = z.object({
    matchKind: z.enum(["singles", "doubles", "mixed_doubles"]),
    format: z
      .object({
        totalGames: z.number(),
        pointsPerGame: z.number(),
        deuceAt: z.number(),
        maxPoints: z.number(),
        midGameSideChange: z.boolean(),
      })
      .optional(),
    leftSide: z.object({
      label: z.string(),
      shortLabel: z.string(),
      countryCode: z.string().optional(),
      countryName: z.string().optional(),
      photoUrl: z.string().optional(),
      flagUrl: z.string().optional(),
      teamColor: z.string().optional(),
      teamName: z.string().optional(),
      teamLogoUrl: z.string().optional(),
      sponsorName: z.string().optional(),
      sponsorLogoUrl: z.string().optional(),
      masterPlayerId: z.string().optional(),
      playerIds: z.array(z.number()),
      players: z.array(z.object({
        label: z.string(),
        shortLabel: z.string(),
        countryCode: z.string().optional(),
        countryName: z.string().optional(),
        photoUrl: z.string().optional(),
        flagUrl: z.string().optional(),
        teamColor: z.string().optional(),
        teamName: z.string().optional(),
        teamLogoUrl: z.string().optional(),
        sponsorName: z.string().optional(),
        sponsorLogoUrl: z.string().optional(),
        masterPlayerId: z.string().optional(),
      })).optional(),
    }),
    rightSide: z.object({
      label: z.string(),
      shortLabel: z.string(),
      countryCode: z.string().optional(),
      countryName: z.string().optional(),
      photoUrl: z.string().optional(),
      flagUrl: z.string().optional(),
      teamColor: z.string().optional(),
      teamName: z.string().optional(),
      teamLogoUrl: z.string().optional(),
      sponsorName: z.string().optional(),
      sponsorLogoUrl: z.string().optional(),
      masterPlayerId: z.string().optional(),
      playerIds: z.array(z.number()),
      players: z.array(z.object({
        label: z.string(),
        shortLabel: z.string(),
        countryCode: z.string().optional(),
        countryName: z.string().optional(),
        photoUrl: z.string().optional(),
        flagUrl: z.string().optional(),
        teamColor: z.string().optional(),
        teamName: z.string().optional(),
        teamLogoUrl: z.string().optional(),
        sponsorName: z.string().optional(),
        sponsorLogoUrl: z.string().optional(),
        masterPlayerId: z.string().optional(),
      })).optional(),
    }),
    firstServer: z.enum(["left", "right"]),
    doublesSetup: z
      .object({
        tossWinnerSide: z.enum(["left", "right"]),
        tossDecision: z.enum(["serve", "receive"]),
        firstServingSide: z.enum(["left", "right"]),
        firstServerPlayerIndex: z.union([z.literal(0), z.literal(1)]),
        firstReceivingSide: z.enum(["left", "right"]),
        firstReceiverPlayerIndex: z.union([z.literal(0), z.literal(1)]),
      })
      .optional(),
    courtNumber: z.string().optional(),
    matchLabel: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const isPairKind =
    parsed.data.matchKind === "doubles" || parsed.data.matchKind === "mixed_doubles";
  if (isPairKind && !parsed.data.doublesSetup) {
    return void res.status(400).json({
      error: "Doubles matches require doublesSetup (toss, server, receiver)",
    });
  }

  try {
    const state = await startBadmintonMatch(
      matchId,
      tournamentId,
      {
        ...parsed.data,
        format: parsed.data.format ?? STANDARD_FORMAT,
      } as BadmintonMatchStartedPayload,
      actorFrom(req, usedPin),
    );

    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/point", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonScoring(req, res, matchId);
  if (!auth) return;
  const { tournamentId, usedPin } = auth;

  const schema = z.object({
    side: z.enum(["left", "right"]),
    rallyLength: z.number().int().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await awardPoint(
      matchId,
      tournamentId,
      parsed.data.side,
      actorFrom(req, usedPin),
      { rallyLength: parsed.data.rallyLength },
    );

    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/undo", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonScoring(req, res, matchId);
  if (!auth) return;
  const { tournamentId, usedPin } = auth;

  try {
    const state = await undoLastPoint(matchId, tournamentId, actorFrom(req, usedPin));
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/timeout", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonScoring(req, res, matchId);
  if (!auth) return;
  const { tournamentId, usedPin } = auth;

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
      tournamentId,
      parsed.data.action,
      parsed.data.side ?? null,
      parsed.data.kind,
      actorFrom(req, usedPin),
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/interval", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonScoring(req, res, matchId);
  if (!auth) return;
  const { tournamentId, usedPin } = auth;

  const schema = z.object({
    action: z.enum(["start", "end"]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleInterval(
      matchId,
      tournamentId,
      parsed.data.action,
      actorFrom(req, usedPin),
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/court-change", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonScoring(req, res, matchId);
  if (!auth) return;
  const { tournamentId, usedPin } = auth;

  try {
    const state = await handleCourtChangeAck(matchId, tournamentId, actorFrom(req, usedPin));
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/retirement", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonDirector(req, res, matchId);
  if (!auth) return;
  const { tournamentId } = auth;

  const schema = z.object({
    retiringSide: z.enum(["left", "right"]),
    reason: z.enum(["injury", "illness", "other"]).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleRetirement(
      matchId,
      tournamentId,
      parsed.data.retiringSide,
      actorFrom(req, false),
      parsed.data.reason,
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/walkover", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonDirector(req, res, matchId);
  if (!auth) return;
  const { tournamentId } = auth;

  const schema = z.object({
    winningSide: z.enum(["left", "right"]),
    reason: z.enum(["opponent_absent", "forfeit", "administrative_decision"]).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleWalkover(
      matchId,
      tournamentId,
      parsed.data.winningSide,
      actorFrom(req, false),
      parsed.data.reason,
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/disqualification", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonDirector(req, res, matchId);
  if (!auth) return;
  const { tournamentId } = auth;

  const schema = z.object({
    disqualifiedSide: z.enum(["left", "right"]),
    reason: z.string().min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleDisqualification(
      matchId,
      tournamentId,
      parsed.data.disqualifiedSide,
      parsed.data.reason,
      actorFrom(req, false),
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/pause", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonDirector(req, res, matchId);
  if (!auth) return;
  const { tournamentId } = auth;

  const schema = z.object({
    reason: z.enum(["medical", "technical_issue", "weather", "court_issue", "other"]),
    detail: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handlePauseMatch(
      matchId,
      tournamentId,
      parsed.data.reason,
      actorFrom(req, false),
      parsed.data.detail,
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/resume", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonDirector(req, res, matchId);
  if (!auth) return;
  const { tournamentId } = auth;

  try {
    const state = await handleResumeMatch(matchId, tournamentId, actorFrom(req, false));
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/note", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonDirector(req, res, matchId);
  if (!auth) return;
  const { tournamentId } = auth;

  const schema = z.object({ text: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleAddMatchNote(
      matchId,
      tournamentId,
      parsed.data.text,
      actorFrom(req, false),
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.post("/matches/:matchId/force-end", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonDirector(req, res, matchId);
  if (!auth) return;
  const { tournamentId } = auth;

  const schema = z.object({ reason: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const state = await handleForceEndMatch(
      matchId,
      tournamentId,
      parsed.data.reason,
      actorFrom(req, false),
    );
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.get("/matches/:matchId/incidents", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  if (!isTournamentDirector(req, tournamentId)) {
    return void res.status(403).json({ error: "forbidden" });
  }

  try {
    const incidents = await getMatchIncidentLog(matchId, tournamentId);
    res.json({ incidents });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

router.get("/matches/:matchId/report", async (req, res) => {
  const tournamentId = tid(req);
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!tournamentId || !matchId) return void res.status(400).json({ error: "bad id" });

  if (!isTournamentDirector(req, tournamentId)) {
    return void res.status(403).json({ error: "forbidden" });
  }

  const format = req.query.format === "pdf" ? "pdf" : "json";

  try {
    const report = await getMatchReportData(matchId, tournamentId);
    if (format === "pdf") {
      const pdf = await generateMatchReportPdf(report);
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="match-${matchId}-report.pdf"`,
      );
      return void res.send(pdf);
    }
    res.json(report);
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

// ─── Dashboard ────────────────────────────────────────────────────────────────

router.get("/dashboard", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const [totalPlayers, totalCourts, totalCategories, matchStats] = await Promise.all([
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
      .select({ status: scoringMatchesTable.status, count: count() })
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
  for (const row of matchStats) matchStatMap[row.status] = Number(row.count);

  const liveMatches = await db
    .select({ match: scoringMatchesTable, detail: badmintonMatchDetailsTable })
    .from(scoringMatchesTable)
    .leftJoin(
      badmintonMatchDetailsTable,
      and(
        eq(badmintonMatchDetailsTable.scoringMatchId, scoringMatchesTable.id),
        eq(badmintonMatchDetailsTable.tournamentId, tournamentId),
      ),
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
    liveMatches: liveMatches.map(
      ({ match, detail }: { match: typeof scoringMatchesTable.$inferSelect; detail: typeof badmintonMatchDetailsTable.$inferSelect | null }) => ({
        ...match,
        detail: detail ?? null,
        state: detail?.stateSnapshotJson ?? null,
      }),
    ),
  });
});

// ─── Draw generator ───────────────────────────────────────────────────────────

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
  const seeds = registrations
    .filter((r) => r.seedNumber !== null)
    .sort((a, b) => (a.seedNumber ?? 99) - (b.seedNumber ?? 99));
  const unseeded = registrations
    .filter((r) => r.seedNumber === null)
    .sort(() => Math.random() - 0.5);

  const ordered = [...seeds, ...unseeded];
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(ordered.length)));
  const slots: Array<number | null> = ordered
    .map((r) => r.id)
    .concat(Array(bracketSize - ordered.length).fill(null));

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
