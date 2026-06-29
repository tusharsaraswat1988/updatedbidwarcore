import { Router } from "express";
import {
  DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
  DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
  DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
  DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
} from "@workspace/api-base/auction-readiness";
import { parseBidValueOptions, serializeBidValueOptions } from "@workspace/api-base/bid-value";
import {
  REGISTRATION_OPTIONAL_FIELD_KEYS,
  serializeRegistrationFieldsConfig,
} from "@workspace/api-base/registration-fields";
import { randomBytes, randomInt } from "crypto";
import { isAccountOrAdmin, requireTournamentOrganizer, canAccessPrivateTournamentData } from "../middleware/require-organizer";
import { publicTournamentSerializer, privateTournamentSerializer } from "../lib/serializers/tournament";
import { db } from "@workspace/db";
import { tournamentsTable, teamsTable, playersTable, categoriesTable, bidsTable, organizersTable, purseBoostersTable, brandingSettingsTable, auctionSessionsTable } from "@workspace/db";
import { isKnownActiveSportSlug, resolveSportIdBySlug } from "./sports";
import {
  isScoringSupportedSport,
  TOURNAMENT_LIFECYCLE_STATUSES,
} from "../lib/tournament-lifecycle";
import { isPlaceholderOrganizerMobile } from "@workspace/api-base/mobile";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { exportLimiter } from "../lib/rate-limiters";
import { broadcastToTournament } from "../lib/broadcast";
import { validateExportToken } from "../lib/export-token";
import { buildPublicUrl, getPublicOrigin } from "../lib/runtime-env";
import { notifyAsync } from "../lib/notifications";
import { auditLog } from "../lib/audit-service";
import { parseAuditReason, tournamentConfigFieldsChanged } from "../lib/audit-reason";
import { snapshotTournament } from "../lib/audit-snapshots";
import {
  PAYMENT_COLLECTION_MODES,
  PAYMENT_VERIFICATION_METHODS,
} from "@workspace/api-base/registration-payment";
import { validateTournamentPaymentSettings } from "../lib/registration-payment";
import { evaluateVenueAuctionGuard } from "@workspace/api-base/venue-auction-guard";
import { parseValidatedSponsorLogos } from "../lib/sponsor-validation";
import { commitBatchCloudinaryImageWrites, destroyRemovedCloudinaryImages } from "../lib/cloudinary-media-service";
import {
  listRemovedSponsorLogos,
  parseSponsorLogosJson,
} from "../lib/sponsor-logo-cleanup";
import {
  queueImageFieldChange,
  type ImageFieldChange,
} from "../lib/cloudinary-image-fields";
import { getPlatformDefaultAudioCached } from "../lib/platform-audio-defaults";
import { brandingService } from "../lib/branding-service.js";
import {
  resolveBroadcastAudioUrl,
  type PlatformAudioDefaults,
} from "@workspace/api-base/platform-audio";

// ─── Auction Code Generation ──────────────────────────────────────────────────
// Format: TT + NN + DDMM
//   TT   = first letter of first two words (or first 2 chars of single word), uppercase
//   NN   = random 2-digit number 10–99
//   DDMM = zero-padded day + month from auctionDate (today if omitted)
function buildAuctionCode(name: string, auctionDate?: string | null): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const tt = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : (words[0]?.substring(0, 2) ?? "XX").toUpperCase();
  const nn = String(Math.floor(Math.random() * 90) + 10);
  const d = auctionDate ? new Date(auctionDate) : new Date();
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${tt}${nn}${dd}${mm}`;
}

async function generateUniqueAuctionCode(name: string, auctionDate?: string | null): Promise<string> {
  for (let attempt = 0; attempt < 15; attempt++) {
    const code = buildAuctionCode(name, auctionDate);
    const existing = await db
      .select({ id: tournamentsTable.id })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.auctionCode, code))
      .limit(1);
    if (existing.length === 0) return code;
  }
  // Fallback: append random 2-digit suffix to guarantee uniqueness
  return buildAuctionCode(name, auctionDate) + String(Math.floor(Math.random() * 90) + 10);
}

const cloudinaryLogoUrl = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.startsWith("https://res.cloudinary.com/"),
    "Logo URL must be a Cloudinary HTTPS URL (https://res.cloudinary.com/...)",
  );

const router = Router();

const tournamentToJson = privateTournamentSerializer;
const tournamentToPublicJson = publicTournamentSerializer;

router.get("/tournaments", async (req, res) => {
  const tournaments = await db.select().from(tournamentsTable).orderBy(tournamentsTable.createdAt);
  const isPrivate = isAccountOrAdmin(req) || !!req.jwtUser?.isAdmin;
  res.json(tournaments.map((t) => (isPrivate ? tournamentToJson(t) : tournamentToPublicJson(t))));
});

const tournamentInputSchema = z.object({
  name: z.string().min(1),
  sport: z.string().default("cricket"),
  venue: z.string().optional(),
  auctionDate: z.string().optional(),
  auctionTime: z.string().nullable().optional(),
  organizerName: z.string().optional(),
  organizerMobile: z.string().optional(),
  organizerEmail: z.string().optional(),
  logoUrl: cloudinaryLogoUrl,
  logoPublicId: z.string().optional().nullable(),
  sponsorLogos: z.string().optional(),
  basePurse: z.number().int().optional(),
  minBid: z.number().int().optional(),
  bidIncrement: z.number().int().optional(),
  bidTiers: z.string().optional(),
  timerSeconds: z.number().int().optional(),
  bidTimerSeconds: z.number().int().optional(),
  playerSelectionMode: z.enum(["sequential", "random", "manual"]).optional(),
  minimumSquadSize: z.number().int().min(0).optional(),
  maximumSquadSize: z.number().int().min(0).optional(),
  audioEnabled: z.boolean().optional(),
  masterVolume: z.number().int().min(0).max(100).optional(),
  countdownSoundEnabled: z.boolean().optional(),
  countdownSoundUrl: z.string().optional(),
  countdownSoundVolume: z.number().int().min(0).max(100).optional(),
  soldSoundEnabled: z.boolean().optional(),
  soldSoundUrl: z.string().optional(),
  soldSoundVolume: z.number().int().min(0).max(100).optional(),
  breakEndMusicEnabled: z.boolean().optional(),
  breakEndMusicUrl: z.string().optional(),
  breakEndMusicVolume: z.number().int().min(0).max(100).optional(),
  matchDates: z.string().nullable().optional(),
});

router.post("/tournaments", async (req, res) => {
  if (!isAccountOrAdmin(req)) { res.status(401).json({ error: "Authentication required" }); return; }
  const parsed = tournamentInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;

  if (!await isKnownActiveSportSlug(d.sport)) {
    res.status(400).json({ error: "Unknown or inactive sport" });
    return;
  }

  let validatedSponsorLogos: string | null | undefined;
  if (d.sponsorLogos !== undefined) {
    const sponsorCheck = parseValidatedSponsorLogos(d.sponsorLogos);
    if (!sponsorCheck.ok) {
      res.status(400).json({ error: sponsorCheck.error });
      return;
    }
    validatedSponsorLogos = sponsorCheck.value ?? null;
  }

  const auctionCode = await generateUniqueAuctionCode(d.name, d.auctionDate);

  let organizerId: number | null = null;
  let organizerName = d.organizerName ?? null;
  let organizerMobile = d.organizerMobile ?? null;
  let organizerEmail = d.organizerEmail ?? null;

  // Auto-fill organiser contact from logged-in account (form has no email field)
  if (req.jwtUser?.organizerAccountId) {
    const [account] = await db
      .select()
      .from(organizersTable)
      .where(eq(organizersTable.id, req.jwtUser.organizerAccountId))
      .limit(1);
    if (account) {
      organizerId = account.id;
      organizerName = organizerName || account.name;
      organizerEmail = organizerEmail || account.email;
      if (!organizerMobile && !isPlaceholderOrganizerMobile(account.mobile)) {
        organizerMobile = account.mobile;
      }
    }
  }

  const [tournament] = await db
    .insert(tournamentsTable)
    .values({
      name: d.name,
      sport: d.sport,
      sportId: await resolveSportIdBySlug(d.sport),
      auctionCode,
      venue: d.venue ?? null,
      auctionDate: d.auctionDate ?? null,
      auctionTime: d.auctionTime ?? null,
      organizerId,
      organizerName,
      organizerMobile,
      organizerEmail,
      logoUrl: d.logoUrl ?? null,
      logoPublicId: d.logoPublicId ?? null,
      sponsorLogos: validatedSponsorLogos ?? null,
      basePurse: d.basePurse ?? 10000000,
      minBid: d.minBid ?? 100000,
      bidIncrement: d.bidIncrement ?? 100000,
      bidTiers: d.bidTiers ?? DEFAULT_NEW_TOURNAMENT_BID_TIERS_JSON,
      timerSeconds: d.timerSeconds ?? DEFAULT_NEW_TOURNAMENT_TIMER_SECONDS,
      bidTimerSeconds: d.bidTimerSeconds ?? DEFAULT_NEW_TOURNAMENT_BID_TIMER_SECONDS,
      playerSelectionMode: d.playerSelectionMode ?? DEFAULT_NEW_TOURNAMENT_PLAYER_SELECTION_MODE,
      minimumSquadSize: d.minimumSquadSize ?? 0,
      maximumSquadSize: d.maximumSquadSize ?? 0,
      matchDates: d.matchDates ?? null,
      status: "setup",
    })
    .returning();

  notifyAsync("TOURNAMENT_CREATED", {
    tournamentId: tournament.id,
    tournamentName: tournament.name,
    sport: tournament.sport,
    auctionCode: tournament.auctionCode,
    auctionDate: tournament.auctionDate,
    auctionTime: tournament.auctionTime,
    venue: tournament.venue,
    organizerName: tournament.organizerName,
    organizerEmail: tournament.organizerEmail,
    organizerMobile: tournament.organizerMobile,
    organizerId: tournament.organizerId,
  });

  res.status(201).json(tournamentToJson(tournament));
});

router.get("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }
  const platformDefaults = await getPlatformDefaultAudioCached();
  const isOrganizer = await canAccessPrivateTournamentData(req, id);
  const serializer = isOrganizer ? tournamentToJson : tournamentToPublicJson;
  res.json(serializer(tournament, {
    includeScoringPin: isOrganizer,
    platformDefaults,
  }));
});

router.patch("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, id))) return;
  const schema = z.object({
    name: z.string().optional(),
    sport: z.string().optional(),
    venue: z.string().optional(),
    auctionDate: z.string().optional(),
    auctionTime: z.string().nullable().optional(),
    organizerName: z.string().optional(),
    organizerMobile: z.string().optional(),
    organizerEmail: z.string().optional(),
    logoUrl: cloudinaryLogoUrl,
    logoPublicId: z.string().optional().nullable(),
    sponsorLogos: z.string().optional(),
    basePurse: z.number().int().optional(),
    minBid: z.number().int().optional(),
    bidIncrement: z.number().int().optional(),
    bidTier1UpTo: z.number().int().optional(),
    bidTier1Increment: z.number().int().optional(),
    bidTier2UpTo: z.number().int().optional(),
    bidTier2Increment: z.number().int().optional(),
    bidTier3Increment: z.number().int().optional(),
    bidTiers: z.string().optional(),
    timerSeconds: z.number().int().optional(),
    bidTimerSeconds: z.number().int().optional(),
    bidExtensionEnabled: z.boolean().optional(),
    bidExtensionThresholdSeconds: z.number().int().min(1).max(60).optional(),
    bidExtensionSeconds: z.number().int().min(1).max(120).optional(),
    playerSelectionMode: z.enum(["sequential", "random", "manual"]).optional(),
    status: z.enum(TOURNAMENT_LIFECYCLE_STATUSES).optional(),
    registrationDeadline: z.string().nullable().optional(),
    registrationLimit: z.number().int().nullable().optional(),
    autoApproveWithdrawnReRegistration: z.boolean().optional(),
    enableRegistrationPayment: z.boolean().optional(),
    registrationFee: z.number().int().min(1).nullable().optional(),
    upiId: z.string().nullable().optional(),
    paymentVerificationMethod: z.enum(PAYMENT_VERIFICATION_METHODS).nullable().optional(),
    paymentCollectionMode: z.enum(PAYMENT_COLLECTION_MODES).optional(),
    enableRegistrationDeclaration: z.boolean().optional(),
    registrationDeclarationText: z.string().nullable().optional(),
    bidValueMode: z.enum(["system", "player"]).optional(),
    bidValueOptions: z.array(z.number().int().positive()).optional(),
    registrationFields: z
      .object({
        hidden: z.array(z.enum(REGISTRATION_OPTIONAL_FIELD_KEYS)).optional(),
      })
      .optional(),
    minimumSquadSize: z.number().int().min(0).nullable().optional(),
    maximumSquadSize: z.number().int().min(0).nullable().optional(),
    audioEnabled: z.boolean().optional(),
    masterVolume: z.number().int().min(0).max(100).optional(),
    countdownSoundEnabled: z.boolean().optional(),
    countdownSoundUrl: z.string().nullable().optional(),
    countdownSoundVolume: z.number().int().min(0).max(100).optional(),
    soldSoundEnabled: z.boolean().optional(),
    soldSoundUrl: z.string().nullable().optional(),
    soldSoundVolume: z.number().int().min(0).max(100).optional(),
    breakEndMusicEnabled: z.boolean().optional(),
    breakEndMusicUrl: z.string().nullable().optional(),
    breakEndMusicVolume: z.number().int().min(0).max(100).optional(),
    mainBannerUrl: z.string().nullable().optional(),
    mainBannerPublicId: z.string().optional().nullable(),
    mainBannerEnabled: z.boolean().optional(),
    mainBannerFit: z.enum(["cover", "contain"]).optional(),
    matchDates: z.string().nullable().optional(),
    scoringEnabled: z.boolean().optional(),
    scoringPhase: z.enum(["disabled", "active", "completed"]).optional(),
    scoringPin: z.string().min(4).max(12).nullable().optional(),
    reason: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }
  const d = parsed.data;
  const configFields = tournamentConfigFieldsChanged(d as Record<string, unknown>);
  if (configFields.length > 0) {
    const reasonResult = parseAuditReason(req.body, true);
    if (!reasonResult.ok) { res.status(400).json({ error: reasonResult.error }); return; }
  }
  const [beforeTournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!beforeTournament) { res.status(404).json({ error: "Tournament not found" }); return; }
  const isAdminCaller = req.jwtUser?.isAdmin === true;

  const nextMinimumSquadSize = d.minimumSquadSize !== undefined ? (d.minimumSquadSize ?? 0) : beforeTournament.minimumSquadSize;
  const nextMaximumSquadSize = d.maximumSquadSize !== undefined ? (d.maximumSquadSize ?? 0) : beforeTournament.maximumSquadSize;
  if (nextMinimumSquadSize > 0 && nextMaximumSquadSize > 0 && nextMaximumSquadSize < nextMinimumSquadSize) {
    res.status(400).json({ error: "Maximum players cannot be less than minimum players." });
    return;
  }

  const nextBidValueMode = d.bidValueMode ?? beforeTournament.bidValueMode ?? "system";
  const nextBidValueOptionsRaw = d.bidValueOptions !== undefined
    ? serializeBidValueOptions(d.bidValueOptions)
    : beforeTournament.bidValueOptions;
  if (nextBidValueMode === "player" && parseBidValueOptions(nextBidValueOptionsRaw).length === 0) {
    res.status(400).json({ error: "Add at least one allowed bid value when using Player Selected mode." });
    return;
  }

  if (d.sport !== undefined) {
    if (!await isKnownActiveSportSlug(d.sport)) {
      res.status(400).json({ error: "Unknown or inactive sport" });
      return;
    }
    if (d.sport !== beforeTournament.sport) {
      const [playerCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(playersTable)
        .where(eq(playersTable.tournamentId, id));
      if ((playerCountRow?.count ?? 0) > 0) {
        res.status(400).json({ error: "Sport cannot be changed while players exist in the pool." });
        return;
      }
    }
  }

  const nextSport = d.sport ?? beforeTournament.sport;
  const nextScoringEnabled =
    isAdminCaller && d.scoringEnabled !== undefined
      ? d.scoringEnabled
      : beforeTournament.scoringEnabled;
  if (nextScoringEnabled && !isScoringSupportedSport(nextSport)) {
    res.status(400).json({
      error: "Match scoring can only be enabled for cricket or badminton tournaments.",
    });
    return;
  }

  const updates: Record<string, unknown> = {};
  const imageChanges: ImageFieldChange[] = [];
  let removedSponsorLogos: ReturnType<typeof listRemovedSponsorLogos> = [];
  if (d.name !== undefined) updates.name = d.name;
  if (d.sport !== undefined) {
    updates.sport = d.sport;
    updates.sportId = await resolveSportIdBySlug(d.sport);
  }
  if (d.venue !== undefined) updates.venue = d.venue;
  if (d.auctionDate !== undefined) updates.auctionDate = d.auctionDate;
  if (d.auctionTime !== undefined) updates.auctionTime = d.auctionTime;
  if (d.organizerName !== undefined) updates.organizerName = d.organizerName;
  if (d.organizerMobile !== undefined) updates.organizerMobile = d.organizerMobile;
  if (d.organizerEmail !== undefined) updates.organizerEmail = d.organizerEmail;
  queueImageFieldChange(imageChanges, updates, {
    label: "logoUrl",
    urlKey: "logoUrl",
    publicIdKey: "logoPublicId",
    existing: { url: beforeTournament.logoUrl, publicId: beforeTournament.logoPublicId },
    nextUrl: d.logoUrl,
    nextPublicId: d.logoPublicId,
  });
  if (d.sponsorLogos !== undefined) {
    const sponsorCheck = parseValidatedSponsorLogos(d.sponsorLogos);
    if (!sponsorCheck.ok) {
      res.status(400).json({ error: sponsorCheck.error });
      return;
    }
    removedSponsorLogos = listRemovedSponsorLogos(
      parseSponsorLogosJson(beforeTournament.sponsorLogos),
      parseSponsorLogosJson(sponsorCheck.value ?? null),
    );
    updates.sponsorLogos = sponsorCheck.value ?? null;
  }
  if (d.basePurse !== undefined) updates.basePurse = d.basePurse;
  if (d.minBid !== undefined) updates.minBid = d.minBid;
  if (d.bidIncrement !== undefined) updates.bidIncrement = d.bidIncrement;
  if (d.bidTier1UpTo !== undefined) updates.bidTier1UpTo = d.bidTier1UpTo;
  if (d.bidTier1Increment !== undefined) updates.bidTier1Increment = d.bidTier1Increment;
  if (d.bidTier2UpTo !== undefined) updates.bidTier2UpTo = d.bidTier2UpTo;
  if (d.bidTier2Increment !== undefined) updates.bidTier2Increment = d.bidTier2Increment;
  if (d.bidTier3Increment !== undefined) updates.bidTier3Increment = d.bidTier3Increment;
  if (d.bidTiers !== undefined) updates.bidTiers = d.bidTiers;
  if (d.timerSeconds !== undefined) updates.timerSeconds = d.timerSeconds;
  if (d.bidTimerSeconds !== undefined) updates.bidTimerSeconds = d.bidTimerSeconds;
  if (d.bidExtensionEnabled !== undefined) updates.bidExtensionEnabled = d.bidExtensionEnabled;
  if (d.bidExtensionThresholdSeconds !== undefined) updates.bidExtensionThresholdSeconds = d.bidExtensionThresholdSeconds;
  if (d.bidExtensionSeconds !== undefined) updates.bidExtensionSeconds = d.bidExtensionSeconds;
  if (d.playerSelectionMode !== undefined) updates.playerSelectionMode = d.playerSelectionMode;
  if (d.status !== undefined) updates.status = d.status;
  if (d.registrationDeadline !== undefined)
    updates.registrationDeadline = d.registrationDeadline === "" ? null : d.registrationDeadline;
  if (d.registrationLimit !== undefined) updates.registrationLimit = d.registrationLimit;
  if (d.autoApproveWithdrawnReRegistration !== undefined) {
    updates.autoApproveWithdrawnReRegistration = d.autoApproveWithdrawnReRegistration;
  }
  if (d.enableRegistrationPayment !== undefined) updates.enableRegistrationPayment = d.enableRegistrationPayment;
  if (d.registrationFee !== undefined) updates.registrationFee = d.registrationFee;
  if (d.upiId !== undefined) updates.upiId = d.upiId === "" ? null : d.upiId;
  if (d.paymentVerificationMethod !== undefined) updates.paymentVerificationMethod = d.paymentVerificationMethod;
  if (d.paymentCollectionMode !== undefined) updates.paymentCollectionMode = d.paymentCollectionMode;
  if (d.enableRegistrationDeclaration !== undefined) updates.enableRegistrationDeclaration = d.enableRegistrationDeclaration;
  if (d.registrationDeclarationText !== undefined) {
    updates.registrationDeclarationText = d.registrationDeclarationText === "" ? null : d.registrationDeclarationText;
  }
  if (d.bidValueMode !== undefined) updates.bidValueMode = d.bidValueMode;
  if (d.bidValueOptions !== undefined) {
    updates.bidValueOptions = serializeBidValueOptions(d.bidValueOptions);
  }
  if (d.registrationFields !== undefined) {
    updates.registrationFieldsJson = serializeRegistrationFieldsConfig(
      d.registrationFields.hidden ?? [],
    );
  }
  if (d.minimumSquadSize !== undefined) updates.minimumSquadSize = d.minimumSquadSize ?? 0;
  if (d.maximumSquadSize !== undefined) updates.maximumSquadSize = d.maximumSquadSize ?? 0;
  if (d.audioEnabled !== undefined) updates.audioEnabled = d.audioEnabled;
  if (d.masterVolume !== undefined) updates.masterVolume = d.masterVolume;
  if (d.countdownSoundEnabled !== undefined) updates.countdownSoundEnabled = d.countdownSoundEnabled;
  if (d.countdownSoundUrl !== undefined) updates.countdownSoundUrl = d.countdownSoundUrl === "" ? null : d.countdownSoundUrl;
  if (d.countdownSoundVolume !== undefined) updates.countdownSoundVolume = d.countdownSoundVolume;
  if (d.soldSoundEnabled !== undefined) updates.soldSoundEnabled = d.soldSoundEnabled;
  if (d.soldSoundUrl !== undefined) updates.soldSoundUrl = d.soldSoundUrl === "" ? null : d.soldSoundUrl;
  if (d.soldSoundVolume !== undefined) updates.soldSoundVolume = d.soldSoundVolume;
  if (d.breakEndMusicEnabled !== undefined) updates.breakEndMusicEnabled = d.breakEndMusicEnabled;
  if (d.breakEndMusicUrl !== undefined) updates.breakEndMusicUrl = d.breakEndMusicUrl === "" ? null : d.breakEndMusicUrl;
  if (d.breakEndMusicVolume !== undefined) updates.breakEndMusicVolume = d.breakEndMusicVolume;
  queueImageFieldChange(imageChanges, updates, {
    label: "mainBannerUrl",
    urlKey: "mainBannerUrl",
    publicIdKey: "mainBannerPublicId",
    existing: { url: beforeTournament.mainBannerUrl, publicId: beforeTournament.mainBannerPublicId },
    nextUrl: d.mainBannerUrl,
    nextPublicId: d.mainBannerPublicId,
  });
  if (d.mainBannerEnabled !== undefined) updates.mainBannerEnabled = d.mainBannerEnabled;
  if (d.mainBannerFit !== undefined) updates.mainBannerFit = d.mainBannerFit;
  if (d.matchDates !== undefined) updates.matchDates = d.matchDates;
  if (isAdminCaller) {
    if (d.scoringEnabled !== undefined) {
      updates.scoringEnabled = d.scoringEnabled;
      if (d.scoringEnabled && d.scoringPhase === undefined) {
        updates.scoringPhase = "active";
      }
      if (!d.scoringEnabled && d.scoringPhase === undefined) {
        updates.scoringPhase = "disabled";
      }
    }
    if (d.scoringPhase !== undefined) updates.scoringPhase = d.scoringPhase;
    if (d.scoringPin !== undefined) updates.scoringPin = d.scoringPin === "" ? null : d.scoringPin;
  }
  const mergedPaymentSettings = {
    enableRegistrationPayment:
      d.enableRegistrationPayment ?? beforeTournament?.enableRegistrationPayment ?? false,
    registrationFee:
      d.registrationFee !== undefined ? d.registrationFee : (beforeTournament?.registrationFee ?? null),
    upiId: d.upiId !== undefined ? d.upiId : (beforeTournament?.upiId ?? null),
    paymentVerificationMethod:
      d.paymentVerificationMethod !== undefined
        ? d.paymentVerificationMethod
        : (beforeTournament?.paymentVerificationMethod ?? null),
  };
  const paymentSettingsValidation = validateTournamentPaymentSettings(mergedPaymentSettings);
  if (!paymentSettingsValidation.ok) {
    res.status(400).json({ error: paymentSettingsValidation.error, field: paymentSettingsValidation.field });
    return;
  }
  let tournament!: typeof tournamentsTable.$inferSelect;
  const persistTournamentUpdate = async () => {
    const [updated] = await db
      .update(tournamentsTable)
      .set(updates)
      .where(eq(tournamentsTable.id, id))
      .returning();
    if (!updated) throw new Error("TOURNAMENT_NOT_FOUND");
    tournament = updated;
  };

  try {
    if (imageChanges.length > 0) {
      await commitBatchCloudinaryImageWrites({
        changes: imageChanges,
        persist: persistTournamentUpdate,
        logger: req.log,
        context: { route: "tournaments.patch", tournamentId: id },
      });
    } else {
      await persistTournamentUpdate();
    }
  } catch (err) {
    if ((err as Error).message === "TOURNAMENT_NOT_FOUND") {
      res.status(404).json({ error: "Not found" });
      return;
    }
    throw err;
  }

  if (removedSponsorLogos.length > 0) {
    await destroyRemovedCloudinaryImages(removedSponsorLogos, req.log, {
      route: "tournaments.patch.sponsorLogos",
      tournamentId: id,
    });
  }
  const reasonResult = parseAuditReason(req.body, configFields.length > 0);
  auditLog(req, {
    category: "tournament",
    action: configFields.length > 0 ? "tournament.config_updated" : "tournament.updated",
    summary: `Tournament "${tournament.name}" settings updated`,
    severity: configFields.length > 0 ? "critical" : "info",
    reason: reasonResult.ok ? reasonResult.reason : null,
    tournamentId: id,
    resource: { type: "tournament", id: id },
    before: beforeTournament ? snapshotTournament(beforeTournament) : null,
    after: snapshotTournament(tournament),
    metadata: { configFields },
    alertKey: configFields.length > 0 ? "tournament_config_changed" : null,
  });
  // Broadcast settings change so connected operator panels refresh immediately
  broadcastToTournament(id, { type: "settings_changed" });
  const platformDefaults = await getPlatformDefaultAudioCached();
  res.json(tournamentToJson(tournament, { includeScoringPin: true, platformDefaults }));
});

router.delete("/tournaments/:tournamentId", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, id))) return;
  const [before] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!before) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const { adminDeleteTournamentCascade } = await import("../lib/admin-delete-tournament");
  const deleted = await adminDeleteTournamentCascade(id);
  if (!deleted) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  auditLog(req, {
    category: "tournament",
    action: "tournament.deleted",
    summary: `Tournament "${before.name}" deleted`,
    severity: "critical",
    tournamentId: id,
    resource: { type: "tournament", id: id },
    before: snapshotTournament(before),
    alertKey: "tournament_deleted",
  });
  res.status(204).send();
});

// Venue auction guard — used by BidWar Local before starting a LAN auction.
router.get("/tournaments/:tournamentId/venue-auction-guard", async (req, res) => {
  const id = parseInt(String(req.params.tournamentId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  const tokenCheck = validateExportToken(
    req.headers["x-export-token"],
    tournament.exportToken,
    tournament.exportTokenExpiresAt,
  );
  if (!tokenCheck.valid) {
    res.status(tokenCheck.status).json({ error: tokenCheck.error });
    return;
  }

  const [session] = await db
    .select({ status: auctionSessionsTable.status })
    .from(auctionSessionsTable)
    .where(eq(auctionSessionsTable.tournamentId, id));

  const guard = evaluateVenueAuctionGuard({
    localModeEnabled: !!tournament.localModeEnabled,
    cloudSessionStatus: session?.status ?? "idle",
    lastMirrorAt: tournament.exportTokenLastMirrorAt,
  });

  res.json({
    blockLocalStart: guard.blockLocalStart,
    blockLocalStartReason: guard.blockLocalStartReason,
    blockCloudStart: guard.blockCloudStart,
    blockCloudStartReason: guard.blockCloudStartReason,
    recentMirror: guard.recentMirror,
    cloudLive: guard.cloudLive,
  });
});

// Clear venue mirror heartbeat after local auction concludes.
router.post("/tournaments/:tournamentId/venue-auction-release", async (req, res) => {
  const id = parseInt(String(req.params.tournamentId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  const tokenCheck = validateExportToken(
    req.headers["x-export-token"],
    tournament.exportToken,
    tournament.exportTokenExpiresAt,
  );
  if (!tokenCheck.valid) {
    res.status(tokenCheck.status).json({ error: tokenCheck.error });
    return;
  }

  await db
    .update(tournamentsTable)
    .set({ exportTokenLastMirrorAt: null })
    .where(eq(tournamentsTable.id, id));

  res.json({ ok: true });
});

// GET export full tournament snapshot for local/offline mode
// Requires organizer or admin session — token issuance is a privileged action
router.get("/tournaments/:tournamentId/export", exportLimiter, async (req, res) => {
  const id = parseInt(String(req.params.tournamentId));
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  // Auth check: must be an admin, or an organizer authenticated specifically for this tournament.
  // Broad organizerAccountId is intentionally excluded — it allows any org-account holder to
  // access any tournament, which would let them mint export tokens for unrelated tournaments.
  const isAdmin = !!req.jwtUser.isAdmin;
  const isOrgForTournament = !!(req.jwtUser.organizer as Record<string, boolean> | undefined)?.[String(id)];
  if (!isAdmin && !isOrgForTournament) {
    res.status(401).json({ error: "Authentication required to export tournament" });
    return;
  }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  if (!tournament.localModeEnabled) {
    res.status(403).json({ error: "Local mode is not enabled for this tournament" });
    return;
  }

  // Generate a fresh 48-hour export token and venue operator PIN for this download
  const exportToken = randomBytes(32).toString("hex");
  const exportTokenExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const operatorPin = String(randomInt(1000, 10000));
  await db.update(tournamentsTable).set({ exportToken, exportTokenExpiresAt }).where(eq(tournamentsTable.id, id));

  // Derive the cloud base URL so the local app knows where to mirror back
  const cloudBaseUrl = getPublicOrigin();

  const teams = await db.select().from(teamsTable).where(eq(teamsTable.tournamentId, id));
  const players = await db.select().from(playersTable).where(eq(playersTable.tournamentId, id));
  const categories = await db.select().from(categoriesTable).where(eq(categoriesTable.tournamentId, id));

  const [brandingRow] = await db.select().from(brandingSettingsTable).limit(1);
  const assetsMap = await brandingService.getAssetsMap();
  const brandingPayload = brandingService.mergeLegacyAssetFields(
    brandingRow ? { ...brandingRow, createdAt: brandingRow.createdAt.toISOString(), updatedAt: brandingRow.updatedAt.toISOString() } : {},
    assetsMap,
  );
  const brandingAssets: Record<string, string> = {};
  for (const [type, asset] of Object.entries(assetsMap)) {
    if (asset?.fileUrl) brandingAssets[type] = asset.fileUrl;
  }
  if (Object.keys(brandingAssets).length > 0) {
    (brandingPayload as Record<string, unknown>).assets = brandingAssets;
  }

  const playerToJson = (p: typeof playersTable.$inferSelect) => ({
    id: p.id, tournamentId: p.tournamentId, categoryId: p.categoryId, teamId: p.teamId,
    name: p.name, city: p.city, role: p.role, battingStyle: p.battingStyle,
    bowlingStyle: p.bowlingStyle, specialization: p.specialization, age: p.age,
    photoUrl: p.photoUrl, basePrice: p.basePrice, soldPrice: p.soldPrice,
    retainedPrice: p.retainedPrice, status: p.status, jerseyNumber: p.jerseyNumber,
    achievements: p.achievements, mobileNumber: p.mobileNumber, cricheroUrl: p.cricheroUrl,
    availabilityDates: p.availabilityDates, createdAt: p.createdAt.toISOString(),
  });

  res.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    exportToken,
    operatorPin,
    cloudBaseUrl,
    tournament: {
      ...tournamentToJson(tournament),
      // Offline venue login only — included in local export snapshot, not public tournament APIs.
      organizerPassword: tournament.organizerPassword ?? null,
    },
    teams: teams.map(t => ({
      id: t.id, tournamentId: t.tournamentId, name: t.name, shortCode: t.shortCode,
      ownerName: t.ownerName, ownerMobile: t.ownerMobile, color: t.color,
      logoUrl: t.logoUrl, purse: t.purse, purseUsed: t.purseUsed,
      isBiddingEnabled: t.isBiddingEnabled, accessCode: t.accessCode,
      createdAt: t.createdAt.toISOString(),
    })),
    players: players.map(playerToJson),
    categories: categories.map(c => ({
      id: c.id, tournamentId: c.tournamentId, name: c.name, minBid: c.minBid,
      bidIncrement: c.bidIncrement, maxPlayers: c.maxPlayers, colorCode: c.colorCode,
      sortOrder: c.sortOrder, createdAt: c.createdAt.toISOString(),
    })),
    branding: brandingPayload,
  });
});

// POST sync local offline auction results back to cloud
router.post("/tournaments/:tournamentId/sync", async (req, res) => {
  const id = parseInt(req.params.tournamentId);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, id));
  if (!tournament) { res.status(404).json({ error: "Not found" }); return; }

  // Timing-safe token validation with clock-drift tolerance
  const tokenCheck = validateExportToken(
    req.headers["x-export-token"],
    tournament.exportToken,
    tournament.exportTokenExpiresAt,
  );
  if (!tokenCheck.valid) {
    req.log.warn({ tournamentId: id, reason: tokenCheck.reason, ip: req.ip }, "Sync: export token validation rejected");
    res.status(tokenCheck.status).json({ error: tokenCheck.error }); return;
  }

  // Replay prevention: reject a second sync with the same token.
  // Once results are synced, a new export (and fresh token) is required.
  if (tournament.exportTokenSyncedAt) {
    req.log.warn({ tournamentId: id, syncedAt: tournament.exportTokenSyncedAt.toISOString(), ip: req.ip }, "Sync: token replay attempt blocked");
    res.status(409).json({
      error: "This export token has already been used for sync. Re-export from cloud to sync again.",
      syncedAt: tournament.exportTokenSyncedAt.toISOString(),
    });
    return;
  }

  const schema = z.object({
    playerResults: z.array(z.object({
      cloudId: z.number().int(),
      status: z.string(),
      teamCloudId: z.number().int().nullable().optional(),
      soldPrice: z.number().int().nullable().optional(),
    })),
    teamPurses: z.array(z.object({
      cloudId: z.number().int(),
      purseUsed: z.number().int(),
    })),
    bids: z.array(z.object({
      playerCloudId: z.number().int(),
      teamCloudId: z.number().int(),
      amount: z.number().int(),
      timestamp: z.string(),
    })).optional().default([]),
    purseBoosters: z.array(z.object({
      localUuid: z.string(),
      teamCloudId: z.number().int(),
      amount: z.number().int().positive(),
      reason: z.string(),
      status: z.enum(["active", "cancelled"]),
      createdAt: z.string(),
      createdByLabel: z.string().nullable().optional(),
      cancelledAt: z.string().nullable().optional(),
      cancelReason: z.string().nullable().optional(),
      previousCapacity: z.number().int(),
      newCapacity: z.number().int(),
    })).optional().default([]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid sync payload" }); return; }

  const { playerResults, teamPurses, bids, purseBoosters } = parsed.data;

  let playersUpdated = 0;
  for (const p of playerResults) {
    await db.update(playersTable).set({
      status: p.status,
      teamId: p.teamCloudId ?? null,
      soldPrice: p.soldPrice ?? null,
    }).where(and(eq(playersTable.id, p.cloudId), eq(playersTable.tournamentId, id)));
    playersUpdated++;
  }

  let teamsUpdated = 0;
  for (const t of teamPurses) {
    await db.update(teamsTable).set({ purseUsed: t.purseUsed })
      .where(and(eq(teamsTable.id, t.cloudId), eq(teamsTable.tournamentId, id)));
    teamsUpdated++;
  }

  let bidsInserted = 0;
  for (const b of bids) {
    await db.insert(bidsTable).values({
      tournamentId: id,
      playerId: b.playerCloudId,
      teamId: b.teamCloudId,
      amount: b.amount,
    });
    bidsInserted++;
  }

  let boostersSynced = 0;
  for (const b of purseBoosters) {
    const [team] = await db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(and(eq(teamsTable.id, b.teamCloudId), eq(teamsTable.tournamentId, id)));
    if (!team) continue;

    await db
      .insert(purseBoostersTable)
      .values({
        localUuid: b.localUuid,
        tournamentId: id,
        teamId: team.id,
        amount: b.amount,
        reason: b.reason,
        status: b.status,
        createdByType: "system",
        createdByLabel: b.createdByLabel ?? "Local Sync",
        createdAt: new Date(b.createdAt),
        cancelledAt: b.cancelledAt ? new Date(b.cancelledAt) : null,
        cancelReason: b.cancelReason ?? null,
        previousCapacity: b.previousCapacity,
        newCapacity: b.newCapacity,
        origin: "local",
        syncState: "synced",
      })
      .onConflictDoUpdate({
        target: purseBoostersTable.localUuid,
        set: {
          status: b.status,
          cancelledAt: b.cancelledAt ? new Date(b.cancelledAt) : null,
          cancelReason: b.cancelReason ?? null,
          syncState: "synced",
        },
      });
    boostersSynced++;
  }

  // Mark tournament complete and stamp the token as used — prevents replay sync
  await db.update(tournamentsTable).set({
    status: "completed",
    exportTokenSyncedAt: new Date(),
  }).where(eq(tournamentsTable.id, id));

  res.json({ ok: true, playersUpdated, teamsUpdated, bidsInserted, boostersSynced });
});

// ─── Share viewer link — fire DLT SMS to organizer ───────────────────────────

router.post("/tournaments/:id/share-viewer-link", async (req, res) => {
  const tid = Number(req.params.id);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid tournament id" }); return; }

  const tidStr = String(tid);
  // Auth: admin OR organizer with explicit access to this specific tournament.
  // Broad organizerAccountId is intentionally excluded — it would allow any org-account
  // holder to trigger SMS sends (including viewer URLs) for tournaments they don't own.
  const isAdmin = !!req.jwtUser?.isAdmin;
  const isOrgForTournament = !!(req.jwtUser?.organizer as Record<string, boolean> | undefined)?.[tidStr];
  if (!isAdmin && !isOrgForTournament) { res.status(401).json({ error: "Not authorised" }); return; }

  const [tournament] = await db.select().from(tournamentsTable).where(eq(tournamentsTable.id, tid));
  if (!tournament) { res.status(404).json({ error: "Tournament not found" }); return; }

  const viewerUrl = buildPublicUrl(`/tournament/${tid}/display`);

  const orgId = tournament.organizerId;
  if (tournament.licenseStatus === "active" && orgId != null) {
    void (async () => {
      try {
        const { smsNotificationSettingsTable, organizersTable: orgsTable } = await import("@workspace/db");
        const { sendDltSms, viewerLinkTemplateId } = await import("../lib/fast2sms");
        const [settings] = await db.select().from(smsNotificationSettingsTable).limit(1);
        const templateId = viewerLinkTemplateId() || settings?.viewerLinkTemplateId;
        if (settings?.dltEnabled && settings.viewerLinkEnabled && templateId) {
          const [organizer] = await db.select({ mobile: orgsTable.mobile }).from(orgsTable).where(eq(orgsTable.id, orgId));
          const mobile = organizer?.mobile;
          if (mobile && !mobile.startsWith("gid_")) {
            await sendDltSms([mobile], templateId, [tournament.name, viewerUrl]);
          }
        }
      } catch (err) {
        const { logger } = await import("../lib/logger");
        logger.error({ err, tournamentId: tid }, "DLT viewer-link SMS failed");
      }
    })();
  }

  res.json({ success: true, viewerUrl });
});

export default router;
