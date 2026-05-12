import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, organizersTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { timingSafeEqual, scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
    adminLevel?: "master" | "data_entry";
    organizer?: Record<string, true>;
    organizerAccountId?: number;
  }
}

const router = Router();

function safeCompare(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) {
      timingSafeEqual(Buffer.from(a), Buffer.from(a));
      return false;
    }
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    const [salt, key] = hash.split(":");
    if (!salt || !key) return false;
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(derivedKey, Buffer.from(key, "hex"));
  } catch {
    return false;
  }
}

function isMasterAdmin(req: import("express").Request): boolean {
  return !!req.session.isAdmin && req.session.adminLevel === "master";
}

function isAnyAdmin(req: import("express").Request): boolean {
  return !!req.session.isAdmin;
}

const organizerToJson = (o: typeof organizersTable.$inferSelect) => ({
  id: o.id,
  name: o.name,
  email: o.email,
  mobile: o.mobile,
  licenseStatus: o.licenseStatus,
  maxTournaments: o.maxTournaments,
  notes: o.notes,
  createdAt: o.createdAt.toISOString(),
});

// ─── Admin Login ──────────────────────────────────────────────────────────────

router.post("/auth/admin/login", (req, res) => {
  const masterPw = process.env.ADMIN_PASSWORD;
  const dataPw = process.env.ADMIN_DATA_PASSWORD;

  if (!masterPw && !dataPw) {
    res.status(503).json({ error: "Admin login not configured. Set ADMIN_PASSWORD or ADMIN_DATA_PASSWORD." });
    return;
  }

  const body = z.object({ password: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { password } = body.data;

  if (masterPw && safeCompare(password, masterPw)) {
    req.session.isAdmin = true;
    req.session.adminLevel = "master";
    if (!req.session.organizer) req.session.organizer = {};
    res.json({ success: true, adminLevel: "master" });
    return;
  }

  if (dataPw && safeCompare(password, dataPw)) {
    req.session.isAdmin = true;
    req.session.adminLevel = "data_entry";
    if (!req.session.organizer) req.session.organizer = {};
    res.json({ success: true, adminLevel: "data_entry" });
    return;
  }

  res.status(401).json({ error: "Incorrect password" });
});

router.post("/auth/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get("/auth/admin/me", (req, res) => {
  if (!req.session.isAdmin) {
    res.json({ isAdmin: false, adminLevel: null });
    return;
  }
  res.json({ isAdmin: true, adminLevel: req.session.adminLevel ?? "master" });
});

// ─── Organizer (per tournament) ───────────────────────────────────────────────

router.post("/auth/organizer/:tournamentId/login", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = z.object({ password: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const masterPw = process.env.ADMIN_PASSWORD;
  const dataPw = process.env.ADMIN_DATA_PASSWORD;

  if (masterPw && safeCompare(body.data.password, masterPw)) {
    req.session.isAdmin = true;
    req.session.adminLevel = "master";
    if (!req.session.organizer) req.session.organizer = {};
    req.session.organizer[String(tid)] = true;
    res.json({ success: true });
    return;
  }

  if (dataPw && safeCompare(body.data.password, dataPw)) {
    req.session.isAdmin = true;
    req.session.adminLevel = "data_entry";
    if (!req.session.organizer) req.session.organizer = {};
    req.session.organizer[String(tid)] = true;
    res.json({ success: true });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }
  if (!tournament.organizerPassword) {
    res.status(403).json({ error: "No password set for this tournament. Ask the admin to configure one." });
    return;
  }
  if (!safeCompare(body.data.password, tournament.organizerPassword)) {
    res.status(401).json({ error: "Incorrect password" });
    return;
  }
  if (!req.session.organizer) req.session.organizer = {};
  req.session.organizer[String(tid)] = true;
  res.json({ success: true });
});

router.post("/auth/organizer/:tournamentId/logout", (req, res) => {
  const tid = req.params.tournamentId;
  if (req.session.organizer) delete req.session.organizer[tid];
  if (req.session.isAdmin) req.session.isAdmin = undefined;
  res.json({ success: true });
});

router.get("/auth/organizer/:tournamentId/me", (req, res) => {
  const tid = req.params.tournamentId;
  const isOrganizer = !!(req.session.isAdmin || (req.session.organizer && req.session.organizer[tid]));
  res.json({ isOrganizer });
});

// ─── Set organizer password (admin or existing organizer) ─────────────────────

router.patch("/auth/organizer/:tournamentId/password", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const tidStr = String(tid);
  const isOrganizer = !!(req.session.isAdmin || (req.session.organizer && req.session.organizer[tidStr]));
  if (!isOrganizer) { res.status(401).json({ error: "Not authorised" }); return; }
  const body = z.object({ password: z.string().min(4) }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Password must be at least 4 characters" }); return; }
  await db.update(tournamentsTable).set({ organizerPassword: body.data.password }).where(eq(tournamentsTable.id, tid));
  res.json({ success: true });
});

// ─── Admin: List all tournaments ──────────────────────────────────────────────

router.get("/auth/admin/tournaments", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tournaments = await db.select().from(tournamentsTable).orderBy(tournamentsTable.createdAt);
  res.json(tournaments.map(t => ({
    id: t.id,
    name: t.name,
    sport: t.sport,
    status: t.status,
    licenseStatus: t.licenseStatus,
    adminLocked: t.adminLocked,
    organizerId: t.organizerId,
    organizerName: t.organizerName,
    organizerMobile: t.organizerMobile,
    organizerEmail: t.organizerEmail,
    hasPassword: !!t.organizerPassword,
    createdAt: t.createdAt.toISOString(),
  })));
});

// ─── Admin: Create tournament ─────────────────────────────────────────────────

router.post("/auth/admin/tournaments", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const schema = z.object({
    name: z.string().min(1),
    sport: z.string().default("cricket"),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    organizerId: z.number().int().optional(),
    organizerName: z.string().optional(),
    organizerMobile: z.string().optional(),
    organizerEmail: z.string().optional(),
    organizerPassword: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    timerSeconds: z.number().int().optional(),
    bidTimerSeconds: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const [t] = await db.insert(tournamentsTable).values({
    name: d.name,
    sport: d.sport,
    venue: d.venue,
    auctionDate: d.auctionDate,
    organizerId: d.organizerId ?? null,
    organizerName: d.organizerName,
    organizerMobile: d.organizerMobile,
    organizerEmail: d.organizerEmail,
    organizerPassword: d.organizerPassword,
    basePurse: d.basePurse ?? 10000000,
    minBid: d.minBid ?? 100000,
    timerSeconds: d.timerSeconds ?? 30,
    bidTimerSeconds: d.bidTimerSeconds ?? 15,
  }).returning();
  res.json({ success: true, id: t.id });
});

// ─── Admin: Delete tournament ─────────────────────────────────────────────────

router.delete("/auth/admin/tournaments/:tournamentId", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const { teamsTable, playersTable, bidsTable, auctionSessionsTable, categoriesTable } = await import("@workspace/db");
  await db.delete(bidsTable).where(eq(bidsTable.tournamentId, tid));
  await db.delete(auctionSessionsTable).where(eq(auctionSessionsTable.tournamentId, tid));
  await db.delete(playersTable).where(eq(playersTable.tournamentId, tid));
  await db.delete(teamsTable).where(eq(teamsTable.tournamentId, tid));
  await db.delete(categoriesTable).where(eq(categoriesTable.tournamentId, tid));
  const [deleted] = await db.delete(tournamentsTable).where(eq(tournamentsTable.id, tid)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

// ─── Admin: Grant license (master only) ───────────────────────────────────────

router.post("/auth/admin/tournaments/:tournamentId/grant-license", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Only the master admin can grant licenses" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [t] = await db.update(tournamentsTable)
    .set({ licenseStatus: "live", licenseGrantedAt: new Date(), licenseGrantedBy: "master" })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

// ─── Admin: Revoke license (master only) ──────────────────────────────────────

router.post("/auth/admin/tournaments/:tournamentId/revoke-license", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Only the master admin can revoke licenses" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [t] = await db.update(tournamentsTable)
    .set({ licenseStatus: "trial", licenseGrantedAt: null, licenseGrantedBy: null })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

// ─── Admin: Lock / Unlock ─────────────────────────────────────────────────────

router.post("/auth/admin/tournaments/:tournamentId/lock", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [t] = await db.update(tournamentsTable)
    .set({ adminLocked: true, adminLockedAt: new Date(), status: "completed" })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

router.post("/auth/admin/tournaments/:tournamentId/unlock", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [t] = await db.update(tournamentsTable)
    .set({ adminLocked: false, adminLockedAt: null })
    .where(eq(tournamentsTable.id, tid))
    .returning();
  if (!t) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

// ─── Admin: Full tournament detail ────────────────────────────────────────────

router.get("/auth/admin/tournaments/:tournamentId/detail", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { teamsTable, playersTable, bidsTable, categoriesTable } = await import("@workspace/db");

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid));
  const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, tid));
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, tid));

  const { desc } = await import("drizzle-orm");
  const recentBids = await db.select().from(bidsTable)
    .where(eq(bidsTable.tournamentId, tid))
    .orderBy(desc(bidsTable.timestamp))
    .limit(50);

  const bidDetails = await Promise.all(recentBids.map(async bid => {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, bid.playerId));
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, bid.teamId));
    return {
      id: bid.id,
      amount: bid.amount,
      timestamp: bid.timestamp.toISOString(),
      playerName: player?.name ?? null,
      teamName: team?.name ?? null,
      teamColor: team?.color ?? null,
    };
  }));

  res.json({
    tournament: {
      id: tournament.id,
      name: tournament.name,
      sport: tournament.sport,
      venue: tournament.venue,
      auctionDate: tournament.auctionDate,
      organizerId: tournament.organizerId,
      organizerName: tournament.organizerName,
      organizerMobile: tournament.organizerMobile,
      organizerEmail: tournament.organizerEmail,
      status: tournament.status,
      licenseStatus: tournament.licenseStatus,
      adminLocked: tournament.adminLocked,
      licenseGrantedAt: tournament.licenseGrantedAt?.toISOString() ?? null,
      adminLockedAt: tournament.adminLockedAt?.toISOString() ?? null,
      basePurse: tournament.basePurse,
      minBid: tournament.minBid,
      timerSeconds: tournament.timerSeconds,
      bidTimerSeconds: tournament.bidTimerSeconds,
      playerSelectionMode: tournament.playerSelectionMode,
      bidTiers: tournament.bidTiers,
      hasPassword: !!tournament.organizerPassword,
      createdAt: tournament.createdAt.toISOString(),
    },
    teams: teams.map(t => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      ownerName: t.ownerName,
      color: t.color,
      logoUrl: t.logoUrl,
      purse: t.purse,
      purseUsed: t.purseUsed,
    })),
    players: players.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      status: p.status,
      basePrice: p.basePrice,
      soldPrice: p.soldPrice,
      teamId: p.teamId,
      categoryId: p.categoryId,
    })),
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      minBid: c.minBid,
    })),
    playerCounts: {
      total: players.length,
      available: players.filter(p => p.status === "available").length,
      sold: players.filter(p => p.status === "sold").length,
      unsold: players.filter(p => p.status === "unsold").length,
      retained: players.filter(p => (p.status as string) === "retained").length,
    },
    recentBids: bidDetails,
  });
});

// ─── Admin: Update tournament ─────────────────────────────────────────────────

router.patch("/auth/admin/tournaments/:tournamentId", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    name: z.string().optional(),
    sport: z.string().optional(),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    organizerId: z.number().int().nullable().optional(),
    organizerName: z.string().optional(),
    organizerMobile: z.string().optional(),
    organizerEmail: z.string().optional(),
    organizerPassword: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    bidTimerSeconds: z.number().int().optional(),
    timerSeconds: z.number().int().optional(),
    playerSelectionMode: z.string().optional(),
    status: z.string().optional(),
    bidTiers: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.sport !== undefined) updates.sport = d.sport;
  if (d.organizerId !== undefined) updates.organizerId = d.organizerId;
  if (d.organizerName !== undefined) updates.organizerName = d.organizerName;
  if (d.organizerMobile !== undefined) updates.organizerMobile = d.organizerMobile;
  if (d.organizerEmail !== undefined) updates.organizerEmail = d.organizerEmail;
  if (d.organizerPassword !== undefined) updates.organizerPassword = d.organizerPassword;
  if (d.venue !== undefined) updates.venue = d.venue;
  if (d.auctionDate !== undefined) updates.auctionDate = d.auctionDate;
  if (d.status !== undefined) updates.status = d.status;
  if (d.bidTimerSeconds !== undefined) updates.bidTimerSeconds = d.bidTimerSeconds;
  if (d.timerSeconds !== undefined) updates.timerSeconds = d.timerSeconds;
  if (d.basePurse !== undefined) updates.basePurse = d.basePurse;
  if (d.minBid !== undefined) updates.minBid = d.minBid;
  if (d.playerSelectionMode !== undefined) updates.playerSelectionMode = d.playerSelectionMode;
  if (d.bidTiers !== undefined) updates.bidTiers = d.bidTiers;
  const [tournament] = await db.update(tournamentsTable).set(updates).where(eq(tournamentsTable.id, tid)).returning();
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, id: tournament.id });
});

// ─── Admin: List all organizer accounts ──────────────────────────────────────

router.get("/auth/admin/organizers", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const organizers = await db.select().from(organizersTable).orderBy(organizersTable.createdAt);
  const tournaments = await db.select().from(tournamentsTable);
  const result = organizers.map(o => ({
    ...organizerToJson(o),
    tournamentCount: tournaments.filter(t => t.organizerId === o.id).length,
  }));
  res.json(result);
});

// ─── Admin: Update organizer account ─────────────────────────────────────────

router.patch("/auth/admin/organizers/:id", async (req, res) => {
  if (!isAnyAdmin(req)) { res.status(401).json({ error: "Not authorised" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const schema = z.object({
    name: z.string().optional(),
    email: z.string().optional(),
    mobile: z.string().optional(),
    newPassword: z.string().min(6).optional(),
    licenseStatus: z.enum(["pending", "active", "suspended"]).optional(),
    maxTournaments: z.number().int().min(0).optional(),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;

  const updates: Record<string, unknown> = {};
  if (d.name !== undefined) updates.name = d.name;
  if (d.email !== undefined) updates.email = d.email;
  if (d.mobile !== undefined) updates.mobile = d.mobile;
  if (d.licenseStatus !== undefined) updates.licenseStatus = d.licenseStatus;
  if (d.maxTournaments !== undefined) updates.maxTournaments = d.maxTournaments;
  if (d.notes !== undefined) updates.notes = d.notes;
  if (d.newPassword) updates.passwordHash = await hashPassword(d.newPassword);

  const [updated] = await db.update(organizersTable).set(updates).where(eq(organizersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, organizer: organizerToJson(updated) });
});

// ─── Admin: Delete organizer account ─────────────────────────────────────────

router.delete("/auth/admin/organizers/:id", async (req, res) => {
  if (!isMasterAdmin(req)) { res.status(403).json({ error: "Only the master admin can delete organizer accounts" }); return; }
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  await db.update(tournamentsTable).set({ organizerId: null }).where(eq(tournamentsTable.organizerId, id));
  const [deleted] = await db.delete(organizersTable).where(eq(organizersTable.id, id)).returning();
  if (!deleted) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

// ─── Organizer Account (self-service portal) ──────────────────────────────────

router.post("/auth/organizer-account/signup", async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    mobile: z.string().min(7),
    email: z.string().email().optional(),
    password: z.string().min(6),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Name, mobile number, and password (min 6 chars) are required." }); return; }

  const { name, mobile, email, password } = body.data;

  const mobileExists = await db.select().from(organizersTable).where(eq(organizersTable.mobile, mobile));
  if (mobileExists.length > 0) {
    res.status(409).json({ error: "An account with this mobile number already exists." });
    return;
  }
  if (email) {
    const emailExists = await db.select().from(organizersTable).where(eq(organizersTable.email, email));
    if (emailExists.length > 0) {
      res.status(409).json({ error: "An account with this email already exists." });
      return;
    }
  }

  const passwordHash = await hashPassword(password);
  const [organizer] = await db.insert(organizersTable).values({
    name,
    mobile,
    email: email ?? null,
    passwordHash,
    licenseStatus: "pending",
    maxTournaments: 1,
  }).returning();

  req.session.organizerAccountId = organizer.id;
  if (!req.session.organizer) req.session.organizer = {};

  const myTournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerId, organizer.id));
  for (const t of myTournaments) {
    req.session.organizer[String(t.id)] = true;
  }

  res.json({ success: true, organizer: organizerToJson(organizer) });
});

router.post("/auth/organizer-account/login", async (req, res) => {
  const body = z.object({
    identifier: z.string().min(1),
    password: z.string().min(1),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { identifier, password } = body.data;

  const rows = await db.select().from(organizersTable).where(
    or(eq(organizersTable.mobile, identifier), eq(organizersTable.email, identifier))
  );
  const organizer = rows[0];

  if (!organizer) { res.status(401).json({ error: "No account found with that mobile or email." }); return; }

  const valid = await verifyPassword(password, organizer.passwordHash);
  if (!valid) { res.status(401).json({ error: "Incorrect password." }); return; }

  req.session.organizerAccountId = organizer.id;
  if (!req.session.organizer) req.session.organizer = {};

  const myTournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerId, organizer.id));
  for (const t of myTournaments) {
    req.session.organizer[String(t.id)] = true;
  }

  res.json({ success: true, organizer: organizerToJson(organizer) });
});

router.get("/auth/organizer-account/me", async (req, res) => {
  if (!req.session.organizerAccountId) {
    res.json({ loggedIn: false });
    return;
  }
  const [organizer] = await db.select().from(organizersTable).where(eq(organizersTable.id, req.session.organizerAccountId));
  if (!organizer) {
    req.session.organizerAccountId = undefined;
    res.json({ loggedIn: false });
    return;
  }
  const tournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerId, organizer.id));
  res.json({
    loggedIn: true,
    organizer: organizerToJson(organizer),
    tournaments: tournaments.map(t => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      status: t.status,
      licenseStatus: t.licenseStatus,
      venue: t.venue,
      auctionDate: t.auctionDate,
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

router.post("/auth/organizer-account/logout", (req, res) => {
  req.session.organizerAccountId = undefined;
  res.json({ success: true });
});

// ─── Organizer Account: Create tournament ─────────────────────────────────────

router.post("/auth/organizer-account/tournaments", async (req, res) => {
  if (!req.session.organizerAccountId) {
    res.status(401).json({ error: "Not logged in" });
    return;
  }
  const [organizer] = await db.select().from(organizersTable).where(eq(organizersTable.id, req.session.organizerAccountId));
  if (!organizer) { res.status(401).json({ error: "Account not found" }); return; }

  const myTournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerId, organizer.id));
  if (myTournaments.length >= organizer.maxTournaments) {
    res.status(403).json({
      error: `Your current plan allows up to ${organizer.maxTournaments} tournament(s). Please contact admin to upgrade your license.`,
    });
    return;
  }

  const schema = z.object({
    name: z.string().min(1),
    sport: z.string().default("cricket"),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    organizerPassword: z.string().min(4).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;

  const [tournament] = await db.insert(tournamentsTable).values({
    organizerId: organizer.id,
    name: d.name,
    sport: d.sport,
    venue: d.venue ?? null,
    auctionDate: d.auctionDate ?? null,
    organizerName: organizer.name,
    organizerMobile: organizer.mobile,
    organizerEmail: organizer.email ?? null,
    organizerPassword: d.organizerPassword ?? null,
    basePurse: d.basePurse ?? 10000000,
    minBid: d.minBid ?? 100000,
    timerSeconds: 30,
    bidTimerSeconds: 15,
    licenseStatus: organizer.licenseStatus === "active" ? "live" : "trial",
  }).returning();

  if (!req.session.organizer) req.session.organizer = {};
  req.session.organizer[String(tournament.id)] = true;

  res.status(201).json({ success: true, tournament: { id: tournament.id, name: tournament.name } });
});

export default router;
