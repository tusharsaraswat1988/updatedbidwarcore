import { Router } from "express";
import { isOrganizerOrAdmin } from "../middleware/require-organizer";
import { db } from "@workspace/db";
import { teamsTable, tournamentsTable, organizersTable, playersTable, categoriesTable } from "@workspace/db";
import { eq, and, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";
import { computeAllTeamPurseProtections } from "../lib/purse-protection";
import { ownerJoinPath } from "@workspace/api-base/owner-urls";
import { buildPublicUrl } from "../lib/runtime-env";

const cloudinaryLogoUrl = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.startsWith("https://res.cloudinary.com/"),
    "Logo URL must be a Cloudinary HTTPS URL (https://res.cloudinary.com/...)",
  );

const router = Router();

function genAccessCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

const DUPLICATE_OWNER_MOBILE_ERROR =
  "This mobile number is already assigned to another team in this tournament.";

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === "23505";
}

async function findDuplicateOwnerMobileTeam(
  tournamentId: number,
  ownerMobile: string,
  excludeTeamId?: number,
) {
  const conditions = [
    eq(teamsTable.tournamentId, tournamentId),
    eq(teamsTable.ownerMobile, ownerMobile),
  ];
  if (excludeTeamId !== undefined) {
    conditions.push(ne(teamsTable.id, excludeTeamId));
  }
  const [existing] = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(and(...conditions));
  return existing;
}

const teamToJson = (t: typeof teamsTable.$inferSelect) => ({
  id: t.id,
  tournamentId: t.tournamentId,
  name: t.name,
  shortCode: t.shortCode,
  ownerName: t.ownerName,
  ownerMobile: t.ownerMobile,
  color: t.color,
  logoUrl: t.logoUrl,
  purse: t.purse,
  purseUsed: t.purseUsed,
  isBiddingEnabled: t.isBiddingEnabled,
  accessCode: t.accessCode,
  createdAt: t.createdAt.toISOString(),
});

// Public serializer: omits accessCode and ownerMobile entirely (not set to null).
// Adds requiresAccessCode boolean so the owner-app access gate can work without
// exposing the actual code value.
const teamToPublicJson = (t: typeof teamsTable.$inferSelect) => ({
  id: t.id,
  tournamentId: t.tournamentId,
  name: t.name,
  shortCode: t.shortCode,
  ownerName: t.ownerName,
  color: t.color,
  logoUrl: t.logoUrl,
  purse: t.purse,
  purseUsed: t.purseUsed,
  isBiddingEnabled: t.isBiddingEnabled,
  requiresAccessCode: !!t.accessCode,
  createdAt: t.createdAt.toISOString(),
});

router.get("/tournaments/:tournamentId/teams", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const tidStr = String(tid);
  const isOrganizer = !!(req.jwtUser?.isAdmin || req.jwtUser?.organizerAccountId || req.jwtUser?.organizer?.[tidStr]);
  const serializer: (t: typeof teamsTable.$inferSelect) => Record<string, unknown> =
    isOrganizer ? teamToJson : teamToPublicJson;
  const teams = await db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tid))
    .orderBy(teamsTable.createdAt);
  res.json(teams.map(serializer));
});

router.post("/tournaments/:tournamentId/teams", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const schema = z.object({
    name: z.string().min(1),
    shortCode: z.string().min(1).max(5),
    ownerName: z.string().min(1),
    ownerMobile: z.string().min(1, "Owner mobile is required for communication features"),
    color: z.string().optional(),
    logoUrl: cloudinaryLogoUrl,
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;

  const existing = await db.select().from(teamsTable).where(and(eq(teamsTable.tournamentId, tid), eq(teamsTable.shortCode, d.shortCode.toUpperCase())));
  if (existing.length > 0) { res.status(400).json({ error: `Short code "${d.shortCode.toUpperCase()}" is already used by another team` }); return; }

  // Duplicate team name check (case-insensitive) within the same tournament
  const [dupName] = await db
    .select({ id: teamsTable.id })
    .from(teamsTable)
    .where(and(eq(teamsTable.tournamentId, tid), sql`lower(${teamsTable.name}) = lower(${d.name})`));
  if (dupName) { res.status(400).json({ error: `A team named "${d.name}" is already registered in this tournament.` }); return; }

  // Block organizer from using their own mobile as team owner mobile
  const orgAccountId = req.jwtUser?.organizerAccountId;
  if (orgAccountId) {
    const [org] = await db.select({ mobile: organizersTable.mobile }).from(organizersTable).where(eq(organizersTable.id, orgAccountId));
    if (org?.mobile && org.mobile === d.ownerMobile) {
      res.status(400).json({ error: "You cannot use the organizer's own mobile number as a team owner mobile." }); return;
    }
  }

  const dupMobile = await findDuplicateOwnerMobileTeam(tid, d.ownerMobile);
  if (dupMobile) {
    res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  let team: typeof teamsTable.$inferSelect;
  try {
    [team] = await db
      .insert(teamsTable)
      .values({
        tournamentId: tid,
        name: d.name,
        shortCode: d.shortCode.toUpperCase(),
        ownerName: d.ownerName,
        ownerMobile: d.ownerMobile ?? null,
        color: d.color ?? "#3B82F6",
        logoUrl: d.logoUrl ?? null,
        purse: tournament.basePurse,
        purseUsed: 0,
        isBiddingEnabled: true,
        accessCode: genAccessCode(),
      })
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
      return;
    }
    throw err;
  }

  // DLT SMS: notify team owner about their access code (fire-and-forget, live tournaments only)
  const ownerMobile = team.ownerMobile;
  const accessCode = team.accessCode;
  if (tournament.licenseStatus === "active" && ownerMobile && accessCode) {
    void (async () => {
      try {
        const { smsNotificationSettingsTable } = await import("@workspace/db");
        const { sendDltSms, teamOwnerTemplateId } = await import("../lib/fast2sms");
        const [settings] = await db.select().from(smsNotificationSettingsTable).limit(1);
        const templateId = teamOwnerTemplateId() || settings?.teamOwnerTemplateId;
        if (settings?.dltEnabled && settings.teamOwnerEnabled && templateId) {
          const ownerUrl = buildPublicUrl(ownerJoinPath(tid, team.id));
          await sendDltSms(
            [ownerMobile],
            templateId,
            [tournament.name, team.name, accessCode, ownerUrl],
          );
        }
      } catch (err) { logger.error({ err, teamId: team.id }, "DLT team-owner SMS failed"); }
    })();
  }

  res.status(201).json(teamToJson(team));
});

// Scout endpoint — returns all teams with purse/squad data + unsold players.
// Must appear before the /:teamId route so "scout" isn't matched as a teamId.
router.get("/tournaments/:tournamentId/teams/scout", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [teams, allPlayers, categories] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid)).orderBy(teamsTable.createdAt),
    db.select({
      id: playersTable.id,
      name: playersTable.name,
      role: playersTable.role,
      status: playersTable.status,
      teamId: playersTable.teamId,
      categoryId: playersTable.categoryId,
      basePrice: playersTable.basePrice,
      soldPrice: playersTable.soldPrice,
      isNonPlayingMember: playersTable.isNonPlayingMember,
    }).from(playersTable).where(eq(playersTable.tournamentId, tid)),
    db.select({ id: categoriesTable.id, name: categoriesTable.name, colorCode: categoriesTable.colorCode, sortOrder: categoriesTable.sortOrder })
      .from(categoriesTable).where(eq(categoriesTable.tournamentId, tid)).orderBy(categoriesTable.sortOrder),
  ]);

  const purseMap = await computeAllTeamPurseProtections(tid, teams.map(t => ({ id: t.id, purse: t.purse, purseUsed: t.purseUsed })));
  const catMap   = new Map(categories.map(c => [c.id, c]));

  const scoutTeams = teams.map(team => {
    const p           = purseMap.get(team.id) ?? { purseRemaining: team.purse - team.purseUsed, reservePurse: 0, spendablePurse: team.purse - team.purseUsed, slotsRequired: 0, maximumSquadSize: 0, lowestBasePrice: 0 };
    const squadPlayers = allPlayers.filter(pl => pl.teamId === team.id && (pl.status === "sold" || pl.status === "retained"));
    const playersBought = squadPlayers.filter(pl => !pl.isNonPlayingMember).length;
    const maxBidCapacity = p.slotsRequired > 0 ? Math.floor(p.spendablePurse / p.slotsRequired) : p.spendablePurse;
    return {
      id: team.id, name: team.name, shortCode: team.shortCode, color: team.color, logoUrl: team.logoUrl,
      purse: team.purse, purseRemaining: p.purseRemaining, reservePurse: p.reservePurse,
      spendablePurse: p.spendablePurse, slotsRequired: p.slotsRequired,
      playersBought, maximumSquadSize: p.maximumSquadSize, maxBidCapacity,
      players: squadPlayers.map(pl => ({ id: pl.id, name: pl.name, role: pl.role, status: pl.status, soldPrice: pl.soldPrice, isNonPlayingMember: pl.isNonPlayingMember })),
    };
  });

  const unsoldPlayers = allPlayers
    .filter(pl => pl.status === "unsold")
    .map(pl => {
      const cat = pl.categoryId ? catMap.get(pl.categoryId) : null;
      return { id: pl.id, name: pl.name, role: pl.role, basePrice: pl.basePrice, categoryId: pl.categoryId ?? null, categoryName: cat?.name ?? null, categoryColor: cat?.colorCode ?? null, _sort: (cat?.sortOrder ?? 999) * 1e9 + pl.name.charCodeAt(0) };
    })
    .sort((a, b) => a._sort - b._sort || a.name.localeCompare(b.name))
    .map(({ _sort: _, ...rest }) => rest);

  res.json({ teams: scoutTeams, unsoldPlayers });
});

// GET single team — organizers get full data; unauthenticated callers get the
// public serializer (no accessCode, no ownerMobile) with requiresAccessCode boolean.
router.get("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  if (!team) { res.status(404).json({ error: "Not found" }); return; }
  const tidStr = String(tid);
  const isOrganizer = !!(req.jwtUser?.isAdmin || req.jwtUser?.organizerAccountId || req.jwtUser?.organizer?.[tidStr]);
  res.json(isOrganizer ? teamToJson(team) : teamToPublicJson(team));
});

router.patch("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  const schema = z.object({
    name: z.string().optional(),
    shortCode: z.string().optional(),
    ownerName: z.string().optional(),
    ownerMobile: z.string().min(1).optional(),
    color: z.string().optional(),
    logoUrl: cloudinaryLogoUrl,
    purse: z.number().int().optional(),
    isBiddingEnabled: z.boolean().optional(),
    regenerateCode: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.shortCode !== undefined) updates.shortCode = d.shortCode;
  if (d.ownerName !== undefined) updates.ownerName = d.ownerName;
  if (d.ownerMobile !== undefined) updates.ownerMobile = d.ownerMobile;
  if (d.color !== undefined) updates.color = d.color;
  if (d.logoUrl !== undefined) updates.logoUrl = d.logoUrl;
  if (d.purse !== undefined) updates.purse = d.purse;
  if (d.isBiddingEnabled !== undefined) updates.isBiddingEnabled = d.isBiddingEnabled;
  if (d.regenerateCode) updates.accessCode = genAccessCode();

  if (d.ownerMobile !== undefined) {
    const orgAccountId = req.jwtUser?.organizerAccountId;
    if (orgAccountId) {
      const [org] = await db.select({ mobile: organizersTable.mobile }).from(organizersTable).where(eq(organizersTable.id, orgAccountId));
      if (org?.mobile && org.mobile === d.ownerMobile) {
        res.status(400).json({ error: "You cannot use the organizer's own mobile number as a team owner mobile." });
        return;
      }
    }

    const dupMobile = await findDuplicateOwnerMobileTeam(tid, d.ownerMobile, teamId);
    if (dupMobile) {
      res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
      return;
    }
  }

  let team: typeof teamsTable.$inferSelect;
  try {
    [team] = await db
      .update(teamsTable)
      .set(updates)
      .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)))
      .returning();
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(400).json({ error: DUPLICATE_OWNER_MOBILE_ERROR });
      return;
    }
    throw err;
  }
  if (!team) { res.status(404).json({ error: "Not found" }); return; }
  res.json(teamToJson(team));
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

router.delete("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, tid)) { res.status(401).json({ error: "Authentication required" }); return; }
  await db.delete(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  res.status(204).send();
});

export default router;
