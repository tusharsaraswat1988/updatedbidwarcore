import React from "react";
import { Link } from "wouter";
import {
  Compass,
  Gavel,
  Trophy,
  Tv,
  Share2,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FanModuleTab } from "./unified-module-nav";

export interface MobileFanBottomNavProps {
  activeTab: FanModuleTab;
  onTabChange: (tab: FanModuleTab) => void;
  showAuctionTab: boolean;
  showScoringTab: boolean;
  isAuctionLive?: boolean;
  isScoringLive?: boolean;
  sport?: string | null;
  streamEnabled?: boolean;
  onOpenStream?: () => void;
  onOpenShare?: () => void;
  onOpenCheer?: () => void;
}

export function MobileFanBottomNav({
  activeTab,
  onTabChange,
  showAuctionTab,
  showScoringTab,
  isAuctionLive = false,
  isScoringLive = false,
  sport = "cricket",
  streamEnabled = false,
  onOpenStream,
  onOpenShare,
  onOpenCheer,
}: MobileFanBottomNavProps) {
  const isLive = isAuctionLive || isScoringLive;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 sm:hidden border-t border-white/10 bg-[#0B101B]/95 backdrop-blur-xl px-2 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] shadow-2xl"
    >
      <div className="flex items-center justify-around gap-1">
        {/* 1. Discover Portal */}
        <Link
          href="/"
          className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-slate-400 hover:text-white transition cursor-pointer min-h-[44px] min-w-[54px]"
          title="All Tournaments"
        >
          <Compass className="h-5 w-5" />
          <span className="text-[10px] font-bold">Discover</span>
        </Link>

        {/* 2. Auction Tab (if enabled) */}
        {showAuctionTab && (
          <button
            type="button"
            onClick={() => onTabChange("auction")}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition cursor-pointer min-h-[44px] min-w-[54px]",
              activeTab === "auction"
                ? "text-amber-400 font-bold bg-amber-500/10"
                : "text-slate-400 hover:text-white"
            )}
          >
            <div className="relative">
              <Gavel className="h-5 w-5" />
              {isAuctionLive && (
                <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-red-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] font-bold">Auction</span>
          </button>
        )}

        {/* 3. Scoring Tab (if enabled) */}
        {showScoringTab && (
          <button
            type="button"
            onClick={() => onTabChange("scoring")}
            className={cn(
              "relative flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl transition cursor-pointer min-h-[44px] min-w-[54px]",
              activeTab === "scoring"
                ? "text-amber-400 font-bold bg-amber-500/10"
                : "text-slate-400 hover:text-white"
            )}
          >
            <div className="relative">
              <Trophy className="h-5 w-5" />
              {isScoringLive && (
                <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-red-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] font-bold capitalize">{sport || "Match"}</span>
          </button>
        )}

        {/* 4. Watch Stream (if active) */}
        {streamEnabled && onOpenStream && (
          <button
            type="button"
            onClick={onOpenStream}
            className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-red-400 hover:text-red-300 transition cursor-pointer min-h-[44px] min-w-[54px]"
            title="Watch Live Broadcast"
          >
            <Tv className="h-5 w-5 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider">Stream</span>
          </button>
        )}

        {/* 5. Cheer Arena Button */}
        {onOpenCheer && (
          <button
            type="button"
            onClick={onOpenCheer}
            className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-orange-400 hover:text-orange-300 transition cursor-pointer min-h-[44px] min-w-[54px]"
            title="Open Fan Cheer Arena"
          >
            <Flame className="h-5 w-5 fill-orange-400 text-orange-400 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider">Cheer</span>
          </button>
        )}

        {/* 6. Share Action */}
        {onOpenShare && (
          <button
            type="button"
            onClick={onOpenShare}
            className="flex flex-col items-center justify-center gap-1 py-1 px-2.5 rounded-xl text-slate-400 hover:text-white transition cursor-pointer min-h-[44px] min-w-[54px]"
            title="Share Fan Page"
          >
            <Share2 className="h-5 w-5 text-amber-400/80" />
            <span className="text-[10px] font-bold">Share</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export default MobileFanBottomNav;
