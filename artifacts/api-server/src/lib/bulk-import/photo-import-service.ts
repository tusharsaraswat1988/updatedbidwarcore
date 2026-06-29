/**
 * Download remote photos during TMW import.
 * Failures produce warnings — never block the entire import.
 */

import { createHash } from "node:crypto";
import sharp from "sharp";
import { parseCloudinaryPublicIdFromUrl } from "@workspace/api-base/cloudinary-media";
import { uploadBufferToCloudinary } from "../cloudinary-media-service.ts";
import {
  extractDriveFileId,
  extractOriginalFileName,
  getPhotoSourceAdapter,
  photoSourceKey,
  resolvePhotoDownloadUrl,
} from "./photo-source-adapter.ts";
import type { CachedPhotoAsset } from "./photo-source-cache.ts";

const PHOTO_IMPORT_CONCURRENCY = 5;
const PHOTO_VALIDATION_CONCURRENCY = 10;
const PHOTO_DOWNLOAD_TIMEOUT_MS = 30_000;
const PHOTO_VALIDATION_TIMEOUT_MS = 15_000;
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024;
const MAX_DOWNLOAD_RETRIES = 5;
const INITIAL_RETRY_BACKOFF_MS = 1000;

export const PHOTO_PROCESSING_VERSION = "2.0";
export const ORIGINAL_PHOTO_FOLDER = "bidwar/workbook/photos/originals";
export const STANDARD_PHOTO_FOLDER = "bidwar/workbook/photos";

/** BidWar player card standard — matches cldUrl playerCard preset aspect ratio. */
export const PLAYER_PHOTO_WIDTH = 560;
export const PLAYER_PHOTO_HEIGHT = 700;

/** Minimum acceptable resolution for player photos */
export const MIN_PHOTO_WIDTH = 200;
export const MIN_PHOTO_HEIGHT = 200;
export const MIN_PHOTO_BYTES = 1024;
export const MAX_REASONABLE_DIMENSION = 8000;

export type PhotoImportMode = "replace_all" | "skip_existing" | "replace_empty_only";
export const DEFAULT_PHOTO_IMPORT_MODE: PhotoImportMode = "replace_empty_only";

export type PhotoValidationStatus =
  | "accessible"
  | "private"
  | "broken"
  | "not_image"
  | "unsupported"
  | "skipped";

export type PhotoQualityWarningCode =
  | "low_resolution"
  | "very_large_image"
  | "extremely_small_image"
  | "unsupported_format"
  | "invalid_image"
  | "corrupted_image";

export const PHOTO_QUALITY_WARNING_LABELS: Record<PhotoQualityWarningCode, string> = {
  low_resolution: "Low Resolution",
  very_large_image: "Very Large Image",
  extremely_small_image: "Extremely Small Image",
  unsupported_format: "Unsupported Format",
  invalid_image: "Invalid Image",
  corrupted_image: "Corrupted Image",
};

export type PhotoValidationSummary = {
  found: number;
  accessible: number;
  private: number;
  broken: number;
  notImage: number;
  unsupported: number;
  skipped: number;
  qualityWarnings: number;
};

export type PhotoLinkValidation = {
  url: string;
  status: PhotoValidationStatus;
  message?: string;
  qualityWarnings?: string[];
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
};

export type PhotoImageMetadata = {
  width: number | null;
  height: number | null;
  format: string | null;
  bytes: number;
  checksum: string;
};

/** Already on Cloudinary — re-download/re-upload would stall large workbook imports. */
export function isStableCloudinaryPhotoUrl(url: string): boolean {
  return /res\.cloudinary\.com\//i.test(url.trim());
}

export { extractDriveFileId, photoSourceKey, resolvePhotoDownloadUrl };

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]!);
    }
  });
  await Promise.all(workers);
  return results;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDownloadError(status: number | null, err?: unknown): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return msg.includes("timeout") || msg.includes("aborted") || msg.includes("network");
  }
  return false;
}

const PHOTO_HOST_PATTERNS = [
  /drive\.google\.com/i,
  /googleusercontent\.com/i,
  /photos\.google\.com/i,
  /dropbox\.com/i,
  /dropboxusercontent\.com/i,
  /onedrive\.live\.com/i,
  /sharepoint\.com/i,
  /cloudinary\.com/i,
  /\.(jpg|jpeg|png|gif|webp)(\?|$)/i,
];

export function isPhotoUrl(value: unknown): boolean {
  if (value == null || value === "") return false;
  const url = String(value).trim();
  if (url.startsWith("local://")) return true;
  if (!/^https?:\/\//i.test(url)) return false;
  return PHOTO_HOST_PATTERNS.some((p) => p.test(url));
}

function classifyHttpPhotoResponse(
  status: number,
  contentType: string,
  bodySample: string,
): PhotoValidationStatus {
  if (status === 403) return "private";
  if (status === 401) return "private";
  if (!status || status >= 400) return "broken";
  if (contentType.startsWith("image/")) return "accessible";
  if (contentType.includes("text/html") || bodySample.includes("<!DOCTYPE") || bodySample.includes("<html")) {
    return "private";
  }
  return "not_image";
}

export function validateImageQuality(
  metadata: PhotoImageMetadata,
  contentType?: string,
): PhotoQualityWarningCode[] {
  const warnings: PhotoQualityWarningCode[] = [];
  const { width, height, format, bytes } = metadata;

  if (width == null || height == null || width <= 0 || height <= 0) {
    warnings.push("invalid_image");
    return warnings;
  }

  if (width < MIN_PHOTO_WIDTH || height < MIN_PHOTO_HEIGHT) {
    warnings.push("low_resolution");
  }

  if (width > MAX_REASONABLE_DIMENSION || height > MAX_REASONABLE_DIMENSION) {
    warnings.push("very_large_image");
  }

  if (bytes < MIN_PHOTO_BYTES) {
    warnings.push("extremely_small_image");
  }

  const normalizedFormat = (format ?? contentType?.replace("image/", "") ?? "").toLowerCase();
  const supported = new Set(["jpeg", "jpg", "png", "webp", "gif", "heic", "heif", "avif", "tiff"]);
  if (normalizedFormat && !supported.has(normalizedFormat)) {
    warnings.push("unsupported_format");
  }

  return warnings;
}

export async function extractPhotoMetadata(buffer: Buffer): Promise<PhotoImageMetadata | { corrupted: true }> {
  try {
    const meta = await sharp(buffer, { failOn: "none" }).metadata();
    if (!meta.width && !meta.height) {
      return { corrupted: true };
    }
    return {
      width: meta.width ?? null,
      height: meta.height ?? null,
      format: meta.format ?? null,
      bytes: buffer.length,
      checksum: createHash("sha256").update(buffer).digest("hex"),
    };
  } catch {
    return { corrupted: true };
  }
}

function qualityWarningsToLabels(codes: PhotoQualityWarningCode[]): string[] {
  return codes.map((code) => PHOTO_QUALITY_WARNING_LABELS[code]);
}

async function downloadPhotoBufferOnce(
  url: string,
): Promise<
  | { buffer: Buffer; contentType: string; status: number }
  | { error: string; validationStatus?: PhotoValidationStatus; status: number | null; retryable: boolean }
> {
  if (url.startsWith("local://")) {
    try {
      const { readFile } = await import("node:fs/promises");
      const localPath = url.replace("local://", "");
      const buffer = await readFile(localPath);
      return { buffer, contentType: "image/jpeg", status: 200 };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Local photo read failed",
        status: null,
        retryable: false,
      };
    }
  }

  const downloadUrl = resolvePhotoDownloadUrl(url);
  try {
    const res = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(PHOTO_DOWNLOAD_TIMEOUT_MS),
      headers: { "User-Agent": "BidWar-BMW/2.0" },
    });
    if (!res.ok) {
      const validationStatus: PhotoValidationStatus =
        res.status === 403 || res.status === 401 ? "private" : "broken";
      return {
        error: `Photo download failed (${res.status})`,
        validationStatus,
        status: res.status,
        retryable: isRetryableDownloadError(res.status),
      };
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      if (contentType.includes("text/html")) {
        return {
          error: "Google Drive file is private or requires sign-in",
          validationStatus: "private",
          status: res.status,
          retryable: false,
        };
      }
      return {
        error: "URL did not return an image",
        validationStatus: "not_image",
        status: res.status,
        retryable: false,
      };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > MAX_DOWNLOAD_BYTES) {
      return {
        error: "Photo exceeds download size limit",
        status: res.status,
        retryable: false,
      };
    }
    return { buffer, contentType, status: res.status };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Photo download failed",
      validationStatus: "broken",
      status: null,
      retryable: isRetryableDownloadError(null, err),
    };
  }
}

export async function downloadPhotoBuffer(
  url: string,
): Promise<
  | { buffer: Buffer; contentType: string; retryCount: number }
  | { error: string; validationStatus?: PhotoValidationStatus; retryCount: number; retryable: boolean }
> {
  let retryCount = 0;
  for (let attempt = 0; attempt <= MAX_DOWNLOAD_RETRIES; attempt++) {
    const result = await downloadPhotoBufferOnce(url);
    if ("buffer" in result) {
      return { ...result, retryCount };
    }
    if (result.retryable && attempt < MAX_DOWNLOAD_RETRIES) {
      retryCount++;
      await sleep(INITIAL_RETRY_BACKOFF_MS * 2 ** attempt);
      continue;
    }
    return {
      error: result.error,
      validationStatus: result.validationStatus,
      retryCount,
      retryable: result.retryable,
    };
  }
  return { error: "Photo download failed after retries", retryCount, retryable: true };
}

export async function validatePhotoLink(url: string): Promise<PhotoLinkValidation> {
  const trimmed = url.trim();
  if (!trimmed) {
    return { url: trimmed, status: "skipped", message: "Empty photo URL" };
  }
  if (isStableCloudinaryPhotoUrl(trimmed)) {
    return { url: trimmed, status: "skipped", message: "Already on Cloudinary" };
  }
  if (!isPhotoUrl(trimmed)) {
    return { url: trimmed, status: "unsupported", message: "URL format not supported for photo import" };
  }
  if (trimmed.startsWith("local://")) {
    return { url: trimmed, status: "accessible", message: "Local media file" };
  }

  const downloadUrl = resolvePhotoDownloadUrl(trimmed);
  try {
    const res = await fetch(downloadUrl, {
      method: "GET",
      headers: {
        "User-Agent": "BidWar-BMW/2.0",
        Range: "bytes=0-4095",
      },
      signal: AbortSignal.timeout(PHOTO_VALIDATION_TIMEOUT_MS),
    });
    const contentType = res.headers.get("content-type") ?? "";
    const sample = res.ok ? (await res.text()).slice(0, 512) : "";
    const status = classifyHttpPhotoResponse(res.status, contentType, sample);
    const messages: Record<PhotoValidationStatus, string> = {
      accessible: "Photo is accessible",
      private: "Google Drive file is private or requires sign-in",
      broken: `Photo link unavailable (${res.status || "network error"})`,
      not_image: "URL did not return an image",
      unsupported: "Unsupported photo URL",
      skipped: "Skipped",
    };

    const base: PhotoLinkValidation = { url: trimmed, status, message: messages[status] };
    if (status !== "accessible") return base;

    const downloaded = await downloadPhotoBuffer(trimmed);
    if ("error" in downloaded) return base;

    const metadata = await extractPhotoMetadata(downloaded.buffer);
    if ("corrupted" in metadata) {
      return {
        ...base,
        qualityWarnings: [PHOTO_QUALITY_WARNING_LABELS.corrupted_image],
      };
    }

    const qualityCodes = validateImageQuality(metadata, downloaded.contentType);
    if (qualityCodes.includes("invalid_image")) {
      qualityCodes.push("corrupted_image");
    }

    return {
      ...base,
      qualityWarnings: qualityWarningsToLabels(qualityCodes),
      width: metadata.width ?? undefined,
      height: metadata.height ?? undefined,
      format: metadata.format ?? undefined,
      bytes: metadata.bytes,
    };
  } catch (err) {
    return {
      url: trimmed,
      status: "broken",
      message: err instanceof Error ? err.message : "Photo validation failed",
    };
  }
}

export async function validatePhotoLinks(urls: string[]): Promise<{
  summary: PhotoValidationSummary;
  results: PhotoLinkValidation[];
}> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))];
  const results = await mapWithConcurrency(unique, PHOTO_VALIDATION_CONCURRENCY, validatePhotoLink);

  const summary: PhotoValidationSummary = {
    found: unique.length,
    accessible: 0,
    private: 0,
    broken: 0,
    notImage: 0,
    unsupported: 0,
    skipped: 0,
    qualityWarnings: 0,
  };

  for (const r of results) {
    switch (r.status) {
      case "accessible": summary.accessible++; break;
      case "private": summary.private++; break;
      case "broken": summary.broken++; break;
      case "not_image": summary.notImage++; break;
      case "unsupported": summary.unsupported++; break;
      case "skipped": summary.skipped++; break;
    }
    if (r.qualityWarnings?.length) summary.qualityWarnings += r.qualityWarnings.length;
  }

  return { summary, results };
}

export async function normalizePlayerPhotoBuffer(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer, { failOn: "none" })
    .rotate()
    .resize(PLAYER_PHOTO_WIDTH, PLAYER_PHOTO_HEIGHT, {
      fit: "cover",
      position: "attention",
    })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

export type PhotoImportResult = {
  originalUrl: string;
  storedUrl: string | null;
  publicId: string | null;
  originalStoredUrl?: string | null;
  originalPublicId?: string | null;
  originalWidth?: number | null;
  originalHeight?: number | null;
  originalBytes?: number | null;
  originalFormat?: string | null;
  originalFileName?: string | null;
  sourceType?: string;
  driveFileId?: string | null;
  downloadedAt?: Date;
  qualityWarnings?: string[];
  warning?: string;
  validationStatus?: PhotoValidationStatus;
  reused?: boolean;
  reusedFromCacheId?: number;
  retryCount?: number;
  retryable?: boolean;
  checksum?: string;
};

function mapCacheToResult(url: string, cache: CachedPhotoAsset): PhotoImportResult {
  return {
    originalUrl: url,
    storedUrl: cache.standardUrl,
    publicId: cache.standardPublicId,
    originalStoredUrl: cache.originalUrl,
    originalPublicId: cache.originalPublicId,
    originalWidth: cache.originalWidth,
    originalHeight: cache.originalHeight,
    originalBytes: cache.originalBytes,
    originalFormat: cache.originalFormat,
    downloadedAt: cache.downloadedAt,
    validationStatus: "accessible",
    reused: true,
    reusedFromCacheId: cache.id,
  };
}

function inferUploadFormat(format: string | null, contentType: string): string | undefined {
  const normalized = (format ?? contentType.replace("image/", "")).toLowerCase();
  if (normalized === "jpg") return "jpg";
  if (["jpeg", "png", "webp", "gif"].includes(normalized)) return normalized;
  return undefined;
}

export async function importPhotoFromUrl(
  url: string,
  folder = STANDARD_PHOTO_FOLDER,
): Promise<PhotoImportResult> {
  const trimmed = url.trim();
  if (isStableCloudinaryPhotoUrl(trimmed)) {
    return {
      originalUrl: url,
      storedUrl: trimmed,
      publicId: parseCloudinaryPublicIdFromUrl(trimmed),
      validationStatus: "skipped",
    };
  }

  const adapter = getPhotoSourceAdapter(trimmed);
  const sourceKey = adapter.sourceKey(trimmed);

  const cacheModule = await import("./photo-source-cache.ts");
  const cachedByKey = await cacheModule.findCachedPhotoBySourceKey(sourceKey);
  if (cachedByKey) {
    return {
      ...mapCacheToResult(url, cachedByKey),
      sourceType: adapter.type,
      driveFileId: adapter.extractSourceId(trimmed),
      originalFileName: extractOriginalFileName(trimmed),
    };
  }

  const downloaded = await downloadPhotoBuffer(trimmed);
  if ("error" in downloaded) {
    return {
      originalUrl: url,
      storedUrl: null,
      publicId: null,
      warning: downloaded.error,
      validationStatus: downloaded.validationStatus ?? "broken",
      retryCount: downloaded.retryCount,
      retryable: downloaded.retryable,
    };
  }

  const metadata = await extractPhotoMetadata(downloaded.buffer);
  if ("corrupted" in metadata) {
    return {
      originalUrl: url,
      storedUrl: null,
      publicId: null,
      warning: "Corrupted or invalid image file",
      validationStatus: "broken",
      qualityWarnings: [PHOTO_QUALITY_WARNING_LABELS.corrupted_image],
      retryCount: downloaded.retryCount,
    };
  }

  const cachedByChecksum = await cacheModule.findCachedPhotoByChecksum(metadata.checksum);
  if (cachedByChecksum) {
    return {
      ...mapCacheToResult(url, cachedByChecksum),
      sourceType: adapter.type,
      driveFileId: adapter.extractSourceId(trimmed),
      originalFileName: extractOriginalFileName(trimmed),
      checksum: metadata.checksum,
      retryCount: downloaded.retryCount,
    };
  }

  const qualityCodes = validateImageQuality(metadata, downloaded.contentType);
  const qualityWarnings = qualityWarningsToLabels(
    qualityCodes.includes("invalid_image") ? [...qualityCodes, "corrupted_image"] : qualityCodes,
  );

  const downloadedAt = new Date();
  const originalFileName = extractOriginalFileName(trimmed);
  const uploadFormat = inferUploadFormat(metadata.format, downloaded.contentType);

  try {
    const originalUploaded = await uploadBufferToCloudinary(downloaded.buffer, {
      folder: ORIGINAL_PHOTO_FOLDER,
      resourceType: "image",
      ...(uploadFormat ? { format: uploadFormat } : {}),
    });

    const normalized = await normalizePlayerPhotoBuffer(downloaded.buffer);
    const standardUploaded = await uploadBufferToCloudinary(normalized, {
      folder,
      resourceType: "image",
      format: "webp",
    });

    await cacheModule.upsertCachedPhoto({
      sourceKey,
      sourceType: adapter.type,
      driveFileId: adapter.extractSourceId(trimmed),
      checksum: metadata.checksum,
      originalSourceUrl: trimmed,
      originalFileName,
      originalUrl: originalUploaded.url,
      originalPublicId: originalUploaded.publicId,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      originalBytes: metadata.bytes,
      originalFormat: metadata.format,
      standardUrl: standardUploaded.url,
      standardPublicId: standardUploaded.publicId,
      downloadedAt,
      processingVersion: PHOTO_PROCESSING_VERSION,
    });

    return {
      originalUrl: url,
      storedUrl: standardUploaded.url,
      publicId: standardUploaded.publicId,
      originalStoredUrl: originalUploaded.url,
      originalPublicId: originalUploaded.publicId,
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      originalBytes: metadata.bytes,
      originalFormat: metadata.format,
      originalFileName,
      sourceType: adapter.type,
      driveFileId: adapter.extractSourceId(trimmed),
      downloadedAt,
      qualityWarnings: qualityWarnings.length > 0 ? qualityWarnings : undefined,
      validationStatus: "accessible",
      checksum: metadata.checksum,
      retryCount: downloaded.retryCount,
    };
  } catch (err) {
    return {
      originalUrl: url,
      storedUrl: null,
      publicId: null,
      warning: err instanceof Error ? err.message : "Photo import failed",
      validationStatus: "broken",
      qualityWarnings: qualityWarnings.length > 0 ? qualityWarnings : undefined,
      retryCount: downloaded.retryCount,
    };
  }
}

export function applyPhotoImportResultsToRows(
  rows: Record<string, unknown>[],
  results: Map<string, PhotoImportResult>,
  photoColumns: string[],
): void {
  for (const row of rows) {
    for (const col of photoColumns) {
      const url = row[col];
      if (url == null || url === "") continue;
      const result = results.get(`${col}:${String(url)}`);
      if (result?.storedUrl) row[col] = result.storedUrl;
    }
  }
}

export async function importPhotosFromRows(
  rows: Record<string, unknown>[],
  photoColumns: string[],
): Promise<Map<string, PhotoImportResult>> {
  const pending = new Map<string, string>();
  for (const row of rows) {
    for (const col of photoColumns) {
      const url = row[col];
      if (!isPhotoUrl(url)) continue;
      const key = `${col}:${String(url)}`;
      if (!pending.has(key)) pending.set(key, String(url));
    }
  }

  const entries = [...pending.entries()];
  const imported = await mapWithConcurrency(entries, PHOTO_IMPORT_CONCURRENCY, async ([key, url]) => {
    const result = await importPhotoFromUrl(url);
    return [key, result] as const;
  });

  return new Map(imported);
}

export { mapWithConcurrency, PHOTO_IMPORT_CONCURRENCY };
