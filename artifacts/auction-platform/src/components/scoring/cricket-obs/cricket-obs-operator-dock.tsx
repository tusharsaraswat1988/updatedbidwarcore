import { useState } from "react";
import type { CricketObsFlashKind, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";

type Props = {
  currentOverlay: CricketObsMidOverlayKind;
  onSetOverlay: (overlay: CricketObsMidOverlayKind) => void;
  onTriggerFlash: (flash: CricketObsFlashKind, detail?: string) => void;
};

export function CricketObsOperatorDock({
  currentOverlay,
  onSetOverlay,
  onTriggerFlash,
}: Props) {
  const [collapsed, setCollapsed] = useState(true);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="pointer-events-auto fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-amber-400/40 bg-black/85 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-amber-300 shadow-2xl backdrop-blur transition hover:scale-105 hover:bg-black"
        title="Open OBS Overlay Director Dock"
      >
        <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
        OBS DIRECTOR
      </button>
    );
  }

  return (
    <aside
      aria-label="Cricket OBS broadcast director dock"
      className="pointer-events-auto fixed bottom-3 left-1/2 -translate-x-1/2 z-50 flex max-w-4xl flex-col gap-2 rounded-2xl border border-white/20 bg-slate-950/95 p-3 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-md"
      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
    >
      <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <span className="text-xs font-black uppercase tracking-widest text-amber-400">
            BIDWAR CRICKET OBS DIRECTOR
          </span>
          <span className="text-[10px] text-white/40">· OPERATOR CONTROLS</span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="rounded px-2 py-0.5 text-[11px] font-bold text-white/50 hover:bg-white/10 hover:text-white"
        >
          ✕ MINIMIZE
        </button>
      </div>

      {/* Row 1: 80% Screen Overlays */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-wider text-white/50 mr-1">
          80% OVERLAY:
        </span>
        {(
          [
            { id: "none", label: "CAMERA ONLY" },
            { id: "sponsors", label: "★ SPONSORS" },
            { id: "standings", label: "POINTS TABLE" },
            { id: "fixtures", label: "UPCOMING" },
            { id: "scorecard", label: "FULL SCORECARD" },
            { id: "summary", label: "MATCH SUMMARY" },
            { id: "intro", label: "MATCH INTRO" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSetOverlay(item.id)}
            className={`rounded-lg px-2.5 py-1 text-xs font-black uppercase tracking-wider transition ${
              currentOverlay === item.id
                ? "bg-amber-400 text-black shadow-md shadow-amber-400/30"
                : "bg-white/10 text-white/80 hover:bg-white/20 hover:text-white"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Row 2: Animation Triggers */}
      <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-white/10">
        <span className="text-[10px] font-black uppercase tracking-wider text-white/50 mr-1">
          ANIMATION TRIGGER:
        </span>
        {(
          [
            { flash: "FOUR", label: "⚡ FOUR", color: "bg-blue-600 hover:bg-blue-500" },
            { flash: "SIX", label: "💥 SIX", color: "bg-purple-600 hover:bg-purple-500" },
            { flash: "SUPERBALL", label: "🔥 SUPERBALL", color: "bg-orange-600 hover:bg-orange-500" },
            { flash: "WICKET", label: "🚨 WICKET", color: "bg-red-600 hover:bg-red-500" },
            { flash: "FREE_HIT", label: "🎯 FREE HIT", color: "bg-cyan-600 hover:bg-cyan-500" },
            { flash: "NO_BALL", label: "⚠️ NO BALL", color: "bg-yellow-600 hover:bg-yellow-500" },
            { flash: "WIDE", label: "WIDE", color: "bg-slate-700 hover:bg-slate-600" },
            { flash: "NEW_BATSMAN", label: "🏏 NEW BATSMAN", color: "bg-emerald-700 hover:bg-emerald-600" },
            { flash: "TOSS_WIN", label: "🪙 TOSS WIN", color: "bg-amber-700 hover:bg-amber-600" },
          ] as const
        ).map((item) => (
          <button
            key={item.flash}
            type="button"
            onClick={() => onTriggerFlash(item.flash)}
            className={`rounded-lg px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white transition ${item.color}`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
