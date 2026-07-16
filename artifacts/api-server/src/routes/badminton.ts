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
 *   3. Organizer account that owns the tournament (organizerAccountId ===
 *      tournament.organizerId) — same rules as branding/settings
 *   4. Scorer JWT (Bearer) + active match lock (scoring actions only)
 *
 * Court/match scorer PIN auth is soft-deprecated and no longer accepted.
 *
 * Cross-tenant writes are still blocked: ownership is always checked against
 * THIS tournament’s organizerId (or explicit JWT organizer[tid] grant).
 * Service layer additionally re-verifies match.tournamentId === URL tournamentId
 * on every scoring action, making IDOR impossible even if a caller somehow
 * bypasses the route-layer checks.
 */

import { Router, type Request } from "express";
import { z } from "zod";
import { eq, and, asc, count, inArray, isNotNull, ne } from "drizzle-orm";
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
import {
  BadmintonServiceError,
  awardPoint,
  createBadmintonMatch,
  updateBadmintonMatch,
  deleteBadmintonMatch,
  ensureBadmintonTournament,
  getLiveBadmintonMatches,
  openScorerHomeForTournament,
  serializeBadmintonMatchDetail,
  serializeBadmintonCourt,
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
  resolveFormatForMatchStart,
} from "../lib/badminton-service";
import { auditLog } from "../lib/audit-service";
import {
  friendlyBadmintonCommandMessage,
} from "../lib/badminton-ops";
import {
  extractBearerToken,
  resolveScorerAuthFromToken,
  ScorerAuthError,
  type ScorerAuthContext,
} from "../lib/scorer-auth";
import {
  assertSessionOwnsMatchLock,
  forceUnlockMatch,
  releaseLockOnMatchFinish,
  ScorerLockError,
} from "../lib/scorer-match-locks";
import { writeScorerAudit } from "../lib/scorer-audit";
import {
  createFixtureCollection,
  importFixtureCollectionStub,
} from "../lib/fixture-collection-writer";
import {
  canCreateMatchFromFixture,
  FixtureSchedulingError,
  scheduleFixture,
  unscheduleFixture,
} from "../lib/fixture-scheduling";
import { allocateTournamentInitials } from "../lib/master-sports/tournament-initials";
import {
  buildSideJsonFromBadmintonPlayer,
  listBadmintonPlayersForMatchRoster,
  listBadmintonPlayersForOrganizer,
} from "../lib/master-sports/badminton";
import {
  validateBadmintonCategoryEntry,
  validateBadmintonRegistrationReinstate,
} from "../lib/badminton-registration-validation";
import {
  addBadmintonSseClient,
  createBadmintonSseClient,
  removeBadmintonSseClient,
  broadcastBadmintonMatchUpdate,
  broadcastTournamentUpdate,
} from "../lib/badminton-broadcast";
import type { BadmintonMatchStartedPayload } from "@workspace/badminton-core";
import { scoringFeatureMiddleware } from "../lib/scoring-feature";
import { generateMatchReportPdf } from "../lib/badminton-match-report";
import { commitBatchCloudinaryImageWrites } from "../lib/cloudinary-media-service";
import {
  queueImageFieldChange,
  type ImageFieldChange,
} from "../lib/cloudinary-image-fields";
import {
  isTournamentOrganizer,
  requireTournamentOrganizer,
} from "../middleware/require-organizer";

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

type ScoringActorContext =
  | { kind: "organizer_or_admin"; usedScorer: false }
  | { kind: "scorer"; usedScorer: true; scorer: ScorerAuthContext };

function actorFrom(req: Request, auth: ScoringActorContext) {
  if (req.jwtUser?.isAdmin) return { type: "admin", id: "admin" };
  if (auth.usedScorer) {
    return { type: "scorer", id: String(auth.scorer.scorerId) };
  }
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

function auditActorFrom(req: Request, auth: ScoringActorContext): {
  actorType: "scorer" | "organizer" | "admin";
  actorId: string;
  scorerId?: number | null;
  sessionId?: string | null;
} {
  if (req.jwtUser?.isAdmin) {
    return { actorType: "admin", actorId: "admin" };
  }
  if (auth.usedScorer) {
    return {
      actorType: "scorer",
      actorId: String(auth.scorer.scorerId),
      scorerId: auth.scorer.scorerId,
      sessionId: auth.scorer.sessionId,
    };
  }
  return {
    actorType: "organizer",
    actorId: req.jwtUser?.organizerAccountId?.toString() ?? "organizer",
  };
}

async function maybeReleaseLockAfterTerminal(
  matchId: number,
  tournamentId: number,
  state: { matchStatus?: string } | null | undefined,
): Promise<void> {
  const status = state?.matchStatus;
  if (
    status === "completed" ||
    status === "walkover" ||
    status === "retired" ||
    status === "disqualified" ||
    status === "abandoned"
  ) {
    await releaseLockOnMatchFinish({
      matchId,
      tournamentId,
      sport: "badminton",
    });
    await writeScorerAudit({
      actorType: "system",
      actorId: "system",
      tournamentId,
      matchId,
      sport: "badminton",
      action: "match_finished",
      payload: { matchStatus: status },
    });
  }
}

// ── Authorization ─────────────────────────────────────────────────────────────

/**
 * Tournament-specific auth for badminton writes / scorer-PIN visibility.
 *
 * Grants access when the caller is:
 *  1. An admin, OR
 *  2. Explicitly listed as organizer for THIS tournament in their JWT
 *     (organizer[tournamentId] === true), OR
 *  3. Organizer account that owns the tournament (organizerAccountId ===
 *     tournament.organizerId) — when organizerId is provided.
 *
 * Pass tournamentOrganizerId from DB for account-ownership checks.
 * Without it, only JWT organizer[tid] / admin pass (sync call sites).
 */
function isTournamentOwner(
  req: Request,
  tournamentId: number,
  tournamentOrganizerId?: number | null,
): boolean {
  if (tournamentOrganizerId !== undefined) {
    return isTournamentOrganizer(req, tournamentId, tournamentOrganizerId);
  }
  const u = req.jwtUser;
  if (!u) return false;
  if (u.isAdmin) return true;
  const status = req.organizerAccountLicenseStatus;
  if (status === "suspended") return false;
  return !!(u.organizer?.[String(tournamentId)]);
}

/**
 * Tournament Director / Admin match administration.
 * Scorer PIN is explicitly excluded — director actions are not scorer tablet actions.
 * Account owners of the tournament count as directors when organizerId is passed.
 */
function isTournamentDirector(
  req: Request,
  tournamentId: number,
  tournamentOrganizerId?: number | null,
): boolean {
  if (isTournamentOwner(req, tournamentId, tournamentOrganizerId)) return true;
  const u = req.jwtUser;
  if (!u) return false;
  const status = req.organizerAccountLicenseStatus;
  if (status === "suspended") return false;
  return !!(u.tournamentDirector?.[String(tournamentId)]);
}

/** Load tournament.organizerId and evaluate owner access (JWT grant or account ownership). */
async function resolveIsTournamentOwner(
  req: Request,
  tournamentId: number,
): Promise<boolean> {
  const [tournament] = await db
    .select({ organizerId: tournamentsTable.organizerId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  return isTournamentOwner(req, tournamentId, tournament?.organizerId ?? null);
}

async function resolveIsTournamentDirector(
  req: Request,
  tournamentId: number,
): Promise<boolean> {
  const [tournament] = await db
    .select({ organizerId: tournamentsTable.organizerId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  return isTournamentDirector(req, tournamentId, tournament?.organizerId ?? null);
}

async function guardBadmintonDirector(
  req: Request,
  res: import("express").Response,
  _matchId: number,
): Promise<{ tournamentId: number } | null> {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "bad id" });
    return null;
  }
  if (!(await guardBadmintonTournament(tournamentId, res))) return null;
  if (!(await resolveIsTournamentDirector(req, tournamentId))) {
    res.status(403).json({
      error: "Tournament director or organizer access required. Scorer PIN cannot do this.",
      code: "DIRECTOR_FORBIDDEN",
    });
    return null;
  }
  return { tournamentId };
}

function respondBadmintonServiceError(
  res: import("express").Response,
  err: unknown,
): boolean {
  if (err instanceof BadmintonServiceError) {
    res.status(err.status).json({
      error: friendlyBadmintonCommandMessage(err.message),
      code: err.code,
    });
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
  // Same ownership rules as branding/settings (account owner OR JWT organizer[tid]).
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return null;
  return tournamentId;
}

/** Scoring write guard: badminton sport + organizer/admin OR scorer JWT + lock. */
async function guardBadmintonScoring(
  req: Request,
  res: import("express").Response,
  matchId: number,
): Promise<{ tournamentId: number; auth: ScoringActorContext } | null> {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "bad id" });
    return null;
  }
  if (!(await guardBadmintonTournament(tournamentId, res))) return null;

  const auth = await canWriteScoring(req, tournamentId, matchId);
  if (!auth.ok) {
    if (auth.code === "MATCH_LOCKED") {
      res.status(409).json({
        code: "MATCH_LOCKED",
        message: "This match is currently being scored by another active session.",
        error: "This match is currently being scored by another active session.",
      });
      return null;
    }
    res.status(auth.status).json({
      error: auth.error,
      code: auth.code,
    });
    return null;
  }
  return { tournamentId, auth: auth.ctx };
}

/**
 * Check write permission for a scoring action.
 *
 * Priority:
 *  1. Tournament owner / admin → allowed (bypasses lock; still audited by caller)
 *  2. Scorer JWT + active session + account + lock ownership
 */
async function canWriteScoring(
  req: Request,
  tournamentId: number,
  matchId: number,
): Promise<
  | { ok: true; ctx: ScoringActorContext }
  | { ok: false; status: number; code: string; error: string }
> {
  if (await resolveIsTournamentOwner(req, tournamentId)) {
    return { ok: true, ctx: { kind: "organizer_or_admin", usedScorer: false } };
  }

  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: "AUTH_REQUIRED",
      error: "Scorer login required",
    };
  }

  try {
    const scorer = await resolveScorerAuthFromToken(token);
    await assertSessionOwnsMatchLock({ matchId, sessionId: scorer.sessionId });
    return { ok: true, ctx: { kind: "scorer", usedScorer: true, scorer } };
  } catch (e) {
    if (e instanceof ScorerAuthError) {
      return { ok: false, status: e.status, code: e.code, error: e.message };
    }
    if (e instanceof ScorerLockError) {
      return {
        ok: false,
        status: e.status,
        code: e.code,
        error: e.message,
      };
    }
    return {
      ok: false,
      status: 403,
      code: "SCORING_FORBIDDEN",
      error: "Scoring not allowed",
    };
  }
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

  const client = createBadmintonSseClient({ res, matchId: matchId ?? 0, tournamentId });
  addBadmintonSseClient(client);

  const cleanup = () => {
    clearInterval(heartbeat);
    removeBadmintonSseClient(client);
    req.off("close", cleanup);
    res.off("close", cleanup);
  };

  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      cleanup();
    }
  }, 25000);

  req.on("close", cleanup);
  res.on("close", cleanup);
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
    photoPublicId: z.string().max(500).optional().nullable(),
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
    photoPublicId: input.photoPublicId,
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
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  const imageChanges: ImageFieldChange[] = [];

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && key !== "photoUrl" && key !== "photoPublicId") {
      updates[key] = value;
    }
  }

  if (parsed.data.photoUrl !== undefined || parsed.data.photoPublicId !== undefined) {
    queueImageFieldChange(imageChanges, updates, {
      label: "photoUrl",
      urlKey: "photoUrl",
      publicIdKey: "photoPublicId",
      existing: { url: existing.photoUrl, publicId: existing.photoPublicId },
      nextUrl: parsed.data.photoUrl !== undefined ? (parsed.data.photoUrl || null) : undefined,
      nextPublicId: parsed.data.photoPublicId,
    });
  }

  let player!: typeof badmintonPlayersTable.$inferSelect;
  const persistPlayerUpdate = async () => {
    const [updated] = await db
      .update(badmintonPlayersTable)
      .set(updates)
      .where(
        and(
          eq(badmintonPlayersTable.id, playerId),
          eq(badmintonPlayersTable.tournamentId, tournamentId),
        ),
      )
      .returning();
    if (!updated) throw new Error("PLAYER_NOT_FOUND");
    player = updated;
  };

  if (imageChanges.length > 0) {
    await commitBatchCloudinaryImageWrites({
      changes: imageChanges,
      persist: persistPlayerUpdate,
      logger: req.log,
      context: { route: "badminton.patchPlayer", tournamentId, playerId },
    });
  } else {
    await persistPlayerUpdate();
  }

  res.json(player);
});

router.delete("/players/:playerId", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const playerId = parseId((req.params as MergedParams).playerId);
  if (!playerId) return void res.status(400).json({ error: "bad id" });

  // Soft-delete so Import From Auction can re-list / reinstate via masterPlayerId.
  const [updated] = await db
    .update(badmintonPlayersTable)
    .set({ status: "withdrawn" })
    .where(
      and(
        eq(badmintonPlayersTable.id, playerId),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .returning({ id: badmintonPlayersTable.id });

  if (!updated) return void res.status(404).json({ error: "Player not found" });

  res.json({ deleted: true });
});

// ─── Courts ──────────────────────────────────────────────────────────────────

router.get("/courts", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const includeScorerPin = await resolveIsTournamentOwner(req, tournamentId);
  const courts = await db
    .select()
    .from(badmintonCourtsTable)
    .where(eq(badmintonCourtsTable.tournamentId, tournamentId))
    .orderBy(asc(badmintonCourtsTable.sortOrder), asc(badmintonCourtsTable.name));

  res.json(
    courts.map((court) =>
      serializeBadmintonCourt(court as unknown as Record<string, unknown>, { includeScorerPin }),
    ),
  );
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
    scorerPin: z.string().max(20).optional(),
    scorerName: z.string().max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const scorerPin =
    parsed.data.scorerPin !== undefined
      ? parsed.data.scorerPin.trim().length >= 4
        ? parsed.data.scorerPin.trim()
        : null
      : null;
  if (parsed.data.scorerPin !== undefined && parsed.data.scorerPin.trim().length > 0 && !scorerPin) {
    return void res.status(400).json({ error: "Scorer PIN must be at least 4 digits" });
  }

  const [court] = await db
    .insert(badmintonCourtsTable)
    .values({
      tournamentId,
      name: parsed.data.name,
      shortName: parsed.data.shortName,
      location: parsed.data.location,
      sortOrder: parsed.data.sortOrder,
      streamUrl: parsed.data.streamUrl,
      hasDisplay: parsed.data.hasDisplay,
      scorerPin,
      scorerName: parsed.data.scorerName?.trim() || null,
    })
    .returning();

  res.status(201).json(
    serializeBadmintonCourt(court as unknown as Record<string, unknown>, { includeScorerPin: true }),
  );
});

router.patch("/courts/:courtId", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const courtId = parseId((req.params as MergedParams).courtId);
  if (!courtId) return void res.status(400).json({ error: "bad id" });

  const schema = z.object({
    name: z.string().min(1).max(100).optional(),
    shortName: z.string().max(10).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    sortOrder: z.number().int().optional(),
    streamUrl: z.string().max(500).nullable().optional(),
    hasDisplay: z.boolean().optional(),
    status: z.string().max(40).optional(),
    scorerPin: z.string().max(20).nullable().optional(),
    scorerName: z.string().max(100).nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.shortName !== undefined) patch.shortName = parsed.data.shortName;
  if (parsed.data.location !== undefined) patch.location = parsed.data.location;
  if (parsed.data.sortOrder !== undefined) patch.sortOrder = parsed.data.sortOrder;
  if (parsed.data.streamUrl !== undefined) patch.streamUrl = parsed.data.streamUrl;
  if (parsed.data.hasDisplay !== undefined) patch.hasDisplay = parsed.data.hasDisplay;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.scorerName !== undefined) {
    patch.scorerName = parsed.data.scorerName?.trim() || null;
  }
  if (parsed.data.scorerPin !== undefined) {
    const raw = parsed.data.scorerPin?.trim() ?? "";
    if (raw.length > 0 && raw.length < 4) {
      return void res.status(400).json({ error: "Scorer PIN must be at least 4 digits" });
    }
    patch.scorerPin = raw.length >= 4 ? raw : null;
  }

  const [court] = await db
    .update(badmintonCourtsTable)
    .set(patch)
    .where(
      and(
        eq(badmintonCourtsTable.id, courtId),
        eq(badmintonCourtsTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  if (!court) return void res.status(404).json({ error: "court not found" });
  broadcastTournamentUpdate(tournamentId, { type: "court_updated", courtId });
  res.json(
    serializeBadmintonCourt(court as unknown as Record<string, unknown>, { includeScorerPin: true }),
  );
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

  const schema = z.object({
    name: z.string().min(1).max(200).optional(),
    code: z.string().max(20).nullable().optional(),
    matchType: z.enum(["singles", "doubles", "mixed_doubles"]).optional(),
    ageGroup: z.string().max(20).nullable().optional(),
    gender: z.string().max(10).nullable().optional(),
    drawType: z.enum(["knockout", "round_robin", "group_knockout"]).optional(),
    numSeeds: z.number().int().min(0).max(32).optional(),
    maxPlayers: z.number().int().nullable().optional(),
    entryFee: z.number().int().nullable().optional(),
    colorCode: z.string().max(10).nullable().optional(),
    matchFormatJson: z
      .object({
        totalGames: z.number(),
        pointsPerGame: z.number(),
        deuceAt: z.number(),
        maxPoints: z.number(),
        midGameSideChange: z.boolean(),
      })
      .nullable()
      .optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const [cat] = await db
    .update(badmintonCategoriesTable)
    .set({ ...parsed.data, updatedAt: new Date() })
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

router.delete("/categories/:catId", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const catId = parseId((req.params as MergedParams).catId);
  if (!catId) return void res.status(400).json({ error: "bad id" });

  const [category] = await db
    .select({ id: badmintonCategoriesTable.id })
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, catId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!category) return void res.status(404).json({ error: "category not found" });

  const linkedFixtures = await db
    .select({ scoringMatchId: badmintonFixturesTable.scoringMatchId })
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.categoryId, catId),
        eq(badmintonFixturesTable.tournamentId, tournamentId),
        isNotNull(badmintonFixturesTable.scoringMatchId),
      ),
    );

  if (linkedFixtures.length > 0) {
    return void res.status(409).json({
      error:
        "This category has matches linked to its draw. Delete those matches from the Matches page first.",
    });
  }

  await db
    .delete(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, catId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
      ),
    );

  await db
    .delete(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.categoryId, catId),
        eq(badmintonFixturesTable.tournamentId, tournamentId),
      ),
    );

  await db
    .delete(badmintonDrawsTable)
    .where(
      and(
        eq(badmintonDrawsTable.categoryId, catId),
        eq(badmintonDrawsTable.tournamentId, tournamentId),
      ),
    );

  await db
    .delete(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, catId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    );

  broadcastTournamentUpdate(tournamentId, { type: "category_deleted", categoryId: catId });
  res.json({ deleted: true });
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
    .select()
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, catId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
      ),
    )
    .orderBy(asc(badmintonRegistrationsTable.seedNumber));

  const playerIds = new Set<number>();
  for (const reg of regs) {
    playerIds.add(reg.player1Id);
    if (reg.player2Id) playerIds.add(reg.player2Id);
  }

  const players =
    playerIds.size > 0
      ? await db
          .select()
          .from(badmintonPlayersTable)
          .where(
            and(
              eq(badmintonPlayersTable.tournamentId, tournamentId),
              inArray(badmintonPlayersTable.id, [...playerIds]),
            ),
          )
      : [];

  const playerById = new Map(players.map((p) => [p.id, p]));

  res.json(
    regs.map((registration) => ({
      registration,
      player1: playerById.get(registration.player1Id) ?? null,
      player2: registration.player2Id
        ? playerById.get(registration.player2Id) ?? null
        : null,
    })),
  );
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

  const [p1Row] = await db
    .select()
    .from(badmintonPlayersTable)
    .where(
      and(
        eq(badmintonPlayersTable.id, parsed.data.player1Id),
        eq(badmintonPlayersTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!p1Row) return void res.status(400).json({ error: "player1Id not found in this tournament" });

  let p2Row: typeof p1Row | null = null;
  if (parsed.data.player2Id) {
    const [row] = await db
      .select()
      .from(badmintonPlayersTable)
      .where(
        and(
          eq(badmintonPlayersTable.id, parsed.data.player2Id),
          eq(badmintonPlayersTable.tournamentId, tournamentId),
        ),
      )
      .limit(1);
    if (!row) return void res.status(400).json({ error: "player2Id not found in this tournament" });
    p2Row = row;
  }

  const [categoryRow] = await db
    .select()
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, catId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!categoryRow) return void res.status(404).json({ error: "category not found in this tournament" });

  const [{ acceptedCount }] = await db
    .select({ acceptedCount: count() })
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, catId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        eq(badmintonRegistrationsTable.status, "accepted"),
      ),
    );

  const entryValidation = validateBadmintonCategoryEntry(
    categoryRow,
    p1Row,
    p2Row,
    Number(acceptedCount),
  );
  if (!entryValidation.ok) {
    return void res.status(entryValidation.status).json({
      error: entryValidation.error,
      code: entryValidation.code,
    });
  }

  const existingRegs = await db
    .select({ id: badmintonRegistrationsTable.id, player1Id: badmintonRegistrationsTable.player1Id, player2Id: badmintonRegistrationsTable.player2Id })
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, catId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        inArray(badmintonRegistrationsTable.status, ["accepted", "pending", "withdrawn"]),
      ),
    );

  const playerIds = new Set([parsed.data.player1Id, parsed.data.player2Id].filter(Boolean) as number[]);
  for (const reg of existingRegs) {
    const regPlayers = [reg.player1Id, reg.player2Id].filter(Boolean) as number[];
    if (regPlayers.some((id) => playerIds.has(id))) {
      return void res.status(409).json({
        error: "One or more players are already registered in this category.",
        code: "DUPLICATE_CATEGORY_ENTRY",
      });
    }
  }

  const [reg] = await db
    .insert(badmintonRegistrationsTable)
    .values({ tournamentId, categoryId: catId, ...parsed.data })
    .returning();

  res.status(201).json(reg);
});

router.patch("/categories/:catId/registrations/:regId", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const catId = parseId((req.params as MergedParams).catId);
  const regId = parseId((req.params as MergedParams).regId);
  if (!catId || !regId) return void res.status(400).json({ error: "bad id" });

  const schema = z.object({
    status: z.enum(["pending", "accepted", "withdrawn", "disqualified"]).optional(),
    seedNumber: z.number().int().min(1).max(32).nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  const [existing] = await db
    .select()
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.id, regId),
        eq(badmintonRegistrationsTable.categoryId, catId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!existing) return void res.status(404).json({ error: "registration not found" });

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.seedNumber !== undefined) updates.seedNumber = parsed.data.seedNumber;

  if (Object.keys(updates).length === 0) {
    return void res.status(400).json({ error: "No fields to update" });
  }

  if (
    parsed.data.status === "accepted" &&
    existing.status === "withdrawn"
  ) {
    const [categoryRow] = await db
      .select()
      .from(badmintonCategoriesTable)
      .where(
        and(
          eq(badmintonCategoriesTable.id, catId),
          eq(badmintonCategoriesTable.tournamentId, tournamentId),
        ),
      )
      .limit(1);

    if (!categoryRow) return void res.status(404).json({ error: "category not found" });

    const playerIds = [existing.player1Id, existing.player2Id].filter(Boolean) as number[];
    const players =
      playerIds.length > 0
        ? await db
            .select()
            .from(badmintonPlayersTable)
            .where(
              and(
                eq(badmintonPlayersTable.tournamentId, tournamentId),
                inArray(badmintonPlayersTable.id, playerIds),
              ),
            )
        : [];

    const p1Row = players.find((p) => p.id === existing.player1Id);
    if (!p1Row) return void res.status(400).json({ error: "player1 not found in tournament" });

    const p2Row = existing.player2Id
      ? players.find((p) => p.id === existing.player2Id) ?? null
      : null;

    const [{ acceptedCount }] = await db
      .select({ acceptedCount: count() })
      .from(badmintonRegistrationsTable)
      .where(
        and(
          eq(badmintonRegistrationsTable.categoryId, catId),
          eq(badmintonRegistrationsTable.tournamentId, tournamentId),
          eq(badmintonRegistrationsTable.status, "accepted"),
        ),
      );

    const otherActiveRegs = await db
      .select({
        id: badmintonRegistrationsTable.id,
        player1Id: badmintonRegistrationsTable.player1Id,
        player2Id: badmintonRegistrationsTable.player2Id,
      })
      .from(badmintonRegistrationsTable)
      .where(
        and(
          eq(badmintonRegistrationsTable.categoryId, catId),
          eq(badmintonRegistrationsTable.tournamentId, tournamentId),
          inArray(badmintonRegistrationsTable.status, ["accepted", "pending"]),
          ne(badmintonRegistrationsTable.id, regId),
        ),
      );

    const conflictingIds: number[] = [];
    const regPlayerSet = new Set(playerIds);
    for (const reg of otherActiveRegs) {
      const ids = [reg.player1Id, reg.player2Id].filter(Boolean) as number[];
      if (ids.some((id) => regPlayerSet.has(id))) {
        conflictingIds.push(...ids.filter((id) => regPlayerSet.has(id)));
      }
    }

    const reinstateValidation = validateBadmintonRegistrationReinstate(
      categoryRow,
      p1Row,
      p2Row,
      Number(acceptedCount),
      conflictingIds,
    );
    if (!reinstateValidation.ok) {
      return void res.status(reinstateValidation.status).json({
        error: reinstateValidation.error,
        code: reinstateValidation.code,
      });
    }
  }

  const [updated] = await db
    .update(badmintonRegistrationsTable)
    .set(updates)
    .where(eq(badmintonRegistrationsTable.id, regId))
    .returning();

  res.json(updated);
});

// ─── Fixture Collections (badminton_draws) + Fixtures ─────────────────────────

/** List Fixture Collections (stored in badminton_draws). */
router.get("/fixture-collections", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const categoryId = req.query.categoryId
    ? parseId(req.query.categoryId as string)
    : null;

  const whereConditions = [eq(badmintonDrawsTable.tournamentId, tournamentId)];
  if (categoryId) {
    whereConditions.push(eq(badmintonDrawsTable.categoryId, categoryId));
  }

  const collections = await db
    .select()
    .from(badmintonDrawsTable)
    .where(and(...whereConditions))
    .orderBy(asc(badmintonDrawsTable.id));

  res.json(collections);
});

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

/**
 * Schedule a fixture — assign court + date/time.
 * Sets planning status to scheduled (or ready if match already linked).
 */
router.patch("/fixtures/:fixtureId/schedule", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const fixtureId = parseId((req.params as MergedParams).fixtureId);
  if (!fixtureId) return void res.status(400).json({ error: "bad id" });

  const schema = z.object({
    courtId: z.number().int().positive(),
    scheduledAt: z.string().min(1),
    allowCourtConflict: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const updated = await scheduleFixture({
      tournamentId,
      fixtureId,
      courtId: parsed.data.courtId,
      scheduledAt: new Date(parsed.data.scheduledAt),
      allowCourtConflict: parsed.data.allowCourtConflict === true,
    });
    auditLog(req, {
      category: "tournament",
      action: "badminton.fixture_scheduled",
      summary: `Fixture #${fixtureId} scheduled on court ${parsed.data.courtId}`,
      tournamentId,
      resource: { type: "badminton_fixture", id: fixtureId },
      metadata: {
        courtId: parsed.data.courtId,
        scheduledAt: parsed.data.scheduledAt,
        allowCourtConflict: parsed.data.allowCourtConflict === true,
      },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof FixtureSchedulingError) {
      return void res.status(err.status).json({ error: err.message, code: err.code });
    }
    throw err;
  }
});

/**
 * Unschedule a fixture — clear court + time → unscheduled.
 * Blocked if a match already exists.
 */
router.post("/fixtures/:fixtureId/unschedule", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const fixtureId = parseId((req.params as MergedParams).fixtureId);
  if (!fixtureId) return void res.status(400).json({ error: "bad id" });

  try {
    const updated = await unscheduleFixture(tournamentId, fixtureId);
    auditLog(req, {
      category: "tournament",
      action: "badminton.fixture_unscheduled",
      summary: `Fixture #${fixtureId} unscheduled`,
      tournamentId,
      resource: { type: "badminton_fixture", id: fixtureId },
    });
    res.json(updated);
  } catch (err) {
    if (err instanceof FixtureSchedulingError) {
      return void res.status(err.status).json({ error: err.message, code: err.code });
    }
    throw err;
  }
});

/**
 * Auto Generate adapter — wraps existing generate-draw for client compatibility.
 * Internally calls the shared Fixture Collection writer (kind: generated).
 * Does not create matches or start scoring.
 */
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

  const planned = generateKnockoutDraw(tournamentId, catId, registrations);

  const { collection, fixtures: insertedFixtures } = await createFixtureCollection({
    tournamentId,
    categoryId: catId,
    roundName: "Main Draw",
    drawKind: "generated",
    roundNumber: 1,
    totalRounds: Math.ceil(Math.log2(registrations.length)),
    status: "active",
    metaJson: {
      adapter: "auto_generate",
      algorithm: "knockout",
      // Legacy drawKind synonym for older clients / display
      legacyDrawKind: "knockout_round",
    },
    fixtures: planned.map((f) => ({
      slotNumber: f.slotNumber,
      registrationAId: f.registrationAId,
      registrationBId: f.registrationBId,
      status: f.status,
    })),
    markCategoryLive: true,
  });

  // Compatibility: existing clients expect `{ draw, fixtures }`
  res.status(201).json({
    draw: collection,
    collection,
    fixtures: insertedFixtures,
  });
});

/**
 * Manual Fixture adapter — organizer enters A vs B pairs.
 * Creates a Fixture Collection (kind: manual) via the shared writer.
 * Does not create matches or start scoring.
 */
router.post("/categories/:catId/fixture-collections/manual", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const catId = parseId((req.params as MergedParams).catId);
  if (!catId) return void res.status(400).json({ error: "bad id" });

  const schema = z.object({
    roundName: z.string().min(1).max(100).optional(),
    fixtures: z
      .array(
        z.object({
          registrationAId: z.number().int().nullable().optional(),
          registrationBId: z.number().int().nullable().optional(),
          slotNumber: z.number().int().positive().optional(),
        }),
      )
      .min(1),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

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

  const acceptedRegs = await db
    .select({ id: badmintonRegistrationsTable.id })
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.categoryId, catId),
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        eq(badmintonRegistrationsTable.status, "accepted"),
      ),
    );
  const acceptedIds = new Set(acceptedRegs.map((r) => r.id));

  for (const [i, f] of parsed.data.fixtures.entries()) {
    if (f.registrationAId != null && !acceptedIds.has(f.registrationAId)) {
      return void res.status(400).json({
        error: `Fixture ${i + 1}: registrationAId is not an accepted entry in this category`,
      });
    }
    if (f.registrationBId != null && !acceptedIds.has(f.registrationBId)) {
      return void res.status(400).json({
        error: `Fixture ${i + 1}: registrationBId is not an accepted entry in this category`,
      });
    }
    if (f.registrationAId == null && f.registrationBId == null) {
      return void res.status(400).json({
        error: `Fixture ${i + 1}: at least one side is required`,
      });
    }
    if (
      f.registrationAId != null &&
      f.registrationBId != null &&
      f.registrationAId === f.registrationBId
    ) {
      return void res.status(400).json({
        error: `Fixture ${i + 1}: Side A and Side B cannot be the same entry`,
      });
    }
  }

  const { collection, fixtures } = await createFixtureCollection({
    tournamentId,
    categoryId: catId,
    roundName: parsed.data.roundName?.trim() || "Manual Fixtures",
    drawKind: "manual",
    roundNumber: 1,
    totalRounds: 1,
    status: "active",
    metaJson: { adapter: "manual" },
    fixtures: parsed.data.fixtures.map((f, index) => ({
      slotNumber: f.slotNumber ?? index + 1,
      registrationAId: f.registrationAId ?? null,
      registrationBId: f.registrationBId ?? null,
      status:
        f.registrationAId != null && f.registrationBId != null ? "unscheduled" : "walkover",
    })),
  });

  res.status(201).json({ collection, fixtures });
});

/**
 * Import adapter — Phase 1 stub only (no parser / no processing).
 */
router.post("/categories/:catId/fixture-collections/import", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;
  const catId = parseId((req.params as MergedParams).catId);
  if (!catId) return void res.status(400).json({ error: "bad id" });

  try {
    importFixtureCollectionStub();
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string };
    return void res.status(e.status ?? 501).json({
      error: e.message ?? "Import not implemented",
      code: e.code ?? "IMPORT_NOT_IMPLEMENTED",
      message:
        "Import Existing Draw is a Phase 1 placeholder. Excel/CSV/PDF parsers arrive in a later phase.",
    });
  }
});

// ─── Matches ──────────────────────────────────────────────────────────────────

router.get("/matches", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  const includeScorerPin = await resolveIsTournamentOwner(req, tournamentId);
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
    preMatchTossJson: z.record(z.unknown()).nullable().optional(),
    scheduledAt: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  let fixtureCourtId = parsed.data.courtId;
  let fixtureScheduledAt = parsed.data.scheduledAt
    ? new Date(parsed.data.scheduledAt)
    : undefined;
  let fixtureCategoryId = parsed.data.categoryId;

  // Fixture-based create requires a scheduled fixture (court + time).
  // No fixtureId = legacy manual match (temporary compatibility).
  if (parsed.data.fixtureId) {
    const [fix] = await db
      .select()
      .from(badmintonFixturesTable)
      .where(
        and(
          eq(badmintonFixturesTable.id, parsed.data.fixtureId),
          eq(badmintonFixturesTable.tournamentId, tournamentId),
        ),
      )
      .limit(1);

    if (!fix) return void res.status(400).json({ error: "fixtureId not found in this tournament" });

    const gate = canCreateMatchFromFixture(fix);
    if (!gate.ok) {
      return void res.status(400).json({ error: gate.error, code: "FIXTURE_NOT_SCHEDULED" });
    }

    fixtureCourtId = fixtureCourtId ?? fix.courtId ?? undefined;
    fixtureScheduledAt = fixtureScheduledAt ?? (fix.scheduledAt ? new Date(fix.scheduledAt) : undefined);
    fixtureCategoryId = fixtureCategoryId ?? fix.categoryId;
  }

  try {
    const created = await createBadmintonMatch({
      tournamentId,
      ...parsed.data,
      categoryId: fixtureCategoryId,
      courtId: fixtureCourtId,
      scheduledAt: fixtureScheduledAt,
    });

    auditLog(req, {
      category: "tournament",
      action: "badminton.match_created",
      summary: `Match #${created.match.id} created`,
      tournamentId,
      resource: { type: "badminton_match", id: created.match.id },
      metadata: {
        fixtureId: parsed.data.fixtureId ?? null,
        courtId: fixtureCourtId ?? null,
      },
    });

    broadcastTournamentUpdate(tournamentId, { type: "match_created", matchId: created.match.id });
    res.status(201).json({
      ...created.match,
      detail: serializeBadmintonMatchDetail(created.detail, { includeScorerPin: true }),
    });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
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
      includeScorerPin: await resolveIsTournamentOwner(req, tournamentId),
    }),
  });
});

router.post("/matches/:matchId/verify-pin", async (_req, res) => {
  res.status(410).json({
    error: "Court/match scorer PIN auth has been removed. Use scorer mobile + PIN login.",
    code: "PIN_AUTH_REMOVED",
    ok: false,
  });
});

/**
 * Scorer Home — authenticated scorer sees all scoreable matches for the tournament.
 * Requires Scorer JWT (Bearer). Court/match PIN no longer used.
 */
router.get("/scorer/session", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return void res.status(401).json({ error: "Scorer login required", code: "AUTH_REQUIRED" });
    }
    await resolveScorerAuthFromToken(token);
    await ensureBadmintonTournament(tournamentId);
    const session = await openScorerHomeForTournament(tournamentId);
    res.json(session);
  } catch (e) {
    if (e instanceof ScorerAuthError) {
      return void res.status(e.status).json({ error: e.message, code: e.code, ok: false });
    }
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code, ok: false });
    }
    throw e;
  }
});

/** @deprecated Prefer GET /scorer/session with Bearer token. */
router.post("/scorer/session", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return void res.status(401).json({
        error: "Scorer login required. Mobile + personal PIN auth replaces court PIN.",
        code: "AUTH_REQUIRED",
        ok: false,
      });
    }
    await resolveScorerAuthFromToken(token);
    await ensureBadmintonTournament(tournamentId);
    const session = await openScorerHomeForTournament(tournamentId);
    res.json(session);
  } catch (e) {
    if (e instanceof ScorerAuthError) {
      return void res.status(e.status).json({ error: e.message, code: e.code, ok: false });
    }
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code, ok: false });
    }
    throw e;
  }
});

/** Refresh Scorer Home using Scorer JWT. */
router.get("/scorer/matches", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) return void res.status(400).json({ error: "bad id" });

  try {
    const token = extractBearerToken(req.headers.authorization);
    if (!token) {
      return void res.status(401).json({ error: "Scorer login required", code: "AUTH_REQUIRED" });
    }
    await resolveScorerAuthFromToken(token);
    await ensureBadmintonTournament(tournamentId);
    const session = await openScorerHomeForTournament(tournamentId);
    if (!session.ok) {
      return void res.status(404).json({ error: "No matches available", code: "NO_MATCHES" });
    }
    res.json(session);
  } catch (e) {
    if (e instanceof ScorerAuthError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({ error: e.message, code: e.code });
    }
    throw e;
  }
});

/** Organizer/admin force-unlock a stuck match lock. */
router.post("/matches/:matchId/force-unlock", async (req, res) => {
  const tournamentId = await guardBadmintonWrite(req, res);
  if (!tournamentId) return;

  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const actorType = req.jwtUser?.isAdmin ? "admin" : "organizer";
  const actorId = req.jwtUser?.isAdmin
    ? "admin"
    : (req.jwtUser?.organizerAccountId?.toString() ?? "organizer");

  const cleared = await forceUnlockMatch({
    matchId,
    actorType,
    actorId,
    tournamentId,
    sport: "badminton",
  });

  res.json({ ok: true, cleared });
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
    scorerName: z.string().max(100).nullable().optional(),
    matchFormatJson: z
      .object({
        totalGames: z.number(),
        pointsPerGame: z.number(),
        deuceAt: z.number(),
        maxPoints: z.number(),
        midGameSideChange: z.boolean(),
      })
      .nullable()
      .optional(),
    preMatchTossJson: z.record(z.unknown()).nullable().optional(),
    scheduledAt: z.string().min(1).nullable().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: parsed.error.message });

  try {
    const updated = await updateBadmintonMatch(matchId, tournamentId, {
      ...parsed.data,
      scheduledAt:
        parsed.data.scheduledAt === undefined
          ? undefined
          : parsed.data.scheduledAt
            ? new Date(parsed.data.scheduledAt)
            : null,
    });
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
    auditLog(req, {
      category: "tournament",
      action: "badminton.match_deleted",
      summary: `Match #${matchId} deleted`,
      severity: "warning",
      tournamentId,
      resource: { type: "badminton_match", id: matchId },
    });
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
  const { tournamentId, auth: scoringAuth } = auth;

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
    const format = await resolveFormatForMatchStart(
      matchId,
      tournamentId,
      parsed.data.format,
    );

    const state = await startBadmintonMatch(
      matchId,
      tournamentId,
      {
        ...parsed.data,
        format,
      } as BadmintonMatchStartedPayload,
      actorFrom(req, scoringAuth),
    );

    auditLog(req, {
      category: "tournament",
      action: "badminton.match_started",
      summary: `Match #${matchId} started`,
      tournamentId,
      resource: { type: "badminton_match", id: matchId },
      metadata: { viaScorer: scoringAuth.usedScorer },
    });

    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({
        error: friendlyBadmintonCommandMessage(e.message),
        code: e.code,
      });
    }
    throw e;
  }
});

router.post("/matches/:matchId/point", async (req, res) => {
  const matchId = parseId((req.params as MergedParams).matchId);
  if (!matchId) return void res.status(400).json({ error: "bad id" });

  const auth = await guardBadmintonScoring(req, res, matchId);
  if (!auth) return;
  const { tournamentId, auth: scoringAuth } = auth;

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
      actorFrom(req, scoringAuth),
      { rallyLength: parsed.data.rallyLength },
    );

    const auditActor = auditActorFrom(req, scoringAuth);
    await writeScorerAudit({
      ...auditActor,
      tournamentId,
      matchId,
      sport: "badminton",
      action: "point_added",
      payload: { side: parsed.data.side },
    });
    await maybeReleaseLockAfterTerminal(matchId, tournamentId, state);

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
  const { tournamentId, auth: scoringAuth } = auth;

  try {
    const state = await undoLastPoint(matchId, tournamentId, actorFrom(req, scoringAuth));
    const auditActor = auditActorFrom(req, scoringAuth);
    await writeScorerAudit({
      ...auditActor,
      tournamentId,
      matchId,
      sport: "badminton",
      action: "undo",
    });
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
  const { tournamentId, auth: scoringAuth } = auth;

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
      actorFrom(req, scoringAuth),
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
  const { tournamentId, auth: scoringAuth } = auth;

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
      actorFrom(req, scoringAuth),
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
  const { tournamentId, auth: scoringAuth } = auth;

  try {
    const state = await handleCourtChangeAck(matchId, tournamentId, actorFrom(req, scoringAuth));
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
      actorFrom(req, { kind: "organizer_or_admin", usedScorer: false }),
      parsed.data.reason,
    );
    auditLog(req, {
      category: "tournament",
      action: "badminton.match_retired",
      summary: `Match #${matchId} retired (${parsed.data.retiringSide})`,
      tournamentId,
      resource: { type: "badminton_match", id: matchId },
      metadata: { retiringSide: parsed.data.retiringSide, reason: parsed.data.reason ?? null },
    });
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({
        error: friendlyBadmintonCommandMessage(e.message),
        code: e.code,
      });
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
      actorFrom(req, { kind: "organizer_or_admin", usedScorer: false }),
      parsed.data.reason,
    );
    auditLog(req, {
      category: "tournament",
      action: "badminton.match_walkover",
      summary: `Match #${matchId} walkover (${parsed.data.winningSide})`,
      tournamentId,
      resource: { type: "badminton_match", id: matchId },
      metadata: { winningSide: parsed.data.winningSide, reason: parsed.data.reason ?? null },
    });
    broadcastBadmintonMatchUpdate(matchId, tournamentId, state);
    res.json({ state });
  } catch (e) {
    if (e instanceof BadmintonServiceError) {
      return void res.status(e.status).json({
        error: friendlyBadmintonCommandMessage(e.message),
        code: e.code,
      });
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
      actorFrom(req, { kind: "organizer_or_admin", usedScorer: false }),
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
      actorFrom(req, { kind: "organizer_or_admin", usedScorer: false }),
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
    const state = await handleResumeMatch(matchId, tournamentId, actorFrom(req, { kind: "organizer_or_admin", usedScorer: false }));
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
      actorFrom(req, { kind: "organizer_or_admin", usedScorer: false }),
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
      actorFrom(req, { kind: "organizer_or_admin", usedScorer: false }),
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

  if (!(await resolveIsTournamentDirector(req, tournamentId))) {
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

  if (!(await resolveIsTournamentDirector(req, tournamentId))) {
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

// ─── Auto Generate algorithm (planning only — fixtures via writer) ───────────

function generateKnockoutDraw(
  _tournamentId: number,
  _categoryId: number,
  registrations: Array<{ id: number; seedNumber: number | null }>,
): Array<{
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
      slotNumber: Math.floor(i / 2) + 1,
      registrationAId: slots[i] ?? null,
      registrationBId: slots[i + 1] ?? null,
      status: slots[i] && slots[i + 1] ? "unscheduled" : "walkover",
    });
  }
  return fixtures;
}

export default router;
