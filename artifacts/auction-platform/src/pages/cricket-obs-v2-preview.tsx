import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import {
  ObsV2Stage,
  MOCK_OBS_V2_STAGE_DATA,
  MOCK_OBS_V2_BROADCAST_MESSAGE,
  type ObsV2StageData,
  type ObsV2BroadcastMessageData,
} from "../components/broadcast/obs-v2";
import type { ObsV2BroadcastEvent } from "../components/broadcast/obs-v2/obs-v2-events";
import { OBS_V2 } from "../components/broadcast/obs-v2/obs-v2-tokens";

/**
 * Cricket Broadcast Overlay V2 — Visual Review & Browser Source Page
 *
 * URLs:
 * - Direct OBS Browser Source: http://localhost:3000/cricket/obs/v2
 * - Interactive Review Pad:   http://localhost:3000/cricket/obs/v2/preview
 */
export default function CricketObsV2PreviewPage() {
  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const isPreviewMode =
    searchParams.get("preview") === "1" ||
    (typeof window !== "undefined" && window.location.pathname.indexOf("/preview") !== -1);

  const [scale, setScale] = useState<number>(0.65);
  const [showSafeGuides, setShowSafeGuides] = useState<boolean>(false);
  const [activeEvent, setActiveEvent] = useState<ObsV2BroadcastEvent | null>(null);
  const [showMessage, setShowMessage] = useState<boolean>(true);
  const [stageData] = useState<ObsV2StageData>(MOCK_OBS_V2_STAGE_DATA);

  const broadcastMessage: ObsV2BroadcastMessageData | null = showMessage
    ? MOCK_OBS_V2_BROADCAST_MESSAGE
    : null;

  // Trigger transient simulated broadcast events for review
  const triggerSimulatedEvent = (type: "FOUR" | "SIX" | "WICKET" | "50") => {
    let event: ObsV2BroadcastEvent;
    if (type === "FOUR") {
      event = {
        id: `preview-${Date.now()}`,
        matchId: 1,
        timestamp: Date.now(),
        type: "FOUR",
        title: "BOUNDARY 4",
        subtitle: "Titans CC · Clean Drive Through Covers",
        accentColor: OBS_V2.color.brand,
        borderColor: OBS_V2.color.brandBorder,
        priority: 70,
      };
    } else if (type === "SIX") {
      event = {
        id: `preview-${Date.now()}`,
        matchId: 1,
        timestamp: Date.now(),
        type: "SIX",
        title: "MAXIMUM 6",
        subtitle: "Titans CC · Cleared Over Deep Midwicket",
        accentColor: OBS_V2.color.brand,
        borderColor: OBS_V2.color.brandBorder,
        priority: 80,
      };
    } else if (type === "WICKET") {
      event = {
        id: `preview-${Date.now()}`,
        matchId: 1,
        timestamp: Date.now(),
        type: "WICKET",
        title: "WICKET",
        subtitle: "b Sharma · Clean Bowled",
        accentColor: OBS_V2.color.danger,
        borderColor: OBS_V2.color.dangerBorder,
        priority: 90,
      };
    } else {
      event = {
        id: `preview-${Date.now()}`,
        matchId: 1,
        timestamp: Date.now(),
        type: "MILESTONE",
        title: "FIFTY (50)",
        subtitle: "Captain's Knock · 34 Balls (6x4, 2x6)",
        accentColor: OBS_V2.color.success,
        borderColor: OBS_V2.color.successBorder,
        priority: 60,
      };
    }

    setActiveEvent(event);
    setTimeout(() => {
      setActiveEvent((current) => (current?.id === event.id ? null : current));
    }, OBS_V2.motion.duration.hold);
  };

  // Pure 1920x1080 transparent canvas when loaded as OBS browser source
  if (!isPreviewMode) {
    return (
      <div className="w-full h-full min-h-screen bg-transparent flex items-center justify-center overflow-hidden">
        <ObsV2Stage
          data={stageData}
          activeEvent={activeEvent}
          broadcastMessage={broadcastMessage}
          showSafeGuides={showSafeGuides}
        />
      </div>
    );
  }

  // Interactive Visual Review Shell
  return (
    <div className="min-h-screen w-full bg-[#07080C] text-slate-100 flex flex-col items-center justify-start p-6 font-sans">
      {/* Top Review Toolbar */}
      <header className="w-full max-w-7xl flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#11131A] border border-white/10 shadow-2xl mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-[#FFD700] text-black">
              BIDWAR V2
            </span>
            <h1 className="text-lg font-bold tracking-wide text-white">
              Cricket Broadcast Overlay V2 — Interactive Review
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Visual review pad for Master Stage, Scorebug (140px), Event Graphics, and Layer 1 Broadcast Chyron.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Scale Selector */}
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-slate-400">Scale:</span>
            {[0.5, 0.65, 0.8, 1].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  scale === s
                    ? "bg-[#FFD700] text-black"
                    : "bg-white/5 hover:bg-white/10 text-white"
                }`}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>

          {/* Toggle Broadcast Message */}
          <button
            onClick={() => setShowMessage(!showMessage)}
            className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
              showMessage
                ? "bg-amber-500/20 border-amber-400 text-amber-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            Chyron: {showMessage ? "ON" : "OFF"}
          </button>

          {/* Safe Guides */}
          <button
            onClick={() => setShowSafeGuides(!showSafeGuides)}
            className={`px-3 py-1.5 rounded-lg font-semibold border transition ${
              showSafeGuides
                ? "bg-blue-500/20 border-blue-400 text-blue-300"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
            }`}
          >
            Safe Guides: {showSafeGuides ? "ON" : "OFF"}
          </button>

          {/* Event Trigger Buttons */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
            <span className="text-slate-400">Flash:</span>
            <button
              onClick={() => triggerSimulatedEvent("FOUR")}
              className="px-2.5 py-1 bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-bold rounded border border-amber-400/40 transition"
            >
              4
            </button>
            <button
              onClick={() => triggerSimulatedEvent("SIX")}
              className="px-2.5 py-1 bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 font-bold rounded border border-yellow-400/40 transition"
            >
              6
            </button>
            <button
              onClick={() => triggerSimulatedEvent("WICKET")}
              className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded border border-red-500/40 transition"
            >
              WKT
            </button>
            <button
              onClick={() => triggerSimulatedEvent("50")}
              className="px-2.5 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-300 font-bold rounded border border-green-500/40 transition"
            >
              50
            </button>
          </div>
        </div>
      </header>

      {/* 1920x1080 Stage Viewport Frame */}
      <div
        className="relative overflow-hidden rounded-xl border border-white/15 shadow-2xl bg-black flex items-center justify-center"
        style={{
          width: `${1920 * scale}px`,
          height: `${1080 * scale}px`,
        }}
      >
        <ObsV2Stage
          scale={scale}
          data={stageData}
          activeEvent={activeEvent}
          broadcastMessage={broadcastMessage}
          showSafeGuides={showSafeGuides}
        />
      </div>

      {/* Quick Setup Notes */}
      <footer className="w-full max-w-7xl mt-6 p-4 rounded-xl bg-[#0C0C10] border border-white/5 text-slate-400 text-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-semibold text-slate-200">OBS Browser Source URL: </span>
          <code className="text-[#FFD700] bg-black/60 px-2 py-0.5 rounded font-mono">
            http://localhost:3000/cricket/obs/v2
          </code>
          <span className="ml-3 text-slate-500">(Resolution: 1920 × 1080)</span>
        </div>
        <div className="text-slate-500">
          V2 Architecture: Isolated under <code className="font-mono text-slate-300">components/broadcast/obs-v2</code>
        </div>
      </footer>
    </div>
  );
}
