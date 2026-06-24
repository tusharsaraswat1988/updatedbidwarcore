import { memo } from "react";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getObsBrandMarkSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import {
  BROADCAST_OVERLAY_BRAND_Z_INDEX,
} from "@/lib/broadcast-overlay";

const obsOverlayPreset = getBrandSurfacePreset("obs-overlay");

/**
 * Permanent top-center brand mark for the Broadcast Overlay.
 * Sized below sponsor carousel logos; stays inside the action-safe inset.
 */
export const BroadcastOverlayBrandMark = memo(function BroadcastOverlayBrandMark() {
  const { logos, brandName } = useBranding();
  const logoAlt = getBrandLogoAlt(brandName);
  const logoSrc = cldUrl(logos.obsWatermark ?? logos.mini, "headerLogo") || getObsBrandMarkSrc(logos);

  return (
    <div
      style={{
        position: "relative",
        zIndex: BROADCAST_OVERLAY_BRAND_Z_INDEX,
        display: "flex",
        alignItems: "center",
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.07)",
        pointerEvents: "none",
      }}
      aria-label={logoAlt}
    >
      <img
        src={logoSrc}
        alt={logoAlt}
        className={obsOverlayPreset.sizeClass}
        style={{ flexShrink: 0 }}
        loading="eager"
        decoding="async"
      />
    </div>
  );
});
