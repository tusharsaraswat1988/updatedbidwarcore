/**
 * Shared Cloudinary media helpers (safe for browser + server).
 * Prefer stored public_id; parse URLs only as backward-compatibility fallback.
 */

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
}

export interface StoredCloudinaryImage {
  url?: string | null;
  publicId?: string | null;
}

/** BidWar upload folders — only assets under these may be auto-deleted. */
export const BIDWAR_CLOUDINARY_ROOT_FOLDERS = [
  "bidwar",
] as const;

const TRANSFORMATION_SEGMENT = /^[a-z0-9_,.-]+$/i;

/**
 * Parse a Cloudinary public_id from a delivery URL (fallback when public_id
 * was not persisted). Returns null for non-Cloudinary or unparseable URLs.
 */
export function parseCloudinaryPublicIdFromUrl(
  url: string | null | undefined,
): string | null {
  if (!url?.trim()) return null;
  if (!url.includes("res.cloudinary.com/")) return null;

  const uploadMarker = "/upload/";
  const markerIndex = url.indexOf(uploadMarker);
  if (markerIndex === -1) return null;

  let path = url.slice(markerIndex + uploadMarker.length).split("?")[0] ?? "";
  path = path.replace(/\.[^/.]+$/, "");
  if (!path) return null;

  const segments = path.split("/").filter(Boolean);
  while (segments.length > 0 && /^v\d+$/.test(segments[0]!)) {
    segments.shift();
  }

  while (
    segments.length > 1
    && TRANSFORMATION_SEGMENT.test(segments[0]!)
    && !segments[0]!.includes(".")
    && (segments[0]!.includes(",") || segments[0]!.includes("_"))
  ) {
    segments.shift();
  }

  const publicId = segments.join("/");
  return publicId || null;
}

export function resolveCloudinaryPublicId(
  image: StoredCloudinaryImage | null | undefined,
): string | null {
  const fromColumn = image?.publicId?.trim();
  if (fromColumn) return fromColumn;
  return parseCloudinaryPublicIdFromUrl(image?.url);
}

export function isBidWarManagedPublicId(publicId: string | null | undefined): boolean {
  if (!publicId?.trim()) return false;
  const normalized = publicId.trim();
  return BIDWAR_CLOUDINARY_ROOT_FOLDERS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  );
}

export function normalizeCloudinaryImageUrl(
  url: string | null | undefined,
): string | null {
  const trimmed = url?.trim();
  return trimmed ? trimmed : null;
}

export function cloudinaryImagesEqual(
  a: StoredCloudinaryImage | null | undefined,
  b: StoredCloudinaryImage | null | undefined,
): boolean {
  const aUrl = normalizeCloudinaryImageUrl(a?.url);
  const bUrl = normalizeCloudinaryImageUrl(b?.url);
  if (aUrl && bUrl) return aUrl === bUrl;
  const aId = resolveCloudinaryPublicId(a);
  const bId = resolveCloudinaryPublicId(b);
  return !!aId && aId === bId;
}

/**
 * Platform wordmark delivery — enough pixels for retina headers (~168 CSS px),
 * auto format (WebP/AVIF), best quality. Used when redirecting stable logo paths.
 */
export const CLOUDINARY_BRAND_WORDMARK_TRANSFORM = "w_1120,c_limit,f_auto,q_auto:best";

/** Inject a Cloudinary transformation segment after `/upload/` (no-op for non-CDN URLs). */
export function withCloudinaryTransform(
  url: string,
  transform: string = CLOUDINARY_BRAND_WORDMARK_TRANSFORM,
): string {
  if (!url.includes("res.cloudinary.com/") || !url.includes("/upload/")) return url;
  if (url.includes(transform)) return url;
  return url.replace("/upload/", `/upload/${transform}/`);
}
