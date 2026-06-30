import { BRANDING_ICON_PATHS } from "@workspace/api-base/branding-assets";

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

export function resolvePwaIconUrl(_logos?: BrandLogos): string {
  return BRANDING_ICON_PATHS.favicon32;
}

export function resolveAppleTouchIconUrl(_logos?: BrandLogos): string {
  return BRANDING_ICON_PATHS.appleTouchIcon;
}

/** SPLASH_LOGO → REVERSE → PRIMARY → SYMBOL on dark owner surfaces */
export function resolveSplashLogoUrl(logos: BrandLogos): string | null {
  return logos.splash ?? logos.mainReverse ?? logos.main ?? logos.mini ?? null;
}

export function applyPwaHeadBranding(_logos: BrandLogos, manifestHref = "/owner-app/manifest.webmanifest"): void {
  const faviconSrc = resolvePwaIconUrl();
  const appleSrc = resolveAppleTouchIconUrl();

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
