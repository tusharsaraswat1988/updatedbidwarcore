import { Router } from "express";
import { canAccessPrivateTournamentData, requireTournamentOrganizer } from "../middleware/require-organizer";
import { publicPlayerSerializer, privatePlayerSerializer } from "../lib/serializers/player";
import { validateTeamBelongsToTournament } from "../lib/team-tournament-guard";
import { db } from "@workspace/db";
import { playersTable, teamsTable, tournamentsTable, playerImportLogsTable, waConsentEventsTable, organizersTable } from "@workspace/db";
import { eq, and, or, ne, inArray, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { parseIndianMobile, mobilesMatch } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { JERSEY_SIZE_VALUES } from "@workspace/api-base/jersey-size";
import { parseRegistrationDeclarationPoints } from "@workspace/api-base/registration-declaration";
import { playerGenderSchema } from "../lib/player-gender-schema";
import { auditLog } from "../lib/audit-service";
import { isCriticalPlayerPatch, defaultPlayerPatchReason, resolveAuditReasonWithDefault } from "../lib/audit-reason";
import { snapshotPlayer } from "../lib/audit-snapshots";
import { syncAuctionPlayerToMasterAsync } from "../lib/master-sports/sync";
import { onAuctionPlayerRosterChangedAsync } from "../lib/master-sports/cricket-roster";
import {
  PAYMENT_COLLECTION_MODES,
  PAYMENT_VERIFICATION_METHODS,
  REGISTRATION_PAYMENT_STATUSES,
} from "@workspace/api-base/registration-payment";
import {
  resolveOrganizerPaymentStatus,
  resolvePublicPaymentStatus,
  tournamentPaymentSettingsFromRow,
  validatePlayerPaymentProof,
} from "../lib/registration-payment";
import { notifyAsync } from "../lib/notifications";
import {
  canEditPlayerBidValue,
  parseBidValueOptions,
  resolvePlayerBidFields,
  serializeBidValueOptions,
} from "@workspace/api-base/bid-value";

async function fetchTournamentBidConfig(tid: number) {
  const [tournament] = await db
    .select({
      bidValueMode: tournamentsTable.bidValueMode,
      minBid: tournamentsTable.minBid,
      bidValueOptions: tournamentsTable.bidValueOptions,
      status: tournamentsTable.status,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tid));
  return tournament ?? null;
}

async function computeRegistrationStatus(tid: number) {
  const [tournament] = await db
    .select({
      deadline: tournamentsTable.registrationDeadline,
      limit: tournamentsTable.registrationLimit,
      enableRegistrationPayment: tournamentsTable.enableRegistrationPayment,
      registrationFee: tournamentsTable.registrationFee,
      upiId: tournamentsTable.upiId,
      paymentVerificationMethod: tournamentsTable.paymentVerificationMethod,
      enableRegistrationDeclaration: tournamentsTable.enableRegistrationDeclaration,
      registrationDeclarationText: tournamentsTable.registrationDeclarationText,
      bidValueMode: tournamentsTable.bidValueMode,
      bidValueOptions: tournamentsTable.bidValueOptions,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tid));
  if (!tournament) return null;
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));
  const deadline = tournament.deadline ?? null;
  const limit = tournament.limit ?? null;
  let reason: string | null = null;
  let open = true;
  if (deadline) {
    const today = new Date().toISOString().slice(0, 10);
    if (today > deadline) {
      open = false;
      reason = "deadline_passed";
    }
  }
  if (open && limit !== null && count >= limit) {
    open = false;
    reason = "limit_reached";
  }
  return {
    open,
    reason,
    currentCount: count,
    limit,
    deadline,
    enableRegistrationPayment: tournament.enableRegistrationPayment ?? false,
    registrationFee: tournament.registrationFee ?? null,
    upiId: tournament.upiId ?? null,
    paymentVerificationMethod: tournament.paymentVerificationMethod ?? null,
    enableRegistrationDeclaration: tournament.enableRegistrationDeclaration ?? false,
    registrationDeclarationText: tournament.registrationDeclarationText ?? null,
    registrationDeclarationPoints:
      tournament.enableRegistrationDeclaration && tournament.registrationDeclarationText
        ? parseRegistrationDeclarationPoints(tournament.registrationDeclarationText)
        : [],
    bidValueMode: tournament.bidValueMode ?? "system",
    bidValueOptions: parseBidValueOptions(tournament.bidValueOptions),
  };
}

const router = Router();

async function findDuplicatePlayerMobile(
  tournamentId: number,
  normalizedMobile: string,
  excludePlayerId?: number,
) {
  const players = await db
    .select({ id: playersTable.id, name: playersTable.name, mobileNumber: playersTable.mobileNumber })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));

  for (const player of players) {
    if (!player.mobileNumber) continue;
    if (excludePlayerId !== undefined && player.id === excludePlayerId) continue;
    const other = parseIndianMobile(player.mobileNumber);
    if (other.ok && other.normalized === normalizedMobile) return player;
  }
  return null;
}

/** Profile-only fields players may update via public self-registration when mobile already exists. */
function buildPublicRegistrationProfileUpdates(
  d: z.infer<typeof playerInputSchema>,
  email: string | null,
  paymentConfig: ReturnType<typeof tournamentPaymentSettingsFromRow> | null,
  paymentFields: ReturnType<typeof buildPaymentInsertFields>,
  existing: typeof playersTable.$inferSelect,
) {
  const updates: Record<string, unknown> = {
    name: d.name,
    city: d.city ?? null,
    role: d.role ?? null,
    battingStyle: d.battingStyle ?? null,
    bowlingStyle: d.bowlingStyle ?? null,
    specialization: d.specialization ?? null,
    age: d.age ?? null,
    gender: d.gender ?? null,
    photoUrl: d.photoUrl ?? null,
    jerseyNumber: d.jerseyNumber ?? null,
    jerseySize: d.jerseySize ?? null,
    achievements: d.achievements ?? null,
    email,
    cricheroUrl: d.cricheroUrl ?? null,
    availabilityDates: d.availabilityDates ?? null,
  };

  if (d.whatsappConsent && !existing.whatsappConsent) {
    updates.whatsappConsent = true;
    updates.whatsappConsentAt = new Date();
    updates.whatsappConsentMethod = "web_checkbox";
  }

  if (
    paymentConfig?.enableRegistrationPayment &&
    existing.registrationPaymentStatus !== "approved"
  ) {
    Object.assign(updates, paymentFields);
  }

  return updates;
}

/**
 * Recalculate and persist team.purseUsed from the current player records.
 * Called whenever a player's retained status or teamId changes so that the
 * purse figures are always consistent without requiring a manual reset.
 */
async function recalcTeamPurseUsed(tournamentId: number, teamId: number): Promise<void> {
  const players = await db
    .select({ status: playersTable.status, soldPrice: playersTable.soldPrice, retainedPrice: playersTable.retainedPrice })
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tournamentId), eq(playersTable.teamId, teamId)));

  const purseUsed = players.reduce((sum, p) => {
    if (p.status === "sold") return sum + (p.soldPrice ?? 0);
    if (p.status === "retained") return sum + (p.retainedPrice ?? 0);
    return sum;
  }, 0);

  await db.update(teamsTable).set({ purseUsed }).where(eq(teamsTable.id, teamId));
}

async function fetchTournamentPaymentConfig(tid: number) {
  const [row] = await db
    .select({
      enableRegistrationPayment: tournamentsTable.enableRegistrationPayment,
      registrationFee: tournamentsTable.registrationFee,
      upiId: tournamentsTable.upiId,
      paymentVerificationMethod: tournamentsTable.paymentVerificationMethod,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tid));
  return row ? tournamentPaymentSettingsFromRow(row) : null;
}

function buildPaymentInsertFields(
  paymentConfig: ReturnType<typeof tournamentPaymentSettingsFromRow> | null,
  input: { utrNumber?: string; paymentScreenshotUrl?: string; markPaymentCompleted?: boolean },
  mode: "organizer" | "public",
) {
  const enabled = paymentConfig?.enableRegistrationPayment ?? false;
  if (!enabled) {
    return {
      registrationPaymentStatus: null as string | null,
      utrNumber: null as string | null,
      paymentScreenshotUrl: null as string | null,
      paymentSubmittedAt: null as Date | null,
    };
  }

  const status =
    mode === "organizer"
      ? resolveOrganizerPaymentStatus(true, input.markPaymentCompleted)
      : resolvePublicPaymentStatus(true);

  return {
    registrationPaymentStatus: status,
    utrNumber: input.utrNumber?.trim() || null,
    paymentScreenshotUrl: input.paymentScreenshotUrl?.trim() || null,
    paymentSubmittedAt: new Date(),
  };
}

const playerToJson = privatePlayerSerializer;
const playerToPublicJson = publicPlayerSerializer;

const cloudinaryImageUrl = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.startsWith("https://"),
    "Image URL must be a valid HTTPS URL",
  );

const PLAYER_TAG_VALUES = ["captain", "vice_captain", "owner", "co_owner", "booster", "icon", "star_player"] as const;
const jerseySizeSchema = z.enum(JERSEY_SIZE_VALUES);

const playerInputSchema = z.object({
  categoryId: z.number().int().optional(),
  teamId: z.number().int().nullable().optional(),
  name: z.string().min(1),
  city: z.string().optional(),
  role: z.string().optional(),
  battingStyle: z.string().optional(),
  bowlingStyle: z.string().optional(),
  specialization: z.string().optional(),
  age: z.number().int().optional(),
  gender: playerGenderSchema.nullable().optional(),
  photoUrl: cloudinaryImageUrl,
  basePrice: z.number().int().optional(),
  selectedBidValue: z.number().int().optional(),
  jerseyNumber: z.string().optional(),
  jerseySize: jerseySizeSchema.optional(),
  achievements: z.string().optional(),
  mobileNumber: z.string().min(1, "Mobile number is required for communication features"),
  email: z.string().optional(),
  cricheroUrl: z.string().optional(),
  availabilityDates: z.string().optional(),
  retainedPrice: z.number().int().optional(),
  status: z.string().optional(),
  whatsappConsent: z.boolean().optional(),
  playerTag: z.enum(PLAYER_TAG_VALUES).nullable().optional(),
  playerTagTeamId: z.number().int().nullable().optional(),
  isNonPlayingMember: z.boolean().optional(),
  utrNumber: z.string().optional(),
  paymentScreenshotUrl: cloudinaryImageUrl,
  markPaymentCompleted: z.boolean().optional(),
  registrationDeclarationAccepted: z.boolean().optional(),
});

router.get("/tournaments/:tournamentId/players", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const isOrganizer = await canAccessPrivateTournamentData(req, tid);
  const serializer = isOrganizer ? playerToJson : playerToPublicJson;
  const players = await db
    .select()
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid))
    .orderBy(playersTable.createdAt);
  res.json(players.map(serializer));
});

router.post("/tournaments/:tournamentId/players", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const parsed = playerInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const d = parsed.data;

  const mobileParsed = parseIndianMobile(d.mobileNumber);
  if (!mobileParsed.ok) {
    res.status(400).json({ error: mobileParsed.error, field: "mobileNumber" });
    return;
  }
  const mobileNumber = mobileParsed.normalized;

  const emailParsed = parseOptionalEmail(d.email);
  if (!emailParsed.ok) {
    res.status(400).json({ error: emailParsed.error, field: "email" });
    return;
  }

  // Duplicate name check (case-insensitive) within the same tournament
  const [dupName] = await db
    .select({ id: playersTable.id })
    .from(playersTable)
    .where(and(eq(playersTable.tournamentId, tid), sql`lower(${playersTable.name}) = lower(${d.name})`));
  if (dupName) { res.status(400).json({ error: `A player named "${d.name}" is already registered in this tournament.` }); return; }

  const dupMobile = await findDuplicatePlayerMobile(tid, mobileNumber);
  if (dupMobile) {
    res.status(400).json({
      error: `Mobile number ${mobileNumber} is already registered for player "${dupMobile.name}" in this tournament.`,
      field: "mobileNumber",
    });
    return;
  }

  // Block organizer from registering their own mobile as a player
  const orgAccountId = req.jwtUser?.organizerAccountId;
  if (orgAccountId) {
    const [org] = await db.select({ mobile: organizersTable.mobile }).from(organizersTable).where(eq(organizersTable.id, orgAccountId));
    if (org?.mobile && mobilesMatch(org.mobile, mobileNumber)) {
      res.status(400).json({ error: "You cannot register the organizer's own mobile number as a player.", field: "mobileNumber" }); return;
    }
  }

  if (d.teamId != null) {
    const teamCheck = await validateTeamBelongsToTournament(tid, d.teamId);
    if (!teamCheck.ok) {
      res.status(teamCheck.status).json({ error: teamCheck.error });
      return;
    }
  }

  const paymentConfig = await fetchTournamentPaymentConfig(tid);
  const paymentFields = buildPaymentInsertFields(paymentConfig, d, "organizer");

  const bidConfig = await fetchTournamentBidConfig(tid);
  if (!bidConfig) { res.status(404).json({ error: "Not found" }); return; }
  const bidResolved = resolvePlayerBidFields(bidConfig, d);
  if (!bidResolved.ok) {
    res.status(400).json({ error: bidResolved.error, field: bidResolved.field });
    return;
  }

  const [player] = await db
    .insert(playersTable)
    .values({
      tournamentId: tid,
      categoryId: d.categoryId ?? null,
      name: d.name,
      city: d.city ?? null,
      role: d.role ?? null,
      battingStyle: d.battingStyle ?? null,
      bowlingStyle: d.bowlingStyle ?? null,
      specialization: d.specialization ?? null,
      age: d.age ?? null,
      gender: d.gender ?? null,
      photoUrl: d.photoUrl ?? null,
      basePrice: bidResolved.fields.basePrice,
      selectedBidValue: bidResolved.fields.selectedBidValue,
      bidValueSource: bidResolved.fields.bidValueSource,
      jerseyNumber: d.jerseyNumber ?? null,
      jerseySize: d.jerseySize ?? null,
      achievements: d.achievements ?? null,
      mobileNumber,
      email: emailParsed.email,
      cricheroUrl: d.cricheroUrl ?? null,
      availabilityDates: d.availabilityDates ?? null,
      retainedPrice: d.retainedPrice ?? null,
      teamId: d.teamId ?? null,
      status: (d.status ?? "available") as "available" | "sold" | "unsold" | "retained",
      playerTag: (d.playerTag ?? null) as string | null,
      playerTagTeamId: d.playerTagTeamId ?? null,
      isNonPlayingMember: d.isNonPlayingMember ?? false,
      ...paymentFields,
    })
    .returning();

  // If newly retained, sync team.purseUsed
  if (player.status === "retained" && player.teamId) {
    await recalcTeamPurseUsed(tid, player.teamId);
  }

  auditLog(req, {
    category: "player",
    action: "player.created",
    summary: `Player "${player.name}" added`,
    tournamentId: tid,
    playerId: player.id,
    resource: { type: "player", id: player.id },
    after: snapshotPlayer(player),
  });

  syncAuctionPlayerToMasterAsync(player.id, tid);

  res.status(201).json(playerToJson(player));
});

router.get("/tournaments/:tournamentId/registration-status", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const status = await computeRegistrationStatus(tid);
  if (!status) { res.status(404).json({ error: "Not found" }); return; }
  res.json(status);
});

router.get("/tournaments/:tournamentId/register/lookup", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const mobileRaw = String(req.query.mobile || "").trim();
  const mobileParsed = parseIndianMobile(mobileRaw);
  if (!mobileParsed.ok) {
    res.status(400).json({ error: mobileParsed.error, field: "mobileNumber" });
    return;
  }

  const dup = await findDuplicatePlayerMobile(tid, mobileParsed.normalized);
  if (!dup) {
    res.json({ registered: false });
    return;
  }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, dup.id), eq(playersTable.tournamentId, tid)));
  if (!player) {
    res.json({ registered: false });
    return;
  }

  res.json({ registered: true, player: playerToPublicJson(player) });
});

router.post("/tournaments/:tournamentId/register", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const status = await computeRegistrationStatus(tid);
  if (!status) { res.status(404).json({ error: "Not found" }); return; }

  const parsed = playerInputSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }
  const d = parsed.data;

  const mobileParsed = parseIndianMobile(d.mobileNumber);
  if (!mobileParsed.ok) {
    res.status(400).json({ error: mobileParsed.error, field: "mobileNumber" });
    return;
  }
  const mobileNumber = mobileParsed.normalized;

  const emailParsed = parseOptionalEmail(d.email);
  if (!emailParsed.ok) {
    res.status(400).json({ error: emailParsed.error, field: "email" });
    return;
  }

  const paymentConfig = await fetchTournamentPaymentConfig(tid);
  if (paymentConfig?.enableRegistrationPayment) {
    const method = paymentConfig.paymentVerificationMethod;
    if (!method) {
      res.status(400).json({ error: "Tournament payment settings are incomplete. Contact the organizer." });
      return;
    }
    const proofResult = validatePlayerPaymentProof(method as typeof PAYMENT_VERIFICATION_METHODS[number], {
      utrNumber: d.utrNumber,
      paymentScreenshotUrl: d.paymentScreenshotUrl,
    });
    if (!proofResult.ok) {
      res.status(400).json({ error: proofResult.error, field: proofResult.field });
      return;
    }
  }

  const paymentFields = buildPaymentInsertFields(paymentConfig, d, "public");

  const declarationRequired =
    status.enableRegistrationDeclaration === true
    && parseRegistrationDeclarationPoints(status.registrationDeclarationText).length > 0;
  if (declarationRequired && d.registrationDeclarationAccepted !== true) {
    res.status(400).json({
      error: "You must accept the registration declaration to continue.",
      field: "registrationDeclarationAccepted",
    });
    return;
  }

  const existingDup = await findDuplicatePlayerMobile(tid, mobileNumber);
  if (existingDup) {
    const [existing] = await db
      .select()
      .from(playersTable)
      .where(and(eq(playersTable.id, existingDup.id), eq(playersTable.tournamentId, tid)));
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const updates = buildPublicRegistrationProfileUpdates(
      d,
      emailParsed.email,
      paymentConfig,
      paymentFields,
      existing,
    );

    const [player] = await db
      .update(playersTable)
      .set(updates)
      .where(and(eq(playersTable.id, existing.id), eq(playersTable.tournamentId, tid)))
      .returning();

    if (d.whatsappConsent && mobileNumber && !existing.whatsappConsent) {
      await db.insert(waConsentEventsTable).values({
        mobile: mobileNumber,
        recipientType: "player",
        recipientId: player.id,
        tournamentId: tid,
        eventType: "web_checkbox",
      });
    }

    syncAuctionPlayerToMasterAsync(player.id, tid);

    res.status(200).json({ ...playerToPublicJson(player), updated: true });
    return;
  }

  if (!status.open) { res.status(403).json(status); return; }

  const bidConfig = await fetchTournamentBidConfig(tid);
  if (!bidConfig) { res.status(404).json({ error: "Not found" }); return; }
  const bidResolved = resolvePlayerBidFields(bidConfig, d);
  if (!bidResolved.ok) {
    res.status(400).json({ error: bidResolved.error, field: bidResolved.field });
    return;
  }

  const [player] = await db
    .insert(playersTable)
    .values({
      tournamentId: tid,
      categoryId: d.categoryId ?? null,
      name: d.name,
      city: d.city ?? null,
      role: d.role ?? null,
      battingStyle: d.battingStyle ?? null,
      bowlingStyle: d.bowlingStyle ?? null,
      specialization: d.specialization ?? null,
      age: d.age ?? null,
      gender: d.gender ?? null,
      photoUrl: d.photoUrl ?? null,
      basePrice: bidResolved.fields.basePrice,
      selectedBidValue: bidResolved.fields.selectedBidValue,
      bidValueSource: bidResolved.fields.bidValueSource,
      jerseyNumber: d.jerseyNumber ?? null,
      jerseySize: d.jerseySize ?? null,
      achievements: d.achievements ?? null,
      mobileNumber,
      email: emailParsed.email,
      cricheroUrl: d.cricheroUrl ?? null,
      availabilityDates: d.availabilityDates ?? null,
      retainedPrice: d.retainedPrice ?? null,
      status: "available" as const,
      whatsappConsent: d.whatsappConsent ?? false,
      whatsappConsentAt: d.whatsappConsent ? new Date() : null,
      whatsappConsentMethod: d.whatsappConsent ? "web_checkbox" : null,
      ...paymentFields,
    })
    .returning();

  if (d.whatsappConsent && mobileNumber) {
    await db.insert(waConsentEventsTable).values({
      mobile: mobileNumber,
      recipientType: "player",
      recipientId: player.id,
      tournamentId: tid,
      eventType: "web_checkbox",
    });
  }

  syncAuctionPlayerToMasterAsync(player.id, tid);

  if (emailParsed.email) {
    const [tournamentInfo] = await db
      .select({
        name: tournamentsTable.name,
        logoUrl: tournamentsTable.logoUrl,
      })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tid))
      .limit(1);

    notifyAsync("PLAYER_REGISTERED", {
      playerId: player.id,
      playerName: player.name,
      email: emailParsed.email,
      photoUrl: player.photoUrl,
      tournamentId: tid,
      tournamentName: tournamentInfo?.name ?? "Tournament",
      tournamentLogoUrl: tournamentInfo?.logoUrl ?? null,
      paymentPending: paymentConfig?.enableRegistrationPayment === true,
    });
  }

  res.status(201).json({ ...playerToPublicJson(player), updated: false });
});

router.post("/tournaments/:tournamentId/players/bulk", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const schema = z.object({
    players: z.array(playerInputSchema).min(1).max(500),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input" }); return; }

  const bidConfig = await fetchTournamentBidConfig(tid);
  if (!bidConfig) { res.status(404).json({ error: "Not found" }); return; }

  let created = 0;
  let failed = 0;
  const errors: string[] = [];
  const batchMobiles = new Set<string>();

  for (const pd of parsed.data.players) {
    try {
      const bulkMobileParsed = parseIndianMobile(pd.mobileNumber);
      if (!bulkMobileParsed.ok) {
        failed++;
        errors.push(`${pd.name}: ${bulkMobileParsed.error}`);
        continue;
      }
      const bulkMobile = bulkMobileParsed.normalized;
      if (batchMobiles.has(bulkMobile)) {
        failed++;
        errors.push(`${pd.name}: Duplicate mobile number ${bulkMobile} in upload file.`);
        continue;
      }
      const bulkEmailParsed = parseOptionalEmail(pd.email);
      if (!bulkEmailParsed.ok) {
        failed++;
        errors.push(`${pd.name}: ${bulkEmailParsed.error}`);
        continue;
      }
      const dupMobile = await findDuplicatePlayerMobile(tid, bulkMobile);
      if (dupMobile) {
        failed++;
        errors.push(`${pd.name}: Mobile number ${bulkMobile} is already registered for player "${dupMobile.name}".`);
        continue;
      }
      const bidResolved = resolvePlayerBidFields(bidConfig, pd);
      if (!bidResolved.ok) {
        failed++;
        errors.push(`${pd.name}: ${bidResolved.error}`);
        continue;
      }
      await db.insert(playersTable).values({
        tournamentId: tid,
        categoryId: pd.categoryId ?? null,
        name: pd.name,
        city: pd.city ?? null,
        role: pd.role ?? null,
        battingStyle: pd.battingStyle ?? null,
        bowlingStyle: pd.bowlingStyle ?? null,
        specialization: pd.specialization ?? null,
        age: pd.age ?? null,
        gender: pd.gender ?? null,
        photoUrl: pd.photoUrl ?? null,
        basePrice: bidResolved.fields.basePrice,
        selectedBidValue: bidResolved.fields.selectedBidValue,
        bidValueSource: bidResolved.fields.bidValueSource,
        jerseyNumber: pd.jerseyNumber ?? null,
        jerseySize: pd.jerseySize ?? null,
        achievements: pd.achievements ?? null,
        mobileNumber: bulkMobile,
        email: bulkEmailParsed.email,
        cricheroUrl: pd.cricheroUrl ?? null,
        availabilityDates: pd.availabilityDates ?? null,
        retainedPrice: pd.retainedPrice ?? null,
        status: (pd.status ?? "available") as "available" | "sold" | "unsold" | "retained",
      });
      batchMobiles.add(bulkMobile);
      created++;
    } catch (err) {
      failed++;
      errors.push(`${pd.name}: ${err instanceof Error ? err.message : "unknown error"}`);
    }
  }

  res.json({ created, failed, errors });
});

router.get("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  const isOrganizer = await canAccessPrivateTournamentData(req, tid);
  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
  if (!player) { res.status(404).json({ error: "Not found" }); return; }
  res.json(isOrganizer ? playerToJson(player) : playerToPublicJson(player));
});

router.patch("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const schema = z.object({
    categoryId: z.number().int().nullable().optional(),
    name: z.string().optional(),
    city: z.string().optional(),
    role: z.string().optional(),
    battingStyle: z.string().optional(),
    bowlingStyle: z.string().optional(),
    specialization: z.string().optional(),
    age: z.number().int().optional(),
    gender: playerGenderSchema.nullable().optional(),
    photoUrl: cloudinaryImageUrl,
    basePrice: z.number().int().optional(),
    selectedBidValue: z.number().int().nullable().optional(),
    jerseyNumber: z.string().optional(),
    jerseySize: jerseySizeSchema.nullable().optional(),
    achievements: z.string().optional(),
    mobileNumber: z.string().min(1).optional(),
    email: z.string().optional(),
    cricheroUrl: z.string().optional(),
    availabilityDates: z.string().optional(),
    retainedPrice: z.number().int().nullable().optional(),
    status: z.string().optional(),
    teamId: z.number().int().nullable().optional(),
    playerTag: z.enum(PLAYER_TAG_VALUES).nullable().optional(),
    playerTagTeamId: z.number().int().nullable().optional(),
    isNonPlayingMember: z.boolean().optional(),
    reason: z.string().optional(),
    registrationPaymentStatus: z.enum(REGISTRATION_PAYMENT_STATUSES).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", details: parsed.error.issues });
    return;
  }
  const d = parsed.data;

  const [existing] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
  if (!existing) { res.status(404).json({ error: "Not found" }); return; }

  const bidConfig = await fetchTournamentBidConfig(tid);
  if (!bidConfig) { res.status(404).json({ error: "Not found" }); return; }

  if (
    (d.basePrice !== undefined || d.selectedBidValue !== undefined)
    && !canEditPlayerBidValue(bidConfig.status)
  ) {
    res.status(409).json({ error: "Bid value cannot be changed after the auction has started." });
    return;
  }

  let normalizedMobile: string | undefined;
  if (d.mobileNumber !== undefined) {
    const mobileParsed = parseIndianMobile(d.mobileNumber);
    if (!mobileParsed.ok) {
      res.status(400).json({ error: mobileParsed.error, field: "mobileNumber" });
      return;
    }
    normalizedMobile = mobileParsed.normalized;
    const dupMobile = await findDuplicatePlayerMobile(tid, normalizedMobile, playerId);
    if (dupMobile) {
      res.status(400).json({
        error: `Mobile number ${normalizedMobile} is already registered for player "${dupMobile.name}" in this tournament.`,
        field: "mobileNumber",
      });
      return;
    }
  }

  let normalizedEmail: string | null | undefined;
  if (d.email !== undefined) {
    const emailParsed = parseOptionalEmail(d.email);
    if (!emailParsed.ok) {
      res.status(400).json({ error: emailParsed.error, field: "email" });
      return;
    }
    normalizedEmail = emailParsed.email;
  }

  // Validate: retained status requires a team + price
  const newStatus = d.status ?? existing.status;
  const newTeamId = d.teamId !== undefined ? d.teamId : existing.teamId;
  if (newStatus === "retained") {
    if (!newTeamId) { res.status(400).json({ error: "A retained player must be assigned to a team" }); return; }
  }
  if (newTeamId != null) {
    const teamCheck = await validateTeamBelongsToTournament(tid, newTeamId);
    if (!teamCheck.ok) {
      res.status(teamCheck.status).json({ error: teamCheck.error });
      return;
    }
  }

  const updates: Record<string, unknown> = {};
  if (d.categoryId !== undefined) updates.categoryId = d.categoryId;
  if (d.name !== undefined) updates.name = d.name;
  if (d.city !== undefined) updates.city = d.city;
  if (d.role !== undefined) updates.role = d.role;
  if (d.battingStyle !== undefined) updates.battingStyle = d.battingStyle;
  if (d.bowlingStyle !== undefined) updates.bowlingStyle = d.bowlingStyle;
  if (d.specialization !== undefined) updates.specialization = d.specialization;
  if (d.age !== undefined) updates.age = d.age;
  if (d.gender !== undefined) updates.gender = d.gender;
  if (d.photoUrl !== undefined) updates.photoUrl = d.photoUrl;

  if (d.selectedBidValue !== undefined || d.basePrice !== undefined) {
    const bidResolved = resolvePlayerBidFields(bidConfig, {
      basePrice: d.basePrice ?? existing.basePrice,
      selectedBidValue: d.selectedBidValue ?? undefined,
    });
    if (!bidResolved.ok) {
      res.status(400).json({ error: bidResolved.error, field: bidResolved.field });
      return;
    }
    updates.basePrice = bidResolved.fields.basePrice;
    updates.selectedBidValue = bidResolved.fields.selectedBidValue;
    updates.bidValueSource = bidResolved.fields.bidValueSource;
  }

  if (d.jerseyNumber !== undefined) updates.jerseyNumber = d.jerseyNumber;
  if (d.jerseySize !== undefined) updates.jerseySize = d.jerseySize;
  if (d.achievements !== undefined) updates.achievements = d.achievements;
  if (normalizedMobile !== undefined) updates.mobileNumber = normalizedMobile;
  if (normalizedEmail !== undefined) updates.email = normalizedEmail;
  if (d.cricheroUrl !== undefined) updates.cricheroUrl = d.cricheroUrl;
  if (d.availabilityDates !== undefined) updates.availabilityDates = d.availabilityDates;
  if (d.retainedPrice !== undefined) updates.retainedPrice = d.retainedPrice;
  if (d.status !== undefined) updates.status = d.status;
  if (d.teamId !== undefined) updates.teamId = d.teamId;
  if (d.playerTag !== undefined) updates.playerTag = d.playerTag;
  if (d.playerTagTeamId !== undefined) updates.playerTagTeamId = d.playerTagTeamId;
  if (d.isNonPlayingMember !== undefined) updates.isNonPlayingMember = d.isNonPlayingMember;

  if (d.registrationPaymentStatus !== undefined) {
    const paymentConfig = await fetchTournamentPaymentConfig(tid);
    if (!paymentConfig?.enableRegistrationPayment) {
      res.status(400).json({ error: "Registration payment is not enabled for this tournament." });
      return;
    }
    updates.registrationPaymentStatus = d.registrationPaymentStatus;
  }

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "No valid fields to update" });
    return;
  }

  const [player] = await db
    .update(playersTable)
    .set(updates)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)))
    .returning();
  if (!player) { res.status(404).json({ error: "Not found" }); return; }

  // Recalc purseUsed for any team affected by a retention change
  const teamsToRecalc = new Set<number>();
  if (player.status === "retained" && player.teamId) teamsToRecalc.add(player.teamId);
  // If player was previously retained on a different team, recalc that team too
  if (existing.status === "retained" && existing.teamId && existing.teamId !== player.teamId) {
    teamsToRecalc.add(existing.teamId);
  }
  for (const tid2 of teamsToRecalc) {
    await recalcTeamPurseUsed(tid, tid2);
  }

  const reasonResult = resolveAuditReasonWithDefault(
    req.body,
    defaultPlayerPatchReason(d, existing),
  );
  if (!reasonResult.ok) {
    res.status(400).json({ error: reasonResult.error });
    return;
  }
  let action = "player.updated";
  if (d.status === "retained" || (d.teamId !== undefined && d.retainedPrice !== undefined)) {
    action = "player.retained_set";
  }
  auditLog(req, {
    category: "player",
    action,
    summary: `Player "${player.name}" updated`,
    severity: isCriticalPlayerPatch(d) ? "critical" : "info",
    reason: reasonResult.reason,
    tournamentId: tid,
    playerId: player.id,
    teamId: player.teamId ?? undefined,
    resource: { type: "player", id: player.id },
    before: snapshotPlayer(existing),
    after: snapshotPlayer(player),
    alertKey: isCriticalPlayerPatch(d) ? "player_critical_edit" : null,
  });

  syncAuctionPlayerToMasterAsync(player.id, tid);

  if (d.teamId !== undefined || d.status !== undefined) {
    const assignmentType =
      d.status === "sold" && existing.status !== "sold"
        ? "unsold_replacement"
        : d.teamId !== undefined && existing.teamId !== d.teamId
          ? "transfer"
          : undefined;
    onAuctionPlayerRosterChangedAsync(
      player,
      existing.teamId,
      tid,
      assignmentType,
    );
  }

  res.json(playerToJson(player));
});

router.delete("/tournaments/:tournamentId/players/:playerId", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;
  const [before] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
  await db.delete(playersTable).where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));
  if (before) {
    auditLog(req, {
      category: "player",
      action: "player.deleted",
      summary: `Player "${before.name}" deleted`,
      severity: "warning",
      tournamentId: tid,
      playerId,
      resource: { type: "player", id: playerId },
      before: snapshotPlayer(before),
    });
  }
  res.status(204).send();
});

router.get("/tournaments/:tournamentId/import-sources", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }

  const organizerAccountId = req.jwtUser?.organizerAccountId;

  const baseQuery = db
    .select({
      id: tournamentsTable.id,
      name: tournamentsTable.name,
      sport: tournamentsTable.sport,
      auctionDate: tournamentsTable.auctionDate,
    })
    .from(tournamentsTable)
    .$dynamic();

  const sources = await (organizerAccountId
    ? baseQuery.where(and(ne(tournamentsTable.id, tid), eq(tournamentsTable.organizerId, organizerAccountId)))
    : baseQuery.where(ne(tournamentsTable.id, tid))
  ).orderBy(desc(tournamentsTable.createdAt));

  const result = await Promise.all(
    sources.map(async (s) => {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(playersTable)
        .where(eq(playersTable.tournamentId, s.id));
      return { ...s, playerCount: Number(count) };
    }),
  );

  res.json(result.filter((s) => s.playerCount > 0));
});

router.get("/tournaments/:tournamentId/import-candidates", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const sourceTid = parseInt(String(req.query.sourceTournamentId || "0"));
  if (isNaN(tid) || isNaN(sourceTid) || sourceTid === 0) {
    res.status(400).json({ error: "sourceTournamentId is required" });
    return;
  }

  const q = String(req.query.q || "").trim();

  const existingInTarget = await db
    .select({ mobile: playersTable.mobileNumber, name: playersTable.name })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tid));

  const mobileSet = new Set<string>();
  for (const p of existingInTarget) {
    if (!p.mobile) continue;
    const parsed = parseIndianMobile(p.mobile);
    if (parsed.ok) mobileSet.add(parsed.normalized);
  }
  const nameSet = new Set(
    existingInTarget.map((p) => p.name.toLowerCase().trim()),
  );

  const conditions = [eq(playersTable.tournamentId, sourceTid)];
  if (q.length >= 2) {
    conditions.push(
      or(
        sql`${playersTable.name} ILIKE ${"%" + q + "%"}`,
        sql`${playersTable.mobileNumber} LIKE ${q + "%"}`,
      ) as ReturnType<typeof eq>,
    );
  }

  const sourcePlayers = await db
    .select()
    .from(playersTable)
    .where(and(...conditions))
    .orderBy(playersTable.name);

  const isOrganizer = await canAccessPrivateTournamentData(req, tid);
  const serializer = isOrganizer ? playerToJson : playerToPublicJson;

  const result = sourcePlayers.map((p) => {
    let mobileDuplicate = false;
    if (p.mobileNumber) {
      const parsed = parseIndianMobile(p.mobileNumber);
      mobileDuplicate = parsed.ok && mobileSet.has(parsed.normalized);
    }
    return {
      ...serializer(p),
      isDuplicate:
        mobileDuplicate ||
        nameSet.has(p.name.toLowerCase().trim()),
    };
  });

  res.json(result);
});

router.post("/tournaments/:tournamentId/import-players", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  if (isNaN(tid)) { res.status(400).json({ error: "Invalid ID" }); return; }
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const schema = z.object({
    sourceTournamentId: z.number().int(),
    playerIds: z.array(z.number().int()).min(1).max(500),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", details: parsed.error.issues }); return; }

  const { sourceTournamentId, playerIds } = parsed.data;

  const [tournament] = await db
    .select({ minBid: tournamentsTable.minBid, bidValueMode: tournamentsTable.bidValueMode })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tid));
  const defaultBasePrice = tournament?.minBid ?? 100000;

  const sourcePlayers = await db
    .select()
    .from(playersTable)
    .where(
      and(
        eq(playersTable.tournamentId, sourceTournamentId),
        inArray(playersTable.id, playerIds),
      ),
    );

  let imported = 0;
  let skipped = 0;

  for (const p of sourcePlayers) {
    let normalizedMobile: string | null = p.mobileNumber;
    if (p.mobileNumber) {
      const parsed = parseIndianMobile(p.mobileNumber);
      if (parsed.ok) {
        const dup = await findDuplicatePlayerMobile(tid, parsed.normalized);
        if (dup) {
          skipped++;
          continue;
        }
        normalizedMobile = parsed.normalized;
      }
    }

    await db.insert(playersTable).values({
      tournamentId: tid,
      categoryId: null,
      name: p.name,
      city: p.city,
      role: p.role,
      battingStyle: p.battingStyle,
      bowlingStyle: p.bowlingStyle,
      specialization: p.specialization,
      age: p.age,
      gender: p.gender,
      photoUrl: p.photoUrl,
      basePrice: defaultBasePrice,
      selectedBidValue: null,
      bidValueSource: "system",
      jerseyNumber: p.jerseyNumber,
      jerseySize: p.jerseySize,
      achievements: p.achievements,
      mobileNumber: normalizedMobile,
      cricheroUrl: p.cricheroUrl,
      availabilityDates: p.availabilityDates,
      globalPlayerId: p.globalPlayerId,
      status: "available" as const,
      teamId: null,
    });

    imported++;
  }

  let importLogId: number | null = null;
  if (imported > 0) {
    const [logRow] = await db.insert(playerImportLogsTable).values({
      sourceTournamentId,
      targetTournamentId: tid,
      organizerAccountId: req.jwtUser?.organizerAccountId ?? null,
      playerCount: imported,
    }).returning({ id: playerImportLogsTable.id });
    importLogId = logRow?.id ?? null;
  }

  auditLog(req, {
    category: "player",
    action: "player.imported",
    summary: `Imported ${imported} players from tournament #${sourceTournamentId}`,
    tournamentId: tid,
    resource: { type: "tournament", id: tid },
    metadata: { sourceTournamentId, playerIds, imported, skipped, total: sourcePlayers.length },
    related: importLogId ? { table: "player_import_logs", id: importLogId } : null,
  });

  res.json({ imported, skipped, total: sourcePlayers.length });
});

async function updateRegistrationPaymentStatus(
  req: import("express").Request,
  res: import("express").Response,
  tid: number,
  playerId: number,
  status: (typeof REGISTRATION_PAYMENT_STATUSES)[number],
) {
  if (!(await requireTournamentOrganizer(req, res, tid))) return;

  const [player] = await db
    .select()
    .from(playersTable)
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)));

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const paymentConfig = await fetchTournamentPaymentConfig(tid);
  if (!paymentConfig?.enableRegistrationPayment) {
    res.status(400).json({ error: "Registration payment is not enabled for this tournament." });
    return;
  }

  const [updated] = await db
    .update(playersTable)
    .set({ registrationPaymentStatus: status })
    .where(and(eq(playersTable.id, playerId), eq(playersTable.tournamentId, tid)))
    .returning();

  auditLog(req, {
    category: "player",
    action:
      status === "approved"
        ? "registration_payment.approved"
        : status === "rejected"
          ? "registration_payment.rejected"
          : "registration_payment.pending",
    summary: `Registration payment ${status} for "${player.name}"`,
    tournamentId: tid,
    playerId,
    resource: { type: "player", id: playerId },
    metadata: { registrationPaymentStatus: status },
  });

  res.json(playerToJson(updated));
}

router.post("/tournaments/:tournamentId/players/:playerId/registration-payment/approve", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  await updateRegistrationPaymentStatus(req, res, tid, playerId, "approved");
});

router.post("/tournaments/:tournamentId/players/:playerId/registration-payment/reject", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  await updateRegistrationPaymentStatus(req, res, tid, playerId, "rejected");
});

router.post("/tournaments/:tournamentId/players/:playerId/registration-payment/pending", async (req, res) => {
  const tid = parseInt(req.params.tournamentId);
  const playerId = parseInt(req.params.playerId);
  if (isNaN(tid) || isNaN(playerId)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  await updateRegistrationPaymentStatus(req, res, tid, playerId, "pending");
});

export default router;
