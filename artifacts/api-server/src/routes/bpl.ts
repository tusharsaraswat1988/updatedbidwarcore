import { Router, type Request, type Response } from "express";
import {
  db,
  bplEditionsTable,
  bplEditionSponsorsTable,
  tournamentsTable,
  teamsTable,
  scoringMatchesTable,
  scoringStandingsTable,
  type BplSponsorCategory,
} from "@workspace/db";
import { eq, and, ne, desc, asc, inArray, sql } from "drizzle-orm";
import { buildHeadToHeadIndex, rankCricketStandings, rankingNetRunRate } from "@workspace/scoring-core";
import { isKnockoutMatch } from "../lib/scoring-standings";
import { z } from "zod";
import { parseSponsorLogos } from "@workspace/api-base/sponsor-priority";
import { requireAdmin } from "../middleware/require-admin.js";

const router = Router();

export const bplEditionStatusValues = [
  "DRAFT",
  "UPCOMING",
  "LIVE",
  "COMPLETED",
  "ARCHIVED",
] as const;

export type BplEditionStatus = (typeof bplEditionStatusValues)[number];

const urlRegex = /^https?:\/\/.+/i;

const editionBaseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  editionNumber: z.coerce.number().int().positive("Edition number must be a positive integer"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .max(100)
    .regex(/^[a-z0-9-_]+$/i, "Slug must contain only alphanumeric characters, dashes, and underscores"),
  year: z.coerce.number().int().min(2000, "Year must be 2000 or later").max(2100, "Year must be 2100 or earlier"),
  startDate: z.string().trim().min(1, "Start date is required"),
  endDate: z.string().trim().min(1, "End date is required"),
  venue: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(bplEditionStatusValues).default("DRAFT"),
  linkedTournamentId: z.coerce.number().int().positive().optional().nullable(),
  liveStreamUrl: z
    .string()
    .trim()
    .regex(urlRegex, "Live stream URL must be a valid HTTP/HTTPS URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  fanPageUrl: z
    .string()
    .trim()
    .regex(urlRegex, "Fan page URL must be a valid HTTP/HTTPS URL")
    .optional()
    .nullable()
    .or(z.literal("")),
});

const createEditionSchema = editionBaseSchema.refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return data.startDate <= data.endDate;
  },
  {
    message: "Start date must be before or equal to end date",
    path: ["endDate"],
  },
);

const updateEditionSchema = editionBaseSchema.partial().refine(
  (data) => {
    if (!data.startDate || !data.endDate) return true;
    return data.startDate <= data.endDate;
  },
  {
    message: "Start date must be before or equal to end date",
    path: ["endDate"],
  },
);

/**
 * Lightweight tournament summary helper.
 * Strictly avoids duplicating tournament/scoring engine state.
 */
async function fetchLinkedTournamentSummary(tournamentId: number | null) {
  if (!tournamentId) return null;
  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      name: tournamentsTable.name,
      sport: tournamentsTable.sport,
      venue: tournamentsTable.venue,
      city: tournamentsTable.city,
      status: tournamentsTable.status,
      auctionDate: tournamentsTable.auctionDate,
      auctionTime: tournamentsTable.auctionTime,
      logoUrl: tournamentsTable.logoUrl,
      sponsorLogos: tournamentsTable.sponsorLogos,
      matchDates: tournamentsTable.matchDates,
      auctionEnabled: tournamentsTable.auctionEnabled,
      scoringEnabled: tournamentsTable.scoringEnabled,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  return tournament ?? null;
}

/**
 * Fetch participating teams, matches, and standings from linked tournament.
 * Strictly adheres to P1 requirement: Source of truth is existing BidWar tables.
 */
async function fetchLinkedTournamentActivity(tournamentId: number | null) {
  if (!tournamentId) {
    return {
      snapshot: {
        teamsCount: 0,
        matchesCount: 0,
        completedMatchesCount: 0,
        liveMatchesCount: 0,
      },
      teams: [],
      liveMatch: null,
      nextMatch: null,
      recentMatch: null,
      standings: [],
    };
  }

  // 1. Teams
  const teams = await db
    .select({
      id: teamsTable.id,
      name: teamsTable.name,
      shortCode: teamsTable.shortCode,
      color: teamsTable.color,
      logoUrl: teamsTable.logoUrl,
    })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId))
    .orderBy(asc(teamsTable.name));

  const teamMap = new Map(teams.map((t) => [t.id, t]));

  // 2. Matches
  const matches = await db
    .select({
      id: scoringMatchesTable.id,
      tournamentId: scoringMatchesTable.tournamentId,
      homeTeamId: scoringMatchesTable.homeTeamId,
      awayTeamId: scoringMatchesTable.awayTeamId,
      matchLabel: scoringMatchesTable.matchLabel,
      roundName: scoringMatchesTable.roundName,
      status: scoringMatchesTable.status,
      scheduledAt: scoringMatchesTable.scheduledAt,
      startedAt: scoringMatchesTable.startedAt,
      completedAt: scoringMatchesTable.completedAt,
      venue: scoringMatchesTable.venue,
      winnerTeamId: scoringMatchesTable.winnerTeamId,
      resultSummary: scoringMatchesTable.resultSummary,
    })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.tournamentId, tournamentId))
    .orderBy(asc(scoringMatchesTable.scheduledAt), asc(scoringMatchesTable.id));

  const rawLive = matches.find((m) => m.status === "in_progress" || m.status === "live");
  const liveMatch = rawLive
    ? {
        id: rawLive.id,
        tournamentId: rawLive.tournamentId,
        homeTeam: teamMap.get(rawLive.homeTeamId) ?? {
          id: rawLive.homeTeamId,
          name: "Team 1",
          shortCode: "T1",
          color: null,
          logoUrl: null,
        },
        awayTeam: teamMap.get(rawLive.awayTeamId) ?? {
          id: rawLive.awayTeamId,
          name: "Team 2",
          shortCode: "T2",
          color: null,
          logoUrl: null,
        },
        roundName: rawLive.roundName,
        matchLabel: rawLive.matchLabel,
        status: rawLive.status,
        venue: rawLive.venue,
        resultSummary: rawLive.resultSummary,
        liveScoreRoute: `/score-display/${rawLive.tournamentId}`,
      }
    : null;

  const rawNext = matches.find((m) => m.status === "scheduled");
  const nextMatch = rawNext
    ? {
        id: rawNext.id,
        tournamentId: rawNext.tournamentId,
        homeTeam: teamMap.get(rawNext.homeTeamId) ?? {
          id: rawNext.homeTeamId,
          name: "Team 1",
          shortCode: "T1",
          color: null,
          logoUrl: null,
        },
        awayTeam: teamMap.get(rawNext.awayTeamId) ?? {
          id: rawNext.awayTeamId,
          name: "Team 2",
          shortCode: "T2",
          color: null,
          logoUrl: null,
        },
        roundName: rawNext.roundName,
        matchLabel: rawNext.matchLabel,
        scheduledAt: rawNext.scheduledAt ? rawNext.scheduledAt.toISOString() : null,
        venue: rawNext.venue,
      }
    : null;

  const completedMatches = matches.filter((m) => m.status === "completed");
  const rawRecent = completedMatches.length > 0 ? completedMatches[completedMatches.length - 1] : null;
  const recentMatch = rawRecent
    ? {
        id: rawRecent.id,
        tournamentId: rawRecent.tournamentId,
        homeTeam: teamMap.get(rawRecent.homeTeamId) ?? {
          id: rawRecent.homeTeamId,
          name: "Team 1",
          shortCode: "T1",
          color: null,
          logoUrl: null,
        },
        awayTeam: teamMap.get(rawRecent.awayTeamId) ?? {
          id: rawRecent.awayTeamId,
          name: "Team 2",
          shortCode: "T2",
          color: null,
          logoUrl: null,
        },
        roundName: rawRecent.roundName,
        resultSummary: rawRecent.resultSummary,
        winnerTeamId: rawRecent.winnerTeamId,
      }
    : null;

  // 3. Standings
  const rawStandings = await db
    .select({
      id: scoringStandingsTable.id,
      teamId: scoringStandingsTable.teamId,
      played: scoringStandingsTable.played,
      won: scoringStandingsTable.won,
      lost: scoringStandingsTable.lost,
      tied: scoringStandingsTable.tied,
      noResult: scoringStandingsTable.noResult,
      points: scoringStandingsTable.points,
      netRunRate: scoringStandingsTable.netRunRate,
      extrasJson: scoringStandingsTable.extrasJson,
    })
    .from(scoringStandingsTable)
    .where(eq(scoringStandingsTable.tournamentId, tournamentId));

  const headToHead = buildHeadToHeadIndex(
    matches
      .filter(
        (match) =>
          !isKnockoutMatch(match) &&
          (match.status === "completed" ||
            match.status === "abandoned" ||
            match.status === "no_result" ||
            match.status === "walkover"),
      )
      .map((match) => ({
        status: match.status,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        winnerTeamId: match.winnerTeamId,
        isTie: match.status === "completed" && match.winnerTeamId == null,
      })),
  );

  const standings = rankCricketStandings(
    rawStandings.map((s) => {
      const team = teamMap.get(s.teamId);
      return {
        teamId: s.teamId,
        teamName: team?.name ?? `Team ${s.teamId}`,
        shortCode: team?.shortCode ?? "T",
        color: team?.color ?? null,
        logoUrl: team?.logoUrl ?? null,
        played: s.played,
        won: s.won,
        lost: s.lost,
        tied: s.tied,
        noResult: s.noResult,
        points: s.points,
        netRunRate: rankingNetRunRate(s.netRunRate, s.extrasJson),
      };
    }),
    headToHead,
  );

  return {
    snapshot: {
      teamsCount: teams.length,
      matchesCount: matches.length,
      completedMatchesCount: completedMatches.length,
      liveMatchesCount: rawLive ? 1 : 0,
    },
    teams,
    liveMatch,
    nextMatch,
    recentMatch,
    standings,
  };
}

/**
 * Fetch edition sponsors.
 * Priority 1: Explicit BPL Edition sponsors from bpl_edition_sponsors table.
 * Priority 2: Fallback to linked tournament sponsor logos if available.
 */
async function fetchEditionSponsors(editionId: number, linkedTournamentId?: number | null) {
  const explicitSponsors = await db
    .select()
    .from(bplEditionSponsorsTable)
    .where(and(eq(bplEditionSponsorsTable.editionId, editionId), eq(bplEditionSponsorsTable.isActive, true)))
    .orderBy(asc(bplEditionSponsorsTable.displayOrder), asc(bplEditionSponsorsTable.id));

  if (explicitSponsors.length > 0) {
    return explicitSponsors;
  }

  if (linkedTournamentId) {
    const [t] = await db
      .select({ sponsorLogos: tournamentsTable.sponsorLogos })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, linkedTournamentId))
      .limit(1);

    if (t?.sponsorLogos) {
      try {
        const parsed = parseSponsorLogos(t.sponsorLogos);
        if (parsed.length > 0) {
          return parsed.map((s, idx) => {
            let cat: BplSponsorCategory = "PARTNER";
            if (s.isTitleSponsor) cat = "TITLE";
            else if (s.isCoSponsor) cat = "POWERED_BY";
            else if (s.priorityType === "PLATINUM" || s.priorityType === "GOLD") cat = "ASSOCIATE";
            return {
              id: -(idx + 1),
              editionId,
              name: s.name || "Tournament Partner",
              logoUrl: s.url,
              category: cat,
              websiteUrl: null,
              displayOrder: idx,
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
          });
        }
      } catch {
        // Fallback safely on corrupt JSON
      }
    }
  }

  return [];
}

/**
 * Enriches a BPL Edition record with linked tournament metadata,
 * live/upcoming/recent match activity, teams, standings, and sponsors.
 */
async function enrichEditionPayload(edition: typeof bplEditionsTable.$inferSelect) {
  const linkedTournament = await fetchLinkedTournamentSummary(edition.linkedTournamentId);
  const activity = await fetchLinkedTournamentActivity(edition.linkedTournamentId);
  const sponsors = await fetchEditionSponsors(edition.id, edition.linkedTournamentId);

  return {
    ...edition,
    linkedTournament,
    tournamentSnapshot: {
      ...activity.snapshot,
      sport: linkedTournament?.sport ?? null,
      tournamentStatus: linkedTournament?.status ?? null,
    },
    teams: activity.teams,
    liveMatch: activity.liveMatch,
    nextMatch: activity.nextMatch,
    recentMatch: activity.recentMatch,
    standings: activity.standings,
    sponsors,
  };
}

// =========================================================================
// PUBLIC BPL ENDPOINTS
// =========================================================================

/**
 * GET /api/bpl
 * Resolves the canonical active BPL edition dynamically from data.
 * Resolution priority:
 * 1. LIVE edition if one exists
 * 2. Earliest UPCOMING edition if one exists
 * 3. Most recent COMPLETED edition as historical fallback
 * 4. null / empty state
 */
router.get(["/bpl", "/bpl/active"], async (_req: Request, res: Response) => {
  try {
    // 1. Check for LIVE edition
    const [liveEdition] = await db
      .select()
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.status, "LIVE"))
      .limit(1);

    if (liveEdition) {
      const enriched = await enrichEditionPayload(liveEdition);
      res.json({
        edition: enriched,
        resolutionReason: "LIVE",
      });
      return;
    }

    // 2. Check for UPCOMING edition (earliest by start_date, then edition_number)
    const [upcomingEdition] = await db
      .select()
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.status, "UPCOMING"))
      .orderBy(asc(bplEditionsTable.startDate), asc(bplEditionsTable.editionNumber))
      .limit(1);

    if (upcomingEdition) {
      const enriched = await enrichEditionPayload(upcomingEdition);
      res.json({
        edition: enriched,
        resolutionReason: "UPCOMING",
      });
      return;
    }

    // 3. Fallback to latest COMPLETED edition
    const [completedEdition] = await db
      .select()
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.status, "COMPLETED"))
      .orderBy(desc(bplEditionsTable.editionNumber))
      .limit(1);

    if (completedEdition) {
      const enriched = await enrichEditionPayload(completedEdition);
      res.json({
        edition: enriched,
        resolutionReason: "COMPLETED",
      });
      return;
    }

    // 4. No active/upcoming/completed edition found
    res.json({
      edition: null,
      resolutionReason: "EMPTY",
    });
  } catch (err: unknown) {
    _req.log?.error({ err }, "Failed to resolve active BPL edition");
    res.status(500).json({ error: "Failed to resolve active BPL edition" });
  }
});

/**
 * GET /api/bpl/editions
 * Publicly visible editions list (excludes DRAFT).
 */
router.get("/bpl/editions", async (_req: Request, res: Response) => {
  try {
    const publicStatuses: BplEditionStatus[] = ["LIVE", "UPCOMING", "COMPLETED", "ARCHIVED"];
    const editions = await db
      .select()
      .from(bplEditionsTable)
      .where(inArray(bplEditionsTable.status, publicStatuses))
      .orderBy(desc(bplEditionsTable.editionNumber));

    // Enrich with linked tournament summaries in parallel
    const enriched = await Promise.all(
      editions.map(async (edition) => {
        const linkedTournament = await fetchLinkedTournamentSummary(edition.linkedTournamentId);
        return {
          ...edition,
          linkedTournament,
        };
      }),
    );

    res.json(enriched);
  } catch (err: unknown) {
    _req.log?.error({ err }, "Failed to list public BPL editions");
    res.status(500).json({ error: "Failed to list BPL editions" });
  }
});

/**
 * GET /api/bpl/editions/:editionId/sponsors
 * Public: list active sponsors for an edition
 */
router.get("/bpl/editions/:editionId/sponsors", async (req: Request, res: Response) => {
  try {
    const editionId = parseInt(String(req.params.editionId), 10);
    if (!editionId || isNaN(editionId)) {
      res.status(400).json({ error: "Invalid edition ID" });
      return;
    }

    const [edition] = await db
      .select({ id: bplEditionsTable.id, linkedTournamentId: bplEditionsTable.linkedTournamentId })
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.id, editionId))
      .limit(1);

    if (!edition) {
      res.status(404).json({ error: "Edition not found" });
      return;
    }

    const sponsors = await fetchEditionSponsors(editionId, edition.linkedTournamentId);
    res.json(sponsors);
  } catch (err: unknown) {
    req.log?.error({ err }, "Failed to fetch public edition sponsors");
    res.status(500).json({ error: "Failed to fetch edition sponsors" });
  }
});

/**
 * GET /api/bpl/:edition
 * Fetch a specific BPL edition by slug or edition number.
 * Public requests reject DRAFT editions unless authenticated as admin.
 */
router.get("/bpl/:edition", async (req: Request, res: Response) => {
  try {
    const rawParam = req.params.edition;
    const param = (Array.isArray(rawParam) ? rawParam[0] : String(rawParam || "")).trim();
    const isNumeric = /^\d+$/.test(param);

    let queryCondition = eq(bplEditionsTable.slug, param);
    if (isNumeric) {
      const num = parseInt(param, 10);
      queryCondition = sql`${bplEditionsTable.slug} = ${param} OR ${bplEditionsTable.editionNumber} = ${num}`;
    }

    const [edition] = await db
      .select()
      .from(bplEditionsTable)
      .where(queryCondition)
      .limit(1);

    if (!edition) {
      res.status(404).json({ error: `BPL Edition '${param}' not found` });
      return;
    }

    // If DRAFT, only admin can view it
    const isAdmin = Boolean(req.jwtUser?.isAdmin);
    if (edition.status === "DRAFT" && !isAdmin) {
      res.status(404).json({ error: `BPL Edition '${param}' not found` });
      return;
    }

    const fullEdition = await enrichEditionPayload(edition);
    res.json(fullEdition);
  } catch (err: unknown) {
    req.log?.error({ err, edition: req.params.edition }, "Failed to get BPL edition");
    res.status(500).json({ error: "Failed to get BPL edition" });
  }
});

// =========================================================================
// ADMIN BPL MANAGEMENT ENDPOINTS
// =========================================================================

/**
 * GET /api/auth/admin/bpl/editions (also aliases /api/admin/bpl/editions)
 * List all editions including DRAFT.
 */
const handleAdminListEditions = async (req: Request, res: Response) => {
  try {
    const editions = await db
      .select()
      .from(bplEditionsTable)
      .orderBy(desc(bplEditionsTable.editionNumber));

    const enriched = await Promise.all(
      editions.map(async (edition) => {
        const linkedTournament = await fetchLinkedTournamentSummary(edition.linkedTournamentId);
        const sponsors = await fetchEditionSponsors(edition.id, edition.linkedTournamentId);
        return {
          ...edition,
          linkedTournament,
          sponsors,
        };
      }),
    );

    res.json(enriched);
  } catch (err: unknown) {
    req.log?.error({ err }, "Admin: Failed to list BPL editions");
    res.status(500).json({ error: "Failed to list BPL editions" });
  }
};

router.get("/auth/admin/bpl/editions", requireAdmin, handleAdminListEditions);
router.get("/admin/bpl/editions", requireAdmin, handleAdminListEditions);

/**
 * POST /api/auth/admin/bpl/editions (also aliases /api/admin/bpl/editions)
 * Create a new BPL edition with validation and LIVE uniqueness check.
 */
const handleAdminCreateEdition = async (req: Request, res: Response) => {
  try {
    const parsed = createEditionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid edition data",
        issues: parsed.error.issues,
      });
      return;
    }

    const data = parsed.data;

    // 1. If status is LIVE, verify no other LIVE edition exists
    if (data.status === "LIVE") {
      const [existingLive] = await db
        .select({ id: bplEditionsTable.id, name: bplEditionsTable.name })
        .from(bplEditionsTable)
        .where(eq(bplEditionsTable.status, "LIVE"))
        .limit(1);

      if (existingLive) {
        res.status(400).json({
          error: `Edition #${existingLive.id} ('${existingLive.name}') is already LIVE. Only one edition can be marked LIVE.`,
        });
        return;
      }
    }

    // 2. If linking a tournament, verify it exists
    if (data.linkedTournamentId) {
      const [existingTournament] = await db
        .select({ id: tournamentsTable.id })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, data.linkedTournamentId))
        .limit(1);

      if (!existingTournament) {
        res.status(400).json({
          error: `Linked tournament with ID ${data.linkedTournamentId} does not exist.`,
        });
        return;
      }
    }

    // 3. Verify uniqueness of slug and editionNumber
    const [existingSlug] = await db
      .select({ id: bplEditionsTable.id })
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.slug, data.slug))
      .limit(1);

    if (existingSlug) {
      res.status(400).json({
        error: `An edition with slug '${data.slug}' already exists.`,
      });
      return;
    }

    const [existingNum] = await db
      .select({ id: bplEditionsTable.id })
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.editionNumber, data.editionNumber))
      .limit(1);

    if (existingNum) {
      res.status(400).json({
        error: `Edition number ${data.editionNumber} already exists.`,
      });
      return;
    }

    // 4. Insert edition
    const [created] = await db
      .insert(bplEditionsTable)
      .values({
        name: data.name,
        editionNumber: data.editionNumber,
        slug: data.slug,
        year: data.year,
        startDate: data.startDate,
        endDate: data.endDate,
        venue: data.venue || null,
        city: data.city || null,
        description: data.description || null,
        status: data.status,
        linkedTournamentId: data.linkedTournamentId || null,
        liveStreamUrl: data.liveStreamUrl?.trim() || null,
        fanPageUrl: data.fanPageUrl?.trim() || null,
      })
      .returning();

    const linkedTournament = await fetchLinkedTournamentSummary(created.linkedTournamentId);

    res.status(201).json({
      ...created,
      linkedTournament,
    });
  } catch (err: unknown) {
    req.log?.error({ err }, "Admin: Failed to create BPL edition");
    res.status(500).json({ error: "Failed to create BPL edition" });
  }
};

router.post("/auth/admin/bpl/editions", requireAdmin, handleAdminCreateEdition);
router.post("/admin/bpl/editions", requireAdmin, handleAdminCreateEdition);

/**
 * GET /api/auth/admin/bpl/editions/:id
 */
const handleAdminGetEdition = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid edition ID" });
      return;
    }

    const [edition] = await db
      .select()
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.id, id))
      .limit(1);

    if (!edition) {
      res.status(404).json({ error: `Edition ${id} not found` });
      return;
    }

    const linkedTournament = await fetchLinkedTournamentSummary(edition.linkedTournamentId);
    res.json({
      ...edition,
      linkedTournament,
    });
  } catch (err: unknown) {
    req.log?.error({ err, id: req.params.id }, "Admin: Failed to get BPL edition");
    res.status(500).json({ error: "Failed to get BPL edition" });
  }
};

router.get("/auth/admin/bpl/editions/:id", requireAdmin, handleAdminGetEdition);
router.get("/admin/bpl/editions/:id", requireAdmin, handleAdminGetEdition);

/**
 * PATCH /api/auth/admin/bpl/editions/:id
 * Update edition metadata, status, linked tournament, URLs.
 */
const handleAdminUpdateEdition = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid edition ID" });
      return;
    }

    const parsed = updateEditionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid update data",
        issues: parsed.error.issues,
      });
      return;
    }

    const [existing] = await db
      .select()
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: `Edition ${id} not found` });
      return;
    }

    const data = parsed.data;

    // 1. If updating status to LIVE, check single active LIVE constraint
    if (data.status === "LIVE" && existing.status !== "LIVE") {
      const [otherLive] = await db
        .select({ id: bplEditionsTable.id, name: bplEditionsTable.name })
        .from(bplEditionsTable)
        .where(and(eq(bplEditionsTable.status, "LIVE"), ne(bplEditionsTable.id, id)))
        .limit(1);

      if (otherLive) {
        res.status(400).json({
          error: `Edition #${otherLive.id} ('${otherLive.name}') is already LIVE. Only one edition can be marked LIVE.`,
        });
        return;
      }
    }

    // 2. If updating linked tournament, verify it exists
    if (data.linkedTournamentId !== undefined && data.linkedTournamentId !== null) {
      const [existingTournament] = await db
        .select({ id: tournamentsTable.id })
        .from(tournamentsTable)
        .where(eq(tournamentsTable.id, data.linkedTournamentId))
        .limit(1);

      if (!existingTournament) {
        res.status(400).json({
          error: `Linked tournament with ID ${data.linkedTournamentId} does not exist.`,
        });
        return;
      }
    }

    // 3. If updating slug or editionNumber, check uniqueness against other rows
    if (data.slug && data.slug !== existing.slug) {
      const [slugConflict] = await db
        .select({ id: bplEditionsTable.id })
        .from(bplEditionsTable)
        .where(and(eq(bplEditionsTable.slug, data.slug), ne(bplEditionsTable.id, id)))
        .limit(1);

      if (slugConflict) {
        res.status(400).json({
          error: `An edition with slug '${data.slug}' already exists.`,
        });
        return;
      }
    }

    if (data.editionNumber && data.editionNumber !== existing.editionNumber) {
      const [numConflict] = await db
        .select({ id: bplEditionsTable.id })
        .from(bplEditionsTable)
        .where(and(eq(bplEditionsTable.editionNumber, data.editionNumber), ne(bplEditionsTable.id, id)))
        .limit(1);

      if (numConflict) {
        res.status(400).json({
          error: `Edition number ${data.editionNumber} already exists.`,
        });
        return;
      }
    }

    // 4. Update the edition
    const updateValues: Partial<typeof bplEditionsTable.$inferInsert> = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.editionNumber !== undefined && { editionNumber: data.editionNumber }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.year !== undefined && { year: data.year }),
      ...(data.startDate !== undefined && { startDate: data.startDate }),
      ...(data.endDate !== undefined && { endDate: data.endDate }),
      ...(data.venue !== undefined && { venue: data.venue || null }),
      ...(data.city !== undefined && { city: data.city || null }),
      ...(data.description !== undefined && { description: data.description || null }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.linkedTournamentId !== undefined && { linkedTournamentId: data.linkedTournamentId }),
      ...(data.liveStreamUrl !== undefined && { liveStreamUrl: data.liveStreamUrl?.trim() || null }),
      ...(data.fanPageUrl !== undefined && { fanPageUrl: data.fanPageUrl?.trim() || null }),
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(bplEditionsTable)
      .set(updateValues)
      .where(eq(bplEditionsTable.id, id))
      .returning();

    const linkedTournament = await fetchLinkedTournamentSummary(updated.linkedTournamentId);

    res.json({
      ...updated,
      linkedTournament,
    });
  } catch (err: unknown) {
    req.log?.error({ err, id: req.params.id }, "Admin: Failed to update BPL edition");
    res.status(500).json({ error: "Failed to update BPL edition" });
  }
};

router.patch("/auth/admin/bpl/editions/:id", requireAdmin, handleAdminUpdateEdition);
router.patch("/admin/bpl/editions/:id", requireAdmin, handleAdminUpdateEdition);

/**
 * DELETE /api/auth/admin/bpl/editions/:id
 */
const handleAdminDeleteEdition = async (req: Request, res: Response) => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (!id || isNaN(id)) {
      res.status(400).json({ error: "Invalid edition ID" });
      return;
    }

    const [existing] = await db
      .select({ id: bplEditionsTable.id, status: bplEditionsTable.status })
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: `Edition ${id} not found` });
      return;
    }

    if (existing.status === "LIVE") {
      res.status(400).json({
        error: "Cannot delete an edition while it is marked LIVE. Change its status first.",
      });
      return;
    }

    await db.delete(bplEditionsTable).where(eq(bplEditionsTable.id, id));
    res.json({ success: true, message: `Edition ${id} deleted successfully` });
  } catch (err: unknown) {
    req.log?.error({ err, id: req.params.id }, "Admin: Failed to delete BPL edition");
    res.status(500).json({ error: "Failed to delete BPL edition" });
  }
};

router.delete("/auth/admin/bpl/editions/:id", requireAdmin, handleAdminDeleteEdition);
router.delete("/admin/bpl/editions/:id", requireAdmin, handleAdminDeleteEdition);

// =========================================================================
// ADMIN BPL SPONSOR MANAGEMENT (P1.8, P1.17)
// =========================================================================

const sponsorInputSchema = z.object({
  name: z.string().trim().min(1, "Sponsor name is required").max(128),
  logoUrl: z.string().trim().min(1, "Logo URL is required"),
  category: z
    .enum(["TITLE", "POWERED_BY", "ASSOCIATE", "PARTNER", "MEDIA_PARTNER"])
    .default("PARTNER"),
  websiteUrl: z
    .string()
    .trim()
    .regex(urlRegex, "Website URL must be a valid HTTP/HTTPS URL")
    .optional()
    .nullable()
    .or(z.literal("")),
  displayOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

const handleAdminListSponsors = async (req: Request, res: Response) => {
  try {
    const editionId = parseInt(String(req.params.editionId), 10);
    if (!editionId || isNaN(editionId)) {
      res.status(400).json({ error: "Invalid edition ID" });
      return;
    }

    const sponsors = await db
      .select()
      .from(bplEditionSponsorsTable)
      .where(eq(bplEditionSponsorsTable.editionId, editionId))
      .orderBy(asc(bplEditionSponsorsTable.displayOrder), asc(bplEditionSponsorsTable.id));

    res.json(sponsors);
  } catch (err: unknown) {
    req.log?.error({ err }, "Admin: Failed to list edition sponsors");
    res.status(500).json({ error: "Failed to list edition sponsors" });
  }
};

router.get("/auth/admin/bpl/editions/:editionId/sponsors", requireAdmin, handleAdminListSponsors);
router.get("/admin/bpl/editions/:editionId/sponsors", requireAdmin, handleAdminListSponsors);

const handleAdminCreateSponsor = async (req: Request, res: Response) => {
  try {
    const editionId = parseInt(String(req.params.editionId), 10);
    if (!editionId || isNaN(editionId)) {
      res.status(400).json({ error: "Invalid edition ID" });
      return;
    }

    const [edition] = await db
      .select({ id: bplEditionsTable.id })
      .from(bplEditionsTable)
      .where(eq(bplEditionsTable.id, editionId))
      .limit(1);

    if (!edition) {
      res.status(404).json({ error: "Edition not found" });
      return;
    }

    const parsed = sponsorInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid sponsor data",
        issues: parsed.error.issues,
      });
      return;
    }

    const [created] = await db
      .insert(bplEditionSponsorsTable)
      .values({
        editionId,
        name: parsed.data.name,
        logoUrl: parsed.data.logoUrl,
        category: parsed.data.category,
        websiteUrl: parsed.data.websiteUrl?.trim() || null,
        displayOrder: parsed.data.displayOrder,
        isActive: parsed.data.isActive,
      })
      .returning();

    res.status(201).json(created);
  } catch (err: unknown) {
    req.log?.error({ err }, "Admin: Failed to create edition sponsor");
    res.status(500).json({ error: "Failed to create edition sponsor" });
  }
};

router.post("/auth/admin/bpl/editions/:editionId/sponsors", requireAdmin, handleAdminCreateSponsor);
router.post("/admin/bpl/editions/:editionId/sponsors", requireAdmin, handleAdminCreateSponsor);

const handleAdminUpdateSponsor = async (req: Request, res: Response) => {
  try {
    const editionId = parseInt(String(req.params.editionId), 10);
    const sponsorId = parseInt(String(req.params.sponsorId), 10);
    if (!editionId || isNaN(editionId) || !sponsorId || isNaN(sponsorId)) {
      res.status(400).json({ error: "Invalid edition or sponsor ID" });
      return;
    }

    const [existing] = await db
      .select({ id: bplEditionSponsorsTable.id })
      .from(bplEditionSponsorsTable)
      .where(and(eq(bplEditionSponsorsTable.id, sponsorId), eq(bplEditionSponsorsTable.editionId, editionId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Sponsor not found for this edition" });
      return;
    }

    const parsed = sponsorInputSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid sponsor data",
        issues: parsed.error.issues,
      });
      return;
    }

    const data = parsed.data;
    const updateValues: Record<string, unknown> = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.websiteUrl !== undefined && { websiteUrl: data.websiteUrl?.trim() || null }),
      ...(data.displayOrder !== undefined && { displayOrder: data.displayOrder }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(bplEditionSponsorsTable)
      .set(updateValues)
      .where(eq(bplEditionSponsorsTable.id, sponsorId))
      .returning();

    res.json(updated);
  } catch (err: unknown) {
    req.log?.error({ err }, "Admin: Failed to update edition sponsor");
    res.status(500).json({ error: "Failed to update edition sponsor" });
  }
};

router.patch("/auth/admin/bpl/editions/:editionId/sponsors/:sponsorId", requireAdmin, handleAdminUpdateSponsor);
router.patch("/admin/bpl/editions/:editionId/sponsors/:sponsorId", requireAdmin, handleAdminUpdateSponsor);

const handleAdminDeleteSponsor = async (req: Request, res: Response) => {
  try {
    const editionId = parseInt(String(req.params.editionId), 10);
    const sponsorId = parseInt(String(req.params.sponsorId), 10);
    if (!editionId || isNaN(editionId) || !sponsorId || isNaN(sponsorId)) {
      res.status(400).json({ error: "Invalid edition or sponsor ID" });
      return;
    }

    const [existing] = await db
      .select({ id: bplEditionSponsorsTable.id })
      .from(bplEditionSponsorsTable)
      .where(and(eq(bplEditionSponsorsTable.id, sponsorId), eq(bplEditionSponsorsTable.editionId, editionId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Sponsor not found for this edition" });
      return;
    }

    await db.delete(bplEditionSponsorsTable).where(eq(bplEditionSponsorsTable.id, sponsorId));
    res.json({ success: true, message: `Sponsor ${sponsorId} deleted successfully` });
  } catch (err: unknown) {
    req.log?.error({ err }, "Admin: Failed to delete edition sponsor");
    res.status(500).json({ error: "Failed to delete edition sponsor" });
  }
};

router.delete("/auth/admin/bpl/editions/:editionId/sponsors/:sponsorId", requireAdmin, handleAdminDeleteSponsor);
router.delete("/admin/bpl/editions/:editionId/sponsors/:sponsorId", requireAdmin, handleAdminDeleteSponsor);

export default router;
