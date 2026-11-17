import React, { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Volume2, VolumeX, Share2, Radio } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { syncDocumentSurfaceTheme } from "@/lib/portal-theme";
import { useBranding } from "@/hooks/use-branding";

export interface FanArenaShellProps {
  tournament: {
    id: number;
    name: string;
    sport?: string | null;
    city?: string | null;
    logoUrl?: string | null;
  };
  moduleNav: React.ReactNode;
  children: React.ReactNode;
  soundEnabled: boolean;
  onToggleSound: () => void;
  streamUrl?: string | null;
  isLive?: boolean;
}

export function FanArenaShell({
  tournament,
  moduleNav,
  children,
  soundEnabled,
  onToggleSound,
  streamUrl,
  isLive = false,
}: FanArenaShellProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const [location] = useLocation();
  
  useEffect(() => { 
    syncDocumentSurfaceTheme(location); 
  }, [location]);

  const fanPageUrl = typeof window !== "undefined" ? `${window.location.origin}/tournament/${tournament.id}/fan` : "";

  return (
    <div className={cn("min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]", "fan-arena-shell")} data-surface="fan-arena-shell">
      <header className="sticky top-0 z-40 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/90] backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link href="/fan">
              <img src="/assets/branding/bidwar-primary-logo-official.png" alt="BIDWAR" className="h-8 w-auto" />
            </Link>
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
            {isLive && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-400">
                    <Radio className="w-3 h-3 animate-pulse" /> Live
                </div>
            )}
            <button onClick={onToggleSound} className="p-2 bg-[hsl(var(--card))] rounded-full">{soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}</button>
            <button onClick={() => setShareOpen(true)} className="p-2 bg-[hsl(var(--card))] rounded-full"><Share2 className="w-4 h-4" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full px-6 py-6 flex-1 flex flex-col">
        {moduleNav}
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
