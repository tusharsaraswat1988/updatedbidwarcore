/**
 * Serves Google/browser-canonical favicon URLs from BrandingService assets.
 * Keeps paths like /favicon.ico and /favicon-32x32.png stable while content
 * updates when admins upload new branding in the admin panel.
 */
import type { Express, Request, Response } from "express";
import type { BrandingAssetType } from "@workspace/api-base/branding-assets";
import {
  ALL_BRANDING_ICON_PATHS,
  BRANDING_ICON_PATHS,
  type BrandingIconPath,
} from "@workspace/api-base/branding-assets";
import { buildBrandingIconHeadLinks } from "@workspace/api-base/branding-icon-head";
import { getAsset } from "./branding-service.js";
import { fetchImageBuffer } from "./pdf-branding.js";
import { patchBrandingIconsInCachedHtml } from "./html-meta-injector.js";
import { logger } from "./logger.js";

const FAVICON_CHAIN: BrandingAssetType[] = ["FAVICON", "PWA_ICON", "SYMBOL_LOGO", "PRIMARY_LOGO"];
const APPLE_CHAIN: BrandingAssetType[] = ["APPLE_TOUCH_ICON", "PWA_ICON", "FAVICON", "SYMBOL_LOGO"];
const SVG_CHAIN: BrandingAssetType[] = ["FAVICON", "SYMBOL_LOGO", "PRIMARY_LOGO", "PWA_ICON"];

export interface ResolvedBrandingIcon {
  assetType: BrandingAssetType;
  fileUrl: string;
  mimeType: string;
  version: number;
}

interface IconCacheEntry {
  buffer: Buffer;
  etag: string;
  mimeType: string;
}

let faviconVersion = 0;
const bufferCache = new Map<string, IconCacheEntry>();

function guessMimeType(url: string, stored: string | null | undefined): string {
  if (stored) return stored;
  const lower = url.toLowerCase();
  if (lower.includes(".svg")) return "image/svg+xml";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".ico")) return "image/x-icon";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  return "image/png";
}

function isSvgAsset(url: string, mimeType: string | null | undefined): boolean {
  return mimeType?.includes("svg") === true || url.toLowerCase().includes(".svg");
}

function contentTypeForPath(path: BrandingIconPath, resolved: ResolvedBrandingIcon): string {
  if (path === BRANDING_ICON_PATHS.faviconIco) {
    return resolved.mimeType.includes("svg") ? "image/svg+xml" : "image/png";
  }
  if (path === BRANDING_ICON_PATHS.faviconSvg) {
    return "image/svg+xml";
  }
  return resolved.mimeType;
}

async function resolveFromChain(
  chain: BrandingAssetType[],
  options?: { preferSvg?: boolean; allowNonSvg?: boolean },
): Promise<ResolvedBrandingIcon | null> {
  for (const assetType of chain) {
    const asset = await getAsset(assetType);
    if (!asset?.fileUrl) continue;

    const svg = isSvgAsset(asset.fileUrl, asset.mimeType);
    if (options?.preferSvg && !svg) continue;
    if (options?.preferSvg === false && svg && !options.allowNonSvg) continue;

    return {
      assetType,
      fileUrl: asset.fileUrl,
      mimeType: guessMimeType(asset.fileUrl, asset.mimeType),
      version: asset.version,
    };
  }
  return null;
}

export async function resolveBrandingIconForPath(
  pathname: string,
): Promise<ResolvedBrandingIcon | null> {
  switch (pathname) {
    case BRANDING_ICON_PATHS.faviconIco:
    case BRANDING_ICON_PATHS.favicon32:
    case BRANDING_ICON_PATHS.favicon32x32:
      return resolveFromChain(FAVICON_CHAIN);
    case BRANDING_ICON_PATHS.faviconSvg:
      return (
        (await resolveFromChain(SVG_CHAIN, { preferSvg: true })) ??
        (await resolveFromChain(FAVICON_CHAIN, { allowNonSvg: true }))
      );
    case BRANDING_ICON_PATHS.appleTouchIcon:
      return resolveFromChain(APPLE_CHAIN);
    default:
      return null;
  }
}

/** Highest favicon version across the fallback chain — used for cache-busting link hrefs. */
export async function getBrandingIconCacheVersion(): Promise<number> {
  let maxVersion = 0;
  for (const type of new Set([...FAVICON_CHAIN, ...APPLE_CHAIN])) {
    const asset = await getAsset(type);
    if (asset?.version && asset.version > maxVersion) {
      maxVersion = asset.version;
    }
  }
  return maxVersion;
}

/** Synchronous read of the last refreshed favicon cache version (for HTML injection). */
export function getCachedFaviconVersion(): number {
  return faviconVersion;
}

export { buildBrandingIconHeadLinks };

export async function refreshBrandingIconCache(): Promise<void> {
  bufferCache.clear();
  faviconVersion = await getBrandingIconCacheVersion();
  patchBrandingIconsInCachedHtml(faviconVersion);
  logger.info({ faviconVersion }, "Branding: icon resolver cache refreshed");
}

async function loadIconBuffer(resolved: ResolvedBrandingIcon): Promise<IconCacheEntry | null> {
  const key = `${resolved.assetType}:v${resolved.version}`;
  const cached = bufferCache.get(key);
  if (cached) return cached;

  const buffer = await fetchImageBuffer(resolved.fileUrl);
  if (!buffer) return null;

  const entry: IconCacheEntry = {
    buffer,
    etag: `"${key}"`,
    mimeType: resolved.mimeType,
  };
  bufferCache.set(key, entry);
  return entry;
}

async function serveBrandingIcon(req: Request, res: Response, path: BrandingIconPath): Promise<void> {
  const resolved = await resolveBrandingIconForPath(path);
  if (!resolved) {
    res.status(404).end();
    return;
  }

  const entry = await loadIconBuffer(resolved);
  if (!entry) {
    res.status(502).end();
    return;
  }

  res.setHeader("Content-Type", contentTypeForPath(path, resolved));
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.setHeader("ETag", entry.etag);

  if (req.headers["if-none-match"] === entry.etag) {
    res.status(304).end();
    return;
  }

  res.send(entry.buffer);
}

export function registerBrandingIconRoutes(app: Express): void {
  for (const path of ALL_BRANDING_ICON_PATHS) {
    app.get(path, (req, res) => {
      void serveBrandingIcon(req, res, path);
    });
  }
}
