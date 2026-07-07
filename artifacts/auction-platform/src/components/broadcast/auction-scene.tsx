import { memo, useEffect, useRef, useState } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { BroadcastOverlayTopBar } from "@/components/display/broadcast-overlay-top-bar";
import { BROADCAST_CANVAS, BROADCAST_FONTS, BROADCAST_TYPO, themePalette } from "./tokens";
import { PlayerCard } from "./player-card";
import { BidTimeline } from "./bid-timeline";
import { SponsorTicker, SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX } from "./sponsor-ticker";
import type { BidTimelineEntry, BroadcastSettings } from "./types";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { AuctionState } from "@workspace/api-client-react";

type AuctionSceneProps = {
  state: AuctionState;
  tournamentName: string | null;
  tournamentLogoUrl: string | null;
  sponsorLogos: SponsorLogo[];
  settings: BroadcastSettings;
  bidTimeline: BidTimelineEntry[];
  formatAmount: (n: number) => string;
  obsMode: boolean;
};

function CountdownRing({ timerEndsAt, size = 88 }: { timerEndsAt?: string | null; size?: number }) {
  const [remaining, setRemaining] = useState(0);
  const totalRef = useRef(30);

  useEffect(() => {
    if (!timerEndsAt) {
      setRemaining(0);
      return;
    }
    const fullMs = new Date(timerEndsAt).getTime() - Date.now();
    totalRef.current = Math.max(1, Math.ceil(fullMs / 1000));
    const tick = () => {
      const ms = new Date(timerEndsAt).getTime() - Date.now();
      setRemaining(Math.max(0, Math.ceil(ms / 1000)));
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timerEndsAt]);

  if (!timerEndsAt) return null;

  const pct = totalRef.current > 0 ? remaining / totalRef.current : 0;
  const r = (size / 2) - 8;
  const circumference = 2 * Math.PI * r;
  const color = remaining <= 5 ? "#ef4444" : remaining <= 10 ? "#f59e0b" : "#22c55e";

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={6} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeDasharray={`${circumference * pct} ${circumference}`}
          strokeLinecap="round"
        />
      </svg>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontFamily: BROADCAST_FONTS.mono,
          fontSize: size * 0.32,
          fontWeight: 900,
          fontVariantNumeric: "tabular-nums",
          color,
        }}
      >
        {remaining}
      </div>
    </div>
  );
}

export const AuctionScene = memo(function AuctionScene({
  state,
  tournamentName,
  tournamentLogoUrl,
  sponsorLogos,
  settings,
  bidTimeline,
  formatAmount,
  obsMode,
}: AuctionSceneProps) {
  const palette = themePalette(settings.theme);
  const player = state.currentPlayer;
  const bidColor = state.currentBidTeamColor ?? palette.accent;
  const isActive = state.status === "active";
  const hasBid = !!state.currentBidTeamName;
  const bottomOffset = SPONSOR_RIBBON_OVERLAY_TOTAL_HEIGHT_PX;

  return (
    <>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: palette.bg,
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: palette.vignette,
          pointerEvents: "none",
        }}
      />

      <BroadcastOverlayTopBar
        tournamentLogoUrl={tournamentLogoUrl}
        tournamentName={tournamentName}
        sponsorLogos={sponsorLogos}
      />

      {player && (
        <div
          style={{
            position: "absolute",
            top: BROADCAST_CANVAS.safeY + 80,
            left: BROADCAST_CANVAS.safeX,
            right: BROADCAST_CANVAS.safeX,
            bottom: bottomOffset + 140,
            display: "grid",
            gridTemplateColumns: "1fr 1.1fr 0.9fr",
            gap: 32,
            alignItems: "center",
            padding: "0 24px",
          }}
        >
          {/* Player column */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <PlayerCard
              name={player.name}
              photoUrl={player.photoUrl}
              category={state.currentCategoryName ?? player.role}
              city={player.city}
              basePrice={player.basePrice ?? 0}
              playerTag={(player as { playerTag?: string | null }).playerTag}
              accentColor={palette.accent}
              formatAmount={formatAmount}
              preload
              obsMode={obsMode}
            />
          </div>

          {/* Bid pulse center */}
          <div style={{ textAlign: "center" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 16 }}>
              {isActive && (
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: "#22c55e",
                    animation: "bidPulse 1s ease-in-out infinite",
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  color: isActive ? "#22c55e" : "rgba(255,255,255,0.5)",
                }}
              >
                {isActive ? "LIVE AUCTION" : "UP NEXT"}
              </span>
            </div>

            <div
              style={{
                fontSize: 11,
                letterSpacing: "0.2em",
                color: "rgba(255,255,255,0.6)",
                marginBottom: 8,
              }}
            >
              {hasBid ? "CURRENT BID" : "OPENING BID"}
            </div>
            <div
              style={{
                fontFamily: BROADCAST_FONTS.display,
                fontSize: BROADCAST_TYPO.currentBid,
                fontWeight: 900,
                fontVariantNumeric: "tabular-nums",
                color: hasBid ? bidColor : "#fff",
                lineHeight: 1,
                textShadow: obsMode ? undefined : `0 0 40px ${bidColor}66`,
                animation: isActive && hasBid ? "bidPulse 0.4s ease-out" : undefined,
              }}
            >
              {formatAmount(state.currentBid ?? player.basePrice ?? 0)}
            </div>

            {hasBid && (
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 12,
                }}
              >
                {state.currentBidTeamLogoUrl && (
                  <img
                    src={cldUrl(state.currentBidTeamLogoUrl, "teamLogo")}
                    alt=""
                    style={{ height: 36, objectFit: "contain" }}
                  />
                )}
                <span style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>
                  {state.currentBidTeamName}
                </span>
              </div>
            )}

            {isActive && state.timerEndsAt && (
              <div style={{ marginTop: 28, display: "flex", justifyContent: "center" }}>
                <CountdownRing timerEndsAt={state.timerEndsAt} size={96} />
              </div>
            )}
          </div>

          {/* Timeline column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <BidTimeline entries={bidTimeline} formatAmount={formatAmount} accentColor={palette.accent} />
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border: `1px solid ${palette.accentBorder}`,
                background: palette.accentSoft,
              }}
            >
              <div style={{ fontSize: 10, letterSpacing: "0.2em", color: palette.accent, marginBottom: 6 }}>
                REMAINING POOL
              </div>
              <div
                style={{
                  fontFamily: BROADCAST_FONTS.mono,
                  fontSize: 28,
                  fontWeight: 800,
                  fontVariantNumeric: "tabular-nums",
                  color: "#fff",
                }}
              >
                {state.remainingPlayersCount ?? "—"}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 25 }}>
        <SponsorTicker logos={sponsorLogos} themeAccent={palette.accent} includePoweredByBidWar overlay />
      </div>

      <style>{`
        @keyframes bidPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.02); }
        }
      `}</style>
    </>
  );
});
