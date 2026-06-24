import { Router } from "express";
import { db } from "@workspace/db";
import { globalPlayersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { parseIndianMobile } from "@workspace/api-base/mobile";
import { isPlayerSportProfilesEnabled } from "@workspace/api-base/player-sport-profiles";
import { heavyLimiter } from "../lib/rate-limiters";
import { isAccountOrAdmin } from "../middleware/require-organizer";
import {
  privateGlobalPlayerIdentitySearchSerializer,
  privateGlobalPlayerSearchSerializer,
  publicGlobalPlayerIdentitySearchSerializer,
  publicGlobalPlayerSearchSerializer,
} from "../lib/serializers/global-player";
import { serializeGlobalPlayerWithProfiles } from "../lib/master-sports/global-player-response";
import { playerSportProfileService } from "../lib/master-sports/player-sport-profile-service";
import { isPlayerSpecsV2Enabled } from "@workspace/api-base/player-specs-v2";
import { playerSpecificationService } from "../lib/player-specification-service";

async function attachSpecificationsToSearchRows(
  rows: Array<Record<string, unknown> & { id: number }>,
): Promise<Array<Record<string, unknown>>> {
  if (!isPlayerSpecsV2Enabled() || rows.length === 0) return rows;

  const specsMap = await playerSpecificationService.getSpecificationsForPlayers(
    rows.map((row) => row.id),
  );

  return rows.map((row) => {
    const specifications = specsMap.get(row.id) ?? [];
    return {
      ...row,
      specifications: specifications.map((spec) => ({
        specGroupId: spec.specGroupId,
        groupName: spec.groupName,
        value: spec.value,
      })),
    };
  });
}

const cloudinaryImageUrl = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.startsWith("https://res.cloudinary.com/"),
    "Image URL must be a Cloudinary HTTPS URL (https://res.cloudinary.com/...)",
  );

const router = Router();

router.get("/global-players/search", heavyLimiter, async (req, res) => {
  const q = String(req.query.q || "").trim();
  const limit = Math.min(parseInt(String(req.query.limit || "10")), 50);
  const sportFilter = String(req.query.sport || "").trim().toLowerCase() || null;
  const profilesEnabled = isPlayerSportProfilesEnabled();

  if (q.length < 2) {
    res.json([]);
    return;
  }

  const pattern = `%${q}%`;
  const mobilePrefix = `${q}%`;

  try {
    const result = profilesEnabled
      ? await db.execute(sql`
          WITH player_candidates AS (
            SELECT
              p.id,
              p.name,
              p.mobile_number,
              p.city,
              p.age,
              p.gender,
              p.role,
              p.photo_url,
              p.global_player_id,
              p.base_price,
              t.sport AS tournament_sport,
              ROW_NUMBER() OVER (
                PARTITION BY COALESCE(p.mobile_number, p.id::text)
                ORDER BY
                  CASE WHEN ${sportFilter}::text IS NOT NULL AND lower(t.sport) = ${sportFilter} THEN 0 ELSE 1 END,
                  p.created_at DESC
              ) AS rn,
              COUNT(*) OVER (
                PARTITION BY COALESCE(p.mobile_number, p.id::text)
              ) AS appearance_count
            FROM players p
            INNER JOIN tournaments t ON t.id = p.tournament_id
            WHERE
              (${sportFilter}::text IS NULL OR lower(t.sport) = ${sportFilter})
              AND (
                p.name ILIKE ${pattern}
                OR p.mobile_number LIKE ${mobilePrefix}
                OR p.global_player_id = ${q}
              )
          )
          SELECT
            id,
            name,
            mobile_number AS "mobileNumber",
            city,
            age,
            gender,
            role,
            photo_url AS "photoUrl",
            global_player_id AS "globalPlayerId",
            base_price AS "basePrice",
            tournament_sport AS sport,
            appearance_count::int AS "appearanceCount"
          FROM player_candidates
          WHERE rn = 1
          ORDER BY appearance_count DESC, name ASC
          LIMIT ${limit}
        `)
      : await db.execute(sql`
          WITH player_candidates AS (
            SELECT
              p.id,
              p.name,
              p.mobile_number,
              p.city,
              p.age,
              p.gender,
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
                ORDER BY
                  CASE WHEN ${sportFilter}::text IS NOT NULL AND lower(t.sport) = ${sportFilter} THEN 0 ELSE 1 END,
                  p.created_at DESC
              ) AS rn,
              COUNT(*) OVER (
                PARTITION BY COALESCE(p.mobile_number, p.id::text)
              ) AS appearance_count
            FROM players p
            INNER JOIN tournaments t ON t.id = p.tournament_id
            WHERE
              (${sportFilter}::text IS NULL OR lower(t.sport) = ${sportFilter})
              AND (
                p.name ILIKE ${pattern}
                OR p.mobile_number LIKE ${mobilePrefix}
                OR p.global_player_id = ${q}
              )
          )
          SELECT
            id,
            name,
            mobile_number AS "mobileNumber",
            city,
            age,
            gender,
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

    const isPrivate = isAccountOrAdmin(req) || !!req.jwtUser?.isAdmin;
    const rawRows = result.rows as Array<Record<string, unknown> & { id: number }>;
    const rows = await attachSpecificationsToSearchRows(rawRows);

    if (profilesEnabled) {
      res.json(
        rows.map((row) =>
          isPrivate
            ? privateGlobalPlayerIdentitySearchSerializer(
                row as Parameters<typeof privateGlobalPlayerIdentitySearchSerializer>[0],
              )
            : publicGlobalPlayerIdentitySearchSerializer(
                row as Parameters<typeof publicGlobalPlayerIdentitySearchSerializer>[0],
              ),
        ),
      );
      return;
    }

    res.json(
      rows.map((row) =>
        isPrivate
          ? privateGlobalPlayerSearchSerializer(
              row as Parameters<typeof privateGlobalPlayerSearchSerializer>[0],
            )
          : publicGlobalPlayerSearchSerializer(
              row as Parameters<typeof publicGlobalPlayerSearchSerializer>[0],
            ),
      ),
    );
  } catch (err) {
    req.log?.error({ err }, "global-players search error");
    res.status(500).json({ error: "Search failed" });
  }
});

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
  const isPrivate = isAccountOrAdmin(req) || !!req.jwtUser?.isAdmin;
  res.json(
    await serializeGlobalPlayerWithProfiles(gp, isPrivate ? "private" : "public"),
  );
});

router.post("/global-players", async (req, res) => {
  if (!isAccountOrAdmin(req) && !req.jwtUser?.isAdmin) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const schema = z.object({
    canonicalName: z.string().min(1),
    mobileNumber: z.string().optional(),
    sport: z.string().optional(),
    defaultRole: z.string().optional(),
    city: z.string().optional(),
    age: z.number().int().optional(),
    gender: z.enum(["M", "F"]).nullable().optional(),
    photoUrl: cloudinaryImageUrl,
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }

  const d = parsed.data;
  const profilesEnabled = isPlayerSportProfilesEnabled();

  let mobileNumber: string | null = null;
  if (d.mobileNumber) {
    const mobileParsed = parseIndianMobile(d.mobileNumber);
    if (!mobileParsed.ok) {
      res.status(400).json({ error: mobileParsed.error });
      return;
    }
    mobileNumber = mobileParsed.normalized;
  }

  if (mobileNumber) {
    const [existing] = await db
      .select()
      .from(globalPlayersTable)
      .where(eq(globalPlayersTable.mobileNumber, mobileNumber));
    if (existing) {
      const identityUpdate = {
        canonicalName: d.canonicalName,
        city: d.city ?? existing.city,
        age: d.age ?? existing.age,
        gender: d.gender ?? existing.gender,
        photoUrl: d.photoUrl ?? existing.photoUrl,
        notes: d.notes ?? existing.notes,
        updatedAt: new Date(),
      };

      const [updated] = await db
        .update(globalPlayersTable)
        .set(
          profilesEnabled
            ? identityUpdate
            : {
                ...identityUpdate,
                sport: d.sport ?? existing.sport,
                defaultRole: d.defaultRole ?? existing.defaultRole,
              },
        )
        .where(eq(globalPlayersTable.id, existing.id))
        .returning();

      if (profilesEnabled && d.sport) {
        await playerSportProfileService.upsertSportProfile(updated.id, {
          sportSlug: d.sport,
          defaultRole: d.defaultRole ?? null,
        });
      }

      res.json(
        await serializeGlobalPlayerWithProfiles(updated, "private"),
      );
      return;
    }
  }

  const gpId = `gp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const sportSlug = (d.sport ?? "cricket").trim().toLowerCase();

  const [created] = await db
    .insert(globalPlayersTable)
    .values({
      id: gpId,
      canonicalName: d.canonicalName,
      mobileNumber,
      sport: sportSlug,
      defaultRole: d.defaultRole ?? null,
      city: d.city ?? null,
      age: d.age ?? null,
      gender: d.gender ?? null,
      photoUrl: d.photoUrl ?? null,
      notes: d.notes ?? null,
    })
    .returning();

  if (profilesEnabled && d.sport) {
    await playerSportProfileService.upsertSportProfile(created.id, {
      sportSlug,
      defaultRole: d.defaultRole ?? null,
    });
  }

  res.status(201).json(await serializeGlobalPlayerWithProfiles(created, "private"));
});

export default router;
