import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db, tournamentsTable, scoringMatchesTable, teamsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import {
  resolveTournamentFeatures,
  mergeTournamentFeatures,
  evaluateFanArenaEligibility,
  validateBroadcastUrl,
  isFanArenaOptedIn,
  isFanArenaApproved,
  type BroadcastLinkConfig,
  type BroadcastStatus,
  type TournamentBroadcastConfig,
} from "@workspace/platform-core";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import { requireAdmin } from "../middleware/require-admin";

const router = Router();

const broadcastLinkInputSchema = z
  .object({
    url: z.string().trim().max(500),
    enabled: z.boolean().default(true),
    status: z.enum(["live", "upcoming", "ended"]).default("live"),
    title: z.string().trim().max(100).optional(),
  })
  .nullable();

export const updateBroadcastSchema = z.object({
  fanArenaOptIn: z.boolean().optional(),
  broadcast: z
    .object({
      auction: broadcastLinkInputSchema.optional(),
      scoring: broadcastLinkInputSchema.optional(),
    })
    .optional(),
  matchBroadcasts: z.record(z.string(), broadcastLinkInputSchema).optional(),
});

/**
 * GET /tournaments/:tournamentId/broadcast
 * Organizer view of Fan Arena listing status, eligibility, and broadcast configurations.
 */
router.get(
  "/tournaments/:tournamentId/broadcast",
  async (req: Request, res: Response): Promise<void> => {
    const rawId = Array.isArray(req.params.tournamentId)
      ? req.params.tournamentId[0]
      : req.params.tournamentId;
    const tournamentId = parseInt(String(rawId), 10);
    if (isNaN(tournamentId) || tournamentId <= 0) {
      res.status(400).json({ error: "Invalid tournament ID" });
      return;
    }

    const authorized = await requireTournamentOrganizer(req, res, tournamentId);
    if (!authorized) return;

    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const features = resolveTournamentFeatures(tournament.featuresJson);
    const eligibility = evaluateFanArenaEligibility(tournament);

    // Fetch tournament matches for match broadcast assignment
    let matches: Array<{
      id: number;
      sport: string;
      roundName: string | null;
      matchLabel: string | null;
      status: string;
      homeTeamId: number;
      awayTeamId: number;
      homeTeamName: string;
      awayTeamName: string;
      broadcast: BroadcastLinkConfig | null;
    }> = [];

    try {
      const scoringMatches = await db
        .select()
        .from(scoringMatchesTable)
        .where(eq(scoringMatchesTable.tournamentId, tournamentId));

      const teamIds = new Set<number>();
      for (const m of scoringMatches) {
        if (m.homeTeamId) teamIds.add(m.homeTeamId);
        if (m.awayTeamId) teamIds.add(m.awayTeamId);
      }

      const teamMap = new Map<number, string>();
      if (teamIds.size > 0) {
        const teams = await db
          .select({ id: teamsTable.id, name: teamsTable.name })
          .from(teamsTable)
          .where(inArray(teamsTable.id, Array.from(teamIds)));
        for (const t of teams) {
          teamMap.set(t.id, t.name);
        }
      }

      matches = scoringMatches.map((m) => {
        const matchBroadcastKey = String(m.id);
        const featureBroadcast = features.matchBroadcasts?.[matchBroadcastKey] ?? null;
        const branding = (m.brandingJson ?? {}) as Record<string, unknown>;
        const matchBroadcast = (branding.broadcast as BroadcastLinkConfig) ?? featureBroadcast;

        return {
          id: m.id,
          sport: m.sportSlug ?? "cricket",
          roundName: m.roundName ?? null,
          matchLabel: m.matchLabel ?? null,
          status: m.status,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          homeTeamName: teamMap.get(m.homeTeamId) ?? "Home Team",
          awayTeamName: teamMap.get(m.awayTeamId) ?? "Away Team",
          broadcast: matchBroadcast,
        };
      });
    } catch {
      // Non-blocking in environments without scoring matches
    }

    res.json({
      tournamentId: tournament.id,
      fanArenaOptIn: isFanArenaOptedIn(tournament.featuresJson),
      fanArenaApproved: isFanArenaApproved(tournament.featuresJson),
      licenseStatus: tournament.licenseStatus,
      adminLocked: tournament.adminLocked,
      auctionEnabled: tournament.auctionEnabled,
      scoringEnabled: tournament.scoringEnabled,
      eligibility,
      broadcast: features.broadcast ?? {},
      matchBroadcasts: features.matchBroadcasts ?? {},
      matches,
    });
  },
);

/**
 * PUT /tournaments/:tournamentId/broadcast
 * Organizer update of tournament & match broadcast configurations.
 */
router.put(
  "/tournaments/:tournamentId/broadcast",
  async (req: Request, res: Response): Promise<void> => {
    const rawId = Array.isArray(req.params.tournamentId)
      ? req.params.tournamentId[0]
      : req.params.tournamentId;
    const tournamentId = parseInt(String(rawId), 10);
    if (isNaN(tournamentId) || tournamentId <= 0) {
      res.status(400).json({ error: "Invalid tournament ID" });
      return;
    }

    const authorized = await requireTournamentOrganizer(req, res, tournamentId);
    if (!authorized) return;

    const parsed = updateBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        issues: parsed.error.issues,
      });
      return;
    }

    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const { fanArenaOptIn, broadcast, matchBroadcasts } = parsed.data;

    // Validate all URLs strictly
    const validatedBroadcast: TournamentBroadcastConfig = {};

    if (broadcast?.auction !== undefined) {
      if (broadcast.auction === null) {
        validatedBroadcast.auction = null;
      } else {
        const val = validateBroadcastUrl(broadcast.auction.url);
        if (!val.valid) {
          res.status(400).json({
            error: "Invalid auction broadcast URL",
            details: val.error,
          });
          return;
        }
        validatedBroadcast.auction = {
          url: val.normalizedUrl!,
          platform: val.platform,
          enabled: broadcast.auction.enabled,
          status: broadcast.auction.status,
          title: broadcast.auction.title,
        };
      }
    }

    if (broadcast?.scoring !== undefined) {
      if (broadcast.scoring === null) {
        validatedBroadcast.scoring = null;
      } else {
        const val = validateBroadcastUrl(broadcast.scoring.url);
        if (!val.valid) {
          res.status(400).json({
            error: "Invalid scoring broadcast URL",
            details: val.error,
          });
          return;
        }
        validatedBroadcast.scoring = {
          url: val.normalizedUrl!,
          platform: val.platform,
          enabled: broadcast.scoring.enabled,
          status: broadcast.scoring.status,
          title: broadcast.scoring.title,
        };
      }
    }

    const validatedMatchBroadcasts: Record<string, BroadcastLinkConfig | null> = {};
    if (matchBroadcasts) {
      for (const [matchKey, link] of Object.entries(matchBroadcasts)) {
        if (link === null) {
          validatedMatchBroadcasts[matchKey] = null;
        } else {
          const val = validateBroadcastUrl(link.url);
          if (!val.valid) {
            res.status(400).json({
              error: `Invalid match broadcast URL for match ${matchKey}`,
              details: val.error,
            });
            return;
          }
          validatedMatchBroadcasts[matchKey] = {
            url: val.normalizedUrl!,
            platform: val.platform,
            enabled: link.enabled,
            status: link.status,
            title: link.title,
          };
        }
      }
    }

    // Merge features safely
    const currentFeatures = resolveTournamentFeatures(tournament.featuresJson);
    const nextBroadcast = {
      ...(currentFeatures.broadcast ?? {}),
      ...validatedBroadcast,
    };
    const nextMatchBroadcasts = {
      ...(currentFeatures.matchBroadcasts ?? {}),
    };

    for (const [key, val] of Object.entries(validatedMatchBroadcasts)) {
      if (val === null) {
        delete nextMatchBroadcasts[key];
      } else {
        nextMatchBroadcasts[key] = val;
      }
    }

    const updatedFeatures = mergeTournamentFeatures(tournament.featuresJson, {
      broadcast: nextBroadcast,
      matchBroadcasts: nextMatchBroadcasts,
    });

    await db
      .update(tournamentsTable)
      .set({
        featuresJson: updatedFeatures as unknown as Record<string, unknown>,
      })
      .where(eq(tournamentsTable.id, tournamentId));

    // Also sync match-level branding for affected matches
    if (Object.keys(validatedMatchBroadcasts).length > 0) {
      for (const [matchKey, link] of Object.entries(validatedMatchBroadcasts)) {
        const matchId = parseInt(matchKey, 10);
        if (!isNaN(matchId) && matchId > 0) {
          try {
            const [m] = await db
              .select({ brandingJson: scoringMatchesTable.brandingJson })
              .from(scoringMatchesTable)
              .where(
                and(
                  eq(scoringMatchesTable.id, matchId),
                  eq(scoringMatchesTable.tournamentId, tournamentId),
                ),
              )
              .limit(1);

            if (m) {
              const branding = (m.brandingJson ?? {}) as Record<string, unknown>;
              const nextBranding = {
                ...branding,
                broadcast: link,
              };
              await db
                .update(scoringMatchesTable)
                .set({ brandingJson: nextBranding })
                .where(eq(scoringMatchesTable.id, matchId));
            }
          } catch {
            // Non-blocking
          }
        }
      }
    }

    const updatedTournament = {
      ...tournament,
      featuresJson: updatedFeatures,
    };
    const eligibility = evaluateFanArenaEligibility(updatedTournament);

    res.json({
      success: true,
      tournamentId,
      fanArenaOptIn: updatedFeatures.fanArenaOptIn ?? false,
      broadcast: updatedFeatures.broadcast ?? {},
      matchBroadcasts: updatedFeatures.matchBroadcasts ?? {},
      eligibility,
    });
  },
);

/**
 * PUT /tournaments/:tournamentId/fan-arena
 * Deprecated organizer toggle. Blocked by contract: public discovery is automatic
 * and visibility is exclusively managed by Super Admin.
 */
router.put(
  "/tournaments/:tournamentId/fan-arena",
  async (req: Request, res: Response): Promise<void> => {
    res.status(403).json({
      error: "Organizers cannot modify Fan Arena listing eligibility. Public discovery is automatic and visibility is managed exclusively by Super Admin.",
      code: "FORBIDDEN_FAN_ARENA_OPT_IN",
    });
  },
);

/**
 * POST /auth/admin/tournaments/:tournamentId/fan-arena-approval
 * Super Admin curation action: explicitly approves or revokes Fan Arena discovery.
 */
router.post(
  "/auth/admin/tournaments/:tournamentId/fan-arena-approval",
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const rawId = Array.isArray(req.params.tournamentId)
      ? req.params.tournamentId[0]
      : req.params.tournamentId;
    const tournamentId = parseInt(String(rawId), 10);
    if (isNaN(tournamentId) || tournamentId <= 0) {
      res.status(400).json({ error: "Invalid tournament ID" });
      return;
    }

    const approvalSchema = z.object({
      approved: z.boolean(),
    });
    const parsed = approvalSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input: 'approved' boolean required" });
      return;
    }

    const [tournament] = await db
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .limit(1);

    if (!tournament) {
      res.status(404).json({ error: "Tournament not found" });
      return;
    }

    const updatedFeatures = mergeTournamentFeatures(tournament.featuresJson, {
      fanArenaApproved: parsed.data.approved,
    });

    await db
      .update(tournamentsTable)
      .set({ featuresJson: updatedFeatures as unknown as Record<string, unknown> })
      .where(eq(tournamentsTable.id, tournamentId));

    const updatedTournament = {
      ...tournament,
      featuresJson: updatedFeatures,
    };
    const eligibility = evaluateFanArenaEligibility(updatedTournament);

    res.json({
      success: true,
      tournamentId,
      fanArenaApproved: parsed.data.approved,
      eligibility,
    });
  },
);

export default router;
