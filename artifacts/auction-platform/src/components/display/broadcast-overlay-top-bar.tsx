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
  BROADCAST_OVERLAY_TOP_INSET_Y,
  BROADCAST_OVERLAY_TOP_LOGO_HEIGHT,
  BROADCAST_OVERLAY_TOP_ROW_HEIGHT,
  BROADCAST_OVERLAY_TOURNAMENT_INSET_X,
  BROADCAST_OVERLAY_TOURNAMENT_LOGO_HEIGHT,
  BROADCAST_OVERLAY_TOURNAMENT_LOGO_MAX_WIDTH,
  BROADCAST_OVERLAY_TOURNAMENT_NAME_GAP,
} from "@/lib/broadcast-overlay";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
} from "@/lib/bidwar-broadcast-colors";

const LOGO_DROP_SHADOW = "drop-shadow(0 2px 10px rgba(0,0,0,0.55))";

/** Centered tournament name — solid plate for OBS / camera readability. */
function BroadcastTournamentTitle({ name }: { name: string }) {
  return (
    <div
      style={{
        marginTop: BROADCAST_OVERLAY_TOURNAMENT_NAME_GAP + 4,
        display: "flex",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 12,
          maxWidth: "min(820px, 100%)",
          padding: "6px 28px",
          backgroundColor: "rgba(0, 0, 0, 0.94)",
          border: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
          borderTop: `2px solid ${BIDWAR_BROADCAST_YELLOW}`,
          boxShadow: "0 6px 28px rgba(0, 0, 0, 0.82)",
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 28,
            height: 1,
            backgroundColor: BIDWAR_BROADCAST_YELLOW,
            opacity: 0.85,
          }}
        />
        <p
          style={{
            margin: 0,
            minWidth: 0,
            flex: "1 1 auto",
            fontFamily: "'Bebas Neue', 'Arial Narrow', sans-serif",
            fontSize: 18,
            letterSpacing: "0.11em",
            textTransform: "uppercase",
            textAlign: "center",
            color: "#ffffff",
            lineHeight: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {name}
        </p>
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 28,
            height: 1,
            backgroundColor: BIDWAR_BROADCAST_YELLOW,
            opacity: 0.85,
          }}
        />
      </div>
    </div>
  );
}

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
  const { logos, brandName, iconVersion } = useBranding();
  const bidwarSrc = getObsBroadcastLogoSrc(logos, iconVersion);
  const bidwarAlt = getBrandLogoAlt(brandName);
  const logoH = BROADCAST_OVERLAY_TOP_LOGO_HEIGHT;
  const title = tournamentName?.trim();

  return (
    <div
      aria-label="Broadcast top logos"
      style={{
        position: "absolute",
        top: BROADCAST_OVERLAY_TOP_INSET_Y,
        left: BROADCAST_OVERLAY_TOURNAMENT_INSET_X,
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
            height: BROADCAST_OVERLAY_TOURNAMENT_LOGO_HEIGHT,
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
                height: BROADCAST_OVERLAY_TOURNAMENT_LOGO_HEIGHT,
                maxWidth: BROADCAST_OVERLAY_TOURNAMENT_LOGO_MAX_WIDTH,
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

      {title ? <BroadcastTournamentTitle name={title} /> : null}
    </div>
  );
});

/** @deprecated Use BroadcastOverlayTopBar */
export const BroadcastOverlayTopFrame = BroadcastOverlayTopBar;
