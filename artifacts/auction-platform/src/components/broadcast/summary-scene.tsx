import { memo } from "react";
import { BroadcastOverlayTopBar } from "@/components/display/broadcast-overlay-top-bar";
import { BROADCAST_CANVAS, BROADCAST_FONTS, themePalette } from "./tokens";
import { SponsorTicker, SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX } from "./sponsor-ticker";
import type { BroadcastSettings, SummaryStats } from "./types";
import type { SponsorLogo } from "@/lib/sponsor-logo";

type SummarySceneProps = {
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  sponsorLogos: SponsorLogo[];
  settings: BroadcastSettings;
  stats: SummaryStats;
  formatAmount: (n: number) => string;
  obsMode: boolean;
};

function StatBlock({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        padding: "20px 28px",
        borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.1)",
        background: "rgba(0,0,0,0.45)",
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 10, letterSpacing: "0.2em", color: accent, marginBottom: 8 }}>{label}</div>
      <div
        style={{
          fontFamily: BROADCAST_FONTS.display,
          fontSize: 36,
          fontWeight: 900,
          color: "#fff",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export const SummaryScene = memo(function SummaryScene({
  tournamentName,
  tournamentLogoUrl,
  sponsorLogos,
  settings,
  stats,
  formatAmount,
}: SummarySceneProps) {
  const palette = themePalette(settings.theme);

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: palette.bg }} />
      <div style={{ position: "absolute", inset: 0, background: palette.vignette }} />

      <BroadcastOverlayTopBar
        tournamentLogoUrl={tournamentLogoUrl}
        tournamentName={tournamentName}
        sponsorLogos={sponsorLogos}
      />

      <div
        style={{
          position: "absolute",
          top: BROADCAST_CANVAS.safeY + 100,
          left: BROADCAST_CANVAS.safeX,
          right: BROADCAST_CANVAS.safeX,
          bottom: SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX + 40,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 36,
        }}
      >
        <div
          style={{
            fontFamily: BROADCAST_FONTS.display,
            fontSize: 56,
            letterSpacing: "0.12em",
            color: palette.accent,
          }}
        >
          TOURNAMENT SUMMARY
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 20,
            justifyContent: "center",
            maxWidth: 1200,
          }}
        >
          <StatBlock label="PLAYERS SOLD" value={String(stats.playersSold)} accent={palette.accent} />
          <StatBlock label="REMAINING" value={String(stats.remainingPlayers)} accent={palette.accent} />
          <StatBlock
            label="HIGHEST BID"
            value={stats.highestBid > 0 ? formatAmount(stats.highestBid) : "—"}
            accent={palette.accent}
          />
          <StatBlock
            label="TOP BUYER"
            value={stats.topBuyerName ?? "—"}
            accent={palette.accent}
          />
          <StatBlock
            label="HIGHEST TEAM SPEND"
            value={stats.highestTeamSpend > 0 ? formatAmount(stats.highestTeamSpend) : "—"}
            accent={palette.accent}
          />
          {stats.highestTeamName && (
            <StatBlock label="TOP SPENDER" value={stats.highestTeamName} accent={palette.accent} />
          )}
        </div>
      </div>

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 25 }}>
        <SponsorTicker logos={sponsorLogos} themeAccent={palette.accent} includePoweredByBidWar overlay />
      </div>
    </>
  );
});
