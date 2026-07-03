import { useHomeInitialData } from "./initial-data-provider";
import { brandingSettingsToLogos } from "./branding-from-payload";
import { useBranding } from "@/hooks/use-branding";

/** Prefer SSR snapshot for first paint; fall back to live useBranding(). */
export function usePublicBranding() {
  const homeInitial = useHomeInitialData();
  const branding = useBranding();

  if (homeInitial?.branding) {
    const settings = homeInitial.branding;
    return {
      loading: false,
      brandName: settings.brandName,
      logos: brandingSettingsToLogos(settings),
      iconVersion: settings.iconVersion ?? 0,
      colors: {
        primary: settings.primaryColor,
        secondary: settings.secondaryColor,
        accent: settings.accentColor,
        background: settings.backgroundColor,
        success: settings.successColor,
        danger: settings.dangerColor,
      },
    };
  }

  return {
    loading: branding.loading,
    brandName: branding.brandName,
    logos: branding.logos,
    iconVersion: branding.iconVersion,
    colors: branding.colors,
  };
}
