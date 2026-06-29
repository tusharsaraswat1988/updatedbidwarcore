/**
 * Cross-tournament photo asset cache — reuse Cloudinary uploads for identical sources.
 */

import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { photoSourceAssetsTable, type PhotoSourceAsset } from "@workspace/db";

export type CachedPhotoAsset = {
  id: number;
  sourceKey: string;
  originalUrl: string;
  originalPublicId: string;
  originalWidth: number | null;
  originalHeight: number | null;
  originalBytes: number | null;
  originalFormat: string | null;
  standardUrl: string;
  standardPublicId: string;
  downloadedAt: Date;
};

export async function findCachedPhotoBySourceKey(
  sourceKey: string,
): Promise<CachedPhotoAsset | null> {
  const [row] = await db
    .select()
    .from(photoSourceAssetsTable)
    .where(eq(photoSourceAssetsTable.sourceKey, sourceKey))
    .limit(1);
  return row ? mapCachedAsset(row) : null;
}

export async function findCachedPhotoByChecksum(
  checksum: string,
): Promise<CachedPhotoAsset | null> {
  const [row] = await db
    .select()
    .from(photoSourceAssetsTable)
    .where(eq(photoSourceAssetsTable.checksum, checksum))
    .limit(1);
  return row ? mapCachedAsset(row) : null;
}

export type UpsertCachedPhotoInput = {
  sourceKey: string;
  sourceType: string;
  driveFileId?: string | null;
  checksum: string;
  originalSourceUrl: string;
  originalFileName?: string | null;
  originalUrl: string;
  originalPublicId: string;
  originalWidth?: number | null;
  originalHeight?: number | null;
  originalBytes?: number | null;
  originalFormat?: string | null;
  standardUrl: string;
  standardPublicId: string;
  downloadedAt: Date;
  processingVersion: string;
};

export async function upsertCachedPhoto(input: UpsertCachedPhotoInput): Promise<number> {
  const [existing] = await db
    .select({ id: photoSourceAssetsTable.id })
    .from(photoSourceAssetsTable)
    .where(eq(photoSourceAssetsTable.sourceKey, input.sourceKey))
    .limit(1);

  if (existing) {
    await db
      .update(photoSourceAssetsTable)
      .set({
        checksum: input.checksum,
        originalSourceUrl: input.originalSourceUrl,
        originalFileName: input.originalFileName ?? null,
        originalUrl: input.originalUrl,
        originalPublicId: input.originalPublicId,
        originalWidth: input.originalWidth ?? null,
        originalHeight: input.originalHeight ?? null,
        originalBytes: input.originalBytes ?? null,
        originalFormat: input.originalFormat ?? null,
        standardUrl: input.standardUrl,
        standardPublicId: input.standardPublicId,
        downloadedAt: input.downloadedAt,
        processingVersion: input.processingVersion,
        updatedAt: new Date(),
      })
      .where(eq(photoSourceAssetsTable.id, existing.id));
    return existing.id;
  }

  const [inserted] = await db
    .insert(photoSourceAssetsTable)
    .values({
      sourceKey: input.sourceKey,
      sourceType: input.sourceType,
      driveFileId: input.driveFileId ?? null,
      checksum: input.checksum,
      originalSourceUrl: input.originalSourceUrl,
      originalFileName: input.originalFileName ?? null,
      originalUrl: input.originalUrl,
      originalPublicId: input.originalPublicId,
      originalWidth: input.originalWidth ?? null,
      originalHeight: input.originalHeight ?? null,
      originalBytes: input.originalBytes ?? null,
      originalFormat: input.originalFormat ?? null,
      standardUrl: input.standardUrl,
      standardPublicId: input.standardPublicId,
      downloadedAt: input.downloadedAt,
      processingVersion: input.processingVersion,
    })
    .returning({ id: photoSourceAssetsTable.id });

  return inserted!.id;
}

function mapCachedAsset(row: PhotoSourceAsset): CachedPhotoAsset {
  return {
    id: row.id,
    sourceKey: row.sourceKey,
    originalUrl: row.originalUrl,
    originalPublicId: row.originalPublicId,
    originalWidth: row.originalWidth,
    originalHeight: row.originalHeight,
    originalBytes: row.originalBytes,
    originalFormat: row.originalFormat,
    standardUrl: row.standardUrl,
    standardPublicId: row.standardPublicId,
    downloadedAt: row.downloadedAt,
  };
}
