import { useState, useEffect } from "react";

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

export function useBranding() {
  const [settings, setSettings] = useState<BrandingSettings>(BRANDING_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/branding")
      .then(r => (r.ok ? r.json() : null))
      .then((data: Partial<BrandingSettings> | null) => {
        if (data) setSettings({ ...BRANDING_DEFAULTS, ...data });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return {
    loading,
    brandName: settings.brandName,
    poweredByText: settings.poweredByText,
    miniBrandText: settings.miniBrandText,
    logos: {
      main: settings.mainLogoUrl,
      mainReverse: settings.mainLogoReverseUrl,
      mini: settings.miniLogoUrl,
      appIcon: settings.appIconUrl,
      splash: settings.splashScreenUrl,
    },
    showPoweredBy: settings.showPoweredByOwnerApp,
  };
}
