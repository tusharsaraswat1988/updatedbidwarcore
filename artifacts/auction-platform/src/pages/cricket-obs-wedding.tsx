import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useSearch } from "wouter";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useCricketObsLive } from "@/hooks/use-cricket-obs-live";
import { adaptCricketToBroadcastFrame } from "../components/broadcast/obs-v2";
import { useObsV2Events } from "../components/broadcast/obs-v2/use-obs-v2-events";
import { useV2Sync } from "../components/broadcast/obs-v2/obs-v2-sync";
import type { ObsV2BroadcastEvent } from "../components/broadcast/obs-v2/obs-v2-events";
import type { BroadcastFrame, BroadcastSceneId } from "../components/broadcast/obs-v2/contracts";
import { WeddingCricketBroadcastStage } from "../components/broadcast/wedding/WeddingCricketBroadcastStage";
import { makeWeddingPreviewFrame } from "../components/broadcast/wedding/preview/wedding-preview-data";
import { SuperBallActivationOverlay } from "@/components/scoring/super-ball-activation-overlay";
import { SponsorMediaLayer } from "@/components/scoring/sponsor-media-layer";
import { BroadcastMessageV2 } from "../components/broadcast/obs-v2/overlay/BroadcastMessageV2";
import { WEDDING_TOKENS } from "../components/broadcast/wedding/wedding-ui-tokens";

/**
 * Cricket Broadcast Overlay V3 — Royal Wedding Edition
 * Production Display & Interactive Review Page
 *
 * Routes:
 * - OBS Browser Source (transparent canvas):
 *     /tournament/:id/cricket/obs/wedding
 *     /cricket/obs/wedding
 * - Interactive Visual Review:
 *     /tournament/:id/cricket/obs/wedding/preview
 *     /cricket/obs/wedding/preview
 *
 * Entitlement:
 * - When accessed with a tournamentId > 0, the tournament must have `features.weddingBroadcast === true`
 *   enabled by an administrator. Otherwise, renders an unauthorized notice.
 */
export default function CricketObsWeddingPage() {
  const [, tParams] = useRoute("/tournament/:id/cricket/obs/wedding");
  const [, tPreviewParams] = useRoute("/tournament/:id/cricket/obs/wedding/preview");
  const tournamentId = parseInt(tParams?.id || tPreviewParams?.id || "0", 10);

  const search = useSearch();
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const isPreviewMode =
    searchParams.get("preview") === "1" ||
    (typeof window !== "undefined" && window.location.pathname.indexOf("/preview") !== -1);

  // ── Fetch Tournament Record to Verify Entitlement & Branding ─────────────
  const { data: tournament, isLoading: isTournamentLoading } = useGetTournament(
    tournamentId,
    {
      query: {
        queryKey: getGetTournamentQueryKey(tournamentId),
        enabled: tournamentId > 0,
      },
    }
  );

  const isWeddingEnabled = useMemo(() => {
    // If no tournament ID specified (global preview/lab mode), allow preview
    if (tournamentId <= 0) return true;
    const features = tournament?.features as Record<string, unknown> | undefined;
    return Boolean(features?.weddingBroadcast);
  }, [tournamentId, tournament]);

  // ── Preview UI State ─────────────────────────────────────────────────────
  const [scale, setScale] = useState<number>(0.65);
  const [selectedScene, setSelectedScene] = useState<BroadcastSceneId>("CRICKET");
  const [previewBackdrop, setPreviewBackdrop] = useState<
    "checker" | "smpte" | "test-magenta" | "green" | "pitch" | "transparent"
  >("checker");
  const [simulatedEvent, setSimulatedEvent] = useState<ObsV2BroadcastEvent | null>(null);

  // ── Live Data from SSE / Database ────────────────────────────────────────
  const { vm } = useCricketObsLive(
    tournamentId > 0 && isWeddingEnabled ? tournamentId : 0,
    null
  );

  // ── Sync State from Live Director Panel ──────────────────────────────────
  const [syncMessage, setSyncMessage] = useState<{
    name: string;
    details: string;
    active: boolean;
  } | null>(null);
  const [syncEvent, setSyncEvent] = useState<ObsV2BroadcastEvent | null>(null);

  useV2Sync(tournamentId || 0, (msg) => {
    if (msg.type === "TRIGGER_EVENT") {
      setSyncEvent(msg.event);
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
    } else if (msg.type === "DISMISS") {
      setSyncMessage(null);
      setSyncEvent(null);
      setSimulatedEvent(null);
    }
  });

  // ── Authoritative Event System ───────────────────────────────────────────
  const strikerRuns = vm?.striker?.runs;
  const milestone = strikerRuns === 50 ? 50 : strikerRuns === 100 ? 100 : null;

  const { activeEvent: realEvent } = useObsV2Events({
    authoritativeEvent: vm?.broadcastEvent ?? null,
    rawFlash: vm?.flash ?? null,
    flashToken: vm?.flashToken ?? null,
    flashDetail: vm?.flashDetail ?? null,
    matchId: vm?.matchId ?? null,
    phase: vm?.phase ?? "live",
    batterName: vm?.striker?.name ?? null,
    milestoneValue: milestone,
  });

  const effectiveActiveEvent = syncEvent || realEvent || simulatedEvent;

  // ── Resolve Active Broadcast Frame ───────────────────────────────────────
  const activeFrame: BroadcastFrame = useMemo(() => {
    if (tournamentId > 0 && vm) {
      const adapted = adaptCricketToBroadcastFrame({
        vm,
        tournamentLogoUrl: vm.tournamentLogoUrl,
        sponsorLogos: vm.sponsors,
      });
      return adapted;
    }

    // High fidelity preview frame fallback
    return makeWeddingPreviewFrame({
      state: "live_1st_innings",
      hasSponsors: true,
    });
  }, [tournamentId, vm]);

  // ── OBS Browser Source Mode: Enforce Transparent Document ────────────────
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

  // ── Feature Entitlement Protection Gate ──────────────────────────────────
  if (tournamentId > 0 && !isTournamentLoading && !isWeddingEnabled) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center p-8 bg-[#0F162B] text-[#FFFDF9] select-none font-sans">
        <div className="max-w-md p-8 rounded-2xl border border-[#D4AF37]/50 bg-[#182042]/90 backdrop-blur-md shadow-2xl space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400 text-xl font-bold">
            ✦
          </div>
          <h2
            className="text-xl font-bold text-[#E5C378]"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Royal Wedding Broadcast (V3)
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            This broadcast theme is not enabled for{" "}
            <strong className="text-white font-semibold">
              {tournament?.name || `Tournament #${tournamentId}`}
            </strong>
            .
          </p>
          <div className="p-3 rounded-lg bg-black/40 border border-white/10 text-xs text-slate-400">
            To unlock the Royal Wedding broadcast link and overlay, an administrator must enable the Wedding Broadcast feature in the tournament settings.
          </div>
        </div>
      </div>
    );
  }

  // ── Core Wedding Broadcast Stage Canvas ──────────────────────────────────
  const WeddingBroadcastCanvas = (
    <div className="relative w-[1920px] h-[1080px] overflow-hidden select-none">
      <WeddingCricketBroadcastStage
        frame={activeFrame}
        activeEvent={effectiveActiveEvent}
        hideFooter={true}
        weddingBranding={{
          cupTitle: tournament?.name,
          coupleTitle:
            (tournament as any)?.branding?.tournamentAccent ||
            undefined,
        }}
      />

      {/* Broadcast Message Chyron (z-35) */}
      <BroadcastMessageV2
        message={syncMessage}
        tournamentName={tournament?.name || "THE WEDDING CRICKET CUP"}
      />

      {/* Super Ball Broadcast Overlay */}
      {tournamentId > 0 && (
        <SuperBallActivationOverlay tournamentId={tournamentId} />
      )}

      {/* Sponsor Media Overlay Layer */}
      {tournamentId > 0 && (
        <SponsorMediaLayer
          tournamentId={tournamentId}
          surface="obs"
          cover="absolute"
        />
      )}
    </div>
  );

  // ── 1. OBS Browser Source Mode (Transparent 1920×1080 Canvas) ─────────────
  if (!isPreviewMode) {
    return (
      <div
        className="bw-obs-root relative overflow-hidden"
        style={{
          width: "1920px",
          height: "1080px",
          background: "transparent",
        }}
      >
        {WeddingBroadcastCanvas}
      </div>
    );
  }

  // ── 2. Interactive QA Studio Mode ─────────────────────────────────────────
  const browserSourceUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tournament/${tournamentId || 1}/cricket/obs/wedding`
      : "";

  return (
    <div className="min-h-screen w-full bg-[#080B14] text-slate-100 flex flex-col items-center justify-start p-6 font-sans">
      {/* Review Toolbar */}
      <header className="w-full max-w-7xl flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#101422] border border-[#D4AF37]/30 shadow-2xl mb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase bg-[#D4AF37] text-black">
              BIDWAR WEDDING V3
            </span>
            <h1 className="text-lg font-bold tracking-wide text-white font-serif">
              Royal Wedding Broadcast Stage — {tournament?.name || "Live Production"}
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            V3 Luxury Indian Wedding Broadcast Architecture · Dynamic Sidedness · 1920×1080 Camera Safe
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {/* Backdrop Picker */}
          <div className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
            <span className="text-slate-400 mr-1">Backdrop:</span>
            {(["checker", "pitch", "green", "smpte", "transparent"] as const).map(
              (b) => (
                <button
                  key={b}
                  onClick={() => setPreviewBackdrop(b)}
                  className={`px-2 py-0.5 rounded font-semibold transition ${
                    previewBackdrop === b
                      ? "bg-[#D4AF37] text-black"
                      : "bg-white/5 hover:bg-white/10 text-white"
                  }`}
                >
                  {b}
                </button>
              )
            )}
          </div>

          {/* Scale Slider */}
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/10">
            <span className="text-slate-400">Scale:</span>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={scale}
              onChange={(e) => setScale(parseFloat(e.target.value))}
              className="w-24 accent-[#D4AF37]"
            />
            <span className="font-mono w-10 text-right text-slate-300">
              {Math.round(scale * 100)}%
            </span>
          </div>

          {/* Event Simulation Triggers */}
          <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-lg border border-white/10">
            <span className="text-slate-400 mr-1">Trigger:</span>
            <button
              onClick={() =>
                setSimulatedEvent({
                  id: `event-${Date.now()}`,
                  type: "SIX",
                  priority: 100,
                  timestamp: Date.now(),
                  title: "SIX",
                  subtitle: "Maximum · 88m",
                })
              }
              className="px-2 py-0.5 rounded font-bold bg-[#D4AF37]/20 text-[#E5C378] hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40"
            >
              SIX
            </button>
            <button
              onClick={() =>
                setSimulatedEvent({
                  id: `event-${Date.now()}`,
                  type: "FOUR",
                  priority: 90,
                  timestamp: Date.now(),
                  title: "FOUR",
                  subtitle: "Boundary",
                })
              }
              className="px-2 py-0.5 rounded font-bold bg-[#D4AF37]/20 text-[#E5C378] hover:bg-[#D4AF37]/30 border border-[#D4AF37]/40"
            >
              FOUR
            </button>
            <button
              onClick={() =>
                setSimulatedEvent({
                  id: `event-${Date.now()}`,
                  type: "WICKET",
                  priority: 100,
                  timestamp: Date.now(),
                  title: "WICKET",
                  subtitle: "Bowled",
                })
              }
              className="px-2 py-0.5 rounded font-bold bg-[#801830]/30 text-rose-300 hover:bg-[#801830]/50 border border-rose-500/40"
            >
              WICKET
            </button>
            {simulatedEvent && (
              <button
                onClick={() => setSimulatedEvent(null)}
                className="px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Stage Viewport */}
      <div
        className="bw-preview-backdrop relative overflow-hidden rounded-xl border border-[#D4AF37]/20 shadow-2xl"
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
          {WeddingBroadcastCanvas}
        </div>
      </div>

      {/* Footer Info & Copy Link */}
      <footer className="w-full max-w-7xl mt-6 p-4 rounded-xl bg-[#101422] border border-white/5 text-slate-400 text-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="font-semibold text-slate-200">OBS Browser Source URL: </span>
          <code className="text-[#E5C378] bg-black/60 px-2 py-0.5 rounded font-mono">
            {browserSourceUrl}
          </code>
        </div>
        <div className="text-slate-500">
          Wedding Architecture:{" "}
          <code className="font-mono text-slate-300">
            components/broadcast/wedding
          </code>
        </div>
      </footer>
    </div>
  );
}
