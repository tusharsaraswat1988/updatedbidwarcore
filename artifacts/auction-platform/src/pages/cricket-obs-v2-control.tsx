/**
 * BidWar OBS V2 — Test Control
 *
 * Dedicated, authoritative testing surface for the new V2 Broadcast Overlay.
 * Designed to be opened alongside the V2 OBS Display in a separate browser window,
 * laptop screen, or tablet.
 *
 * URLs:
 * - /tournament/:id/cricket/obs/v2/control
 * - /cricket/obs/v2/control
 *
 * Architecture:
 * Control Actions
 *      ↓
 * sendV2SyncMessage (BroadcastChannel + LocalStorage + SSE)
 *      ↓
 * V2 Display (cricket-obs-v2-preview.tsx)
 *      ↓
 * V2 Event / Director Pipeline (useObsV2Events, adaptCricketToBroadcastFrame)
 *      ↓
 * V2 BroadcastStage & V2 Visual Components (ObsV2EventGraphic, Slates, Chyron, Neutral)
 */

import { useState, useMemo, useEffect } from "react";
import { useRoute } from "wouter";
import { OBS_V2 } from "@/components/broadcast/obs-v2/obs-v2-tokens";
import {
  sendV2SyncMessage,
  useV2Sync,
  type V2SyncMessage,
} from "@/components/broadcast/obs-v2/obs-v2-sync";
import type { ObsV2EventType } from "@/components/broadcast/obs-v2/obs-v2-events";
import type { CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import type { BroadcastSceneId } from "@/components/broadcast/obs-v2/contracts";

type LogEntry = {
  id: string;
  time: string;
  label: string;
  type: string;
  detail?: string;
};

export default function CricketObsV2ControlPage() {
  const [, tParams] = useRoute("/tournament/:id/cricket/obs/v2/control");
  const tournamentId = parseInt(tParams?.id || "0", 10) || 10;

  // Broadcast Message State
  const [msgName, setMsgName] = useState("SANJEEV SHARMA");
  const [msgRole, setMsgRole] = useState("President · Delhi Cricket Association");
  const [msgDetails, setMsgDetails] = useState("Guest of Honour for the Grand Finale Match");

  // Custom Batter Name for New Batsman or Milestone
  const [customBatter, setCustomBatter] = useState("Virat Kohli");

  // Activity Log
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Add log helper
  const addLog = (label: string, type: string, detail?: string) => {
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}.${now.getMilliseconds().toString().padStart(3, "0")}`;
    setLogs((prev) => [
      { id: `${Date.now()}-${Math.random()}`, time, label, type, detail },
      ...prev.slice(0, 49),
    ]);
  };

  // Sync listener to see incoming echoes / display acks
  useV2Sync(tournamentId, (msg: V2SyncMessage) => {
    if (msg.type === "PONG") {
      addLog("Display Ack", "PONG", `Display connected`);
    }
  });

  // Calculate matching display URL
  const displayUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `${origin}/tournament/${tournamentId}/cricket/obs/v2`;
  }, [tournamentId]);

  const previewUrl = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `${origin}/tournament/${tournamentId}/cricket/obs/v2/preview`;
  }, [tournamentId]);

  // Dispatchers
  const triggerFlash = (flash: ObsV2EventType, detail?: string, milestoneValue?: number) => {
    sendV2SyncMessage(tournamentId, {
      type: "TRIGGER_FLASH",
      flash,
      detail: detail ?? (flash === "NEW_BATSMAN" ? `${customBatter} · Arriving at the Crease` : undefined),
      milestoneValue,
      batter: customBatter,
    });
    addLog(`Flash: ${flash}`, "FLASH", detail ?? (milestoneValue ? `${milestoneValue} Runs` : customBatter));
  };

  const triggerSlate = (overlay: CricketObsMidOverlayKind) => {
    sendV2SyncMessage(tournamentId, {
      type: "SET_OVERLAY",
      overlay,
    });
    addLog(`Slate: ${overlay.toUpperCase()}`, "SLATE", overlay);
  };

  const setDisplayScene = (scene: BroadcastSceneId) => {
    sendV2SyncMessage(tournamentId, {
      type: "SET_SCENE",
      scene,
    });
    addLog(`Scene: ${scene}`, "SCENE", scene);
  };

  const setNeutralMode = () => {
    sendV2SyncMessage(tournamentId, {
      type: "SET_OVERLAY",
      overlay: "neutral",
    });
    addLog("Neutral Footer Mode", "DISPLAY", "Sponsor Rotation Active (4.5s)");
  };

  const clearOverlays = () => {
    sendV2SyncMessage(tournamentId, {
      type: "CLEAR_OVERLAY",
    });
    addLog("Clear Overlays", "CLEAR", "All mid-overlays cleared");
  };

  const dismissAll = () => {
    sendV2SyncMessage(tournamentId, {
      type: "DISMISS",
    });
    addLog("Dismiss All", "DISMISS", "Exit animations triggered");
  };

  const showBroadcastMessage = () => {
    if (!msgName.trim()) return;
    const combinedDetails = msgRole.trim()
      ? msgDetails.trim()
        ? `${msgRole.trim()} · ${msgDetails.trim()}`
        : msgRole.trim()
      : msgDetails.trim();

    sendV2SyncMessage(tournamentId, {
      type: "SET_BROADCAST_MESSAGE",
      broadcastMessage: {
        active: true,
        name: msgName.trim(),
        role: msgRole.trim(),
        details: combinedDetails,
      },
    });
    addLog(`Show Chyron: ${msgName}`, "CHYRON", combinedDetails);
  };

  const hideBroadcastMessage = () => {
    sendV2SyncMessage(tournamentId, {
      type: "CLEAR_BROADCAST_MESSAGE",
    });
    addLog("Dismiss Chyron", "CHYRON", "Message dismissed");
  };

  // Launch Display in new window
  const launchDisplay = () => {
    if (typeof window !== "undefined") {
      window.open(displayUrl, `bidwar_v2_display_${tournamentId}`, "width=1280,height=720,menubar=no,toolbar=no");
      addLog("Launch Display Window", "SYSTEM", displayUrl);
    }
  };

  const launchPreview = () => {
    if (typeof window !== "undefined") {
      window.open(previewUrl, `bidwar_v2_preview_${tournamentId}`, "width=1360,height=850");
      addLog("Launch Review Pad", "SYSTEM", previewUrl);
    }
  };

  // UI styling constants
  const btnStyle = (bg: string, text: string, border: string) => ({
    background: bg,
    color: text,
    borderColor: border,
  });

  return (
    <div className="min-h-screen w-full bg-[#050507] text-slate-100 flex flex-col font-sans select-none pb-12">
      {/* ─── MASTHEAD HEADER ──────────────────────────────────────────────── */}
      <header
        className="w-full flex flex-wrap items-center justify-between gap-4 p-4 border-b"
        style={{
          background: OBS_V2.color.panel,
          borderColor: OBS_V2.color.standard,
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="px-2.5 py-1 text-[11px] font-black tracking-widest uppercase rounded"
            style={{ background: OBS_V2.color.brand, color: OBS_V2.color.brandOn }}
          >
            BIDWAR V2
          </span>
          <div>
            <h1 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              BidWar OBS V2 — Test Control
              <span
                className="text-[10px] px-2 py-0.5 rounded font-mono font-semibold"
                style={{ background: "rgba(18, 207, 255, 0.15)", color: OBS_V2.color.info }}
              >
                TOURNAMENT #{tournamentId}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Live broadcast lab control for testing the NEW V2 presentation architecture across browser windows.
            </p>
          </div>
        </div>

        {/* Quick Launch Buttons */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={launchDisplay}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider rounded transition cursor-pointer flex items-center gap-2 shadow-lg"
            style={{
              background: OBS_V2.color.brand,
              color: OBS_V2.color.brandOn,
            }}
          >
            <span>⧉</span> OPEN V2 OBS DISPLAY
          </button>
          <button
            type="button"
            onClick={launchPreview}
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wider rounded transition cursor-pointer text-slate-300 hover:text-white border"
            style={{
              background: OBS_V2.color.panelElevated,
              borderColor: OBS_V2.color.standard,
            }}
          >
            OPEN REVIEW PAD
          </button>
        </div>
      </header>

      {/* ─── URL DIRECTORY BAR ────────────────────────────────────────────── */}
      <div
        className="w-full px-6 py-2.5 text-xs flex flex-wrap items-center justify-between gap-2 border-b"
        style={{
          background: OBS_V2.color.carbon,
          borderColor: OBS_V2.color.hairline,
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-slate-400 font-medium">V2 DISPLAY URL:</span>
          <code
            className="px-2 py-0.5 rounded font-mono text-[11px]"
            style={{ background: "#000", color: OBS_V2.color.brand }}
          >
            {displayUrl}
          </code>
          <span className="text-slate-500 text-[11px]">(Paste as OBS Browser Source: 1920×1080)</span>
        </div>
        <div className="flex items-center gap-4 text-slate-400 text-[11px]">
          <span>
            Transport: <strong className="text-cyan-400">BroadcastChannel + SSE</strong>
          </span>
          <span>
            Channel: <code className="text-amber-300">bidwar_v2_{tournamentId}</code>
          </span>
          <button
            type="button"
            onClick={dismissAll}
            className="px-2.5 py-0.5 rounded font-bold uppercase tracking-wider text-red-300 hover:bg-red-500/20 border border-red-500/30 transition cursor-pointer"
          >
            EMERGENCY CLEAR ALL
          </button>
        </div>
      </div>

      {/* ─── MAIN CONTROL MATRIX ──────────────────────────────────────────── */}
      <main className="max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Cricket Flash Events & Mid-Screen Slates */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* SECTION 1: CRICKET FLASH EVENTS */}
          <div
            className="p-5 rounded-xl border"
            style={{
              background: OBS_V2.color.panel,
              borderColor: OBS_V2.color.standard,
            }}
          >
            <div className="flex items-center justify-between mb-3 border-b pb-2" style={{ borderColor: OBS_V2.color.hairline }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
                <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                  Cricket Flash Events
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Framer Motion 220ms enter → 2600ms hold → 220ms exit
              </span>
            </div>

            {/* Batter context input */}
            <div className="flex items-center gap-3 mb-4 p-2 rounded bg-black/40 border border-white/5 text-xs">
              <span className="text-slate-400 shrink-0 font-medium">Active Batter:</span>
              <input
                type="text"
                value={customBatter}
                onChange={(e) => setCustomBatter(e.target.value)}
                placeholder="Batter name (e.g. Virat Kohli)"
                className="flex-1 bg-transparent text-white px-2 py-1 outline-none border-b border-white/15 focus:border-amber-400 font-mono text-xs"
              />
            </div>

            {/* Flash Buttons Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => triggerFlash("FOUR", `${customBatter} · Boundary Through Extra Cover`)}
                className="p-3 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1 shadow"
                style={btnStyle("rgba(255, 215, 0, 0.15)", OBS_V2.color.brand, OBS_V2.color.brandBorder)}
              >
                <span className="text-xl font-black font-display tracking-normal">FOUR</span>
                <span className="text-[10px] text-amber-200/60 font-sans font-normal">BOUNDARY +4</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("SIX", `${customBatter} · Cleared Into Deep Midwicket Stands`)}
                className="p-3 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1 shadow"
                style={btnStyle("rgba(167, 139, 250, 0.15)", "#c4b5fd", "rgba(167, 139, 250, 0.4)")}
              >
                <span className="text-xl font-black font-display tracking-normal">SIX</span>
                <span className="text-[10px] text-purple-200/60 font-sans font-normal">MAXIMUM +6</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("WICKET", `${customBatter} · Clean Bowled b Sharma`)}
                className="p-3 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1 shadow"
                style={btnStyle("rgba(239, 51, 64, 0.18)", "#fca5a5", OBS_V2.color.dangerBorder)}
              >
                <span className="text-xl font-black font-display tracking-normal text-red-400">WICKET</span>
                <span className="text-[10px] text-red-200/60 font-sans font-normal">DISMISSAL</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("NEW_BATSMAN", `${customBatter} · Arriving at the Crease`)}
                className="p-3 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1 shadow"
                style={btnStyle("rgba(18, 207, 255, 0.15)", OBS_V2.color.info, OBS_V2.color.infoBorder)}
              >
                <span className="text-xl font-black font-display tracking-normal">NEW BATTER</span>
                <span className="text-[10px] text-cyan-200/60 font-sans font-normal">ARRIVAL (P-65)</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("MILESTONE", undefined, 50)}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle("rgba(34, 197, 94, 0.15)", "#86efac", OBS_V2.color.successBorder)}
              >
                <span className="text-base font-black font-display">MILESTONE 50</span>
                <span className="text-[9px] text-emerald-200/60 font-sans font-normal">HALF CENTURY</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("MILESTONE", undefined, 100)}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle("rgba(34, 197, 94, 0.22)", "#4ade80", "rgba(34, 197, 94, 0.6)")}
              >
                <span className="text-base font-black font-display">MILESTONE 100</span>
                <span className="text-[9px] text-emerald-200/60 font-sans font-normal">CENTURY</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("FREE_HIT", "Free Hit Delivery Awarded")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle("rgba(18, 207, 255, 0.15)", OBS_V2.color.info, OBS_V2.color.infoBorder)}
              >
                <span className="text-base font-black font-display">FREE HIT</span>
                <span className="text-[9px] text-cyan-200/60 font-sans font-normal">NO DISMISSAL</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("SUPERBALL", "Superball Active · 2X Runs Awarded")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle("rgba(245, 158, 11, 0.15)", "#fde68a", OBS_V2.color.warningBorder)}
              >
                <span className="text-base font-black font-display">SUPERBALL</span>
                <span className="text-[9px] text-amber-200/60 font-sans font-normal">2X MULTIPLIER</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("NO_BALL", "Front Foot No Ball · +1 Extra Run")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] text-slate-300 bg-white/5 border-white/10"
              >
                <span className="text-sm font-bold font-display">NO BALL</span>
                <span className="text-[9px] text-slate-400 font-sans font-normal">+1 EXTRA RUN</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("WIDE", "Wide Delivery Outside Guideline")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] text-slate-300 bg-white/5 border-white/10"
              >
                <span className="text-sm font-bold font-display">WIDE</span>
                <span className="text-[9px] text-slate-400 font-sans font-normal">+1 EXTRA RUN</span>
              </button>

              <button
                type="button"
                onClick={() => triggerFlash("MATCH_WON", "Titans CC Won By 6 Wickets")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] col-span-2 text-emerald-300 bg-emerald-500/20 border-emerald-500/40"
              >
                <span className="text-base font-black font-display">MATCH WON</span>
                <span className="text-[9px] text-emerald-200/60 font-sans font-normal">TERMINAL VICTORY</span>
              </button>
            </div>
          </div>

          {/* SECTION 2: MID-SCREEN SLATES */}
          <div
            className="p-5 rounded-xl border"
            style={{
              background: OBS_V2.color.panel,
              borderColor: OBS_V2.color.standard,
            }}
          >
            <div className="flex items-center justify-between mb-4 border-b pb-2" style={{ borderColor: OBS_V2.color.hairline }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                  Mid-Screen Slates (1920×1080)
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Uses SlateShell & real API data sources
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => triggerSlate("sponsors")}
                className="p-3.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle(OBS_V2.color.panelElevated, OBS_V2.color.brand, OBS_V2.color.brandBorder)}
              >
                <span className="text-base font-black font-display">SPONSORS</span>
                <span className="text-[10px] text-slate-400 font-sans font-normal">Partner Showcase</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSlate("standings")}
                className="p-3.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle(OBS_V2.color.panelElevated, OBS_V2.color.info, OBS_V2.color.infoBorder)}
              >
                <span className="text-base font-black font-display">STANDINGS</span>
                <span className="text-[10px] text-slate-400 font-sans font-normal">Points Table Slate</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSlate("fixtures")}
                className="p-3.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle(OBS_V2.color.panelElevated, "#e2e8f0", OBS_V2.color.standard)}
              >
                <span className="text-base font-black font-display">FIXTURES</span>
                <span className="text-[10px] text-slate-400 font-sans font-normal">Upcoming Schedule</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSlate("scorecard")}
                className="p-3.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle(OBS_V2.color.panelElevated, OBS_V2.color.brand, OBS_V2.color.brandBorder)}
              >
                <span className="text-base font-black font-display">SCORECARD</span>
                <span className="text-[10px] text-slate-400 font-sans font-normal">Innings Figures</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSlate("summary")}
                className="p-3.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle(OBS_V2.color.panelElevated, "#86efac", OBS_V2.color.successBorder)}
              >
                <span className="text-base font-black font-display">SUMMARY</span>
                <span className="text-[10px] text-slate-400 font-sans font-normal">Match Result Card</span>
              </button>

              <button
                type="button"
                onClick={() => triggerSlate("intro")}
                className="p-3.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] flex flex-col items-center justify-center gap-1"
                style={btnStyle(OBS_V2.color.panelElevated, "#fca5a5", "rgba(239, 51, 64, 0.4)")}
              >
                <span className="text-base font-black font-display">VS INTRO</span>
                <span className="text-[10px] text-slate-400 font-sans font-normal">Cinematic Clash</span>
              </button>
            </div>
          </div>

          {/* SECTION 5: AUCTION TEST MATRIX */}
          <div
            className="p-5 rounded-xl border"
            style={{
              background: OBS_V2.color.panel,
              borderColor: OBS_V2.color.standard,
            }}
          >
            <div className="flex items-center justify-between mb-4 border-b pb-2" style={{ borderColor: OBS_V2.color.hairline }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
                <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                  Auction V2 Scene Transitions
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">
                Tests V2 BroadcastStage & exit animations
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setDisplayScene("AUCTION")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-white/5 border-white/10 text-slate-200"
              >
                PLAYER INTRO
              </button>
              <button
                type="button"
                onClick={() => setDisplayScene("AUCTION")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-amber-500/10 border-amber-500/30 text-amber-300"
              >
                BID UPDATE
              </button>
              <button
                type="button"
                onClick={() => setDisplayScene("AUCTION")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
              >
                LEADING TEAM
              </button>
              <button
                type="button"
                onClick={() => setDisplayScene("SOLD")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-emerald-500/20 border-emerald-500/40 text-emerald-300 font-display text-sm"
              >
                SOLD
              </button>
              <button
                type="button"
                onClick={() => {
                  setDisplayScene("SOLD");
                  triggerFlash("MILESTONE", "HAMMER DROPPED · PLAYER SOLD");
                }}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-emerald-500/25 border-emerald-500/50 text-emerald-200 font-display text-sm"
              >
                SOLD CELEBRATION
              </button>
              <button
                type="button"
                onClick={() => setDisplayScene("UNSOLD")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-red-500/20 border-red-500/40 text-red-300 font-display text-sm"
              >
                UNSOLD
              </button>
              <button
                type="button"
                onClick={() => setDisplayScene("UNSOLD")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-white/5 border-white/10 text-slate-300"
              >
                RETURN TO POOL
              </button>
              <button
                type="button"
                onClick={() => setDisplayScene("BREAK")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-white/5 border-white/10 text-slate-300"
              >
                AUCTION BREAK
              </button>
              <button
                type="button"
                onClick={() => setDisplayScene("WAITING")}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer hover:scale-[1.02] bg-white/5 border-white/10 text-slate-300"
              >
                WAITING STANDBY
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Display Controls, Broadcast Chyron & Live Log */}
        <div className="flex flex-col gap-6">
          {/* SECTION 3: DISPLAY CONTROLS */}
          <div
            className="p-5 rounded-xl border"
            style={{
              background: OBS_V2.color.panel,
              borderColor: OBS_V2.color.standard,
            }}
          >
            <div className="flex items-center justify-between mb-4 border-b pb-2" style={{ borderColor: OBS_V2.color.hairline }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                  Display Mode
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">Scorebug / Interval</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setDisplayScene("CRICKET");
                  clearOverlays();
                }}
                className="p-3 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-between shadow"
                style={btnStyle("rgba(255, 215, 0, 0.2)", OBS_V2.color.brand, OBS_V2.color.brandBorder)}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  LIVE / SCOREBUG
                </span>
                <span className="text-[10px] text-amber-200/60 font-mono">1ST/2ND INNINGS</span>
              </button>

              <button
                type="button"
                onClick={setNeutralMode}
                className="p-3 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-between shadow"
                style={btnStyle("rgba(18, 207, 255, 0.15)", OBS_V2.color.info, OBS_V2.color.infoBorder)}
              >
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  NEUTRAL / INTERVAL
                </span>
                <span className="text-[10px] text-cyan-200/60 font-mono">4.5S ROTATION</span>
              </button>

              <button
                type="button"
                onClick={clearOverlays}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center text-slate-300 bg-white/5 border-white/10 hover:bg-white/10"
              >
                CLEAR OVERLAY / SLATE
              </button>

              <button
                type="button"
                onClick={dismissAll}
                className="p-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center text-red-300 bg-red-500/15 border-red-500/30 hover:bg-red-500/25"
              >
                DISMISS ALL GRAPHICS
              </button>
            </div>
          </div>

          {/* SECTION 4: BROADCAST MESSAGE CHYRON */}
          <div
            className="p-5 rounded-xl border"
            style={{
              background: OBS_V2.color.panel,
              borderColor: OBS_V2.color.standard,
            }}
          >
            <div className="flex items-center justify-between mb-4 border-b pb-2" style={{ borderColor: OBS_V2.color.hairline }}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400" />
                <h2 className="text-sm font-bold tracking-wider uppercase text-white">
                  Broadcast Message Chyron
                </h2>
              </div>
              <span className="text-[11px] text-slate-400">Lower-Third Card</span>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium uppercase tracking-wider">
                  Name / Title (Primary Line):
                </label>
                <input
                  type="text"
                  value={msgName}
                  onChange={(e) => setMsgName(e.target.value)}
                  placeholder="e.g. SANJEEV SHARMA"
                  className="w-full bg-black/50 text-white px-3 py-1.5 rounded border border-white/15 outline-none focus:border-amber-400 text-xs font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium uppercase tracking-wider">
                  Role / Subtitle:
                </label>
                <input
                  type="text"
                  value={msgRole}
                  onChange={(e) => setMsgRole(e.target.value)}
                  placeholder="e.g. President · DCA"
                  className="w-full bg-black/50 text-white px-3 py-1.5 rounded border border-white/15 outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-400 block mb-1 font-medium uppercase tracking-wider">
                  Details / Body Text:
                </label>
                <input
                  type="text"
                  value={msgDetails}
                  onChange={(e) => setMsgDetails(e.target.value)}
                  placeholder="e.g. Visiting for Championship Finals"
                  className="w-full bg-black/50 text-white px-3 py-1.5 rounded border border-white/15 outline-none focus:border-amber-400 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={showBroadcastMessage}
                  className="py-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer text-cyan-300 bg-cyan-500/20 border-cyan-400/40 hover:bg-cyan-500/30"
                >
                  SHOW CHYRON
                </button>
                <button
                  type="button"
                  onClick={hideBroadcastMessage}
                  className="py-2.5 rounded-lg border font-bold text-xs uppercase tracking-wider transition cursor-pointer text-red-300 bg-red-500/20 border-red-400/40 hover:bg-red-500/30"
                >
                  DISMISS
                </button>
              </div>
            </div>
          </div>

          {/* SECTION 6: LIVE EVENT LOG */}
          <div
            className="p-4 rounded-xl border flex-1 flex flex-col min-h-[220px]"
            style={{
              background: OBS_V2.color.panel,
              borderColor: OBS_V2.color.standard,
            }}
          >
            <div className="flex items-center justify-between mb-2 border-b pb-2" style={{ borderColor: OBS_V2.color.hairline }}>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Command Dispatch Feed
              </span>
              <button
                type="button"
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-500 hover:text-slate-300 uppercase cursor-pointer"
              >
                Clear Log
              </button>
            </div>

            <div className="flex-1 overflow-y-auto max-h-[220px] flex flex-col gap-1.5 font-mono text-[11px] pr-1">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-1.5 rounded bg-black/40 border border-white/5 flex items-start justify-between gap-2"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-amber-400/80 font-bold">[{log.type}]</span>
                      <span className="text-slate-200 truncate">{log.label}</span>
                    </div>
                    <span className="text-slate-500 text-[10px] shrink-0">{log.time}</span>
                  </div>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-600 text-xs italic">
                  No commands dispatched yet. Click any button above.
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
