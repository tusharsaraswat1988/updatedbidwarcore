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
import { AuctionFanRenderer } from "@/components/fan/auction-fan-renderer";
import { CricketFanRenderer } from "@/components/fan/cricket-fan-renderer";
import { BadmintonFanRenderer } from "@/components/fan/badminton-fan-renderer";
import { PrivateTournamentGate } from "@/components/fan/private-tournament-gate";
import { Trophy } from "lucide-react";

export function UnsupportedSportFallback({
  sport,
  tournamentName,
}: {
  sport?: string | null;
  tournamentName?: string;
}) {
  return (
    <section
      aria-label="Unsupported Sport Experience"
      className="flex-1 flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-3xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm my-4 max-w-lg mx-auto"
    >
      <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4">
        <Trophy className="w-7 h-7" />
      </div>
      <h3 className="font-display font-black text-xl !text-white tracking-wide mb-2 capitalize">
        {sport || "Sport"} Scoring Setup
      </h3>
      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
        Public live scoring for <span className="text-white font-semibold capitalize">{sport || "this sport"}</span> is being configured for <span className="text-white font-semibold">{tournamentName}</span>. Fixtures and tournament announcements will appear here once live scoring commences.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs text-slate-300">
        <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10 capitalize">
          Sport: <span className="font-semibold text-amber-400">{sport || "General"}</span>
        </span>
        <span className="px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/10">
          Status: <span className="font-semibold text-slate-300">Pending Setup</span>
        </span>
      </div>
    </section>
  );
}

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

  // Stored access PIN for private tournaments
  const [accessPin, setAccessPin] = useState<string | null>(() => {
    if (typeof window === "undefined" || !tournamentId) return null;
    try {
      return sessionStorage.getItem(`bidwar_private_pin_${tournamentId}`);
    } catch {
      return null;
    }
  });

  // Fetch full tournament configuration
  const {
    data: tournament,
    isLoading: isLoadingTournament,
    error,
    refetch,
  } = useGetTournament(tournamentId, {
    query: {
      queryKey: [...getGetTournamentQueryKey(tournamentId), accessPin || ""],
      enabled: tournamentId > 0,
      staleTime: 15_000,
      retry: (failureCount, err) => {
        if ((err as any)?.status === 403) return false;
        return failureCount < 2;
      },
    },
    request: {
      headers: accessPin ? { "x-bidwar-pin": accessPin } : {},
    },
  });

  const isPrivateLocked = (error as any)?.status === 403 || (error as any)?.data?.code === "PRIVATE_TOURNAMENT";

  const handleUnlockPin = useCallback(
    async (pin: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}?pin=${encodeURIComponent(pin)}`);
        if (res.ok) {
          try {
            sessionStorage.setItem(`bidwar_private_pin_${tournamentId}`, pin);
          } catch {}
          setAccessPin(pin);
          await refetch();
          return true;
        }
        return false;
      } catch {
        return false;
      }
    },
    [tournamentId, refetch]
  );

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
      if (urlTab === "scoring") return "scoring";
      if (urlTab === "auction") return "auction";
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

  // Sync state when tournament capabilities finish loading asynchronously
  useEffect(() => {
    if (!tournament) return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = urlParams.get("tab");
      if (urlTab === "scoring" && showScoringTab) {
        setActiveTab("scoring");
        return;
      }
      if (urlTab === "auction" && showAuctionTab) {
        setActiveTab("auction");
        return;
      }
    } catch {}

    if (!showAuctionTab && showScoringTab && activeTab !== "scoring") {
      setActiveTab("scoring");
    } else if (showAuctionTab && !showScoringTab && activeTab !== "auction") {
      setActiveTab("auction");
    }
  }, [tournament, showAuctionTab, showScoringTab]);

  // Handle user manual tab change with URL query sync and history preservation
  const handleTabChange = useCallback(
    (nextTab: FanModuleTab) => {
      setActiveTab(nextTab);

      if (typeof window !== "undefined") {
        try {
          const url = new URL(window.location.href);
          if (url.searchParams.get("tab") !== nextTab) {
            url.searchParams.set("tab", nextTab);
            window.history.pushState({ tab: nextTab }, "", url.toString());
          }

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
    function handlePopState(event: PopStateEvent) {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTab = urlParams.get("tab") || (event.state && event.state.tab);
        if (urlTab === "scoring" && showScoringTab) {
          setActiveTab("scoring");
        } else if (urlTab === "auction" && showAuctionTab) {
          setActiveTab("auction");
        } else if (!urlTab) {
          setActiveTab(showAuctionTab ? "auction" : "scoring");
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
      {/* ── Active Module Spectator Renderer (Zero Duplicate Connection Lifecycle) ── */}
      {activeTab === "auction" && showAuctionTab && (
        <AuctionFanRenderer tournamentId={tournamentId} />
      )}

      {activeTab === "scoring" && showScoringTab && sport === "cricket" && (
        <CricketFanRenderer tournamentId={tournamentId} />
      )}

      {activeTab === "scoring" && showScoringTab && sport === "badminton" && (
        <BadmintonFanRenderer tournamentId={tournamentId} />
      )}

      {activeTab === "scoring" && showScoringTab && sport !== "cricket" && sport !== "badminton" && (
        <UnsupportedSportFallback sport={sport} tournamentName={tournament.name} />
      )}
    </UnifiedFanPageShell>
  );
}
