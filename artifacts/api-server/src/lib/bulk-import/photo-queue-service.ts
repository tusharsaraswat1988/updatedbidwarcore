/**
 * Background photo processing queue for BMW imports.
 * Player commit and photo upload are independent — photo failures never block import.
 */

import { eq, and, inArray, ne } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  bulkImportPhotoItemsTable,
  playersTable,
  type BulkImportPhotoItem,
} from "@workspace/db";
import {
  importPhotoFromUrl,
  isPhotoUrl,
  isStableCloudinaryPhotoUrl,
  photoSourceKey,
  mapWithConcurrency,
  PHOTO_IMPORT_CONCURRENCY,
  PHOTO_PROCESSING_VERSION,
  DEFAULT_PHOTO_IMPORT_MODE,
  type PhotoImportMode,
  type PhotoValidationStatus,
} from "./photo-import-service.ts";
import { getPhotoSourceAdapter } from "./photo-source-adapter.ts";
import { findCachedPhotoBySourceKey } from "./photo-source-cache.ts";
import { writeEntityAuditLogs } from "./entity-audit-service.ts";

export type PhotoQueueItemInput = {
  playerId?: number | null;
  playerName?: string | null;
  sheetRow?: number;
  sourceUrl: string;
  hadExistingPhoto?: boolean;
};

export type PhotoJobProgress = {
  total: number;
  pending: number;
  processing: number;
  uploaded: number;
  failed: number;
  skipped: number;
  complete: boolean;
};

export type PhotoImportSummary = PhotoJobProgress & {
  playersWithPhotos: number;
  newPhotosUploaded: number;
  existingPhotosReused: number;
  photosReplaced: number;
  warnings: number;
  processingTimeMs: number | null;
};

const activeJobs = new Set<number>();
const jobStartedAt = new Map<number, number>();

function shouldSkipByImportMode(
  mode: PhotoImportMode,
  hadExistingPhoto: boolean,
): { skip: boolean; reason?: string } {
  if (mode === "replace_all") return { skip: false };
  if (hadExistingPhoto) {
    if (mode === "skip_existing") {
      return { skip: true, reason: "Player already has a photo" };
    }
    if (mode === "replace_empty_only") {
      return { skip: true, reason: "Player already has a photo (replace empty only)" };
    }
  }
  return { skip: false };
}

export async function queuePhotosForJob(
  jobId: number,
  tournamentId: number,
  uploadedBy: string,
  items: PhotoQueueItemInput[],
  photoImportMode: PhotoImportMode = DEFAULT_PHOTO_IMPORT_MODE,
): Promise<number> {
  const rows = items
    .filter((item) => isPhotoUrl(item.sourceUrl))
    .map((item) => {
      const url = String(item.sourceUrl).trim();
      const adapter = getPhotoSourceAdapter(url);
      const alreadyCloudinary = isStableCloudinaryPhotoUrl(url);
      return {
        jobId,
        tournamentId,
        playerId: item.playerId ?? null,
        playerName: item.playerName ?? null,
        sheetRow: item.sheetRow ?? null,
        sourceUrl: url,
        sourceKey: photoSourceKey(url),
        sourceType: adapter.type,
        driveFileId: adapter.extractSourceId(url),
        originalFileName: adapter.extractFileName?.(url) ?? null,
        status: alreadyCloudinary ? "skipped" : "pending",
        validationStatus: alreadyCloudinary ? ("skipped_cloudinary" as const) : null,
        storedUrl: alreadyCloudinary ? url : null,
        publicId: alreadyCloudinary ? null : null,
        hadExistingPhoto: item.hadExistingPhoto ? 1 : 0,
        photoImportMode,
        processingVersion: PHOTO_PROCESSING_VERSION,
        uploadedBy,
      };
    });

  if (rows.length === 0) return 0;

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(bulkImportPhotoItemsTable).values(rows.slice(i, i + batchSize));
  }

  return rows.length;
}

export async function getPhotoJobProgress(jobId: number): Promise<PhotoJobProgress> {
  const items = await db
    .select({ status: bulkImportPhotoItemsTable.status })
    .from(bulkImportPhotoItemsTable)
    .where(eq(bulkImportPhotoItemsTable.jobId, jobId));

  const total = items.length;
  let pending = 0;
  let processing = 0;
  let uploaded = 0;
  let failed = 0;
  let skipped = 0;

  for (const item of items) {
    switch (item.status) {
      case "pending": pending++; break;
      case "processing": processing++; break;
      case "uploaded": uploaded++; break;
      case "failed": failed++; break;
      case "skipped": skipped++; break;
    }
  }

  return {
    total,
    pending,
    processing,
    uploaded,
    failed,
    skipped,
    complete: total > 0 && pending === 0 && processing === 0,
  };
}

export async function getPhotoImportSummary(jobId: number): Promise<PhotoImportSummary> {
  const progress = await getPhotoJobProgress(jobId);
  const items = await db
    .select({
      status: bulkImportPhotoItemsTable.status,
      reusedFromItemId: bulkImportPhotoItemsTable.reusedFromItemId,
      reusedFromCacheId: bulkImportPhotoItemsTable.reusedFromCacheId,
      hadExistingPhoto: bulkImportPhotoItemsTable.hadExistingPhoto,
      qualityWarnings: bulkImportPhotoItemsTable.qualityWarnings,
      skipReason: bulkImportPhotoItemsTable.skipReason,
    })
    .from(bulkImportPhotoItemsTable)
    .where(eq(bulkImportPhotoItemsTable.jobId, jobId));

  let newPhotosUploaded = 0;
  let existingPhotosReused = 0;
  let photosReplaced = 0;
  let warnings = 0;

  for (const item of items) {
    if (item.qualityWarnings?.length) warnings += item.qualityWarnings.length;
    if (item.status === "uploaded") {
      if (item.reusedFromItemId || item.reusedFromCacheId) {
        existingPhotosReused++;
      } else {
        newPhotosUploaded++;
      }
      if (item.hadExistingPhoto) photosReplaced++;
    }
  }

  const startedAt = jobStartedAt.get(jobId);
  const processingTimeMs =
    progress.complete && startedAt ? Date.now() - startedAt : null;

  return {
    ...progress,
    playersWithPhotos: progress.total,
    newPhotosUploaded,
    existingPhotosReused,
    photosReplaced,
    warnings,
    processingTimeMs,
  };
}

export async function listPhotoJobItems(
  jobId: number,
  limit = 500,
): Promise<BulkImportPhotoItem[]> {
  return db
    .select()
    .from(bulkImportPhotoItemsTable)
    .where(eq(bulkImportPhotoItemsTable.jobId, jobId))
    .limit(limit);
}

async function findReusablePhotoInJob(
  tournamentId: number,
  sourceKey: string,
  excludeItemId: number,
): Promise<BulkImportPhotoItem | null> {
  const [existing] = await db
    .select()
    .from(bulkImportPhotoItemsTable)
    .where(
      and(
        eq(bulkImportPhotoItemsTable.tournamentId, tournamentId),
        eq(bulkImportPhotoItemsTable.sourceKey, sourceKey),
        eq(bulkImportPhotoItemsTable.status, "uploaded"),
        ne(bulkImportPhotoItemsTable.id, excludeItemId),
      ),
    )
    .limit(1);
  return existing ?? null;
}

async function applyPhotoToPlayer(
  item: BulkImportPhotoItem,
  storedUrl: string,
  publicId: string | null,
  originalStoredUrl: string | null | undefined,
  originalPublicId: string | null | undefined,
  meta: { performedBy: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  if (!item.playerId) return;

  const [player] = await db
    .select({
      photoUrl: playersTable.photoUrl,
      photoPublicId: playersTable.photoPublicId,
      photoOriginalUrl: playersTable.photoOriginalUrl,
    })
    .from(playersTable)
    .where(eq(playersTable.id, item.playerId))
    .limit(1);

  await db
    .update(playersTable)
    .set({
      photoUrl: storedUrl,
      photoPublicId: publicId,
      ...(originalStoredUrl
        ? { photoOriginalUrl: originalStoredUrl, photoOriginalPublicId: originalPublicId ?? null }
        : {}),
    })
    .where(eq(playersTable.id, item.playerId));

  await writeEntityAuditLogs([
    {
      entityType: "player",
      entityId: String(item.playerId),
      fieldName: "photoUrl",
      oldValue: player?.photoUrl ?? null,
      newValue: storedUrl,
      action: "photo_import",
      performedBy: meta.performedBy,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      jobId: item.jobId,
      tournamentId: item.tournamentId,
    },
  ]);
}

function buildUploadedItemUpdate(
  item: BulkImportPhotoItem,
  result: Awaited<ReturnType<typeof importPhotoFromUrl>>,
  extra: {
    reusedFromItemId?: number | null;
    reusedFromCacheId?: number | null;
  } = {},
) {
  return {
    status: "uploaded" as const,
    storedUrl: result.storedUrl,
    publicId: result.publicId,
    originalStoredUrl: result.originalStoredUrl ?? null,
    originalPublicId: result.originalPublicId ?? null,
    originalWidth: result.originalWidth ?? null,
    originalHeight: result.originalHeight ?? null,
    originalBytes: result.originalBytes ?? null,
    originalFormat: result.originalFormat ?? null,
    originalFileName: result.originalFileName ?? item.originalFileName,
    sourceType: result.sourceType ?? item.sourceType,
    driveFileId: result.driveFileId ?? item.driveFileId,
    downloadedAt: result.downloadedAt ?? new Date(),
    qualityWarnings: result.qualityWarnings ?? null,
    retryCount: result.retryCount ?? 0,
    processedAt: new Date(),
    validationStatus: (result.validationStatus ?? "accessible") as string,
    failureReason: null,
    skipReason: null,
    processingVersion: PHOTO_PROCESSING_VERSION,
    reusedFromItemId: extra.reusedFromItemId ?? null,
    reusedFromCacheId: extra.reusedFromCacheId ?? result.reusedFromCacheId ?? null,
  };
}

async function markItemSkipped(
  item: BulkImportPhotoItem,
  reason: string,
  validationStatus: string,
): Promise<void> {
  await db
    .update(bulkImportPhotoItemsTable)
    .set({
      status: "skipped",
      skipReason: reason,
      validationStatus,
      processedAt: new Date(),
    })
    .where(eq(bulkImportPhotoItemsTable.id, item.id));
}

const MAX_ITEM_QUEUE_RETRIES = 3;
const QUEUE_RETRY_BACKOFF_MS = 2000;
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function processPhotoItem(
  item: BulkImportPhotoItem,
  meta: { performedBy: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const mode = (item.photoImportMode as PhotoImportMode | null) ?? DEFAULT_PHOTO_IMPORT_MODE;
  const hadExistingPhoto = item.hadExistingPhoto === 1;
  const modeCheck = shouldSkipByImportMode(mode, hadExistingPhoto);

  if (modeCheck.skip) {
    await markItemSkipped(item, modeCheck.reason!, "skipped_mode");
    return;
  }

  await db
    .update(bulkImportPhotoItemsTable)
    .set({ status: "processing" })
    .where(eq(bulkImportPhotoItemsTable.id, item.id));

  const globalCache = await findCachedPhotoBySourceKey(item.sourceKey);
  if (globalCache && globalCache.processingVersion === PHOTO_PROCESSING_VERSION) {
    const result = {
      storedUrl: globalCache.standardUrl,
      publicId: globalCache.standardPublicId,
      originalStoredUrl: globalCache.originalUrl,
      originalPublicId: globalCache.originalPublicId,
      originalWidth: globalCache.originalWidth,
      originalHeight: globalCache.originalHeight,
      originalBytes: globalCache.originalBytes,
      originalFormat: globalCache.originalFormat,
      downloadedAt: globalCache.downloadedAt,
      validationStatus: "accessible" as PhotoValidationStatus,
      reusedFromCacheId: globalCache.id,
    };

    await db
      .update(bulkImportPhotoItemsTable)
      .set(buildUploadedItemUpdate(item, result, { reusedFromCacheId: globalCache.id }))
      .where(eq(bulkImportPhotoItemsTable.id, item.id));

    await applyPhotoToPlayer(
      item,
      globalCache.standardUrl,
      globalCache.standardPublicId,
      globalCache.originalUrl,
      globalCache.originalPublicId,
      meta,
    );
    return;
  }

  const reusable = await findReusablePhotoInJob(item.tournamentId, item.sourceKey, item.id);
  if (reusable?.storedUrl) {
    await db
      .update(bulkImportPhotoItemsTable)
      .set({
        ...buildUploadedItemUpdate(item, {
          storedUrl: reusable.storedUrl,
          publicId: reusable.publicId,
          originalStoredUrl: reusable.originalStoredUrl,
          originalPublicId: reusable.originalPublicId,
          originalWidth: reusable.originalWidth,
          originalHeight: reusable.originalHeight,
          originalBytes: reusable.originalBytes,
          originalFormat: reusable.originalFormat,
          downloadedAt: reusable.downloadedAt ?? new Date(),
          validationStatus: "accessible",
        }, { reusedFromItemId: reusable.id }),
      })
      .where(eq(bulkImportPhotoItemsTable.id, item.id));

    await applyPhotoToPlayer(
      item,
      reusable.storedUrl,
      reusable.publicId,
      reusable.originalStoredUrl,
      reusable.originalPublicId,
      meta,
    );
    return;
  }

  const result = await importPhotoFromUrl(item.sourceUrl);

  if (result.storedUrl) {
    await db
      .update(bulkImportPhotoItemsTable)
      .set(buildUploadedItemUpdate(item, result))
      .where(eq(bulkImportPhotoItemsTable.id, item.id));

    await applyPhotoToPlayer(
      item,
      result.storedUrl,
      result.publicId,
      result.originalStoredUrl,
      result.originalPublicId,
      meta,
    );
    return;
  }

  const totalRetries = (item.retryCount ?? 0) + (result.retryCount ?? 0);
  if (result.retryable && totalRetries < MAX_ITEM_QUEUE_RETRIES) {
    await db
      .update(bulkImportPhotoItemsTable)
      .set({
        status: "pending",
        failureReason: result.warning ?? "Temporary download failure — will retry",
        retryCount: totalRetries + 1,
        validationStatus: (result.validationStatus ?? "broken") as string,
      })
      .where(eq(bulkImportPhotoItemsTable.id, item.id));
    await sleep(Math.min(QUEUE_RETRY_BACKOFF_MS * 2 ** totalRetries, 30_000));
    return;
  }

  await db
    .update(bulkImportPhotoItemsTable)
    .set({
      status: "failed",
      failureReason: result.warning ?? "Photo import failed",
      validationStatus: (result.validationStatus ?? "broken") as string,
      qualityWarnings: result.qualityWarnings ?? null,
      retryCount: result.retryCount ?? 0,
      processedAt: new Date(),
    })
    .where(eq(bulkImportPhotoItemsTable.id, item.id));
}

export async function processPhotoJob(
  jobId: number,
  meta: { performedBy: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  if (activeJobs.has(jobId)) return;
  activeJobs.add(jobId);
  if (!jobStartedAt.has(jobId)) jobStartedAt.set(jobId, Date.now());

  try {
    let pending = await db
      .select()
      .from(bulkImportPhotoItemsTable)
      .where(
        and(
          eq(bulkImportPhotoItemsTable.jobId, jobId),
          eq(bulkImportPhotoItemsTable.status, "pending"),
        ),
      );

    while (pending.length > 0) {
      await mapWithConcurrency(pending, PHOTO_IMPORT_CONCURRENCY, (item) =>
        processPhotoItem(item, meta),
      );

      pending = await db
        .select()
        .from(bulkImportPhotoItemsTable)
        .where(
          and(
            eq(bulkImportPhotoItemsTable.jobId, jobId),
            eq(bulkImportPhotoItemsTable.status, "pending"),
          ),
        );
    }
  } finally {
    activeJobs.delete(jobId);
  }
}

export function startPhotoJobProcessing(
  jobId: number,
  meta: { performedBy: string; ipAddress?: string | null; userAgent?: string | null },
): void {
  void processPhotoJob(jobId, meta).catch((err) => {
    console.error(`[photo-queue] job ${jobId} failed:`, err);
  });
}

export async function retryFailedPhotos(
  jobId: number,
  meta: { performedBy: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<{ requeued: number }> {
  const failed = await db
    .select({ id: bulkImportPhotoItemsTable.id })
    .from(bulkImportPhotoItemsTable)
    .where(
      and(
        eq(bulkImportPhotoItemsTable.jobId, jobId),
        eq(bulkImportPhotoItemsTable.status, "failed"),
      ),
    );

  if (failed.length === 0) return { requeued: 0 };

  await db
    .update(bulkImportPhotoItemsTable)
    .set({
      status: "pending",
      failureReason: null,
      processedAt: null,
    })
    .where(
      inArray(
        bulkImportPhotoItemsTable.id,
        failed.map((f) => f.id),
      ),
    );

  startPhotoJobProcessing(jobId, meta);
  return { requeued: failed.length };
}

export async function applyImmediateCloudinaryPhotos(
  jobId: number,
  tournamentId: number,
  photoImportMode: PhotoImportMode,
  meta: { performedBy: string; ipAddress?: string | null; userAgent?: string | null },
): Promise<void> {
  const skipped = await db
    .select()
    .from(bulkImportPhotoItemsTable)
    .where(
      and(
        eq(bulkImportPhotoItemsTable.jobId, jobId),
        eq(bulkImportPhotoItemsTable.status, "skipped"),
        eq(bulkImportPhotoItemsTable.validationStatus, "skipped_cloudinary"),
      ),
    );

  for (const item of skipped) {
    const modeCheck = shouldSkipByImportMode(photoImportMode, item.hadExistingPhoto === 1);
    if (modeCheck.skip) {
      await markItemSkipped(item, modeCheck.reason!, "skipped_mode");
      continue;
    }
    if (item.storedUrl && item.playerId) {
      await applyPhotoToPlayer(item, item.storedUrl, item.publicId, null, null, meta);
      await db
        .update(bulkImportPhotoItemsTable)
        .set({ processedAt: new Date() })
        .where(eq(bulkImportPhotoItemsTable.id, item.id));
    }
  }
}

export async function lookupExistingPlayerPhotos(
  playerIds: number[],
): Promise<Map<number, { hasAny: boolean; hasContent: boolean }>> {
  const map = new Map<number, { hasAny: boolean; hasContent: boolean }>();
  if (playerIds.length === 0) return map;

  const rows = await db
    .select({ id: playersTable.id, photoUrl: playersTable.photoUrl })
    .from(playersTable)
    .where(inArray(playersTable.id, playerIds));

  for (const row of rows) {
    const url = row.photoUrl;
    map.set(row.id, {
      hasAny: url != null && url !== "",
      hasContent: Boolean(url?.trim()),
    });
  }
  return map;
}

export type { PhotoValidationStatus, PhotoImportMode };
export { DEFAULT_PHOTO_IMPORT_MODE };
