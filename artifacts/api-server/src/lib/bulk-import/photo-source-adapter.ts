/**
 * Pluggable photo source adapters — swap provider without changing the pipeline.
 * Currently: Google Drive. Future: Dropbox, OneDrive, direct URL, Google Photos.
 */

import { createHash } from "node:crypto";

export type PhotoSourceType = "google_drive" | "dropbox" | "onedrive" | "direct_url" | "cloudinary" | "local";

export interface PhotoSourceAdapter {
  type: PhotoSourceType;
  canHandle(url: string): boolean;
  resolveDownloadUrl(url: string): string;
  extractSourceId(url: string): string | null;
  sourceKey(url: string): string;
  extractFileName?(url: string): string | null;
}

function sha256Key(input: string): string {
  return createHash("sha256").update(input.toLowerCase()).digest("hex").slice(0, 32);
}

export const googleDriveAdapter: PhotoSourceAdapter = {
  type: "google_drive",
  canHandle(url) {
    return /drive\.google\.com/i.test(url) || /googleusercontent\.com/i.test(url);
  },
  resolveDownloadUrl(url) {
    const trimmed = url.trim();
    const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (fileMatch) {
      return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
    }
    const openMatch = trimmed.match(/[?&]id=([^&]+)/);
    if (trimmed.includes("drive.google.com") && openMatch) {
      return `https://drive.google.com/uc?export=download&id=${openMatch[1]}`;
    }
    return trimmed;
  },
  extractSourceId(url) {
    const trimmed = url.trim();
    const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (fileMatch) return fileMatch[1]!;
    const openMatch = trimmed.match(/[?&]id=([^&]+)/);
    if (trimmed.includes("drive.google.com") && openMatch) return openMatch[1]!;
    return null;
  },
  sourceKey(url) {
    const id = googleDriveAdapter.extractSourceId(url);
    return id ? `drive:${id}` : `url:${sha256Key(url.trim())}`;
  },
  extractFileName(url) {
    const trimmed = url.trim();
    const nameMatch = trimmed.match(/\/file\/d\/[^/]+\/([^/?#]+)/);
    return nameMatch?.[1] ?? null;
  },
};

export const dropboxAdapter: PhotoSourceAdapter = {
  type: "dropbox",
  canHandle(url) {
    return /dropbox\.com/i.test(url) || /dropboxusercontent\.com/i.test(url);
  },
  resolveDownloadUrl(url) {
    return url.trim().replace("www.dropbox.com", "dl.dropboxusercontent.com").replace("?dl=0", "?dl=1");
  },
  extractSourceId(url) {
    const match = url.trim().match(/dropbox\.com\/(?:s|scl\/fi)\/([^/?#]+)/);
    return match?.[1] ?? null;
  },
  sourceKey(url) {
    const id = dropboxAdapter.extractSourceId(url);
    return id ? `dropbox:${id}` : `url:${sha256Key(url.trim())}`;
  },
};

export const onedriveAdapter: PhotoSourceAdapter = {
  type: "onedrive",
  canHandle(url) {
    return /onedrive\.live\.com/i.test(url) || /sharepoint\.com/i.test(url);
  },
  resolveDownloadUrl(url) {
    return url.trim();
  },
  extractSourceId(url) {
    const match = url.trim().match(/[?&]id=([^&]+)/);
    return match?.[1] ?? null;
  },
  sourceKey(url) {
    const id = onedriveAdapter.extractSourceId(url);
    return id ? `onedrive:${id}` : `url:${sha256Key(url.trim())}`;
  },
};

export const cloudinaryAdapter: PhotoSourceAdapter = {
  type: "cloudinary",
  canHandle(url) {
    return /res\.cloudinary\.com\//i.test(url.trim());
  },
  resolveDownloadUrl(url) {
    return url.trim();
  },
  extractSourceId(url) {
    return null;
  },
  sourceKey(url) {
    return `cloudinary:${url.trim().toLowerCase()}`;
  },
};

export const localAdapter: PhotoSourceAdapter = {
  type: "local",
  canHandle(url) {
    return url.trim().startsWith("local://");
  },
  resolveDownloadUrl(url) {
    return url.trim();
  },
  extractSourceId(url) {
    return url.trim().replace("local://", "");
  },
  sourceKey(url) {
    return `local:${sha256Key(url.trim())}`;
  },
  extractFileName(url) {
    const path = url.trim().replace("local://", "");
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] ?? null;
  },
};

export const directUrlAdapter: PhotoSourceAdapter = {
  type: "direct_url",
  canHandle(url) {
    const trimmed = url.trim();
    return /^https?:\/\//i.test(trimmed) && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(trimmed);
  },
  resolveDownloadUrl(url) {
    return url.trim();
  },
  extractSourceId(url) {
    return null;
  },
  sourceKey(url) {
    return `url:${sha256Key(url.trim())}`;
  },
  extractFileName(url) {
    try {
      const pathname = new URL(url.trim()).pathname;
      const parts = pathname.split("/");
      return parts[parts.length - 1] || null;
    } catch {
      return null;
    }
  },
};

const ADAPTERS: PhotoSourceAdapter[] = [
  localAdapter,
  cloudinaryAdapter,
  googleDriveAdapter,
  dropboxAdapter,
  onedriveAdapter,
  directUrlAdapter,
];

export function getPhotoSourceAdapter(url: string): PhotoSourceAdapter {
  const trimmed = url.trim();
  for (const adapter of ADAPTERS) {
    if (adapter.canHandle(trimmed)) return adapter;
  }
  return directUrlAdapter;
}

export function resolvePhotoDownloadUrl(url: string): string {
  return getPhotoSourceAdapter(url).resolveDownloadUrl(url);
}

export function photoSourceKey(url: string): string {
  return getPhotoSourceAdapter(url).sourceKey(url);
}

export function extractDriveFileId(url: string): string | null {
  if (!googleDriveAdapter.canHandle(url)) return null;
  return googleDriveAdapter.extractSourceId(url);
}

export function extractOriginalFileName(url: string): string | null {
  const adapter = getPhotoSourceAdapter(url);
  return adapter.extractFileName?.(url) ?? null;
}
