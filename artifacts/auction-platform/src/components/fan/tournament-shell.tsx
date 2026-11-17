import React, { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import { Volume2, VolumeX, Share2, MapPin, Tv, Radio } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { syncDocumentSurfaceTheme } from "@/lib/portal-theme";
import { getBrandLogoSrc, isBrandLogoPlaceholderSrc } from "@/lib/brand-assets";
import { useBranding } from "@/hooks/use-branding";

export interface TournamentShellProps {
  tournament: any;
  moduleNav: React.ReactNode;
  children: React.ReactNode;
  soundEnabled: boolean;
  onToggleSound: () => void;
  streamUrl?: string | null;
}

export function TournamentShell({
  tournament,
  moduleNav,
  children,
  soundEnabled,
  onToggleSound,
  streamUrl,
}: TournamentShellProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const { logos } = useBranding();
  
  const brandLogoSrc = useMemo(() => {
    const candidates = [logos.mini, logos.mainReverse, logos.main];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return "/assets/branding/bidwar-reverse-logo-official.png";
  }, [logos]);

  useEffect(() => { syncDocumentSurfaceTheme(); }, []);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]" data-surface="tournament-shell">
      <header className="sticky top-0 z-40 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background))/90] backdrop-blur-md px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/fan" className="font-display font-black text-xl tracking-tighter text-[hsl(var(--primary))]">BIDWAR</Link>
            <div className="h-6 w-px bg-[hsl(var(--border))]" />
            <div className="flex items-center gap-3">
                {tournament.logoUrl ? <img src={tournament.logoUrl} className="w-8 h-8 rounded-lg object-cover" /> : null}
                <div>
                    <h1 className="font-bold text-sm truncate max-w-[150px] sm:max-w-[300px]">{tournament.name}</h1>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wider">{tournament.sport}</p>
                </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {streamUrl && (
                <button onClick={() => window.open(streamUrl, "_blank")} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/30 text-xs font-bold text-red-400">
                    <Radio className="w-3 h-3 animate-pulse" /> Live
                </button>
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
    </div>
  );
}
