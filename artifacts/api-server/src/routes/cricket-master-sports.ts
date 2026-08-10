import { Router } from "express";
import { z } from "zod";
import {
  listCricketMasterTeams,
  listCricketMasterPlayers,
  listCricketSquadPlayers,
} from "../lib/master-sports/cricket-roster";
import { requireTournamentOrganizer } from "../middleware/require-organizer";
import {
  loadBadmintonBranding,
  updateBadmintonBranding,
  updateBroadcastPresentation,
  importTournamentBrandingToBadminton,
} from "../lib/master-sports/badminton";
import { parseValidatedSponsorLogos } from "../lib/sponsor-validation";
import { broadcastTournamentUpdate } from "../lib/badminton-broadcast";

const router = Router({ mergeParams: true });

function tid(req: { params: Record<string, string> }): number | null {
  const n = parseInt(req.params.id, 10);
  return Number.isNaN(n) ? null : n;
}

function parseAuctionTeamFilter(req: { query: Record<string, unknown> }): number | undefined {
  const teamIdRaw = req.query.teamId;
  const auctionTeamId = teamIdRaw != null ? parseInt(String(teamIdRaw), 10) : undefined;
  return Number.isFinite(auctionTeamId) ? auctionTeamId : undefined;
}

async function listRosterItems(req: {
  params: Record<string, string>;
  query: Record<string, unknown>;
}, res: {
  status: (code: number) => { json: (body: unknown) => void };
  json: (body: unknown) => void;
}): Promise<void> {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const items = await listCricketMasterPlayers(tournamentId, parseAuctionTeamFilter(req));
  res.json(items);
}

/** GET Player Registry franchise teams with squad counts */
router.get("/master-teams", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const items = await listCricketMasterTeams(tournamentId);
  res.json(items);
});

/** GET players for cricket scorer (optional ?teamId= opaque franchise team filter) */
router.get("/master-players", async (req, res) => {
  await listRosterItems(req, res);
});

/** GET unified tournament roster for scorer adapters (alias of /master-players). */
router.get("/roster", async (req, res) => {
  await listRosterItems(req, res);
});

/** GET active Player Registry squad for one franchise team */
router.get("/squads/:auctionTeamId", async (req, res) => {
  const tournamentId = tid(req);
  const auctionTeamId = parseInt(req.params.auctionTeamId, 10);
  if (!tournamentId || Number.isNaN(auctionTeamId)) {
    res.status(400).json({ error: "Invalid parameters" });
    return;
  }

  const items = await listCricketSquadPlayers(tournamentId, auctionTeamId);
  res.json(items);
});

/** POST sync auction teams + roster → master layer — use Auction handoff. */
router.post("/sync-roster", async (_req, res) => {
  res.status(410).json({
    error: "Make teams & players available from Auction (handoff-to-sports).",
    code: "AUCTION_SYNC_REMOVED",
    handoffPath: "/api/tournaments/:id/auction/handoff-to-sports",
  });
});

/** GET Sports branding for cricket displays / tournament settings */
router.get("/branding", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }

  const branding = await loadBadmintonBranding(tournamentId);
  if (!branding) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  res.json(branding);
});

/** PATCH Sports branding (identity, sponsors, scoreboard sponsor) */
router.patch("/branding", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z.object({
    displayName: z.string().min(1).max(200).optional(),
    logoUrl: z
      .string()
      .nullable()
      .optional()
      .refine(
        (v) => v == null || v === "" || v.startsWith("https://res.cloudinary.com/"),
        "Logo URL must be a Cloudinary HTTPS URL",
      ),
    logoPublicId: z.string().nullable().optional(),
    sponsorLogos: z.string().nullable().optional(),
    venue: z.string().max(200).nullable().optional(),
    organizerName: z.string().max(200).nullable().optional(),
    primaryColor: z.string().max(20).optional(),
    accentColor: z.string().max(20).optional(),
    scoreBoardSponsor: z
      .object({
        logoUrl: z
          .string()
          .nullable()
          .optional()
          .refine(
            (v) => v == null || v === "" || v.startsWith("https://res.cloudinary.com/"),
            "Logo URL must be a Cloudinary HTTPS URL",
          ),
        logoPublicId: z.string().nullable().optional(),
        name: z.string().max(200).nullable().optional(),
        title: z.string().max(200).nullable().optional(),
      })
      .nullable()
      .optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  if (parsed.data.sponsorLogos !== undefined) {
    const sponsorCheck = parseValidatedSponsorLogos(parsed.data.sponsorLogos ?? undefined);
    if (!sponsorCheck.ok) {
      res.status(400).json({ error: sponsorCheck.error });
      return;
    }
    parsed.data.sponsorLogos = sponsorCheck.value ?? null;
  }

  try {
    const brandingInput = {
      ...parsed.data,
      scoreBoardSponsor:
        parsed.data.scoreBoardSponsor == null
          ? parsed.data.scoreBoardSponsor
          : {
              logoUrl: parsed.data.scoreBoardSponsor.logoUrl ?? null,
              logoPublicId: parsed.data.scoreBoardSponsor.logoPublicId ?? null,
              name: parsed.data.scoreBoardSponsor.name ?? null,
              title: parsed.data.scoreBoardSponsor.title ?? null,
            },
    };
    const branding = await updateBadmintonBranding(tournamentId, brandingInput, req.log);
    res.json(branding);
  } catch (e) {
    res.status(404).json({ error: e instanceof Error ? e.message : "Update failed" });
  }
});

/** PATCH venue music / banner for cricket Sports displays */
router.patch("/broadcast-presentation", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  const schema = z
    .object({
      venueMusicPlaying: z.boolean().optional(),
      venueMusicUrl: z
        .string()
        .nullable()
        .optional()
        .refine(
          (v) => v == null || v === "" || /^https?:\/\//i.test(v),
          "Music URL must be http(s)",
        ),
      venueMusicFileName: z.string().trim().max(180).nullable().optional(),
      venueMusicVolume: z.number().int().min(0).max(100).optional(),
      importAuctionMusic: z.literal(true).optional(),
      venueBannerUrl: z
        .string()
        .nullable()
        .optional()
        .refine(
          (v) => v == null || v === "" || /^https?:\/\//i.test(v),
          "Banner URL must be http(s)",
        ),
      venueBannerPublicId: z.string().trim().max(400).nullable().optional(),
      venueBannerFit: z.enum(["cover", "contain"]).optional(),
      importAuctionBanner: z.literal(true).optional(),
    })
    .refine(
      (v) =>
        v.venueMusicPlaying !== undefined
        || v.venueMusicUrl !== undefined
        || v.venueMusicFileName !== undefined
        || v.venueMusicVolume !== undefined
        || v.importAuctionMusic === true
        || v.venueBannerUrl !== undefined
        || v.venueBannerPublicId !== undefined
        || v.venueBannerFit !== undefined
        || v.importAuctionBanner === true,
      { message: "At least one presentation field required" },
    );
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  try {
    const musicUrl =
      parsed.data.venueMusicUrl === undefined
        ? undefined
        : parsed.data.venueMusicUrl === ""
          ? null
          : parsed.data.venueMusicUrl;
    const bannerUrl =
      parsed.data.venueBannerUrl === undefined
        ? undefined
        : parsed.data.venueBannerUrl === ""
          ? null
          : parsed.data.venueBannerUrl;
    const branding = await updateBroadcastPresentation(tournamentId, {
      venueMusicPlaying: parsed.data.venueMusicPlaying,
      venueMusicUrl: musicUrl,
      venueMusicFileName: parsed.data.venueMusicFileName,
      venueMusicVolume: parsed.data.venueMusicVolume,
      importAuctionMusic: parsed.data.importAuctionMusic,
      venueBannerUrl: bannerUrl,
      venueBannerPublicId: parsed.data.venueBannerPublicId,
      venueBannerFit: parsed.data.venueBannerFit,
      importAuctionBanner: parsed.data.importAuctionBanner,
    });
    broadcastTournamentUpdate(tournamentId, {
      kind: "broadcast_presentation",
      primaryBroadcastMatchId: branding.primaryBroadcastMatchId,
      overlayScene: branding.overlayScene,
      venueScene: branding.venueScene,
      upNextMatchId: branding.upNextMatchId,
      spotlightSponsorUrl: branding.spotlightSponsorUrl,
      pinnedSponsorUrl: branding.pinnedSponsorUrl,
      venueMusicPlaying: branding.venueMusicPlaying,
      resolvedVenueMusicUrl: branding.resolvedVenueMusicUrl,
      resolvedVenueBannerUrl: branding.resolvedVenueBannerUrl,
      resolvedVenueBannerFit: branding.resolvedVenueBannerFit,
      venueBannerUrl: branding.venueBannerUrl,
      venueBannerFit: branding.venueBannerFit,
      auctionMainBannerUrl: branding.auctionMainBannerUrl,
    });
    res.json(branding);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    const status =
      message.includes("No auction break music")
      || message.includes("No auction banner")
        ? 400
        : 404;
    res.status(status).json({ error: message });
  }
});

/** POST import Auction/tournament branding into cricket Sports overlay */
router.post("/import-tournament-branding", async (req, res) => {
  const tournamentId = tid(req);
  if (!tournamentId) {
    res.status(400).json({ error: "Invalid tournament id" });
    return;
  }
  if (!(await requireTournamentOrganizer(req, res, tournamentId))) return;

  try {
    const branding = await importTournamentBrandingToBadminton(tournamentId);
    res.json(branding);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Import failed" });
  }
});

export default router;
