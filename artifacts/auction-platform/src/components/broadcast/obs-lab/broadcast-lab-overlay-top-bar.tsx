import { memo } from "react";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getObsBroadcastLogoSrc } from "@/lib/brand-assets";
import { SponsorCarousel } from "@/components/display/sponsor-carousel";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  BROADCAST_OVERLAY_BRAND_Z_INDEX,
  BROADCAST_OVERLAY_CORNER_INSET_X,
  BROADCAST_OVERLAY_TOURNAMENT_INSET_X,
} from "@/lib/broadcast-overlay";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_BORDER,
} from "@/lib/bidwar-broadcast-colors";
import { OBS_LAB_FONTS } from "./obs-tokens";

const LOGO_DROP_SHADOW = "drop-shadow(0 2px 8px rgba(0,0,0,0.5))";

const LAB_TOP_INSET = 6;
const LAB_LOGO_H = 44;
const LAB_TOURNAMENT_LOGO_H = 52;
const LAB_TOURNAMENT_LOGO_MAX_W = 200;
const LAB_BIDWAR_MAX_W = 320;

/** Compact tournament title — less vertical chrome for camera. */
function LabTournamentTitle({ name }: { name: string }) {
  return (
    <div
      style={{
        marginTop: 2,
        display: "flex",
        justifyContent: "center",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 10,
          maxWidth: "min(720px, 100%)",
          padding: "4px 20px",
          backgroundColor: "rgba(0, 0, 0, 0.88)",
          border: `1px solid ${BIDWAR_BROADCAST_YELLOW_BORDER}`,
          borderTop: `2px solid ${BIDWAR_BROADCAST_YELLOW}`,
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.7)",
        }}
      >
        <span
          aria-hidden
          style={{
            flexShrink: 0,
            width: 20,
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
            fontFamily: OBS_LAB_FONTS.display,
            fontSize: 16,
            letterSpacing: "0.1em",
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
            width: 20,
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
 * Lab-only top chrome — smaller logos / tighter title so more of the camera shows.
 */
export const BroadcastLabOverlayTopBar = memo(function BroadcastLabOverlayTopBar({
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
  const title = tournamentName?.trim();

  return (
    <div
      aria-label="Broadcast lab top logos"
      style={{
        position: "absolute",
        top: LAB_TOP_INSET,
        left: BROADCAST_OVERLAY_TOURNAMENT_INSET_X,
        right: BROADCAST_OVERLAY_CORNER_INSET_X,
        zIndex: BROADCAST_OVERLAY_BRAND_Z_INDEX,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: LAB_TOURNAMENT_LOGO_H,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div
          style={{
            flex: "1 1 0",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            height: LAB_TOURNAMENT_LOGO_H,
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
                height: LAB_TOURNAMENT_LOGO_H,
                maxWidth: LAB_TOURNAMENT_LOGO_MAX_W,
                width: "auto",
                objectFit: "contain",
                objectPosition: "left center",
                borderRadius: 10,
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
            height: LAB_LOGO_H,
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
                maxHeight: LAB_LOGO_H,
                maxWidth: LAB_BIDWAR_MAX_W,
                width: "auto",
                height: "auto",
                margin: 0,
                padding: 0,
                objectFit: "contain",
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

      {title ? <LabTournamentTitle name={title} /> : null}
    </div>
  );
});
