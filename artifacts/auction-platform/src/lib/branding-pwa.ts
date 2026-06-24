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

const STATIC_FAVICON = "/favicon-32.png";
const STATIC_APPLE = "/apple-touch-icon.png";

export function resolvePwaIconUrl(logos: BrandLogos): string {
  return logos.pwaIcon ?? logos.favicon ?? logos.appIcon ?? STATIC_FAVICON;
}

export function resolveAppleTouchIconUrl(logos: BrandLogos): string {
  return logos.appleTouchIcon ?? logos.pwaIcon ?? logos.favicon ?? logos.appIcon ?? STATIC_APPLE;
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
export function applyPwaHeadBranding(logos: BrandLogos, manifestHref: string): void {
  const faviconSrc = resolvePwaIconUrl(logos);
  const appleSrc = resolveAppleTouchIconUrl(logos);

  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"], link[rel="shortcut icon"]').forEach((link) => {
    link.href = faviconSrc;
  });

  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = appleSrc;
  });

  if (!document.querySelector('link[rel="apple-touch-icon"]')) {
    upsertLink("apple-touch-icon", appleSrc, { sizes: "180x180" });
  }

  upsertLink("manifest", manifestHref);
}
