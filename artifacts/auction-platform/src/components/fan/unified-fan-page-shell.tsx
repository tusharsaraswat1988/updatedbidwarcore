import { FanArenaShell } from "./FanArenaShell";
import { UnifiedModuleNav, type FanModuleTab } from "./unified-module-nav";
import { cn } from "@/lib/utils";
import { useBranding } from "@/hooks/use-branding";

export interface UnifiedFanPageShellProps {
  tournament: {
    id: number;
    name: string;
    sport?: string | null;
    city?: string | null;
    logoUrl?: string | null;
  };
  matchMetadata?: {
    liveCount: number;
    upcomingCount: number;
    completedCount: number;
  };
  moment?: React.ReactNode;
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
  matchMetadata,
  moment,
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
  return (
    <div data-surface="unified-fan-page">
      <FanArenaShell
        tournament={tournament}
        soundEnabled={soundEnabled}
        onToggleSound={onToggleSound}
        isLive={isAuctionLive || isScoringLive}
        moduleNav={
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
        }
      >
        {moment && <div className="bg-[hsl(var(--amber-500))/10] border-b border-[hsl(var(--amber-500))/20] px-6 py-2 -mt-6 mb-6">{moment}</div>}
        <div className={className}>{children}</div>
      </FanArenaShell>
    </div>
  );
}

export function UnifiedFanPageLoadingSkeleton() { return <div className="p-10 text-center">Loading Arena...</div>; }
export function UnifiedFanPageErrorState({ title, message, onRetry }: { title?: string; message?: string; onRetry?: () => void; }) {
    return (
        <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center justify-center p-6 text-center">
            <h2 className="font-display font-black text-xl">{title}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
            {onRetry && <button onClick={onRetry} className="mt-4 font-bold underline">Retry</button>}
        </div>
    );
}
