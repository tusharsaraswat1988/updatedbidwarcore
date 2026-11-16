import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  isAuctionEnabled,
  isScoringEnabled,
  resolveTournamentProductMode,
  isScoringSupportedSport,
} from "@workspace/platform-core";
import {
  UnifiedFanPageShell,
  UnifiedFanPageLoadingSkeleton,
  UnifiedFanPageErrorState,
} from "@/components/fan/unified-fan-page-shell";
import type { FanModuleTab } from "@/components/fan/unified-module-nav";
import { Gavel, Trophy, ShieldCheck, Sparkles, Activity } from "lucide-react";

export interface UnifiedFanPageProps {
  routeIdentifier?: string;
}

export default function UnifiedFanPage({ routeIdentifier }: UnifiedFanPageProps) {
  const [, params] = useRoute("/tournament/:id/fan");
  const rawIdentifier = (routeIdentifier || params?.id || "").trim();

  const isNumeric = /^\d+$/.test(rawIdentifier);
  const numericId = isNumeric ? parseInt(rawIdentifier, 10) : 0;

  // Resolve alphanumeric tournament code if an 8-character code was passed (e.g. RC732504)
  const { data: codeContext, isLoading: isResolvingCode } = useQuery({
    queryKey: ["tournament-code-context", rawIdentifier],
    queryFn: async () => {
      const res = await fetch(`/api/register/${encodeURIComponent(rawIdentifier)}/context`);
      if (!res.ok) return null;
      return (await res.json()) as { tournament: { id: number; name: string } };
    },
    enabled: !isNumeric && !!rawIdentifier && rawIdentifier !== "0",
    staleTime: 60_000,
  });

  const tournamentId = numericId || codeContext?.tournament?.id || 0;

  // Fetch full tournament configuration
  const {
    data: tournament,
    isLoading: isLoadingTournament,
    error,
    refetch,
  } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: tournamentId > 0,
      staleTime: 15_000,
    },
  });

  // Sound preference state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("bidwar_fan_sound_enabled") !== "false";
    } catch {
      return true;
    }
  });

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("bidwar_fan_sound_enabled", String(next));
      } catch {}
      return next;
    });
  }, []);

  // Module enablement and sport capability derivation
  const auctionEnabled = isAuctionEnabled(tournament);
  const scoringEnabled = isScoringEnabled(tournament);
  const sport = (tournament?.sport || "").trim().toLowerCase();
  const isScoringSupported = isScoringSupportedSport(sport);

  const productMode = useMemo(() => {
    if (!tournament) return "auction_only";
    try {
      return resolveTournamentProductMode(tournament);
    } catch {
      return "auction_only";
    }
  }, [tournament]);

  const showAuctionTab = auctionEnabled;
  const showScoringTab = scoringEnabled && isScoringSupported;

  // URL-Synchronized Tab State Management
  const getInitialTab = useCallback((): FanModuleTab => {
    if (typeof window === "undefined") return "auction";

    // 1. Check URL query parameters (?tab=auction or ?tab=scoring)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = urlParams.get("tab");
      if (urlTab === "scoring" && showScoringTab) return "scoring";
      if (urlTab === "auction" && showAuctionTab) return "auction";
    } catch {}

    // 2. Check local device preference
    if (tournamentId > 0) {
      try {
        const stored = localStorage.getItem(`bidwar_fan_pref_${tournamentId}`);
        if (stored === "scoring" && showScoringTab) return "scoring";
        if (stored === "auction" && showAuctionTab) return "auction";
      } catch {}
    }

    // 3. Deterministic fallback based on enabled modules
    if (showScoringTab && !showAuctionTab) return "scoring";
    return "auction";
  }, [showAuctionTab, showScoringTab, tournamentId]);

  const [activeTab, setActiveTab] = useState<FanModuleTab>(getInitialTab);

  // Sync state if tournament capabilities load asynchronously
  useEffect(() => {
    if (!showAuctionTab && showScoringTab && activeTab !== "scoring") {
      setActiveTab("scoring");
    } else if (showAuctionTab && !showScoringTab && activeTab !== "auction") {
      setActiveTab("auction");
    }
  }, [showAuctionTab, showScoringTab, activeTab]);

  // Handle user manual tab change with URL query sync and history preservation
  const handleTabChange = useCallback(
    (nextTab: FanModuleTab) => {
      setActiveTab(nextTab);

      if (typeof window !== "undefined") {
        try {
          const url = new URL(window.location.href);
          url.searchParams.set("tab", nextTab);
          window.history.replaceState(null, "", url.toString());

          if (tournamentId > 0) {
            localStorage.setItem(`bidwar_fan_pref_${tournamentId}`, nextTab);
          }
        } catch {}
      }
    },
    [tournamentId]
  );

  // Listen to browser Back/Forward (popstate) to synchronize activeTab
  useEffect(() => {
    function handlePopState() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTab = urlParams.get("tab");
        if (urlTab === "scoring" && showScoringTab) {
          setActiveTab("scoring");
        } else if (urlTab === "auction" && showAuctionTab) {
          setActiveTab("auction");
        }
      } catch {}
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showAuctionTab, showScoringTab]);

  // Loading state
  if (isResolvingCode || isLoadingTournament) {
    return <UnifiedFanPageLoadingSkeleton />;
  }

  // Error / Not found state
  if (error || !tournament || tournamentId === 0) {
    return (
      <UnifiedFanPageErrorState
        title="Tournament Not Found"
        message="The requested tournament fan page does not exist or has been removed."
        onRetry={refetch}
      />
    );
  }

  // Invalid state: neither module enabled
  if (!auctionEnabled && !scoringEnabled) {
    return (
      <UnifiedFanPageErrorState
        title="Tournament Unavailable"
        message="This tournament does not have Auction or Scoring modules enabled."
      />
    );
  }

  return (
    <UnifiedFanPageShell
      tournament={tournament}
      productMode={productMode}
      showAuctionTab={showAuctionTab}
      showScoringTab={showScoringTab}
      activeTab={activeTab}
      onTabChange={handleTabChange}
      soundEnabled={soundEnabled}
      onToggleSound={toggleSound}
    >
      {/* ── Phase 2 Placeholder Renderer Slots ───────────────────────────── */}
      {activeTab === "auction" && (
        <section
          aria-label="Auction Experience Slot"
          className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm my-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-[0_0_25px_rgba(245,158,11,0.2)]">
            <Gavel className="w-8 h-8" />
          </div>
          <h2 className="font-display font-black text-xl sm:text-2xl text-white tracking-wide mb-2">
            Live Auction Viewer Slot
          </h2>
          <p className="max-w-md text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
            Unified Fan Page Shell active for <span className="text-white font-semibold">{tournament.name}</span>. Full auction bidding cockpit, hammer timer, and team purses connect in Phase 3.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-300">
            <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 font-mono">
              Purse: {tournament.basePurse ? `₹${(tournament.basePurse / 10000000).toFixed(1)} Cr` : "Configured"}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 font-mono">
              Min Bid: {tournament.minBid ? `₹${tournament.minBid.toLocaleString()}` : "Configured"}
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10">
              Units: <span className="uppercase font-semibold text-amber-400">{tournament.auctionUnit || "points"}</span>
            </span>
          </div>
        </section>
      )}

      {activeTab === "scoring" && (
        <section
          aria-label="Sports Scoring Slot"
          className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm my-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
            {sport === "badminton" ? <Activity className="w-8 h-8" /> : <Trophy className="w-8 h-8" />}
          </div>
          <h2 className="font-display font-black text-xl sm:text-2xl text-white tracking-wide mb-2">
            Sports Scoring Slot ({sport.toUpperCase()})
          </h2>
          <p className="max-w-md text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
            Unified Fan Page Shell active for <span className="text-white font-semibold">{tournament.name}</span>. Realtime scorecards, points table, bracket tree, and player awards connect in Phase 3.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-300">
            <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 capitalize">
              Sport: <span className="font-semibold text-emerald-400">{sport}</span>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10">
              Scoring Phase: <span className="font-semibold">{tournament.scoringPhase || "Setup"}</span>
            </span>
          </div>
        </section>
      )}
    </UnifiedFanPageShell>
  );
}
