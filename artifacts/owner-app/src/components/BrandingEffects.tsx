import { useEffect } from "react";
import { useBranding } from "@/hooks/useBranding";
import { applyPwaHeadBranding } from "@/lib/brand-assets";

/** Sync favicon, apple-touch-icon, and manifest from BrandingService assets. */
export function BrandingEffects() {
  const { logos } = useBranding();

  useEffect(() => {
    applyPwaHeadBranding(logos);
  }, [logos.favicon, logos.pwaIcon, logos.appleTouchIcon, logos.appIcon]);

  return null;
}
