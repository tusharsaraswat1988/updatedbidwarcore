import type { BrandingSettings } from "@/hooks/use-branding";

const CACHE_KEY = "bidwar:branding:v1";

export function readBrandingCache(): BrandingSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BrandingSettings;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeBrandingCache(settings: BrandingSettings): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(settings));
  } catch {
    /* quota / private mode */
  }
}

export function brandingCacheSignature(settings: BrandingSettings): string {
  const assets = settings.assets ?? {};
  return JSON.stringify({
    brandName: settings.brandName,
    poweredByText: settings.poweredByText,
    mainLogoUrl: settings.mainLogoUrl,
    mainLogoReverseUrl: settings.mainLogoReverseUrl,
    miniLogoUrl: settings.miniLogoUrl,
    appIconUrl: settings.appIconUrl,
    splashScreenUrl: settings.splashScreenUrl,
    logoAnimationUrl: settings.logoAnimationUrl,
    assets,
  });
}
