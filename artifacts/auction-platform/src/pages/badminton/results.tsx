/**
 * Results & Standings — tournament understanding after scoring
 * Route: /tournament/:id/badminton/results
 *
 * Page order (lifecycle):
 *   Champions → Categories → Bracket Progress → Recent Results → Standings
 *
 * Read-only. Corrections via Match Control / Live Scoring.
 */

import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { badmintonFetch } from "@/lib/badminton-api";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";
import {
  buildCategoryResultsBlocks,
  categoryDisplayName,
  completedAtMs,
  formatCompletedWhen,
  gameScoreLines,
  gamesWonLine,
  isCompletedMatch,
  listWonToday,
  outcomeLabel,
  winnerLabel,
  winnerTeamFields,
  type ResultsCategory,
  type ResultsCollection,
  type ResultsFixture,
  type ResultsMatch,
} from "@/lib/badminton-results";
import { matchDisplayLabel } from "@/lib/badminton-control-center";
import { formatTeamPlayerLine } from "@/lib/team-player-identity";
import { ChampionCard } from "@/components/badminton/champion-card";
import { CategoryStatusCard } from "@/components/badminton/category-status-card";
import { BracketProgressPanel } from "@/components/badminton/bracket-progress-panel";
import {
  EmptyState,
  HubPageShell,
  PageHeader,
  hubCardClass,
} from "@/components/badminton/page-chrome";
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
  if (a && b) return `${a} / ${b}`;
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
    <div id={id} className="scroll-mt-24 space-y-1">
      <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">{eyebrow}</p>
      <h2 className="text-white font-bold text-xl">{title}</h2>
      {subtitle ? <p className="text-white/35 text-sm">{subtitle}</p> : null}
    </div>
  );
}

export default function BadmintonResultsPage() {
  const [, params] = useRoute("/tournament/:id/badminton/results");
  const tournamentId = parseInt(params?.id ?? "0");

  const { data: matches = [], isLoading: matchesLoading } = useQuery<ResultsMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
    staleTime: 30_000,
    refetchInterval: (q) => {
      const rows = q.state.data ?? [];
      return rows.some((m) => m.status === "live" || m.status === "paused") ? 8_000 : false;
    },
  });

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

  const recentResults = useMemo(() => {
    const today = listWonToday(matches, 20);
    if (today.length > 0) return today;
    return matches
      .filter(isCompletedMatch)
      .sort((a, b) => completedAtMs(b) - completedAtMs(a))
      .slice(0, 12);
  }, [matches]);

  const recentIsToday = useMemo(() => listWonToday(matches, 1).length > 0, [matches]);

  const categoryName = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categories) map.set(c.id, categoryDisplayName(c));
    return map;
  }, [categories]);

  const sideLabelFor = (categoryId: number) => (regId: number | null | undefined) => {
    if (regId == null) return "TBD";
    return registrationMaps[categoryId]?.get(regId) ?? `Entry #${regId}`;
  };

  const loading = matchesLoading || fixturesLoading || catsLoading;

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Results"
        subtitle="Champions and category status first — recent finishes last"
        eyebrow="After scoring"
      />

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-10">
        {loading ? (
          <div className="space-y-3">
            <div className="h-28 rounded-2xl bg-white/4 animate-pulse" />
            <div className="h-40 rounded-2xl bg-white/4 animate-pulse" />
          </div>
        ) : categories.length === 0 && matches.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No results yet"
            desc="Results appear after matches are scored. Create categories and schedule matches to get started."
            action={{
              label: "Go to Control Center",
              href: `/tournament/${tournamentId}/badminton/control`,
            }}
          />
        ) : (
          <>
            {/* 1. Champions */}
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
                  desc="When a category finishes, the champion appears here with final score. Keep scoring from Control Center."
                  action={{
                    label: "Open Control Center",
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
                eyebrow="Categories"
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
                <p className="text-white/35 text-sm">No categories yet.</p>
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
                <p className={cn(hubCardClass, "p-4 text-white/35 text-sm")}>
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
                      <h3 className="text-white/80 font-semibold">
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

            {/* 4. Recent Results (secondary — not the homepage) */}
            <section className="space-y-4">
              <SectionHeading
                eyebrow="Recent Results"
                title={recentIsToday ? "Finished today" : "Latest completed matches"}
                subtitle="Secondary log — champions and categories above take priority"
              />
              {recentResults.length === 0 ? (
                <p className={cn(hubCardClass, "p-4 text-white/35 text-sm")}>
                  No completed matches yet.
                </p>
              ) : (
                <div className={cn(hubCardClass, "p-4")}>
                  <ul>
                    {recentResults.map((m) => {
                      const catId =
                        typeof m.detail?.categoryId === "number" ? m.detail.categoryId : null;
                      const winner = winnerLabel(m);
                      const winnerTeam = winnerTeamFields(m);
                      const winnerDisplay = winner
                        ? formatTeamPlayerLine({
                            playerName: winner,
                            teamName: winnerTeam.teamName,
                            teamLogoUrl: winnerTeam.teamLogoUrl,
                            teamColor: winnerTeam.teamColor,
                          })
                        : null;
                      const games = gameScoreLines(m);
                      return (
                        <li
                          key={m.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5 border-b border-white/6 last:border-0"
                        >
                          <div className="min-w-0">
                            <p className="text-white/40 text-[10px] font-bold uppercase tracking-wider">
                              {catId != null ? categoryName.get(catId) ?? "Match" : "Match"}
                            </p>
                            <p className="text-white/85 text-sm truncate">
                              {matchDisplayLabel(m)}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-white/40">
                              {winnerDisplay ? (
                                <span className="text-emerald-400/90">Won by {winnerDisplay}</span>
                              ) : null}
                              {outcomeLabel(m) !== "Completed" ? (
                                <span className="text-amber-200/70">{outcomeLabel(m)}</span>
                              ) : null}
                              <span>{formatCompletedWhen(m)}</span>
                            </div>
                            {games.length > 0 ? (
                              <p className="text-white/30 text-xs font-mono mt-0.5">
                                {games.join(" · ")}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-3 flex-none">
                            <span className="text-white/60 font-mono text-sm">
                              {gamesWonLine(m)}
                            </span>
                            <Link
                              href={badmintonMatchControlPath(tournamentId, m.id)}
                              className="text-[#4fc3f7] text-xs font-semibold hover:underline"
                            >
                              View
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>

            {/* 5. Standings + future placeholders */}
            <section className="space-y-3">
              <Link
                href={`/tournament/${tournamentId}/badminton/summary`}
                className={cn(
                  hubCardClass,
                  "block p-4 border-amber-500/25 bg-amber-500/5 hover:bg-amber-500/10 transition-colors",
                )}
              >
                <p className="text-amber-200/70 text-[10px] font-bold uppercase tracking-widest">
                  Next
                </p>
                <p className="text-white font-bold mt-1">Tournament Summary & Awards</p>
                <p className="text-white/40 text-xs mt-0.5">
                  Official closing page — champions, court performance, timeline, and awards.
                </p>
              </Link>
              <details className="group rounded-xl border border-dashed border-white/12 bg-white/[0.02] open:pb-3">
                <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl">
                  <div>
                    <p className="text-white/45 text-[10px] font-bold uppercase tracking-widest">
                      Standings
                    </p>
                    <p className="text-white/70 text-sm font-semibold mt-0.5">Coming soon</p>
                    <p className="text-white/35 text-xs mt-0.5">
                      League tables and player rankings
                    </p>
                  </div>
                  <span className="text-white/30 text-xs group-open:hidden">Show</span>
                  <span className="text-white/30 text-xs hidden group-open:inline">Hide</span>
                </summary>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 pt-1">
                  <FuturePlaceholder title="League Standings" note="Round-robin tables — coming later" />
                  <FuturePlaceholder title="Player Rankings" note="Architecture reserved" />
                </div>
              </details>
            </section>

            <p className="text-white/40 text-xs text-center pb-4">
              Results are read-only. Corrections happen in Match Control or Live Scoring.
            </p>
          </>
        )}
      </div>
    </HubPageShell>
  );
}

function FuturePlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-3">
      <p className="text-white/45 text-sm font-semibold">{title}</p>
      <p className="text-white/25 text-xs mt-0.5">{note}</p>
    </div>
  );
}
