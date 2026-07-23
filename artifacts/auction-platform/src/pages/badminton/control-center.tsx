/**
 * Mission Control — tournament-day command center (Live Control nav host)
 * Route: /tournament/:id/badminton/control
 *
 * Court → current match → next match. One workspace for VNBL ops.
 * Does not change IA, routing, or APIs.
 */

import { useMemo } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import {
  buildCourtBoard,
  listReadyMatches,
  listRecentlyCompleted,
  listUpcomingFixtures,
  type ControlFixture,
  type ControlMatch,
} from "@/lib/badminton-control-center";
import {
  listLiveMatches,
  resolvePrimaryBroadcastMatchId,
} from "@/lib/badminton-broadcast-console";
import { friendlyBadmintonError } from "@/lib/badminton-ux";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

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

  const { data: branding } = useBadmintonBranding(tournamentId);

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
    refetch: refetchMatches,
  } = useQuery<ControlMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
    staleTime: 15_000,
    refetchInterval: (q) => {
      const rows = q.state.data ?? [];
      const needsPoll = rows.some(
        (m) => m.status === "live" || m.status === "paused" || m.status === "scheduled",
      );
      return needsPoll ? 8_000 : false;
    },
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
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const { data: categories = [] } = useQuery<CategoryRow[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

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
    () =>
      resolvePrimaryBroadcastMatchId(
        matches as Parameters<typeof resolvePrimaryBroadcastMatchId>[0],
        branding?.primaryBroadcastMatchId ?? null,
      ),
    [matches, branding?.primaryBroadcastMatchId],
  );

  const liveCount = board.filter((r) => r.status === "LIVE").length;
  const readyCount = board.filter((r) => r.status === "READY").length;
  const delayedCount = board.filter((r) => r.status === "DELAYED").length;
  const nextReady = ready[0] ?? null;
  const moveTargetCourtIds = board
    .filter((r) => r.status === "EMPTY" || r.status === "DELAYED" || r.status === "FINISHED")
    .map((r) => r.court.id);

  const alertText = useMemo(() => {
    const parts: string[] = [];
    if (delayedCount > 0) parts.push(`${delayedCount} court${delayedCount === 1 ? "" : "s"} delayed`);
    const noPinLive = board.filter(
      (r) =>
        r.status === "LIVE" &&
        !(r.court.hasScorerPin || (r.court.scorerPin && r.court.scorerPin.trim())),
    ).length;
    if (noPinLive > 0) parts.push(`${noPinLive} live court${noPinLive === 1 ? "" : "s"} missing scorer PIN`);
    if (listLiveMatches(matches as Parameters<typeof listLiveMatches>[0]).length > 1) {
      parts.push("Multiple courts live — confirm which screen follows");
    }
    return parts.length ? parts.join(" · ") : null;
  }, [board, delayedCount, matches]);

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
        titleOverride="Mission Control"
        purposeOverride="Run the entire tournament day from the courts — one workspace."
        taskOverride="Watch every court, start matches, manage scorers and screens without leaving this page."
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4 space-y-4">
          <MissionControlTopBar
            tournamentName={branding?.displayName ?? ""}
            liveCount={liveCount}
            readyCount={readyCount}
            delayedCount={delayedCount}
            completedCount={completedCount}
            nextReadyId={nextReady?.id ?? null}
            tournamentId={tournamentId}
            alertText={alertText}
          />

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
                <section className="space-y-3 min-w-0" aria-label="Live courts">
                  <div>
                    <h2 className="text-white/55 text-xs font-bold uppercase tracking-widest">
                      Live courts
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      Every decision starts with a court — current match, next match, scorer, screens.
                    </p>
                  </div>
                  {liveCount === 0 && readyCount === 0 ? (
                    <div className={cn(hubCardClass, "p-4 border-amber-500/20 bg-amber-500/5")}>
                      <p className="text-sm text-foreground/90 font-medium">No live matches yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start from a court card or the ready queue. If nothing is ready, finish{" "}
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
                    {board.map((row) => (
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

                <div className="lg:sticky lg:top-24 space-y-4">
                  <MissionControlOpsRail tournamentId={tournamentId} />
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

              <Collapsible className="pt-2">
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3 text-left text-xs text-white/45 hover:text-white/70 hover:bg-white/[0.04]">
                  <span className="font-semibold uppercase tracking-wider">
                    Advanced · Developer
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0" aria-hidden />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className={cn(hubCardClass, "mt-2 p-4 space-y-2 text-xs text-muted-foreground")}>
                    <p>
                      Diagnostics stay hidden during the day. Use only if screens or scoring stall.
                    </p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li>
                        Court PIN lives on each court card (Tournament Setup → Courts to change).
                      </li>
                      <li>
                        Reconnect scorer clears a stuck match lock (same as Match Control force-unlock).
                      </li>
                      <li>
                        Deep-link screens:{" "}
                        <code className="text-white/60">?focus=broadcast</code>
                      </li>
                      <li>
                        Refetch:{" "}
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => retryAll()}
                        >
                          Reload courts & matches
                        </button>
                      </li>
                    </ul>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
        </div>
      </BadmintonIaPageChrome>
    </HubPageShell>
  );
}
