import type { Request } from "express";
import { db, tournamentsTable } from "@workspace/db";
import { eq, or, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { buildDynamicFanSitemapTournaments } from "./fan-tournament-seo.js";

/**
 * Host detection for the dedicated Fan Platform.
 * Matches `fan.bidwar.in` in production or any host beginning with `fan.` (e.g. `fan.localhost:3000`).
 */
export function isFanRequest(req: Request): boolean {
  const xfh = req.headers["x-forwarded-host"];
  const rawXfh = Array.isArray(xfh) ? xfh[0] : (xfh ?? "");
  const host = (rawXfh.split(",")[0].trim() || req.headers.host || "").split(":")[0].toLowerCase().trim();
  return host === "fan.bidwar.in" || host.startsWith("fan.");
}

/**
 * Canonical public origin for Fan Platform requests.
 */
export function getFanOrigin(req?: Request): string {
  if (req) {
    const xfh = req.headers["x-forwarded-host"];
    const rawXfh = Array.isArray(xfh) ? xfh[0] : (xfh ?? "");
    const host = (rawXfh.split(",")[0].trim() || req.headers.host || "").split(":")[0].toLowerCase().trim();
    const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
    if (host === "fan.bidwar.in") {
      return "https://fan.bidwar.in";
    }
    if (host.startsWith("fan.")) {
      return `${proto}://${host}`;
    }
  }
  return "https://fan.bidwar.in";
}

/**
 * Dedicated Fan Platform robots.txt policy.
 * - Allows crawling of public Fan pages and assets.
 * - Does not inherit marketing disallows (/tournament/, /admin, /organizer).
 * - Does not include marketing commercial paths (/pricing, /academy, /bpl).
 * - References strictly the Fan sitemap index.
 */
export function buildFanRobotsTxt(origin: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${origin}/sitemap-index.xml`,
  ].join("\n");
}

/**
 * Dedicated Fan Platform sitemap index.
 * Points exclusively to child sitemaps hosted on the fan domain.
 */
export function buildFanSitemapIndex(origin: string): string {
  const lastmod = new Date().toISOString().slice(0, 10);
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    `  <sitemap>`,
    `    <loc>${origin}/sitemap-tournaments.xml</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `  </sitemap>`,
    `</sitemapindex>`,
  ].join("\n");
}

/**
 * Dynamic Fan Platform tournament sitemap for Phase 3.
 * Queries eligible, active/completed, licensed public tournaments from database.
 */
export async function buildFanSitemapTournaments(origin: string): Promise<string> {
  return buildDynamicFanSitemapTournaments(origin);
}

/**
 * Check whether a string matches valid tournament identifier syntax.
 * Numeric ID (e.g. 25, 101) or alphanumeric auction code (e.g. VYAPARI, VS581307, RC732504).
 */
export function isTournamentSlugFormat(slug: string): boolean {
  const trimmed = slug.trim();
  if (!trimmed) return false;
  return /^\d+$/.test(trimmed) || /^[A-Za-z0-9_-]{3,64}$/.test(trimmed);
}

/**
 * Asynchronously check whether a tournament exists in the database by numeric ID or auctionCode.
 * Fail open on unexpected database errors to prevent transient database glitches from hard-404'ing legitimate users.
 */
export async function isTournamentExisting(slug: string): Promise<boolean> {
  const trimmed = slug.trim();
  if (!trimmed) return false;

  try {
    const isNumeric = /^\d+$/.test(trimmed);
    if (isNumeric) {
      const id = parseInt(trimmed, 10);
      const [row] = await db
        .select({ id: tournamentsTable.id })
        .from(tournamentsTable)
        .where(
          or(
            eq(tournamentsTable.id, id),
            sql`upper(${tournamentsTable.auctionCode}) = ${trimmed.toUpperCase()}`,
          ),
        )
        .limit(1);
      return Boolean(row);
    }

    if (/^[A-Za-z0-9_-]{3,64}$/.test(trimmed)) {
      const [row] = await db
        .select({ id: tournamentsTable.id })
        .from(tournamentsTable)
        .where(sql`upper(${tournamentsTable.auctionCode}) = ${trimmed.toUpperCase()}`)
        .limit(1);
      return Boolean(row);
    }

    return false;
  } catch (err) {
    logger.error({ err, slug }, "Error checking tournament existence for Fan Platform routing");
    // Fail open on transient DB failure
    return true;
  }
}

/**
 * Lightweight, accessible HTML 404 error document for nonexistent Fan Platform tournament URLs.
 * Emits `<meta name="robots" content="noindex, follow" />` so search crawlers never index invalid slugs.
 */
export function getFanNotFoundHtml(options?: { origin?: string; slug?: string }): string {
  const origin = options?.origin || "https://fan.bidwar.in";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Tournament Not Found | BidWar Fan Platform</title>
  <meta name="description" content="The requested tournament could not be found on the BidWar Fan Platform." />
  <meta name="robots" content="noindex, follow" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background-color: #0b101b;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      text-align: center;
    }
    .container {
      max-width: 28rem;
      width: 100%;
      background: #131b2e;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 1rem;
      padding: 2.5rem 2rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
    }
    .badge {
      display: inline-block;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #f59e0b;
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.2);
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      margin-bottom: 1.25rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 0.75rem;
      letter-spacing: -0.025em;
    }
    p {
      color: #94a3b8;
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #f59e0b;
      color: #0b101b;
      font-weight: 700;
      font-size: 0.9rem;
      padding: 0.75rem 1.5rem;
      border-radius: 0.5rem;
      text-decoration: none;
      transition: background-color 0.2s ease;
    }
    .btn:hover {
      background: #d97706;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="badge">404 &bull; Not Found</div>
    <h1>Tournament Not Found</h1>
    <p>The tournament you are looking for does not exist, may have expired, or is not available on the Fan Platform.</p>
    <a href="${origin}/" class="btn">Explore Public Tournaments</a>
  </div>
</body>
</html>`;
}

// ── Phase 2 & 3: Server-Rendered Tournament Pages, Metadata & Dynamic Discovery ──
export {
  handleFanTournamentRequest,
  fetchTournamentSeoData,
  evaluateFanTournamentEligibility,
  buildTournamentMeta,
  buildTournamentSsrHtml,
  injectFanTournamentHtml,
  buildTournamentJsonLd,
  buildDynamicFanSitemapTournaments,
  parsePublicSponsors,
  isValidIsoDate,
  parseValidTime24,
  getFirstValidMatchDate,
  resolveEventStartDate,
  safeJsonLdStringify,
  getCachedFanIndexHtml,
  resetCachedFanIndexHtml,
  type FanEligibilityResult,
  type TournamentMeta,
  type PublicTeamData,
  type PublicMatchData,
  type PublicSponsorLogo,
} from "./fan-tournament-seo.js";

