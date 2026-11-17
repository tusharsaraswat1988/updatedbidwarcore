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
    auctionCode?: string | null;
    auctionDate?: string | null;
    auctionTime?: string | null;
    broadcast?: {
      auction?: { url: string; status: "live" | "upcoming" | "ended"; title?: string; };
      scoring?: { url: string; status: "live" | "upcoming" | "ended"; title?: string; };
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
  const [shareOpen, setShareOpen] = useState(false);

  const fanPageUrl = typeof window !== "undefined"
    ? `${window.location.origin}/tournament/${tournament.id}/fan`
    : "";

  const brandLogoSrc = React.useMemo(() => {
    const candidates = [logos.mini, logos.mainReverse, logos.main];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return "/assets/branding/bidwar-reverse-logo-official.png";
  }, [logos]);

  useEffect(() => { syncDocumentSurfaceTheme(); }, []);

  return (
    <div className={cn("min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]", className)} data-surface="unified-fan-page">
      <header className="sticky top-0 z-40 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/90] backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link href="/fan" className="font-display font-black text-2xl tracking-tighter text-[hsl(var(--primary))]">BIDWAR</Link>
            <div className="hidden sm:block h-6 w-px bg-[hsl(var(--border))]" />
            <div>
                <h1 className="font-bold text-sm truncate max-w-[200px]">{tournament.name}</h1>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{tournament.sport} • {tournament.city}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onToggleSound} className="p-2 bg-[hsl(var(--card))] rounded-full">
                {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => setShareOpen(true)} className="p-2 bg-[hsl(var(--card))] rounded-full">
                <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

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
            <DialogHeader>
                <DialogTitle>Share Tournament</DialogTitle>
            </DialogHeader>
            <div className="p-4 bg-[hsl(var(--background))] rounded-xl text-xs font-mono">{fanPageUrl}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function UnifiedFanPageLoadingSkeleton() {
    return <div className="p-10 text-center">Loading Arena...</div>;
}

export function UnifiedFanPageErrorState({ title, message, onRetry }: { title?: string; message?: string; onRetry?: () => void; }) {
    return (
        <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col items-center justify-center p-6 text-center">
            <h2 className="font-display font-black text-xl">{title}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{message}</p>
            {onRetry && <button onClick={onRetry} className="mt-4 font-bold underline">Retry</button>}
        </div>
    );
}
