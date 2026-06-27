import { memo } from "react";
import { useBranding } from "@/hooks/use-branding";
import {
  getBrandLogoAlt,
  getObsBrandMarkSrc,
  getObsBroadcastLogoSrc,
  OBS_BROADCAST_LOGO_FALLBACK,
} from "@/lib/brand-assets";

export const LED_TOP_BRAND_MAX_HEIGHT_PX = 48;
export const LED_TOP_BRAND_MAX_WIDTH_PX = 220;

/** OBS broadcast crest — same asset/position as overlay + main LED top strip. */
export const LedTopBrandMark = memo(function LedTopBrandMark() {
  const { logos, brandName } = useBranding();
  const logoSrc =
    getObsBroadcastLogoSrc(logos) ||
    getObsBrandMarkSrc(logos) ||
    OBS_BROADCAST_LOGO_FALLBACK;

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={getBrandLogoAlt(brandName)}
        className="block w-auto shrink-0 object-contain object-top"
        style={{
          maxHeight: LED_TOP_BRAND_MAX_HEIGHT_PX,
          maxWidth: LED_TOP_BRAND_MAX_WIDTH_PX,
          filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.55))",
        }}
        loading="eager"
        decoding="async"
      />
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5"
      style={{ backgroundColor: "var(--accent)" }}
    >
      <span
        className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
        style={{ color: "var(--accent-on)" }}
      >
        BIDWAR
      </span>
      <span
        className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
        style={{ color: "var(--accent-on)" }}
      >
        LIVE
      </span>
    </div>
  );
});
