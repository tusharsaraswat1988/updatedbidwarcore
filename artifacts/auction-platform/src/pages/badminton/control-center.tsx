/**
 * Mission Control — tournament-day command center (Live Control nav host)
 * Route: /tournament/:id/badminton/control
 *
 * Command-board layout: slim header, single page scroll, live ops rail first.
 */

/** One content width for header + board so columns stay aligned (Phase C2). */
const LIVE_CONTROL_CONTENT_CLASS = "max-w-[1600px] mx-auto px-4 sm:px-6 py-3 space-y-3";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch, fetchBadmintonMatches } from "@/lib/badminton-api";
import {
  buildCourtBoard,
  listHeldMatches,
  listReadyMatches,
  listRecentlyCompleted,
  listUpcomingFixtures,
  resolveMatchNumber,
  type ControlFixture,
  type ControlMatch,
} from "@/lib/badminton-control-center";
import {
  buildAttentionItems,
  buildSmartSuggestions,
  deriveSystemHealth,
  resolvePrimaryAction,
  resolvePrimaryBroadcast,
  sortCourtsByOpsPriority,
  type AttentionItem,
  type SmartSuggestion,
} from "@/lib/mission-control-ops";
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { useBadmintonBranding, type BadmintonBranding } from "@/hooks/use-badminton-branding";
import { useToast } from "@/hooks/use-toast";
import {
  EmptyState,
  HubPageShell,
  hubCardClass,
  inputClass,
} from "@/components/badminton/page-chrome";
import { MissionControlTopBar } from "@/components/badminton/mission-control/mission-control-top-bar";
import { MissionControlOpsRail } from "@/components/badminton/mission-control/mission-control-ops-rail";
import { MissionControlCourtCard } from "@/components/badminton/mission-control/mission-control-court-card";
import {
  MissionControlQueues,
  MissionControlReadyStrip,
} from "@/components/badminton/mission-control/mission-control-queues";
import {
  MissionControlAlerts,
  MissionControlTips,
} from "@/components/badminton/mission-control/mission-control-alerts";
import { MissionControlHealthStrip } from "@/components/badminton/mission-control/mission-control-health";
import { forceUnlockBadmintonMatch } from "@/lib/scorer-api";
import {
  BADMINTON_MATCHES_RECONNECT_POLL_MS,
  subscribeBadmintonDashboardStream,
  useBadmintonDirector,
  useBadmintonTournamentStreamStatus,
} from "@/hooks/use-badminton-match";
import type { BadmintonOverlayScene, BadmintonVenueScene } from "@/lib/badminton-broadcast-director";
import {
  applyPresentationPayload,
  isPresentationPayload,
  onPresentationError,
  onPresentationMutate,
  onPresentationSuccess,
  type PresentationMutateContext,
} from "@/lib/badminton-presentation-mutation";
import {
  isMatchStateChangedPayload,
  patchBadmintonMatchesFromLiveUpdate,
  shouldRefetchBadmintonMatches,
} from "@/lib/badminton-match-list-cache";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";

type CourtRow = {
  id: number;
  name: string;
  shortName?: string | null;
  sortOrder: number;
  scorerPin?: string | null;
  scorerName?: string | null;
  hasScorerPin?: boolean;
};

type CategoryRow = {
  id: number;
  name: string;
  code?: string | null;
};

export default function BadmintonControlCenterPage() {
  const [, params] = useRoute("/tournament/:id/badminton/control");
  const search = useSearch();
  const tournamentId = parseInt(params?.id ?? "0");
  const focusBroadcast = new URLSearchParams(search).get("focus") === "broadcast";
  const qc = useQueryClient();
  const { toast } = useToast();

  const [dismissedAttention, setDismissedAttention] = useState(() => new Set<string>());
  const [dismissedSuggestions, setDismissedSuggestions] = useState(() => new Set<string>());
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [lastRealtimeAt, setLastRealtimeAt] = useState<number | null>(null);
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [matchNoQuery, setMatchNoQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Operator page: avoid 8s branding poll fighting Moments / Auto focus clicks.
  const { data: branding, isSuccess: brandingOk } = useBadmintonBranding(tournamentId, {
    staleTime: 120_000,
    refetchInterval: false,
  });
  const tournamentSseStatus = useBadmintonTournamentStreamStatus(tournamentId);

  const {
    data: courts = [],
    isLoading: courtsLoading,
    isError: courtsError,
    error: courtsErr,
    refetch: refetchCourts,
  } = useQuery<CourtRow[]>({
    queryKey: ["badminton-courts", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/courts`),
    enabled: !!tournamentId,
  });

  const {
    data: matches = [],
    isLoading: matchesLoading,
    isError: matchesError,
    error: matchesErr,
    isSuccess: matchesOk,
    refetch: refetchMatches,
    dataUpdatedAt: matchesUpdatedAt,
  } = useQuery<ControlMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => fetchBadmintonMatches(tournamentId),
    enabled: !!tournamentId,
    staleTime: 15_000,
    // Healthy tournament SSE → no poll. Reconnect only → temporary poll.
    refetchInterval: () =>
      sseAwareRefetchInterval(tournamentSseStatus, BADMINTON_MATCHES_RECONNECT_POLL_MS),
  });

  const {
    data: fixtures = [],
    isLoading: fixturesLoading,
    isError: fixturesError,
    error: fixturesErr,
    refetch: refetchFixtures,
  } = useQuery<ControlFixture[]>({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixtures`),
    enabled: !!tournamentId,
    staleTime: 60_000,
    // Fixtures change infrequently; keep light background refresh without competing with live SSE.
    refetchInterval: 60_000,
  });

  const { data: categories = [] } = useQuery<CategoryRow[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (matchesUpdatedAt) setLastRealtimeAt(matchesUpdatedAt);
  }, [matchesUpdatedAt]);

  useEffect(() => {
    if (!tournamentId) return;
    let matchesTimer: ReturnType<typeof setTimeout> | null = null;

    // Shared pool — no second private EventSource alongside IA chrome / live-follow.
    const unsubscribe = subscribeBadmintonDashboardStream(tournamentId, (payload) => {
      setLastRealtimeAt(Date.now());
      const data =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;

      // Presentation / focus / music: patch cache only — never refetch branding
      // (refetch + await cancelQueries was freezing Auto / Moments buttons).
      if (data && isPresentationPayload(data)) {
        qc.setQueryData<BadmintonBranding | undefined>(
          ["badminton-branding", tournamentId],
          (prev) => applyPresentationPayload(prev, data),
        );
        if ("primaryBroadcastMatchId" in data) {
          if (matchesTimer) clearTimeout(matchesTimer);
          matchesTimer = setTimeout(() => {
            void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
          }, 400);
        }
        return;
      }

      // Live score path: patch one row — never GET /matches for every point.
      if (data && isMatchStateChangedPayload(data)) {
        patchBadmintonMatchesFromLiveUpdate(qc, tournamentId, data);
        return;
      }

      // Structure / schedule / create-delete only.
      if (!shouldRefetchBadmintonMatches(data)) return;
      if (matchesTimer) clearTimeout(matchesTimer);
      matchesTimer = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      }, 750);
    });

    return () => {
      if (matchesTimer) clearTimeout(matchesTimer);
      unsubscribe();
    };
  }, [tournamentId, qc]);

  const categoryName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categories) {
      map.set(c.id, c.code?.trim() || c.name);
    }
    return map;
  }, [categories]);

  const filteredMatches = useMemo(() => {
    const q = matchNoQuery.trim().toLowerCase();
    return matches.filter((m) => {
      if (statusFilter === "live" && m.status !== "live" && m.status !== "paused") return false;
      if (statusFilter === "scheduled" && m.status !== "scheduled") return false;
      if (statusFilter === "on_hold" && m.status !== "on_hold") return false;
      if (
        statusFilter === "finished" &&
        !["completed", "walkover", "retired", "disqualified", "abandoned"].includes(m.status)
      ) {
        return false;
      }
      const detail = m.detail ?? {};
      if (courtFilter !== "all") {
        const courtId = typeof detail.courtId === "number" ? detail.courtId : null;
        if (String(courtId) !== courtFilter) return false;
      }
      if (categoryFilter !== "all") {
        const catId = typeof detail.categoryId === "number" ? detail.categoryId : null;
        if (String(catId) !== categoryFilter) return false;
      }
      if (q) {
        const num = resolveMatchNumber(m).toLowerCase();
        const label = String(detail.matchLabel ?? "").toLowerCase();
        if (!num.includes(q) && !label.includes(q) && !String(m.id).includes(q)) return false;
      }
      return true;
    });
  }, [matches, courtFilter, categoryFilter, matchNoQuery, statusFilter]);

  const board = useMemo(
    () => buildCourtBoard(courts, filteredMatches, fixtures),
    [courts, filteredMatches, fixtures],
  );
  const sortedBoard = useMemo(() => {
    if (courtFilter === "all") return sortCourtsByOpsPriority(board);
    return board.filter((r) => String(r.court.id) === courtFilter);
  }, [board, courtFilter]);

  const upcoming = useMemo(() => {
    let list = listUpcomingFixtures(fixtures);
    if (courtFilter !== "all") {
      list = list.filter((f) => String(f.courtId) === courtFilter);
    }
    if (categoryFilter !== "all") {
      list = list.filter((f) => String(f.categoryId) === categoryFilter);
    }
    if (matchNoQuery.trim()) {
      const q = matchNoQuery.trim().toLowerCase();
      list = list.filter((f) => String(f.slotNumber ?? f.id).toLowerCase().includes(q));
    }
    return list;
  }, [fixtures, courtFilter, categoryFilter, matchNoQuery]);
  const ready = useMemo(() => listReadyMatches(filteredMatches), [filteredMatches]);
  const held = useMemo(() => listHeldMatches(filteredMatches), [filteredMatches]);
  const recent = useMemo(() => listRecentlyCompleted(filteredMatches), [filteredMatches]);
  const completedCount = useMemo(
    () =>
      matches.filter((m) =>
        ["completed", "walkover", "retired", "disqualified", "abandoned"].includes(m.status),
      ).length,
    [matches],
  );

  const primaryMatchId = useMemo(
    () => resolvePrimaryBroadcast(matches, branding?.primaryBroadcastMatchId ?? null),
    [matches, branding?.primaryBroadcastMatchId],
  );

  const liveCount = board.filter((r) => r.status === "LIVE").length;
  const readyCount = board.filter((r) => r.status === "READY").length;
  const delayedCount = board.filter((r) => r.status === "DELAYED").length;
  const moveTargetCourtIds = board
    .filter((r) => r.status === "EMPTY" || r.status === "DELAYED" || r.status === "FINISHED")
    .map((r) => r.court.id);

  const attention = useMemo(
    () =>
      buildAttentionItems({
        board,
        matches,
        ready,
        primaryMatchId,
        venueScene: branding?.venueScene,
        tournamentId,
      }),
    [board, matches, ready, primaryMatchId, branding?.venueScene, tournamentId],
  );

  const primaryAction = useMemo(
    () =>
      resolvePrimaryAction({
        board,
        ready,
        tournamentId,
        venueScene: branding?.venueScene,
      }),
    [board, ready, tournamentId, branding?.venueScene],
  );

  const suggestions = useMemo(
    () =>
      buildSmartSuggestions({
        board,
        ready,
        tournamentId,
        primaryMatchId,
      }),
    [board, ready, tournamentId, primaryMatchId],
  );

  const courtsWithPin = board.filter(
    (r) => !!(r.court.hasScorerPin || (r.court.scorerPin && r.court.scorerPin.trim())),
  ).length;

  const health = useMemo(
    () =>
      deriveSystemHealth({
        online,
        matchesQueryOk: matchesOk && !matchesError,
        lastRealtimeAt,
        brandingOk,
        liveCount,
        primaryMatchId,
        venueScene: branding?.venueScene,
        courtsWithPin,
        courtCount: courts.length,
      }),
    [
      online,
      matchesOk,
      matchesError,
      lastRealtimeAt,
      brandingOk,
      liveCount,
      primaryMatchId,
      branding?.venueScene,
      courtsWithPin,
      courts.length,
    ],
  );

  const emergencyActive = branding?.venueScene === "standby";

  const setPresentationMutation = useMutation({
    mutationFn: (body: {
      overlayScene?: BadmintonOverlayScene;
      venueScene?: BadmintonVenueScene;
    }) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/broadcast-presentation`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onMutate: (body) => onPresentationMutate(qc, tournamentId, body),
    onError: (err, _body, context) => {
      onPresentationError(
        qc,
        tournamentId,
        context as PresentationMutateContext | undefined,
      );
      toast({
        title: "Screen update failed",
        description: friendlyBadmintonError(err, "Try Emergency / Resume again."),
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      onPresentationSuccess(qc, tournamentId, data);
    },
  });

  const setPrimaryMutation = useMutation({
    mutationFn: (matchId: number) =>
      badmintonFetch<BadmintonBranding>(tournamentId, `/primary-broadcast`, {
        method: "PATCH",
        body: JSON.stringify({ matchId }),
      }),
    onMutate: (matchId) => {
      const previous = qc.getQueryData<BadmintonBranding>([
        "badminton-branding",
        tournamentId,
      ]);
      if (previous) {
        qc.setQueryData<BadmintonBranding>(["badminton-branding", tournamentId], {
          ...previous,
          primaryBroadcastMatchId: matchId,
        });
      }
      return { previous };
    },
    onError: (_err, _matchId, context) => {
      const prev = (context as { previous?: BadmintonBranding } | undefined)?.previous;
      if (prev) qc.setQueryData(["badminton-branding", tournamentId], prev);
    },
    onSuccess: (data) => {
      qc.setQueryData(["badminton-branding", tournamentId], data);
      toast({ title: "Screens follow this court" });
      setActivity((prev) => [
        { id: `${Date.now()}-focus`, at: Date.now(), text: "Focus court updated for Venue / OBS / LED" },
        ...prev,
      ].slice(0, 20));
    },
  });

  const moveMutation = useMutation({
    mutationFn: async ({ matchId, courtId }: { matchId: number; courtId: number }) => {
      const court = courts.find((c) => c.id === courtId);
      return badmintonFetch(tournamentId, `/matches/${matchId}`, {
        method: "PATCH",
        body: JSON.stringify({
          courtId,
          courtNumber: court?.shortName?.trim() || court?.name || String(courtId),
        }),
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      toast({ title: "Match moved" });
    },
  });

  const resumeMatchId =
    board.find((r) => r.status === "LIVE" && r.currentMatch?.status === "paused")?.currentMatch
      ?.id ?? 0;
  const director = useBadmintonDirector(tournamentId, resumeMatchId);

  const onEmergency = useCallback(() => {
    setPresentationMutation.mutate(
      { venueScene: "standby", overlayScene: "sponsor" },
      {
        onSuccess: () => {
          toast({
            title: "Emergency pause",
            description: "Venue on standby. OBS on sponsor scene.",
          });
        },
      },
    );
  }, [setPresentationMutation, toast]);

  const onResumePresentation = useCallback(() => {
    setPresentationMutation.mutate(
      { venueScene: "auto", overlayScene: "auto" },
      {
        onSuccess: () => {
          toast({ title: "Tournament screens resumed" });
          if (resumeMatchId > 0) {
            void director.resume().then(() => {
              void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
            });
          }
        },
      },
    );
  }, [setPresentationMutation, toast, resumeMatchId, director, qc, tournamentId]);

  async function handleAttentionAction(item: AttentionItem) {
    if (item.actionKind === "focus" && item.matchId != null) {
      setPrimaryMutation.mutate(item.matchId);
      return;
    }
    if (item.actionKind === "resume" && item.id === "venue-standby") {
      onResumePresentation();
      return;
    }
    if (item.actionKind === "resume" && item.matchId != null) {
      try {
        await badmintonFetch(tournamentId, `/matches/${item.matchId}/resume`, {
          method: "POST",
          body: JSON.stringify({}),
        });
        toast({ title: "Match resumed" });
        void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      } catch (e) {
        toast({
          title: "Resume failed",
          description: e instanceof Error ? e.message : "Open the court and try again",
          variant: "destructive",
        });
      }
      return;
    }
    if (item.actionKind === "reconnect" && item.matchId != null) {
      try {
        await forceUnlockBadmintonMatch(tournamentId, item.matchId);
        toast({ title: "Scorer lock cleared" });
        void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      } catch (e) {
        toast({
          title: "Reconnect failed",
          description: e instanceof Error ? e.message : "Try again",
          variant: "destructive",
        });
      }
    }
  }

  function handleSuggestion(s: SmartSuggestion) {
    if (s.kind === "focus" && s.matchId != null) {
      setPrimaryMutation.mutate(s.matchId);
      return;
    }
    if (s.kind === "move" && s.matchId != null && s.targetCourtId != null) {
      moveMutation.mutate({ matchId: s.matchId, courtId: s.targetCourtId });
    }
  }

  const isLoading = courtsLoading || matchesLoading || fixturesLoading;
  const loadError = courtsError || matchesError || fixturesError;
  const loadErrorObj = courtsErr ?? matchesErr ?? fixturesErr;

  function retryAll() {
    void refetchCourts();
    void refetchMatches();
    void refetchFixtures();
  }

  return (
    <HubPageShell tournamentId={tournamentId}>
      <div className={LIVE_CONTROL_CONTENT_CLASS}>
        <MissionControlTopBar
          tournamentName={branding?.displayName ?? ""}
          liveCount={liveCount}
          readyCount={readyCount}
          delayedCount={delayedCount}
          completedCount={completedCount}
          primaryAction={primaryAction}
          emergencyActive={emergencyActive}
          onEmergency={onEmergency}
          onResumePresentation={onResumePresentation}
        />

        {!isLoading && !loadError && courts.length > 0 ? (
          <>
            <MissionControlHealthStrip health={health} />
            <MissionControlAlerts
              attention={attention}
              dismissedAttention={dismissedAttention}
              onDismissAttention={(id) =>
                setDismissedAttention((prev) => new Set(prev).add(id))
              }
              onAttentionAction={(item) => {
                void handleAttentionAction(item);
              }}
            />
          </>
        ) : null}

        {isLoading ? (
          <div
            className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4"
            aria-busy="true"
            aria-label="Loading Operator Controls"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
            <div className="h-96 rounded-xl bg-muted animate-pulse" />
          </div>
        ) : loadError ? (
          <EmptyState
            icon={AlertCircle}
            title="Could not load Operator Controls"
            desc={friendlyBadmintonError(loadErrorObj, "Check your connection, then retry.")}
            action={{ label: "Retry", onClick: () => retryAll() }}
          />
        ) : courts.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="No courts yet"
            desc="Add courts in Tournament Setup first. Operator Controls runs the day from here."
            action={{
              label: "Add courts",
              href: `/tournament/${tournamentId}/badminton/branding?section=courts`,
            }}
          />
        ) : (
          <div
            className={cn(
              "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start",
              focusBroadcast && "ring-1 ring-amber-500/30 rounded-xl p-1",
            )}
          >
            <div className="space-y-4 min-w-0">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-[11px] text-white/45">
                  Match no.
                  <input
                    value={matchNoQuery}
                    onChange={(e) => setMatchNoQuery(e.target.value)}
                    placeholder="e.g. 12"
                    className={cn(inputClass, "w-28")}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-white/45">
                  Court
                  <select
                    value={courtFilter}
                    onChange={(e) => setCourtFilter(e.target.value)}
                    className={cn(inputClass, "w-40")}
                  >
                    <option value="all">All courts</option>
                    {courts.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.shortName?.trim() || c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-white/45">
                  Category
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className={cn(inputClass, "w-44")}
                  >
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c.id} value={String(c.id)}>
                        {c.code?.trim() || c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] text-white/45">
                  Status
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className={cn(inputClass, "w-36")}
                  >
                    <option value="all">All</option>
                    <option value="live">Live</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="on_hold">On Hold</option>
                    <option value="finished">Finished</option>
                  </select>
                </label>
                {held.length > 0 ? (
                  <p className="text-sky-200/90 text-xs font-semibold self-center">
                    {held.length} on hold
                  </p>
                ) : null}
              </div>

              <MissionControlReadyStrip
                tournamentId={tournamentId}
                courts={courts}
                ready={ready}
                moveTargetCourtIds={moveTargetCourtIds}
              />

              <section className="space-y-3" aria-label="Courts">
                <h2 className="text-white/55 text-xs font-bold uppercase tracking-widest">
                  Courts
                </h2>
                {liveCount === 0 && readyCount === 0 ? (
                  <div className={cn(hubCardClass, "p-4 border-amber-500/20 bg-amber-500/5")}>
                    <p className="text-sm text-foreground/90 font-medium">No live matches yet</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Use the primary action above, or finish{" "}
                      <Link
                        href={`/tournament/${tournamentId}/badminton/schedule`}
                        className="text-primary hover:underline"
                      >
                        Schedule
                      </Link>
                      .
                    </p>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {sortedBoard.map((row) => (
                    <MissionControlCourtCard
                      key={row.court.id}
                      tournamentId={tournamentId}
                      row={row}
                      categoryName={categoryName}
                      primaryMatchId={primaryMatchId}
                    />
                  ))}
                </div>
              </section>

              <MissionControlTips
                suggestions={suggestions}
                dismissedSuggestions={dismissedSuggestions}
                onDismissSuggestion={(id) =>
                  setDismissedSuggestions((prev) => new Set(prev).add(id))
                }
                onSuggestionAction={handleSuggestion}
              />

              <MissionControlQueues
                tournamentId={tournamentId}
                courts={courts}
                upcoming={upcoming}
                recent={recent}
                categoryName={categoryName}
              />
            </div>

            {/* Document-flow rail — page scroll only; no nested sticky scroller. */}
            <div className="space-y-3 min-w-0">
              <MissionControlOpsRail
                tournamentId={tournamentId}
                onAnnouncement={(label) => toast({ title: label })}
              />
            </div>
          </div>
        )}
      </div>
    </HubPageShell>
  );
}
