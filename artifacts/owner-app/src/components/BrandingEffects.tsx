import { useEffect } from "react";
import { useBranding } from "@/hooks/useBranding";
import { applyPwaHeadBranding } from "@/lib/brand-assets";

/** Sync favicon, apple-touch-icon, and manifest from BrandingService assets. */
export function BrandingEffects() {
  const { logos, iconVersion } = useBranding();

  useEffect(() => {
    applyPwaHeadBranding(logos, "/owner-app/manifest.webmanifest", iconVersion);
  }, [logos.favicon, logos.pwaIcon, logos.appleTouchIcon, logos.appIcon, iconVersion]);

  return null;
}
