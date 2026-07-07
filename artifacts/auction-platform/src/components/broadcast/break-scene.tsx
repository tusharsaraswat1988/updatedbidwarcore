import { memo, useEffect, useState } from "react";
import { SponsorCarousel } from "@/components/display/sponsor-carousel";
import { BROADCAST_CANVAS, BROADCAST_FONTS, themePalette } from "./tokens";
import { SponsorTicker, SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX } from "./sponsor-ticker";
import type { BroadcastSettings } from "./types";
import type { SponsorLogo } from "@/lib/sponsor-logo";

type BreakSceneProps = {
  tournamentName: string | null;
  sponsorLogos: SponsorLogo[];
  settings: BroadcastSettings;
  breakEndsAt: string;
  breakMessage: string | null;
  obsMode: boolean;
};

function useCountdown(endsAt: string): number {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const tick = () => {
      const ms = new Date(endsAt).getTime() - Date.now();
      setSec(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [endsAt]);
  return sec;
}

function formatClock(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const BreakScene = memo(function BreakScene({
  tournamentName,
  sponsorLogos,
  settings,
  breakEndsAt,
  breakMessage,
  obsMode,
}: BreakSceneProps) {
  const palette = themePalette(settings.theme);
  const remaining = useCountdown(breakEndsAt);

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: palette.bg }} />
      <div style={{ position: "absolute", inset: 0, background: palette.vignette }} />

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
          gap: 28,
          padding: BROADCAST_CANVAS.safeX,
          paddingBottom: SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX + 40,
        }}
      >
        <div
          style={{
            fontFamily: BROADCAST_FONTS.display,
            fontSize: 28,
            letterSpacing: "0.2em",
            color: palette.accent,
          }}
        >
          {breakMessage ?? "BREAK"}
        </div>

        {tournamentName && (
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", letterSpacing: "0.08em" }}>
            {tournamentName}
          </div>
        )}

        <div
          style={{
            fontFamily: BROADCAST_FONTS.mono,
            fontSize: 120,
            fontWeight: 900,
            fontVariantNumeric: "tabular-nums",
            color: "#fff",
            lineHeight: 1,
            textShadow: obsMode ? undefined : `0 0 40px ${palette.accent}44`,
          }}
        >
          {formatClock(remaining)}
        </div>

        <div style={{ textAlign: "center", maxWidth: 720 }}>
          <div style={{ fontSize: 14, letterSpacing: "0.15em", color: "rgba(255,255,255,0.5)", marginBottom: 12 }}>
            THANK YOU SPONSORS
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
            {sponsorLogos.slice(0, 8).map((s, i) => (
              <span key={i} style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
                {s.name || s.url}
              </span>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            alignItems: "center",
            gap: 32,
            padding: "16px 28px",
            borderRadius: 12,
            border: `1px solid ${palette.accentBorder}`,
            background: "rgba(0,0,0,0.4)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", color: palette.accent }}>WEBSITE</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>bidwar.in</div>
          </div>
          <div
            style={{
              width: 72,
              height: 72,
              background: "#fff",
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              fontSize: 10,
              color: "#000",
              fontWeight: 700,
            }}
          >
            QR
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", color: palette.accent }}>SOCIAL</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.8)" }}>@BidWarLive</div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 25 }}>
        <SponsorTicker logos={sponsorLogos} themeAccent={palette.accent} includePoweredByBidWar overlay />
      </div>
    </>
  );
});
