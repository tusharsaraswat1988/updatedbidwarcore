import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRoute } from "wouter";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import {
  UnifiedFanPageShell,
  UnifiedFanPageLoadingSkeleton,
  UnifiedFanPageErrorState,
} from "@/components/fan/unified-fan-page-shell";
import type { FanNavSection, FanModuleTab } from "@/components/fan/unified-module-nav";
import { FanNavigationContext } from "@/components/fan/fan-navigation-context";
import { AuctionFanRenderer } from "@/components/fan/auction-fan-renderer";
import { CricketFanRenderer } from "@/components/fan/cricket-fan-renderer";
import { BadmintonFanRenderer } from "@/components/fan/badminton-fan-renderer";
import { FanCheerWidget, type CheerTeam } from "@/components/fan/fan-cheer-widget";
import { Trophy } from "lucide-react";

// ── Inlined from @workspace/platform-core (not a dep of fan-platform) ─────────
type TournamentModuleFlags = { auctionEnabled?: boolean | null; scoringEnabled?: boolean | null };
type TournamentProductMode = "auction_only" | "scoring_only" | "both";
function isAuctionEnabled(t: TournamentModuleFlags | null | undefined): boolean { return t?.auctionEnabled ?? true; }
function isScoringEnabled(t: TournamentModuleFlags | null | undefined): boolean { return t?.scoringEnabled ?? false; }
function isScoringSupportedSport(sport: string | null | undefined): boolean {
  const s = (sport || "").trim().toLowerCase();
  return s === "cricket" || s === "badminton";
}
function resolveTournamentProductMode(t: TournamentModuleFlags | null | undefined): TournamentProductMode {
  if (isAuctionEnabled(t) && isScoringEnabled(t)) return "both";
  if (isScoringEnabled(t)) return "scoring_only";
  return "auction_only";
}
// ─────────────────────────────────────────────────────────────────────────────

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
  theme?: "dark" | "light";
  toggleTheme?: () => void;
}

export default function UnifiedFanPage({ routeIdentifier, theme, toggleTheme }: UnifiedFanPageProps) {
  const [, params] = useRoute("/tournament/:id/fan");
  const rawIdentifier = (routeIdentifier || params?.id || "").trim();

  const isNumeric = /^\d+$/.test(rawIdentifier);
  const numericId = isNumeric ? parseInt(rawIdentifier, 10) : 0;

  // Resolve alphanumeric tournament code via fetch (e.g. VN830108 → numeric ID)
  const [resolvedId, setResolvedId] = useState<number>(0);
  const [isResolvingCode, setIsResolvingCode] = useState(!isNumeric && !!rawIdentifier);

  useEffect(() => {
    if (isNumeric || !rawIdentifier) {
      setIsResolvingCode(false);
      setResolvedId(0);
      return;
    }
    let cancelled = false;
    setIsResolvingCode(true);
    fetch(`/api/register/${encodeURIComponent(rawIdentifier)}/context`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { tournament: { id: number } } | null) => {
        if (!cancelled) {
          setResolvedId(data?.tournament?.id ?? 0);
          setIsResolvingCode(false);
        }
      })
      .catch(() => { if (!cancelled) setIsResolvingCode(false); });
    return () => { cancelled = true; };
  }, [rawIdentifier, isNumeric]);

  const tournamentId = numericId || resolvedId;

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
  const showMatchesTab = showScoringTab;
  const showStandingsTab = showScoringTab && sport === "cricket";
  const showLeadersTab = showScoringTab && sport === "cricket";

  // URL-Synchronized Tab State Management
  const getInitialTab = useCallback((): FanModuleTab => {
    if (typeof window === "undefined") return "overview";

    // 1. Check URL query parameters (?tab=overview|matches|standings|leaders|auction|scoring)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = (urlParams.get("tab") || "").toLowerCase();
      if (urlTab === "auction" && showAuctionTab) return "auction";
      if (urlTab === "matches" && showMatchesTab) return "matches";
      if (urlTab === "standings" && showStandingsTab) return "standings";
      if (urlTab === "leaders" && showLeadersTab) return "leaders";
      if (urlTab === "overview" || urlTab === "scoring") return "overview";
    } catch {}

    // 2. Check local device preference
    if (tournamentId > 0) {
      try {
        const stored = localStorage.getItem(`bidwar_fan_pref_${tournamentId}`);
        if (stored === "auction" && showAuctionTab) return "auction";
        if (stored === "matches" && showMatchesTab) return "matches";
        if (stored === "standings" && showStandingsTab) return "standings";
        if (stored === "leaders" && showLeadersTab) return "leaders";
        if (stored === "overview" || stored === "scoring") return "overview";
      } catch {}
    }

    // 3. Deterministic fallback: if scoring is enabled, default to "overview"; if auction-only, "auction"
    if (showScoringTab) return "overview";
    if (showAuctionTab) return "auction";
    return "overview";
  }, [showAuctionTab, showScoringTab, showMatchesTab, showStandingsTab, showLeadersTab, tournamentId]);

  const [activeTab, setActiveTab] = useState<FanModuleTab>(getInitialTab);

  // Sync state when tournament capabilities finish loading asynchronously
  useEffect(() => {
    if (!tournament) return;

    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTab = (urlParams.get("tab") || "").toLowerCase();
      if (urlTab === "auction" && showAuctionTab) {
        setActiveTab("auction");
        return;
      }
      if (urlTab === "matches" && showMatchesTab) {
        setActiveTab("matches");
        return;
      }
      if (urlTab === "standings" && showStandingsTab) {
        setActiveTab("standings");
        return;
      }
      if (urlTab === "leaders" && showLeadersTab) {
        setActiveTab("leaders");
        return;
      }
      if (urlTab === "overview" || urlTab === "scoring") {
        setActiveTab("overview");
        return;
      }
    } catch {}

    if (!showAuctionTab && showScoringTab && activeTab === "auction") {
      setActiveTab("overview");
    } else if (showAuctionTab && !showScoringTab && activeTab !== "auction") {
      setActiveTab("auction");
    }
  }, [tournament, showAuctionTab, showScoringTab, showMatchesTab, showStandingsTab, showLeadersTab]);

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
        const urlTab = (urlParams.get("tab") || (event.state && event.state.tab) || "").toLowerCase();
        if (urlTab === "auction" && showAuctionTab) {
          setActiveTab("auction");
        } else if (urlTab === "matches" && showMatchesTab) {
          setActiveTab("matches");
        } else if (urlTab === "standings" && showStandingsTab) {
          setActiveTab("standings");
        } else if (urlTab === "leaders" && showLeadersTab) {
          setActiveTab("leaders");
        } else if (urlTab === "overview" || urlTab === "scoring") {
          setActiveTab("overview");
        } else if (!urlTab) {
          setActiveTab(showAuctionTab && !showScoringTab ? "auction" : "overview");
        }
      } catch {}
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [showAuctionTab, showScoringTab, showMatchesTab, showStandingsTab, showLeadersTab]);

  // Fetch tournament teams for the Fan Cheer system
  const [teams, setTeams] = useState<CheerTeam[]>([]);
  useEffect(() => {
    if (!tournamentId || tournamentId <= 0) return;
    let cancelled = false;
    fetch(`/api/tournaments/${tournamentId}/teams`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          setTeams(
            data.map((t: any) => ({
              id: t.id,
              name: t.name,
              shortCode: t.shortCode,
              color: t.color,
              logoUrl: t.logoUrl,
            }))
          );
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  // Cheer presets derivation
  const cheerPresets = useMemo(() => {
    const raw = (tournament as any)?.cheerMessagePresets;
    if (!raw) return null;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return null;
  }, [tournament]);

  // Live video stream URL & enablement
  const streamUrl =
    (tournament as any)?.features?.liveStreamUrl ||
    (typeof (tournament as any)?.featuresJson?.liveStreamUrl === "string"
      ? (tournament as any).featuresJson.liveStreamUrl
      : null);
  const streamEnabled = Boolean(
    ((tournament as any)?.features?.liveStreamEnabled ??
      (tournament as any)?.featuresJson?.liveStreamEnabled ??
      Boolean(streamUrl)) &&
      streamUrl
  );

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

  const isAuctionLive = (tournament.status as string) === "live" || (tournament.status as string) === "LIVE" || Boolean((tournament as any)?.isAuctionLive);
  const isScoringLive = Boolean((tournament as any)?.isScoringLive);

  return (
    <FanNavigationContext.Provider
      value={{
        activeSection: (activeTab === "scoring" ? "overview" : activeTab) as FanNavSection,
        onNavigateSection: handleTabChange as (section: FanNavSection) => void,
        showStandingsTab,
        showLeadersTab,
        showMatchesTab,
        showAuctionTab,
      }}
    >
      <UnifiedFanPageShell
        tournament={tournament}
        productMode={productMode}
        showAuctionTab={showAuctionTab}
        showScoringTab={showScoringTab}
        showMatchesTab={showMatchesTab}
        showStandingsTab={showStandingsTab}
        showLeadersTab={showLeadersTab}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        isAuctionLive={isAuctionLive}
        isScoringLive={isScoringLive}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        theme={theme}
        onToggleTheme={toggleTheme}
      >
        {/* ── Active Module Spectator Renderer (Zero Duplicate Connection Lifecycle) ── */}
        {activeTab === "auction" && showAuctionTab && (
          <AuctionFanRenderer tournamentId={tournamentId} />
        )}

        {activeTab !== "auction" && showScoringTab && sport === "cricket" && (
          <CricketFanRenderer tournamentId={tournamentId} />
        )}

        {activeTab !== "auction" && showScoringTab && sport === "badminton" && (
          <BadmintonFanRenderer tournamentId={tournamentId} />
        )}

        {activeTab !== "auction" && showScoringTab && sport !== "cricket" && sport !== "badminton" && (
          <UnsupportedSportFallback sport={sport} tournamentName={tournament.name} />
        )}

      {!showAuctionTab && !showScoringTab && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#131B2E]">
          <h2 className="font-display text-2xl font-black text-slate-900 dark:text-white">{tournament.name}</h2>
          <p className="mt-2 text-sm text-slate-500">
            This tournament is listed with basic details. Live auction and scoring open when a BidWar licence is active.
          </p>
          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["Sport", tournament.sport || "General"],
              ["City", tournament.city || "—"],
              ["Tournament Ground", (tournament as any).tournamentVenue || tournament.venue || "—"],
              ...((tournament as any).auctionVenue
                ? [["Auction Venue", (tournament as any).auctionVenue]]
                : []),
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-slate-50 px-4 py-3 dark:bg-white/[0.04]">
                <dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</dt>
                <dd className="mt-1 text-sm font-semibold capitalize text-slate-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ── Broadcast-Safe Live Fan Cheer Arena ── */}
      <FanCheerWidget
        tournamentId={tournamentId}
        teams={teams}
        cheerEnabled={(tournament as any)?.cheerMessagesEnabled ?? true}
        presets={cheerPresets}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        activeModule={activeTab === "auction" ? "auction" : "scoring"}
      />
    </UnifiedFanPageShell>
    </FanNavigationContext.Provider>
  );
}
