/**
 * Mission Control — tournament-day command center (Live Control nav host)
 * Route: /tournament/:id/badminton/control
 *
 * Phase 3.1: attention, primary action, health, suggestions, activity.
 * IA / APIs unchanged.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch, fetchBadmintonMatches } from "@/lib/badminton-api";
import {
  buildCourtBoard,
  listReadyMatches,
  listRecentlyCompleted,
  listUpcomingFixtures,
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
} from "@/components/badminton/page-chrome";
import { BadmintonIaPageChrome } from "@/components/badminton/ia-workflow-chrome";
import { MissionControlTopBar } from "@/components/badminton/mission-control/mission-control-top-bar";
import { MissionControlOpsRail } from "@/components/badminton/mission-control/mission-control-ops-rail";
import { MissionControlCourtCard } from "@/components/badminton/mission-control/mission-control-court-card";
import { MissionControlQueues } from "@/components/badminton/mission-control/mission-control-queues";
import { MissionControlAlerts } from "@/components/badminton/mission-control/mission-control-alerts";
import { MissionControlHealthStrip } from "@/components/badminton/mission-control/mission-control-health";
import {
  MissionControlActivityFeed,
  type ActivityEvent,
} from "@/components/badminton/mission-control/mission-control-activity";
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
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [lastRealtimeAt, setLastRealtimeAt] = useState<number | null>(null);
  const prevBoardKey = useRef<string>("");

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

  const board = useMemo(
    () => buildCourtBoard(courts, matches, fixtures),
    [courts, matches, fixtures],
  );
  const sortedBoard = useMemo(() => sortCourtsByOpsPriority(board), [board]);

  const upcoming = useMemo(() => listUpcomingFixtures(fixtures), [fixtures]);
  const ready = useMemo(() => listReadyMatches(matches), [matches]);
  const recent = useMemo(() => listRecentlyCompleted(matches), [matches]);
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

  // Activity feed from board transitions
  useEffect(() => {
    const key = board
      .map(
        (r) =>
          `${r.court.id}:${r.status}:${r.currentMatch?.id ?? "-"}:${r.currentMatch?.status ?? ""}`,
      )
      .join("|");
    if (!prevBoardKey.current) {
      prevBoardKey.current = key;
      return;
    }
    if (prevBoardKey.current === key) return;
    const prev = prevBoardKey.current;
    prevBoardKey.current = key;

    const events: ActivityEvent[] = [];
    const now = Date.now();
    for (const r of board) {
      const label = r.court.shortName?.trim() || r.court.name;
      const token = `${r.court.id}:`;
      const prevPart = prev.split("|").find((p) => p.startsWith(token)) ?? "";
      const [, prevStatus, prevMatchId, prevMatchStatus] = prevPart.split(":");
      if (prevStatus !== r.status) {
        if (r.status === "LIVE") events.push({ id: `${now}-live-${r.court.id}`, at: now, text: `${label} started` });
        if (r.status === "FINISHED") events.push({ id: `${now}-fin-${r.court.id}`, at: now, text: `${label} finished` });
        if (r.status === "DELAYED") events.push({ id: `${now}-del-${r.court.id}`, at: now, text: `${label} delayed` });
      }
      if (prevMatchId && r.currentMatch && String(r.currentMatch.id) !== prevMatchId) {
        events.push({
          id: `${now}-re-${r.court.id}`,
          at: now,
          text: `${label} reassigned`,
        });
      }
      if (prevMatchStatus === "paused" && r.currentMatch?.status === "live") {
        events.push({ id: `${now}-res-${r.court.id}`, at: now, text: `${label} resumed` });
      }
    }
    if (events.length) {
      setActivity((prevEvents) => [...events, ...prevEvents].slice(0, 20));
    }
  }, [board]);

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

  function pushActivity(text: string) {
    setActivity((prev) => [{ id: `${Date.now()}-${text}`, at: Date.now(), text }, ...prev].slice(0, 20));
  }

  const onEmergency = useCallback(() => {
    setPresentationMutation.mutate(
      { venueScene: "standby", overlayScene: "sponsor" },
      {
        onSuccess: () => {
          toast({
            title: "Emergency pause",
            description: "Venue on standby. OBS on sponsor scene.",
          });
          pushActivity("Emergency pause — Venue standby / Sponsor scene");
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
          pushActivity("Tournament screens resumed");
          if (resumeMatchId > 0) {
            void director.resume().then(() => {
              void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
              pushActivity("Paused match resumed");
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
        pushActivity("Match resumed");
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
        pushActivity("Scorer reconnected");
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
      pushActivity("Match moved from suggestion");
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
      <BadmintonIaPageChrome
        tournamentId={tournamentId}
        stepId="live"
        titleOverride="Live Control"
        purposeOverride="Run tournament day from one screen."
        taskOverride="Courts on the left · screens & scorers on the right · queues below."
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4">
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
                suggestions={suggestions}
                dismissedAttention={dismissedAttention}
                dismissedSuggestions={dismissedSuggestions}
                onDismissAttention={(id) =>
                  setDismissedAttention((prev) => new Set(prev).add(id))
                }
                onDismissSuggestion={(id) =>
                  setDismissedSuggestions((prev) => new Set(prev).add(id))
                }
                onAttentionAction={(item) => {
                  void handleAttentionAction(item);
                }}
                onSuggestionAction={handleSuggestion}
              />
            </>
          ) : null}

          {isLoading ? (
            <div
              className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4"
              aria-busy="true"
              aria-label="Loading Mission Control"
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
              title="Could not load Mission Control"
              desc={friendlyBadmintonError(loadErrorObj, "Check your connection, then retry.")}
              action={{ label: "Retry", onClick: () => retryAll() }}
            />
          ) : courts.length === 0 ? (
            <EmptyState
              icon={LayoutDashboard}
              title="No courts yet"
              desc="Add courts in Tournament Setup first. Mission Control runs the day from here."
              action={{
                label: "Add courts",
                href: `/tournament/${tournamentId}/badminton/branding?section=courts`,
              }}
            />
          ) : (
            <>
              <div
                className={cn(
                  "grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_340px] gap-4 items-start",
                  focusBroadcast && "ring-1 ring-amber-500/30 rounded-xl p-1",
                )}
              >
                <section className="space-y-3 min-w-0" aria-label="Courts">
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

                <div className="lg:sticky lg:top-24 space-y-3 z-30 isolate">
                  <MissionControlOpsRail
                    tournamentId={tournamentId}
                    onAnnouncement={(label) => pushActivity(`Announcement · ${label}`)}
                  />
                  <MissionControlActivityFeed events={activity} />
                </div>
              </div>

              <MissionControlQueues
                tournamentId={tournamentId}
                courts={courts}
                upcoming={upcoming}
                ready={ready}
                recent={recent}
                categoryName={categoryName}
                moveTargetCourtIds={moveTargetCourtIds}
              />
            </>
          )}
        </div>
      </BadmintonIaPageChrome>
    </HubPageShell>
  );
}
