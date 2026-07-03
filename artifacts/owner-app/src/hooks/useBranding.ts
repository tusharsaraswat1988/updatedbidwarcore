import { useState, useEffect, useRef } from "react";
import type { BrandingAssetType } from "@workspace/api-base/branding-assets";

export interface BrandingSettings {
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
  showPoweredByOwnerApp: boolean;
  assets?: Partial<Record<BrandingAssetType, string>>;
  iconVersion?: number;
}

export const BRANDING_DEFAULTS: BrandingSettings = {
  brandName: "BidWar",
  tagline: null,
  poweredByText: "Powered by BidWar",
  miniBrandText: "BW",
  mainLogoUrl: null,
  mainLogoReverseUrl: null,
  miniLogoUrl: null,
  appIconUrl: null,
  splashScreenUrl: null,
  primaryColor: "#F59E0B",
  showPoweredByOwnerApp: true,
};

function resolveAsset(
  assets: Partial<Record<BrandingAssetType, string>> | undefined,
  type: BrandingAssetType,
  legacy: string | null | undefined,
): string | null {
  return assets?.[type] ?? legacy ?? null;
}

const BRANDING_POLL_MS = 30_000;

export function useBranding() {
  const [settings, setSettings] = useState<BrandingSettings>(BRANDING_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const iconVersionRef = useRef(settings.iconVersion ?? 0);

  useEffect(() => {
    let cancelled = false;

    const fetchBranding = () =>
      fetch("/api/branding", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: Partial<BrandingSettings> | null) => {
          if (!data || cancelled) return;
          setSettings({ ...BRANDING_DEFAULTS, ...data });
          iconVersionRef.current = data.iconVersion ?? iconVersionRef.current;
        });

    void fetchBranding()
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const poll = window.setInterval(() => {
      fetch("/api/branding/icon-version", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((payload: { version?: number } | null) => {
          if (cancelled || !payload) return;
          const nextVersion = payload.version ?? 0;
          if (nextVersion > iconVersionRef.current) {
            iconVersionRef.current = nextVersion;
            void fetchBranding();
          }
        })
        .catch(() => {});
    }, BRANDING_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, []);

  const assets = settings.assets;

  return {
    loading,
    iconVersion: settings.iconVersion ?? 0,
    brandName: settings.brandName,
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
      obsWatermark: resolveAsset(assets, "OBS_WATERMARK", null),
    },
    showPoweredBy: settings.showPoweredByOwnerApp,
  };
}
