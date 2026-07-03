import { BRANDING_ICON_PATHS, withBrandingAssetVersion } from "@workspace/api-base/branding-assets";

type BrandLogos = {
  main?: string | null;
  mainReverse?: string | null;
  mini?: string | null;
  appIcon?: string | null;
  favicon?: string | null;
  pwaIcon?: string | null;
  appleTouchIcon?: string | null;
  splash?: string | null;
};

export function resolvePwaIconUrl(_logos?: BrandLogos, version?: number | null): string {
  return withBrandingAssetVersion(BRANDING_ICON_PATHS.favicon32, version);
}

export function resolveAppleTouchIconUrl(_logos?: BrandLogos, version?: number | null): string {
  return withBrandingAssetVersion(BRANDING_ICON_PATHS.appleTouchIcon, version);
}

/** SPLASH_LOGO → REVERSE → PRIMARY → SYMBOL on dark owner surfaces */
export function resolveSplashLogoUrl(logos: BrandLogos): string | null {
  return logos.splash ?? logos.mainReverse ?? logos.main ?? logos.mini ?? null;
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

export function applyPwaHeadBranding(
  _logos: BrandLogos,
  manifestHref = "/owner-app/manifest.webmanifest",
  iconVersion?: number | null,
): void {
  const faviconSrc = resolvePwaIconUrl(undefined, iconVersion);
  const appleSrc = resolveAppleTouchIconUrl(undefined, iconVersion);
  const v = iconVersion && iconVersion > 0 ? iconVersion : null;

  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => {
    link.href = faviconSrc;
  });

  upsertLink("icon", withBrandingAssetVersion(BRANDING_ICON_PATHS.faviconIco, v), { sizes: "any" });
  upsertLink("icon", withBrandingAssetVersion(BRANDING_ICON_PATHS.faviconSvg, v), { type: "image/svg+xml" });
  upsertLink("icon", withBrandingAssetVersion(BRANDING_ICON_PATHS.favicon32, v), { sizes: "32x32", type: "image/png" });

  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = appleSrc;
  });

  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    upsertLink("apple-touch-icon", appleSrc, { sizes: "180x180" });
  }

  upsertLink("manifest", manifestHref);
}
