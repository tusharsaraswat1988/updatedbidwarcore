import React, { createContext, useContext } from "react";
import type { FanNavSection } from "./unified-module-nav";

export interface FanNavigationContextType {
  activeSection: FanNavSection;
  onNavigateSection: (section: FanNavSection) => void;
  showStandingsTab: boolean;
  showLeadersTab: boolean;
  showMatchesTab: boolean;
  showAuctionTab: boolean;
}

export const FanNavigationContext = createContext<FanNavigationContextType>({
  activeSection: "overview",
  onNavigateSection: () => {},
  showStandingsTab: false,
  showLeadersTab: false,
  showMatchesTab: true,
  showAuctionTab: false,
});

export function useFanNavigation() {
  return useContext(FanNavigationContext);
}
