import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BrandingAssetType } from "@workspace/api-base/branding-assets";
import {
  readBrandingCache,
  writeBrandingCache,
} from "@/lib/branding-cache";
import { brandingKeys } from "@/lib/initial-data/query-keys";

export interface BrandingSettings {
  id?: number;
  brandName: string;
  tagline: string | null;
  poweredByText: string;
  miniBrandText: string;
  mainLogoUrl: string | null;
  mainLogoReverseUrl: string | null;
  miniLogoUrl: string | null;
  appIconUrl: string | null;
  splashScreenUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  successColor: string;
  dangerColor: string;
  headingFont: string;
  bodyFont: string;
  showPoweredByViewer: boolean;
  showPoweredByOwnerApp: boolean;
  showBrandingPdf: boolean;
  showBrandingPublicLinks: boolean;
  showBrandingAuction: boolean;
  enableWatermark: boolean;
  watermarkText: string;
  watermarkOpacity: number;
  watermarkPosition: string;
  logoAnimationUrl: string | null;
  assets?: Partial<Record<BrandingAssetType, string>>;
  iconVersion?: number;
}

export const BRANDING_DEFAULTS: BrandingSettings = {
  brandName: "BidWar",
  tagline: "Powered by Intelligent Bidding",
  poweredByText: "Powered by BidWar",
  miniBrandText: "BW",
  mainLogoUrl: null,
  mainLogoReverseUrl: null,
  miniLogoUrl: null,
  appIconUrl: null,
  splashScreenUrl: null,
  primaryColor: "#F59E0B",
  secondaryColor: "#1E293B",
  accentColor: "#3B82F6",
  backgroundColor: "#1E1845",
  successColor: "#22C55E",
  dangerColor: "#EF4444",
  headingFont: "Space Grotesk",
  bodyFont: "Inter",
  showPoweredByViewer: true,
  showPoweredByOwnerApp: true,
  showBrandingPdf: true,
  showBrandingPublicLinks: true,
  showBrandingAuction: true,
  enableWatermark: false,
  watermarkText: "Powered by BidWar",
  watermarkOpacity: 0.15,
  watermarkPosition: "bottom-right",
  logoAnimationUrl: null,
};

function resolveAsset(
  assets: Partial<Record<BrandingAssetType, string>> | undefined,
  type: BrandingAssetType,
  legacy: string | null | undefined,
): string | null {
  return assets?.[type] ?? legacy ?? null;
}

const BRANDING_POLL_MS = 30_000;
export const PUBLIC_BRANDING_STALE_TIME_MS = 5 * 60 * 1000;

export async function fetchPublicBranding(): Promise<BrandingSettings> {
  const res = await fetch("/api/branding");
  if (!res.ok) {
    throw new Error(`Failed to fetch branding: ${res.status}`);
  }
  const data = (await res.json()) as Partial<BrandingSettings>;
  const merged: BrandingSettings = { ...BRANDING_DEFAULTS, ...data };
  writeBrandingCache(merged);
  return merged;
}

async function fetchIconVersion(currentVersion: number): Promise<{ version: number }> {
  try {
    const res = await fetch("/api/branding/icon-version");
    if (!res.ok) return { version: currentVersion };
    const payload = (await res.json()) as { version?: number };
    return { version: payload?.version ?? currentVersion };
  } catch {
    return { version: currentVersion };
  }
}

/**
 * useBranding — reads global BidWar branding from /api/branding via TanStack React Query.
 * All calling components share the cached query result (staleTime 5m).
 * Falls back to BRANDING_DEFAULTS when the row has not been customised yet.
 * Polls icon-version in a single shared query so open LED/OBS screens pick up admin changes without refresh.
 */
export function useBranding() {
  const queryClient = useQueryClient();

  const { data: settings = BRANDING_DEFAULTS, isLoading } = useQuery<BrandingSettings>({
    queryKey: brandingKeys.public,
    queryFn: fetchPublicBranding,
    staleTime: PUBLIC_BRANDING_STALE_TIME_MS,
    initialData: () => {
      const cached = readBrandingCache();
      return cached ? { ...BRANDING_DEFAULTS, ...cached } : undefined;
    },
  });

  const iconVersion = settings.iconVersion ?? 0;

  // Single deduplicated background poll for icon/favicon changes across all components
  const { data: iconData } = useQuery<{ version: number }>({
    queryKey: brandingKeys.iconVersion,
    queryFn: () => fetchIconVersion(iconVersion),
    refetchInterval: BRANDING_POLL_MS,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (iconData?.version !== undefined && iconData.version > iconVersion) {
      void queryClient.invalidateQueries({ queryKey: brandingKeys.public });
    }
  }, [iconData?.version, iconVersion, queryClient]);

  const assets = settings.assets;
  const loading = isLoading && !readBrandingCache();

  return {
    loading,
    raw: settings,
    iconVersion,
    brandName: settings.brandName,
    tagline: settings.tagline,
    poweredByText: settings.poweredByText,
    miniBrandText: settings.miniBrandText,
    logos: {
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
    },
    colors: {
      primary: settings.primaryColor,
      secondary: settings.secondaryColor,
      accent: settings.accentColor,
      background: settings.backgroundColor,
      success: settings.successColor,
      danger: settings.dangerColor,
    },
    fonts: {
      heading: settings.headingFont,
      body: settings.bodyFont,
    },
    visibility: {
      showPoweredByViewer: settings.showPoweredByViewer,
      showPoweredByOwnerApp: settings.showPoweredByOwnerApp,
      showBrandingPdf: settings.showBrandingPdf,
      showBrandingPublicLinks: settings.showBrandingPublicLinks,
      showBrandingAuction: settings.showBrandingAuction,
    },
    watermark: {
      enabled: settings.enableWatermark,
      text: settings.watermarkText,
      opacity: settings.watermarkOpacity,
      position: settings.watermarkPosition,
    },
  };
}
