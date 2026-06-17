import { useState, useEffect } from "react";

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
  backgroundColor: "#080A0F",
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

/**
 * useBranding — reads global BidWar branding from /api/branding.
 * Falls back to BRANDING_DEFAULTS when the row has not been customised yet.
 * Intended for use across public-facing screens (viewer, owner app, display).
 */
export function useBranding() {
  const [settings, setSettings] = useState<BrandingSettings>(BRANDING_DEFAULTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/branding")
      .then(r => (r.ok ? r.json() : null))
      .then((data: BrandingSettings | null) => {
        if (data) setSettings({ ...BRANDING_DEFAULTS, ...data });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return {
    loading,
    raw: settings,
    brandName: settings.brandName,
    tagline: settings.tagline,
    poweredByText: settings.poweredByText,
    miniBrandText: settings.miniBrandText,
    logos: {
      main: settings.mainLogoUrl,
      mainReverse: settings.mainLogoReverseUrl,
      mini: settings.miniLogoUrl,
      appIcon: settings.appIconUrl,
      splash: settings.splashScreenUrl,
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
