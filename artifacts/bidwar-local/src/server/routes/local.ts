import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import QRCode from "qrcode";
import type { LocalDb } from "@workspace/db-local";
import {
  tournamentsTable, teamsTable, playersTable, categoriesTable,
  bidsTable, syncQueueTable, purseBoostersTable,
} from "@workspace/db-local";

/**
 * Verify operator PIN for a given tournament.
 * Returns true (allowed) if no PIN is configured, or if X-Operator-Pin header matches.
 * Sends 401 and returns false if PIN is set but header is missing or wrong.
 */
async function checkOperatorPin(
  db: LocalDb,
  tournamentId: number | null,
  req: import("express").Request,
  res: import("express").Response,
): Promise<boolean> {
  if (!tournamentId) return true; // No tournament context — let caller validate input first
  const [t] = await db
    .select({ operatorPin: tournamentsTable.operatorPin })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  if (!t?.operatorPin) return true; // No PIN configured
  const provided = req.headers["x-operator-pin"] as string | undefined;
  if (provided === t.operatorPin) return true;
  res.status(401).json({ error: "Operator PIN required. Include X-Operator-Pin header." });
  return false;
}

export function createLocalRouter(db: LocalDb, defaultCloudUrl: string) {
  const router = Router();

  // POST /local/import — import a full tournament snapshot from the cloud
  router.post("/import", async (req, res) => {
    const schema = z.object({
      version: z.number(),
      exportToken: z.string().optional(),
      cloudBaseUrl: z.string().url().optional(),
      tournament: z.object({
        id: z.number(), name: z.string(), sport: z.string(),
        venue: z.string().nullish(), auctionDate: z.string().nullish(),
        organizerName: z.string().nullish(), organizerMobile: z.string().nullish(),
        organizerEmail: z.string().nullish(), logoUrl: z.string().nullish(),
        sponsorLogos: z.string().nullish(), basePurse: z.number(), minBid: z.number(),
        bidIncrement: z.number(), bidTiers: z.string().nullish(),
        timerSeconds: z.number(), bidTimerSeconds: z.number(),
        playerSelectionMode: z.string(),
      }),
      teams: z.array(z.object({
        id: z.number(), name: z.string(), shortCode: z.string(), ownerName: z.string(),
        ownerMobile: z.string().nullish(), color: z.string().nullish(),
        logoUrl: z.string().nullish(), purse: z.number(), purseUsed: z.number(),
        isBiddingEnabled: z.boolean().optional(), accessCode: z.string().nullish(),
      })),
      players: z.array(z.object({
        id: z.number(), name: z.string(), categoryId: z.number().nullish(),
        teamId: z.number().nullish(), role: z.string().nullish(), city: z.string().nullish(),
        basePrice: z.number(), soldPrice: z.number().nullish(),
        retainedPrice: z.number().nullish(), status: z.string(),
        jerseyNumber: z.string().nullish(), photoUrl: z.string().nullish(),
        mobileNumber: z.string().nullish(), battingStyle: z.string().nullish(),
        bowlingStyle: z.string().nullish(), specialization: z.string().nullish(),
      })),
      categories: z.array(z.object({
        id: z.number(), name: z.string(), minBid: z.number(),
        bidIncrement: z.number().nullish(), maxPlayers: z.number().nullish(),
        colorCode: z.string().nullish(), sortOrder: z.number(),
      })),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid snapshot format", details: parsed.error.issues }); return; }
    const { tournament: t, teams, players, categories, exportToken, cloudBaseUrl } = parsed.data;

    const now = new Date().toISOString();

    // Insert or replace tournament
    const existing = await db.select().from(tournamentsTable).where(eq(tournamentsTable.cloudId, t.id));
    let localTid: number;
    if (existing.length > 0) {
      localTid = existing[0].id;
      await db.update(tournamentsTable).set({
        name: t.name, sport: t.sport, venue: t.venue ?? null, auctionDate: t.auctionDate ?? null,
        organizerName: t.organizerName ?? null, organizerMobile: t.organizerMobile ?? null,
        logoUrl: t.logoUrl ?? null, sponsorLogos: t.sponsorLogos ?? null,
        basePurse: t.basePurse, minBid: t.minBid, bidIncrement: t.bidIncrement,
        bidTiers: t.bidTiers ?? null, timerSeconds: t.timerSeconds, bidTimerSeconds: t.bidTimerSeconds,
        playerSelectionMode: t.playerSelectionMode, status: "setup", updatedAt: now,
        ...(cloudBaseUrl ? { cloudBaseUrl } : {}),
        ...(exportToken ? { exportToken } : {}),
      }).where(eq(tournamentsTable.id, localTid));
    } else {
      const [inserted] = await db.insert(tournamentsTable).values({
        name: t.name, sport: t.sport, venue: t.venue ?? null, auctionDate: t.auctionDate ?? null,
        organizerName: t.organizerName ?? null, organizerMobile: t.organizerMobile ?? null,
        logoUrl: t.logoUrl ?? null, sponsorLogos: t.sponsorLogos ?? null,
        basePurse: t.basePurse, minBid: t.minBid, bidIncrement: t.bidIncrement,
        bidTiers: t.bidTiers ?? null, timerSeconds: t.timerSeconds, bidTimerSeconds: t.bidTimerSeconds,
        playerSelectionMode: t.playerSelectionMode, status: "setup", cloudId: t.id,
        cloudBaseUrl: cloudBaseUrl ?? null,
        exportToken: exportToken ?? null,
      }).returning();
      localTid = inserted.id;
    }

    // Clear existing data for this tournament
    await db.delete(teamsTable).where(eq(teamsTable.tournamentId, localTid));
    await db.delete(playersTable).where(eq(playersTable.tournamentId, localTid));
    await db.delete(categoriesTable).where(eq(categoriesTable.tournamentId, localTid));
    await db.delete(bidsTable).where(eq(bidsTable.tournamentId, localTid));
    await db.delete(auctionSessionsTable).where(eq(auctionSessionsTable.tournamentId, localTid));

    // Insert teams (store cloud id as cloudId)
    const teamIdMap = new Map<number, number>();
    for (const team of teams) {
      const [inserted] = await db.insert(teamsTable).values({
        tournamentId: localTid, name: team.name, shortCode: team.shortCode,
        ownerName: team.ownerName, ownerMobile: team.ownerMobile ?? null,
        color: team.color ?? "#3B82F6", logoUrl: team.logoUrl ?? null,
        purse: team.purse, purseUsed: team.purseUsed ?? 0,
        isBiddingEnabled: team.isBiddingEnabled ?? true,
        accessCode: team.accessCode ?? null, cloudId: team.id,
      }).returning();
      teamIdMap.set(team.id, inserted.id);
    }

    // Insert categories
    const catIdMap = new Map<number, number>();
    for (const cat of categories) {
      const [inserted] = await db.insert(categoriesTable).values({
        tournamentId: localTid, name: cat.name, minBid: cat.minBid,
        bidIncrement: cat.bidIncrement ?? null, maxPlayers: cat.maxPlayers ?? null,
        colorCode: cat.colorCode ?? "#F59E0B", sortOrder: cat.sortOrder, cloudId: cat.id,
      }).returning();
      catIdMap.set(cat.id, inserted.id);
    }

    // Insert players
    for (const player of players) {
      const localCatId = player.categoryId ? catIdMap.get(player.categoryId) ?? null : null;
      const localTeamId = player.teamId ? teamIdMap.get(player.teamId) ?? null : null;
      await db.insert(playersTable).values({
        tournamentId: localTid, name: player.name,
        categoryId: localCatId, teamId: localTeamId,
        role: player.role ?? null, city: player.city ?? null,
        basePrice: player.basePrice, soldPrice: player.soldPrice ?? null,
        retainedPrice: player.retainedPrice ?? null,
        status: player.status === "retained" ? "retained" : "available",
        jerseyNumber: player.jerseyNumber ?? null, photoUrl: player.photoUrl ?? null,
        mobileNumber: player.mobileNumber ?? null, battingStyle: player.battingStyle ?? null,
        bowlingStyle: player.bowlingStyle ?? null, specialization: player.specialization ?? null,
        cloudId: player.id,
      });
    }

    res.json({ ok: true, tournamentId: localTid, message: `Imported ${players.length} players, ${teams.length} teams` });
  });

  // GET /local/sync-status
  router.get("/sync-status", async (_req, res) => {
    const pending = await db.select().from(syncQueueTable).where(eq(syncQueueTable.failed, false));
    const unsynced = pending.filter(e => !e.syncedAt);
    const lastSynced = pending.filter(e => e.syncedAt).sort((a, b) => (b.syncedAt ?? "").localeCompare(a.syncedAt ?? ""))[0];
    res.json({ pending: unsynced.length, lastSync: lastSynced?.syncedAt ?? null });
  });

  // POST /local/sync-to-cloud — push auction results to cloud
  // Protected by operator PIN (if configured) to prevent LAN callers from
  // exfiltrating the exportToken or sending unauthorized sync payloads.
  router.post("/sync-to-cloud", async (req, res) => {
    const schema = z.object({
      cloudBaseUrl: z.string().url().optional(),
      tournamentId: z.number().int(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
    const { cloudBaseUrl, tournamentId: localTid } = parsed.data;

    // PIN check before fetching tournament data (fail fast)
    if (!await checkOperatorPin(db, localTid, req, res)) return;

    const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, localTid));
    if (!tournament?.cloudId) { res.status(400).json({ error: "Tournament has no cloud ID — import from cloud first" }); return; }

    const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, localTid));
    const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, localTid));
    const bids = await db.select().from(bidsTable).where(eq(bidsTable.tournamentId, localTid));

    const playerResults = players
      .filter(p => p.cloudId)
      .map(p => {
        const team = p.teamId ? teams.find(t => t.id === p.teamId) : null;
        return { cloudId: p.cloudId!, status: p.status, teamCloudId: team?.cloudId ?? null, soldPrice: p.soldPrice ?? null };
      });

    const teamPurses = teams.filter(t => t.cloudId).map(t => ({ cloudId: t.cloudId!, purseUsed: t.purseUsed }));

    const boosters = await db
      .select()
      .from(purseBoostersTable)
      .where(eq(purseBoostersTable.tournamentId, localTid));

    const purseBoosters = boosters
      .map(b => {
        const team = teams.find(t => t.id === b.teamId);
        if (!team?.cloudId) return null;
        return {
          localUuid: b.localUuid,
          teamCloudId: team.cloudId,
          amount: b.amount,
          reason: b.reason,
          status: b.status as "active" | "cancelled",
          createdAt: b.createdAt,
          createdByLabel: b.createdByLabel,
          cancelledAt: b.cancelledAt,
          cancelReason: b.cancelReason,
          previousCapacity: b.previousCapacity,
          newCapacity: b.newCapacity,
        };
      })
      .filter((b): b is NonNullable<typeof b> => b != null);

    const bidPayload = bids.map(b => {
      const player = players.find(p => p.id === b.playerId);
      const team = teams.find(t => t.id === b.teamId);
      return { playerCloudId: player?.cloudId ?? 0, teamCloudId: team?.cloudId ?? 0, amount: b.amount, timestamp: b.timestamp };
    }).filter(b => b.playerCloudId > 0 && b.teamCloudId > 0);

    const resolvedCloudUrl = cloudBaseUrl ?? tournament.cloudBaseUrl ?? "";
    if (!resolvedCloudUrl) {
      res.status(400).json({ error: "No cloud URL configured — provide cloudBaseUrl or re-import from cloud" });
      return;
    }

    const cloudRes = await fetch(`${resolvedCloudUrl}/api/tournaments/${tournament.cloudId}/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tournament.exportToken ? { "X-Export-Token": tournament.exportToken } : {}),
      },
      body: JSON.stringify({ playerResults, teamPurses, bids: bidPayload, purseBoosters }),
    });

    if (!cloudRes.ok) {
      const err = await cloudRes.text();
      res.status(502).json({ error: "Cloud sync failed", detail: err });
      return;
    }

    const result = await cloudRes.json() as { ok: boolean; playersUpdated: number; teamsUpdated: number; bidsInserted: number; boostersSynced?: number };

    await db.update(purseBoostersTable).set({ syncState: "synced" })
      .where(and(eq(purseBoostersTable.tournamentId, localTid), eq(purseBoostersTable.syncState, "pending")));

    // Mark all queue items as synced
    await db.update(syncQueueTable).set({ syncedAt: new Date().toISOString() })
      .where(eq(syncQueueTable.failed, false));

    res.json(result);
  });

  // GET /local/qr.png — QR code image for the local server URL (for easy device onboarding)
  // Reads localIP from X-Local-IP header sent by the Electron renderer (or falls back to req.hostname)
  router.get("/qr.png", async (req, res) => {
    const ip = String(req.headers["x-local-ip"] || req.hostname || "127.0.0.1");
    const port = String(req.headers["x-local-port"] || "3741");
    const url = `http://${ip}:${port}`;
    try {
      const png = await QRCode.toBuffer(url, { type: "png", width: 300, margin: 2 });
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", "no-store");
      res.send(png);
    } catch (err) {
      res.status(500).json({ error: "QR generation failed" });
    }
  });

  return router;
}
