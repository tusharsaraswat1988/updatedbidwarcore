import type { BrandingAssetType } from "@workspace/api-base/branding-assets";
import {
  BRANDING_DEFAULTS,
  type BrandingSettings,
} from "@/hooks/use-branding";

function resolveAsset(
  assets: Partial<Record<BrandingAssetType, string>> | undefined,
  type: BrandingAssetType,
  legacy: string | null | undefined,
): string | null {
  return assets?.[type] ?? legacy ?? null;
}

/** Map public /api/branding JSON into BrandingSettings for cache + UI. */
export function brandingPayloadToSettings(payload: Record<string, unknown>): BrandingSettings {
  const merged = { ...BRANDING_DEFAULTS, ...(payload as BrandingSettings) };
  const assets = merged.assets as Partial<Record<BrandingAssetType, string>> | undefined;

  return {
    ...merged,
    assets,
    iconVersion: typeof merged.iconVersion === "number" ? merged.iconVersion : 0,
  };
}

export function brandingSettingsToLogos(settings: BrandingSettings) {
  const assets = settings.assets;
  return {
    main: resolveAsset(assets, "PRIMARY_LOGO", settings.mainLogoUrl),
    mainReverse: resolveAsset(assets, "REVERSE_LOGO", settings.mainLogoReverseUrl),
    mini: resolveAsset(assets, "SYMBOL_LOGO", settings.miniLogoUrl),
    appIcon: resolveAsset(assets, "PWA_ICON", settings.appIconUrl),
    favicon: resolveAsset(assets, "FAVICON", settings.appIconUrl),
    pwaIcon: resolveAsset(assets, "PWA_ICON", settings.appIconUrl),
    appleTouchIcon: resolveAsset(assets, "APPLE_TOUCH_ICON", settings.appIconUrl),
    splash: resolveAsset(assets, "SPLASH_LOGO", settings.splashScreenUrl),
    openGraph: resolveAsset(assets, "OPEN_GRAPH_IMAGE", null),
    obsWatermark: resolveAsset(assets, "OBS_WATERMARK", null),
    pdfWatermark: resolveAsset(assets, "PDF_WATERMARK", null),
    animation: settings.logoAnimationUrl,
  };
}
