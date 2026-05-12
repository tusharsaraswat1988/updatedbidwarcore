import { Router } from "express";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { timingSafeEqual } from "crypto";

declare module "express-session" {
  interface SessionData {
    isAdmin?: boolean;
    organizer?: Record<string, true>;
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

// ─── List all tournaments (admin only, includes password status) ───────────────

router.get("/auth/admin/tournaments", async (req, res) => {
  if (!req.session.isAdmin) { res.status(401).json({ error: "Not authorised" }); return; }
  const tournaments = await db.select().from(tournamentsTable).orderBy(tournamentsTable.createdAt);
  res.json(tournaments.map(t => ({
    id: t.id,
    name: t.name,
    sport: t.sport,
    status: t.status,
    organizerName: t.organizerName,
    hasPassword: !!t.organizerPassword,
  })));
});

export default router;
