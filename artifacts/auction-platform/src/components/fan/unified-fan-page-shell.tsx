import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  Volume2,
  VolumeX,
  Share2,
  Copy,
  Check,
  MapPin,
  Calendar,
  AlertTriangle,
  ArrowLeft,
  Gavel,
  Trophy,
  ExternalLink,
  Radio,
  Tv,
} from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import {
  getBrandLogoAlt,
  getBrandLogoSrc,
  getBrandWordmarkSrc,
  isBrandLogoPlaceholderSrc,
} from "@/lib/brand-assets";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { UnifiedModuleNav, type FanModuleTab } from "./unified-module-nav";
import { cn } from "@/lib/utils";
import { syncDocumentSurfaceTheme } from "@/lib/portal-theme";
import { formatFanDateTime } from "@/lib/fan-date-utils";

export interface UnifiedFanPageShellProps {
  tournament: {
    id: number;
    name: string;
    season?: string | null;
    sport?: string | null;
    city?: string | null;
    venue?: string | null;
    auctionCode?: string | null;
    auctionDate?: string | null;
    auctionTime?: string | null;
    matchDates?: string | null;
    mainBannerUrl?: string | null;
    mainBannerEnabled?: boolean | null;
    logoUrl?: string | null;
    status?: string;
    broadcast?: {
      auction?: {
        url: string;
        platform?: string;
        status: "live" | "upcoming" | "ended";
        title?: string;
      };
      scoring?: {
        url: string;
        platform?: string;
        status: "live" | "upcoming" | "ended";
        title?: string;
      };
    } | null;
  };
  productMode: "auction_only" | "scoring_only" | "both";
  showAuctionTab: boolean;
  showScoringTab: boolean;
  activeTab: FanModuleTab;
  onTabChange: (tab: FanModuleTab) => void;
  isAuctionLive?: boolean;
  isScoringLive?: boolean;
  soundEnabled: boolean;
  onToggleSound: () => void;
  children: React.ReactNode;
  className?: string;
}

export function UnifiedFanPageShell({
  tournament,
  productMode,
  showAuctionTab,
  showScoringTab,
  activeTab,
  onTabChange,
  isAuctionLive = false,
  isScoringLive = false,
  soundEnabled,
  onToggleSound,
  children,
  className,
}: UnifiedFanPageShellProps) {
  const { logos, brandName } = useBranding();
  const miniLogoSrc = getBrandLogoSrc(logos, ["mini", "appIcon"]);
  const mainWordmarkSrc = getBrandWordmarkSrc(logos, ["mainReverse", "main"]);
  const logoAlt = getBrandLogoAlt(brandName);

  // Share Dialog state
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fanPageUrl = typeof window !== "undefined"
    ? `${window.location.origin}/tournament/${tournament.id}/fan${activeTab ? `?tab=${activeTab}` : ""}`
    : "";

  const handleCopyLink = () => {
    if (!fanPageUrl) return;
    navigator.clipboard.writeText(fanPageUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsAppShare = () => {
    const text = encodeURIComponent(
      `🏆 Watch ${tournament.name} Live on BidWar!\nFollow the live auction bids and match scores here: ${fanPageUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank", "noopener,noreferrer");
  };

  const brandLogoSrc = React.useMemo(() => {
    const candidates = [logos.mini, logos.mainReverse, logos.main, miniLogoSrc, mainWordmarkSrc];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return "/assets/branding/bidwar-reverse-logo-official.png";
  }, [logos, miniLogoSrc, mainWordmarkSrc]);

  useEffect(() => {
    syncDocumentSurfaceTheme();
  }, []);

  return (
    <div
      className={cn("min-h-screen bg-[#0B101B] text-slate-100 flex flex-col antialiased selection:bg-amber-500 selection:text-black", className)}
      data-surface="unified-fan-page"
    >
      {/* ── Top Global Chrome Bar ────────────────────────────────────────── */}
      <header
        className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#0B101B]/90 backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3"
        role="banner"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Brand Logo & Tournament Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/fan"
              className="shrink-0 flex items-center gap-2 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-amber-400 rounded-lg"
              title="BidWar Fan Arena Home"
            >
              {brandLogoSrc ? (
                <img
                  src={brandLogoSrc}
                  alt={logoAlt}
                  className="h-7 sm:h-8 w-auto object-contain"
                  loading="eager"
                />
              ) : (
                <span className="font-display font-black text-lg text-amber-400 tracking-wider">
                  BIDWAR
                </span>
              )}
            </Link>

            <div className="hidden sm:block h-5 w-px bg-white/10" aria-hidden="true" />

            {/* Tournament Meta Heading */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-sm sm:text-base text-white truncate max-w-[200px] sm:max-w-md lg:max-w-lg">
                  {tournament.name}
                </h1>
                {tournament.season?.trim() ? (
                  <span className="hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-white/10 text-slate-300 border border-white/15">
                    {tournament.season.trim()}
                  </span>
                ) : null}
                {tournament.auctionCode && (
                  <span className="hidden md:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-white/[0.06] text-amber-400 border border-amber-400/30">
                    {tournament.auctionCode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
                {tournament.season?.trim() ? (
                  <span className="sm:hidden px-1.5 py-0.2 rounded bg-white/[0.06] text-slate-300 font-medium">
                    {tournament.season.trim()}
                  </span>
                ) : null}
                {tournament.city && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{tournament.city}</span>
                  </span>
                )}
                {tournament.sport && (
                  <span className="capitalize px-1.5 py-0.2 rounded bg-white/[0.04] text-slate-300">
                    {tournament.sport}
                  </span>
                )}
                {formatFanDateTime(tournament.auctionDate, tournament.auctionTime) && (
                  <span className="hidden sm:flex items-center gap-1 text-slate-400">
                    <Calendar className="w-3 h-3 text-slate-500 shrink-0" />
                    <span>{formatFanDateTime(tournament.auctionDate, tournament.auctionTime)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action Toolbar: Share + Audio Controls + Official Broadcast Stream */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Official Module Broadcast Stream CTA */}
            {activeTab === "auction" && tournament.broadcast?.auction?.url && (
              <a
                href={tournament.broadcast.auction.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px]",
                  tournament.broadcast.auction.status === "live"
                    ? "bg-red-500/15 hover:bg-red-500/25 border-red-500/35 text-red-300 hover:text-white shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                    : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300"
                )}
                title={tournament.broadcast.auction.title || "Watch Auction Stream"}
              >
                {tournament.broadcast.auction.status === "live" ? (
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse motion-reduce:animate-none" />
                ) : (
                  <Radio className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span className="hidden md:inline">
                  {tournament.broadcast.auction.title ||
                    (tournament.broadcast.auction.status === "live"
                      ? "Watch Auction Live"
                      : "Auction Stream")}
                </span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            )}

            {activeTab === "scoring" && tournament.broadcast?.scoring?.url && (
              <a
                href={tournament.broadcast.scoring.url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer min-h-[44px]",
                  tournament.broadcast.scoring.status === "live"
                    ? "bg-red-500/15 hover:bg-red-500/25 border-red-500/35 text-red-300 hover:text-white shadow-[0_0_12px_rgba(239,68,68,0.2)]"
                    : "bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-slate-300"
                )}
                title={tournament.broadcast.scoring.title || "Watch Match Stream"}
              >
                {tournament.broadcast.scoring.status === "live" ? (
                  <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse motion-reduce:animate-none" />
                ) : (
                  <Tv className="w-3.5 h-3.5 text-sky-400" />
                )}
                <span className="hidden md:inline">
                  {tournament.broadcast.scoring.title ||
                    (tournament.broadcast.scoring.status === "live"
                      ? "Watch Match Live"
                      : "Match Stream")}
                </span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            )}

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={onToggleSound}
              className={cn(
                "p-2.5 rounded-xl border transition-all duration-200 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center",
                soundEnabled
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                  : "bg-white/[0.04] border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.08]"
              )}
              title={soundEnabled ? "Mute spectator audio" : "Enable live sound effects"}
              aria-label={soundEnabled ? "Mute spectator audio" : "Enable live sound effects"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Share Button */}
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white transition-all cursor-pointer min-h-[44px] min-w-[44px]"
              aria-label="Share tournament fan page"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline">Share</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Tournament Fan Shell Container ─────────────────────────── */}
      <main className="max-w-7xl mx-auto w-full px-3 sm:px-6 lg:px-8 py-3 sm:py-5 flex-1 flex flex-col" role="main">
        {/* Adaptive Segmented Module Navigation (rendered only when multi-module) */}
        <UnifiedModuleNav
          productMode={productMode}
          showAuctionTab={showAuctionTab}
          showScoringTab={showScoringTab}
          activeTab={activeTab}
          onTabChange={onTabChange}
          isAuctionLive={isAuctionLive}
          isScoringLive={isScoringLive}
          sport={tournament.sport}
        />

        {/* Dynamic Module Presentation Pane */}
        <div
          id={`fan-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`fan-tab-${activeTab}`}
          className="w-full flex-1 flex flex-col focus:outline-none"
        >
          {children}
        </div>
      </main>

      {/* ── Share Modal Dialog ──────────────────────────────────────────── */}
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="sm:max-w-md bg-[#131B2E] border-white/10 text-white rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="font-display font-bold text-lg text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-amber-400" />
              Share Tournament Fan Page
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <p className="text-xs text-slate-300">
              Share the official live spectator hub with team owners, players, and fans.
            </p>

            <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/10">
              <input
                type="text"
                readOnly
                value={fanPageUrl}
                className="w-full bg-transparent text-xs text-slate-200 font-mono focus:outline-none truncate px-1"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#25D366] text-white font-bold text-sm hover:bg-[#20ba59] transition-colors cursor-pointer shadow-lg shadow-[#25D366]/20"
            >
              <span>Share to WhatsApp</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Loading Skeleton for the Unified Fan Page Shell */
export function UnifiedFanPageLoadingSkeleton() {
  const { logos, brandName } = useBranding();
  const miniLogoSrc = getBrandLogoSrc(logos, ["mini", "appIcon"]);
  const mainWordmarkSrc = getBrandWordmarkSrc(logos, ["mainReverse", "main"]);
  const logoAlt = getBrandLogoAlt(brandName);

  const brandLogoSrc = React.useMemo(() => {
    const candidates = [logos.mini, logos.mainReverse, logos.main, miniLogoSrc, mainWordmarkSrc];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return "/assets/branding/bidwar-reverse-logo-official.png";
  }, [logos, miniLogoSrc, mainWordmarkSrc]);

  useEffect(() => {
    syncDocumentSurfaceTheme();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B101B] flex flex-col p-4 sm:p-6 lg:p-8 space-y-6" aria-busy="true" aria-label="Loading tournament fan page">
      {/* Header Bar Skeleton */}
      <div className="max-w-7xl mx-auto w-full flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3">
          <Link href="/fan" className="shrink-0 flex items-center gap-2 hover:opacity-90 transition-opacity" title="BidWar Fan Arena">
            <img src={brandLogoSrc} alt={logoAlt} className="h-7 sm:h-8 w-auto object-contain" />
          </Link>
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48 rounded bg-white/10" />
            <Skeleton className="h-3 w-28 rounded bg-white/5" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-9 rounded-xl bg-white/10" />
          <Skeleton className="h-9 w-20 rounded-xl bg-white/10" />
        </div>
      </div>

      {/* Module Navigation Tabs Skeleton */}
      <div className="flex justify-center py-2">
        <Skeleton className="h-11 w-64 rounded-2xl bg-white/5" />
      </div>

      {/* Main Workspace Skeleton */}
      <div className="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-64 sm:h-96 w-full rounded-2xl bg-white/[0.04] border border-white/[0.08]" />
          <Skeleton className="h-28 w-full rounded-2xl bg-white/[0.04] border border-white/[0.08]" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl bg-white/[0.04] border border-white/[0.08]" />
          <Skeleton className="h-48 w-full rounded-2xl bg-white/[0.04] border border-white/[0.08]" />
        </div>
      </div>
    </div>
  );
}

/** Error / Unavailable State for Unified Fan Page */
export function UnifiedFanPageErrorState({
  title = "Tournament Unavailable",
  message = "This tournament fan experience is currently unavailable or has not been configured.",
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  const { logos, brandName } = useBranding();
  const miniLogoSrc = getBrandLogoSrc(logos, ["mini", "appIcon"]);
  const mainWordmarkSrc = getBrandWordmarkSrc(logos, ["mainReverse", "main"]);
  const logoAlt = getBrandLogoAlt(brandName);

  const brandLogoSrc = React.useMemo(() => {
    const candidates = [logos.mini, logos.mainReverse, logos.main, miniLogoSrc, mainWordmarkSrc];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return "/assets/branding/bidwar-reverse-logo-official.png";
  }, [logos, miniLogoSrc, mainWordmarkSrc]);

  useEffect(() => {
    syncDocumentSurfaceTheme();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B101B] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full p-8 rounded-3xl bg-[#131B2E] border border-white/10 shadow-2xl space-y-5">
        <Link href="/fan" className="inline-block hover:opacity-90 transition-opacity mb-2" title="BidWar Fan Arena">
          <img src={brandLogoSrc} alt={logoAlt} className="h-8 w-auto object-contain mx-auto" />
        </Link>
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="font-display font-black text-xl !text-white tracking-wide">{title}</h2>
          <p className="text-sm text-slate-400 leading-relaxed">{message}</p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition-colors cursor-pointer"
            >
              Retry Connection
            </button>
          )}
          <Link
            href="/fan"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-white/[0.06] text-slate-300 font-semibold text-xs hover:text-white hover:bg-white/10 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Fan Arena Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
