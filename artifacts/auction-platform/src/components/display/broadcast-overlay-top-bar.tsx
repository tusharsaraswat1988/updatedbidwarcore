import { memo } from "react";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getObsBroadcastLogoSrc } from "@/lib/brand-assets";
import { SponsorCarousel } from "@/components/display/sponsor-carousel";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  BROADCAST_OVERLAY_BRAND_Z_INDEX,
  BROADCAST_OVERLAY_CORNER_INSET_X,
  BROADCAST_OVERLAY_OBS_LOGO_MAX_WIDTH,
  BROADCAST_OVERLAY_TOP_LOGO_HEIGHT,
  BROADCAST_OVERLAY_TOP_ROW_HEIGHT,
  BROADCAST_OVERLAY_TOURNAMENT_NAME_GAP,
} from "@/lib/broadcast-overlay";

const LOGO_DROP_SHADOW = "drop-shadow(0 2px 10px rgba(0,0,0,0.55))";

/**
 * Single top row — tournament, BidWar, and sponsor logos share the same baseline.
 */
export const BroadcastOverlayTopBar = memo(function BroadcastOverlayTopBar({
  tournamentLogoUrl,
  tournamentName,
  sponsorLogos,
}: {
  tournamentLogoUrl?: string | null;
  tournamentName?: string | null;
  sponsorLogos: SponsorLogo[];
}) {
  const { logos, brandName } = useBranding();
  const bidwarSrc = getObsBroadcastLogoSrc(logos);
  const bidwarAlt = getBrandLogoAlt(brandName);
  const logoH = BROADCAST_OVERLAY_TOP_LOGO_HEIGHT;
  const title = tournamentName?.trim();

  return (
    <div
      aria-label="Broadcast top logos"
      style={{
        position: "absolute",
        top: 0,
        left: BROADCAST_OVERLAY_CORNER_INSET_X,
        right: BROADCAST_OVERLAY_CORNER_INSET_X,
        zIndex: BROADCAST_OVERLAY_BRAND_Z_INDEX,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: BROADCAST_OVERLAY_TOP_ROW_HEIGHT,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
      <div
        style={{
          flex: "1 1 0",
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          height: logoH,
        }}
      >
        {tournamentLogoUrl ? (
          <img
            src={cldUrl(tournamentLogoUrl, "headerLogo")}
            alt=""
            loading="eager"
            decoding="async"
            style={{
              display: "block",
              height: logoH,
              maxWidth: 200,
              width: "auto",
              objectFit: "contain",
              objectPosition: "left center",
              borderRadius: 12,
              filter: LOGO_DROP_SHADOW,
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          flex: "0 0 auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: logoH,
          lineHeight: 0,
          fontSize: 0,
        }}
      >
        {bidwarSrc ? (
          <img
            src={bidwarSrc}
            alt={bidwarAlt}
            loading="eager"
            decoding="async"
            style={{
              display: "block",
              maxHeight: logoH,
              maxWidth: BROADCAST_OVERLAY_OBS_LOGO_MAX_WIDTH,
              width: "auto",
              height: "auto",
              margin: 0,
              padding: 0,
              objectFit: "contain",
              objectPosition: "center center",
              filter: LOGO_DROP_SHADOW,
            }}
          />
        ) : null}
      </div>

      <div
        style={{
          flex: "1 1 0",
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          justifyContent: "flex-start",
          overflow: "visible",
        }}
      >
        {sponsorLogos.length > 0 ? (
          <SponsorCarousel logos={sponsorLogos} overlay overlayLogoRow />
        ) : null}
      </div>
      </div>

      {title ? (
        <p
          style={{
            margin: 0,
            marginTop: BROADCAST_OVERLAY_TOURNAMENT_NAME_GAP,
            padding: 0,
            textAlign: "center",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.72)",
            lineHeight: 1.2,
            maxWidth: "100%",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textShadow: "0 1px 8px rgba(0,0,0,0.75)",
          }}
        >
          {title}
        </p>
      ) : null}
    </div>
  );
});

/** @deprecated Use BroadcastOverlayTopBar */
export const BroadcastOverlayTopFrame = BroadcastOverlayTopBar;
