import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import {
  tournamentsTable,
  teamsTable,
  scoringMatchesTable,
} from "@workspace/db";
import { eq, and, or, sql, ilike, inArray, desc, asc } from "drizzle-orm";
import {
  resolveTournamentVisibility,
  resolveTournamentFeatures,
  type TournamentVisibility,
} from "@workspace/platform-core/tournament-features";
import {
  isAuctionEnabled,
  isScoringEnabled,
  tryResolveTournamentProductMode,
  resolvePublicBroadcasts,
  evaluateFanArenaEligibility,
  type BroadcastLinkConfig,
} from "@workspace/platform-core";
import { canAccessPrivateTournamentData } from "../middleware/require-organizer";
import { publicTournamentSerializer } from "../lib/serializers/tournament";
import {
  secureComparePins,
  checkPinRateLimit,
  recordPinAttempt,
} from "../lib/pin-security";

const router = Router();

export const fanDiscoveryQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  sport: z.enum(["all", "cricket", "badminton", "football", "other"]).default("all"),
  status: z.enum(["all", "live", "upcoming", "completed"]).default("all"),
  module: z.enum(["all", "auction", "scoring", "both"]).default("all"),
  city: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(["live_first", "upcoming_date", "newest", "name"]).default("live_first"),
});

export type FanDiscoveryQueryParams = z.infer<typeof fanDiscoveryQuerySchema>;

export interface PublicBroadcastDto {
  auction?: {
    url: string;
    platform?: string;
    status: "live" | "upcoming" | "ended";
    title?: string;
  };
  scoring?: {
    url: string;
    platform?: string;
    status: "live" | "upcoming" | "ended";
    title?: string;
  };
}

export interface FanDiscoveryCardDto {
  id: number;
  name: string;
  code: string | null;
  sport: string;
  city: string | null;
  venue: string | null;
  organizerName: string | null;
  logoUrl: string | null;
  status: string;
  auctionDate: string | null;
  auctionTime: string | null;
  matchDates: string | null;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  productMode: "auction_only" | "scoring_only" | "both";
  isLive: boolean;
  liveType?: "auction" | "scoring" | null;
  liveSnippet?: string | null;
  teamsCount?: number;
  featured?: boolean;
  broadcast?: PublicBroadcastDto | null;
}

export interface FanDiscoveryResponseDto {
  items: FanDiscoveryCardDto[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
  summary: {
    liveCount: number;
    upcomingTodayCount: number;
    totalCount: number;
  };
}

/**
 * GET /api/fan/tournaments
 * Universal public tournament discovery for spectators.
 * Strictly enforces visibility = 'public' and strips all internal/private data.
 */
router.get("/fan/tournaments", async (req: Request, res: Response): Promise<void> => {
  const parsed = fanDiscoveryQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      issues: parsed.error.issues,
    });
    return;
  }

  const { search, sport, status, module, city, page, limit, sortBy } = parsed.data;

  // 1. Mandatory Public Discovery Filters (Phase 5 Curation & Privacy Contract)
  // Strictly enforce visibility = 'public' in SQL, exclude locked & test records, require opt-in & licensed/approved
  const baseConditions = [
    sql`COALESCE(${tournamentsTable.featuresJson}->>'visibility', 'public') = 'public'`,
    eq(tournamentsTable.adminLocked, false),
    or(eq(tournamentsTable.auctionEnabled, true), eq(tournamentsTable.scoringEnabled, true)),
    sql`${tournamentsTable.name} NOT ILIKE '%[test]%'`,
    sql`${tournamentsTable.name} NOT ILIKE '%demo tournament%'`,
    sql`${tournamentsTable.name} NOT ILIKE '%internal test%'`,
    sql`${tournamentsTable.name} NOT ILIKE 'SIM_%'`,
    sql`${tournamentsTable.name} NOT ILIKE '%testing%'`,
    sql`COALESCE((${tournamentsTable.featuresJson}->>'fanArenaOptIn')::boolean, false) = true`,
    or(
      eq(tournamentsTable.licenseStatus, "active"),
      sql`COALESCE((${tournamentsTable.featuresJson}->>'fanArenaApproved')::boolean, false) = true`
    ),
    sql`${tournamentsTable.status} NOT IN ('archived', 'cancelled')`,
  ];

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    baseConditions.push(
      or(
        ilike(tournamentsTable.name, term),
        ilike(tournamentsTable.city, term),
        ilike(tournamentsTable.venue, term),
        ilike(tournamentsTable.organizerName, term)
      )!
    );
  }

  if (sport !== "all") {
    baseConditions.push(sql`LOWER(${tournamentsTable.sport}) = LOWER(${sport})`);
  }

  if (city && city.trim().length > 0) {
    baseConditions.push(ilike(tournamentsTable.city, `%${city.trim()}%`));
  }

  if (module === "auction") {
    baseConditions.push(
      and(eq(tournamentsTable.auctionEnabled, true), eq(tournamentsTable.scoringEnabled, false))!
    );
  } else if (module === "scoring") {
    baseConditions.push(
      and(eq(tournamentsTable.scoringEnabled, true), eq(tournamentsTable.auctionEnabled, false))!
    );
  } else if (module === "both") {
    baseConditions.push(
      and(eq(tournamentsTable.auctionEnabled, true), eq(tournamentsTable.scoringEnabled, true))!
    );
  }

  // 2. Fetch live match tournament IDs for live-state resolution
  let liveMatchTournamentIds = new Set<number>();
  try {
    const liveMatches = await db
      .select({ tournamentId: scoringMatchesTable.tournamentId })
      .from(scoringMatchesTable)
      .where(inArray(scoringMatchesTable.status, ["live", "in_progress"]));
    liveMatchTournamentIds = new Set(liveMatches.map((m) => m.tournamentId));
  } catch {
    // Scoring table may be empty or unmigrated in light environments
  }

  // Fetch all candidate tournaments matching filters
  const allCandidates = await db
    .select()
    .from(tournamentsTable)
    .where(and(...baseConditions));

  // Apply canonical 7-point curation evaluation in-memory for complete reliability across all environments & mocks
  const eligibleCandidates = allCandidates.filter((t) => evaluateFanArenaEligibility(t).eligible);

  // 3. Resolve live state and filter by status
  const todayIso = new Date().toISOString().slice(0, 10);
  let liveCount = 0;
  let upcomingTodayCount = 0;

  const resolvedCandidates = eligibleCandidates.map((t) => {
    const auctionOn = isAuctionEnabled(t);
    const scoringOn = isScoringEnabled(t);
    const isAuctionLive = auctionOn && t.status === "active";
    const isMatchLive = scoringOn && liveMatchTournamentIds.has(t.id);
    const isLive = isAuctionLive || isMatchLive;

    if (isLive) liveCount++;
    if (t.auctionDate === todayIso || t.matchDates?.includes(todayIso)) {
      upcomingTodayCount++;
    }

    let liveType: "auction" | "scoring" | null = null;
    let liveSnippet: string | null = null;

    if (isAuctionLive) {
      liveType = "auction";
      liveSnippet = "⚡ Live Auction Bidding in Progress";
    } else if (isMatchLive) {
      liveType = "scoring";
      liveSnippet = t.sport === "badminton" ? "🏸 Live Court Action" : "🏏 Live Match in Progress";
    }

    return {
      t,
      isLive,
      liveType,
      liveSnippet,
    };
  });

  // Filter by requested lifecycle status
  const filteredCandidates = resolvedCandidates.filter(({ t, isLive }) => {
    if (status === "all") return true;
    if (status === "live") return isLive;
    if (status === "upcoming") {
      return !isLive && (t.status === "setup" || t.status === "draw_ready");
    }
    if (status === "completed") {
      return !isLive && t.status === "completed";
    }
    return true;
  });

  // 4. Sort results
  filteredCandidates.sort((a, b) => {
    if (sortBy === "live_first") {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      return new Date(b.t.createdAt).getTime() - new Date(a.t.createdAt).getTime();
    }
    if (sortBy === "newest") {
      return new Date(b.t.createdAt).getTime() - new Date(a.t.createdAt).getTime();
    }
    if (sortBy === "name") {
      return a.t.name.localeCompare(b.t.name);
    }
    if (sortBy === "upcoming_date") {
      const dateA = a.t.auctionDate || a.t.matchDates || "9999-99-99";
      const dateB = b.t.auctionDate || b.t.matchDates || "9999-99-99";
      return dateA.localeCompare(dateB);
    }
    return 0;
  });

  // 5. Pagination
  const total = filteredCandidates.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const offset = (page - 1) * limit;
  const pageSlice = filteredCandidates.slice(offset, offset + limit);

  // 6. Enrich with team counts
  const pageTournamentIds = pageSlice.map((item) => item.t.id);
  const teamCountsMap = new Map<number, number>();
  if (pageTournamentIds.length > 0) {
    try {
      const teamCounts = await db
        .select({
          tournamentId: teamsTable.tournamentId,
          count: sql<number>`count(*)::int`,
        })
        .from(teamsTable)
        .where(inArray(teamsTable.tournamentId, pageTournamentIds))
        .groupBy(teamsTable.tournamentId);

      for (const tc of teamCounts) {
        teamCountsMap.set(tc.tournamentId, tc.count);
      }
    } catch {
      // Fallback if teams query encounters transient issue
    }
  }

  // 7. Format Card DTOs
  const items: FanDiscoveryCardDto[] = pageSlice.map(({ t, isLive, liveType, liveSnippet }) => {
    const publicBroadcast = resolvePublicBroadcasts(t.featuresJson);
    return {
      id: t.id,
      name: t.name,
      code: t.auctionCode ?? null,
      sport: t.sport,
      city: t.city ?? null,
      venue: t.venue ?? null,
      organizerName: t.organizerName ?? null,
      logoUrl: t.logoUrl ?? null,
      status: t.status,
      auctionDate: t.auctionDate ?? null,
      auctionTime: t.auctionTime ?? null,
      matchDates: t.matchDates ?? null,
      auctionEnabled: isAuctionEnabled(t),
      scoringEnabled: isScoringEnabled(t),
      productMode: tryResolveTournamentProductMode(t) ?? "auction_only",
      isLive,
      liveType,
      liveSnippet,
      teamsCount: teamCountsMap.get(t.id) ?? 0,
      featured: isLive,
      broadcast: publicBroadcast
        ? {
            auction: publicBroadcast.auction
              ? {
                  url: publicBroadcast.auction.url,
                  platform: publicBroadcast.auction.platform,
                  status: publicBroadcast.auction.status,
                  title: publicBroadcast.auction.title,
                }
              : undefined,
            scoring: publicBroadcast.scoring
              ? {
                  url: publicBroadcast.scoring.url,
                  platform: publicBroadcast.scoring.platform,
                  status: publicBroadcast.scoring.status,
                  title: publicBroadcast.scoring.title,
                }
              : undefined,
          }
        : null,
    };
  });

  res.setHeader("Cache-Control", "public, max-age=15, stale-while-revalidate=45");
  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
    summary: {
      liveCount,
      upcomingTodayCount,
      totalCount: total,
    },
  });
});

/**
 * GET /api/tournaments/:tournamentId/fan/context
 * Context endpoint for spectator fan shell.
 * Checks privacy and returns safe tournament fan context.
 */
router.get("/tournaments/:tournamentId/fan/context", async (req: Request, res: Response): Promise<void> => {
  const rawId = Array.isArray(req.params.tournamentId)
    ? req.params.tournamentId[0]
    : req.params.tournamentId;
  const id = parseInt(String(rawId), 10);
  if (isNaN(id) || id <= 0) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }

  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, id));

  if (!tournament) {
    res.status(404).json({ error: "Tournament not found", tournamentId: id });
    return;
  }

  // Privacy Gate (Phase 1 Privacy Contract)
  const visibility = resolveTournamentVisibility(tournament.featuresJson);
  const isOrganizer = await canAccessPrivateTournamentData(req, id);

  if (visibility === "private" && !isOrganizer) {
    const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";

    // 1. Check if client IP is currently locked out from brute-force attempts
    const rateCheck = checkPinRateLimit(clientIp, id);
    if (!rateCheck.allowed) {
      res.setHeader("Retry-After", String(rateCheck.retryAfterSeconds || 600));
      res.status(429).json({
        error: "Too many failed PIN attempts. Access locked out temporarily.",
        code: "RATE_LIMIT_EXCEEDED",
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      });
      return;
    }

    const pin = (req.headers["x-bidwar-pin"] as string) || (req.query.pin as string);
    const pinMatches = secureComparePins(pin, tournament.scoringPin);

    // Record attempt for rate limiting
    const attemptResult = recordPinAttempt(clientIp, id, pinMatches);

    if (!pinMatches) {
      if (attemptResult.lockedOut) {
        res.setHeader("Retry-After", String(attemptResult.retryAfterSeconds || 600));
        res.status(429).json({
          error: "Too many failed PIN attempts. Access locked out for 10 minutes.",
          code: "RATE_LIMIT_EXCEEDED",
          retryAfterSeconds: attemptResult.retryAfterSeconds,
        });
        return;
      }

      res.status(403).json({
        error: "This tournament is private",
        code: "PRIVATE_TOURNAMENT",
      });
      return;
    }
  }

  // Live state checks
  const auctionOn = isAuctionEnabled(tournament);
  const scoringOn = isScoringEnabled(tournament);
  const isAuctionLive = auctionOn && tournament.status === "active";

  let isMatchLive = false;
  let activeMatchInfo = null;

  if (scoringOn) {
    try {
      const [liveMatch] = await db
        .select({
          id: scoringMatchesTable.id,
          status: scoringMatchesTable.status,
          homeTeamId: scoringMatchesTable.homeTeamId,
          awayTeamId: scoringMatchesTable.awayTeamId,
          roundName: scoringMatchesTable.roundName,
        })
        .from(scoringMatchesTable)
        .where(
          and(
            eq(scoringMatchesTable.tournamentId, id),
            inArray(scoringMatchesTable.status, ["live", "in_progress"])
          )
        )
        .limit(1);

      if (liveMatch) {
        isMatchLive = true;
        activeMatchInfo = {
          id: liveMatch.id,
          status: liveMatch.status,
          roundName: liveMatch.roundName,
        };
      }
    } catch {
      // Non-blocking
    }
  }

  // Recommended tab calculation
  let recommendedTab: "auction" | "scoring" = "auction";
  if (auctionOn && isAuctionLive) {
    recommendedTab = "auction";
  } else if (scoringOn && isMatchLive) {
    recommendedTab = "scoring";
  } else if (auctionOn) {
    recommendedTab = "auction";
  } else {
    recommendedTab = "scoring";
  }

  const serialized = publicTournamentSerializer(tournament);

  // Cache-Control Privacy Hardening: Never allow public proxy/CDN caching for private or unlisted tournaments
  if (visibility === "private" || visibility === "unlisted") {
    res.setHeader("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
  } else {
    res.setHeader("Cache-Control", "public, max-age=10, stale-while-revalidate=20");
  }
  res.json({
    tournament: {
      id: serialized.id,
      name: serialized.name,
      sport: serialized.sport,
      auctionCode: serialized.auctionCode,
      city: serialized.city,
      venue: serialized.venue,
      organizerName: serialized.organizerName,
      logoUrl: serialized.logoUrl,
      sponsorLogos: serialized.sponsorLogos,
      mainBannerUrl: serialized.mainBannerUrl,
      mainBannerEnabled: serialized.mainBannerEnabled,
      mainBannerFit: serialized.mainBannerFit,
      status: serialized.status,
      auctionDate: serialized.auctionDate,
      auctionTime: serialized.auctionTime,
      matchDates: serialized.matchDates,
      auctionEnabled: serialized.auctionEnabled,
      scoringEnabled: serialized.scoringEnabled,
      productMode: serialized.productMode,
      scoringPhase: serialized.scoringPhase,
      features: serialized.features,
      broadcast: resolvePublicBroadcasts(tournament.featuresJson) ?? null,
    },
    liveState: {
      isAuctionLive,
      isMatchLive,
      activeMatch: activeMatchInfo,
      recommendedTab,
    },
  });
});

export default router;
