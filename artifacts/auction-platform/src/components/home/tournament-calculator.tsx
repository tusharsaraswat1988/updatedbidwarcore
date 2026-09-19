import { Zap } from "lucide-react";
import { AuctionExperienceSimulator } from "./auction-experience-simulator";

export function TournamentCalculator({ onStartTrial }: { onStartTrial: () => void }) {
  return (
    <section id="simulator" className="mx-auto max-w-7xl px-2 sm:px-4 py-3 sm:py-5">
      <div className="panel-rail relative overflow-hidden border border-primary/25 rounded-2xl bg-card/40 p-2 sm:p-3">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-[image:var(--gradient-gold)] opacity-15 blur-3xl" />

        <div className="relative flex items-center justify-between gap-3 mb-2 px-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.2em] font-mono font-bold text-primary">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span>Live Auction Simulator</span>
            </div>
            <span className="h-3 w-px bg-white/20 hidden sm:inline-block" />
            <span className="text-xs text-muted-foreground hidden sm:inline-block">
              Interactive Organizer Desk & Connected Broadcast Screens
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-400">
              Live Interactive Engine
            </span>
          </div>
        </div>

        <AuctionExperienceSimulator onStartTrial={onStartTrial} />
      </div>
    </section>
  );
}
