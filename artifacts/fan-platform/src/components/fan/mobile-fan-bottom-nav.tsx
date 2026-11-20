import React from "react";
import { Link } from "wouter";
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  Award,
  Gavel,
  Tv,
  Share2,
  Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FanNavSection } from "./unified-module-nav";

export interface MobileFanBottomNavProps {
  activeTab: FanNavSection | string;
  onTabChange: (tab: FanNavSection) => void;
  showAuctionTab: boolean;
  showScoringTab?: boolean;
  showMatchesTab?: boolean;
  showStandingsTab?: boolean;
  showLeadersTab?: boolean;
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
  showScoringTab = true,
  showMatchesTab = true,
  showStandingsTab = false,
  showLeadersTab = false,
  isAuctionLive = false,
  isScoringLive = false,
  sport = "cricket",
  streamEnabled = false,
  onOpenStream,
  onOpenShare,
  onOpenCheer,
}: MobileFanBottomNavProps) {
  const currentActive = activeTab === "scoring" ? "overview" : activeTab;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 left-0 right-0 z-30 sm:hidden border-t border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#0B101B]/95 backdrop-blur-xl px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-2xl"
    >
      <div className="flex items-center justify-around gap-0.5">
        {/* 1. Overview */}
        <button
          type="button"
          onClick={() => onTabChange("overview")}
          className={cn(
            "relative flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl transition cursor-pointer min-h-[44px] min-w-[48px]",
            currentActive === "overview"
              ? "text-amber-500 font-bold bg-amber-500/10 dark:text-amber-400"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          )}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span className="text-[10px] font-bold">Overview</span>
        </button>

        {/* 2. Matches (if scoring enabled) */}
        {showScoringTab && showMatchesTab && (
          <button
            type="button"
            onClick={() => onTabChange("matches")}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl transition cursor-pointer min-h-[44px] min-w-[48px]",
              currentActive === "matches"
                ? "text-amber-500 font-bold bg-amber-500/10 dark:text-amber-400"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="relative">
              <Calendar className="h-4 w-4" />
              {isScoringLive && (
                <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] font-bold">Matches</span>
          </button>
        )}

        {/* 3. Standings (if available for sport) */}
        {showScoringTab && showStandingsTab && (
          <button
            type="button"
            onClick={() => onTabChange("standings")}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl transition cursor-pointer min-h-[44px] min-w-[48px]",
              currentActive === "standings"
                ? "text-amber-500 font-bold bg-amber-500/10 dark:text-amber-400"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Trophy className="h-4 w-4" />
            <span className="text-[10px] font-bold">Table</span>
          </button>
        )}

        {/* 4. Leaders (if available for sport) */}
        {showScoringTab && showLeadersTab && (
          <button
            type="button"
            onClick={() => onTabChange("leaders")}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl transition cursor-pointer min-h-[44px] min-w-[48px]",
              currentActive === "leaders"
                ? "text-amber-500 font-bold bg-amber-500/10 dark:text-amber-400"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Award className="h-4 w-4" />
            <span className="text-[10px] font-bold">Leaders</span>
          </button>
        )}

        {/* 5. Auction (if enabled) */}
        {showAuctionTab && (
          <button
            type="button"
            onClick={() => onTabChange("auction")}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl transition cursor-pointer min-h-[44px] min-w-[48px]",
              currentActive === "auction"
                ? "text-amber-500 font-bold bg-amber-500/10 dark:text-amber-400"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <div className="relative">
              <Gavel className="h-4 w-4" />
              {isAuctionLive && (
                <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              )}
            </div>
            <span className="text-[10px] font-bold">Auction</span>
          </button>
        )}

        {/* 6. Cheer Arena */}
        {onOpenCheer && (
          <button
            type="button"
            onClick={onOpenCheer}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl text-orange-500 hover:text-orange-400 transition cursor-pointer min-h-[44px] min-w-[48px]"
            title="Open Fan Cheer Arena"
          >
            <Flame className="h-4 w-4 fill-orange-500 text-orange-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider">Cheer</span>
          </button>
        )}

        {/* 7. Watch Stream (if active) */}
        {streamEnabled && onOpenStream && (
          <button
            type="button"
            onClick={onOpenStream}
            className="flex flex-col items-center justify-center gap-0.5 py-1 px-1.5 rounded-xl text-emerald-500 hover:text-emerald-400 transition cursor-pointer min-h-[44px] min-w-[48px]"
            title="Watch Live Broadcast"
          >
            <Tv className="h-4 w-4 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-wider">Stream</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export default MobileFanBottomNav;
