import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db, cricketSponsorMediaSlotsTable, tournamentsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  SPONSOR_IMAGE_DURATION_DEFAULT_SEC,
  SPONSOR_MEDIA_SLOT_COUNT,
  SPONSOR_ORIGINAL_UPLOAD_MAX_BYTES,
  clampImageDurationSec,
  parseSponsorMediaCue,
} from "@workspace/scoring-core";
import { isTournamentOrganizer } from "../middleware/require-organizer";
import { assertScorerMayAccessTournament, requireScorerFromRequest, ScorerAuthError } from "../lib/scorer-auth";
import { createDiskMulter, removeUploadedFile } from "../lib/multer-disk-storage";
import { logger } from "../lib/logger";
import {
  beginSponsorMediaProcessing,
  deleteSponsorMediaAssets,
  getSponsorMediaSlot,
  listSponsorMediaSlots,
  toSponsorMediaView,
} from "../lib/sponsor-media-service";
import {
  authorizeReadinessReport,
  getSponsorMediaReadiness,
  recordSponsorMediaReadiness,
  scopeReadinessToCurrentVersions,
  type SponsorSurfacePlaybackReport,
  type SponsorSurfaceSlotReport,
} from "../lib/sponsor-media-readiness";
import { readBearerToken, signSponsorDisplaySession, verifySponsorDisplaySession } from "../lib/sponsor-display-session";

const router = Router();

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime"]);

const sponsorUpload = createDiskMulter({
  limits: { fileSize: SPONSOR_ORIGINAL_UPLOAD_MAX_BYTES },
  fileFilter(_req, file, cb) {
    const name = file.originalname.toLowerCase();
    const image = IMAGE_TYPES.has(file.mimetype) || /\.(png|jpe?g|webp)$/.test(name);
    const video = VIDEO_TYPES.has(file.mimetype) || name.endsWith(".mp4") || name.endsWith(".mov");
    if (!image && !video) {
      cb(new Error("Unsupported media. Upload a PNG, JPEG, WebP, or MP4."));
      return;
    }
    cb(null, true);
  },
});

function parseTournamentId(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseSlotNumber(value: string | string[] | undefined): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 1 || slot > SPONSOR_MEDIA_SLOT_COUNT) return null;
  return slot;
}

async function callerIsOperator(req: Request, res: Response, tournamentId: number): Promise<boolean> {
  const [tournament] = await db
    .select({ id: tournamentsTable.id, organizerId: tournamentsTable.organizerId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return false;
  }
  if (isTournamentOrganizer(req, tournamentId, tournament.organizerId)) return true;
  try {
    const scorerAuth = await requireScorerFromRequest(req);
    await assertScorerMayAccessTournament(scorerAuth.scorerId, tournamentId);
    return true;
  } catch (err) {
    if (err instanceof ScorerAuthError) {
      res.status(err.status).json({ error: err.message, code: err.code });
      return false;
    }
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return false;
  }
}

function assetTypeFor(file: Express.Multer.File): "image" | "video" {
  const name = file.originalname.toLowerCase();
  if (file.mimetype.startsWith("video/") || name.endsWith(".mp4") || name.endsWith(".mov")) return "video";
  return "image";
}

router.get("/tournaments/:tournamentId/scoring/sponsor-media", async (req, res) => {
  const tournamentId = parseTournamentId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  const [tournament] = await db
    .select({ id: tournamentsTable.id, organizerId: tournamentsTable.organizerId })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) {
    res.status(404).json({ error: "Tournament not found" });
    return;
  }
  const includeOriginal = isTournamentOrganizer(req, tournamentId, tournament.organizerId);
  try {
    const slots = await listSponsorMediaSlots(tournamentId, includeOriginal);
    res.json({ slots });
  } catch (err) {
    logger.error({ err, tournamentId }, "Failed to list sponsor media");
    res.status(500).json({ error: "Failed to list sponsor media" });
  }
});

router.get("/tournaments/:tournamentId/scoring/sponsor-media/readiness", async (req, res) => {
  const tournamentId = parseTournamentId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await callerIsOperator(req, res, tournamentId))) return;
  res.json(getSponsorMediaReadiness(tournamentId));
});

router.post("/tournaments/:tournamentId/scoring/sponsor-media/display-session", async (req, res) => {
  const tournamentId = parseTournamentId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  if (!(await callerIsOperator(req, res, tournamentId))) return;
  const surface = req.body?.surface;
  if (surface !== "obs" && surface !== "led") {
    res.status(400).json({ error: "Surface must be obs or led" });
    return;
  }
  const token = signSponsorDisplaySession({ tournamentId, surface });
  res.json({ token, surface, tournamentId });
});

router.post("/tournaments/:tournamentId/scoring/sponsor-media/readiness", async (req, res) => {
  const tournamentId = parseTournamentId(req.params.tournamentId);
  if (tournamentId === null) {
    res.status(400).json({ error: "Invalid tournament ID" });
    return;
  }
  const identity = (() => {
    const token = readBearerToken(req.get("authorization") ?? undefined);
    return token ? verifySponsorDisplaySession(token) : null;
  })();
  const decision = authorizeReadinessReport({
    identity,
    pathTournamentId: tournamentId,
    claimedSurface: req.body?.surface,
  });
  if (!decision.ok) {
    res.status(decision.status).json({ error: decision.error });
    return;
  }
  const surface = decision.surface;
  const slots = Array.isArray(req.body?.slots) ? req.body.slots.slice(0, SPONSOR_MEDIA_SLOT_COUNT) : [];
  const parsedSlots: SponsorSurfaceSlotReport[] = [];
  for (const slot of slots) {
    const slotNumber = Number(slot?.slotNumber);
    const version = Number(slot?.version);
    const status = slot?.status;
    if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > SPONSOR_MEDIA_SLOT_COUNT) continue;
    if (!Number.isInteger(version) || version < 0) continue;
    if (status !== "ready" && status !== "preparing" && status !== "missing" && status !== "failed") continue;
    parsedSlots.push({
      slotNumber,
      version,
      status,
      error: typeof slot?.error === "string" ? slot.error.slice(0, 160) : undefined,
    });
  }
  const playbackRaw = req.body?.playback ?? {};
  const playbackStatus = playbackRaw.status;
  const playback: SponsorSurfacePlaybackReport = {
    status: playbackStatus === "playing" || playbackStatus === "ended" || playbackStatus === "stopped" || playbackStatus === "error"
      ? playbackStatus
      : "idle",
    slotNumber: Number.isInteger(Number(playbackRaw.slotNumber)) ? Number(playbackRaw.slotNumber) : null,
    cueId: typeof playbackRaw.cueId === "string" ? playbackRaw.cueId.slice(0, 80) : null,
    error: typeof playbackRaw.error === "string" ? playbackRaw.error.slice(0, 160) : undefined,
  };
  let current: Array<{ slotNumber: number; version: number; broadcastReady: boolean }> = [];
  try {
    const listed = await listSponsorMediaSlots(tournamentId, false);
    current = listed.map((slot) => ({
      slotNumber: slot.slotNumber,
      version: slot.version,
      broadcastReady: slot.processingStatus === "ready" && slot.active && slot.version > 0,
    }));
  } catch (err) {
    logger.error({ err, tournamentId }, "Sponsor readiness could not be checked");
    res.status(503).json({ error: "Sponsor director unavailable" });
    return;
  }
  res.json(recordSponsorMediaReadiness(decision.tournamentId, {
    surface,
    slots: scopeReadinessToCurrentVersions(parsedSlots, current),
    playback,
  }));
});

router.post(
  "/tournaments/:tournamentId/scoring/sponsor-media/:slotNumber",
  sponsorUpload.single("file"),
  async (req, res) => {
    const tournamentId = parseTournamentId(req.params.tournamentId);
    const slotNumber = parseSlotNumber(req.params.slotNumber);
    if (tournamentId === null || slotNumber === null) {
      await removeUploadedFile(req.file);
      res.status(400).json({ error: "Invalid tournament or slot" });
      return;
    }
    if (!(await callerIsOperator(req, res, tournamentId))) {
      await removeUploadedFile(req.file);
      return;
    }
    if (!req.file) {
      res.status(400).json({ error: "No file provided." });
      return;
    }
    const assetType = assetTypeFor(req.file);
    const title = typeof req.body?.title === "string" && req.body.title.trim()
      ? req.body.title.trim().slice(0, 80)
      : req.file.originalname.replace(/\.[^.]+$/, "").slice(0, 80);
    const durationSec = assetType === "image"
      ? (clampImageDurationSec(req.body?.durationSec) ?? SPONSOR_IMAGE_DURATION_DEFAULT_SEC)
      : SPONSOR_IMAGE_DURATION_DEFAULT_SEC;
    try {
      const existing = await getSponsorMediaSlot(tournamentId, slotNumber);
      const version = (existing?.version ?? 0) + 1;
      const now = new Date();
      const values = {
        tournamentId,
        slotNumber,
        title,
        assetType,
        originalUrl: null,
        originalPublicId: existing?.originalPublicId ?? null,
        broadcastUrl: null,
        broadcastPublicId: existing?.broadcastPublicId ?? null,
        posterUrl: null,
        durationMs: durationSec * 1000,
        fileSizeBytes: null,
        originalFileSizeBytes: req.file.size,
        mimeType: req.file.mimetype,
        width: null,
        height: null,
        hasAudio: false,
        processingStatus: "uploading",
        active: true,
        version,
        checksum: null,
        errorMessage: null,
        updatedAt: now,
      };
      const [row] = existing
        ? await db.update(cricketSponsorMediaSlotsTable).set(values).where(eq(cricketSponsorMediaSlotsTable.id, existing.id)).returning()
        : await db.insert(cricketSponsorMediaSlotsTable).values(values).returning();
      if (!row || !req.file.path) {
        await removeUploadedFile(req.file);
        res.status(500).json({ error: "Failed to save sponsor media" });
        return;
      }
      beginSponsorMediaProcessing({
        tournamentId,
        slotId: row.id,
        version,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        assetType,
        title,
        durationMs: durationSec * 1000,
        originalBytes: req.file.size,
        previousPublicId: existing?.originalPublicId ?? null,
        previousAssetType: existing?.assetType ?? null,
      });
      res.status(202).json(toSponsorMediaView(tournamentId, slotNumber, row, true));
    } catch (err) {
      await removeUploadedFile(req.file);
      logger.error({ err, tournamentId, slotNumber }, "Failed to accept sponsor media");
      res.status(500).json({ error: "Failed to save sponsor media" });
    }
  },
);

router.patch("/tournaments/:tournamentId/scoring/sponsor-media/:slotNumber", async (req, res) => {
  const tournamentId = parseTournamentId(req.params.tournamentId);
  const slotNumber = parseSlotNumber(req.params.slotNumber);
  if (tournamentId === null || slotNumber === null) {
    res.status(400).json({ error: "Invalid tournament or slot" });
    return;
  }
  if (!(await callerIsOperator(req, res, tournamentId))) return;
  const existing = await getSponsorMediaSlot(tournamentId, slotNumber);
  if (!existing) {
    res.status(404).json({ error: "Slot is empty" });
    return;
  }
  const patch: Partial<typeof existing> = { updatedAt: new Date() };
  if (typeof req.body?.title === "string") {
    patch.title = req.body.title.trim().slice(0, 80);
  }
  if (req.body?.active !== undefined) {
    patch.active = Boolean(req.body.active);
    if (!patch.active) patch.processingStatus = existing.processingStatus === "ready" ? "disabled" : existing.processingStatus;
    if (patch.active && existing.processingStatus === "disabled") patch.processingStatus = "ready";
  }
  if (req.body?.durationSec !== undefined) {
    if (existing.assetType !== "image") {
      res.status(400).json({ error: "Duration can be set for images" });
      return;
    }
    const durationSec = clampImageDurationSec(req.body.durationSec);
    if (durationSec === null) {
      res.status(400).json({ error: "Image duration must be between 3 and 60 seconds" });
      return;
    }
    patch.durationMs = durationSec * 1000;
  }
  const [row] = await db.update(cricketSponsorMediaSlotsTable).set(patch).where(eq(cricketSponsorMediaSlotsTable.id, existing.id)).returning();
  res.json(toSponsorMediaView(tournamentId, slotNumber, row, true));
});

router.delete("/tournaments/:tournamentId/scoring/sponsor-media/:slotNumber", async (req, res) => {
  const tournamentId = parseTournamentId(req.params.tournamentId);
  const slotNumber = parseSlotNumber(req.params.slotNumber);
  if (tournamentId === null || slotNumber === null) {
    res.status(400).json({ error: "Invalid tournament or slot" });
    return;
  }
  if (!(await callerIsOperator(req, res, tournamentId))) return;
  const existing = await getSponsorMediaSlot(tournamentId, slotNumber);
  if (!existing) {
    res.json({ ok: true });
    return;
  }
  await deleteSponsorMediaAssets(existing);
  await db.delete(cricketSponsorMediaSlotsTable).where(eq(cricketSponsorMediaSlotsTable.id, existing.id));
  res.json({ ok: true });
});

export function parseSponsorMediaDirectorCue(body: unknown, issuedAt = Date.now()) {
  return parseSponsorMediaCue(body, issuedAt);
}

router.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: "Original uploads are limited to 500 MB." });
    return;
  }
  if (err instanceof Error && /Unsupported media/.test(err.message)) {
    res.status(400).json({ error: err.message });
    return;
  }
  next(err);
});

export default router;
