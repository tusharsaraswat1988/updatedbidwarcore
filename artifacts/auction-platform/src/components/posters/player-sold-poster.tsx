import React, { useRef, useState } from "react";
import { Crown, Sparkles, User, Trophy, ImageDown, RefreshCw } from "lucide-react";
import { formatAuctionAmount, type AuctionUnit } from "@/lib/format";
import { useBranding } from "@/hooks/use-branding";
import { getObsBroadcastLogoSrc, getObsBrandMarkSrc, OBS_BROADCAST_LOGO_FALLBACK } from "@/lib/brand-assets";
import { cldUrl } from "@/lib/cloudinary";

export interface PlayerSoldPosterProps {
  playerName: string;
  playerPhotoUrl?: string | null;
  playerRole?: string | null;
  teamName: string;
  teamLogoUrl?: string | null;
  teamShortCode?: string | null;
  teamColor?: string | null;
  amount: number | string;
  tournamentName: string;
  tournamentSport?: string | null;
  auctionUnit?: AuctionUnit;
  isIllustrative?: boolean;
  className?: string;
  showDownloadButton?: boolean;
  titleSponsorLogoUrl?: string | null;
  coSponsorLogoUrls?: string[] | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function PlayerSoldPoster({
  playerName,
  playerPhotoUrl,
  playerRole,
  teamName,
  teamLogoUrl,
  teamShortCode,
  amount,
  tournamentName,
  tournamentSport = "Cricket",
  auctionUnit = "rupee",
  isIllustrative = false,
  className = "",
  showDownloadButton = true,
  titleSponsorLogoUrl,
  coSponsorLogoUrls = [],
}: PlayerSoldPosterProps) {
  const { logos, brandName, iconVersion } = useBranding();
  const logoSrc =
    getObsBroadcastLogoSrc(logos, iconVersion) ||
    getObsBrandMarkSrc(logos, iconVersion) ||
    OBS_BROADCAST_LOGO_FALLBACK;

  const posterRef = useRef<HTMLDivElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  const parsedAmount = typeof amount === "number" ? amount : parseFloat(String(amount).replace(/[^0-9.]/g, "")) || 0;
  const formattedPrice = formatAuctionAmount(parsedAmount, auctionUnit);

  const safePlayerName = playerName?.trim() || "Player Name";
  const safeTeamName = teamName?.trim() || "Winning Team";
  const safeTournamentName = tournamentName?.trim() || "BidWar Premier Tournament";
  const initials = getInitials(safePlayerName);
  const shortCode = (teamShortCode?.trim() || safeTeamName.slice(0, 3)).toUpperCase();

  const validCoSponsors = (coSponsorLogoUrls || []).filter(Boolean);

  const handleDownload = async () => {
    if (!posterRef.current) return;
    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas-pro")).default;
      await document.fonts.ready;
      const canvas = await html2canvas(posterRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#050811",
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      const safeP = safePlayerName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      const safeT = safeTournamentName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      a.download = `${safeT}_${safeP}_portrait_sold_poster.png`;
      a.href = url;
      a.click();
    } catch (err) {
      console.error("Failed to download portrait poster as PNG:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={`relative flex flex-col items-center w-full ${className}`}>
      {showDownloadButton && (
        <div className="w-full flex items-center justify-between pb-2">
          <span className="text-[10px] text-amber-300 font-medium">
            📱 Portrait 4:5 Poster • Ready for Social Media & WhatsApp
          </span>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-700 hover:to-yellow-700 text-white shadow-sm transition"
          >
            {downloading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ImageDown className="w-3.5 h-3.5" />}
            Save Poster (PNG)
          </button>
        </div>
      )}

      {/* 4:5 Portrait Aspect Ratio Canvas (Optimized for Social Media & WhatsApp Image Delivery) */}
      <div
        ref={posterRef}
        data-testid="player-sold-poster-canvas"
        className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden bg-[#050811] text-white border-2 border-amber-500/50 shadow-2xl select-none flex flex-col justify-between p-3.5 sm:p-5"
        style={{
          background: "radial-gradient(ellipse at 50% 120%, #1e3a8a 0%, #0b132b 50%, #050811 100%)",
        }}
      >
        {/* Stadium Floodlight Beams (Left & Right Top Cones) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-45 mix-blend-screen"
          style={{
            background:
              "radial-gradient(circle at 0% 0%, rgba(251, 191, 36, 0.5) 0%, rgba(251, 191, 36, 0.18) 35%, transparent 70%), radial-gradient(circle at 100% 0%, rgba(96, 165, 250, 0.45) 0%, rgba(96, 165, 250, 0.15) 35%, transparent 70%)",
          }}
        />

        {/* Stadium Pitch Arc Lines & Floodlight Rays */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none opacity-25"
          viewBox="0 0 1080 1350"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="540" cy="1400" rx="680" ry="320" stroke="#F59E0B" strokeWidth="2.5" strokeDasharray="8 8" />
          <ellipse cx="540" cy="1400" rx="500" ry="240" stroke="#FBBF24" strokeWidth="2" />
          <ellipse cx="540" cy="1400" rx="320" ry="160" stroke="#FFFFFF" strokeWidth="1" strokeOpacity="0.4" />
          {/* Angular Floodlight Ray Lines */}
          <line x1="0" y1="0" x2="420" y2="1350" stroke="#FDE68A" strokeWidth="1.5" strokeOpacity="0.2" />
          <line x1="1080" y1="0" x2="660" y2="1350" stroke="#93C5FD" strokeWidth="1.5" strokeOpacity="0.2" />
          {/* Subtle Outer Frame Inset */}
          <rect x="24" y="24" width="1032" height="1302" rx="20" stroke="#F59E0B" strokeWidth="1.5" strokeOpacity="0.35" />
        </svg>

        {/* Ambient Color Glow behind Player and Price */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-80 h-48 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* ─── SECTION 1: TOP HEADER (BidWar Logo Left & Sponsor Logos Right) ─── */}
        <div className="relative z-10 w-full flex items-center justify-between gap-3 pb-1 border-b border-white/10">
          {/* Top Left: BidWar Logo from Branding */}
          <div className="flex items-center min-w-0 shrink-0">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={brandName || "BidWar"}
                className="h-6 sm:h-8 w-auto max-w-[100px] sm:max-w-[120px] object-contain shrink-0"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-amber-500 flex items-center justify-center font-black text-slate-950 text-xs">
                  BW
                </div>
                <span className="font-black text-xs tracking-wider text-white">BIDWAR</span>
              </div>
            )}
          </div>

          {/* Top Right: Title Sponsor & Co-Sponsors Logos Only */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {validCoSponsors.slice(0, 3).map((coLogo, i) => (
              <img
                key={i}
                src={coLogo}
                alt="Co-Sponsor"
                className="h-5 sm:h-6 w-auto max-w-[50px] sm:max-w-[70px] object-contain rounded opacity-90"
                crossOrigin="anonymous"
              />
            ))}
            {titleSponsorLogoUrl && (
              <img
                src={titleSponsorLogoUrl}
                alt="Title Sponsor"
                className="h-6 sm:h-8 w-auto max-w-[80px] sm:max-w-[110px] object-contain rounded"
                crossOrigin="anonymous"
              />
            )}
          </div>
        </div>

        {/* ─── SECTION 2: TOURNAMENT NAME BANNER (Below Top Header) ─── */}
        <div className="relative z-10 w-full text-center py-1">
          <div className="flex items-center justify-center gap-2">
            <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-amber-500/40" />
            <span className="text-[10px] sm:text-xs md:text-sm font-black uppercase tracking-widest text-amber-300 truncate max-w-[85%] font-display">
              {safeTournamentName}
            </span>
            <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-amber-500/40" />
          </div>
        </div>

        {/* ─── SECTION 3: HERO PLAYER PORTRAIT ─── */}
        <div className="relative z-10 w-full flex flex-col items-center justify-center my-0.5">
          {/* Portrait Container with Gold Trim */}
          <div className="relative flex items-center justify-center">
            {/* Outer Rounded Portrait Card */}
            <div className="relative w-24 h-28 sm:w-32 sm:h-36 md:w-44 md:h-48 rounded-2xl overflow-hidden border-2 border-amber-400/90 bg-slate-900 shadow-xl shadow-amber-500/25 flex items-center justify-center">
              {playerPhotoUrl ? (
                <img
                  src={cldUrl(playerPhotoUrl, "soldCard")}
                  alt={safePlayerName}
                  className="w-full h-full object-cover object-top"
                  crossOrigin="anonymous"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const fallback = e.currentTarget.parentElement?.querySelector(".player-fallback-avatar");
                    if (fallback) (fallback as HTMLElement).style.display = "flex";
                  }}
                />
              ) : null}

              {/* Deliberate Branded Fallback (Initials Crest + Silhouette) */}
              <div
                className={`player-fallback-avatar w-full h-full flex flex-col items-center justify-center bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-1.5 ${
                  playerPhotoUrl ? "hidden" : "flex"
                }`}
              >
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-md flex items-center justify-center mb-0.5">
                  <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center">
                    <span className="font-display font-black text-amber-400 text-sm sm:text-xl tracking-wider">
                      {initials}
                    </span>
                  </div>
                </div>
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400/60" />
                <span className="text-[6px] sm:text-[7px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">
                  BIDWAR PLAYER
                </span>
              </div>

              {/* Floating Gold SOLD Ribbon */}
              <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[8px] sm:text-[9px] px-2 py-0.5 rounded shadow-md flex items-center gap-1 uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5 fill-slate-950" />
                SOLD
              </div>
            </div>
          </div>

          {/* Player Name (BIG & BOLD, under portrait, no congratulations or batsman) */}
          <div className="text-center mt-1.5 w-full px-2">
            <h1 className="text-base sm:text-2xl md:text-3xl font-black text-white tracking-tight leading-tight truncate font-display drop-shadow-md">
              {safePlayerName}
            </h1>
          </div>
        </div>

        {/* ─── SECTION 4: SOLD POINTS (BIG & BOLD, centered, no verified sale badge) ─── */}
        <div className="relative z-10 w-full my-1">
          <div className="rounded-xl bg-gradient-to-r from-amber-950/70 via-slate-900/95 to-amber-950/70 border border-amber-500/70 p-2 sm:p-3 text-center shadow-lg">
            <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-amber-400">
              SOLD FOR
            </p>
            <p className="text-xl sm:text-3xl md:text-4xl font-black text-amber-300 font-display tracking-tight leading-none mt-1 truncate drop-shadow-md">
              {formattedPrice}
            </p>
          </div>
        </div>

        {/* ─── SECTION 5: SOLD TO TEAM CARD ─── */}
        <div className="relative z-10 w-full mb-1">
          <div className="rounded-xl bg-slate-900/90 border border-slate-700/80 p-2 sm:p-2.5 flex items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg bg-slate-800 border border-amber-400/40 flex items-center justify-center overflow-hidden shrink-0 shadow">
                {teamLogoUrl ? (
                  <img
                    src={cldUrl(teamLogoUrl, "teamLogo")}
                    alt={safeTeamName}
                    className="w-full h-full object-contain p-0.5"
                    crossOrigin="anonymous"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget.parentElement?.querySelector(".team-fallback-code");
                      if (fallback) (fallback as HTMLElement).style.display = "block";
                    }}
                  />
                ) : null}
                <span
                  className={`team-fallback-code text-[10px] sm:text-xs font-black text-amber-400 ${
                    teamLogoUrl ? "hidden" : "block"
                  }`}
                >
                  {shortCode}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-[7px] sm:text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                  SOLD TO
                </p>
                <p className="text-xs sm:text-base font-black text-white truncate leading-tight">
                  {safeTeamName}
                </p>
              </div>
            </div>

            <div className="shrink-0 flex items-center pr-1">
              <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
            </div>
          </div>
        </div>

        {/* ─── SECTION 6: FOOTER ─── */}
        <div className="relative z-10 w-full border-t border-white/10 pt-1.5 flex items-center justify-between text-[7px] sm:text-[8px] text-slate-400">
          <div className="flex items-center gap-1 font-semibold text-slate-300">
            <span className="text-amber-400 font-black">BIDWAR</span>
            <span>•</span>
            <span className="tracking-wide">From Auction to Champions</span>
          </div>
          <div className="font-mono text-slate-400">
            <span>Official Tournament Notification</span>
          </div>
        </div>
      </div>
    </div>
  );
}
