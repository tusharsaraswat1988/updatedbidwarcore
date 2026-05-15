import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, teamsTable, tournamentsTable, playerImportLogsTable } from "@workspace/db";
import { eq, and, or, ne, inArray, desc, sql } from "drizzle-orm";
import { z } from "zod";

async function computeRegistrationStatus(tid: number) {
  const [tournament] = await db
    .select({
      deadline: tournamentsTable.registrationDeadline,
      limit: tournamentsTable.registrationLimit,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tid));
  if (!tournament) return null;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));
  const deadline = tournament.deadline ?? null;
  const limit = tournament.limit ?? null;
  let reason: string | null = null;
  let open = true;
  if (deadline) {
    const today = new Date().toISOString().slice(0, 10);
    if (today > deadline) {
      open = false;
      reason = "deadline_passed";
    }
  }
  if (open && limit !== null && count >= limit) {
    open = false;
    reason = "limit_reached";
  }
  return { open, reason, currentCount: count, limit, deadline };
}

const router = Router();

const playerToJson = (p: typeof playersTable.$inferSelect) => ({
  id: p.id,
  tournamentId: p.tournamentId,
  categoryId: p.categoryId,
  teamId: p.teamId,
  name: p.name,
  city: p.city,
  role: p.role,
  battingStyle: p.battingStyle,
  bowlingStyle: p.bowlingStyle,
  specialization: p.specialization,
  age: p.age,
  photoUrl: p.photoUrl,
  basePrice: p.basePrice,
  soldPrice: p.soldPrice,
  retainedPrice: p.retainedPrice,
  status: p.status,
  jerseyNumber: p.jerseyNumber,
  achievements: p.achievements,
  mobileNumber: p.mobileNumber,
  cricheroUrl: p.cricheroUrl,
  availabilityDates: p.availabilityDates,
  createdAt: p.createdAt.toISOString(),
});

const playerToPublicJson = (p: typeof playersTable.$inferSelect) => ({
  id: p.id,
  tournamentId: p.tournamentId,
  categoryId: p.categoryId,
  teamId: p.teamId,
  name: p.name,
  city: p.city,
  role: p.role,
  battingStyle: p.battingStyle,
  bowlingStyle: p.bowlingStyle,
  specialization: p.specialization,
  age: p.age,
  photoUrl: p.photoUrl,
  basePrice: p.basePrice,
  soldPrice: p.soldPrice,
  retainedPrice: p.retainedPrice,
  status: p.status,
  jerseyNumber: p.jerseyNumber,
  achievements: p.achievements,
  mobileNumber: null,
  cricheroUrl: p.cricheroUrl,
  availabilityDates: p.availabilityDates,
  createdAt: p.createdAt.toISOString(),
});

const playerInputSchema = z.object({
  categoryId: z.number().int().optional(),
  name: z.string().min(1),
  city: z.string().optional(),
  role: z.string().optional(),
  battingStyle: z.string().optional(),
  bowlingStyle: z.string().optional(),
  specialization: z.string().optional(),
  age: z.number().int().optional(),
  photoUrl: z.string().optional(),
  basePrice: z.number().int(),
  jerseyNumber: z.string().optional(),
  achievements: z.string().optional(),
  mobileNumber: z.string().optional(),
  cricheroUrl: z.string().optional(),
  availabilityDates: z.string().optional(),
  retainedPrice: z.number().int().optional(),
  status: z.string().optional(),
});

router.get("/tournaments/:tournamentId/players", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const isOrganizer = !!req.session?.organizerAccountId;
  const serializer = isOrganizer ? playerToJson : playerToPublicJson;
  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid))
    .orderBy(playersTable.createdAt);
  res.json(players.map(serializer));
});

router.post("/tournaments/:tournamentId/players", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const parsed = playerInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const d = parsed.data;
  const [player] = await db
    .insert(playersTable)
    .values({
      tournamentId: tid,
      categoryId: d.categoryId ?? null,
      name: d.name,
      city: d.city ?? null,
      role: d.role ?? null,
      battingStyle: d.battingStyle ?? null,
      bowlingStyle: d.bowlingStyle ?? null,
      specialization: d.specialization ?? null,
      age: d.age ?? null,
      photoUrl: d.photoUrl ?? null,
      basePrice: d.basePrice,
      jerseyNumber: d.jerseyNumber ?? null,
      achievements: d.achievements ?? null,
      mobileNumber: d.mobileNumber ?? null,
      cricheroUrl: d.cricheroUrl ?? null,
      availabilityDates: d.availabilityDates ?? null,
      retainedPrice: d.retainedPrice ?? null,
      status: (d.status ?? "available") as "available" | "sold" | "unsold" | "retained",
    })
    .returning();
  res.status(201).json(playerToJson(player));
});

router.get("/tournaments/:tournamentId/registration-status", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const status = await computeRegistrationStatus(tid);
  if (!status) { res.status(404).json({ error: "Not found" }); return; }
  res.json(status);
});

router.post("/tournaments/:tournamentId/register", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const status = await computeRegistrationStatus(tid);
  if (!status) { res.status(404).json({ error: "Not found" }); return; }
  if (!status.open) { res.status(403).json(status); return; }
  const parsed = playerInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const d = parsed.data;
  const [player] = await db
    .insert(playersTable)
    .values({
      tournamentId: tid,
      categoryId: d.categoryId ?? null,
      name: d.name,
      city: d.city ?? null,
      role: d.role ?? null,
      battingStyle: d.battingStyle ?? null,
      bowlingStyle: d.bowlingStyle ?? null,
      specialization: d.specialization ?? null,
      age: d.age ?? null,
      photoUrl: d.photoUrl ?? null,
      basePrice: d.basePrice,
      jerseyNumber: d.jerseyNumber ?? null,
      achievements: d.achievements ?? null,
      mobileNumber: d.mobileNumber ?? null,
      cricheroUrl: d.cricheroUrl ?? null,
      availabilityDates: d.availabilityDates ?? null,
      retainedPrice: d.retainedPrice ?? null,
      status: "available" as const,
    })
    .returning();
  res.status(201).json(playerToPublicJson(player));
});

router.post("/tournaments/:tournamentId/players/bulk", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const schema = z.object({
    players: z.array(playerInputSchema).min(1).max(500),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  let created = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const pd of parsed.data.players) {
    try {
      await db.insert(playersTable).values({
        tournamentId: tid,
        categoryId: pd.categoryId ?? null,
        name: pd.name,
        city: pd.city ?? null,
        role: pd.role ?? null,
        battingStyle: pd.battingStyle ?? null,
        bowlingStyle: pd.bowlingStyle ?? null,
        specialization: pd.specialization ?? null,
        age: pd.age ?? null,
        photoUrl: pd.photoUrl ?? null,
        basePrice: pd.basePrice,
        jerseyNumber: pd.jerseyNumber ?? null,
        achievements: pd.achievements ?? null,
        mobileNumber: pd.mobileNumber ?? null,
        cricheroUrl: pd.cricheroUrl ?? null,
        availabilityDates: pd.availabilityDates ?? null,
        retainedPrice: pd.retainedPrice ?? null,
        status: (pd.status ?? "available") as "available" | "sold" | "unsold" | "retained",
      });
      created++;
    } catch (err) {
      failed++;
      errors.push(`${pd.name}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  res.json({ created, failed, errors });
});

router.get("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const isOrganizer = !!req.session?.organizerAccountId;
  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
  if (!player) { res.status(404).json({ error: "Not found" }); return; }
  res.json(isOrganizer ? playerToJson(player) : playerToPublicJson(player));
});

router.patch("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    categoryId: z.number().int().optional(),
    name: z.string().optional(),
    city: z.string().optional(),
    role: z.string().optional(),
    battingStyle: z.string().optional(),
    bowlingStyle: z.string().optional(),
    specialization: z.string().optional(),
    age: z.number().int().optional(),
    photoUrl: z.string().optional(),
    basePrice: z.number().int().optional(),
    jerseyNumber: z.string().optional(),
    achievements: z.string().optional(),
    mobileNumber: z.string().optional(),
    cricheroUrl: z.string().optional(),
    availabilityDates: z.string().optional(),
    retainedPrice: z.number().int().nullable().optional(),
    status: z.string().optional(),
    teamId: z.number().int().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.categoryId !== undefined) updates.categoryId = d.categoryId;
  if (d.name !== undefined) updates.name = d.name;
  if (d.city !== undefined) updates.city = d.city;
  if (d.role !== undefined) updates.role = d.role;
  if (d.battingStyle !== undefined) updates.battingStyle = d.battingStyle;
  if (d.bowlingStyle !== undefined) updates.bowlingStyle = d.bowlingStyle;
  if (d.specialization !== undefined) updates.specialization = d.specialization;
  if (d.age !== undefined) updates.age = d.age;
  if (d.photoUrl !== undefined) updates.photoUrl = d.photoUrl;
  if (d.basePrice !== undefined) updates.basePrice = d.basePrice;
  if (d.jerseyNumber !== undefined) updates.jerseyNumber = d.jerseyNumber;
  if (d.achievements !== undefined) updates.achievements = d.achievements;
  if (d.mobileNumber !== undefined) updates.mobileNumber = d.mobileNumber;
  if (d.cricheroUrl !== undefined) updates.cricheroUrl = d.cricheroUrl;
  if (d.availabilityDates !== undefined) updates.availabilityDates = d.availabilityDates;
  if (d.retainedPrice !== undefined) updates.retainedPrice = d.retainedPrice;
  if (d.status !== undefined) updates.status = d.status;
  if (d.teamId !== undefined) updates.teamId = d.teamId;
  const [player] = await db
    .update(playersTable)
    .set(updates)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)))
    .returning();
  if (!player) { res.status(404).json({ error: "Not found" }); return; }
  res.json(playerToJson(player));
});

router.delete("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.delete(playersTable).where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
  res.status(204).send();
});

router.get("/tournaments/:tournamentId/import-sources", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const organizerAccountId = req.session?.organizerAccountId;

  const baseQuery = db
    .select({
      id: tournamentsTable.id,
      name: tournamentsTable.name,
      sport: tournamentsTable.sport,
      auctionDate: tournamentsTable.auctionDate,
    })
    .from(tournamentsTable)
    .$dynamic();

  const sources = await (organizerAccountId
    ? baseQuery.where(and(ne(tournamentsTable.id, tid), eq(tournamentsTable.organizerId, organizerAccountId)))
    : baseQuery.where(ne(tournamentsTable.id, tid))
  ).orderBy(desc(tournamentsTable.createdAt));

  const result = await Promise.all(
    sources.map(async (s) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(playersTable)
        .where(eq(playersTable.tournamentId, s.id));
      return { ...s, playerCount: Number(count) };
    }),
  );

  res.json(result.filter((s) => s.playerCount > 0));
});

router.get("/tournaments/:tournamentId/import-candidates", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const sourceTid = parseInt(String(req.query.sourceTournamentId || "0"));
  if (isNaN(tid) || isNaN(sourceTid) || sourceTid === 0) {
    res.status(400).json({ error: "sourceTournamentId is required" });
    return;
  }

  const q = String(req.query.q || "").trim();

  const existingInTarget = await db
    .select({ mobile: playersTable.mobileNumber, name: playersTable.name })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));

  const mobileSet = new Set(
    existingInTarget.map((p) => p.mobile).filter((m): m is string => !!m),
  );
  const nameSet = new Set(
    existingInTarget.map((p) => p.name.toLowerCase().trim()),
  );

  const conditions = [eq(playersTable.tournamentId, sourceTid)];
  if (q.length >= 2) {
    conditions.push(
      or(
        sql`${playersTable.name} ILIKE ${"%" + q + "%"}`,
        sql`${playersTable.mobileNumber} LIKE ${q + "%"}`,
      ) as ReturnType<typeof eq>,
    );
  }

  const sourcePlayers = await db
    .select()
    .from(playersTable)
    .where(and(...conditions))
    .orderBy(playersTable.name);

  const isOrganizer = !!req.session?.organizerAccountId;
  const serializer = isOrganizer ? playerToJson : playerToPublicJson;

  const result = sourcePlayers.map((p) => ({
    ...serializer(p),
    isDuplicate:
      (!!p.mobileNumber && mobileSet.has(p.mobileNumber)) ||
      nameSet.has(p.name.toLowerCase().trim()),
  }));

  res.json(result);
});

router.post("/tournaments/:tournamentId/import-players", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const schema = z.object({
    sourceTournamentId: z.number().int(),
    playerIds: z.array(z.number().int()).min(1).max(500),
    categoryId: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }

  const { sourceTournamentId, playerIds, categoryId } = parsed.data;

  const existingMobiles = await db
    .select({ mobile: playersTable.mobileNumber })
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tid), sql`${playersTable.mobileNumber} IS NOT NULL`));
  const mobileSet = new Set(
    existingMobiles.map((m) => m.mobile).filter((m): m is string => !!m),
  );

  const sourcePlayers = await db
    .select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.tournamentId, sourceTournamentId),
        inArray(playersTable.id, playerIds),
      ),
    );

  let imported = 0;
  let skipped = 0;

  for (const p of sourcePlayers) {
    if (p.mobileNumber && mobileSet.has(p.mobileNumber)) {
      skipped++;
      continue;
    }

    await db.insert(playersTable).values({
      tournamentId: tid,
      categoryId: categoryId ?? p.categoryId ?? null,
      name: p.name,
      city: p.city,
      role: p.role,
      battingStyle: p.battingStyle,
      bowlingStyle: p.bowlingStyle,
      specialization: p.specialization,
      age: p.age,
      photoUrl: p.photoUrl,
      basePrice: p.basePrice,
      jerseyNumber: p.jerseyNumber,
      achievements: p.achievements,
      mobileNumber: p.mobileNumber,
      cricheroUrl: p.cricheroUrl,
      availabilityDates: p.availabilityDates,
      globalPlayerId: p.globalPlayerId,
      status: "available" as const,
      teamId: null,
    });

    if (p.mobileNumber) mobileSet.add(p.mobileNumber);
    imported++;
  }

  if (imported > 0) {
    await db.insert(playerImportLogsTable).values({
      sourceTournamentId,
      targetTournamentId: tid,
      organizerAccountId: req.session?.organizerAccountId ?? null,
      playerCount: imported,
    });
  }

  res.json({ imported, skipped, total: sourcePlayers.length });
});

export default router;
