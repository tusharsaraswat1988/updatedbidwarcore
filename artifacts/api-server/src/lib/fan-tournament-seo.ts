import type { Request, Response } from "express";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { db, tournamentsTable, teamsTable, scoringMatchesTable } from "@workspace/db";
import { eq, or, and, sql } from "drizzle-orm";
import { isAuctionEnabled, isScoringEnabled } from "@workspace/platform-core";
import { logger } from "./logger.js";
import { getFanOrigin, getFanNotFoundHtml } from "./fan-seo-policy.js";

/** Escape HTML special characters for safe injection into raw HTML. */
export function esc(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export interface FanEligibilityResult {
  eligible: boolean;
  robots: string;
  statusLabel: string;
  isPrivate: boolean;
  reason: string;
}

export interface TournamentMeta {
  title: string;
  description: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  robots: string;
}

export interface PublicTeamData {
  id: number;
  name: string;
  shortCode: string;
  logoUrl: string | null;
  color: string | null;
  coachName: string | null;
}

export interface PublicMatchData {
  id: number;
  matchLabel: string | null;
  status: string | null;
  homeTeamId: number | null;
  awayTeamId: number | null;
  sportSlug: string | null;
}

export interface PublicSponsorLogo {
  url: string;
  name?: string;
  type?: string;
}

export type TournamentRow = typeof tournamentsTable.$inferSelect;

/** Parse public sponsor logos from tournaments.sponsor_logos JSON */
export function parsePublicSponsors(raw: string | null | undefined): PublicSponsorLogo[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
      .map((s) => ({
        url: typeof s.url === "string" ? s.url.trim() : "",
        name: typeof s.name === "string" ? s.name.trim() : undefined,
        type: typeof s.type === "string" ? s.type.trim() : undefined,
      }))
      .filter((s) => s.url.startsWith("http"));
  } catch {
    return [];
  }
}

/** Cached fan platform index.html template */
let cachedFanIndexHtml: string | null = null;
let cachedFanDistPath: string | null = null;

export function getCachedFanIndexHtml(fanDist: string): string {
  if (cachedFanIndexHtml && cachedFanDistPath === fanDist) {
    return cachedFanIndexHtml;
  }
  const indexPath = path.join(fanDist, "index.html");
  if (existsSync(indexPath)) {
    cachedFanIndexHtml = readFileSync(indexPath, "utf-8");
    cachedFanDistPath = fanDist;
    return cachedFanIndexHtml;
  }
  return "";
}

/** Reset in-memory cached template (useful for tests) */
export function resetCachedFanIndexHtml(): void {
  cachedFanIndexHtml = null;
  cachedFanDistPath = null;
}

/**
 * Fetch tournament and public child relations for server rendering.
 * Strictly queries public fields only; never selects sensitive organizer or owner data.
 */
export async function fetchTournamentSeoData(slug: string): Promise<{
  tournament: TournamentRow;
  teams: PublicTeamData[];
  matches: PublicMatchData[];
  sponsors: PublicSponsorLogo[];
} | null> {
  const trimmed = slug.trim();
  if (!trimmed) return null;

  try {
    const isNumeric = /^\d+$/.test(trimmed);
    let tournament: TournamentRow | undefined;

    if (isNumeric) {
      const id = parseInt(trimmed, 10);
      const rows = await db
        .select()
        .from(tournamentsTable)
        .where(
          or(
            eq(tournamentsTable.id, id),
            sql`upper(${tournamentsTable.auctionCode}) = ${trimmed.toUpperCase()}`,
          ),
        )
        .limit(1);
      tournament = rows[0];
    } else {
      const rows = await db
        .select()
        .from(tournamentsTable)
        .where(sql`upper(${tournamentsTable.auctionCode}) = ${trimmed.toUpperCase()}`)
        .limit(1);
      tournament = rows[0];
    }

    if (!tournament) {
      return null;
    }

    // Parallel fetch public teams and public matches (strictly limited)
    const [teams, matches] = await Promise.all([
      db
        .select({
          id: teamsTable.id,
          name: teamsTable.name,
          shortCode: teamsTable.shortCode,
          logoUrl: teamsTable.logoUrl,
          color: teamsTable.color,
          coachName: teamsTable.coachName,
        })
        .from(teamsTable)
        .where(eq(teamsTable.tournamentId, tournament.id))
        .limit(32),
      db
        .select({
          id: scoringMatchesTable.id,
          matchLabel: scoringMatchesTable.matchLabel,
          status: scoringMatchesTable.status,
          homeTeamId: scoringMatchesTable.homeTeamId,
          awayTeamId: scoringMatchesTable.awayTeamId,
          sportSlug: scoringMatchesTable.sportSlug,
        })
        .from(scoringMatchesTable)
        .where(eq(scoringMatchesTable.tournamentId, tournament.id))
        .limit(12),
    ]);

    const sponsors = parsePublicSponsors(tournament.sponsorLogos);

    return {
      tournament,
      teams,
      matches,
      sponsors,
    };
  } catch (err) {
    logger.error({ err, slug }, "Error fetching tournament SEO data from database");
    return null;
  }
}

/**
 * Canonical indexability & privacy evaluation based on BidWar visibility policy.
 */
export function evaluateFanTournamentEligibility(
  tournament: TournamentRow,
  teamsCount: number,
  matchesCount: number,
): FanEligibilityResult {
  // 1. Admin locked
  if (tournament.adminLocked) {
    return {
      eligible: false,
      robots: "noindex, nofollow",
      statusLabel: "Restricted",
      isPrivate: true,
      reason: "admin_locked",
    };
  }

  // 2. Explicitly private
  const features = (tournament.featuresJson ?? {}) as Record<string, unknown>;
  if (features?.visibility === "private") {
    return {
      eligible: false,
      robots: "noindex, nofollow",
      statusLabel: "Private",
      isPrivate: true,
      reason: "private",
    };
  }

  // 3. Test or demo tournament
  if (/\[test\]|\[dev\]|\[demo\]|\btest\b|\bdemo\b/i.test(tournament.name)) {
    return {
      eligible: false,
      robots: "noindex, nofollow",
      statusLabel: "Demo",
      isPrivate: false,
      reason: "test_demo",
    };
  }

  // 4. Archived tournament
  if (tournament.status === "archived") {
    return {
      eligible: false,
      robots: "noindex, nofollow",
      statusLabel: "Archived",
      isPrivate: false,
      reason: "archived",
    };
  }

  // 5. Trial or unlicensed tournament
  const isLicensed = tournament.licenseStatus === "active" || tournament.licenseStatus === "completed";
  if (!isLicensed) {
    return {
      eligible: false,
      robots: "noindex, follow",
      statusLabel: "Trial",
      isPrivate: false,
      reason: "trial_unlicensed",
    };
  }

  // 6. Incomplete / thin content tournament
  const isPlaceholderName = /^new tournament|^untitled/i.test(tournament.name.trim());
  const hasNoMeaningfulContent =
    teamsCount === 0 &&
    matchesCount === 0 &&
    !tournament.city &&
    !tournament.venue &&
    !tournament.auctionDate;

  if (isPlaceholderName || (tournament.status === "setup" && teamsCount === 0) || hasNoMeaningfulContent) {
    return {
      eligible: false,
      robots: "noindex, follow",
      statusLabel: "Setup",
      isPrivate: false,
      reason: "incomplete",
    };
  }

  // 7. Completed public tournament
  if (tournament.status === "completed" || tournament.licenseStatus === "completed") {
    return {
      eligible: true,
      robots: "index, follow",
      statusLabel: "Completed",
      isPrivate: false,
      reason: "completed_public",
    };
  }

  // 8. Active licensed public tournament
  return {
    eligible: true,
    robots: "index, follow",
    statusLabel: "Live",
    isPrivate: false,
    reason: "active_licensed",
  };
}

/**
 * Generate dynamic SEO metadata from verified tournament fields.
 * Incorporates:
 * - Module awareness: Auction only, Scoring only, Both
 * - Canonical URL normalization: auctionCode takes precedence over numeric ID
 * - Private tournament metadata masking: generic title/description without leaking tournament name
 */
export function buildTournamentMeta(options: {
  tournament: TournamentRow;
  slug: string;
  origin: string;
  eligibility: FanEligibilityResult;
  teamsCount: number;
}): TournamentMeta {
  const { tournament, origin, eligibility, teamsCount } = options;

  // Canonical normalization: Stable unique auctionCode is always canonical when present
  const canonicalSlug = (tournament.auctionCode && tournament.auctionCode.trim())
    ? tournament.auctionCode.trim()
    : String(tournament.id);
  const canonicalUrl = `${origin}/${encodeURIComponent(canonicalSlug)}`;

  // Module capability detection
  const auctionOn = isAuctionEnabled(tournament);
  const scoringOn = isScoringEnabled(tournament);
  const mode = auctionOn && scoringOn ? "both" : scoringOn ? "scoring_only" : "auction_only";

  const sport = (tournament.sport || "sports").trim();
  const sportCapitalized = sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();

  // Location string
  let locationStr = "";
  if (tournament.venue && tournament.city) {
    locationStr = ` at ${tournament.venue}, ${tournament.city}`;
  } else if (tournament.city) {
    locationStr = ` in ${tournament.city}`;
  } else if (tournament.venue) {
    locationStr = ` at ${tournament.venue}`;
  }

  // 1. Private or access-restricted tournament metadata (Strict masking)
  if (eligibility.isPrivate) {
    const title = "Private Tournament | BidWar Fan Platform";
    const description = "Private tournament hub on BidWar Fan Platform. Access is restricted to authorized tournament participants.";
    const ogImage = `${origin}/assets/branding/bidwar-clean-logo-v2.png`;
    return {
      title,
      description,
      canonicalUrl,
      ogTitle: title,
      ogDescription: description,
      ogImage,
      twitterTitle: title,
      twitterDescription: description,
      robots: eligibility.robots,
    };
  }

  // 2. Completed tournament metadata
  if (eligibility.reason === "completed_public") {
    const teamsPart = teamsCount > 0 ? ` featuring ${teamsCount} participating teams` : "";
    let title: string;
    let description: string;

    if (mode === "auction_only") {
      title = `${tournament.name} — Final Auction Results & Squads | BidWar Fan Platform`;
      description = `Official auction archive for ${tournament.name}${locationStr}. Review final player auction results, sold prices, and full team squads on BidWar Fan Platform${teamsPart}.`;
    } else if (mode === "scoring_only") {
      title = `${tournament.name} — Final ${sportCapitalized} Results & Standings | BidWar Fan Platform`;
      description = `Official tournament archive for ${tournament.name}${locationStr}. Review final ${sport} match results, tournament standings, and team squads on BidWar Fan Platform${teamsPart}.`;
    } else {
      title = `${tournament.name} — Final ${sportCapitalized} Results, Auction & Squads | BidWar Fan Platform`;
      description = `Official tournament archive for ${tournament.name}${locationStr}. Review final ${sport} results, match standings, player auction results, and full squads on BidWar Fan Platform${teamsPart}.`;
    }

    const ogImage = tournament.logoUrl || `${origin}/assets/branding/bidwar-clean-logo-v2.png`;
    return {
      title,
      description,
      canonicalUrl,
      ogTitle: title,
      ogDescription: description,
      ogImage,
      twitterTitle: title,
      twitterDescription: description,
      robots: eligibility.robots,
    };
  }

  // 3. Active / Upcoming / Setup Public tournament
  const teamsPart = teamsCount > 0 ? ` with ${teamsCount} participating teams` : "";
  let title: string;
  let description: string;

  if (mode === "auction_only") {
    title = `${tournament.name} — Live Player Auction, Team Purses & Squads | BidWar Fan Platform`;
    description = `Follow the official player auction for ${tournament.name}${locationStr}. Track live owner bidding, team purses, squads${teamsPart}, and sold player updates on BidWar Fan Platform.`;
  } else if (mode === "scoring_only") {
    title = `${tournament.name} — Live ${sportCapitalized} Scores, Fixtures & Standings | BidWar Fan Platform`;
    description = `Follow ${tournament.name} live on BidWar Fan Platform. Real-time ${sport} scoring, ball-by-ball updates, match fixtures, and tournament standings${locationStr}${teamsPart}.`;
  } else {
    title = `${tournament.name} — Live ${sportCapitalized} Scores, Auction & Teams | BidWar Fan Platform`;
    description = `Follow ${tournament.name} live on BidWar Fan Platform. Real-time ${sport} scoring, player auction updates, team rosters, and fixtures${locationStr}${teamsPart}.`;
  }

  const ogImage = tournament.logoUrl || `${origin}/assets/branding/bidwar-clean-logo-v2.png`;

  return {
    title,
    description,
    canonicalUrl,
    ogTitle: title,
    ogDescription: description,
    ogImage,
    twitterTitle: title,
    twitterDescription: description,
    robots: eligibility.robots,
  };
}

/**
 * Generate semantic, responsive server-rendered HTML for the initial response.
 */
export function buildTournamentSsrHtml(options: {
  tournament: TournamentRow;
  teams: PublicTeamData[];
  matches: PublicMatchData[];
  sponsors: PublicSponsorLogo[];
  eligibility: FanEligibilityResult;
  origin: string;
}): string {
  const { tournament, teams, matches, sponsors, eligibility } = options;
  const sport = (tournament.sport || "sports").trim();
  const sportCapitalized = sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();

  const auctionOn = isAuctionEnabled(tournament);
  const scoringOn = isScoringEnabled(tournament);
  const mode = auctionOn && scoringOn ? "both" : scoringOn ? "scoring_only" : "auction_only";

  // Sport icon
  let sportIcon = "🏆";
  const lowerSport = sport.toLowerCase();
  if (lowerSport === "cricket") sportIcon = "🏏";
  else if (lowerSport === "badminton") sportIcon = "🏸";
  else if (lowerSport === "football") sportIcon = "⚽";

  // Status badge
  let statusBadgeClass = "fan-ssr-badge-setup";
  let statusText = eligibility.statusLabel.toUpperCase();
  if (eligibility.reason === "active_licensed") {
    statusBadgeClass = "fan-ssr-badge-live";
    statusText = "LIVE";
  } else if (eligibility.reason === "completed_public") {
    statusBadgeClass = "fan-ssr-badge-completed";
    statusText = "COMPLETED";
  } else if (eligibility.reason === "incomplete") {
    statusBadgeClass = "fan-ssr-badge-setup";
    statusText = "UPCOMING";
  }

  // Hero description text based on active modules
  let heroDesc = "";
  if (mode === "auction_only") {
    heroDesc = `Official spectator fan platform for ${esc(tournament.name)}. Follow live player auctions, real-time owner bidding, team purse balances, and team squads.`;
  } else if (mode === "scoring_only") {
    heroDesc = `Official spectator fan platform for ${esc(tournament.name)}. Follow real-time ${esc(sport)} scoring, live ball-by-ball commentary, team standings, and match fixtures.`;
  } else {
    heroDesc = `Official spectator fan platform for ${esc(tournament.name)}. Follow real-time ${esc(sport)} scoring, team rosters, match fixtures, and live player auction updates.`;
  }

  // Map match home/away teams
  const teamMap = new Map<number, PublicTeamData>();
  for (const t of teams) {
    teamMap.set(t.id, t);
  }

  return `
    <div class="fan-ssr-container">
      <style id="fan-ssr-inline-css">
        .fan-ssr-container {
          background-color: #0B101B;
          color: #F1F5F9;
          font-family: Inter, system-ui, -apple-system, sans-serif;
          min-height: 100vh;
          padding: 1.5rem 1rem 3rem;
          max-width: 1100px;
          margin: 0 auto;
          box-sizing: border-box;
        }
        .fan-ssr-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 2rem 1rem;
          border-radius: 1.25rem;
          background: linear-gradient(180deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.2) 100%);
          border: 1px solid rgba(255, 255, 255, 0.08);
          margin-bottom: 2rem;
        }
        .fan-ssr-logo {
          width: 88px;
          height: 88px;
          border-radius: 1rem;
          object-fit: cover;
          border: 2px solid rgba(245, 158, 11, 0.4);
          background-color: #1E293B;
          margin-bottom: 1.25rem;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }
        .fan-ssr-logo-placeholder {
          width: 88px;
          height: 88px;
          border-radius: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.5rem;
          background: rgba(245, 158, 11, 0.1);
          border: 2px solid rgba(245, 158, 11, 0.3);
          margin-bottom: 1.25rem;
        }
        .fan-ssr-title {
          font-family: Oswald, Inter, system-ui, sans-serif;
          font-size: clamp(1.75rem, 5vw, 2.5rem);
          font-weight: 700;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: #FFFFFF;
          margin: 0 0 0.75rem 0;
          line-height: 1.2;
        }
        .fan-ssr-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
          margin-bottom: 1.25rem;
        }
        .fan-ssr-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .fan-ssr-badge-sport {
          background: rgba(59, 130, 246, 0.15);
          color: #60A5FA;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }
        .fan-ssr-badge-live {
          background: rgba(239, 68, 68, 0.2);
          color: #F87171;
          border: 1px solid rgba(239, 68, 68, 0.4);
        }
        .fan-ssr-badge-completed {
          background: rgba(16, 185, 129, 0.15);
          color: #34D399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }
        .fan-ssr-badge-setup {
          background: rgba(245, 158, 11, 0.15);
          color: #FBBF24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }
        .fan-ssr-badge-location {
          background: rgba(255, 255, 255, 0.06);
          color: #CBD5E1;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .fan-ssr-desc {
          font-size: 0.95rem;
          line-height: 1.6;
          color: #94A3B8;
          max-width: 680px;
          margin: 0 auto;
        }
        .fan-ssr-section {
          margin-bottom: 2rem;
        }
        .fan-ssr-section-title {
          font-family: Oswald, Inter, sans-serif;
          font-size: 1.25rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #F8FAFC;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .fan-ssr-teams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 0.75rem;
        }
        .fan-ssr-team-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }
        .fan-ssr-team-logo {
          width: 36px;
          height: 36px;
          border-radius: 0.5rem;
          object-fit: cover;
          background-color: #1E293B;
        }
        .fan-ssr-team-badge {
          width: 36px;
          height: 36px;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 0.8rem;
          color: #FFFFFF;
        }
        .fan-ssr-team-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .fan-ssr-team-name {
          font-size: 0.875rem;
          font-weight: 600;
          color: #FFFFFF;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fan-ssr-team-code {
          font-size: 0.75rem;
          color: #94A3B8;
        }
        .fan-ssr-matches-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .fan-ssr-match-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.875rem 1rem;
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }
        .fan-ssr-match-teams {
          font-size: 0.9rem;
          font-weight: 600;
          color: #F1F5F9;
        }
        .fan-ssr-match-status {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.2rem 0.5rem;
          border-radius: 0.35rem;
          background: rgba(255, 255, 255, 0.08);
          color: #E2E8F0;
        }
        .fan-ssr-sponsors-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.75rem;
        }
        .fan-ssr-sponsor-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          border-radius: 0.75rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .fan-ssr-sponsor-logo {
          width: 40px;
          height: 40px;
          border-radius: 0.5rem;
          object-fit: contain;
          background-color: #FFFFFF;
          padding: 2px;
        }
        .fan-ssr-sponsor-info {
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .fan-ssr-sponsor-role {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          color: #F59E0B;
          letter-spacing: 0.05em;
        }
        .fan-ssr-sponsor-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #F8FAFC;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .fan-ssr-private-box {
          padding: 2rem;
          border-radius: 1rem;
          background: rgba(239, 68, 68, 0.08);
          border: 1px solid rgba(239, 68, 68, 0.2);
          text-align: center;
          color: #FCA5A5;
          margin-bottom: 2rem;
        }
        .fan-ssr-footer {
          margin-top: 2rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.8rem;
          color: #64748B;
        }
        .fan-ssr-spinner {
          display: inline-block;
          width: 14px;
          height: 14px;
          border: 2px solid rgba(245, 158, 11, 0.3);
          border-radius: 50%;
          border-top-color: #F59E0B;
          animation: fan-ssr-spin 1s ease-in-out infinite;
          vertical-align: middle;
          margin-right: 0.5rem;
        }
        @keyframes fan-ssr-spin {
          to { transform: rotate(360deg); }
        }
      </style>

      <header class="fan-ssr-hero" role="banner">
        ${
          !eligibility.isPrivate && tournament.logoUrl
            ? `<img src="${esc(tournament.logoUrl)}" alt="${esc(tournament.name)} Logo" class="fan-ssr-logo" />`
            : `<div class="fan-ssr-logo-placeholder">${sportIcon}</div>`
        }
        <h1 class="fan-ssr-title">${esc(eligibility.isPrivate ? "Private Tournament" : tournament.name)}</h1>
        <div class="fan-ssr-badges">
          <span class="fan-ssr-badge fan-ssr-badge-sport">${sportIcon} ${esc(sportCapitalized)}</span>
          <span class="fan-ssr-badge ${statusBadgeClass}">${esc(statusText)}</span>
          ${
            !eligibility.isPrivate && tournament.city
              ? `<span class="fan-ssr-badge fan-ssr-badge-location">📍 ${esc(tournament.city)}</span>`
              : ""
          }
          ${
            !eligibility.isPrivate && tournament.venue && !tournament.city
              ? `<span class="fan-ssr-badge fan-ssr-badge-location">🏟️ ${esc(tournament.venue)}</span>`
              : ""
          }
        </div>
        <p class="fan-ssr-desc">${esc(eligibility.isPrivate ? "This tournament is private. Access to squads, scoring, and player details is restricted to authorized participants." : heroDesc)}</p>
      </header>

      ${
        eligibility.isPrivate
          ? `
            <div class="fan-ssr-private-box" role="alert">
              <strong>🔒 Protected Tournament</strong>
              <p style="margin-top: 0.5rem; font-size: 0.875rem;">
                This tournament is marked private or restricted. Access to squads, scoring, and player details is restricted to authorized participants.
              </p>
            </div>
          `
          : `
            ${
              teams.length > 0
                ? `
                  <section class="fan-ssr-section" aria-label="Participating Teams">
                    <h2 class="fan-ssr-section-title">Participating Teams (${teams.length})</h2>
                    <div class="fan-ssr-teams-grid">
                      ${teams
                        .map((team) => {
                          const initial = (team.shortCode || team.name || "T").slice(0, 3).toUpperCase();
                          return `
                            <div class="fan-ssr-team-card">
                              ${
                                team.logoUrl
                                  ? `<img src="${esc(team.logoUrl)}" alt="${esc(team.name)}" class="fan-ssr-team-logo" loading="lazy" />`
                                  : `<div class="fan-ssr-team-badge" style="background-color: ${esc(team.color || "#3B82F6")}">${esc(initial)}</div>`
                              }
                              <div class="fan-ssr-team-info">
                                <span class="fan-ssr-team-name">${esc(team.name)}</span>
                                <span class="fan-ssr-team-code">${esc(team.shortCode)}</span>
                              </div>
                            </div>
                          `;
                        })
                        .join("")}
                    </div>
                  </section>
                `
                : ""
            }

            ${
              matches.length > 0 && mode !== "auction_only"
                ? `
                  <section class="fan-ssr-section" aria-label="Matches and Fixtures">
                    <h2 class="fan-ssr-section-title">Matches & Fixtures</h2>
                    <div class="fan-ssr-matches-list">
                      ${matches
                        .slice(0, 6)
                        .map((m) => {
                          const home = m.homeTeamId ? teamMap.get(m.homeTeamId)?.name : null;
                          const away = m.awayTeamId ? teamMap.get(m.awayTeamId)?.name : null;
                          const matchTitle = home && away ? `${home} vs ${away}` : (m.matchLabel || `Match #${m.id}`);
                          const status = (m.status || "scheduled").toUpperCase();
                          return `
                            <div class="fan-ssr-match-card">
                              <span class="fan-ssr-match-teams">${esc(matchTitle)}</span>
                              <span class="fan-ssr-match-status">${esc(status)}</span>
                            </div>
                          `;
                        })
                        .join("")}
                    </div>
                  </section>
                `
                : ""
            }

            ${
              sponsors.length > 0
                ? `
                  <section class="fan-ssr-section" aria-label="Official Sponsors & Partners">
                    <h2 class="fan-ssr-section-title">Official Partners</h2>
                    <div class="fan-ssr-sponsors-grid">
                      ${sponsors
                        .map((s) => `
                          <div class="fan-ssr-sponsor-card">
                            <img src="${esc(s.url)}" alt="${esc(s.name || s.type || "Partner")}" class="fan-ssr-sponsor-logo" loading="lazy" />
                            <div class="fan-ssr-sponsor-info">
                              ${s.type ? `<span class="fan-ssr-sponsor-role">${esc(s.type)}</span>` : ""}
                              ${s.name ? `<span class="fan-ssr-sponsor-name">${esc(s.name)}</span>` : ""}
                            </div>
                          </div>
                        `)
                        .join("")}
                    </div>
                  </section>
                `
                : ""
            }
          `
      }

      <footer class="fan-ssr-footer">
        ${
          !eligibility.isPrivate && tournament.organizerName
            ? `<div>Organized by <strong style="color: #E2E8F0;">${esc(tournament.organizerName)}</strong></div>`
            : ""
        }
        <div>
          <span class="fan-ssr-spinner"></span> Connecting to live spectator feed...
        </div>
      </footer>
    </div>
  `;
}

/**
 * Validate ISO date string (YYYY-MM-DD).
 */
export function isValidIsoDate(str: string | null | undefined): boolean {
  if (!str || typeof str !== "string") return false;
  const trimmed = str.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  const d = new Date(trimmed);
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === trimmed;
}

/**
 * Strict 24-hour time parsing (HH:mm or HH:mm:ss).
 * Rejects free text like "10 AM" or invalid hours/minutes like "25:00".
 */
export function parseValidTime24(timeStr: string | null | undefined): string | null {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  const match = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/);
  if (!match) return null;
  const hours = match[1];
  const minutes = match[2];
  const seconds = match[3] ?? "00";
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Extract first valid match date from comma-separated matchDates string.
 */
export function getFirstValidMatchDate(matchDates: string | null | undefined): string | null {
  if (!matchDates || typeof matchDates !== "string") return null;
  const parts = matchDates.split(",");
  for (const part of parts) {
    const trimmed = part.trim();
    if (isValidIsoDate(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Resolve reliable sporting event start date for SportsEvent JSON-LD.
 * - Scoring-only: use first valid match date from matchDates.
 * - Auction-only: use auctionDate only if valid.
 * - Combined modules: prefer actual sporting event match date; fallback to auctionDate if reliable.
 * - Omit if no reliable date exists.
 */
export function resolveEventStartDate(tournament: TournamentRow): string | null {
  const auctionOn = isAuctionEnabled(tournament);
  const scoringOn = isScoringEnabled(tournament);
  const mode = auctionOn && scoringOn ? "both" : scoringOn ? "scoring_only" : "auction_only";

  const matchDate = getFirstValidMatchDate(tournament.matchDates);
  const auctionDateValid = isValidIsoDate(tournament.auctionDate);
  const validTime = parseValidTime24(tournament.auctionTime);

  if (mode === "scoring_only") {
    // Scoring-only: strictly use the first valid actual match date from matchDates
    return matchDate;
  }

  if (mode === "both") {
    // Combined modules: prefer actual sporting event date when available
    if (matchDate) {
      return matchDate;
    }
    // Fallback to valid auctionDate
    if (auctionDateValid && tournament.auctionDate) {
      return `${tournament.auctionDate.trim()}${validTime ? `T${validTime}` : ""}`;
    }
    return null;
  }

  // Auction-only: event is the player auction itself
  if (auctionDateValid && tournament.auctionDate) {
    return `${tournament.auctionDate.trim()}${validTime ? `T${validTime}` : ""}`;
  }

  return null;
}

/**
 * Safely serialize JSON-LD schema into JSON, escaping '<' as '\u003c'.
 * Prevents premature closing of <script> tag via embedded '</script>' in strings.
 */
export function safeJsonLdStringify(schema: object): string {
  return JSON.stringify(schema, null, 2).replace(/</g, "\\u003c");
}

/**
 * Generate JSON-LD Structured Data:
 * - SportsEvent (name, sport, eventStatus, location, organizer, competitors, sponsors, image)
 * - BreadcrumbList (Home > Tournament)
 * Suppresses private tournament schemas.
 */
export function buildTournamentJsonLd(options: {
  tournament: TournamentRow;
  teams: PublicTeamData[];
  sponsors: PublicSponsorLogo[];
  eligibility: FanEligibilityResult;
  meta: TournamentMeta;
  origin: string;
}): object[] {
  const { tournament, teams, sponsors, eligibility, meta, origin } = options;

  if (eligibility.isPrivate) {
    return [
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": origin,
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Private Tournament",
            "item": meta.canonicalUrl,
          },
        ],
      },
    ];
  }

  const sport = (tournament.sport || "Sports").trim();
  const sportCapitalized = sport.charAt(0).toUpperCase() + sport.slice(1).toLowerCase();

  const eventStatus =
    tournament.status === "completed" || tournament.licenseStatus === "completed"
      ? "https://schema.org/EventCompleted"
      : "https://schema.org/EventScheduled";

  const sportsEvent: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": tournament.name,
    "description": meta.description,
    "url": meta.canonicalUrl,
    "sport": sportCapitalized,
    "eventStatus": eventStatus,
    "image": meta.ogImage,
  };

  const startDate = resolveEventStartDate(tournament);
  if (startDate) {
    sportsEvent.startDate = startDate;
  }

  if (tournament.venue || tournament.city) {
    sportsEvent.location = {
      "@type": "Place",
      "name": tournament.venue || tournament.city,
      ...(tournament.city
        ? {
            "address": {
              "@type": "PostalAddress",
              "addressLocality": tournament.city,
              "addressCountry": "IN",
            },
          }
        : {}),
    };
  }

  if (tournament.organizerName) {
    sportsEvent.organizer = {
      "@type": "Organization",
      "name": tournament.organizerName,
      "url": origin,
    };
  }

  if (teams.length > 0) {
    sportsEvent.competitor = teams.map((team) => ({
      "@type": "SportsTeam",
      "name": team.name,
    }));
  }

  if (sponsors.length > 0) {
    sportsEvent.sponsor = sponsors.map((s) => ({
      "@type": "Organization",
      "name": s.name || s.type || "Official Partner",
      ...(s.url ? { "image": s.url } : {}),
    }));
  }

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": origin,
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": tournament.name,
        "item": meta.canonicalUrl,
      },
    ],
  };

  return [sportsEvent, breadcrumbs];
}

/**
 * Inject dynamic SEO metadata, JSON-LD, and server-rendered HTML into the cached Fan SPA index.html shell.
 */
export function injectFanTournamentHtml(
  templateHtml: string,
  meta: TournamentMeta,
  ssrContent: string,
  jsonLdSchemas: object[] = [],
): string {
  let result = templateHtml;

  // 1. Replace <title>...</title>
  if (/<title>[\s\S]*?<\/title>/i.test(result)) {
    result = result.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`);
  } else {
    result = result.replace(/<\/head>/i, `  <title>${esc(meta.title)}</title>\n</head>`);
  }

  // 2. Build full dynamic meta block
  const metaTags = [
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<meta name="robots" content="${esc(meta.robots)}" />`,
    `<link rel="canonical" href="${esc(meta.canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="BidWar Fan Platform" />`,
    `<meta property="og:title" content="${esc(meta.ogTitle)}" />`,
    `<meta property="og:description" content="${esc(meta.ogDescription)}" />`,
    `<meta property="og:url" content="${esc(meta.canonicalUrl)}" />`,
    `<meta property="og:image" content="${esc(meta.ogImage)}" />`,
    `<meta property="og:locale" content="en_IN" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:site" content="@bidwar_in" />`,
    `<meta name="twitter:title" content="${esc(meta.twitterTitle)}" />`,
    `<meta name="twitter:description" content="${esc(meta.twitterDescription)}" />`,
    `<meta name="twitter:image" content="${esc(meta.ogImage)}" />`,
  ];

  // 3. Add JSON-LD schema scripts (hardened against premature script termination)
  if (jsonLdSchemas.length > 0) {
    for (const schema of jsonLdSchemas) {
      metaTags.push(`<script type="application/ld+json">\n${safeJsonLdStringify(schema)}\n</script>`);
    }
  }

  const injectedMeta = metaTags.join("\n    ");

  // Replace existing meta description or append to head
  if (/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i.test(result)) {
    result = result.replace(
      /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/i,
      injectedMeta,
    );
  } else {
    result = result.replace(/<\/head>/i, `    ${injectedMeta}\n  </head>`);
  }

  // 4. Inject server-rendered content into <div id="root"></div>
  if (/<div\s+id="root">\s*<\/div>/i.test(result)) {
    result = result.replace(/<div\s+id="root">\s*<\/div>/i, `<div id="root">${ssrContent}</div>`);
  } else if (/id="root">/i.test(result)) {
    result = result.replace(/id="root">/i, `id="root">${ssrContent}`);
  }

  return result;
}

/**
 * Dynamic Fan Tournament Sitemap generator for https://fan.bidwar.in/sitemap-tournaments.xml
 * Queries eligible, public, licensed tournaments from database and builds standard XML.
 */
export async function buildDynamicFanSitemapTournaments(origin: string): Promise<string> {
  try {
    const rows = await db
      .select()
      .from(tournamentsTable)
      .where(
        and(
          or(
            eq(tournamentsTable.licenseStatus, "active"),
            eq(tournamentsTable.licenseStatus, "completed"),
          ),
          eq(tournamentsTable.adminLocked, false),
          sql`status != 'archived'`,
        ),
      )
      .orderBy(tournamentsTable.id);

    const eligibleEntries: Array<{ loc: string }> = [];
    const seenUrls = new Set<string>();

    for (const t of rows) {
      // 1. Initial quick checks
      const features = (t.featuresJson ?? {}) as Record<string, unknown>;
      if (features?.visibility === "private") continue;
      if (t.adminLocked) continue;
      if (t.status === "archived") continue;
      if (/\[test\]|\[dev\]|\[demo\]|\btest\b|\bdemo\b/i.test(t.name)) continue;

      // 2. Query team count to evaluate completeness / setup validity
      let teamsCount = 0;
      try {
        const teams = await db
          .select({ id: teamsTable.id, shortCode: teamsTable.shortCode })
          .from(teamsTable)
          .where(eq(teamsTable.tournamentId, t.id))
          .limit(1);
        teamsCount = teams.length;
      } catch {
        // Fallback gracefully on query error
      }

      // 3. Strict alignment with canonical page-level eligibility
      // A tournament that returns noindex must NEVER appear in the sitemap.
      const eligibility = evaluateFanTournamentEligibility(t, teamsCount, 0);
      if (!eligibility.eligible) continue;

      // 4. Resolve canonical slug: unique auctionCode first, otherwise numeric ID
      const canonicalSlug = (t.auctionCode && t.auctionCode.trim())
        ? t.auctionCode.trim()
        : String(t.id);

      const loc = `${origin}/${encodeURIComponent(canonicalSlug)}`;
      if (seenUrls.has(loc)) continue;
      seenUrls.add(loc);

      eligibleEntries.push({ loc });
    }

    const urlTags = eligibleEntries
      .map((entry) => `  <url>\n    <loc>${esc(entry.loc)}</loc>\n  </url>`)
      .join("\n");

    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      urlTags,
      `</urlset>`,
    ]
      .filter(Boolean)
      .join("\n");
  } catch (err) {
    logger.error({ err }, "Error building dynamic fan tournaments sitemap");
    return [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      `</urlset>`,
    ].join("\n");
  }
}

/**
 * Handle incoming Fan Platform tournament request:
 * - Fetches tournament from database
 * - Validates existence (genuine 404 if missing)
 * - Evaluates indexability and robots directive
 * - Generates tournament-specific metadata, JSON-LD, and server-rendered HTML
 * - Supports HEAD requests without body
 */
export async function handleFanTournamentRequest(options: {
  req: Request;
  res: Response;
  fanDist: string;
  slug: string;
}): Promise<void> {
  const { req, res, fanDist, slug } = options;
  const origin = getFanOrigin(req);

  try {
    const seoData = await fetchTournamentSeoData(slug);

    // 1. Nonexistent tournament -> HTTP 404
    if (!seoData) {
      res.status(404);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("X-Robots-Tag", "noindex, follow");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      res.send(getFanNotFoundHtml({ origin, slug }));
      return;
    }

    const { tournament, teams, matches, sponsors } = seoData;

    // 2. Evaluate indexability and access rules
    const eligibility = evaluateFanTournamentEligibility(tournament, teams.length, matches.length);

    // 3. Generate dynamic metadata
    const meta = buildTournamentMeta({
      tournament,
      slug,
      origin,
      eligibility,
      teamsCount: teams.length,
    });

    // 4. Generate server-rendered HTML
    const ssrContent = buildTournamentSsrHtml({
      tournament,
      teams,
      matches,
      sponsors,
      eligibility,
      origin,
    });

    // 5. Generate JSON-LD Structured Data
    const jsonLdSchemas = buildTournamentJsonLd({
      tournament,
      teams,
      sponsors,
      eligibility,
      meta,
      origin,
    });

    // 6. Inject into cached fan template
    const template = getCachedFanIndexHtml(fanDist);
    const finalHtml = injectFanTournamentHtml(template, meta, ssrContent, jsonLdSchemas);

    // 7. Set response headers
    res.status(200);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("X-Robots-Tag", eligibility.robots);

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    res.send(finalHtml);
  } catch (err) {
    logger.error({ err, slug }, "Error rendering fan tournament page, falling back to static template");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (req.method === "HEAD") {
      res.status(200).end();
      return;
    }
    const template = getCachedFanIndexHtml(fanDist);
    res.status(200).send(template);
  }
}
