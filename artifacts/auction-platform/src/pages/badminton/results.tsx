/**
 * Results & Standings — tournament understanding after scoring
 * Route: /tournament/:id/badminton/results
 *
 * Page order:
 *   Match points summary → Champions → Categories → Bracket Progress
 *
 * Read-only. Corrections via Match Control / Live Scoring.
 */

import { useEffect, useMemo, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trophy, ShieldCheck, CheckCircle2 } from "lucide-react";
import { badmintonFetch, fetchBadmintonMatches } from "@/lib/badminton-api";
import {
  BADMINTON_MATCHES_RECONNECT_POLL_MS,
  subscribeBadmintonDashboardStream,
  useBadmintonTournamentStreamStatus,
} from "@/hooks/use-badminton-match";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import {
  isMatchStateChangedPayload,
  patchBadmintonMatchesFromLiveUpdate,
  shouldRefetchBadmintonMatches,
} from "@/lib/badminton-match-list-cache";
import {
  buildCategoryResultsBlocks,
  categoryDisplayName,
  type ResultsCategory,
  type ResultsCollection,
  type ResultsFixture,
  type ResultsMatch,
} from "@/lib/badminton-results";
import {
  buildStandingsBoardsFromRows,
  isLeagueDrawType,
  type LeagueStandingRow,
} from "@/lib/badminton-leaderboards";
import { ChampionCard } from "@/components/badminton/champion-card";
import { CategoryStatusCard } from "@/components/badminton/category-status-card";
import { BracketProgressPanel } from "@/components/badminton/bracket-progress-panel";
import { MatchPointsSummary } from "@/components/badminton/match-points-summary";
import {
  EmptyState,
  HubPageShell,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import {
  BadmintonIaPageChrome,
} from "@/components/badminton/ia-workflow-chrome";
import { BadmintonResultTabs } from "@/components/badminton/badminton-subnav-tabs";
import { cn } from "@/lib/utils";

type RegistrationRow = {
  registration: { id: number };
  player1: { firstName: string; lastName: string; displayName?: string | null } | null;
  player2?: { firstName: string; lastName: string; displayName?: string | null } | null;
};

function playerName(
  p: { firstName: string; lastName: string; displayName?: string | null } | null | undefined,
): string {
  if (!p) return "";
  if (p.displayName?.trim()) return p.displayName.trim();
  return `${p.firstName} ${p.lastName}`.trim();
}

function registrationLabel(row: RegistrationRow): string {
  const a = playerName(row.player1);
  const b = playerName(row.player2);
  if (a && b) return `${a} & ${b}`;
  return a || `Entry #${row.registration.id}`;
}

function SectionHeading({
  id,
  eyebrow,
  title,
  subtitle,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div id={id} className="scroll-mt-24 pb-2 border-b border-border/40">
      <p className="text-primary text-[11px] font-bold uppercase tracking-widest">{eyebrow}</p>
      <h2 className="text-foreground font-display font-bold text-xl mt-0.5">{title}</h2>
      {subtitle ? <p className="text-muted-foreground text-sm mt-0.5">{subtitle}</p> : null}
    </div>
  );
}

export default function BadmintonResultsPage() {
  const [, params] = useRoute("/tournament/:id/badminton/results");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();
  const tournamentSseStatus = useBadmintonTournamentStreamStatus(tournamentId);
  const matchesInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: matches = [], isLoading: matchesLoading } = useQuery<ResultsMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => fetchBadmintonMatches(tournamentId),
    enabled: !!tournamentId,
    staleTime: 30_000,
    refetchInterval: () =>
      sseAwareRefetchInterval(tournamentSseStatus, BADMINTON_MATCHES_RECONNECT_POLL_MS),
  });

  useEffect(() => {
    if (!tournamentId) return;
    return subscribeBadmintonDashboardStream(tournamentId, (payload) => {
      const data =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;
      if (data && isMatchStateChangedPayload(data)) {
        patchBadmintonMatchesFromLiveUpdate(qc, tournamentId, data);
        return;
      }
      if (!shouldRefetchBadmintonMatches(data)) return;
      if (matchesInvalidateTimer.current) clearTimeout(matchesInvalidateTimer.current);
      matchesInvalidateTimer.current = setTimeout(() => {
        void qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
        void qc.invalidateQueries({ queryKey: ["badminton-league-standings", tournamentId] });
      }, 750);
    });
  }, [tournamentId, qc]);

  useEffect(() => {
    return () => {
      if (matchesInvalidateTimer.current) clearTimeout(matchesInvalidateTimer.current);
    };
  }, []);

  const { data: fixtures = [], isLoading: fixturesLoading } = useQuery<ResultsFixture[]>({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixtures`),
    enabled: !!tournamentId,
    staleTime: 30_000,
  });

  const { data: collections = [] } = useQuery<ResultsCollection[]>({
    queryKey: ["badminton-fixture-collections", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixture-collections`),
    enabled: !!tournamentId,
    staleTime: 30_000,
  });

  const { data: categories = [], isLoading: catsLoading } = useQuery<ResultsCategory[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

  const { data: registrationMaps = {} } = useQuery<Record<number, Map<number, string>>>({
    queryKey: ["badminton-results-reg-labels", tournamentId, categories.map((c) => c.id).join(",")],
    queryFn: async () => {
      const out: Record<number, Map<number, string>> = {};
      await Promise.all(
        categories.map(async (cat) => {
          try {
            const rows = await badmintonFetch<RegistrationRow[]>(
              tournamentId,
              `/categories/${cat.id}/registrations`,
            );
            const map = new Map<number, string>();
            for (const row of rows) {
              map.set(row.registration.id, registrationLabel(row));
            }
            out[cat.id] = map;
          } catch {
            out[cat.id] = new Map();
          }
        }),
      );
      return out;
    },
    enabled: !!tournamentId && categories.length > 0,
  });

  const leagueCategories = useMemo(
    () => categories.filter((c) => isLeagueDrawType(c.drawType)),
    [categories],
  );

  const { data: standingsByCategory = new Map<number, LeagueStandingRow[]>(), isLoading: standingsLoading } =
    useQuery({
      queryKey: [
        "badminton-league-standings",
        tournamentId,
        leagueCategories.map((c) => c.id).join(","),
      ],
      queryFn: async () => {
        const map = new Map<number, LeagueStandingRow[]>();
        await Promise.all(
          leagueCategories.map(async (cat) => {
            try {
              const rows = await badmintonFetch<LeagueStandingRow[]>(
                tournamentId,
                `/categories/${cat.id}/standings`,
              );
              map.set(cat.id, rows);
            } catch {
              map.set(cat.id, []);
            }
          }),
        );
        return map;
      },
      enabled: !!tournamentId && leagueCategories.length > 0,
      staleTime: 15_000,
      refetchInterval: () =>
        sseAwareRefetchInterval(tournamentSseStatus, BADMINTON_MATCHES_RECONNECT_POLL_MS),
    });

  const standingsBoards = useMemo(
    () =>
      buildStandingsBoardsFromRows({
        categories: leagueCategories,
        standingsByCategory,
      }),
    [leagueCategories, standingsByCategory],
  );

  const blocks = useMemo(
    () => buildCategoryResultsBlocks(categories, matches, fixtures, collections),
    [categories, matches, fixtures, collections],
  );

  const champions = useMemo(
    () => blocks.flatMap((b) => (b.champion ? [b.champion] : [])),
    [blocks],
  );

  const completedBlocks = useMemo(
    () => blocks.filter((b) => b.champion != null || b.remainingCount === 0),
    [blocks],
  );

  const inProgressBlocks = useMemo(
    () => blocks.filter((b) => b.champion == null && b.remainingCount > 0),
    [blocks],
  );

  const bracketBlocks = useMemo(
    () =>
      blocks.filter(
        (b) =>
          b.collections.length > 0 &&
          (b.category.drawType === "knockout" ||
            b.category.drawType === "group_knockout" ||
            b.fixtures.length > 0),
      ),
    [blocks],
  );

  const sideLabelFor = (categoryId: number) => (regId: number | null | undefined) => {
    if (regId == null) return "TBD";
    return registrationMaps[categoryId]?.get(regId) ?? `Entry #${regId}`;
  };

  const completedMatches = useMemo(() => {
    return matches.filter((m) =>
      ["completed", "walkover", "retired", "disqualified", "abandoned"].includes(m.status),
    );
  }, [matches]);

  const loading = matchesLoading || fixturesLoading || catsLoading;

  return (
    <HubPageShell tournamentId={tournamentId}>
      <BadmintonIaPageChrome
        tournamentId={tournamentId}
        stepId="results"
        tabs={
          <BadmintonResultTabs
            tournamentId={tournamentId}
            activeSection="standings"
          />
        }
        titleOverride="Standings"
        purposeOverride="Review completed match results and category standings."
        taskOverride="Check champions, league tables, brackets, and recent results."
      >

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-10">
        {loading ? (
          <div className="space-y-3">
            <div className="h-28 rounded-2xl bg-muted/40 border border-border animate-pulse" />
            <div className="h-40 rounded-2xl bg-muted/40 border border-border animate-pulse" />
          </div>
        ) : categories.length === 0 && matches.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No results yet"
            desc="Results appear after matches are scored. Run the day from Live Control first."
            action={{
              label: "Go to Live Control",
              href: `/tournament/${tournamentId}/badminton/control`,
            }}
          />
        ) : (
          <>
            {/* 1. Match points summary (owners) */}
            <MatchPointsSummary
              boards={standingsBoards}
              matches={matches}
              loading={standingsLoading}
              tournamentId={tournamentId}
              showMatchControlLinks
              emptyStandingsHint={
                leagueCategories.length === 0
                  ? "No league / group events yet. Knockout-only categories do not show a points table here."
                  : undefined
              }
            />
            {standingsBoards.length > 0 ? (
              <p className="text-[11px] text-muted-foreground -mt-4">
                Male: top 4 per group → QF. Female: top 4 overall → SF. Diff is point
                difference on won matches only.
              </p>
            ) : null}

            {/* Completed Match Verification & Official Sign-off Table */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/40">
                <div>
                  <p className="text-primary text-[11px] font-bold uppercase tracking-widest">
                    Official Verification
                  </p>
                  <h2 className="text-foreground font-display font-bold text-xl mt-0.5">
                    Completed Matches & Digital Sign-Off
                  </h2>
                  <p className="text-muted-foreground text-sm mt-0.5">
                    Verified score records and official match sign-off status
                  </p>
                </div>
                {completedMatches.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    {completedMatches.length} Match{completedMatches.length === 1 ? "" : "es"} Signed Off
                  </span>
                ) : null}
              </div>

              {completedMatches.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border/60">
                  No completed matches recorded yet. Completed scores and sign-offs appear here as matches conclude.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-muted-foreground text-left">
                        <th className="py-3 px-4 font-semibold">Match #</th>
                        <th className="py-3 px-4 font-semibold">Stage / Category</th>
                        <th className="py-3 px-4 font-semibold">Contestants</th>
                        <th className="py-3 px-4 font-semibold">Game Scores</th>
                        <th className="py-3 px-4 font-semibold">Official Result</th>
                        <th className="py-3 px-4 font-semibold">Sign-Off Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {completedMatches.map((m) => {
                        const leftTitle = m.state?.leftSide?.shortLabel || m.state?.leftSide?.label || "Left";
                        const rightTitle = m.state?.rightSide?.shortLabel || m.state?.rightSide?.label || "Right";
                        const gameScores = (m.state?.games ?? [])
                          .map((g) => `${g.leftScore}-${g.rightScore}`)
                          .join(", ");
                        const cat = categories.find((c) => c.id === m.detail?.categoryId);

                        return (
                          <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-foreground">
                              #{m.id}
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {cat ? cat.code?.trim() || cat.name : m.roundName || "Match"}
                            </td>
                            <td className="py-3 px-4 font-medium text-foreground">
                              <span>{leftTitle}</span>
                              <span className="text-muted-foreground mx-1.5 font-normal">vs</span>
                              <span>{rightTitle}</span>
                            </td>
                            <td className="py-3 px-4 font-mono tabular-nums text-foreground font-semibold">
                              {gameScores || "—"}
                            </td>
                            <td className="py-3 px-4 text-emerald-700 dark:text-emerald-400 font-semibold">
                              {m.resultSummary || m.status}
                            </td>
                            <td className="py-3 px-4">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                Signed Off
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Link
                                href={`/tournament/${tournamentId}/badminton/matches/${m.id}/control`}
                                className="text-primary hover:underline font-semibold"
                              >
                                Match Control →
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* 2. Champions */}
            <section className="space-y-4">
              <SectionHeading
                id="champions"
                eyebrow="Champions"
                title="Completed categories"
                subtitle={
                  champions.length > 0
                    ? `${champions.length} categor${champions.length === 1 ? "y" : "ies"} crowned`
                    : "Finish a category final — winners are celebrated here first"
                }
              />
              {champions.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="No champions yet"
                  desc="When an event finishes, the champion appears here. Keep scoring from Live Control."
                  action={{
                    label: "Open Live Control",
                    href: `/tournament/${tournamentId}/badminton/control`,
                  }}
                />
              ) : (
                <div className="space-y-3">
                  {champions.map((c) => (
                    <ChampionCard key={c.categoryId} champion={c} tournamentId={tournamentId} />
                  ))}
                </div>
              )}
            </section>

            {/* 2. Categories */}
            <section className="space-y-5">
              <SectionHeading
                eyebrow="Events"
                title="In Progress / Completed"
                subtitle="Tournament status by category — not a raw match dump"
              />

              {inProgressBlocks.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-amber-200/70 text-[10px] font-bold uppercase tracking-widest">
                    In Progress
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {inProgressBlocks.map((block) => (
                      <CategoryStatusCard
                        key={block.category.id}
                        block={block}
                        tournamentId={tournamentId}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {completedBlocks.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-emerald-300/70 text-[10px] font-bold uppercase tracking-widest">
                    Completed
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {completedBlocks.map((block) => (
                      <CategoryStatusCard
                        key={block.category.id}
                        block={block}
                        tournamentId={tournamentId}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {blocks.length === 0 ? (
                <p className="text-muted-foreground text-sm">No categories yet.</p>
              ) : null}
            </section>

            {/* 3. Bracket Progress */}
            <section className="space-y-5">
              <SectionHeading
                eyebrow="Bracket Progress"
                title="Knockout progression"
                subtitle="Results overlaid on existing fixture collections"
              />
              {bracketBlocks.length === 0 ? (
                <p className={cn(hubCardClass, "p-4 text-muted-foreground text-sm")}>
                  No knockout collections yet. Brackets appear when draws are created.
                </p>
              ) : (
                <div className="space-y-8">
                  {bracketBlocks.map((block) => (
                    <div
                      key={block.category.id}
                      id={`bracket-${block.category.id}`}
                      className="space-y-3 scroll-mt-24"
                    >
                      <h3 className="text-foreground font-semibold">
                        {categoryDisplayName(block.category)}
                      </h3>
                      <BracketProgressPanel
                        collections={block.collections}
                        fixtures={block.fixtures}
                        matches={[...block.completed, ...block.live, ...block.upcoming]}
                        hasProgressionLinks={block.hasProgressionLinks}
                        sideLabel={sideLabelFor(block.category.id)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <Link
              href={`/tournament/${tournamentId}/badminton/summary`}
              className={cn(
                hubCardClass,
                "block p-4 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 transition-colors shadow-xs",
              )}
            >
              <p className="text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-widest">
                Next
              </p>
              <p className="text-foreground font-bold mt-1">Tournament Summary & Awards</p>
              <p className="text-muted-foreground text-xs mt-0.5">
                Official closing page — champions, court performance, timeline, and awards.
              </p>
            </Link>

            <p className="text-muted-foreground text-xs text-center pb-4">
              Results are read-only. Corrections happen from Live Control.
            </p>
          </>
        )}
      </div>
      </BadmintonIaPageChrome>
    </HubPageShell>
  );
}
