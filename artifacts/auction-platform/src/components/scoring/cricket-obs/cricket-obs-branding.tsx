/**
 * Cricket OBS Slimline Broadcast Masthead (52px)
 * Linear television top bar anchored across the 1920×1080 canvas.
 * Respects 96px lateral safe area with authoritative tournament identity.
 */

import { useState, useEffect } from "react";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
} from "@/lib/bidwar-broadcast-colors";
import { BROADCAST_OVERLAY_SAFE_INSET_X } from "@/lib/broadcast-overlay";
import { useCricketBidWarTheme } from "@/components/scoring/cricket-branding";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

export function CricketObsBranding({ vm }: { vm: CricketObsViewModel }) {
  const { logoSrc, brandName } = useCricketBidWarTheme();
  const [logoFailed, setLogoFailed] = useState(false);
  const sponsors = vm.sponsors ?? [];
  const [activeSponsorIndex, setActiveSponsorIndex] = useState(0);

  // Rotate sponsors every 7s if multiple exist
  useEffect(() => {
    if (sponsors.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSponsorIndex((prev) => (prev + 1) % sponsors.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [sponsors.length]);

  const currentSponsor = sponsors.length > 0 ? sponsors[activeSponsorIndex] : null;

  return (
    <header
      className="relative z-40 flex h-[52px] w-full items-center justify-between shadow-lg"
      style={{
        background: BIDWAR_SCOREBOARD_SHELL,
        borderBottom: "1px solid rgba(255, 255, 255, 0.12)",
        paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        fontFamily: BROADCAST_FONTS.body,
      }}
    >
      {/* 2px Solid Top Accent Rail */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: BIDWAR_BROADCAST_YELLOW }}
      />

      {/* LEFT: Strengthened Tournament Identity */}
      <div className="flex items-center gap-3.5 min-w-0 max-w-[560px]">
        {vm.tournamentLogoUrl ? (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center p-0.5">
            <img
              src={vm.tournamentLogoUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex flex-col justify-center">
          <h1
            className="truncate text-2xl font-normal uppercase tracking-wider text-white leading-none"
            style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.05em" }}
          >
            {vm.tournamentName || "CRICKET CHAMPIONSHIP"}
          </h1>
          {vm.venueText ? (
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-[#FFD700]/90 mt-0.5">
              {vm.venueText}
            </p>
          ) : null}
        </div>
      </div>

      {/* CENTER: Restrained BidWar Brand Mark + LIVE Indicator */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2">
          {logoSrc && !logoFailed ? (
            <img
              src={logoSrc}
              alt={brandName}
              className="h-6 max-w-[130px] object-contain"
              loading="eager"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <span
              className="text-lg font-normal tracking-widest text-[#FFD700]"
              style={{ fontFamily: BROADCAST_FONTS.display, letterSpacing: "0.12em" }}
            >
              BIDWAR
            </span>
          )}
        </div>

        <div className="h-3.5 w-[1px] bg-white/20" />

        {/* Geometric Live Broadcast Indicator */}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#E11D48] animate-pulse" />
          <span
            className="text-[11px] font-bold uppercase tracking-[0.2em] text-white"
            style={{ fontFamily: BROADCAST_FONTS.body }}
          >
            LIVE
          </span>
        </div>
      </div>

      {/* RIGHT: Standardized Sponsor Inventory Slot */}
      <div className="flex min-w-[240px] max-w-[420px] items-center justify-end gap-3 shrink-0">
        {currentSponsor ? (
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col items-end text-right">
              <span
                className="text-[9px] font-bold uppercase tracking-[0.16em]"
                style={{ color: BIDWAR_BROADCAST_YELLOW }}
              >
                {currentSponsor.tier
                  ? currentSponsor.tier.replace(/_/g, " ").toUpperCase()
                  : "OFFICIAL PARTNER"}
              </span>
              <span className="max-w-[160px] truncate text-[11px] font-semibold uppercase tracking-wide text-white/90">
                {currentSponsor.name || "SPONSOR"}
              </span>
            </div>

            {currentSponsor.url ? (
              <div
                className="flex h-7 max-w-[120px] shrink-0 items-center justify-center px-2 py-0.5 border border-white/10"
                style={{ background: BIDWAR_SCOREBOARD_PANEL }}
              >
                <img
                  src={currentSponsor.url}
                  alt={currentSponsor.name || ""}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <span
            className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40"
            style={{ fontFamily: BROADCAST_FONTS.body }}
          >
            OFFICIAL BROADCAST
          </span>
        )}
      </div>
    </header>
  );
}
