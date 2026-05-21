import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { displayAuctionsTable, tournamentsTable } from "@workspace/db/schema";
import { eq, desc, asc } from "drizzle-orm";

const router = Router();

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireMasterAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.jwtUser.isAdmin && req.jwtUser.adminLevel === "master") { next(); return; }
  res.status(403).json({ error: "Master admin access required" });
}

// ─── Public: list show_on_landing entries ─────────────────────────────────────

router.get("/display-auctions", async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(displayAuctionsTable)
      .where(eq(displayAuctionsTable.showOnLanding, true))
      .orderBy(asc(displayAuctionsTable.scheduledDate), asc(displayAuctionsTable.scheduledTime));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "display-auctions list failed");
    res.status(500).json({ error: "Failed to fetch display auctions" });
  }
});

// ─── Admin: list all ──────────────────────────────────────────────────────────

router.get("/auth/admin/display-auctions", requireMasterAdmin, async (req, res) => {
  try {
    const rows = await db
      .select()
      .from(displayAuctionsTable)
      .orderBy(desc(displayAuctionsTable.scheduledDate), desc(displayAuctionsTable.scheduledTime));
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "admin display-auctions list failed");
    res.status(500).json({ error: "Failed to fetch display auctions" });
  }
});

// ─── Admin: create ────────────────────────────────────────────────────────────

router.post("/auth/admin/display-auctions", requireMasterAdmin, async (req, res) => {
  const {
    name, code, sport, city, state, purse, playersPerTeam, teamsCount,
    scheduledDate, scheduledTime, primaryColor, accentColor, status, showOnLanding, tournamentId,
  } = req.body as Record<string, unknown>;
  if (!name || typeof name !== "string") {
    res.status(400).json({ error: "name is required" });
    return;
  }
  try {
    const [row] = await db.insert(displayAuctionsTable).values({
      name: String(name),
      code: code ? String(code) : "",
      sport: sport ? String(sport) : "cricket",
      city: city ? String(city) : "",
      state: state ? String(state) : "",
      purse: typeof purse === "number" ? purse : Number(purse) || 1000000,
      playersPerTeam: typeof playersPerTeam === "number" ? playersPerTeam : Number(playersPerTeam) || 11,
      teamsCount: typeof teamsCount === "number" ? teamsCount : Number(teamsCount) || 8,
      scheduledDate: scheduledDate ? String(scheduledDate) : "",
      scheduledTime: scheduledTime ? String(scheduledTime) : "00:00",
      primaryColor: primaryColor ? String(primaryColor) : "#1a3a6b",
      accentColor: accentColor ? String(accentColor) : "#f5c842",
      status: status === "completed" ? "completed" : "upcoming",
      showOnLanding: showOnLanding === false ? false : true,
      tournamentId: tournamentId ? Number(tournamentId) : null,
    }).returning();
    res.status(201).json(row);
  } catch (err) {
    req.log.error({ err }, "admin display-auctions create failed");
    res.status(500).json({ error: "Failed to create display auction" });
  }
});

// ─── Admin: update ────────────────────────────────────────────────────────────

router.put("/auth/admin/display-auctions/:id", requireMasterAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  const {
    name, code, sport, city, state, purse, playersPerTeam, teamsCount,
    scheduledDate, scheduledTime, primaryColor, accentColor, status, showOnLanding,
  } = req.body as Record<string, unknown>;
  try {
    const [row] = await db.update(displayAuctionsTable).set({
      ...(name !== undefined && { name: String(name) }),
      ...(code !== undefined && { code: String(code) }),
      ...(sport !== undefined && { sport: String(sport) }),
      ...(city !== undefined && { city: String(city) }),
      ...(state !== undefined && { state: String(state) }),
      ...(purse !== undefined && { purse: Number(purse) }),
      ...(playersPerTeam !== undefined && { playersPerTeam: Number(playersPerTeam) }),
      ...(teamsCount !== undefined && { teamsCount: Number(teamsCount) }),
      ...(scheduledDate !== undefined && { scheduledDate: String(scheduledDate) }),
      ...(scheduledTime !== undefined && { scheduledTime: String(scheduledTime) }),
      ...(primaryColor !== undefined && { primaryColor: String(primaryColor) }),
      ...(accentColor !== undefined && { accentColor: String(accentColor) }),
      ...(status !== undefined && { status: status === "completed" ? "completed" : "upcoming" }),
      ...(showOnLanding !== undefined && { showOnLanding: Boolean(showOnLanding) }),
    }).where(eq(displayAuctionsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(row);
  } catch (err) {
    req.log.error({ err }, "admin display-auctions update failed");
    res.status(500).json({ error: "Failed to update display auction" });
  }
});

// ─── Admin: delete ────────────────────────────────────────────────────────────

router.delete("/auth/admin/display-auctions/:id", requireMasterAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    await db.delete(displayAuctionsTable).where(eq(displayAuctionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin display-auctions delete failed");
    res.status(500).json({ error: "Failed to delete display auction" });
  }
});

// ─── Admin: seed from static data + real tournaments ─────────────────────────

router.post("/auth/admin/display-auctions/seed", requireMasterAdmin, async (req, res) => {
  const STATIC_AUCTIONS = [
    { name: "Lucknow Premier League Season 4", code: "LPL", sport: "cricket", city: "Lucknow", state: "Uttar Pradesh", purse: 3000000, playersPerTeam: 14, teamsCount: 12, scheduledDate: "2026-06-05", scheduledTime: "18:00", primaryColor: "#1a3a6b", accentColor: "#f5c842" },
    { name: "Kashi Cricket Cup 2026", code: "KCC", sport: "cricket", city: "Varanasi", state: "Uttar Pradesh", purse: 2000000, playersPerTeam: 11, teamsCount: 10, scheduledDate: "2026-06-12", scheduledTime: "17:30", primaryColor: "#7b1a1a", accentColor: "#f97316" },
    { name: "Agra Kings Premier League", code: "AKPL", sport: "cricket", city: "Agra", state: "Uttar Pradesh", purse: 2500000, playersPerTeam: 13, teamsCount: 8, scheduledDate: "2026-06-15", scheduledTime: "19:00", primaryColor: "#1a4d2e", accentColor: "#22c55e" },
    { name: "Prayagraj Champions Trophy", code: "PCT", sport: "cricket", city: "Prayagraj", state: "Uttar Pradesh", purse: 1500000, playersPerTeam: 11, teamsCount: 8, scheduledDate: "2026-06-20", scheduledTime: "15:00", primaryColor: "#2d1a6b", accentColor: "#a78bfa" },
    { name: "Mathura Warriors Super League", code: "MWSL", sport: "football", city: "Mathura", state: "Uttar Pradesh", purse: 1800000, playersPerTeam: 16, teamsCount: 10, scheduledDate: "2026-06-22", scheduledTime: "20:00", primaryColor: "#1a3a3a", accentColor: "#06b6d4" },
    { name: "Meerut Premier Cricket League", code: "MPCL", sport: "cricket", city: "Meerut", state: "Uttar Pradesh", purse: 1200000, playersPerTeam: 12, teamsCount: 8, scheduledDate: "2026-06-28", scheduledTime: "16:00", primaryColor: "#4a1a1a", accentColor: "#fb7185" },
    { name: "Noida Super League Season 2", code: "NSL", sport: "cricket", city: "Noida", state: "Uttar Pradesh", purse: 3500000, playersPerTeam: 14, teamsCount: 14, scheduledDate: "2026-07-05", scheduledTime: "18:30", primaryColor: "#1a2a4a", accentColor: "#38bdf8" },
    { name: "Ghaziabad Cricket Federation Cup", code: "GCFC", sport: "cricket", city: "Ghaziabad", state: "Uttar Pradesh", purse: 1000000, playersPerTeam: 11, teamsCount: 8, scheduledDate: "2026-07-10", scheduledTime: "17:00", primaryColor: "#1a3a1a", accentColor: "#84cc16" },
    { name: "Bareilly Premier League", code: "BPL", sport: "cricket", city: "Bareilly", state: "Uttar Pradesh", purse: 2000000, playersPerTeam: 12, teamsCount: 10, scheduledDate: "2026-07-15", scheduledTime: "19:30", primaryColor: "#3a1a4a", accentColor: "#e879f9" },
    { name: "Gorakhpur T20 Super Series", code: "GTSS", sport: "cricket", city: "Gorakhpur", state: "Uttar Pradesh", purse: 1500000, playersPerTeam: 11, teamsCount: 8, scheduledDate: "2026-07-18", scheduledTime: "16:30", primaryColor: "#2a1a0a", accentColor: "#fb923c" },
    { name: "Aligarh Kabaddi Mahotsav 2026", code: "AKM", sport: "kabaddi", city: "Aligarh", state: "Uttar Pradesh", purse: 800000, playersPerTeam: 12, teamsCount: 8, scheduledDate: "2026-07-22", scheduledTime: "14:00", primaryColor: "#0a2a3a", accentColor: "#14b8a6" },
    { name: "Jhansi Warriors Cricket League", code: "JWCL", sport: "cricket", city: "Jhansi", state: "Uttar Pradesh", purse: 1200000, playersPerTeam: 11, teamsCount: 8, scheduledDate: "2026-07-26", scheduledTime: "18:00", primaryColor: "#1a0a2a", accentColor: "#c084fc" },
    { name: "Kanpur Premier League Season 5", code: "KPL", sport: "cricket", city: "Kanpur", state: "Uttar Pradesh", purse: 4000000, playersPerTeam: 15, teamsCount: 14, scheduledDate: "2026-08-02", scheduledTime: "19:00", primaryColor: "#1a1a0a", accentColor: "#eab308" },
    { name: "Moradabad Box Cricket League", code: "MBCL", sport: "cricket", city: "Moradabad", state: "Uttar Pradesh", purse: 800000, playersPerTeam: 10, teamsCount: 8, scheduledDate: "2026-08-08", scheduledTime: "17:00", primaryColor: "#0a1a2a", accentColor: "#60a5fa" },
    { name: "Firozabad Cricket Cup Season 2", code: "FCC", sport: "cricket", city: "Firozabad", state: "Uttar Pradesh", purse: 1000000, playersPerTeam: 11, teamsCount: 8, scheduledDate: "2026-08-14", scheduledTime: "16:00", primaryColor: "#1a2a1a", accentColor: "#4ade80" },
  ];

  try {
    const existing = await db.select().from(displayAuctionsTable);
    const existingNames = new Set(existing.map(r => r.name.toLowerCase()));
    const existingTournamentIds = new Set(existing.map(r => r.tournamentId).filter(Boolean));

    const staticToInsert = STATIC_AUCTIONS.filter(a => !existingNames.has(a.name.toLowerCase()));

    const realTournaments = await db.select({
      id: tournamentsTable.id,
      name: tournamentsTable.name,
      sport: tournamentsTable.sport,
      venue: tournamentsTable.venue,
      auctionDate: tournamentsTable.auctionDate,
      auctionTime: tournamentsTable.auctionTime,
      basePurse: tournamentsTable.basePurse,
      status: tournamentsTable.status,
    }).from(tournamentsTable).orderBy(desc(tournamentsTable.createdAt));

    const realToInsert = realTournaments
      .filter(t => !existingTournamentIds.has(t.id) && !existingNames.has(t.name.toLowerCase()))
      .map(t => ({
        name: t.name,
        code: t.name.split(" ").map((w: string) => w[0] ?? "").join("").slice(0, 4).toUpperCase(),
        sport: t.sport || "cricket",
        city: t.venue ? t.venue.split(",")[0].trim() : "",
        state: t.venue && t.venue.includes(",") ? t.venue.split(",").slice(-1)[0].trim() : "",
        purse: t.basePurse || 1000000,
        playersPerTeam: 11,
        teamsCount: 8,
        scheduledDate: t.auctionDate || "",
        scheduledTime: t.auctionTime || "00:00",
        primaryColor: "#1a3a6b",
        accentColor: "#f5c842",
        status: t.status === "completed" ? "completed" : "upcoming",
        showOnLanding: false,
        tournamentId: t.id,
      }));

    const allToInsert = [
      ...staticToInsert.map(a => ({ ...a, status: "upcoming" as const, showOnLanding: true })),
      ...realToInsert,
    ];

    if (allToInsert.length > 0) {
      await db.insert(displayAuctionsTable).values(allToInsert);
    }

    res.json({ seeded: allToInsert.length, static: staticToInsert.length, real: realToInsert.length });
  } catch (err) {
    req.log.error({ err }, "display-auctions seed failed");
    res.status(500).json({ error: "Seed failed" });
  }
});

export default router;
