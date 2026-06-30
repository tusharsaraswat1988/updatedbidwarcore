import { BRANDING_ICON_PATHS } from "@workspace/api-base/branding-assets";

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
  const selector = extra?.sizes
    ? `link[rel="${rel}"][sizes="${extra.sizes}"]`
    : `link[rel="${rel}"]`;

  let link = document.querySelector<HTMLLinkElement>(selector);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    if (extra?.sizes) link.sizes = extra.sizes;
    if (extra?.type) link.type = extra.type;
    document.head.appendChild(link);
  }
  link.href = href;
}

/** Apply favicon, apple-touch-icon, and manifest link for PWA install surfaces. */
export function applyPwaHeadBranding(_logos: BrandLogos, manifestHref: string, iconVersion?: number | null): void {
  const faviconSrc = resolvePwaIconUrl(undefined, iconVersion);
  const appleSrc = resolveAppleTouchIconUrl(undefined, iconVersion);
  const v = iconVersion && iconVersion > 0 ? iconVersion : null;

  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => {
    link.href = faviconSrc;
  });

  upsertLink("icon", withIconVersion(BRANDING_ICON_PATHS.faviconIco, v), { sizes: "any" });
  upsertLink("icon", withIconVersion(BRANDING_ICON_PATHS.faviconSvg, v), { type: "image/svg+xml" });
  upsertLink("icon", withIconVersion(BRANDING_ICON_PATHS.favicon32, v), { sizes: "32x32", type: "image/png" });
  upsertLink("icon", withIconVersion(BRANDING_ICON_PATHS.favicon32x32, v), { sizes: "32x32", type: "image/png" });

  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = appleSrc;
  });

  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    upsertLink("apple-touch-icon", appleSrc, { sizes: "180x180" });
  }

  upsertLink("manifest", manifestHref);
}
