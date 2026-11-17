import React, { useState, useEffect } from "react";
import { Link } from "wouter";
import { Volume2, VolumeX, Share2, MapPin, Calendar, Radio } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { syncDocumentSurfaceTheme } from "@/lib/portal-theme";

export interface TournamentShellProps {
  tournament: {
    id: number;
    name: string;
    sport?: string | null;
    city?: string | null;
  };
  moduleNav: React.ReactNode;
  children: React.ReactNode;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function TournamentShell({
  tournament,
  moduleNav,
  children,
  soundEnabled,
  onToggleSound,
}: TournamentShellProps) {
  const [shareOpen, setShareOpen] = useState(false);
  const fanPageUrl = typeof window !== "undefined" ? `${window.location.origin}/tournament/${tournament.id}/fan` : "";

  useEffect(() => { syncDocumentSurfaceTheme(); }, []);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]" data-surface="tournament-shell">
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
