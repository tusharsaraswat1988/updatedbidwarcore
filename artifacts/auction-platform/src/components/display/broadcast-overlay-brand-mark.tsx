import { memo } from "react";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import {
  BROADCAST_OVERLAY_BRAND_LOGO_HEIGHT,
  BROADCAST_OVERLAY_BRAND_Z_INDEX,
  BIDWAR_TICKER_CREDIT,
} from "@/lib/broadcast-overlay";

/**
 * Permanent top-left brand mark for the Broadcast Overlay.
 * Sized below sponsor carousel logos; stays inside the action-safe inset.
 */
export const BroadcastOverlayBrandMark = memo(function BroadcastOverlayBrandMark() {
  const { logos, brandName, poweredByText } = useBranding();
  const credit = poweredByText?.trim() || BIDWAR_TICKER_CREDIT;

  return (
    <div
      style={{
        position: "relative",
        zIndex: BROADCAST_OVERLAY_BRAND_Z_INDEX,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 8,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(10px)",
        border: "1px solid rgba(255,255,255,0.07)",
        pointerEvents: "none",
      }}
      aria-label={credit}
    >
      <img
        src={cldUrl(logos.mini, "headerLogo") || "/bidwar-logo-transparent.webp"}
        alt={brandName}
        style={{
          height: BROADCAST_OVERLAY_BRAND_LOGO_HEIGHT,
          width: "auto",
          objectFit: "contain",
          flexShrink: 0,
        }}
        loading="eager"
        decoding="async"
      />
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "rgba(255,255,255,0.55)",
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
      >
        {credit}
      </span>
    </div>
  );
});
