import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, tournamentsTable, organizersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

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
// Adds requiresAccessCode boolean so the owner-panel gate can work without
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
  const isOrganizer = !!(req.session?.isAdmin || req.session?.organizerAccountId || req.session?.organizer?.[tidStr]);
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
  const orgAccountId = req.session?.organizerAccountId;
  if (orgAccountId) {
    const [org] = await db.select({ mobile: organizersTable.mobile }).from(organizersTable).where(eq(organizersTable.id, orgAccountId));
    if (org?.mobile && org.mobile === d.ownerMobile) {
      res.status(400).json({ error: "You cannot use the organizer's own mobile number as a team owner mobile." }); return;
    }
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const [team] = await db
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
  res.status(201).json(teamToJson(team));
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
  const isOrganizer = !!(req.session?.isAdmin || req.session?.organizerAccountId || req.session?.organizer?.[tidStr]);
  res.json(isOrganizer ? teamToJson(team) : teamToPublicJson(team));
});

router.patch("/tournaments/:tournamentId/teams/:teamId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const teamId = parseInt(req.params.teamId);
  if (isNaN(tid) || isNaN(teamId)) { res.status(400).json({ error: "Invalid ID" }); return; }
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
  const [team] = await db
    .update(teamsTable)
    .set(updates)
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)))
    .returning();
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
  await db.delete(teamsTable).where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tid)));
  res.status(204).send();
});

export default router;
