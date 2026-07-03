import { cldUrl } from "@/lib/cloudinary";
import { withIconVersion } from "@/lib/branding-pwa";
import {
  PLATFORM_BASE_URL,
  resolvePlatformLogoPathForOrder,
  resolvePlatformPrimaryLogoUrl,
} from "@workspace/api-base/branding-assets";

export type BrandLogos = {
  main?: string | null;
  mainReverse?: string | null;
  mini?: string | null;
  appIcon?: string | null;
  favicon?: string | null;
  pwaIcon?: string | null;
  appleTouchIcon?: string | null;
  openGraph?: string | null;
  obsWatermark?: string | null;
  pdfWatermark?: string | null;
  splash?: string | null;
};

/** Dev-only inline placeholder — never emitted in production builds. */
const DEV_BRAND_FALLBACK_LOGO_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="120" viewBox="0 0 320 120" role="img" aria-label="Brand logo placeholder"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#1f2937"/><stop offset="1" stop-color="#111827"/></linearGradient></defs><rect width="320" height="120" rx="16" fill="url(#g)"/><rect x="10" y="10" width="300" height="100" rx="12" fill="none" stroke="#374151"/><text x="160" y="68" fill="#e5e7eb" font-family="Inter,Arial,sans-serif" font-size="26" text-anchor="middle" font-weight="700">LOGO</text></svg>`,
  );

export const BRAND_LOGO_FALLBACK_TEXT = "BidWar";

export const BRAND_ICON_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="Brand icon placeholder"><rect width="180" height="180" rx="40" fill="#111827"/><circle cx="90" cy="90" r="56" fill="#f59e0b" opacity="0.95"/><text x="90" y="102" fill="#111827" font-family="Inter,Arial,sans-serif" font-size="54" text-anchor="middle" font-weight="800">B</text></svg>`,
  );

export function isBrandLogoPlaceholderSrc(src: string | null | undefined): boolean {
  if (!src) return true;
  return src.startsWith("data:image/svg+xml") && src.includes(">LOGO<");
}

export function getBrandLogoAlt(brandName?: string) {
  const name = brandName?.trim() || "Brand";
  return `${name} logo - live sports auction software`;
}

const WORDMARK_LOGO_KEYS = new Set<keyof BrandLogos>(["main", "mainReverse"]);

function brandLogoPreset(key: keyof BrandLogos): Parameters<typeof cldUrl>[1] {
  if (key === "appIcon" || key === "favicon" || key === "pwaIcon" || key === "appleTouchIcon") return "appIcon";
  if (key === "obsWatermark") return "obsBroadcastLogo";
  if (key === "pdfWatermark") return "headerLogo";
  if (WORDMARK_LOGO_KEYS.has(key as "main" | "mainReverse")) return "brandWordmark";
  return "headerLogo";
}

function resolveProductionLogoFallback(
  order: Array<keyof BrandLogos>,
  iconVersion?: number | null,
): string {
  return resolvePlatformLogoPathForOrder(order, iconVersion);
}

/**
 * Stable platform logo URL for public SEO surfaces (navbar, JSON-LD).
 * Same path on SSR and CSR; content is served by the branding asset resolver.
 */
export function getPublicBrandLogoSrc(
  order: Array<keyof BrandLogos>,
  iconVersion?: number | null,
): string {
  return resolveProductionLogoFallback(order, iconVersion);
}

export function getPublicBrandLogoAbsoluteUrl(
  order: Array<keyof BrandLogos>,
  iconVersion?: number | null,
): string {
  const path = resolveProductionLogoFallback(order, iconVersion);
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${PLATFORM_BASE_URL}${path}`;
}

/** Organization schema logo — matches navbar primary wordmark asset. */
export function getOrganizationLogoUrl(iconVersion?: number | null): string {
  return resolvePlatformPrimaryLogoUrl(PLATFORM_BASE_URL, iconVersion);
}

/** Horizontal main / reverse logo — never forced into a square box. */
export function getBrandWordmarkSrc(
  logos: BrandLogos | undefined,
  order: Array<keyof BrandLogos> = ["mainReverse", "main"],
) {
  for (const key of order) {
    const raw = logos?.[key];
    if (!raw) continue;
    return cldUrl(raw, "brandWordmark") || raw;
  }
  return "";
}

export function getBrandLogoSrc(
  logos: BrandLogos | undefined,
  order: Array<keyof BrandLogos> = ["main", "mainReverse", "mini", "appIcon"],
  iconVersion?: number | null,
) {
  for (const key of order) {
    const raw = logos?.[key];
    if (!raw) continue;
    const transformed = cldUrl(raw, brandLogoPreset(key));
    if (transformed) return transformed;
    if (raw) return raw;
  }

  if (import.meta.env.DEV) {
    return DEV_BRAND_FALLBACK_LOGO_SVG;
  }

  return resolveProductionLogoFallback(order, iconVersion);
}

/** OBS overlay / streaming brand mark: OBS_WATERMARK → SYMBOL → PRIMARY → app icon */
export function getObsBrandMarkSrc(
  logos: BrandLogos | undefined,
  iconVersion?: number | null,
): string {
  const src = getBrandLogoSrc(logos, ["obsWatermark", "mini", "main", "appIcon"], iconVersion);
  if (!src || isBrandLogoPlaceholderSrc(src)) return src;
  return withIconVersion(src, iconVersion);
}

/** Static fallback when admin OBS watermark is not configured. */
export const OBS_BROADCAST_LOGO_FALLBACK =
  "/assets/broadcast/bidwar-reverse-logo-official.png";

/** OBS broadcast overlay top-center — admin PNG only (OBS_WATERMARK). */
export function getObsBroadcastLogoSrc(
  logos: BrandLogos | undefined,
  iconVersion?: number | null,
): string {
  const raw = logos?.obsWatermark;
  if (!raw) return "";
  const url = cldUrl(raw, "obsBroadcastLogo") || raw;
  return withIconVersion(url, iconVersion);
}

/** Splash / loading screens: SPLASH_LOGO → PRIMARY → SYMBOL */
export function getSplashLogoSrc(logos: BrandLogos | undefined, iconVersion?: number | null): string {
  return getBrandLogoSrc(logos, ["splash", "main", "mini", "appIcon"], iconVersion);
}
