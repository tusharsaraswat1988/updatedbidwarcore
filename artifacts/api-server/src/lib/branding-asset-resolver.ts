/**
 * Serves Google/browser-canonical favicon URLs from BrandingService assets.
 * Keeps paths like /favicon.ico and /favicon-32x32.png stable while content
 * updates when admins upload new branding in the admin panel.
 */
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { Express, Request, Response } from "express";
import type { BrandingAssetType } from "@workspace/api-base/branding-assets";
import {
  ALL_BRANDING_ICON_PATHS,
  ALL_BRANDING_LOGO_PATHS,
  BRANDING_ASSET_TYPES,
  BRANDING_ICON_PATHS,
  BRANDING_LOGO_PATHS,
  BRANDING_LOGO_STATIC_FALLBACKS,
  type BrandingIconPath,
  type BrandingLogoPath,
} from "@workspace/api-base/branding-assets";
import { buildBrandingIconHeadLinks } from "@workspace/api-base/branding-icon-head";
import { getAsset } from "./branding-service.js";
import { fetchImageBuffer } from "./pdf-branding.js";
import { patchBrandingIconsInCachedHtml } from "./html-meta-injector.js";
import { logger } from "./logger.js";

const FAVICON_CHAIN: BrandingAssetType[] = ["FAVICON", "PWA_ICON", "SYMBOL_LOGO", "PRIMARY_LOGO"];
const APPLE_CHAIN: BrandingAssetType[] = ["APPLE_TOUCH_ICON", "PWA_ICON", "FAVICON", "SYMBOL_LOGO"];
const PWA_ICON_CHAIN: BrandingAssetType[] = ["PWA_ICON", "APPLE_TOUCH_ICON", "FAVICON", "SYMBOL_LOGO"];
const SVG_CHAIN: BrandingAssetType[] = ["FAVICON", "SYMBOL_LOGO", "PRIMARY_LOGO", "PWA_ICON"];
const PRIMARY_LOGO_CHAIN: BrandingAssetType[] = ["PRIMARY_LOGO", "SYMBOL_LOGO", "PWA_ICON"];
const REVERSE_LOGO_CHAIN: BrandingAssetType[] = ["REVERSE_LOGO", "PRIMARY_LOGO", "SYMBOL_LOGO"];

let staticPublicRoot: string | null = null;

function resolveStaticPublicRoot(): string | null {
  if (staticPublicRoot) return staticPublicRoot;
  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(moduleDir, "../../auction-platform/dist/public");
  return existsSync(dist) ? dist : null;
}

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

function loadStaticLogoFallback(logoPath: BrandingLogoPath): IconCacheEntry | null {
  const publicRoot = resolveStaticPublicRoot();
  if (!publicRoot) return null;
  const relative = BRANDING_LOGO_STATIC_FALLBACKS[logoPath]?.replace(/^\//, "");
  if (!relative) return null;

  const absolute = path.join(publicRoot, relative);
  if (!existsSync(absolute)) return null;

  try {
    const buffer = readFileSync(absolute);
    const key = `static:${logoPath}`;
    const entry: IconCacheEntry = {
      buffer,
      etag: `"${key}"`,
      mimeType: "image/png",
    };
    bufferCache.set(key, entry);
    return entry;
  } catch {
    return null;
  }
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
    case BRANDING_ICON_PATHS.pwaIcon192:
    case BRANDING_ICON_PATHS.pwaIcon512:
      return resolveFromChain(PWA_ICON_CHAIN);
    case BRANDING_LOGO_PATHS.primary:
      return resolveFromChain(PRIMARY_LOGO_CHAIN);
    case BRANDING_LOGO_PATHS.reverse:
      return resolveFromChain(REVERSE_LOGO_CHAIN);
    default:
      return null;
  }
}

/** Highest asset version across all branding uploads — used for cache-busting link hrefs. */
export async function getBrandingIconCacheVersion(): Promise<number> {
  let maxVersion = 0;
  for (const type of BRANDING_ASSET_TYPES) {
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

async function serveBrandingAsset(
  req: Request,
  res: Response,
  assetPath: BrandingIconPath | BrandingLogoPath,
): Promise<void> {
  const resolved = await resolveBrandingIconForPath(assetPath);
  let entry = resolved ? await loadIconBuffer(resolved) : null;
  let contentType = resolved?.mimeType ?? "image/png";

  if (resolved && assetPath in BRANDING_ICON_PATHS) {
    contentType = contentTypeForPath(assetPath as BrandingIconPath, resolved);
  }

  if (!entry && (assetPath === BRANDING_LOGO_PATHS.primary || assetPath === BRANDING_LOGO_PATHS.reverse)) {
    entry = loadStaticLogoFallback(assetPath);
    contentType = "image/png";
  }

  if (!entry) {
    res.status(resolved ? 502 : 404).end();
    return;
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  res.setHeader("ETag", entry.etag);

  if (req.headers["if-none-match"] === entry.etag) {
    res.status(304).end();
    return;
  }

  res.send(entry.buffer);
}

export function registerBrandingIconRoutes(app: Express, publicRoot?: string): void {
  staticPublicRoot = publicRoot ?? staticPublicRoot;
  for (const assetPath of ALL_BRANDING_ICON_PATHS) {
    app.get(assetPath, (req, res) => {
      void serveBrandingAsset(req, res, assetPath);
    });
  }
  for (const assetPath of ALL_BRANDING_LOGO_PATHS) {
    app.get(assetPath, (req, res) => {
      void serveBrandingAsset(req, res, assetPath);
    });
  }
}
