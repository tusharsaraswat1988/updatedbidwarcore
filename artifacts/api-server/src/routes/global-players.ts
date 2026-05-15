import { Router } from "express";
import { db } from "@workspace/db";
import { globalPlayersTable, playersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ─── Search players across all tournaments (deduplicated by mobile) ────────────
// Used for autocomplete in the Add Player form.
// Groups by mobile number — if same mobile appears in N tournaments, returns
// the most recent record with appearance_count = N.
router.get("/global-players/search", async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(parseInt(String(req.query.limit || "10")), 50);

  if (q.length < 2) {
    res.json([]);
    return;
  }

  const pattern = `%${q}%`;
  const mobilePrefix = `${q}%`;

  try {
    const result = await db.execute(sql`
      WITH player_candidates AS (
        SELECT
          p.id,
          p.name,
          p.mobile_number,
          p.city,
          p.age,
          p.role,
          p.photo_url,
          p.batting_style,
          p.bowling_style,
          p.specialization,
          p.jersey_number,
          p.achievements,
          p.crichero_url,
          p.availability_dates,
          p.global_player_id,
          p.base_price,
          ROW_NUMBER() OVER (
            PARTITION BY COALESCE(p.mobile_number, p.id::text)
            ORDER BY p.created_at DESC
          ) AS rn,
          COUNT(*) OVER (
            PARTITION BY COALESCE(p.mobile_number, p.id::text)
          ) AS appearance_count
        FROM players p
        WHERE
          p.name ILIKE ${pattern}
          OR p.mobile_number LIKE ${mobilePrefix}
          OR p.global_player_id = ${q}
      )
      SELECT
        id,
        name,
        mobile_number AS "mobileNumber",
        city,
        age,
        role,
        photo_url AS "photoUrl",
        batting_style AS "battingStyle",
        bowling_style AS "bowlingStyle",
        specialization,
        jersey_number AS "jerseyNumber",
        achievements,
        crichero_url AS "cricheroUrl",
        availability_dates AS "availabilityDates",
        global_player_id AS "globalPlayerId",
        base_price AS "basePrice",
        appearance_count::int AS "appearanceCount"
      FROM player_candidates
      WHERE rn = 1
      ORDER BY appearance_count DESC, name ASC
      LIMIT ${limit}
    `);

    res.json(result.rows);
  } catch (err) {
    req.log?.error({ err }, "global-players search error");
    res.status(500).json({ error: "Search failed" });
  }
});

// ─── Get global player by ID ───────────────────────────────────────────────────
router.get("/global-players/:gpid", async (req, res) => {
  const gpid = req.params.gpid;
  const [gp] = await db
    .select()
    .from(globalPlayersTable)
    .where(eq(globalPlayersTable.id, gpid));
  if (!gp) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({
    id: gp.id,
    canonicalName: gp.canonicalName,
    mobileNumber: gp.mobileNumber,
    sport: gp.sport,
    defaultRole: gp.defaultRole,
    city: gp.city,
    age: gp.age,
    photoUrl: gp.photoUrl,
    notes: gp.notes,
    createdAt: gp.createdAt.toISOString(),
  });
});

// ─── Upsert global player (by mobile) ─────────────────────────────────────────
router.post("/global-players", async (req, res) => {
  const schema = z.object({
    canonicalName: z.string().min(1),
    mobileNumber: z.string().optional(),
    sport: z.string().optional(),
    defaultRole: z.string().optional(),
    city: z.string().optional(),
    age: z.number().int().optional(),
    photoUrl: z.string().optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const d = parsed.data;

  // Check if mobile already exists
  if (d.mobileNumber) {
    const [existing] = await db
      .select()
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.mobileNumber, d.mobileNumber));
    if (existing) {
      // Update and return
      const [updated] = await db
        .update(globalPlayersTable)
        .set({
          canonicalName: d.canonicalName,
          sport: d.sport ?? existing.sport,
          defaultRole: d.defaultRole ?? existing.defaultRole,
          city: d.city ?? existing.city,
          age: d.age ?? existing.age,
          photoUrl: d.photoUrl ?? existing.photoUrl,
          notes: d.notes ?? existing.notes,
        })
        .where(eq(globalPlayersTable.id, existing.id))
        .returning();
      res.json({ ...updated, updatedAt: updated.updatedAt.toISOString(), createdAt: updated.createdAt.toISOString() });
      return;
    }
  }

  // Generate a new GP ID
  const gpId = `gp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

  const [created] = await db
    .insert(globalPlayersTable)
    .values({
      id: gpId,
      canonicalName: d.canonicalName,
      mobileNumber: d.mobileNumber ?? null,
      sport: d.sport ?? "cricket",
      defaultRole: d.defaultRole ?? null,
      city: d.city ?? null,
      age: d.age ?? null,
      photoUrl: d.photoUrl ?? null,
      notes: d.notes ?? null,
    })
    .returning();

  res.status(201).json({ ...created, createdAt: created.createdAt.toISOString(), updatedAt: created.updatedAt.toISOString() });
});

export default router;
