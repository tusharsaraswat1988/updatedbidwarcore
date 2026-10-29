import crypto from "node:crypto";
import {
  generatePlayerSoldPosterBuffer,
  type PlayerSoldPosterInput,
} from "./player-sold-poster-generator.js";
import { getCloudinary, uploadBufferToCloudinary } from "../cloudinary-media-service.js";
import { getPublicOrigin } from "../runtime-env.js";
import { logger } from "../logger.js";
import { db, playersTable, teamsTable, tournamentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuctionUnit } from "@workspace/api-base/auction-unit";

export interface StoredPosterEntry {
  token: string;
  buffer: Buffer;
  mimeType: "image/png";
  createdAt: number;
  expiresAt: number;
  metadata: {
    tournamentId: number;
    playerId?: number | null;
    teamId?: number | null;
    amount: number;
  };
}

// 7-day retention policy (milliseconds)
export const POSTER_RETENTION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_POSTER_CACHE_ENTRIES = 500;

// Local in-memory cache with retention tracking
const localPosterCache = new Map<string, StoredPosterEntry>();

/**
 * Purges expired posters according to the explicit 7-day retention policy.
 */
export function purgeExpiredPosters(): number {
  const now = Date.now();
  let purgedCount = 0;
  for (const [token, entry] of localPosterCache.entries()) {
    if (entry.expiresAt <= now) {
      localPosterCache.delete(token);
      purgedCount++;
    }
  }
  return purgedCount;
}

/**
 * Empties the cache (useful for isolated tests).
 */
export function clearPosterCache(): void {
  localPosterCache.clear();
}

/**
 * Returns current count of stored posters in local cache.
 */
export function getPosterCacheSize(): number {
  return localPosterCache.size;
}

/**
 * Generates a stable, deterministic token for a sale event.
 */
export function createSalePosterToken(opts: {
  tournamentId: number;
  playerId?: number | null;
  teamId?: number | null;
  amount: number;
}): string {
  const pId = opts.playerId ?? "0";
  const tId = opts.teamId ?? "0";
  const raw = `sold:${opts.tournamentId}:${pId}:${tId}:${opts.amount}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

/**
 * Retrieves a locally stored poster buffer by token, verifying it hasn't expired.
 */
export function getPlayerSoldPosterBufferByToken(token: string): { buffer: Buffer; mimeType: "image/png" } | null {
  const entry = localPosterCache.get(token);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    localPosterCache.delete(token);
    return null;
  }

  return {
    buffer: entry.buffer,
    mimeType: entry.mimeType,
  };
}

export interface ResolveAndGeneratePosterInput {
  tournamentId: number;
  playerId?: number | null;
  playerName?: string | null;
  playerPhotoUrl?: string | null;
  playerRole?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  teamLogoUrl?: string | null;
  teamShortCode?: string | null;
  teamColor?: string | null;
  amount: number;
  auctionUnit?: AuctionUnit | null;
  tournamentName?: string | null;
  tournamentSport?: string | null;
}

export interface GeneratedPosterResult {
  token: string;
  buffer: Buffer;
  publicUrl: string;
  storageKind: "cloudinary" | "server_media";
  expiresAt: number;
}

function safePublicOrigin(): string {
  const appUrl = process.env.APP_URL?.trim() || process.env.PUBLIC_ORIGIN?.trim();
  if (appUrl) return appUrl.replace(/\/+$/, "");
  try {
    return getPublicOrigin().replace(/\/+$/, "");
  } catch {
    return "https://bidwar.in";
  }
}

/**
 * Resolves authoritative player, winning team, and tournament data from persisted DB records.
 * Falls back safely to passed arguments if DB records cannot be retrieved.
 */
export async function resolveAuthoritativeSaleData(
  input: ResolveAndGeneratePosterInput,
): Promise<PlayerSoldPosterInput & { tournamentId: number; playerId?: number | null; teamId?: number | null }> {
  let resolvedPlayerName = input.playerName ?? "Player";
  let resolvedPhotoUrl = input.playerPhotoUrl ?? null;
  let resolvedRole = input.playerRole ?? null;

  let resolvedTeamName = input.teamName ?? "Team";
  let resolvedTeamLogo = input.teamLogoUrl ?? null;
  let resolvedTeamShortCode = input.teamShortCode ?? null;
  let resolvedTeamColor = input.teamColor ?? null;

  let resolvedTournamentName = input.tournamentName ?? "Tournament";
  let resolvedSport = input.tournamentSport ?? "Cricket";
  let resolvedUnit: AuctionUnit = input.auctionUnit ?? "rupee";
  let resolvedTeamId = input.teamId ?? null;
  let resolvedAmount = input.amount;

  // Attempt DB lookups if IDs provided
  if (typeof db?.select === "function") {
    try {
      if (input.playerId) {
        const query = db
          .select({
            name: playersTable.name,
            photoUrl: playersTable.photoUrl,
            role: playersTable.role,
            teamId: playersTable.teamId,
            soldPrice: playersTable.soldPrice,
          })
          .from(playersTable)
          .where(eq(playersTable.id, input.playerId));

        const res = typeof (query as any)?.limit === "function" ? await (query as any).limit(1) : await query;
        const p = Array.isArray(res) && res.length > 0 ? res[0] : null;

        if (p) {
          if (p.name) resolvedPlayerName = p.name;
          if (p.photoUrl) resolvedPhotoUrl = p.photoUrl;
          if (p.role) resolvedRole = p.role;
          if (!resolvedTeamId && p.teamId) resolvedTeamId = p.teamId;
          if (!resolvedAmount && typeof p.soldPrice === "number") resolvedAmount = p.soldPrice;
        }
      }

      const effectiveTeamId = input.teamId ?? resolvedTeamId;
      if (effectiveTeamId) {
        const query = db
          .select({
            name: teamsTable.name,
            logoUrl: teamsTable.logoUrl,
            shortCode: teamsTable.shortCode,
            color: teamsTable.color,
          })
          .from(teamsTable)
          .where(eq(teamsTable.id, effectiveTeamId));

        const res = typeof (query as any)?.limit === "function" ? await (query as any).limit(1) : await query;
        const t = Array.isArray(res) && res.length > 0 ? res[0] : null;

        if (t) {
          if (t.name) resolvedTeamName = t.name;
          if (t.logoUrl) resolvedTeamLogo = t.logoUrl;
          if (t.shortCode) resolvedTeamShortCode = t.shortCode;
          if (t.color) resolvedTeamColor = t.color;
        }
      }

      if (input.tournamentId) {
        const query = db
          .select({
            name: tournamentsTable.name,
            sport: tournamentsTable.sport,
            auctionUnit: tournamentsTable.auctionUnit,
          })
          .from(tournamentsTable)
          .where(eq(tournamentsTable.id, input.tournamentId));

        const res = typeof (query as any)?.limit === "function" ? await (query as any).limit(1) : await query;
        const tourn = Array.isArray(res) && res.length > 0 ? res[0] : null;

        if (tourn) {
          if (tourn.name) resolvedTournamentName = tourn.name;
          if (tourn.sport) resolvedSport = tourn.sport;
          if (tourn.auctionUnit) resolvedUnit = tourn.auctionUnit as AuctionUnit;
        }
      }
    } catch (dbErr) {
      logger.warn(
        { err: dbErr, tournamentId: input.tournamentId, playerId: input.playerId },
        "resolveAuthoritativeSaleData: DB lookup error, continuing with provided inputs",
      );
    }
  }

  return {
    tournamentId: input.tournamentId,
    playerId: input.playerId,
    teamId: input.teamId ?? resolvedTeamId,
    playerName: resolvedPlayerName,
    playerPhotoUrl: resolvedPhotoUrl,
    playerRole: resolvedRole,
    teamName: resolvedTeamName,
    teamLogoUrl: resolvedTeamLogo,
    teamShortCode: resolvedTeamShortCode,
    teamColor: resolvedTeamColor,
    amount: resolvedAmount,
    auctionUnit: resolvedUnit,
    tournamentName: resolvedTournamentName,
    tournamentSport: resolvedSport,
  };
}

/**
 * End-to-end poster generation, export, and hosting workflow.
 * 1. Resolves authoritative auction data
 * 2. Generates personalized 1200x675 poster PNG buffer
 * 3. Uploads to Cloudinary if available; otherwise hosts on server media endpoint
 * 4. Returns stable public HTTPS URL with explicit 7-day retention policy
 */
export async function generateAndHostPlayerSoldPoster(
  input: ResolveAndGeneratePosterInput,
): Promise<GeneratedPosterResult> {
  // 1. Resolve authoritative data from DB
  const authoritative = await resolveAuthoritativeSaleData(input);

  // 2. Compute deterministic token
  const token = createSalePosterToken({
    tournamentId: authoritative.tournamentId,
    playerId: authoritative.playerId,
    teamId: authoritative.teamId,
    amount: authoritative.amount,
  });

  // Check if locally cached and not expired
  const cached = localPosterCache.get(token);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    const publicOrigin = safePublicOrigin();
    const publicUrl = `${publicOrigin}/api/media/player-sold-poster/${token}.png`;
    return {
      token,
      buffer: cached.buffer,
      publicUrl,
      storageKind: "server_media",
      expiresAt: cached.expiresAt,
    };
  }

  // 3. Generate high-res 1200x675 PNG poster
  const buffer = await generatePlayerSoldPosterBuffer({
    playerName: authoritative.playerName,
    playerPhotoUrl: authoritative.playerPhotoUrl,
    playerRole: authoritative.playerRole,
    teamName: authoritative.teamName,
    teamLogoUrl: authoritative.teamLogoUrl,
    teamShortCode: authoritative.teamShortCode,
    teamColor: authoritative.teamColor,
    amount: authoritative.amount,
    auctionUnit: authoritative.auctionUnit,
    tournamentName: authoritative.tournamentName,
    tournamentSport: authoritative.tournamentSport,
  });

  const expiresAt = now + POSTER_RETENTION_TTL_MS;

  // 4. Try Cloudinary storage first if configured
  try {
    const cloudinary = await getCloudinary();
    if (cloudinary) {
      const uploadResult = await uploadBufferToCloudinary(buffer, {
        folder: "bidwar/player-sold-posters",
        public_id: `sold_${token}`,
        resource_type: "image",
        format: "png",
        tags: ["player_sold_poster", `tournament_${authoritative.tournamentId}`],
      });

      if (uploadResult?.url) {
        logger.info(
          { token, url: uploadResult.url, tournamentId: authoritative.tournamentId },
          "Player sold poster uploaded to Cloudinary successfully",
        );

        // Also record in local cache for local reference/retrieval
        localPosterCache.set(token, {
          token,
          buffer,
          mimeType: "image/png",
          createdAt: now,
          expiresAt,
          metadata: {
            tournamentId: authoritative.tournamentId,
            playerId: authoritative.playerId,
            teamId: authoritative.teamId,
            amount: authoritative.amount,
          },
        });

        return {
          token,
          buffer,
          publicUrl: uploadResult.url,
          storageKind: "cloudinary",
          expiresAt,
        };
      }
    }
  } catch (cldErr) {
    logger.warn(
      { err: cldErr, token },
      "generateAndHostPlayerSoldPoster: Cloudinary upload failed, falling back to server media endpoint",
    );
  }

  // 5. Store in local cache with explicit 7-day retention policy and LRU bounds
  if (localPosterCache.size >= MAX_POSTER_CACHE_ENTRIES) {
    purgeExpiredPosters();
    // If still at capacity, evict oldest entry
    if (localPosterCache.size >= MAX_POSTER_CACHE_ENTRIES) {
      const oldestKey = localPosterCache.keys().next().value;
      if (oldestKey) localPosterCache.delete(oldestKey);
    }
  }

  localPosterCache.set(token, {
    token,
    buffer,
    mimeType: "image/png",
    createdAt: now,
    expiresAt,
    metadata: {
      tournamentId: authoritative.tournamentId,
      playerId: authoritative.playerId,
      teamId: authoritative.teamId,
      amount: authoritative.amount,
    },
  });

  const publicOrigin = safePublicOrigin();
  const publicUrl = `${publicOrigin}/api/media/player-sold-poster/${token}.png`;

  logger.info(
    { token, publicUrl, tournamentId: authoritative.tournamentId },
    "Player sold poster hosted on BIDWAR server media endpoint",
  );

  return {
    token,
    buffer,
    publicUrl,
    storageKind: "server_media",
    expiresAt,
  };
}
