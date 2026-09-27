import { useState, useMemo, useEffect } from "react";
import { useRoute, useSearch } from "wouter";
import {
  BroadcastStage,
  type BroadcastFrame,
  type BroadcastSceneId,
  makeFrame,
  adaptCricketToBroadcastFrame,
} from "../components/broadcast/obs-v2";
import { useCricketObsLive } from "@/hooks/use-cricket-obs-live";
import { useObsV2Events } from "../components/broadcast/obs-v2/use-obs-v2-events";
import { ObsV2EventGraphic } from "../components/broadcast/obs-v2/obs-v2-event-graphic";
import type { ObsV2BroadcastEvent } from "../components/broadcast/obs-v2/obs-v2-events";
import { OBS_V2 } from "../components/broadcast/obs-v2/obs-v2-tokens";
import { BroadcastMessageV2 } from "../components/broadcast/obs-v2/overlay/BroadcastMessageV2";
import { NeutralFooterV2 } from "../components/broadcast/obs-v2/overlay/NeutralFooterV2";
import { MidScreenSlatesV2 } from "../components/broadcast/obs-v2/slates/MidScreenSlatesV2";
import { OperatorDockV2 } from "../components/broadcast/obs-v2/OperatorDockV2";
import type { CricketObsMidOverlayKind, CricketObsFlashKind } from "@/lib/cricket-obs-view-model";
import type { SponsorLogo } from "../components/broadcast/obs-v2/contracts";

import { useV2Sync, type V2SyncMessage } from "../components/broadcast/obs-v2/obs-v2-sync";
import { normalizeCricketFlashToObsV2Event } from "../components/broadcast/obs-v2/obs-v2-event-adapter";

/**
 * Cricket Broadcast Overlay V2 — Full-Featured Production Page
 *
 * Routes:
 * - OBS Browser Source:
 *     /tournament/:id/cricket/obs/v2       (transparent canvas mode)
 * - Interactive Visual Review:
 *     /tournament/:id/cricket/obs/v2/preview  (preview UI)
 *
 * Features (V2):
 * - Real live cricket data via useCricketObsLive → adaptCricketToBroadcastFrame
 * - Live event flash system (FOUR, SIX, WICKET, MILESTONE, NEW_BATSMAN, etc.)
 * - Mid-screen broadcast slates (Sponsors, Standings, Fixtures, Scorecard, Summary, VS Intro)
 * - Broadcast Message Chyron (operator-controlled lower-third)
 * - Neutral / Interval Footer (sponsor rotation 4.5s)
 * - Cross-Window V2 Live Control synchronization (BroadcastChannel + LocalStorage + SSE)
 * - Operator Dock (?dock=1 or ?controls=1)
 * - Correct phase-aware scenes (WAITING for no_live, CRICKET for all live phases)
 * - Extended scorebug (RRR, NEED X OFF Y, partnership, FREE HIT, SUPERBALL)
 */
export default function CricketObsV2Page() {
  const [, tParams] = useRoute("/tournament/:id/cricket/obs/v2");
  const [, tPreviewParams] = useRoute("/tournament/:id/cricket/obs/v2/preview");
  const tournamentId = parseInt(tParams?.id || tPreviewParams?.id || "0", 10);

  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const isPreviewMode =
    searchParams.get("preview") === "1" ||
    (typeof window !== "undefined" && window.location.pathname.indexOf("/preview") !== -1);

  const showOperatorDock =
    typeof window !== "undefined" &&
    (searchParams.get("dock") === "1" || searchParams.get("controls") === "1");

  // ── Preview UI state ─────────────────────────────────────────────────────
  const [scale, setScale] = useState<number>(0.65);
  const [showSafeGuides, setShowSafeGuides] = useState<boolean>(false);
  const [activeEvent, setActiveEvent] = useState<ObsV2BroadcastEvent | null>(null);
  const [selectedScene, setSelectedScene] = useState<BroadcastSceneId>("CRICKET");
  const [previewBackdrop, setPreviewBackdrop] = useState<"checker" | "smpte" | "test-magenta" | "green" | "pitch" | "transparent">("checker");

  // Test background param support
  const testBgParam = searchParams.get("test_bg") || (searchParams.get("test") === "1" ? "smpte" : null);

  // ── Live data from SSE / Database ────────────────────────────────────────
  const {
    vm,
    scoringActive,
    isLoading,
    setMidOverlay,
    triggerFlash,
  } = useCricketObsLive(tournamentId > 0 ? tournamentId : 0, null);

  // ── Sync states (driven by V2 Test Control via BroadcastChannel / SSE) ──
  const [syncOverlay, setSyncOverlay] = useState<CricketObsMidOverlayKind | null>(null);
  const [syncNeutral, setSyncNeutral] = useState<boolean | null>(null);
  const [syncMessage, setSyncMessage] = useState<{ name: string; details: string; active: boolean } | null>(null);
  const [syncEvent, setSyncEvent] = useState<ObsV2BroadcastEvent | null>(null);

  // Cross-Window V2 Synchronization Listener
  useV2Sync(tournamentId, (msg: V2SyncMessage) => {
    if (msg.type === "TRIGGER_FLASH") {
      const normalized = normalizeCricketFlashToObsV2Event({
        flash: msg.flash as any,
        token: `v2-sync-${Date.now()}-${msg.flash}`,
        detail: msg.detail,
        matchId: vm?.matchId ?? 1,
        batter: msg.batter ?? vm?.striker?.name ?? "Striker",
        milestoneValue: msg.milestoneValue,
      });
      if (normalized) {
        setSyncEvent(normalized);
        window.setTimeout(() => {
          setSyncEvent((curr) => (curr?.id === normalized.id ? null : curr));
        }, OBS_V2.motion.duration.hold + 500);
      }
    } else if (msg.type === "SET_OVERLAY") {
      setSyncOverlay(msg.overlay);
      setSyncNeutral(msg.overlay === "neutral");
    } else if (msg.type === "CLEAR_OVERLAY") {
      setSyncOverlay("none");
      setSyncNeutral(false);
    } else if (msg.type === "SET_BROADCAST_MESSAGE") {
      setSyncMessage({
        name: msg.broadcastMessage.name,
        details: msg.broadcastMessage.details || "",
        active: msg.broadcastMessage.active,
      });
    } else if (msg.type === "CLEAR_BROADCAST_MESSAGE") {
      setSyncMessage(null);
    } else if (msg.type === "SET_SCENE") {
      setSelectedScene(msg.scene);
      if (msg.scene === "CRICKET") {
        setSyncOverlay("none");
        setSyncNeutral(false);
      }
    } else if (msg.type === "DISMISS") {
      setSyncOverlay("none");
      setSyncNeutral(false);
      setSyncMessage(null);
      setSyncEvent(null);
      setActiveEvent(null);
    }
  });

  // ── Broadcast message (operator-controlled / SSE fallback) ────────────────
  const [broadcastMessage, setBroadcastMessage] = useState<{
    name: string;
    details: string;
    active: boolean;
  } | null>(null);

  // Sync from vm.broadcastMessage (SSE-sourced operator message)
  useEffect(() => {
    if (vm?.broadcastMessage && vm.broadcastMessage.active) {
      setBroadcastMessage({
        name: vm.broadcastMessage.name,
        details: vm.broadcastMessage.details || "",
        active: true,
      });
    } else if (vm?.broadcastMessage && !vm.broadcastMessage.active) {
      setBroadcastMessage((prev) => (prev ? { ...prev, active: false } : null));
    }
  }, [vm?.broadcastMessage]);

  const effectiveBroadcastMessage = syncMessage ?? broadcastMessage;

  // ── Event system ─────────────────────────────────────────────────────────
  const strikerRuns = vm?.striker?.runs;
  const milestone = strikerRuns === 50 ? 50 : strikerRuns === 100 ? 100 : null;

  const { activeEvent: realEvent } = useObsV2Events({
    rawFlash: vm?.flash ?? null,
    flashToken: vm?.flashToken ?? null,
    flashDetail: vm?.flashDetail ?? null,
    matchId: vm?.matchId ?? null,
    phase: vm?.phase ?? "live",
    batterName: vm?.striker?.name ?? null,
    milestoneValue: milestone,
  });

  const effectiveActiveEvent = syncEvent || realEvent || activeEvent;

  // ── Frame resolution ─────────────────────────────────────────────────────
  const activeFrame: BroadcastFrame = useMemo(() => {
    if (tournamentId > 0 && vm && selectedScene === "CRICKET" && vm.phase !== "no_live") {
      return adaptCricketToBroadcastFrame({ vm });
    }
    return makeFrame(selectedScene);
  }, [tournamentId, vm, selectedScene]);

  // Fallback ViewModel for Mid-Screen Slates when no DB match is running
  const fallbackVm = useMemo(() => ({
    tournamentName: activeFrame.branding?.tournamentName || "BIDWAR CRICKET",
    venueText: activeFrame.branding?.venue || "NATIONAL CRICKET STADIUM",
    runs: 164,
    wickets: 4,
    oversLabel: "17.4",
    crr: "9.28",
    batting: { id: 1, name: "DELHI PANTHERS", shortCode: "DPS" },
    bowling: { id: 2, name: "SUNBEAMS ANAADIS", shortCode: "SUN" },
    striker: { id: 101, name: "Mayank Pahuja", runs: 58, balls: 32, fours: 6, sixes: 3, strikeRate: "181.2" },
    nonStriker: { id: 102, name: "Siddharth Singh", runs: 24, balls: 14, fours: 2, sixes: 1, strikeRate: "171.4" },
    bowler: { id: 201, name: "Anubhav Bassi", overs: "3.4", maidens: 0, runsConceded: 31, wickets: 2, economy: 8.45 },
    home: { id: 1, name: "DELHI PANTHERS", shortCode: "DPS" },
    away: { id: 2, name: "SUNBEAMS ANAADIS", shortCode: "SUN" },
    sponsors: (activeFrame.sponsors?.map((s) => ({
      publicId: s.id,
      name: s.name,
      url: s.logoUrl,
      isTitleSponsor: s.tier === "title",
    })) as any) || [],
    phase: "live" as const,
  } as any), [activeFrame]);

  // ── V2 sponsors for neutral footer (from frame branding + vm) ───────────
  const neutralSponsors: SponsorLogo[] = useMemo(() => {
    if (activeFrame.sponsors && activeFrame.sponsors.length > 0) return activeFrame.sponsors;
    return [];
  }, [activeFrame.sponsors]);

  // ── Neutral mode ─────────────────────────────────────────────────────────
  const isNeutralActive = syncNeutral !== null ? syncNeutral : (vm?.isNeutralActive ?? false);

  // ── Overlay state (from sync, vm, or operator dock) ──────────────────────
  const currentOverlay: CricketObsMidOverlayKind = syncOverlay ?? vm?.midOverlay ?? "none";

  // ── OBS Browser Source: enforce transparent document ────────────────────
  useEffect(() => {
    if (isPreviewMode) return;

    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    const prev = {
      htmlBg: html.style.background,
      bodyBg: body.style.background,
      rootBg: root?.style.background ?? "",
      rootBgImage: root?.style.backgroundImage ?? "",
      rootBgColor: root?.style.backgroundColor ?? "",
      rootMinH: root?.style.minHeight ?? "",
      bodyOverflow: body.style.overflow,
    };

    html.style.background = "transparent";
    html.style.backgroundColor = "transparent";
    body.style.background = "transparent";
    body.style.backgroundColor = "transparent";
    body.style.overflow = "hidden";
    if (root) {
      root.style.background = "transparent";
      root.style.backgroundColor = "transparent";
      root.style.backgroundImage = "none";
      root.style.minHeight = "0";
    }

    return () => {
      html.style.background = prev.htmlBg;
      body.style.background = prev.bodyBg;
      body.style.overflow = prev.bodyOverflow;
      if (root) {
        root.style.background = prev.rootBg;
        root.style.backgroundImage = prev.rootBgImage;
        root.style.backgroundColor = prev.rootBgColor;
        root.style.minHeight = prev.rootMinH;
      }
    };
  }, [isPreviewMode]);

  // ── Preview simulated events ─────────────────────────────────────────────
  const triggerSimulatedEvent = (type: "FOUR" | "SIX" | "WICKET" | "50" | "NEW_BATSMAN") => {
    let event: ObsV2BroadcastEvent;
    if (type === "FOUR") {
      event = {
        id: `preview-${Date.now()}`,
        matchId: 1,
        timestamp: Date.now(),
        type: "FOUR",
        title: "BOUNDARY 4",
        subtitle: "Striker · Clean Drive Through Covers",
        accentColor: OBS_V2.color.brand,
        borderColor: OBS_V2.color.brandBorder,
        priority: 60,
      };
    } else if (type === "SIX") {
      event = {
        id: `preview-${Date.now()}`,
        matchId: 1,
        timestamp: Date.now(),
        type: "SIX",
        title: "MAXIMUM 6",
        subtitle: "Striker · Cleared Over Deep Midwicket",
        accentColor: OBS_V2.color.brand,
        borderColor: OBS_V2.color.brandBorder,
        priority: 70,
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
    } else if (type === "NEW_BATSMAN") {
      event = {
        id: `preview-${Date.now()}`,
        matchId: 1,
        timestamp: Date.now(),
        type: "NEW_BATSMAN",
        title: "NEW BATTER",
        subtitle: "Virat Kohli · Arriving at the Crease",
        accentColor: OBS_V2.color.info,
        borderColor: OBS_V2.color.infoBorder,
        priority: 65,
      };
    } else {
      event = {
        id: `preview-${Date.now()}`,
        matchId: 1,
        timestamp: Date.now(),
        type: "MILESTONE",
        title: "HALF CENTURY 50",
        subtitle: "Captain's Knock · 34 Balls (6×4, 2×6)",
        accentColor: OBS_V2.color.success,
        borderColor: OBS_V2.color.successBorder,
        priority: 80,
      };
    }

    setActiveEvent(event);
    setTimeout(() => {
      setActiveEvent((current) => (current?.id === event.id ? null : current));
    }, OBS_V2.motion.duration.hold);
  };

  // ── Operator dock handlers (preview simulated) ───────────────────────────
  const handleSetOverlay = (overlay: CricketObsMidOverlayKind) => {
    if (tournamentId > 0 && setMidOverlay) {
      setMidOverlay(overlay);
    }
  };

  const handleTriggerFlash = (flash: CricketObsFlashKind) => {
    if (tournamentId > 0 && triggerFlash) {
      triggerFlash(flash);
    } else {
      // Preview fallback
      if (flash === "FOUR") triggerSimulatedEvent("FOUR");
      else if (flash === "SIX") triggerSimulatedEvent("SIX");
      else if (flash === "WICKET") triggerSimulatedEvent("WICKET");
      else if (flash === "NEW_BATSMAN") triggerSimulatedEvent("NEW_BATSMAN");
    }
  };

  const handleSetBroadcastMessage = (name: string, details: string, active: boolean) => {
    setBroadcastMessage(active ? { name, details, active } : null);
  };

  // ── Render Helpers ────────────────────────────────────────────────────────

  /** The core V2 canvas with all overlay layers */
  const CricketV2Canvas = (
    <>
      {/* 1. Master Broadcast Stage (BroadcastStage) */}
      <BroadcastStage frame={activeFrame} />

      {/* 2. Mid-Screen Slates (z-40) — rendered ABOVE the stage */}
      <MidScreenSlatesV2
        vm={vm || fallbackVm}
        overlay={currentOverlay}
        overlayMatchId={undefined}
        overlaySponsorName={undefined}
        overlayStageOrGroup={undefined}
        tournamentId={tournamentId || 10}
      />

      {/* 3. Broadcast Message Chyron (z-35) — above scorebug, below slates */}
      <BroadcastMessageV2
        message={effectiveBroadcastMessage}
        alignRight={isNeutralActive}
      />

      {/* 4. Neutral Footer (z-20, replaces scorebug) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          pointerEvents: "none",
          zIndex: 22,
        }}
      >
        <NeutralFooterV2
          tournamentName={activeFrame.branding?.tournamentName || vm?.tournamentName || ""}
          tournamentLogoUrl={activeFrame.branding?.tournamentLogoUrl}
          sponsors={neutralSponsors}
          isActive={isNeutralActive}
        />
      </div>

      {/* 5. Event Graphic Flash Bar (z-50, above scorebug) */}
      {effectiveActiveEvent && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 200, zIndex: OBS_V2.layer.eventFlash }}>
          <ObsV2EventGraphic event={effectiveActiveEvent} />
        </div>
      )}

      {/* 6. Safe Guides (debug only) */}
      {showSafeGuides && (
        <div className="bw-safe-guide" aria-hidden>
          CAMERA SAFE AREA — 100% TRANSPARENT (Y: 96px → 880px)
        </div>
      )}

      {/* 7. Operator Dock (?dock=1 or ?controls=1) */}
      {showOperatorDock && (
        <OperatorDockV2
          currentOverlay={currentOverlay}
          onSetOverlay={handleSetOverlay}
          onTriggerFlash={handleTriggerFlash}
          onSetBroadcastMessage={handleSetBroadcastMessage}
          currentBroadcastMessage={effectiveBroadcastMessage}
        />
      )}
    </>
  );

  // ── OBS Browser Source Mode (transparent canvas) ─────────────────────────
  if (!isPreviewMode) {
    return (
      <div
        className="bw-obs-root relative overflow-hidden"
        style={{ width: "1920px", height: "1080px", background: "transparent" }}
      >
        {testBgParam && (
          <div
            className="bw-preview-backdrop absolute inset-0 z-0 pointer-events-none"
            data-bg={testBgParam}
            style={{ width: "100%", height: "100%" }}
          />
        )}
        {CricketV2Canvas}
      </div>
    );
  }

  // ── Interactive Preview Mode ──────────────────────────────────────────────
  return (
    <div className="min-h-screen w-full bg-[#07080C] text-slate-100 flex flex-col items-center justify-start p-6 font-sans">
      {/* Review Toolbar */}
      <header className="w-full max-w-7xl flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#11131A] border border-white/10 shadow-2xl mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-[#FFD700] text-black">
              BIDWAR V2
            </span>
            <h1 className="text-lg font-bold tracking-wide text-white">
              Cricket Broadcast Overlay V2 — Full Preview
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            V2 Design System · 1920×1080 · All features: slates, chyron, events, neutral footer, operator dock
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Scene */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
            <span className="text-slate-400 mr-1">Scene:</span>
            {(["CRICKET", "WAITING", "AUCTION", "SOLD", "UNSOLD", "BREAK", "SUMMARY", "TOP5", "TEAM"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSelectedScene(s)}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  selectedScene === s ? "bg-[#FFD700] text-black" : "bg-white/5 hover:bg-white/10 text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Backdrop */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
            <span className="text-slate-400 mr-1">BG:</span>
            {(["checker", "smpte", "test-magenta", "green", "pitch", "transparent"] as const).map((b) => (
              <button
                key={b}
                onClick={() => setPreviewBackdrop(b)}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  previewBackdrop === b ? "bg-[#FFD700] text-black" : "bg-white/5 hover:bg-white/10 text-white"
                }`}
              >
                {b}
              </button>
            ))}
          </div>

          {/* Scale */}
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-slate-400">Scale:</span>
            {[0.5, 0.65, 0.8, 1].map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-2 py-0.5 rounded font-semibold transition ${
                  scale === s ? "bg-[#FFD700] text-black" : "bg-white/5 hover:bg-white/10 text-white"
                }`}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>

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

          {/* Flash triggers */}
          <div className="flex items-center gap-1.5 pl-2 border-l border-white/10">
            <span className="text-slate-400">Flash:</span>
            {(
              [
                { id: "FOUR", label: "4", color: "bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 border-amber-400/40" },
                { id: "SIX", label: "6", color: "bg-yellow-400/20 hover:bg-yellow-400/30 text-yellow-300 border-yellow-400/40" },
                { id: "WICKET", label: "WKT", color: "bg-red-500/20 hover:bg-red-500/30 text-red-300 border-red-500/40" },
                { id: "50", label: "50", color: "bg-green-500/20 hover:bg-green-500/30 text-green-300 border-green-500/40" },
                { id: "NEW_BATSMAN", label: "NB", color: "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border-cyan-500/40" },
              ] as const
            ).map((btn) => (
              <button
                key={btn.id}
                onClick={() => triggerSimulatedEvent(btn.id as any)}
                className={`px-2.5 py-1 font-bold rounded border transition ${btn.color}`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Stage Viewport */}
      <div
        className="bw-preview-backdrop relative overflow-hidden rounded-xl border border-white/15 shadow-2xl"
        data-bg={previewBackdrop}
        style={{
          width: `${1920 * scale}px`,
          height: `${1080 * scale}px`,
        }}
      >
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
          {CricketV2Canvas}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full max-w-7xl mt-6 p-4 rounded-xl bg-[#0C0C10] border border-white/5 text-slate-400 text-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-semibold text-slate-200">OBS Browser Source URL: </span>
          <code className="text-[#FFD700] bg-black/60 px-2 py-0.5 rounded font-mono">
            {tournamentId > 0
              ? `http://localhost:3000/tournament/${tournamentId}/cricket/obs/v2`
              : "http://localhost:3000/cricket/obs/v2"}
          </code>
          <span className="ml-3 text-slate-500">· Add ?dock=1 for operator controls</span>
        </div>
        <div className="text-slate-500">
          V2 Architecture: <code className="font-mono text-slate-300">components/broadcast/obs-v2</code>
        </div>
      </footer>
    </div>
  );
}
