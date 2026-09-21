import { useState, useEffect } from "react";
import { useCricketBidWarTheme } from "@/components/scoring/cricket-branding";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

/**
 * Component 1: Solid Top Header (Non-Transparent)
 * - Middle: Prominent BidWar Broadcast Branding with live emblem
 * - Left: Tournament Logo + Official Tournament Name
 * - Right: Sponsors Showcase (Logo, Name, Sponsor Type e.g., Title Sponsor, Powered By)
 * - Solid non-transparent background with metallic broadcast chrome finish
 */
export function CricketObsBranding({ vm }: { vm: CricketObsViewModel }) {
  const { logoSrc, brandName } = useCricketBidWarTheme();
  const sponsors = vm.sponsors ?? [];
  const [activeSponsorIndex, setActiveSponsorIndex] = useState(0);

  // Rotate through sponsors if multiple exist
  useEffect(() => {
    if (sponsors.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSponsorIndex((prev) => (prev + 1) % sponsors.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [sponsors.length]);

  const currentSponsor = sponsors.length > 0 ? sponsors[activeSponsorIndex] : null;

  return (
    <header
      className="relative z-40 flex h-16 w-full items-center justify-between px-6 shadow-2xl"
      style={{
        background: "linear-gradient(180deg, #0f1523 0%, #080c16 100%)",
        borderBottom: "2px solid rgba(255, 255, 255, 0.15)",
        boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8)",
      }}
    >
      {/* Subtle top golden/cyan broadcast trim */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, #3b82f6 0%, #fbbf24 35%, #f59e0b 65%, #3b82f6 100%)",
        }}
      />

      {/* LEFT: Tournament Logo & Tournament Name */}
      <div className="flex min-w-[280px] max-w-[380px] items-center gap-3.5">
        {vm.tournamentLogoUrl ? (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-black/50 p-1 shadow-inner">
            <img
              src={vm.tournamentLogoUrl}
              alt=""
              className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            />
          </div>
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-400/30 bg-amber-500/10 text-amber-400 shadow-inner">
            <span className="text-base font-black tracking-wider">IPL</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black uppercase tracking-[0.14em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] font-sans">
            {vm.tournamentName || "CRICKET CHAMPIONSHIP"}
          </p>
          <div className="flex items-center gap-2">
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.18em] text-amber-400">
              OFFICIAL STREAM
            </span>
            {vm.venueText ? (
              <span className="truncate text-[10px] font-medium tracking-wide text-white/50">
                {vm.venueText}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* CENTER: HERO BIDWAR BRANDING (Most important part on OBS) */}
      <div className="flex items-center justify-center">
        <div
          className="relative flex items-center gap-3 rounded-full border border-amber-400/40 px-5 py-1.5 shadow-[0_0_25px_rgba(245,158,11,0.25)]"
          style={{
            background:
              "linear-gradient(180deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%)",
          }}
        >
          {/* BidWar Brand Mark / Wordmark */}
          <div className="flex items-center gap-2">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={brandName}
                className="h-6 max-w-[130px] object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]"
              />
            ) : (
              <span
                className="text-xl font-black italic tracking-wider text-transparent bg-clip-text"
                style={{
                  backgroundImage: "linear-gradient(180deg, #ffffff 0%, #fbbf24 60%, #d97706 100%)",
                  fontFamily: "'Barlow Condensed', 'Space Grotesk', sans-serif",
                  letterSpacing: "0.12em",
                }}
              >
                BIDWAR
              </span>
            )}
          </div>

          <div className="h-4 w-[1px] bg-white/20" />

          {/* Cricket broadcast pill with pulsing live dot */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-600" />
            </span>
            <span
              className="text-xs font-black uppercase tracking-[0.2em] text-white"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT: SPONSORS SHOWCASE (Logo, Name, Sponsor Type) */}
      <div className="flex min-w-[280px] max-w-[380px] items-center justify-end gap-3">
        {currentSponsor?.url ? (
          <div className="flex items-center gap-3 rounded-lg border border-white/15 bg-black/60 px-3.5 py-1.5 shadow-md">
            <div className="flex flex-col items-end">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-amber-400">
                {currentSponsor.tier
                  ? currentSponsor.tier.replace(/_/g, " ").toUpperCase()
                  : "OFFICIAL PARTNER"}
              </span>
              <p className="max-w-[120px] truncate text-[11px] font-bold text-white/90">
                {currentSponsor.name || "SPONSOR"}
              </p>
            </div>
            <img
              src={currentSponsor.url}
              alt={currentSponsor.name || ""}
              className="h-8 max-w-[110px] object-contain drop-shadow"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">
              POWERED BY
            </span>
            <span className="text-xs font-black tracking-wider text-amber-400">
              BIDWAR SPORTS
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
