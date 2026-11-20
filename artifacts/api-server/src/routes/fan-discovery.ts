import { Router } from "express";
import {
  db,
  tournamentsTable,
  scoringMatchesTable,
  auctionSessionsTable,
  teamsTable,
  playersTable,
} from "@workspace/db";
import { eq, sql, inArray, and, not, ilike, desc } from "drizzle-orm";
import {
  resolveFanPageCapabilities,
  isAuctionEnabled,
  isScoringEnabled,
  isTournamentLicensed,
} from "@workspace/platform-core";

const router = Router();

function detectStreamProvider(
  url: string | null | undefined,
): "youtube" | "twitch" | "custom" | null {
  if (!url) return null;
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/twitch\.tv/i.test(url)) return "twitch";
  return "custom";
}

/**
 * Map tournament state to fan status.
 * CRITICAL RULE: Database status 'active' alone does NOT mean LIVE.
 * A tournament is LIVE only if an active match or active auction is underway.
 */
function resolveFanStatus(
  dbStatus: string | null,
  auctionDate: string | null,
  isLiveNow: boolean,
): "LIVE" | "UPCOMING" | "COMPLETED" | "TODAY" {
  if (isLiveNow) return "LIVE";
  if (dbStatus === "completed") return "COMPLETED";

  if (auctionDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(auctionDate);
    d.setHours(0, 0, 0, 0);
    if (d.getTime() === today.getTime()) return "TODAY";
    if (d > today) return "UPCOMING";
  }
  return "UPCOMING";
}

function isFeaturedActive(featuresJson: Record<string, unknown> | null, now: Date): boolean {
  if (!featuresJson) return false;
  if (featuresJson.featuredEnabled !== true) return false;

  const start = featuresJson.featuredStartDate
    ? new Date(featuresJson.featuredStartDate as string)
    : null;
  const end = featuresJson.featuredEndDate
    ? new Date(featuresJson.featuredEndDate as string)
    : null;

  if (start && now < start) return false;
  if (end && now > end) return false;
  return true;
}

router.get("/fan/tournaments", async (req, res) => {
  try {
    const {
      search = "",
      city = "",
      sport = "",
      status = "",
      module: moduleParam = "",
      featured: featuredParam = "",
      page: pageParam = "1",
      limit: limitParam = "50",
    } = req.query as Record<string, string>;

    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam, 10) || 50));

    // 1. Fetch tournaments from database.
    // Defense-in-depth: only active-licensed, non-locked, non-archived tournaments may enter public discovery
    const all = await db
      .select()
      .from(tournamentsTable)
      .where(
        and(
          eq(tournamentsTable.licenseStatus, "active"),
          eq(tournamentsTable.adminLocked, false),
          sql`status != 'archived'`,
        ),
      )
      .orderBy(sql`
        CASE status
          WHEN 'active' THEN 0
          WHEN 'upcoming' THEN 1
          ELSE 2
        END,
        COALESCE(auction_date, created_at::text)
      `);

    // 2. Fetch active live matches across tournaments
    const liveMatches = await db
      .select()
      .from(scoringMatchesTable)
      .where(inArray(scoringMatchesTable.status, ["live", "in_progress"]));

    // 3. Fetch active auction sessions
    const liveAuctions = await db
      .select()
      .from(auctionSessionsTable)
      .where(
        sql`${auctionSessionsTable.status} IN ('live', 'in_progress') OR (${auctionSessionsTable.currentPlayerId} IS NOT NULL AND ${auctionSessionsTable.status} != 'completed')`,
      );

    // 4. Collect referenced team and player IDs for live context previews
    const teamIds = new Set<number>();
    const playerIds = new Set<number>();

    for (const m of liveMatches) {
      if (m.homeTeamId) teamIds.add(m.homeTeamId);
      if (m.awayTeamId) teamIds.add(m.awayTeamId);
    }

    for (const a of liveAuctions) {
      if (a.currentBidTeamId) teamIds.add(a.currentBidTeamId);
      if (a.currentPlayerId) playerIds.add(a.currentPlayerId);
    }

    const teamsById = new Map<number, any>();
    if (teamIds.size > 0) {
      const teams = await db
        .select()
        .from(teamsTable)
        .where(inArray(teamsTable.id, Array.from(teamIds)));
      for (const t of teams) {
        teamsById.set(t.id, t);
      }
    }

    const playersById = new Map<number, any>();
    if (playerIds.size > 0) {
      const players = await db
        .select()
        .from(playersTable)
        .where(inArray(playersTable.id, Array.from(playerIds)));
      for (const p of players) {
        playersById.set(p.id, p);
      }
    }

    // 5. Index live matches and live auctions by tournamentId
    const liveMatchesByTourney = new Map<number, typeof liveMatches>();
    for (const m of liveMatches) {
      const existing = liveMatchesByTourney.get(m.tournamentId) || [];
      existing.push(m);
      liveMatchesByTourney.set(m.tournamentId, existing);
    }

    const liveAuctionsByTourney = new Map<number, (typeof liveAuctions)[0]>();
    for (const a of liveAuctions) {
      liveAuctionsByTourney.set(a.tournamentId, a);
    }

    const now = new Date();

    // 6. Filter to publicly visible tournaments
    const publicTournaments = [];
    for (const t of all) {
      const capabilities = await resolveFanPageCapabilities(t);
      if (capabilities.isPubliclyVisible && !/\[test\]|\[dev\]|\[demo\]/i.test(t.name)) {
        publicTournaments.push({ ...t, capabilities });
      }
    }

    // Build tournament live-state map
    const liveStateMap = new Map<
      number,
      {
        isLive: boolean;
        primaryLiveType: "auction" | "match" | "stream" | "none";
        liveMatchCount: number;
        isAuctionLive: boolean;
        isStreaming: boolean;
        liveMatchSummary?: any;
        liveAuctionSummary?: any;
      }
    >();

    for (const t of publicTournaments) {
      const matches = liveMatchesByTourney.get(t.id) || [];
      const auction = liveAuctionsByTourney.get(t.id);
      const fj = t.featuresJson as Record<string, unknown> | null;
      const rawStreamUrl = typeof fj?.liveStreamUrl === "string" ? fj.liveStreamUrl.trim() : null;
      const isTestMedia = rawStreamUrl ? /dqw4w9wgxcq|example\.com|test\.com|demo\.com|probe/i.test(rawStreamUrl) : false;
      const streamUrl = isTestMedia ? null : rawStreamUrl;
      const isStreaming = Boolean((fj?.liveStreamEnabled ?? fj?.streamingEnabled ?? Boolean(streamUrl)) && streamUrl);

      const isMatchLive = matches.length > 0;
      const isAuctionLive = Boolean(
        auction &&
          (auction.status === "in_progress" ||
            auction.status === "live" ||
            (auction.currentPlayerId !== null && auction.status !== "completed")),
      );
      const isLive = isMatchLive || isAuctionLive;

      let primaryLiveType: "auction" | "match" | "stream" | "none" = "none";
      if (isMatchLive) primaryLiveType = "match";
      else if (isAuctionLive) primaryLiveType = "auction";
      else if (isStreaming) primaryLiveType = "stream";

      let liveMatchSummary: any = null;
      if (isMatchLive) {
        const m = matches[0];
        const home = teamsById.get(m.homeTeamId);
        const away = teamsById.get(m.awayTeamId);
        const sJson = m.summaryJson as any;

        let scoreSummary = m.matchLabel || "Match in Progress";
        if (sJson?.innings?.[0]) {
          const inn = sJson.innings[0];
          scoreSummary = `${inn.runs ?? 0}/${inn.wickets ?? 0} (${inn.overs ?? 0} ov)`;
        }

        liveMatchSummary = {
          matchId: m.id,
          matchLabel: m.matchLabel ?? "Live Match",
          homeTeam: {
            id: m.homeTeamId,
            name: home?.name ?? "Home Team",
            shortName: home?.shortName ?? home?.name?.slice(0, 3)?.toUpperCase() ?? "HOM",
            logoUrl: home?.logoUrl ?? null,
          },
          awayTeam: {
            id: m.awayTeamId,
            name: away?.name ?? "Away Team",
            shortName: away?.shortName ?? away?.name?.slice(0, 3)?.toUpperCase() ?? "AWY",
            logoUrl: away?.logoUrl ?? null,
          },
          scoreSummary,
          targetSummary: sJson?.target ? `Target: ${sJson.target}` : null,
        };
      }

      let liveAuctionSummary: any = null;
      if (isAuctionLive && auction) {
        const player = auction.currentPlayerId ? playersById.get(auction.currentPlayerId) : null;
        const bidTeam = auction.currentBidTeamId ? teamsById.get(auction.currentBidTeamId) : null;

        liveAuctionSummary = {
          currentPlayerId: auction.currentPlayerId,
          currentPlayerName: player?.name ?? null,
          currentPlayerRole: player?.role ?? null,
          currentPlayerCategory: player?.category ?? null,
          currentPlayerPhotoUrl: player?.photoUrl ?? null,
          currentBid: auction.currentBid ?? null,
          currentBidTeamName: bidTeam?.name ?? null,
          currentBidTeamLogoUrl: bidTeam?.logoUrl ?? null,
          soldCount: auction.soldPlayersCount ?? 0,
          unsoldCount: auction.unsoldPlayersCount ?? 0,
          totalPlayers: (auction.soldPlayersCount ?? 0) + (auction.unsoldPlayersCount ?? 0),
        };
      }

      liveStateMap.set(t.id, {
        isLive,
        primaryLiveType,
        liveMatchCount: matches.length,
        isAuctionLive,
        isStreaming,
        liveMatchSummary,
        liveAuctionSummary,
      });
    }

    let items = publicTournaments;

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.city ?? "").toLowerCase().includes(q) ||
          (t.venue ?? "").toLowerCase().includes(q),
      );
    }

    // City filter
    if (city) {
      const c = city.toLowerCase();
      items = items.filter((t) => (t.city ?? "").toLowerCase().includes(c));
    }

    // Sport filter
    if (sport && sport !== "all") {
      items = items.filter((t) => (t.sport ?? "").toLowerCase() === sport.toLowerCase());
    }

    // Status filter — uses derived live state
    if (status && status !== "all") {
      items = items.filter((t) => {
        const isLive = liveStateMap.get(t.id)?.isLive ?? false;
        const fs = resolveFanStatus(t.status, t.auctionDate, isLive);
        if (status === "live") return fs === "LIVE";
        if (status === "upcoming") return fs === "UPCOMING" || fs === "TODAY";
        if (status === "completed") return fs === "COMPLETED";
        return true;
      });
    }

    // Module filter using actual entitlements
    if (moduleParam && moduleParam !== "all") {
      const m = moduleParam.toLowerCase();
      items = items.filter((t) => {
        const hasAuction = isAuctionEnabled(t);
        const hasScoring = isScoringEnabled(t);
        if (m === "both") return hasAuction && hasScoring;
        if (m === "auction_only") return hasAuction && !hasScoring;
        if (m === "scoring_only") return hasScoring && !hasAuction;
        if (m === "auction") return hasAuction;
        if (m === "scoring") return hasScoring;
        return false;
      });
    }

    // Featured filter
    if (featuredParam === "true") {
      items = items.filter((t) => {
        const isLive = liveStateMap.get(t.id)?.isLive ?? false;
        const fs = resolveFanStatus(t.status, t.auctionDate, isLive);
        return (
          isFeaturedActive(t.featuresJson as Record<string, unknown> | null, now) &&
          fs !== "COMPLETED"
        );
      });
    }

    // Pagination
    const total = items.length;
    const offset = (page - 1) * limit;
    const pageItems = items.slice(offset, offset + limit);

    // Build serialized fan summary DTOs
    const serialized = pageItems.map((t) => {
      const fj = t.featuresJson as Record<string, unknown> | null;
      const ls = liveStateMap.get(t.id) ?? {
        isLive: false,
        primaryLiveType: "none" as const,
        liveMatchCount: 0,
        isAuctionLive: false,
        isStreaming: false,
      };
      const fanStatus = resolveFanStatus(t.status, t.auctionDate, ls.isLive);
      const featured = isFeaturedActive(fj, now) && fanStatus !== "COMPLETED";

      const rawStreamUrl = typeof fj?.liveStreamUrl === "string" ? fj.liveStreamUrl.trim() : null;
      const isTestMedia = rawStreamUrl ? /dqw4w9wgxcq|example\.com|test\.com|demo\.com|probe/i.test(rawStreamUrl) : false;
      const streamUrl = isTestMedia ? null : rawStreamUrl;
      const streamingEnabled = Boolean((fj?.liveStreamEnabled ?? fj?.streamingEnabled ?? Boolean(streamUrl)) && streamUrl);

      return {
        slug: t.auctionCode ?? String(t.id),
        id: t.id,
        name: t.name,
        sport: t.sport ?? "cricket",
        status: fanStatus,
        dbStatus: t.status,
        city: t.city ?? null,
        venue: t.venue ?? null,
        auctionDate: t.auctionDate ?? null,
        auctionTime: t.auctionTime ?? null,
        organizerName: t.organizerName ?? null,
        logoUrl: t.logoUrl ?? null,
        mainBannerUrl: t.mainBannerUrl ?? null,
        mainBannerFit: t.mainBannerFit ?? "cover",
        sponsorLogos: t.sponsorLogos ?? null,
        capabilities: (t as any).capabilities,
        auctionEnabled: isAuctionEnabled(t),
        scoringEnabled: isScoringEnabled(t),
        licenseStatus: t.licenseStatus,
        isTrial: false,
        featured,
        featuredPriority: featured ? ((fj?.featuredPriority as number) ?? 0) : 0,
        featuredStartDate: fj?.featuredStartDate ?? null,
        featuredEndDate: fj?.featuredEndDate ?? null,
        liveState: {
          isLive: ls.isLive,
          primaryLiveType: ls.primaryLiveType,
          liveMatchCount: ls.liveMatchCount,
          isAuctionLive: ls.isAuctionLive,
          isStreaming: ls.isStreaming,
        },
        streamInfo: streamUrl
          ? {
              enabled: streamingEnabled,
              streamUrl,
              provider: detectStreamProvider(streamUrl),
            }
          : null,
        liveMatchSummary: ls.liveMatchSummary ?? null,
        liveAuctionSummary: ls.liveAuctionSummary ?? null,
      };
    });

    // Compute summary counts across all visible public items with accurate live derivations
    const summary = {
      live: publicTournaments.filter((t) => liveStateMap.get(t.id)?.isLive).length,
      upcoming: publicTournaments.filter((t) => {
        const isLive = liveStateMap.get(t.id)?.isLive ?? false;
        const s = resolveFanStatus(t.status, t.auctionDate, isLive);
        return s === "UPCOMING" || s === "TODAY";
      }).length,
      today: publicTournaments.filter((t) => {
        const isLive = liveStateMap.get(t.id)?.isLive ?? false;
        return resolveFanStatus(t.status, t.auctionDate, isLive) === "TODAY";
      }).length,
      completed: publicTournaments.filter((t) => {
        const isLive = liveStateMap.get(t.id)?.isLive ?? false;
        return resolveFanStatus(t.status, t.auctionDate, isLive) === "COMPLETED";
      }).length,
      modules: {
        all: publicTournaments.length,
        auction: publicTournaments.filter((t) => isAuctionEnabled(t)).length,
        scoring: publicTournaments.filter((t) => isScoringEnabled(t)).length,
        both: publicTournaments.filter((t) => isAuctionEnabled(t) && isScoringEnabled(t)).length,
      },
      total: publicTournaments.length,
    };

    // Optional organizer trials for logged-in organizer viewing fan home
    let organizerTrials: Array<any> | undefined = undefined;
    const user = req.jwtUser;
    if (user && (user.organizerAccountId || user.isAdmin || user.organizer)) {
      try {
        let trialRows: Array<typeof tournamentsTable.$inferSelect> = [];
        if (user.isAdmin) {
          trialRows = await db
            .select()
            .from(tournamentsTable)
            .where(
              and(
                eq(tournamentsTable.licenseStatus, "trial"),
                sql`status != 'archived'`,
              ),
            )
            .orderBy(desc(tournamentsTable.createdAt));
        } else if (user.organizerAccountId) {
          trialRows = await db
            .select()
            .from(tournamentsTable)
            .where(
              and(
                eq(tournamentsTable.licenseStatus, "trial"),
                eq(tournamentsTable.organizerId, user.organizerAccountId),
                sql`status != 'archived'`,
              ),
            )
            .orderBy(desc(tournamentsTable.createdAt));
        } else if (user.organizer) {
          const allowedIds = Object.keys(user.organizer).map(Number).filter((id) => !isNaN(id));
          if (allowedIds.length > 0) {
            trialRows = await db
              .select()
              .from(tournamentsTable)
              .where(
                and(
                  eq(tournamentsTable.licenseStatus, "trial"),
                  inArray(tournamentsTable.id, allowedIds),
                  sql`status != 'archived'`,
                ),
              )
              .orderBy(desc(tournamentsTable.createdAt));
          }
        }

        organizerTrials = trialRows.map((t) => ({
          id: t.id,
          slug: t.auctionCode ?? String(t.id),
          name: t.name,
          sport: t.sport ?? "cricket",
          status: t.status,
          city: t.city ?? null,
          venue: t.venue ?? null,
          auctionDate: t.auctionDate ?? null,
          auctionTime: t.auctionTime ?? null,
          logoUrl: t.logoUrl ?? null,
          licenseStatus: t.licenseStatus,
          auctionEnabled: isAuctionEnabled(t),
          scoringEnabled: isScoringEnabled(t),
          isTrial: true,
          featured: false,
        }));
      } catch (err) {
        console.error("[fan-discovery] Error loading organizer trials:", err);
      }
    }

    res.json({
      items: serialized,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      summary,
      ...(organizerTrials !== undefined && { organizerTrials }),
    });
  } catch (err) {
    console.error("[fan-discovery] Error:", err);
    res.status(500).json({ error: "Failed to fetch tournaments" });
  }
});

/**
 * Authenticated Organizer Trial Tournaments Endpoint
 * Strictly requires organizer authentication.
 * Returns only the requesting organizer's trial/unlicensed tournaments with basic metadata only.
 * No test players, bids, squads, or operational secrets are exposed.
 */
router.get(["/fan/trial-tournaments", "/fan/my-trial-tournaments"], async (req, res) => {
  try {
    const user = req.jwtUser;
    if (!user || (!user.organizerAccountId && !user.isAdmin && !user.organizer)) {
      res.status(401).json({ error: "Authentication required as organizer" });
      return;
    }

    let trialRows: Array<typeof tournamentsTable.$inferSelect> = [];
    if (user.isAdmin) {
      trialRows = await db
        .select()
        .from(tournamentsTable)
        .where(
          and(
            eq(tournamentsTable.licenseStatus, "trial"),
            sql`status != 'archived'`,
          ),
        )
        .orderBy(desc(tournamentsTable.createdAt));
    } else if (user.organizerAccountId) {
      trialRows = await db
        .select()
        .from(tournamentsTable)
        .where(
          and(
            eq(tournamentsTable.licenseStatus, "trial"),
            eq(tournamentsTable.organizerId, user.organizerAccountId),
            sql`status != 'archived'`,
          ),
        )
        .orderBy(desc(tournamentsTable.createdAt));
    } else if (user.organizer) {
      const allowedIds = Object.keys(user.organizer).map(Number).filter((id) => !isNaN(id));
      if (allowedIds.length > 0) {
        trialRows = await db
          .select()
          .from(tournamentsTable)
          .where(
            and(
              eq(tournamentsTable.licenseStatus, "trial"),
              inArray(tournamentsTable.id, allowedIds),
              sql`status != 'archived'`,
            ),
          )
          .orderBy(desc(tournamentsTable.createdAt));
      }
    }

    // Return strictly basic metadata
    const items = trialRows.map((t) => ({
      id: t.id,
      slug: t.auctionCode ?? String(t.id),
      name: t.name,
      sport: t.sport ?? "cricket",
      status: t.status, // basic status (setup, active, completed)
      city: t.city ?? null,
      venue: t.venue ?? null,
      auctionDate: t.auctionDate ?? null,
      auctionTime: t.auctionTime ?? null,
      logoUrl: t.logoUrl ?? null,
      licenseStatus: t.licenseStatus, // "trial"
      auctionEnabled: isAuctionEnabled(t),
      scoringEnabled: isScoringEnabled(t),
      isTrial: true,
      featured: false, // Trial tournaments must never be featured
    }));

    res.json({
      items,
      count: items.length,
    });
  } catch (err) {
    console.error("[fan-discovery:trial] Error:", err);
    res.status(500).json({ error: "Failed to fetch trial tournaments" });
  }
});

/**
 * Public Live Ticker Endpoint
 * Provides real-time activity events for live matches and auctions across tournaments.
 * Rules:
 * - Exclude unlicensed, trial and private tournaments.
 * - Exclude test, demo and latency-probe records.
 * - Exclude private and archived tournaments.
 * - Do not invent events.
 * - Avoid stale activity (only matches/auctions active within the last 24 hours).
 * - If no genuine live updates exist, provide verified completed/upcoming announcements.
 */
router.get("/fan/ticker", async (req, res) => {
  try {
    const events: Array<{
      id: string;
      tournamentId: number;
      tournamentName: string;
      sport: string;
      timestamp: string;
      message: string;
      type: "AUCTION" | "CRICKET" | "BADMINTON";
      badge?: string;
    }> = [];

    // Query actively licensed, non-archived, non-locked public tournaments only
    const activeTourneys = await db
      .select({
        id: tournamentsTable.id,
        name: tournamentsTable.name,
        sport: tournamentsTable.sport,
        licenseStatus: tournamentsTable.licenseStatus,
        adminLocked: tournamentsTable.adminLocked,
        featuresJson: tournamentsTable.featuresJson,
      })
      .from(tournamentsTable)
      .where(
        and(
          eq(tournamentsTable.licenseStatus, "active"),
          eq(tournamentsTable.adminLocked, false),
          sql`status != 'archived'`,
          not(ilike(tournamentsTable.name, "%[test]%")),
          not(ilike(tournamentsTable.name, "%[dev]%")),
          not(ilike(tournamentsTable.name, "%[demo]%")),
        ),
      );

    const publicTourneys = activeTourneys.filter((t) => {
      const fj = t.featuresJson as Record<string, unknown> | null;
      return fj?.visibility !== "private";
    });

    const tourneyMap = new Map(publicTourneys.map((t) => [t.id, t]));
    const activeTourneyIds = publicTourneys.map((t) => t.id);

    if (activeTourneyIds.length > 0) {
      // 1. Genuine live scoring matches (updated within last 24h, not test/probe)
      const liveMatches = await db
        .select({
          id: scoringMatchesTable.id,
          tournamentId: scoringMatchesTable.tournamentId,
          matchLabel: scoringMatchesTable.matchLabel,
          sportSlug: scoringMatchesTable.sportSlug,
          summaryJson: scoringMatchesTable.summaryJson,
          updatedAt: scoringMatchesTable.updatedAt,
        })
        .from(scoringMatchesTable)
        .where(
          and(
            inArray(scoringMatchesTable.status, ["live", "in_progress"]),
            inArray(scoringMatchesTable.tournamentId, activeTourneyIds),
            not(ilike(scoringMatchesTable.matchLabel, "%probe%")),
            not(ilike(scoringMatchesTable.matchLabel, "%test%")),
            not(ilike(scoringMatchesTable.matchLabel, "%latency%")),
            sql`${scoringMatchesTable.updatedAt} >= NOW() - INTERVAL '24 hours'`,
          ),
        )
        .limit(5);

      for (const m of liveMatches) {
        const tourney = tourneyMap.get(m.tournamentId);
        if (!tourney) continue;
        const sJson = m.summaryJson as any;
        let msg = `${m.matchLabel || "Match"} in progress`;
        if (sJson?.innings?.[0]) {
          const inn = sJson.innings[0];
          msg = `${inn.battingTeamName || "Batting"}: ${inn.runs ?? 0}/${inn.wickets ?? 0} in ${inn.overs ?? 0} ov`;
        }

        events.push({
          id: `match-${m.id}`,
          tournamentId: m.tournamentId,
          tournamentName: tourney.name,
          sport: m.sportSlug || "cricket",
          timestamp: m.updatedAt?.toISOString() || new Date().toISOString(),
          message: msg,
          type: m.sportSlug === "badminton" ? "BADMINTON" : "CRICKET",
          badge: "LIVE SCORE",
        });
      }

      // 2. Genuine live auction sessions (updated within last 24h)
      const liveAuctions = await db
        .select()
        .from(auctionSessionsTable)
        .where(
          and(
            sql`(${auctionSessionsTable.status} IN ('live', 'in_progress') OR (${auctionSessionsTable.currentPlayerId} IS NOT NULL AND ${auctionSessionsTable.status} != 'completed'))`,
            inArray(auctionSessionsTable.tournamentId, activeTourneyIds),
            sql`${auctionSessionsTable.updatedAt} >= NOW() - INTERVAL '24 hours'`,
          ),
        )
        .limit(5);

      for (const a of liveAuctions) {
        const tourney = tourneyMap.get(a.tournamentId);
        if (!tourney) continue;
        let msg = a.lastAction || "Auction session in progress";
        if (a.currentPlayerId) {
          const player = await db
            .select({ name: playersTable.name })
            .from(playersTable)
            .where(eq(playersTable.id, a.currentPlayerId))
            .limit(1);
          const pName = player[0]?.name;
          if (pName && !/probe|test/i.test(pName)) {
            msg = `Current Lot: ${pName}${a.currentBid ? ` · Current Bid: ₹${(a.currentBid / 100000).toFixed(2)}L` : ""}`;
          }
        }

        events.push({
          id: `auction-${a.id}`,
          tournamentId: a.tournamentId,
          tournamentName: tourney.name,
          sport: tourney.sport || "cricket",
          timestamp: a.updatedAt?.toISOString() || new Date().toISOString(),
          message: msg,
          type: "AUCTION",
          badge: "LIVE AUCTION",
        });
      }

      // 3. Recently verified player sold events (excluding test players)
      if (events.length < 5) {
        const soldPlayers = await db
          .select({
            id: playersTable.id,
            name: playersTable.name,
            soldPrice: playersTable.soldPrice,
            teamId: playersTable.teamId,
            tournamentId: playersTable.tournamentId,
            updatedAt: playersTable.updatedAt,
          })
          .from(playersTable)
          .where(
            and(
              eq(playersTable.status, "sold"),
              inArray(playersTable.tournamentId, activeTourneyIds),
              not(ilike(playersTable.name, "%test%")),
              not(ilike(playersTable.name, "%probe%")),
            ),
          )
          .orderBy(desc(playersTable.updatedAt))
          .limit(4);

        if (soldPlayers.length > 0) {
          const teamIds = soldPlayers.map((p) => p.teamId).filter((id): id is number => Boolean(id));
          const teams = teamIds.length > 0 ? await db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)) : [];
          const teamNameMap = new Map(teams.map((tm) => [tm.id, tm.name]));

          for (const sp of soldPlayers) {
            const tourney = tourneyMap.get(sp.tournamentId);
            if (!tourney) continue;
            const teamName = sp.teamId ? teamNameMap.get(sp.teamId) : null;
            const priceStr = sp.soldPrice
              ? (sp.soldPrice >= 10000000
                  ? `₹${(sp.soldPrice / 10000000).toFixed(2)} Cr`
                  : sp.soldPrice >= 100000
                  ? `₹${(sp.soldPrice / 100000).toFixed(2)} L`
                  : `₹${sp.soldPrice.toLocaleString("en-IN")}`)
              : null;
            const msg = teamName
              ? (priceStr ? `${sp.name} acquired by ${teamName} for ${priceStr}` : `${sp.name} acquired by ${teamName}`)
              : (priceStr ? `${sp.name} sold for ${priceStr}` : `${sp.name} confirmed sold`);

            events.push({
              id: `sold-${sp.id}`,
              tournamentId: sp.tournamentId,
              tournamentName: tourney.name,
              sport: tourney.sport || "cricket",
              timestamp: sp.updatedAt?.toISOString() || new Date().toISOString(),
              message: msg,
              type: "AUCTION",
              badge: "PLAYER SOLD",
            });
          }
        }
      }

      // 4. If still under limit, include recent completed match results (excluding test/probe)
      if (events.length < 5) {
        const recentCompleted = await db
          .select({
            id: scoringMatchesTable.id,
            tournamentId: scoringMatchesTable.tournamentId,
            matchLabel: scoringMatchesTable.matchLabel,
            sportSlug: scoringMatchesTable.sportSlug,
            summaryJson: scoringMatchesTable.summaryJson,
            updatedAt: scoringMatchesTable.updatedAt,
          })
          .from(scoringMatchesTable)
          .where(
            and(
              eq(scoringMatchesTable.status, "completed"),
              inArray(scoringMatchesTable.tournamentId, activeTourneyIds),
              not(ilike(scoringMatchesTable.matchLabel, "%probe%")),
              not(ilike(scoringMatchesTable.matchLabel, "%test%")),
              not(ilike(scoringMatchesTable.matchLabel, "%latency%")),
            ),
          )
          .orderBy(desc(scoringMatchesTable.updatedAt))
          .limit(3);

        for (const cm of recentCompleted) {
          const tourney = tourneyMap.get(cm.tournamentId);
          if (!tourney) continue;
          const sJson = cm.summaryJson as any;
          const resultMsg = sJson?.result || sJson?.winnerMessage || `${cm.matchLabel || "Match"} completed`;

          events.push({
            id: `completed-${cm.id}`,
            tournamentId: cm.tournamentId,
            tournamentName: tourney.name,
            sport: cm.sportSlug || "cricket",
            timestamp: cm.updatedAt?.toISOString() || new Date().toISOString(),
            message: resultMsg,
            type: cm.sportSlug === "badminton" ? "BADMINTON" : "CRICKET",
            badge: "RESULT",
          });
        }
      }
    }

    // 5. If no live or recent events exist, provide verified upcoming announcements (licensed public tournaments only)
    if (events.length === 0) {
      const upcoming = await db
        .select({
          id: tournamentsTable.id,
          name: tournamentsTable.name,
          sport: tournamentsTable.sport,
          city: tournamentsTable.city,
          venue: tournamentsTable.venue,
          auctionDate: tournamentsTable.auctionDate,
          featuresJson: tournamentsTable.featuresJson,
          auctionEnabled: tournamentsTable.auctionEnabled,
          scoringEnabled: tournamentsTable.scoringEnabled,
        })
        .from(tournamentsTable)
        .where(
          and(
            eq(tournamentsTable.licenseStatus, "active"),
            eq(tournamentsTable.adminLocked, false),
            sql`status != 'archived' AND status != 'completed'`,
            not(ilike(tournamentsTable.name, "%[test]%")),
            not(ilike(tournamentsTable.name, "%[dev]%")),
            not(ilike(tournamentsTable.name, "%[demo]%")),
          ),
        )
        .orderBy(sql`COALESCE(auction_date, created_at::text) ASC`)
        .limit(10);

      const publicUpcoming = upcoming
        .filter((t) => {
          const fj = t.featuresJson as Record<string, unknown> | null;
          const isPublic = fj?.visibility !== "private";
          const hasModule = isAuctionEnabled(t) || isScoringEnabled(t);
          return isPublic && hasModule;
        })
        .slice(0, 5);

      for (const t of publicUpcoming) {
        const location = t.city || t.venue || "India";
        const dateStr = t.auctionDate ? `on ${new Date(t.auctionDate).toLocaleDateString()}` : "coming soon";
        events.push({
          id: `upcoming-${t.id}`,
          tournamentId: t.id,
          tournamentName: t.name,
          sport: t.sport || "cricket",
          timestamp: new Date().toISOString(),
          message: `${t.name} scheduled ${dateStr} in ${location}`,
          type: t.sport === "badminton" ? "BADMINTON" : "CRICKET",
          badge: "UPCOMING",
        });
      }
    }

    res.json({ events });
  } catch (err) {
    console.error("[fan-ticker] Error:", err);
    res.status(500).json({ error: "Failed to fetch ticker events", events: [] });
  }
});

export default router;
