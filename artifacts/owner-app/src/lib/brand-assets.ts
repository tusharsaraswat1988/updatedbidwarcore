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

const STATIC_FAVICON = "/owner-app/pwa-icon.svg";
const STATIC_APPLE = "/owner-app/pwa-icon-192.png";

export function resolvePwaIconUrl(logos: BrandLogos): string {
  return logos.pwaIcon ?? logos.favicon ?? logos.appIcon ?? STATIC_FAVICON;
}

export function resolveAppleTouchIconUrl(logos: BrandLogos): string {
  return logos.appleTouchIcon ?? logos.pwaIcon ?? logos.favicon ?? logos.appIcon ?? STATIC_APPLE;
}

/** SPLASH_LOGO → REVERSE → PRIMARY → SYMBOL on dark owner surfaces */
export function resolveSplashLogoUrl(logos: BrandLogos): string | null {
  return logos.splash ?? logos.mainReverse ?? logos.main ?? logos.mini ?? null;
}

export function applyPwaHeadBranding(logos: BrandLogos, manifestHref = "/owner-app/manifest.webmanifest"): void {
  const faviconSrc = resolvePwaIconUrl(logos);
  const appleSrc = resolveAppleTouchIconUrl(logos);

  document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]').forEach((link) => {
    link.href = faviconSrc;
  });

  document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]').forEach((link) => {
    link.href = appleSrc;
  });

  let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!manifest) {
    manifest = document.createElement("link");
    manifest.rel = "manifest";
    document.head.appendChild(manifest);
  }
  manifest.href = manifestHref;
}
