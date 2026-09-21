import { BRANDING_ICON_PATHS } from "@workspace/api-base/branding-assets";

/** PWA manifest for Super Admin install (Add to Home Screen). */
export const ADMIN_MANIFEST_HREF = "/admin.webmanifest";

/** PWA manifest for Scorer Console install (Add to Home Screen). */
export const SCORER_MANIFEST_HREF = "/scoring-app/manifest.webmanifest";

export function isAdminPwaRoute(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export function isScorerPwaRoute(pathname: string): boolean {
  const p = pathname.split("?")[0] || "";
  return (
    p.startsWith("/scoring-app") ||
    p === "/cricket/scorer" ||
    p.startsWith("/cricket/scorer/") ||
    /^\/cricket\/[^/]+\/score\/?$/.test(p) ||
    p === "/badminton/scorer" ||
    p.startsWith("/badminton/scorer/") ||
    /^\/badminton\/[^/]+\/score\/?$/.test(p)
  );
}

type BrandLogos = {
  main?: string | null;
  mini?: string | null;
  appIcon?: string | null;
  favicon?: string | null;
  pwaIcon?: string | null;
  appleTouchIcon?: string | null;
  splash?: string | null;
  obsWatermark?: string | null;
};

/** Append branding asset version for browser cache busting. */
export function withIconVersion(path: string, version?: number | null): string {
  if (!version || version <= 0) return path;
  return `${path}?v=${version}`;
}

/** Canonical resolver paths — always serve latest DB branding without code changes. */
export function resolvePwaIconUrl(_logos?: BrandLogos, version?: number | null): string {
  return withIconVersion(BRANDING_ICON_PATHS.favicon32, version);
}

export function resolveAppleTouchIconUrl(_logos?: BrandLogos, version?: number | null): string {
  return withIconVersion(BRANDING_ICON_PATHS.appleTouchIcon, version);
}

/** SPLASH_LOGO → PRIMARY_LOGO → SYMBOL_LOGO */
export function resolveSplashLogoUrl(logos: BrandLogos): string | null {
  return logos.splash ?? logos.main ?? logos.mini ?? null;
}

/** OBS_WATERMARK → SYMBOL_LOGO → PRIMARY_LOGO (caller adds appIcon fallback via getBrandLogoSrc) */
export function resolveObsWatermarkUrl(logos: BrandLogos): string | null {
  return logos.obsWatermark ?? logos.mini ?? logos.main ?? null;
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>): void {
  let selector = `link[rel="${rel}"]`;
  if (extra?.sizes) selector += `[sizes="${extra.sizes}"]`;
  if (extra?.type) selector += `[type="${extra.type}"]`;

  let link = document.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    if (extra?.sizes) link.sizes = extra.sizes;
    if (extra?.type) link.type = extra.type;
    link.href = href;
    document.head.appendChild(link);
    return;
  }
  if (link.getAttribute("href") !== href) {
    link.setAttribute("href", href);
  }
}

let lastAppliedPwaKey = "";

/** Apply favicon, apple-touch-icon, and manifest link for PWA install surfaces. */
export function applyPwaHeadBranding(_logos: BrandLogos, manifestHref: string, iconVersion?: number | null): void {
  const v = iconVersion && iconVersion > 0 ? iconVersion : null;
  const key = `${v ?? 0}:${manifestHref}`;
  if (lastAppliedPwaKey === key) return;
  lastAppliedPwaKey = key;

  upsertLink("icon", withIconVersion(BRANDING_ICON_PATHS.faviconIco, v), { sizes: "any" });
  upsertLink("icon", withIconVersion(BRANDING_ICON_PATHS.faviconSvg, v), { type: "image/svg+xml" });
  upsertLink("icon", withIconVersion(BRANDING_ICON_PATHS.favicon32, v), { sizes: "32x32", type: "image/png" });

  const appleSrc = resolveAppleTouchIconUrl(undefined, iconVersion);
  upsertLink("apple-touch-icon", appleSrc, { sizes: "180x180" });
  upsertLink("manifest", manifestHref);
}
