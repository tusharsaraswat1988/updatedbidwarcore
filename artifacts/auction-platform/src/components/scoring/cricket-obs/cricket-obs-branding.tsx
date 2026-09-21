import { useState, useEffect } from "react";
import { useCricketBidWarTheme } from "@/components/scoring/cricket-branding";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";

/**
 * Component 1: Solid Top Header (Non-Transparent)
 * - Middle: Prominent HERO BidWar Broadcast Branding (large & unmistakably clear)
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
      className="relative z-40 flex h-20 w-full items-center justify-between px-8 shadow-2xl"
      style={{
        background: "linear-gradient(180deg, #111827 0%, #080c16 100%)",
        borderBottom: "2px solid rgba(255, 255, 255, 0.18)",
        boxShadow: "0 4px 18px rgba(0, 0, 0, 0.55)",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
        textRendering: "optimizeLegibility",
      }}
    >
      {/* Subtle top golden/cyan broadcast trim */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, #3b82f6 0%, #fbbf24 35%, #f59e0b 65%, #3b82f6 100%)",
        }}
      />

      {/* LEFT: Tournament Logo & Tournament Name */}
      <div className="flex min-w-[320px] max-w-[420px] items-center gap-4">
        {vm.tournamentLogoUrl ? (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-black/60 p-1.5 shadow-md">
            <img
              src={vm.tournamentLogoUrl}
              alt=""
              className="h-full w-full object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
            />
          </div>
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/15 text-amber-400 shadow-md">
            <span className="text-lg font-black tracking-wider">IPL</span>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p
            className="truncate text-lg font-black uppercase tracking-[0.12em] text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            {vm.tournamentName || "CRICKET CHAMPIONSHIP"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
              OFFICIAL STREAM
            </span>
            {vm.venueText ? (
              <span className="truncate text-xs font-medium tracking-wide text-white/60">
                {vm.venueText}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* CENTER: HERO BIDWAR BRANDING (Significantly Larger & Crisp) */}
      <div className="flex items-center justify-center">
        <div
          className="relative flex items-center gap-4 rounded-full border-2 border-amber-400/50 px-8 py-2.5 shadow-[0_0_35px_rgba(245,158,11,0.35)]"
          style={{
            background:
              "linear-gradient(180deg, rgba(30, 41, 59, 0.98) 0%, rgba(15, 23, 42, 0.99) 100%)",
          }}
        >
          {/* BidWar Brand Mark / Wordmark */}
          <div className="flex items-center gap-2.5">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={brandName}
                className="h-10 max-w-[200px] object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]"
              />
            ) : (
              <span
                className="text-3xl font-black italic tracking-widest text-transparent bg-clip-text"
                style={{
                  backgroundImage: "linear-gradient(180deg, #ffffff 0%, #fbbf24 55%, #d97706 100%)",
                  fontFamily: "'Barlow Condensed', sans-serif",
                  letterSpacing: "0.14em",
                }}
              >
                BIDWAR
              </span>
            )}
          </div>

          <div className="h-6 w-[1.5px] bg-white/25" />

          {/* Cricket broadcast pill with pulsing live dot */}
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-600" />
            </span>
            <span
              className="text-sm font-black uppercase tracking-[0.24em] text-white"
              style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
            >
              LIVE
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT: SPONSORS SHOWCASE (Logo, Name, Sponsor Type) */}
      <div className="flex min-w-[320px] max-w-[420px] items-center justify-end gap-3.5">
        {currentSponsor?.url ? (
          <div className="flex items-center gap-3.5 rounded-xl border border-white/20 bg-black/70 px-4 py-2 shadow-lg">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black uppercase tracking-[0.22em] text-amber-400">
                {currentSponsor.tier
                  ? currentSponsor.tier.replace(/_/g, " ").toUpperCase()
                  : "OFFICIAL PARTNER"}
              </span>
              <p className="max-w-[140px] truncate text-xs font-bold text-white/95">
                {currentSponsor.name || "SPONSOR"}
              </p>
            </div>
            <img
              src={currentSponsor.url}
              alt={currentSponsor.name || ""}
              className="h-10 max-w-[130px] object-contain drop-shadow"
            />
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-black/50 px-4 py-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
              POWERED BY
            </span>
            <span className="text-sm font-black tracking-wider text-amber-400">
              BIDWAR SPORTS
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
