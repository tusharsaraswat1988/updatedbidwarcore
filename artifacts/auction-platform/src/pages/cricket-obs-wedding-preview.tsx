import React, { useState, useMemo, useEffect } from "react";
import {
  WeddingCricketBroadcastStage,
} from "@/components/broadcast/wedding";
import {
  makeWeddingPreviewFrame,
  type WeddingPreviewStateKind,
} from "@/components/broadcast/wedding/preview/wedding-preview-data";
import type { ObsV2BroadcastEvent } from "@/components/broadcast/obs-v2/obs-v2-events";

export default function CricketObsWeddingPreviewPage() {
  // Safe search param reading compatible with SSR/node test environments and browser
  const isObsMode = useMemo(() => {
    if (typeof window !== "undefined" && window.location?.search) {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("clean") === "1" || sp.get("obs") === "1";
    }
    return false;
  }, []);

  // State Controls
  const [matchState, setMatchState] = useState<WeddingPreviewStateKind>("live_1st_innings");
  const [isNeutralTeams, setIsNeutralTeams] = useState<boolean>(false);
  const [hasCustomLogos, setHasCustomLogos] = useState<boolean>(false);
  const [hasSponsors, setHasSponsors] = useState<boolean>(true);

  // Active Simulated Event
  const [activeEvent, setActiveEvent] = useState<ObsV2BroadcastEvent | null>(null);

  // Viewport Controls
  const [scale, setScale] = useState<number>(0.65);
  const [showSafeGuides, setShowSafeGuides] = useState<boolean>(false);
  const [backdrop, setBackdrop] = useState<"wedding_lawn" | "checker" | "smpte" | "dark" | "transparent">(
    isObsMode ? "transparent" : "wedding_lawn"
  );

  // Auto-fit to screen width on initial load if screen is small
  useEffect(() => {
    if (typeof window !== "undefined" && !isObsMode) {
      const availWidth = window.innerWidth - 64;
      if (availWidth < 1920) {
        const autoScale = Math.min(1, Math.max(0.4, Number((availWidth / 1920).toFixed(2))));
        setScale(autoScale);
      }
    }
  }, [isObsMode]);

  // Generate Authoritative Frame from isolated preview data
  const frame = useMemo(() => {
    return makeWeddingPreviewFrame({
      state: matchState,
      isNeutralTeams,
      hasCustomLogos,
      hasSponsors,
    });
  }, [matchState, isNeutralTeams, hasCustomLogos, hasSponsors]);

  // Trigger Simulated Event
  const triggerEvent = (type: "SIX" | "FOUR" | "WICKET" | "MATCH_WON" | "NONE") => {
    if (type === "NONE") {
      setActiveEvent(null);
      return;
    }

    const eventId = `preview-evt-${Date.now()}`;
    const newEvent: ObsV2BroadcastEvent = {
      id: eventId,
      type,
      matchId: 101,
      timestamp: Date.now(),
      title: type,
      subtitle: `${type} Announcement`,
      accentColor: "#D4AF37",
      borderColor: "#E5C378",
      priority: type === "MATCH_WON" ? 100 : type === "WICKET" ? 90 : type === "SIX" ? 70 : 60,
      batter: type === "FOUR" ? "Mehak T." : "Riya S.",
      bowler: "Arjun M.",
      detail: type === "SIX" ? "86 METERS" : type === "FOUR" ? "4 RUNS" : type === "WICKET" ? "BOWLED" : undefined,
      winnerName: type === "MATCH_WON" ? (isNeutralTeams ? "Royal Challengers" : "Bride's XI") : undefined,
      marginText: type === "MATCH_WON" ? "WON BY 14 RUNS" : undefined,
    };

    setActiveEvent(newEvent);
  };

  // If in clean OBS mode, render only the 1920x1080 stage with 100% transparency
  if (isObsMode) {
    return (
      <div
        className="w-[1920px] h-[1080px] bg-transparent overflow-hidden select-none"
        style={{ position: "relative" }}
      >
        <WeddingCricketBroadcastStage frame={frame} activeEvent={activeEvent} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07070A] text-white flex flex-col items-center py-6 px-4 select-none font-sans">
      {/* ── DEVELOPER QA TOOLBAR ── */}
      <header className="w-full max-w-7xl mb-5 flex flex-col gap-3 p-4 rounded-2xl bg-[#0F1017] border border-white/10 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-[#E5C378] shadow-[0_0_8px_#E5C378]" />
            <h1 className="text-base font-bold tracking-wide text-[#FFFDF9] flex items-center gap-2">
              Royal Wedding Edition · OBS Broadcast QA Studio
            </h1>
            <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
              1920×1080 Native
            </span>
          </div>

          {/* Scale Selector */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-neutral-400 font-medium mr-1">Scale:</span>
            {[0.5, 0.65, 0.8, 1].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-2.5 py-1 rounded-md font-semibold transition ${
                  scale === s
                    ? "bg-[#D4AF37] text-neutral-900 font-bold shadow-sm"
                    : "bg-white/5 hover:bg-white/10 text-neutral-300"
                }`}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
            <button
              onClick={() => setShowSafeGuides(!showSafeGuides)}
              className={`ml-2 px-2.5 py-1 rounded-md font-semibold border transition ${
                showSafeGuides
                  ? "bg-blue-500/20 border-blue-400 text-blue-300"
                  : "bg-white/5 border-white/10 text-neutral-400 hover:text-white"
              }`}
            >
              Safe Guides: {showSafeGuides ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {/* Toolbar Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
          {/* 1. Broadcast Match States */}
          <div className="flex flex-col gap-1.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
            <span className="text-neutral-400 font-semibold tracking-wider uppercase text-[10px]">
              Match Phase
            </span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "live_1st_innings", label: "Live (1st Inn)" },
                  { id: "live_chase", label: "Chase (2nd Inn)" },
                  { id: "pre_match", label: "Pre-Match" },
                  { id: "innings_break", label: "Break" },
                  { id: "match_result", label: "Final Result" },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setMatchState(s.id);
                    setActiveEvent(null);
                  }}
                  className={`px-2 py-1 rounded font-medium transition ${
                    matchState === s.id
                      ? "bg-[#D4AF37] text-neutral-900 font-bold"
                      : "bg-white/5 hover:bg-white/10 text-neutral-300"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Celebration Animation Triggers */}
          <div className="flex flex-col gap-1.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
            <span className="text-neutral-400 font-semibold tracking-wider uppercase text-[10px]">
              Celebration Motion (Zone 2)
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => triggerEvent("FOUR")}
                className="px-2 py-1 rounded font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition"
              >
                4 FOUR
              </button>
              <button
                onClick={() => triggerEvent("SIX")}
                className="px-2 py-1 rounded font-bold bg-yellow-400/20 text-yellow-300 border border-yellow-400/40 hover:bg-yellow-400/30 transition"
              >
                6 SIX
              </button>
              <button
                onClick={() => triggerEvent("WICKET")}
                className="px-2 py-1 rounded font-bold bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30 transition"
              >
                W WICKET
              </button>
              <button
                onClick={() => triggerEvent("MATCH_WON")}
                className="px-2 py-1 rounded font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition"
              >
                🏆 WINNER
              </button>
              <button
                onClick={() => triggerEvent("NONE")}
                className="px-2 py-1 rounded font-medium bg-white/5 text-neutral-400 hover:text-white transition"
              >
                Clear
              </button>
            </div>
          </div>

          {/* 3. Visual Variations */}
          <div className="flex flex-col gap-1.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
            <span className="text-neutral-400 font-semibold tracking-wider uppercase text-[10px]">
              Visual Variations
            </span>
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setIsNeutralTeams(!isNeutralTeams)}
                className={`px-2 py-1 rounded font-medium border transition ${
                  isNeutralTeams
                    ? "bg-purple-500/20 border-purple-400 text-purple-300"
                    : "bg-white/5 border-white/10 text-neutral-300"
                }`}
              >
                {isNeutralTeams ? "Neutral Teams" : "Bride vs Groom"}
              </button>
              <button
                onClick={() => setHasCustomLogos(!hasCustomLogos)}
                className={`px-2 py-1 rounded font-medium border transition ${
                  hasCustomLogos
                    ? "bg-cyan-500/20 border-cyan-400 text-cyan-300"
                    : "bg-white/5 border-white/10 text-neutral-300"
                }`}
              >
                {hasCustomLogos ? "Custom Logos" : "Vector Avatars"}
              </button>
              <button
                onClick={() => setHasSponsors(!hasSponsors)}
                className={`px-2 py-1 rounded font-medium border transition ${
                  hasSponsors
                    ? "bg-emerald-500/20 border-emerald-400 text-emerald-300"
                    : "bg-white/5 border-white/10 text-neutral-300"
                }`}
              >
                {hasSponsors ? "Sponsors ON" : "Sponsors OFF"}
              </button>
            </div>
          </div>

          {/* 4. Backdrop Environment */}
          <div className="flex flex-col gap-1.5 bg-black/30 p-2.5 rounded-xl border border-white/5">
            <span className="text-neutral-400 font-semibold tracking-wider uppercase text-[10px]">
              Camera Safe Backdrop
            </span>
            <div className="flex flex-wrap gap-1">
              {(
                [
                  { id: "wedding_lawn", label: "Wedding Lawn" },
                  { id: "checker", label: "Checker" },
                  { id: "dark", label: "Dark Studio" },
                  { id: "smpte", label: "SMPTE" },
                  { id: "transparent", label: "Transparent" },
                ] as const
              ).map((b) => (
                <button
                  key={b.id}
                  onClick={() => setBackdrop(b.id)}
                  className={`px-2 py-1 rounded font-medium transition ${
                    backdrop === b.id
                      ? "bg-[#D4AF37] text-neutral-900 font-bold"
                      : "bg-white/5 hover:bg-white/10 text-neutral-300"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── STAGE VIEWPORT CANVAS ── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-white/15 shadow-2xl transition-all"
        style={{
          width: `${1920 * scale}px`,
          height: `${1080 * scale}px`,
        }}
      >
        {/* Backdrop simulation for Zone 2 camera viewport */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              backdrop === "wedding_lawn"
                ? "radial-gradient(ellipse at 50% 30%, #3A2A20 0%, #1A1A22 60%, #0F1014 100%)"
                : backdrop === "checker"
                ? "repeating-conic-gradient(#1c1d24 0% 25%, #14151a 0% 50%) 50% / 24px 24px"
                : backdrop === "smpte"
                ? "linear-gradient(90deg, #c0c0c0 0% 14.28%, #c0c000 14.28% 28.57%, #00c0c0 28.57% 42.85%, #00c000 42.85% 57.14%, #c000c0 57.14% 71.42%, #c00000 71.42% 85.71%, #0000c0 85.71% 100%)"
                : backdrop === "dark"
                ? "#08080C"
                : "transparent",
          }}
        />

        {/* 1920x1080 Scaled OBS Stage Container */}
        <div
          style={{
            width: "1920px",
            height: "1080px",
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
          }}
        >
          {/* Action-safe television guides (optional toggle) */}
          {showSafeGuides && (
            <div
              className="pointer-events-none absolute border-2 border-dashed border-blue-400/40 z-50"
              style={{
                top: "54px",
                left: "96px",
                width: "1728px",
                height: "972px",
              }}
            >
              <span className="absolute top-2 left-2 text-blue-300 text-xs font-mono bg-black/60 px-1.5 py-0.5 rounded">
                5% Action Safe (96×54)
              </span>
            </div>
          )}

          {/* PRODUCTION COMPONENT: WeddingCricketBroadcastStage */}
          <WeddingCricketBroadcastStage frame={frame} activeEvent={activeEvent} />
        </div>
      </div>

      {/* ── FOOTER REFERENCE BAR ── */}
      <footer className="w-full max-w-7xl mt-4 px-4 py-2.5 rounded-xl bg-[#0C0C10] border border-white/5 text-neutral-400 text-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-neutral-300">OBS Browser Source URL:</span>
          <code className="text-[#E5C378] bg-black/60 px-2 py-0.5 rounded font-mono select-all">
            {typeof window !== "undefined"
              ? `${window.location.origin}/cricket/obs-wedding-preview?clean=1`
              : "http://localhost:5000/cricket/obs-wedding-preview?clean=1"}
          </code>
        </div>
        <div className="text-neutral-500 text-[11px]">
          Component: <code className="text-neutral-400 font-mono">WeddingCricketBroadcastStage</code> · Pure Presentation Layer
        </div>
      </footer>
    </div>
  );
}
