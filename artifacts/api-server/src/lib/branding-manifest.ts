import { db } from "@workspace/db";
import { brandingSettingsTable } from "@workspace/db/schema";
import { getAsset } from "./branding-service.js";

const PLATFORM_BASE_URL = "https://bidwar.in";

function guessIconType(url: string): string {
  if (url.includes(".svg")) return "image/svg+xml";
  if (url.includes(".webp")) return "image/webp";
  return "image/png";
}

function toAbsoluteIconUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  return `${baseUrl}/${url}`;
}

/** PWA_ICON → FAVICON → static fallback */
export async function resolvePwaIconUrl(baseUrl = PLATFORM_BASE_URL): Promise<string> {
  const pwa = await getAsset("PWA_ICON");
  if (pwa?.fileUrl) return toAbsoluteIconUrl(pwa.fileUrl, baseUrl);

  const favicon = await getAsset("FAVICON");
  if (favicon?.fileUrl) return toAbsoluteIconUrl(favicon.fileUrl, baseUrl);

  return `${baseUrl}/favicon-32.png`;
}

/** APPLE_TOUCH_ICON → PWA_ICON → FAVICON → static fallback */
export async function resolveAppleTouchIconUrl(baseUrl = PLATFORM_BASE_URL): Promise<string> {
  const apple = await getAsset("APPLE_TOUCH_ICON");
  if (apple?.fileUrl) return toAbsoluteIconUrl(apple.fileUrl, baseUrl);

  const pwa = await getAsset("PWA_ICON");
  if (pwa?.fileUrl) return toAbsoluteIconUrl(pwa.fileUrl, baseUrl);

  const favicon = await getAsset("FAVICON");
  if (favicon?.fileUrl) return toAbsoluteIconUrl(favicon.fileUrl, baseUrl);

  return `${baseUrl}/apple-touch-icon.png`;
}

export async function buildAuctionPlatformManifest(): Promise<Record<string, unknown>> {
  const [settings] = await db.select().from(brandingSettingsTable).limit(1);
  const iconUrl = await resolvePwaIconUrl();
  const iconType = guessIconType(iconUrl);
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
      { src: iconUrl, sizes: "192x192", type: iconType, purpose: "any" },
      { src: iconUrl, sizes: "512x512", type: iconType, purpose: "any maskable" },
      { src: iconUrl, sizes: "32x32", type: iconType, purpose: "any" },
    ],
  };
}

export async function buildOwnerAppManifest(): Promise<Record<string, unknown>> {
  const [settings] = await db.select().from(brandingSettingsTable).limit(1);
  const iconUrl = await resolvePwaIconUrl();
  const iconType = guessIconType(iconUrl);
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
      { src: iconUrl, sizes: "192x192", type: iconType, purpose: "any" },
      { src: iconUrl, sizes: "512x512", type: iconType, purpose: "any maskable" },
      { src: iconUrl, sizes: "any", type: iconType, purpose: "any" },
    ],
  };
}
