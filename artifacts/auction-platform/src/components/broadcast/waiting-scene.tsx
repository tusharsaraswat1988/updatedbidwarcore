import { memo, useEffect, useState } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { SponsorCarousel } from "@/components/display/sponsor-carousel";
import { BROADCAST_CANVAS, BROADCAST_FONTS, themePalette } from "./tokens";
import { SponsorTicker, SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX } from "./sponsor-ticker";
import type { BroadcastSettings } from "./types";
import type { SponsorLogo } from "@/lib/sponsor-logo";

type WaitingSceneProps = {
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  sponsorLogos: SponsorLogo[];
  settings: BroadcastSettings;
  auctionStartsAt?: string | null;
  obsMode: boolean;
};

function useCountdownTo(target: string | null | undefined): number | null {
  const [sec, setSec] = useState<number | null>(null);
  useEffect(() => {
    if (!target) {
      setSec(null);
      return;
    }
    const tick = () => {
      const ms = new Date(target).getTime() - Date.now();
      setSec(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return sec;
}

export const WaitingScene = memo(function WaitingScene({
  tournamentName,
  tournamentLogoUrl,
  sponsorLogos,
  settings,
  auctionStartsAt,
  obsMode,
}: WaitingSceneProps) {
  const palette = themePalette(settings.theme);
  const countdown = useCountdownTo(auctionStartsAt);

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: palette.bg }} />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: palette.vignette,
          animation: obsMode ? undefined : "waitingPulse 8s ease-in-out infinite",
        }}
      />
      {!obsMode && (
        <div
          style={{
            position: "absolute",
            inset: "-50%",
            background: `conic-gradient(from 0deg, transparent, ${palette.accentSoft}, transparent)`,
            animation: "waitingRotate 20s linear infinite",
            opacity: 0.4,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          top: BROADCAST_CANVAS.safeY,
          right: BROADCAST_CANVAS.safeX,
          zIndex: 20,
        }}
      >
        <SponsorCarousel logos={sponsorLogos} overlay />
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
          paddingBottom: SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX + 40,
          zIndex: 10,
        }}
      >
        {tournamentLogoUrl && (
          <img
            src={cldUrl(tournamentLogoUrl, "headerLogo")}
            alt=""
            style={{ height: 120, maxWidth: 320, objectFit: "contain" }}
          />
        )}

        <div
          style={{
            fontFamily: BROADCAST_FONTS.display,
            fontSize: 48,
            letterSpacing: "0.1em",
            color: "#fff",
            textAlign: "center",
            textTransform: "uppercase",
          }}
        >
          {tournamentName ?? "Live Auction"}
        </div>

        <div style={{ fontSize: 14, letterSpacing: "0.25em", color: palette.accent }}>
          AUCTION STARTS IN
        </div>

        {countdown != null ? (
          <div
            style={{
              fontFamily: BROADCAST_FONTS.mono,
              fontSize: 96,
              fontWeight: 900,
              fontVariantNumeric: "tabular-nums",
              color: "#fff",
            }}
          >
            {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
          </div>
        ) : (
          <div style={{ fontSize: 24, color: "rgba(255,255,255,0.6)", letterSpacing: "0.15em" }}>
            STANDBY
          </div>
        )}
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 25 }}>
        <SponsorTicker logos={sponsorLogos} themeAccent={palette.accent} includePoweredByBidWar overlay />
      </div>

      <style>{`
        @keyframes waitingPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        @keyframes waitingRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
});
