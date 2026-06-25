import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import type { LocalDb } from "@workspace/db-local";
import {
  playersTable,
  teamsTable,
  tournamentsTable,
  venueSnapshotsTable,
} from "@workspace/db-local";
import { saveBrandingSnapshot } from "../routes/branding.js";
import {
  bundleMediaUrls,
  collectBrandingMediaUrls,
  rewriteBrandingPayload,
  rewriteSponsorLogos,
  rewriteUrl,
  urlsFromSponsorLogos,
} from "./media-bundle.js";

const EXT_CANDIDATES = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".ico"];

let mediaDir = "";

export function configureOfflineMedia(dir: string): void {
  mediaDir = dir;
}

/** If a remote URL was bundled to disk, return its `/media/...` path even when DB still has the cloud URL. */
export function resolveOfflineUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/media/") || url.startsWith("/static/")) return url;
  if (!mediaDir || !/^https?:\/\//i.test(url)) return url;

  const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
  for (const ext of EXT_CANDIDATES) {
    if (existsSync(`${mediaDir}/${hash}${ext}`)) return `/media/${hash}${ext}`;
  }
  return url;
}

export function resolveOfflineSponsorLogos(
  sponsorLogos: string | null | undefined,
): string | null {
  if (!sponsorLogos) return null;
  const urls = urlsFromSponsorLogos(sponsorLogos);
  const map = new Map<string, string>();
  for (const u of urls) {
    const local = resolveOfflineUrl(u);
    if (local && local !== u) map.set(u, local);
  }
  if (map.size === 0) return sponsorLogos;
  return rewriteSponsorLogos(sponsorLogos, map);
}

export async function rebundleTournamentMedia(
  db: LocalDb,
  targetMediaDir: string,
  localTid: number,
): Promise<{ total: number; bundled: number; failed: number }> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, localTid));
  if (!tournament) throw new Error("Tournament not found");

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, localTid));
  const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, localTid));
  const [brandingRow] = await db
    .select()
    .from(venueSnapshotsTable)
    .where(eq(venueSnapshotsTable.key, "branding"));

  const urlList: (string | null | undefined)[] = [
    tournament.logoUrl,
    ...urlsFromSponsorLogos(tournament.sponsorLogos),
    ...teams.map((t) => t.logoUrl),
    ...players.map((p) => p.photoUrl),
  ];

  if (brandingRow) {
    try {
      const parsed = JSON.parse(brandingRow.payload) as Record<string, unknown>;
      urlList.push(...collectBrandingMediaUrls(parsed));
    } catch { /* ignore */ }
  }

  const remoteUrls = new Set(
    urlList.filter((u): u is string => !!u && /^https?:\/\//i.test(u)),
  );

  const mediaMap = await bundleMediaUrls(targetMediaDir, urlList);
  const rw = (url: string | null | undefined) => rewriteUrl(url, mediaMap);

  await db
    .update(tournamentsTable)
    .set({
      logoUrl: rw(tournament.logoUrl),
      sponsorLogos: rewriteSponsorLogos(tournament.sponsorLogos, mediaMap),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tournamentsTable.id, localTid));

  for (const team of teams) {
    const nextLogo = rw(team.logoUrl);
    if (nextLogo !== team.logoUrl) {
      await db.update(teamsTable).set({ logoUrl: nextLogo }).where(eq(teamsTable.id, team.id));
    }
  }

  for (const player of players) {
    const nextPhoto = rw(player.photoUrl);
    if (nextPhoto !== player.photoUrl) {
      await db.update(playersTable).set({ photoUrl: nextPhoto }).where(eq(playersTable.id, player.id));
    }
  }

  if (brandingRow) {
    try {
      const parsed = JSON.parse(brandingRow.payload) as Record<string, unknown>;
      await saveBrandingSnapshot(db, rewriteBrandingPayload(parsed, mediaMap));
    } catch { /* ignore */ }
  }

  return {
    total: remoteUrls.size,
    bundled: mediaMap.size,
    failed: Math.max(0, remoteUrls.size - mediaMap.size),
  };
}
