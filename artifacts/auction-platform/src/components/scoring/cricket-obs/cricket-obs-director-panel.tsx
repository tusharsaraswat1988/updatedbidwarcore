import { useState, useCallback, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { CricketObsFlashKind, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import { Tv, Radio, Sparkles, Eye, CheckCircle2 } from "lucide-react";

type Props = {
  tournamentId: number;
};

export function CricketObsDirectorPanel({ tournamentId }: Props) {
  const { toast } = useToast();
  const [currentOverlay, setCurrentOverlay] = useState<CricketObsMidOverlayKind>("none");
  const [lastTriggeredFlash, setLastTriggeredFlash] = useState<string | null>(null);

  const broadcastCommand = useCallback(
    (message: { type: string; overlay?: CricketObsMidOverlayKind; flash?: CricketObsFlashKind; detail?: string }) => {
      if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
      try {
        const channel = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
        channel.postMessage(message);
        channel.close();
      } catch (err) {
        console.error("Failed to broadcast to OBS channel:", err);
      }
    },
    [tournamentId],
  );

  const handleSetOverlay = useCallback(
    (overlay: CricketObsMidOverlayKind, label: string) => {
      setCurrentOverlay(overlay);
      broadcastCommand({ type: "SET_OVERLAY", overlay });
      toast({
        title: `OBS Screen: ${label}`,
        description: overlay === "none" ? "Overlay closed. Camera feed unobstructed." : `80% ${label} displayed on live stream.`,
      });
    },
    [broadcastCommand, toast],
  );

  const handleTriggerFlash = useCallback(
    (flash: CricketObsFlashKind, label: string) => {
      setLastTriggeredFlash(label);
      broadcastCommand({ type: "TRIGGER_FLASH", flash });
      toast({
        title: `Triggered Animation: ${label}`,
        description: "Graphic animated onto OBS screen and will hold for 3.5s.",
      });
      setTimeout(() => {
        setLastTriggeredFlash(null);
      }, 3500);
    },
    [broadcastCommand, toast],
  );

  const overlayOptions: { id: CricketObsMidOverlayKind; label: string; desc: string; icon: string }[] = [
    { id: "none", label: "Camera Feed Only", desc: "No mid overlay. Camera feed 100% visible.", icon: "🎥" },
    { id: "sponsors", label: "Sponsors Showcase", desc: "80% Screen Sponsor Wall (Title, Powered By, Associate)", icon: "★" },
    { id: "standings", label: "Points Table", desc: "80% Screen Tournament Standings & Rankings", icon: "📊" },
    { id: "fixtures", label: "Upcoming Matches", desc: "80% Screen Next Fixtures & Schedule", icon: "📅" },
    { id: "scorecard", label: "Full Scorecard", desc: "80% Screen Bowling Card & Fall of Wickets", icon: "📋" },
    { id: "summary", label: "Match Summary", desc: "80% Screen Post-Match Summary & Performers", icon: "🏆" },
    { id: "intro", label: "Match Intro / VS", desc: "80% Screen 3D Team Badges & Match Details", icon: "⚔️" },
  ];

  const animationOptions: { flash: CricketObsFlashKind; label: string; color: string }[] = [
    { flash: "FOUR", label: "⚡ Four (Boundary)", color: "bg-blue-600 hover:bg-blue-500 text-white" },
    { flash: "SIX", label: "💥 Six (Maximum)", color: "bg-purple-600 hover:bg-purple-500 text-white" },
    { flash: "SUPERBALL", label: "🔥 Superball", color: "bg-orange-600 hover:bg-orange-500 text-white" },
    { flash: "WICKET", label: "🚨 Wicket (Out)", color: "bg-red-600 hover:bg-red-500 text-white" },
    { flash: "FREE_HIT", label: "🎯 Free Hit", color: "bg-cyan-600 hover:bg-cyan-500 text-white" },
    { flash: "NO_BALL", label: "⚠️ No Ball", color: "bg-amber-600 hover:bg-amber-500 text-white" },
    { flash: "WIDE", label: "Wide", color: "bg-slate-700 hover:bg-slate-600 text-white" },
    { flash: "NEW_BATSMAN", label: "🏏 New Batsman", color: "bg-emerald-600 hover:bg-emerald-500 text-white" },
    { flash: "TOSS_WIN", label: "🪙 Toss Win", color: "bg-yellow-700 hover:bg-yellow-600 text-white" },
  ];

  return (
    <section className="rounded-xl border border-border bg-card/90 p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              Cricket OBS Screen Director &amp; Triggers
            </h2>
            <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider bg-primary/10 text-primary">
              Live Sync
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trigger full-screen 80% broadcast overlays and instant scoring animations on your streaming team&apos;s OBS screen in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Active on OBS:</span>
          <Badge
            variant={currentOverlay === "none" ? "outline" : "default"}
            className="text-xs font-bold uppercase tracking-wider"
          >
            {currentOverlay === "none" ? "Camera Only" : currentOverlay.toUpperCase()}
          </Badge>
        </div>
      </div>

      {/* 1. 80% SCREEN OVERLAYS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            80% Screen Mid Overlays (Frosted Broadcast Cards)
          </span>
          <span className="text-[11px] text-muted-foreground">
            Click any button to switch the OBS screen display
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {overlayOptions.map((item) => {
            const isActive = currentOverlay === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSetOverlay(item.id, item.label)}
                className={`flex flex-col items-start p-3 rounded-lg border text-left transition ${
                  isActive
                    ? "border-primary bg-primary/10 text-primary ring-1 ring-primary shadow-sm"
                    : "border-border bg-background hover:bg-muted/60 text-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base">{item.icon}</span>
                  {isActive ? <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> : null}
                </div>
                <span className="text-xs font-bold mt-1.5 line-clamp-1">{item.label}</span>
                <span className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. REAL-TIME SCORING ANIMATIONS */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Instant Scoring Animations (3.5s On-Screen Burst)
          </span>
          {lastTriggeredFlash ? (
            <span className="text-[11px] font-bold text-amber-500 animate-pulse">
              Sent: {lastTriggeredFlash}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Auto-triggers on scorer actions, or test manually below
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {animationOptions.map((item) => (
            <button
              key={item.flash}
              type="button"
              onClick={() => handleTriggerFlash(item.flash, item.label)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition active:scale-95 ${item.color}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
