import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Volume2, VolumeX, Share2, MapPin } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UnifiedModuleNav, type FanModuleTab } from "./unified-module-nav";
import { cn } from "@/lib/utils";
import { syncDocumentSurfaceTheme } from "@/lib/portal-theme";
import { useBranding } from "@/hooks/use-branding";
import { isBrandLogoPlaceholderSrc } from "@/lib/brand-assets";

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
  const [shareOpen, setShareOpen] = useState(false);
  useEffect(() => { syncDocumentSurfaceTheme(); }, []);

  const fanPageUrl = typeof window !== "undefined" ? `${window.location.origin}/tournament/${tournament.id}/fan` : "";

  return (
    <div className={cn("min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]", className)} data-surface="unified-fan-page">
      <header className="sticky top-0 z-40 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/90] backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link href="/fan" className="font-display font-black text-2xl tracking-tighter text-[hsl(var(--primary))]">BIDWAR</Link>
            <div className="hidden sm:block h-6 w-px bg-[hsl(var(--border))]" />
            <div className="flex items-center gap-3">
                {tournament.logoUrl ? <img src={tournament.logoUrl} className="w-8 h-8 rounded-lg object-cover" /> : null}
                <div>
                    <h1 className="font-bold text-sm truncate max-w-[200px]">{tournament.name}</h1>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{tournament.sport} • {tournament.city}</p>
                </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {matchMetadata && (
                <div className="hidden sm:flex items-center gap-3 text-xs font-bold text-[hsl(var(--muted-foreground))]">
                    <span>{matchMetadata.liveCount} Live</span>
                    <span>{matchMetadata.upcomingCount} Upcoming</span>
                </div>
            )}
            <button onClick={onToggleSound} className="p-2 bg-[hsl(var(--card))] rounded-full">{soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>
            <button onClick={() => setShareOpen(true)} className="p-2 bg-[hsl(var(--card))] rounded-full"><Share2 className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      {moment && <div className="bg-[hsl(var(--amber-500))/10] border-b border-[hsl(var(--amber-500))/20] px-6 py-2">{moment}</div>}

      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col">
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
        <div className="flex-1 mt-6">{children}</div>
      </main>
      
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="bg-[hsl(var(--card))] border-[hsl(var(--border))]">
            <DialogHeader><DialogTitle>Share Tournament</DialogTitle></DialogHeader>
            <div className="p-4 bg-[hsl(var(--background))] rounded-xl text-xs font-mono">{fanPageUrl}</div>
        </DialogContent>
      </Dialog>
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
