import { createHash } from "node:crypto";
import { readFile, stat, unlink } from "node:fs/promises";
import { db, cricketSponsorMediaSlotsTable, type CricketSponsorMediaSlot } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import {
  SPONSOR_BROADCAST_ASSET_MAX_BYTES,
  SPONSOR_IMAGE_DURATION_DEFAULT_SEC,
  SPONSOR_MEDIA_SLOT_COUNT,
  buildCloudinaryBroadcastVideoUrl,
  buildCloudinaryPosterUrl,
  isPlayableBroadcastMp4,
  type SponsorMediaProcessingStatus,
} from "@workspace/scoring-core";
import { getCloudinary, uploadBufferToCloudinary } from "./cloudinary-media-service";
import { logger } from "./logger";
import { sharpMetadata, sharpToBuffer } from "./sharp-pipeline";

const PROCESS_TIMEOUT_MS = 8 * 60_000;
const SUITABLE_IMAGE_BYTES = 8 * 1024 * 1024;

export type SponsorMediaSlotView = {
  id: number | null;
  tournamentId: number;
  slotNumber: number;
  title: string;
  assetType: "image" | "video" | null;
  originalUrl: string | null;
  broadcastUrl: string | null;
  posterUrl: string | null;
  durationMs: number;
  fileSizeBytes: number | null;
  originalFileSizeBytes: number | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean;
  processingStatus: SponsorMediaProcessingStatus;
  active: boolean;
  version: number;
  checksum: string | null;
  errorMessage: string | null;
};

type ProcessJob = {
  tournamentId: number;
  slotId: number;
  version: number;
  filePath: string;
  mimeType: string;
  assetType: "image" | "video";
  title: string;
  durationMs: number;
  originalBytes: number;
  previousPublicId: string | null;
  previousBroadcastPublicId: string | null;
  previousAssetType: string | null;
};

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function toSponsorMediaView(
  tournamentId: number,
  slotNumber: number,
  row: CricketSponsorMediaSlot | undefined,
  includeOriginal: boolean,
): SponsorMediaSlotView {
  if (!row) {
    return {
      id: null,
      tournamentId,
      slotNumber,
      title: "",
      assetType: null,
      originalUrl: null,
      broadcastUrl: null,
      posterUrl: null,
      durationMs: SPONSOR_IMAGE_DURATION_DEFAULT_SEC * 1000,
      fileSizeBytes: null,
      originalFileSizeBytes: null,
      mimeType: null,
      width: null,
      height: null,
      hasAudio: false,
      processingStatus: "empty",
      active: true,
      version: 0,
      checksum: null,
      errorMessage: null,
    };
  }
  const status = (row.processingStatus || "empty") as SponsorMediaProcessingStatus;
  return {
    id: row.id,
    tournamentId,
    slotNumber: row.slotNumber,
    title: row.title,
    assetType: row.assetType === "image" || row.assetType === "video" ? row.assetType : null,
    originalUrl: includeOriginal ? row.originalUrl : null,
    broadcastUrl: status === "ready" ? row.broadcastUrl : null,
    posterUrl: row.posterUrl,
    durationMs: row.durationMs,
    fileSizeBytes: row.fileSizeBytes,
    originalFileSizeBytes: includeOriginal ? row.originalFileSizeBytes : null,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    hasAudio: row.hasAudio,
    processingStatus: status,
    active: row.active,
    version: row.version,
    checksum: status === "ready" ? row.checksum : null,
    errorMessage: includeOriginal ? row.errorMessage : (status === "failed" ? row.errorMessage : null),
  };
}

export async function listSponsorMediaSlots(
  tournamentId: number,
  includeOriginal: boolean,
): Promise<SponsorMediaSlotView[]> {
  const rows = await db
    .select()
    .from(cricketSponsorMediaSlotsTable)
    .where(eq(cricketSponsorMediaSlotsTable.tournamentId, tournamentId));
  const bySlot = new Map(rows.map((row: CricketSponsorMediaSlot) => [row.slotNumber, row]));
  return Array.from({ length: SPONSOR_MEDIA_SLOT_COUNT }, (_, index) =>
    toSponsorMediaView(tournamentId, index + 1, bySlot.get(index + 1), includeOriginal),
  );
}

export async function getSponsorMediaSlot(
  tournamentId: number,
  slotNumber: number,
): Promise<CricketSponsorMediaSlot | null> {
  const [row] = await db
    .select()
    .from(cricketSponsorMediaSlotsTable)
    .where(and(
      eq(cricketSponsorMediaSlotsTable.tournamentId, tournamentId),
      eq(cricketSponsorMediaSlotsTable.slotNumber, slotNumber),
    ))
    .limit(1);
  return row ?? null;
}

export function beginSponsorMediaProcessing(job: ProcessJob): void {
  void runSponsorMediaJob(job).catch((err) => {
    logger.error({ err, tournamentId: job.tournamentId, slotId: job.slotId }, "Sponsor media processing crashed");
  });
}

async function runSponsorMediaJob(job: ProcessJob): Promise<void> {
  let uploadedPublicId: string | null = null;
  let broadcastStoredId: string | null = null;
  let uploadedResource: "image" | "video" = job.assetType;
  try {
    await markStatus(job, "processing", null);
    const cloudinary = await getCloudinary();
    if (!cloudinary) {
      throw new Error("Storage unavailable");
    }
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    if (!cloudName) throw new Error("Storage unavailable");

    if (job.assetType === "image") {
      const prepared = await prepareImage(job.filePath, job.mimeType);
      const originalUpload = prepared.recompressed
        ? await uploadBufferToCloudinary(await readFile(job.filePath), {
          folder: "bidwar/sponsor-media/originals",
          resource_type: "image",
        })
        : null;
      const broadcastUpload = await uploadBufferToCloudinary(prepared.buffer, {
        folder: "bidwar/sponsor-media/images",
        resource_type: "image",
      });
      uploadedPublicId = broadcastUpload.publicId;
      const ready = await stillCurrent(job);
      if (!ready) {
        await destroyAsset(broadcastUpload.publicId, "image");
        if (originalUpload) await destroyAsset(originalUpload.publicId, "image");
        return;
      }
      await db.update(cricketSponsorMediaSlotsTable).set({
        title: job.title,
        assetType: "image",
        originalUrl: originalUpload?.url ?? broadcastUpload.url,
        originalPublicId: originalUpload?.publicId ?? broadcastUpload.publicId,
        broadcastUrl: broadcastUpload.url,
        broadcastPublicId: broadcastUpload.publicId,
        posterUrl: broadcastUpload.url,
        durationMs: job.durationMs,
        fileSizeBytes: prepared.buffer.length,
        originalFileSizeBytes: job.originalBytes,
        mimeType: prepared.mime,
        width: prepared.width,
        height: prepared.height,
        hasAudio: false,
        processingStatus: "ready",
        active: true,
        checksum: sha256(prepared.buffer),
        errorMessage: null,
        updatedAt: new Date(),
      }).where(and(
        eq(cricketSponsorMediaSlotsTable.id, job.slotId),
        eq(cricketSponsorMediaSlotsTable.version, job.version),
      ));
    } else {
      const uploaded = await uploadLargeVideo(job.filePath);
      uploadedPublicId = uploaded.publicId;
      const derivedUrl = buildCloudinaryBroadcastVideoUrl(cloudName, uploaded.publicId);
      const posterUrl = buildCloudinaryPosterUrl(cloudName, uploaded.publicId);
      const broadcast = await downloadBroadcastAsset(derivedUrl);
      const stored = await uploadBufferToCloudinary(broadcast.buffer, {
        folder: "bidwar/sponsor-media/broadcast",
        resource_type: "video",
      });
      broadcastStoredId = stored.publicId;
      const ready = await stillCurrent(job);
      if (!ready) {
        await destroyAsset(stored.publicId, "video");
        await destroyAsset(uploaded.publicId, "video");
        return;
      }
      const durationMs = uploaded.durationSeconds > 0
        ? Math.round(uploaded.durationSeconds * 1000)
        : job.durationMs;
      await db.update(cricketSponsorMediaSlotsTable).set({
        title: job.title,
        assetType: "video",
        originalUrl: uploaded.url,
        originalPublicId: uploaded.publicId,
        broadcastUrl: stored.url,
        broadcastPublicId: stored.publicId,
        posterUrl,
        durationMs,
        fileSizeBytes: broadcast.size,
        originalFileSizeBytes: job.originalBytes,
        mimeType: "video/mp4",
        width: uploaded.width,
        height: uploaded.height,
        hasAudio: uploaded.hasAudio,
        processingStatus: "ready",
        active: true,
        checksum: broadcast.checksum,
        errorMessage: null,
        updatedAt: new Date(),
      }).where(and(
        eq(cricketSponsorMediaSlotsTable.id, job.slotId),
        eq(cricketSponsorMediaSlotsTable.version, job.version),
      ));
    }

    if (job.previousPublicId && job.previousPublicId !== uploadedPublicId) {
      await destroyAsset(job.previousPublicId, job.previousAssetType === "video" ? "video" : "image");
    }
    if (
      job.previousBroadcastPublicId
      && job.previousBroadcastPublicId !== uploadedPublicId
      && job.previousBroadcastPublicId !== broadcastStoredId
    ) {
      await destroyAsset(job.previousBroadcastPublicId, job.previousAssetType === "video" ? "video" : "image");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Processing failed";
    logger.error({ err, tournamentId: job.tournamentId, slotId: job.slotId }, "Sponsor media processing failed");
    if (broadcastStoredId) {
      await destroyAsset(broadcastStoredId, "video");
    }
    if (uploadedPublicId) {
      await destroyAsset(uploadedPublicId, uploadedResource);
    }
    await markStatus(job, "failed", message.slice(0, 300));
  } finally {
    await unlink(job.filePath).catch(() => {});
  }
}

async function markStatus(job: ProcessJob, status: "processing" | "failed", errorMessage: string | null) {
  await db.update(cricketSponsorMediaSlotsTable).set({
    processingStatus: status,
    errorMessage,
    broadcastUrl: null,
    checksum: null,
    updatedAt: new Date(),
  }).where(and(
    eq(cricketSponsorMediaSlotsTable.id, job.slotId),
    eq(cricketSponsorMediaSlotsTable.version, job.version),
  ));
}

async function stillCurrent(job: ProcessJob): Promise<boolean> {
  const [row] = await db
    .select({ version: cricketSponsorMediaSlotsTable.version })
    .from(cricketSponsorMediaSlotsTable)
    .where(eq(cricketSponsorMediaSlotsTable.id, job.slotId))
    .limit(1);
  return row?.version === job.version;
}

async function prepareImage(filePath: string, mimeType: string): Promise<{
  buffer: Buffer;
  mime: string;
  width: number | null;
  height: number | null;
  recompressed: boolean;
}> {
  const meta = await sharpMetadata(filePath);
  const width = meta.width ?? null;
  const height = meta.height ?? null;
  const fileStat = await stat(filePath);
  const suitable = Boolean(
    width && height
    && width <= 1920
    && height <= 1080
    && fileStat.size <= SUITABLE_IMAGE_BYTES
    && (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp"),
  );
  if (suitable) {
    return { buffer: await readFile(filePath), mime: mimeType, width, height, recompressed: false };
  }
  const keepAlpha = Boolean(meta.hasAlpha) && (mimeType === "image/png" || mimeType === "image/webp");
  const buffer = await sharpToBuffer(filePath, (pipeline) => {
    const resized = pipeline.rotate().resize(1920, 1080, { fit: "inside", withoutEnlargement: true });
    if (keepAlpha && mimeType === "image/webp") return resized.webp({ quality: 82, alphaQuality: 100 });
    if (keepAlpha) return resized.png();
    return resized.jpeg({ quality: 85 });
  });
  const out = await sharpMetadata(buffer);
  return {
    buffer,
    mime: keepAlpha ? (mimeType === "image/webp" ? "image/webp" : "image/png") : "image/jpeg",
    width: out.width ?? width,
    height: out.height ?? height,
    recompressed: true,
  };
}

async function uploadLargeVideo(filePath: string): Promise<{
  url: string;
  publicId: string;
  width: number | null;
  height: number | null;
  durationSeconds: number;
  hasAudio: boolean;
}> {
  const cloudinary = await getCloudinary();
  if (!cloudinary) throw new Error("Storage unavailable");
  const uploader = cloudinary.uploader as unknown as {
    upload_large: (
      path: string,
      options: Record<string, unknown>,
      callback: (error: unknown, uploaded: unknown) => void,
    ) => void;
  };
  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    uploader.upload_large(filePath, {
      resource_type: "video",
      folder: "bidwar/sponsor-media/originals",
      chunk_size: 20_000_000,
    }, (error: unknown, uploaded: unknown) => {
      if (error || !uploaded || typeof uploaded !== "object") {
        reject(error instanceof Error ? error : new Error("Storage unavailable"));
        return;
      }
      resolve(uploaded as Record<string, unknown>);
    });
  });
  const url = typeof result.secure_url === "string" ? result.secure_url : "";
  const publicId = typeof result.public_id === "string" ? result.public_id : "";
  if (!url || !publicId) throw new Error("Storage unavailable");
  return {
    url,
    publicId,
    width: typeof result.width === "number" ? result.width : null,
    height: typeof result.height === "number" ? result.height : null,
    durationSeconds: typeof result.duration === "number" ? result.duration : 0,
    hasAudio: Boolean(result.audio),
  };
}

async function downloadBroadcastAsset(url: string): Promise<{ buffer: Buffer; size: number; checksum: string }> {
  const started = Date.now();
  let lastError = "Processing failed";
  while (Date.now() - started < PROCESS_TIMEOUT_MS) {
    try {
      const probe = await fetch(url, { method: "GET", headers: { Range: "bytes=0-1" } });
      const type = probe.headers.get("content-type") || "";
      if ((probe.ok || probe.status === 206) && (type.includes("video") || type.includes("mp4") || type.includes("octet-stream"))) {
        const full = await fetch(url);
        if (!full.ok) throw new Error("Unable to download");
        if (full.headers.get("x-cld-error")) throw new Error("Video is still processing");
        const fullType = full.headers.get("content-type") || "";
        if (!(fullType.includes("video") || fullType.includes("mp4") || fullType.includes("octet-stream"))) {
          throw new Error("Broadcast file is not a video");
        }
        const buffer = Buffer.from(await full.arrayBuffer());
        if (!isPlayableBroadcastMp4(buffer)) throw new Error("Video is still processing");
        if (buffer.length > SPONSOR_BROADCAST_ASSET_MAX_BYTES) {
          throw new Error("Broadcast asset is too large to preload");
        }
        return { buffer, size: buffer.length, checksum: sha256(buffer) };
      }
      lastError = "Video is still processing";
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Processing failed";
      if (lastError === "Broadcast asset is too large to preload") throw err;
    }
    await sleep(2000);
  }
  throw new Error(lastError);
}

async function destroyAsset(publicId: string, resourceType: "image" | "video"): Promise<void> {
  try {
    const cloudinary = await getCloudinary();
    if (!cloudinary) return;
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
  } catch (err) {
    logger.warn({ err, publicId }, "Sponsor media asset delete failed");
  }
}

export async function deleteSponsorMediaAssets(row: CricketSponsorMediaSlot): Promise<void> {
  if (row.originalPublicId) {
    await destroyAsset(row.originalPublicId, row.assetType === "video" ? "video" : "image");
  }
  if (row.broadcastPublicId && row.broadcastPublicId !== row.originalPublicId) {
    await destroyAsset(row.broadcastPublicId, row.assetType === "video" ? "video" : "image");
  }
}
