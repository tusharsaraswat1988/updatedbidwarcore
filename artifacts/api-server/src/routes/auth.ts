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

// ─── Admin ───────────────────────────────────────────────────────────────────

router.post("/auth/admin/login", (req, res) => {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    res.status(503).json({ error: "Admin login not configured. Set the ADMIN_PASSWORD environment variable." });
    return;
  }
  const body = z.object({ password: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }
  if (!safeCompare(body.data.password, pw)) { res.status(401).json({ error: "Incorrect password" }); return; }
  req.session.isAdmin = true;
  if (!req.session.organizer) req.session.organizer = {};
  res.json({ success: true });
});

router.post("/auth/admin/logout", (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

router.get("/auth/admin/me", (req, res) => {
  res.json({ isAdmin: !!req.session.isAdmin });
});

// ─── Organizer (per tournament) ───────────────────────────────────────────────

router.post("/auth/organizer/:tournamentId/login", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const body = z.object({ password: z.string() }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const adminPw = process.env.ADMIN_PASSWORD;
  if (adminPw && safeCompare(body.data.password, adminPw)) {
    req.session.isAdmin = true;
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

// ─── Organizer Account (portal) ──────────────────────────────────────────────

router.post("/auth/organizer-account/signup", async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    mobile: z.string().min(7),
    password: z.string().min(6),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input. Name, valid email, mobile, and password (min 6 chars) required." }); return; }

  const { name, email, mobile, password } = body.data;

  const existing = await db.select().from(organizersTable).where(
    or(eq(organizersTable.email, email), eq(organizersTable.mobile, mobile))
  );
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email or mobile already exists." });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [organizer] = await db.insert(organizersTable).values({ name, email, mobile, passwordHash }).returning();

  req.session.organizerAccountId = organizer.id;

  const tournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerEmail, email));
  if (!req.session.organizer) req.session.organizer = {};
  for (const t of tournaments) {
    req.session.organizer[String(t.id)] = true;
  }

  res.json({ success: true, organizer: { id: organizer.id, name: organizer.name, email: organizer.email, mobile: organizer.mobile } });
});

router.post("/auth/organizer-account/login", async (req, res) => {
  const body = z.object({
    identifier: z.string().min(1),
    password: z.string().min(1),
  }).safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const { identifier, password } = body.data;

  const [organizer] = await db.select().from(organizersTable).where(
    or(eq(organizersTable.email, identifier), eq(organizersTable.mobile, identifier))
  );

  if (!organizer) { res.status(401).json({ error: "No account found with that email or mobile." }); return; }

  const valid = await verifyPassword(password, organizer.passwordHash);
  if (!valid) { res.status(401).json({ error: "Incorrect password." }); return; }

  req.session.organizerAccountId = organizer.id;

  const tournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerEmail, organizer.email));
  if (!req.session.organizer) req.session.organizer = {};
  for (const t of tournaments) {
    req.session.organizer[String(t.id)] = true;
  }

  res.json({ success: true, organizer: { id: organizer.id, name: organizer.name, email: organizer.email, mobile: organizer.mobile } });
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
  const tournaments = await db.select().from(tournamentsTable).where(eq(tournamentsTable.organizerEmail, organizer.email));
  res.json({
    loggedIn: true,
    organizer: { id: organizer.id, name: organizer.name, email: organizer.email, mobile: organizer.mobile },
    tournaments: tournaments.map(t => ({
      id: t.id,
      name: t.name,
      sport: t.sport,
      status: t.status,
      venue: t.venue,
      auctionDate: t.auctionDate,
    })),
  });
});

router.post("/auth/organizer-account/logout", (req, res) => {
  req.session.organizerAccountId = undefined;
  res.json({ success: true });
});

// ─── List all tournaments (admin only, includes password status + mobile) ──────

router.get("/auth/admin/tournaments", async (req, res) => {
  if (!req.session.isAdmin) { res.status(401).json({ error: "Not authorised" }); return; }
  const tournaments = await db.select().from(tournamentsTable).orderBy(tournamentsTable.createdAt);
  res.json(tournaments.map(t => ({
    id: t.id,
    name: t.name,
    sport: t.sport,
    status: t.status,
    organizerName: t.organizerName,
    organizerMobile: t.organizerMobile,
    organizerEmail: t.organizerEmail,
    hasPassword: !!t.organizerPassword,
    createdAt: t.createdAt.toISOString(),
  })));
});

// ─── Admin: get full tournament detail (teams + players + recent bids) ─────────

router.get("/auth/admin/tournaments/:tournamentId/detail", async (req, res) => {
  if (!req.session.isAdmin) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const { teamsTable, playersTable, bidsTable } = await import("@workspace/db");

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, tid));
  const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, tid));

  const { desc } = await import("drizzle-orm");
  const recentBids = await db.select().from(bidsTable)
    .where(eq(bidsTable.tournamentId, tid))
    .orderBy(desc(bidsTable.timestamp))
    .limit(20);

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
      organizerName: tournament.organizerName,
      organizerMobile: tournament.organizerMobile,
      organizerEmail: tournament.organizerEmail,
      status: tournament.status,
      basePurse: tournament.basePurse,
      timerSeconds: tournament.timerSeconds,
      bidTimerSeconds: tournament.bidTimerSeconds,
    },
    teams: teams.map(t => ({
      id: t.id,
      name: t.name,
      shortCode: t.shortCode,
      ownerName: t.ownerName,
      color: t.color,
      purse: t.purse,
      purseUsed: t.purseUsed,
    })),
    playerCounts: {
      total: players.length,
      available: players.filter(p => p.status === "available").length,
      sold: players.filter(p => p.status === "sold").length,
      unsold: players.filter(p => p.status === "unsold").length,
      retained: players.filter(p => p.status === "retained").length,
    },
    recentBids: bidDetails,
  });
});

// ─── Admin: update tournament ─────────────────────────────────────────────────

router.patch("/auth/admin/tournaments/:tournamentId", async (req, res) => {
  if (!req.session.isAdmin) { res.status(401).json({ error: "Not authorised" }); return; }
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const schema = z.object({
    name: z.string().optional(),
    organizerName: z.string().optional(),
    organizerMobile: z.string().optional(),
    organizerEmail: z.string().optional(),
    organizerPassword: z.string().optional(),
    venue: z.string().optional(),
    status: z.string().optional(),
    bidTimerSeconds: z.number().int().optional(),
    timerSeconds: z.number().int().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.organizerName !== undefined) updates.organizerName = d.organizerName;
  if (d.organizerMobile !== undefined) updates.organizerMobile = d.organizerMobile;
  if (d.organizerEmail !== undefined) updates.organizerEmail = d.organizerEmail;
  if (d.organizerPassword !== undefined) updates.organizerPassword = d.organizerPassword;
  if (d.venue !== undefined) updates.venue = d.venue;
  if (d.status !== undefined) updates.status = d.status;
  if (d.bidTimerSeconds !== undefined) updates.bidTimerSeconds = d.bidTimerSeconds;
  if (d.timerSeconds !== undefined) updates.timerSeconds = d.timerSeconds;
  const [tournament] = await db.update(tournamentsTable).set(updates).where(eq(tournamentsTable.id, tid)).returning();
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true, id: tournament.id });
});

export default router;
