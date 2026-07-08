import { db } from "@workspace/db";
import { brandingSettingsTable } from "@workspace/db/schema";
import { BRANDING_ICON_PATHS } from "@workspace/api-base/branding-assets";
import { getBrandingIconCacheVersion } from "./branding-asset-resolver.js";

const PLATFORM_BASE_URL = "https://bidwar.in";

/** Absolute URL for a canonical icon path, cache-busted by branding asset version. */
async function canonicalManifestIconUrl(
  path: string,
  baseUrl = PLATFORM_BASE_URL,
): Promise<string> {
  const version = await getBrandingIconCacheVersion();
  const suffix = version > 0 ? `?v=${version}` : "";
  return `${baseUrl}${path}${suffix}`;
}

/** Same-origin icon path for PWA manifests (works on cloud and LAN). */
async function relativeManifestIconUrl(path: string): Promise<string> {
  const version = await getBrandingIconCacheVersion();
  const suffix = version > 0 ? `?v=${version}` : "";
  return `${path}${suffix}`;
}

export async function buildAuctionPlatformManifest(): Promise<Record<string, unknown>> {
  const [settings] = await db.select().from(brandingSettingsTable).limit(1);
  const icon192 = await canonicalManifestIconUrl(BRANDING_ICON_PATHS.pwaIcon192);
  const icon512 = await canonicalManifestIconUrl(BRANDING_ICON_PATHS.pwaIcon512);
  const brandName = settings?.brandName?.trim() || "BidWar";
  const themeColor = settings?.backgroundColor?.trim() || "#09090b";

  return {
    name: `${brandName} — Live Sports Auction`,
    short_name: brandName,
    description: "India's professional live sports auction platform for cricket, football & franchise leagues.",
    start_url: "/",
    display: "standalone",
    background_color: themeColor,
    theme_color: themeColor,
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}

export async function buildAdminAppManifest(): Promise<Record<string, unknown>> {
  const [settings] = await db.select().from(brandingSettingsTable).limit(1);
  const icon192 = await relativeManifestIconUrl(BRANDING_ICON_PATHS.pwaIcon192);
  const icon512 = await relativeManifestIconUrl(BRANDING_ICON_PATHS.pwaIcon512);
  const brandName = settings?.brandName?.trim() || "BidWar";
  const themeColor = settings?.backgroundColor?.trim() || "#09090b";

  return {
    id: "/admin/",
    name: `${brandName} Admin`,
    short_name: `${brandName} Admin`,
    description: "Super Admin panel for tournament and platform management",
    theme_color: themeColor,
    background_color: themeColor,
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    scope: "/admin",
    start_url: "/admin/login",
    prefer_related_applications: false,
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
  };
}

export async function buildOwnerAppManifest(): Promise<Record<string, unknown>> {
  const [settings] = await db.select().from(brandingSettingsTable).limit(1);
  const icon192 = await relativeManifestIconUrl(BRANDING_ICON_PATHS.pwaIcon192);
  const icon512 = await relativeManifestIconUrl(BRANDING_ICON_PATHS.pwaIcon512);
  const brandName = settings?.brandName?.trim() || "BidWar";
  const themeColor = settings?.backgroundColor?.trim() || "#09090b";

  return {
    name: `${brandName} Owner`,
    short_name: brandName,
    description: "Live auction bidding for team owners",
    theme_color: themeColor,
    background_color: themeColor,
    display: "standalone",
    orientation: "any",
    scope: "/owner-app/",
    start_url: "/owner-app/",
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
