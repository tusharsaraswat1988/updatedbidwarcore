import { Router, type Request } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import type { LocalDb } from "@workspace/db-local";
import { teamsTable, playersTable, categoriesTable, tournamentsTable } from "@workspace/db-local";
import { parseIndianMobile } from "@workspace/api-base/mobile";
import { getLocalJwtUser } from "../middleware/local-jwt-auth.js";
import { isOrganizerForTournament } from "../lib/local-auth.js";
import { getActiveBoosterTotalsForTeams } from "../lib/purse-capacity.js";
import { computeScoutPurseProtection } from "../lib/scout-purse.js";

import { resolveOfflineUrl } from "../lib/offline-media.js";
import { localMediaUrlSchema, zodFirstError } from "../lib/local-url-schema.js";

const teamToJson = (t: typeof teamsTable.$inferSelect) => ({
  id: t.id, tournamentId: t.tournamentId, name: t.name, shortCode: t.shortCode,
  ownerName: t.ownerName, ownerMobile: t.ownerMobile, color: t.color, logoUrl: resolveOfflineUrl(t.logoUrl),
  purse: t.purse, purseUsed: t.purseUsed, isBiddingEnabled: t.isBiddingEnabled,
  accessCode: t.accessCode, cloudId: t.cloudId, createdAt: t.createdAt,
});

// Public serializer: omits accessCode and ownerMobile (not set to null).
// Adds requiresAccessCode so owner-app access gate works without exposing the code.
const teamToPublicJson = (t: typeof teamsTable.$inferSelect) => ({
  id: t.id,
  tournamentId: t.tournamentId,
  name: t.name,
  shortCode: t.shortCode,
  color: t.color,
  logoUrl: resolveOfflineUrl(t.logoUrl),
  purse: t.purse,
  purseUsed: t.purseUsed,
  isBiddingEnabled: t.isBiddingEnabled,
  requiresAccessCode: !!t.accessCode,
  createdAt: t.createdAt,
});

function isLocalOrganizer(req: Request, tournamentId: number): boolean {
  return isOrganizerForTournament(getLocalJwtUser(req), tournamentId);
}

const DUPLICATE_OWNER_MOBILE_ERROR =
  "This mobile number is already assigned to another team in this tournament.";

async function findDuplicateOwnerMobileTeam(
  db: LocalDb,
  tournamentId: number,
  normalizedMobile: string,
  excludeTeamId?: number,
) {
  const teams = await db
    .select({ id: teamsTable.id, ownerMobile: teamsTable.ownerMobile })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  for (const team of teams) {
    if (excludeTeamId !== undefined && team.id === excludeTeamId) continue;
    if (!team.ownerMobile) continue;
    const other = parseIndianMobile(team.ownerMobile);
    if (other.ok && other.normalized === normalizedMobile) return team;
  }
  return null;
}

export function createTeamsRouter(db: LocalDb) {
  const router = Router();

  router.get("/tournaments/:tournamentId/teams", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const serializer: (t: typeof teamsTable.$inferSelect) => Record<string, unknown> =
      isLocalOrganizer(req, tid) ? teamToJson : teamToPublicJson;
    const rows = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid));
    res.json(rows.map(serializer));
  });

  // Scout endpoint — purse/squad data + unsold players (owner-app scout screen).
  router.get("/tournaments/:tournamentId/teams/scout", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

    const [tournamentRow, teams, allPlayers, categories] = await Promise.all([
      db.select({
        minimumSquadSize: tournamentsTable.minimumSquadSize,
        maximumSquadSize: tournamentsTable.maximumSquadSize,
        minBid: tournamentsTable.minBid,
      }).from(tournamentsTable).where(eq(tournamentsTable.id, tid)).then(([t]) => t),
      db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid)),
      db.select({
        id: playersTable.id,
        name: playersTable.name,
        role: playersTable.role,
        status: playersTable.status,
        teamId: playersTable.teamId,
        categoryId: playersTable.categoryId,
        basePrice: playersTable.basePrice,
        soldPrice: playersTable.soldPrice,
      }).from(playersTable).where(eq(playersTable.tournamentId, tid)),
      db.select({
        id: categoriesTable.id,
        name: categoriesTable.name,
        colorCode: categoriesTable.colorCode,
        sortOrder: categoriesTable.sortOrder,
      }).from(categoriesTable).where(eq(categoriesTable.tournamentId, tid)),
    ]);

    const boosterTotals = await getActiveBoosterTotalsForTeams(db, tid, teams.map((t) => t.id));
    const catMap = new Map(categories.map((c) => [c.id, c]));
    const purseOpts = {
      minimumSquadSize: tournamentRow?.minimumSquadSize ?? 0,
      maximumSquadSize: tournamentRow?.maximumSquadSize ?? 0,
      minBid: tournamentRow?.minBid ?? 0,
    };

    const scoutTeams = teams.map((team) => {
      const p = computeScoutPurseProtection(
        team,
        boosterTotals.get(team.id) ?? 0,
        allPlayers,
        team.id,
        purseOpts,
      );
      const squadPlayers = allPlayers.filter(
        (pl) => pl.teamId === team.id && (pl.status === "sold" || pl.status === "retained"),
      );
      const playersBought = squadPlayers.filter((pl) => pl.status === "sold").length;
      const maxBidCapacity = p.slotsRequired > 0
        ? Math.floor(p.spendablePurse / p.slotsRequired)
        : p.spendablePurse;
      return {
        id: team.id,
        name: team.name,
        shortCode: team.shortCode,
        color: team.color,
        logoUrl: team.logoUrl,
        originalPurse: p.originalPurse,
        boosterTotal: p.boosterTotal,
        effectiveCapacity: p.effectiveCapacity,
        purse: p.effectiveCapacity,
        purseRemaining: p.purseRemaining,
        reservePurse: p.reservePurse,
        spendablePurse: p.spendablePurse,
        slotsRequired: p.slotsRequired,
        playersBought,
        maximumSquadSize: p.maximumSquadSize,
        maxBidCapacity,
        players: squadPlayers.map((pl) => ({
          id: pl.id,
          name: pl.name,
          role: pl.role,
          status: pl.status,
          soldPrice: pl.soldPrice,
        })),
      };
    });

    const unsoldPlayers = allPlayers
      .filter((pl) => pl.status === "unsold")
      .map((pl) => {
        const cat = pl.categoryId ? catMap.get(pl.categoryId) : null;
        return {
          id: pl.id,
          name: pl.name,
          role: pl.role,
          basePrice: pl.basePrice,
          categoryId: pl.categoryId ?? null,
          categoryName: cat?.name ?? null,
          categoryColor: cat?.colorCode ?? null,
          _sort: (cat?.sortOrder ?? 999) * 1e9 + pl.name.charCodeAt(0),
        };
      })
      .sort((a, b) => a._sort - b._sort || a.name.localeCompare(b.name))
      .map(({ _sort: _, ...rest }) => rest);

    res.json({ teams: scoutTeams, unsoldPlayers });
  });

  router.post("/tournaments/:tournamentId/teams", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1), shortCode: z.string().min(1), ownerName: z.string().min(1),
      ownerMobile: z.string().optional(), color: z.string().optional(),
      logoUrl: z.string().optional(), purse: z.number().int().optional(),
      accessCode: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const d = parsed.data;
    let ownerMobile: string | null = null;
    if (d.ownerMobile) {
      const mobileParsed = parseIndianMobile(d.ownerMobile);
      if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
      ownerMobile = mobileParsed.normalized;
      const dupMobile = await findDuplicateOwnerMobileTeam(db, tid, ownerMobile);
      if (dupMobile) {
        res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
        return;
      }
    }
    const [tournament] = await db.select({ basePurse: tournamentsTable.basePurse }).from(tournamentsTable).where(eq(tournamentsTable.id, tid)).limit(1);
    const [row] = await db.insert(teamsTable).values({
      tournamentId: tid, name: d.name, shortCode: d.shortCode, ownerName: d.ownerName,
      ownerMobile, color: d.color ?? "#3B82F6",
      logoUrl: d.logoUrl ?? null, purse: d.purse ?? tournament?.basePurse ?? 10000000, accessCode: d.accessCode ?? null,
    }).returning();
    res.status(201).json(teamToJson(row));
  });

  router.get("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const [row] = await db.select().from(teamsTable).where(
      and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid))
    );
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(isLocalOrganizer(req, tid) ? teamToJson(row) : teamToPublicJson(row));
  });

  router.post("/tournaments/:tournamentId/teams/:teamId/verify-access", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const body = z.object({ code: z.string() }).safeParse(req.body);
    if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const [team] = await db
      .select()
      .from(teamsTable)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
    if (!team) { res.status(404).json({ error: "Not found" }); return; }
    const valid = !team.accessCode || team.accessCode.toUpperCase() === body.data.code.toUpperCase();
    res.json({ valid });
  });

  router.patch("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    const schema = z.object({
      name: z.string().min(1).max(120).optional(),
      shortCode: z.string().min(1).max(10).optional(),
      ownerName: z.string().min(1).max(120).optional(),
      ownerMobile: z.string().max(20).nullable().optional(),
      color: z.string().max(20).optional(),
      logoUrl: localMediaUrlSchema,
      purse: z.number().int().min(0).optional(),
      purseUsed: z.number().int().min(0).optional(),
      isBiddingEnabled: z.boolean().optional(),
      accessCode: z.string().max(20).nullable().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: zodFirstError(parsed.error) }); return; }
    const d = parsed.data;
    if (Object.keys(d).length === 0) { res.status(400).json({ error: "No fields to update" }); return; }
    const patch = { ...d };
    if (d.ownerMobile !== undefined && d.ownerMobile !== null) {
      const mobileParsed = parseIndianMobile(d.ownerMobile);
      if (!mobileParsed.ok) { res.status(400).json({ error: mobileParsed.error }); return; }
      patch.ownerMobile = mobileParsed.normalized;
      const dupMobile = await findDuplicateOwnerMobileTeam(db, tid, mobileParsed.normalized, teamId);
      if (dupMobile) {
        res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
        return;
      }
    }
    const [row] = await db.update(teamsTable).set({ ...patch, updatedAt: new Date().toISOString() })
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid))).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(teamToJson(row));
  });

  router.delete("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
    const tid = parseInt(req.params.tournamentId);
    const teamId = parseInt(req.params.teamId);
    if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
    await db.delete(teamsTable).where(
      and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid))
    );
    res.status(204).send();
  });

  return router;
}
