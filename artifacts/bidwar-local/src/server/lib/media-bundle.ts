import { createHash } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { extname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const DOWNLOAD_TIMEOUT_MS = 15_000;

function extFromUrl(url: string): string | null {
  try {
    const pathname = new URL(url).pathname;
    const ext = extname(pathname).toLowerCase();
    if (/^\.(jpe?g|png|webp|gif|svg|ico)$/.test(ext)) return ext;
    if (url.includes("res.cloudinary.com")) {
      if (/\.svg/i.test(pathname)) return ".svg";
      return ".png";
    }
  } catch { /* ignore */ }
  return null;
}

async function downloadToFile(url: string, destPath: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok || !res.body) return false;
    await pipeline(Readable.fromWeb(res.body as import("node:stream/web").ReadableStream), createWriteStream(destPath));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Download remote media URLs into `mediaDir` and return a map of original URL → `/media/{file}`.
 * Skips URLs that are already local paths or fail to download (original URL kept).
 */
export async function bundleMediaUrls(
  mediaDir: string,
  urls: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const unique = new Set<string>();
  for (const raw of urls) {
    if (!raw || raw.startsWith("/media/")) continue;
    if (!/^https?:\/\//i.test(raw)) continue;
    unique.add(raw);
  }
  if (unique.size === 0) return map;

  if (!existsSync(mediaDir)) mkdirSync(mediaDir, { recursive: true });

  for (const url of unique) {
    const hash = createHash("sha256").update(url).digest("hex").slice(0, 16);
    const urlExt = extFromUrl(url) ?? ".png";
    const destPath = `${mediaDir}/${hash}${urlExt}`;
    const publicPath = `/media/${hash}${urlExt}`;
    if (existsSync(destPath)) {
      map.set(url, publicPath);
      continue;
    }
    const ok = await downloadToFile(url, destPath);
    if (ok) map.set(url, publicPath);
  }

  return map;
}

export function rewriteUrl(
  url: string | null | undefined,
  map: Map<string, string>,
): string | null {
  if (!url) return null;
  return map.get(url) ?? url;
}

export function rewriteSponsorLogos(
  sponsorLogos: string | null | undefined,
  map: Map<string, string>,
): string | null {
  if (!sponsorLogos) return null;
  try {
    const parsed = JSON.parse(sponsorLogos) as unknown;
    if (!Array.isArray(parsed)) return sponsorLogos;
    const updated = parsed.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const row = entry as { url?: string };
      if (!row.url) return entry;
      return { ...row, url: rewriteUrl(row.url, map) ?? row.url };
    });
    return JSON.stringify(updated);
  } catch {
    return sponsorLogos;
  }
}

export function urlsFromSponsorLogos(sponsorLogos: string | null | undefined): string[] {
  if (!sponsorLogos) return [];
  try {
    const parsed = JSON.parse(sponsorLogos) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((s) => (s && typeof s === "object" && "url" in s ? String((s as { url?: string }).url ?? "") : ""))
      .filter((u) => u.length > 0);
  } catch {
    return [];
  }
}

/** Collect remote URLs from a branding export payload (top-level + assets map). */
export function collectBrandingMediaUrls(branding: Record<string, unknown>): string[] {
  const urls: string[] = [];
  for (const value of Object.values(branding)) {
    if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.push(value);
  }
  const assets = branding.assets;
  if (assets && typeof assets === "object" && !Array.isArray(assets)) {
    for (const value of Object.values(assets as Record<string, unknown>)) {
      if (typeof value === "string" && /^https?:\/\//i.test(value)) urls.push(value);
    }
  }
  return urls;
}

/** Rewrite all http(s) logo URLs in branding, including nested `assets`. */
export function rewriteBrandingPayload(
  branding: Record<string, unknown>,
  map: Map<string, string>,
): Record<string, unknown> {
  const rw = (url: string | null | undefined) => rewriteUrl(url, map);
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(branding)) {
    if (key === "assets" && value && typeof value === "object" && !Array.isArray(value)) {
      const rewritten: Record<string, string> = {};
      for (const [assetType, assetUrl] of Object.entries(value as Record<string, unknown>)) {
        if (typeof assetUrl === "string") {
          rewritten[assetType] = rw(assetUrl) ?? assetUrl;
        }
      }
      out.assets = rewritten;
    } else if (typeof value === "string" && /^https?:\/\//i.test(value)) {
      out[key] = rw(value) ?? value;
    } else {
      out[key] = value;
    }
  }
  return out;
}
