import React from "react";
import {
  LayoutDashboard,
  Calendar,
  Trophy,
  Award,
  Gavel,
  Radio,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type FanNavSection =
  | "overview"
  | "matches"
  | "standings"
  | "leaders"
  | "auction";

export type FanModuleTab = FanNavSection | "scoring";

export interface UnifiedModuleNavProps {
  productMode?: "auction_only" | "scoring_only" | "both";
  showAuctionTab: boolean;
  showScoringTab?: boolean;
  showMatchesTab?: boolean;
  showStandingsTab?: boolean;
  showLeadersTab?: boolean;
  activeTab: FanNavSection | string;
  onTabChange: (tab: FanNavSection) => void;
  isAuctionLive?: boolean;
  isScoringLive?: boolean;
  sport?: string | null;
  className?: string;
}

export function UnifiedModuleNav({
  productMode,
  showAuctionTab,
  showScoringTab = true,
  showMatchesTab = true,
  showStandingsTab = false,
  showLeadersTab = false,
  activeTab,
  onTabChange,
  isAuctionLive = false,
  isScoringLive = false,
  sport,
  className,
}: UnifiedModuleNavProps) {
  // If neither scoring nor auction is enabled, render nothing
  if (!showAuctionTab && !showScoringTab) {
    return null;
  }

  const normalizedSport = (sport || "").trim().toLowerCase();
  const matchesLabel = normalizedSport === "badminton" ? "Courts & Matches" : "Matches";

  // Build the list of active sections
  const sections: Array<{
    id: FanNavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    isLive?: boolean;
    badgeText?: string;
  }> = [];

  // 1. Overview (Default Landing Section)
  sections.push({
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
  });

  // 2. Matches (Live, Upcoming, Completed)
  if (showScoringTab && showMatchesTab) {
    sections.push({
      id: "matches",
      label: matchesLabel,
      icon: Calendar,
      isLive: isScoringLive,
      badgeText: "LIVE",
    });
  }

  // 3. Standings (Full Points Table - only if sport/tournament has standings)
  if (showScoringTab && showStandingsTab) {
    sections.push({
      id: "standings",
      label: "Standings",
      icon: Trophy,
    });
  }

  // 4. Leaders (Sport-Specific Player Statistics)
  if (showScoringTab && showLeadersTab) {
    sections.push({
      id: "leaders",
      label: "Leaders",
      icon: Award,
    });
  }

  // 5. Auction (Only when tournament is licensed for auction)
  if (showAuctionTab) {
    sections.push({
      id: "auction",
      label: "Live Auction",
      icon: Gavel,
      isLive: isAuctionLive,
      badgeText: "LIVE",
    });
  }

  // If only 1 section exists (e.g. overview only), hide the nav
  if (sections.length <= 1) {
    return null;
  }

  const currentActive = activeTab === "scoring" ? "overview" : activeTab;

  return (
    <nav
      className={cn(
        "sticky top-[52px] z-30 w-full flex items-center justify-center my-2 sm:my-3 py-1 bg-[#f4f6fb]/80 dark:bg-[#0B101B]/80 backdrop-blur-md",
        className
      )}
      aria-label="Tournament section navigation"
    >
      <div
        role="tablist"
        aria-label="Tournament navigation tabs"
        className="inline-flex items-center p-1 sm:p-1.5 rounded-2xl bg-slate-200/70 border border-slate-300/70 dark:bg-white/[0.05] dark:border-white/[0.08] backdrop-blur-md shadow-lg gap-1 sm:gap-1.5 max-w-full overflow-x-auto no-scrollbar"
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = currentActive === section.id;
          const isAuction = section.id === "auction";

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              id={`fan-tab-${section.id}`}
              aria-selected={isActive}
              aria-controls={`fan-panel-${section.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(section.id)}
              className={cn(
                "relative flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl font-display text-xs sm:text-sm font-bold tracking-wide transition-all duration-200 select-none min-h-[40px] cursor-pointer whitespace-nowrap shrink-0",
                isActive
                  ? isAuction
                    ? "bg-gradient-to-r from-amber-500 via-amber-600 to-amber-500 text-white shadow-md shadow-amber-500/30 border border-amber-400/40"
                    : "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-md font-bold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-300/50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-white/[0.06] border border-transparent"
              )}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0",
                  isActive
                    ? isAuction
                      ? "text-white"
                      : "text-amber-500 dark:text-amber-600"
                    : "text-slate-400 dark:text-slate-400"
                )}
              />
              <span>{section.label}</span>

              {/* Live Indicator Beacon */}
              {section.isLive && (
                <span className="flex items-center gap-1 ml-0.5 px-1.5 py-0.2 rounded-full bg-emerald-500/25 border border-emerald-500/40 text-[9px] sm:text-[10px] font-black tracking-wider text-emerald-600 dark:text-emerald-300 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                  {section.badgeText || "LIVE"}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default UnifiedModuleNav;
