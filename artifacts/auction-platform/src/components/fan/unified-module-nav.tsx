import React from "react";
import { Gavel, Trophy, Activity, Radio, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type FanModuleTab = "auction" | "scoring";

export interface UnifiedModuleNavProps {
  productMode: "auction_only" | "scoring_only" | "both";
  showAuctionTab: boolean;
  showScoringTab: boolean;
  activeTab: FanModuleTab;
  onTabChange: (tab: FanModuleTab) => void;
  isAuctionLive?: boolean;
  isScoringLive?: boolean;
  sport?: string | null;
  className?: string;
}

export function UnifiedModuleNav({
  productMode,
  showAuctionTab,
  showScoringTab,
  activeTab,
  onTabChange,
  isAuctionLive = false,
  isScoringLive = false,
  sport,
  className,
}: UnifiedModuleNavProps) {
  // If neither tab is available, render nothing
  if (!showAuctionTab && !showScoringTab) {
    return null;
  }

  // If tournament is single-module (auction-only or scoring-only),
  // suppress the navigation pills as per Phase 1 UIUX Contract Section 2.
  if (!showAuctionTab || !showScoringTab) {
    return null;
  }

  const normalizedSport = (sport || "").trim().toLowerCase();
  const scoringSportLabel = normalizedSport === "badminton" ? "Matches & Courts" : "Matches & Scores";

  return (
    <nav
      className={cn("w-full flex items-center justify-center my-3 sm:my-4 !bg-transparent", className)}
      aria-label="Tournament module navigation"
    >
      <div
        role="tablist"
        aria-label="Tournament module navigation tabs"
        className="inline-flex items-center p-1 sm:p-1.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-2xl gap-1.5 sm:gap-2 max-w-full overflow-x-auto"
      >
        {/* Auction Tab Pill */}
        {showAuctionTab && (
          <button
            type="button"
            role="tab"
            id="fan-tab-auction"
            aria-selected={activeTab === "auction"}
            aria-controls="fan-panel-auction"
            tabIndex={activeTab === "auction" ? 0 : -1}
            onClick={() => onTabChange("auction")}
            className={cn(
              "relative flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-display text-xs sm:text-sm font-bold tracking-wide transition-all duration-200 select-none min-h-[44px] cursor-pointer",
              activeTab === "auction"
                ? "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-white shadow-[0_0_20px_rgba(245,158,11,0.4)] border border-amber-400/40"
                : "text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent"
            )}
          >
            <Gavel className={cn("w-4 h-4 shrink-0", activeTab === "auction" ? "text-white" : "text-amber-400/80")} />
            <span>Auction</span>

            {/* Live Indicator Beacon */}
            {isAuctionLive ? (
              <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-red-500/25 border border-red-500/40 text-[10px] font-black tracking-wider text-red-200 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                LIVE
              </span>
            ) : null}
          </button>
        )}

        {/* Scoring Tab Pill */}
        {showScoringTab && (
          <button
            type="button"
            role="tab"
            id="fan-tab-scoring"
            aria-selected={activeTab === "scoring"}
            aria-controls="fan-panel-scoring"
            tabIndex={activeTab === "scoring" ? 0 : -1}
            onClick={() => onTabChange("scoring")}
            className={cn(
              "relative flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-display text-xs sm:text-sm font-bold tracking-wide transition-all duration-200 select-none min-h-[44px] cursor-pointer",
              activeTab === "scoring"
                ? "bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.4)] border border-emerald-400/40"
                : "text-slate-300 hover:text-white hover:bg-white/[0.06] border border-transparent"
            )}
          >
            {normalizedSport === "badminton" ? (
              <Activity className={cn("w-4 h-4 shrink-0", activeTab === "scoring" ? "text-white" : "text-emerald-400/80")} />
            ) : (
              <Trophy className={cn("w-4 h-4 shrink-0", activeTab === "scoring" ? "text-white" : "text-emerald-400/80")} />
            )}
            <span>{scoringSportLabel}</span>

            {/* Live Indicator Beacon */}
            {isScoringLive ? (
              <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-red-500/25 border border-red-500/40 text-[10px] font-black tracking-wider text-red-200 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />
                LIVE
              </span>
            ) : null}
          </button>
        )}
      </div>
    </nav>
  );
}
