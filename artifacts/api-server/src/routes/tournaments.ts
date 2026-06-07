import { Router } from "express";
import {
  DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
  DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
  DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
  DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
} from "@workspace/api-base/auction-readiness";
import { randomBytes } from "crypto";
import { isOrganizerOrAdmin, isAccountOrAdmin } from "../middleware/require-organizer";
import { db } from "@workspace/db";
import { tournamentsTable, teamsTable, playersTable, categoriesTable, bidsTable, organizersTable } from "@workspace/db";
import { isPlaceholderOrganizerMobile } from "@workspace/api-base/mobile";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { exportLimiter } from "../lib/rate-limiters";
import { broadcastToTournament } from "../lib/broadcast";
import { validateExportToken } from "../lib/export-token";
import { buildPublicUrl, getPublicOrigin } from "../lib/runtime-env";
import { notifyAsync } from "../lib/notifications";

// ─── Auction Code Generation ──────────────────────────────────────────────────
// Format: TT + NN + DDMM
//   TT   = first letter of first two words (or first 2 chars of single word), uppercase
//   NN   = random 2-digit number 10–99
//   DDMM = zero-padded day + month from auctionDate (today if omitted)
function buildAuctionCode(name: string, auctionDate?: string | null): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const tt = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (words[0]?.substring(0, 2) ?? "XX").toUpperCase();
  const nn = String(Math.floor(Math.random() * 90) + 10);
  const d = auctionDate ? new Date(auctionDate) : new Date();
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${tt}${nn}${dd}${mm}`;
}

async function generateUniqueAuctionCode(name: string, auctionDate?: string | null): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const code = buildAuctionCode(name, auctionDate);
    const existing = await db
      .select({ id: tournamentsTable.id })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.auctionCode, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  // Fallback: append random 2-digit suffix to guarantee uniqueness
  return buildAuctionCode(name, auctionDate) + String(Math.floor(Math.random() * 90) + 10);
}

const cloudinaryLogoUrl = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.startsWith("https://res.cloudinary.com/"),
    "Logo URL must be a Cloudinary HTTPS URL (https://res.cloudinary.com/...)",
  );

const router = Router();

const tournamentToJson = (t: typeof tournamentsTable.$inferSelect) => ({
  id: t.id,
  name: t.name,
  sport: t.sport,
  sportId: t.sportId ?? null,
  auctionCode: t.auctionCode ?? null,
  venue: t.venue,
  auctionDate: t.auctionDate,
  auctionTime: t.auctionTime ?? null,
  organizerName: t.organizerName,
  organizerMobile: t.organizerMobile,
  organizerEmail: t.organizerEmail,
  logoUrl: t.logoUrl,
  sponsorLogos: t.sponsorLogos,
  basePurse: t.basePurse,
  minBid: t.minBid,
  bidIncrement: t.bidIncrement,
  bidTier1UpTo: t.bidTier1UpTo,
  bidTier1Increment: t.bidTier1Increment,
  bidTier2UpTo: t.bidTier2UpTo,
  bidTier2Increment: t.bidTier2Increment,
  bidTier3Increment: t.bidTier3Increment,
  bidTiers: t.bidTiers,
  timerSeconds: t.timerSeconds,
  bidTimerSeconds: t.bidTimerSeconds,
  playerSelectionMode: t.playerSelectionMode,
  status: t.status,
  registrationDeadline: t.registrationDeadline ?? null,
  registrationLimit: t.registrationLimit ?? null,
  resetCount: t.resetCount ?? 0,
  lastResetAt: t.lastResetAt ? t.lastResetAt.toISOString() : null,
  lastResetBy: t.lastResetBy ?? null,
  minimumSquadSize: t.minimumSquadSize ?? 0,
  maximumSquadSize: t.maximumSquadSize ?? 0,
  audioEnabled: t.audioEnabled ?? true,
  masterVolume: t.masterVolume ?? 80,
  countdownSoundEnabled: t.countdownSoundEnabled ?? true,
  countdownSoundUrl: t.countdownSoundUrl ?? null,
  countdownSoundVolume: t.countdownSoundVolume ?? 70,
  soldSoundEnabled: t.soldSoundEnabled ?? true,
  soldSoundUrl: t.soldSoundUrl ?? null,
  soldSoundVolume: t.soldSoundVolume ?? 80,
  cheerMessagesEnabled: t.cheerMessagesEnabled ?? true,
  cheerMessagePresets: t.cheerMessagePresets ?? null,
  breakEndMusicEnabled: t.breakEndMusicEnabled ?? false,
  breakEndMusicUrl: t.breakEndMusicUrl ?? null,
  breakEndMusicVolume: t.breakEndMusicVolume ?? 80,
  mainBannerUrl: t.mainBannerUrl ?? null,
  mainBannerEnabled: t.mainBannerEnabled ?? false,
  mainBannerFit: t.mainBannerFit ?? "cover",
  localModeEnabled: t.localModeEnabled ?? false,
  licenseStatus: t.licenseStatus ?? "trial",
  adminLocked: t.adminLocked ?? false,
  matchDates: t.matchDates ?? null,
  createdAt: t.createdAt.toISOString(),
});

const tournamentInputSchema = z.object({
  name: z.string().min(1),
  sport: z.string().default("cricket"),
  venue: z.string().optional(),
  auctionDate: z.string().optional(),
  auctionTime: z.string().nullable().optional(),
  organizerName: z.string().optional(),
  organizerMobile: z.string().optional(),
  organizerEmail: z.string().optional(),
  logoUrl: cloudinaryLogoUrl,
  sponsorLogos: z.string().optional(),
  basePurse: z.number().int().optional(),
  minBid: z.number().int().optional(),
  bidIncrement: z.number().int().optional(),
  bidTiers: z.string().optional(),
  timerSeconds: z.number().int().optional(),
  bidTimerSeconds: z.number().int().optional(),
  playerSelectionMode: z.enum(["sequential", "random", "manual"]).optional(),
  minimumSquadSize: z.number().int().min(0).optional(),
  maximumSquadSize: z.number().int().min(0).optional(),
  audioEnabled: z.boolean().optional(),
  masterVolume: z.number().int().min(0).max(100).optional(),
  countdownSoundEnabled: z.boolean().optional(),
  countdownSoundUrl: z.string().optional(),
  countdownSoundVolume: z.number().int().min(0).max(100).optional(),
  soldSoundEnabled: z.boolean().optional(),
  soldSoundUrl: z.string().optional(),
  soldSoundVolume: z.number().int().min(0).max(100).optional(),
  breakEndMusicEnabled: z.boolean().optional(),
  breakEndMusicUrl: z.string().optional(),
  breakEndMusicVolume: z.number().int().min(0).max(100).optional(),
  matchDates: z.string().nullable().optional(),
});

router.get("/tournaments", async (_req, res) => {
  const tournaments = await db.select().from(tournamentsTable).orderBy(tournamentsTable.createdAt);
  res.json(tournaments.map(tournamentToJson));
});

router.post("/tournaments", async (req, res) => {
  if (!isAccountOrAdmin(req)) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = tournamentInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const auctionCode = await generateUniqueAuctionCode(d.name, d.auctionDate);

  let organizerId: number | null = null;
  let organizerName = d.organizerName ?? null;
  let organizerMobile = d.organizerMobile ?? null;
  let organizerEmail = d.organizerEmail ?? null;

  // Auto-fill organiser contact from logged-in account (form has no email field)
  if (req.jwtUser?.organizerAccountId) {
    const [account] = await db
      .select()
      .from(organizersTable)
      .where(eq(organizersTable.id, req.jwtUser.organizerAccountId))
      .limit(1);
    if (account) {
      organizerId = account.id;
      organizerName = organizerName || account.name;
      organizerEmail = organizerEmail || account.email;
      if (!organizerMobile && !isPlaceholderOrganizerMobile(account.mobile)) {
        organizerMobile = account.mobile;
      }
    }
  }

  const [tournament] = await db
    .insert(tournamentsTable)
    .values({
      name: d.name,
      sport: d.sport,
      auctionCode,
      venue: d.venue ?? null,
      auctionDate: d.auctionDate ?? null,
      auctionTime: d.auctionTime ?? null,
      organizerId,
      organizerName,
      organizerMobile,
      organizerEmail,
      logoUrl: d.logoUrl ?? null,
      sponsorLogos: d.sponsorLogos ?? null,
      basePurse: d.basePurse ?? 10000000,
      minBid: d.minBid ?? 100000,
      bidIncrement: d.bidIncrement ?? 100000,
      bidTiers: d.bidTiers ?? DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
      timerSeconds: d.timerSeconds ?? DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
      bidTimerSeconds: d.bidTimerSeconds ?? DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
      playerSelectionMode: d.playerSelectionMode ?? DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
      minimumSquadSize: d.minimumSquadSize ?? 0,
      maximumSquadSize: d.maximumSquadSize ?? 0,
      matchDates: d.matchDates ?? null,
      status: "setup",
    })
    .returning();

  notifyAsync("TOURNAMENT_CREATED", {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    sport: tournament.sport,
    auctionCode: tournament.auctionCode,
    auctionDate: tournament.auctionDate,
    auctionTime: tournament.auctionTime,
    venue: tournament.venue,
    organizerName: tournament.organizerName,
    organizerEmail: tournament.organizerEmail,
    organizerMobile: tournament.organizerMobile,
    organizerId: tournament.organizerId,
  });

  res.status(201).json(tournamentToJson(tournament));
});

router.get("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  res.json(tournamentToJson(tournament));
});

router.patch("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, id)) { res.status(401).json({ error: "Authentication required" }); return; }
  const schema = z.object({
    name: z.string().optional(),
    sport: z.string().optional(),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    auctionTime: z.string().nullable().optional(),
    organizerName: z.string().optional(),
    organizerMobile: z.string().optional(),
    organizerEmail: z.string().optional(),
    logoUrl: cloudinaryLogoUrl,
    sponsorLogos: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    bidIncrement: z.number().int().optional(),
    bidTier1UpTo: z.number().int().optional(),
    bidTier1Increment: z.number().int().optional(),
    bidTier2UpTo: z.number().int().optional(),
    bidTier2Increment: z.number().int().optional(),
    bidTier3Increment: z.number().int().optional(),
    bidTiers: z.string().optional(),
    timerSeconds: z.number().int().optional(),
    bidTimerSeconds: z.number().int().optional(),
    playerSelectionMode: z.enum(["sequential", "random", "manual"]).optional(),
    status: z.string().optional(),
    registrationDeadline: z.string().nullable().optional(),
    registrationLimit: z.number().int().nullable().optional(),
    minimumSquadSize: z.number().int().min(0).nullable().optional(),
    maximumSquadSize: z.number().int().min(0).nullable().optional(),
    audioEnabled: z.boolean().optional(),
    masterVolume: z.number().int().min(0).max(100).optional(),
    countdownSoundEnabled: z.boolean().optional(),
    countdownSoundUrl: z.string().nullable().optional(),
    countdownSoundVolume: z.number().int().min(0).max(100).optional(),
    soldSoundEnabled: z.boolean().optional(),
    soldSoundUrl: z.string().nullable().optional(),
    soldSoundVolume: z.number().int().min(0).max(100).optional(),
    breakEndMusicEnabled: z.boolean().optional(),
    breakEndMusicUrl: z.string().nullable().optional(),
    breakEndMusicVolume: z.number().int().min(0).max(100).optional(),
    mainBannerUrl: z.string().nullable().optional(),
    mainBannerEnabled: z.boolean().optional(),
    mainBannerFit: z.enum(["cover", "contain"]).optional(),
    matchDates: z.string().nullable().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const updates: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.name !== undefined) updates.name = d.name;
  if (d.sport !== undefined) updates.sport = d.sport;
  if (d.venue !== undefined) updates.venue = d.venue;
  if (d.auctionDate !== undefined) updates.auctionDate = d.auctionDate;
  if (d.auctionTime !== undefined) updates.auctionTime = d.auctionTime;
  if (d.organizerName !== undefined) updates.organizerName = d.organizerName;
  if (d.organizerMobile !== undefined) updates.organizerMobile = d.organizerMobile;
  if (d.organizerEmail !== undefined) updates.organizerEmail = d.organizerEmail;
  if (d.logoUrl !== undefined) updates.logoUrl = d.logoUrl;
  if (d.sponsorLogos !== undefined) updates.sponsorLogos = d.sponsorLogos;
  if (d.basePurse !== undefined) updates.basePurse = d.basePurse;
  if (d.minBid !== undefined) updates.minBid = d.minBid;
  if (d.bidIncrement !== undefined) updates.bidIncrement = d.bidIncrement;
  if (d.bidTier1UpTo !== undefined) updates.bidTier1UpTo = d.bidTier1UpTo;
  if (d.bidTier1Increment !== undefined) updates.bidTier1Increment = d.bidTier1Increment;
  if (d.bidTier2UpTo !== undefined) updates.bidTier2UpTo = d.bidTier2UpTo;
  if (d.bidTier2Increment !== undefined) updates.bidTier2Increment = d.bidTier2Increment;
  if (d.bidTier3Increment !== undefined) updates.bidTier3Increment = d.bidTier3Increment;
  if (d.bidTiers !== undefined) updates.bidTiers = d.bidTiers;
  if (d.timerSeconds !== undefined) updates.timerSeconds = d.timerSeconds;
  if (d.bidTimerSeconds !== undefined) updates.bidTimerSeconds = d.bidTimerSeconds;
  if (d.playerSelectionMode !== undefined) updates.playerSelectionMode = d.playerSelectionMode;
  if (d.status !== undefined) updates.status = d.status;
  if (d.registrationDeadline !== undefined)
    updates.registrationDeadline = d.registrationDeadline === "" ? null : d.registrationDeadline;
  if (d.registrationLimit !== undefined) updates.registrationLimit = d.registrationLimit;
  if (d.minimumSquadSize !== undefined) updates.minimumSquadSize = d.minimumSquadSize ?? 0;
  if (d.maximumSquadSize !== undefined) updates.maximumSquadSize = d.maximumSquadSize ?? 0;
  if (d.audioEnabled !== undefined) updates.audioEnabled = d.audioEnabled;
  if (d.masterVolume !== undefined) updates.masterVolume = d.masterVolume;
  if (d.countdownSoundEnabled !== undefined) updates.countdownSoundEnabled = d.countdownSoundEnabled;
  if (d.countdownSoundUrl !== undefined) updates.countdownSoundUrl = d.countdownSoundUrl;
  if (d.countdownSoundVolume !== undefined) updates.countdownSoundVolume = d.countdownSoundVolume;
  if (d.soldSoundEnabled !== undefined) updates.soldSoundEnabled = d.soldSoundEnabled;
  if (d.soldSoundUrl !== undefined) updates.soldSoundUrl = d.soldSoundUrl;
  if (d.soldSoundVolume !== undefined) updates.soldSoundVolume = d.soldSoundVolume;
  if (d.breakEndMusicEnabled !== undefined) updates.breakEndMusicEnabled = d.breakEndMusicEnabled;
  if (d.breakEndMusicUrl !== undefined) updates.breakEndMusicUrl = d.breakEndMusicUrl;
  if (d.breakEndMusicVolume !== undefined) updates.breakEndMusicVolume = d.breakEndMusicVolume;
  if (d.mainBannerUrl !== undefined) updates.mainBannerUrl = d.mainBannerUrl;
  if (d.mainBannerEnabled !== undefined) updates.mainBannerEnabled = d.mainBannerEnabled;
  if (d.mainBannerFit !== undefined) updates.mainBannerFit = d.mainBannerFit;
  if (d.matchDates !== undefined) updates.matchDates = d.matchDates;
  const [tournament] = await db
    .update(tournamentsTable)
    .set(updates)
    .where(eq(tournamentsTable.id, id))
    .returning();
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  // Broadcast settings change so connected operator panels refresh immediately
  broadcastToTournament(id, { type: "settings_changed" });
  res.json(tournamentToJson(tournament));
});

router.delete("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!isOrganizerOrAdmin(req, id)) { res.status(401).json({ error: "Authentication required" }); return; }
  await db.delete(tournamentsTable).where(eq(tournamentsTable.id, id));
  res.status(204).send();
});

// GET export full tournament snapshot for local/offline mode
// Requires organizer or admin session — token issuance is a privileged action
router.get("/tournaments/:tournamentId/export", exportLimiter, async (req, res) => {
  const id = parseInt(String(req.params.tournamentId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Auth check: must be an admin, or an organizer authenticated specifically for this tournament.
  // Broad organizerAccountId is intentionally excluded — it allows any org-account holder to
  // access any tournament, which would let them mint export tokens for unrelated tournaments.
  const isAdmin = !!req.jwtUser.isAdmin;
  const isOrgForTournament = !!(req.jwtUser.organizer as Record<string, boolean> | undefined)?.[String(id)];
  if (!isAdmin && !isOrgForTournament) {
    res.status(401).json({ error: "Authentication required to export tournament" });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  if (!tournament.localModeEnabled) {
    res.status(403).json({ error: "Local mode is not enabled for this tournament" });
    return;
  }

  // Generate a fresh 48-hour export token for this download
  const exportToken = randomBytes(32).toString("hex");
  const exportTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await db.update(tournamentsTable).set({ exportToken, exportTokenExpiresAt }).where(eq(tournamentsTable.id, id));

  // Derive the cloud base URL so the local app knows where to mirror back
  const cloudBaseUrl = getPublicOrigin();

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, id));
  const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, id));
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, id));

  const playerToJson = (p: typeof playersTable.$inferSelect) => ({
    id: p.id, tournamentId: p.tournamentId, categoryId: p.categoryId, teamId: p.teamId,
    name: p.name, city: p.city, role: p.role, battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle, specialization: p.specialization, age: p.age,
    photoUrl: p.photoUrl, basePrice: p.basePrice, soldPrice: p.soldPrice,
    retainedPrice: p.retainedPrice, status: p.status, jerseyNumber: p.jerseyNumber,
    achievements: p.achievements, mobileNumber: p.mobileNumber, cricheroUrl: p.cricheroUrl,
    availabilityDates: p.availabilityDates, createdAt: p.createdAt.toISOString(),
  });

  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    exportToken,
    cloudBaseUrl,
    tournament: tournamentToJson(tournament),
    teams: teams.map(t => ({
      id: t.id, tournamentId: t.tournamentId, name: t.name, shortCode: t.shortCode,
      ownerName: t.ownerName, ownerMobile: t.ownerMobile, color: t.color,
      logoUrl: t.logoUrl, purse: t.purse, purseUsed: t.purseUsed,
      isBiddingEnabled: t.isBiddingEnabled, accessCode: t.accessCode,
      createdAt: t.createdAt.toISOString(),
    })),
    players: players.map(playerToJson),
    categories: categories.map(c => ({
      id: c.id, tournamentId: c.tournamentId, name: c.name, minBid: c.minBid,
      bidIncrement: c.bidIncrement, maxPlayers: c.maxPlayers, colorCode: c.colorCode,
      sortOrder: c.sortOrder, createdAt: c.createdAt.toISOString(),
    })),
  });
});

// POST sync local offline auction results back to cloud
router.post("/tournaments/:tournamentId/sync", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  // Timing-safe token validation with clock-drift tolerance
  const tokenCheck = validateExportToken(
    req.headers["x-export-token"],
    tournament.exportToken,
    tournament.exportTokenExpiresAt,
  );
  if (!tokenCheck.valid) {
    req.log.warn({ tournamentId: id, reason: tokenCheck.reason, ip: req.ip }, "Sync: export token validation rejected");
    res.status(tokenCheck.status).json({ error: tokenCheck.error }); return;
  }

  // Replay prevention: reject a second sync with the same token.
  // Once results are synced, a new export (and fresh token) is required.
  if (tournament.exportTokenSyncedAt) {
    req.log.warn({ tournamentId: id, syncedAt: tournament.exportTokenSyncedAt.toISOString(), ip: req.ip }, "Sync: token replay attempt blocked");
    res.status(409).json({
      error: "This export token has already been used for sync. Re-export from cloud to sync again.",
      syncedAt: tournament.exportTokenSyncedAt.toISOString(),
    });
    return;
  }

  const schema = z.object({
    playerResults: z.array(z.object({
      cloudId: z.number().int(),
      status: z.string(),
      teamCloudId: z.number().int().nullable().optional(),
      soldPrice: z.number().int().nullable().optional(),
    })),
    teamPurses: z.array(z.object({
      cloudId: z.number().int(),
      purseUsed: z.number().int(),
    })),
    bids: z.array(z.object({
      playerCloudId: z.number().int(),
      teamCloudId: z.number().int(),
      amount: z.number().int(),
      timestamp: z.string(),
    })).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid sync payload" }); return; }

  const { playerResults, teamPurses, bids } = parsed.data;

  let playersUpdated = 0;
  for (const p of playerResults) {
    await db.update(playersTable).set({
      status: p.status,
      teamId: p.teamCloudId ?? null,
      soldPrice: p.soldPrice ?? null,
    }).where(and(eq(playersTable.id, p.cloudId), eq(playersTable.tournamentId, id)));
    playersUpdated++;
  }

  let teamsUpdated = 0;
  for (const t of teamPurses) {
    await db.update(teamsTable).set({ purseUsed: t.purseUsed })
      .where(and(eq(teamsTable.id, t.cloudId), eq(teamsTable.tournamentId, id)));
    teamsUpdated++;
  }

  let bidsInserted = 0;
  for (const b of bids) {
    await db.insert(bidsTable).values({
      tournamentId: id,
      playerId: b.playerCloudId,
      teamId: b.teamCloudId,
      amount: b.amount,
    });
    bidsInserted++;
  }

  // Mark tournament complete and stamp the token as used — prevents replay sync
  await db.update(tournamentsTable).set({
    status: "completed",
    exportTokenSyncedAt: new Date(),
  }).where(eq(tournamentsTable.id, id));

  res.json({ ok: true, playersUpdated, teamsUpdated, bidsInserted });
});

// ─── Share viewer link — fire DLT SMS to organizer ───────────────────────────

router.post("/tournaments/:id/share-viewer-link", async (req, res) => {
  const tid = Number(req.params.id);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid tournament id" }); return; }

  const tidStr = String(tid);
  // Auth: admin OR organizer with explicit access to this specific tournament.
  // Broad organizerAccountId is intentionally excluded — it would allow any org-account
  // holder to trigger SMS sends (including viewer URLs) for tournaments they don't own.
  const isAdmin = !!req.jwtUser?.isAdmin;
  const isOrgForTournament = !!(req.jwtUser?.organizer as Record<string, boolean> | undefined)?.[tidStr];
  if (!isAdmin && !isOrgForTournament) { res.status(401).json({ error: "Not authorised" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const viewerUrl = buildPublicUrl(`/tournament/${tid}/display`);

  const orgId = tournament.organizerId;
  if (tournament.licenseStatus === "active" && orgId != null) {
    void (async () => {
      try {
        const { smsNotificationSettingsTable, organizersTable: orgsTable } = await import("@workspace/db");
        const { sendDltSms, viewerLinkTemplateId } = await import("../lib/fast2sms");
        const [settings] = await db.select().from(smsNotificationSettingsTable).limit(1);
        const templateId = viewerLinkTemplateId() || settings?.viewerLinkTemplateId;
        if (settings?.dltEnabled && settings.viewerLinkEnabled && templateId) {
          const [organizer] = await db.select({ mobile: orgsTable.mobile }).from(orgsTable).where(eq(orgsTable.id, orgId));
          const mobile = organizer?.mobile;
          if (mobile && !mobile.startsWith("gid_")) {
            await sendDltSms([mobile], templateId, [tournament.name, viewerUrl]);
          }
        }
      } catch (err) {
        const { logger } = await import("../lib/logger");
        logger.error({ err, tournamentId: tid }, "DLT viewer-link SMS failed");
      }
    })();
  }

  res.json({ success: true, viewerUrl });
});

export default router;
