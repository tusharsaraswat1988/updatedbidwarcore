/**
 * Download remote photos during TMW import.
 * Failures produce warnings — never block the entire import.
 */

import { uploadBufferToCloudinary } from "../cloudinary-media-service.ts";

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

/** Convert Google Drive share links to direct download */
export function resolvePhotoDownloadUrl(url: string): string {
  const trimmed = url.trim();
  const driveMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (driveMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveMatch[1]}`;
  }
  const driveOpenMatch = trimmed.match(/[?&]id=([^&]+)/);
  if (trimmed.includes("drive.google.com") && driveOpenMatch) {
    return `https://drive.google.com/uc?export=download&id=${driveOpenMatch[1]}`;
  }
  if (trimmed.includes("dropbox.com")) {
    return trimmed.replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "?dl=1");
  }
  return trimmed;
}

export type PhotoImportResult = {
  originalUrl: string;
  storedUrl: string | null;
  publicId: string | null;
  warning?: string;
};

export async function importPhotoFromUrl(url: string, folder = "bidwar/workbook"): Promise<PhotoImportResult> {
  if (url.startsWith("local://")) {
    try {
      const { readFile } = await import("node:fs/promises");
      const localPath = url.replace("local://", "");
      const buffer = await readFile(localPath);
      const uploaded = await uploadBufferToCloudinary(buffer, { folder, resourceType: "image" });
      return { originalUrl: url, storedUrl: uploaded.url, publicId: uploaded.publicId };
    } catch (err) {
      return {
        originalUrl: url,
        storedUrl: null,
        publicId: null,
        warning: err instanceof Error ? err.message : "Local photo import failed",
      };
    }
  }

  const downloadUrl = resolvePhotoDownloadUrl(url);
  try {
    const res = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(30_000),
      headers: { "User-Agent": "BidWar-BMW/2.0" },
    });
    if (!res.ok) {
      return { originalUrl: url, storedUrl: null, publicId: null, warning: `Photo download failed (${res.status})` };
    }
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    if (!contentType.startsWith("image/")) {
      return { originalUrl: url, storedUrl: null, publicId: null, warning: "URL did not return an image" };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) {
      return { originalUrl: url, storedUrl: null, publicId: null, warning: "Photo exceeds 5MB limit" };
    }
    const uploaded = await uploadBufferToCloudinary(buffer, {
      folder,
      resourceType: "image",
    });
    return { originalUrl: url, storedUrl: uploaded.url, publicId: uploaded.publicId };
  } catch (err) {
    return {
      originalUrl: url,
      storedUrl: null,
      publicId: null,
      warning: err instanceof Error ? err.message : "Photo import failed",
    };
  }
}

export async function importPhotosFromRows(
  rows: Record<string, unknown>[],
  photoColumns: string[],
): Promise<Map<string, PhotoImportResult>> {
  const results = new Map<string, PhotoImportResult>();
  for (const row of rows) {
    for (const col of photoColumns) {
      const url = row[col];
      if (!isPhotoUrl(url)) continue;
      const key = `${col}:${String(url)}`;
      if (results.has(key)) continue;
      results.set(key, await importPhotoFromUrl(String(url)));
    }
  }
  return results;
}
