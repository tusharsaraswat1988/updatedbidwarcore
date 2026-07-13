/**
 * Draw & Fixtures — planning module
 * Route: /tournament/:id/badminton/fixtures
 *
 * Category → Fixture Collections → Fixtures
 * Planning only: Schedule / Create Match. No Start Match / Scoring / Live.
 */

import { useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { ListTree } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  HubPageShell,
  hubCardClass,
} from "@/components/badminton/page-chrome";

interface BadmintonCategory {
  id: number;
  name: string;
  code?: string | null;
  matchType: string;
  colorCode?: string | null;
  drawType: string;
}

interface FixtureCollection {
  id: number;
  categoryId: number;
  roundName: string;
  drawKind: string;
  status: string;
  totalRounds?: number | null;
}

interface BadmintonFixture {
  id: number;
  categoryId: number;
  drawId: number;
  slotNumber?: number | null;
  registrationAId?: number | null;
  registrationBId?: number | null;
  status: string;
  scoringMatchId?: number | null;
}

interface RegistrationRow {
  registration: {
    id: number;
    player1Id: number;
    player2Id?: number | null;
    seedNumber?: number | null;
    status: string;
  };
  player1: { firstName: string; lastName: string; displayName?: string | null } | null;
  player2?: { firstName: string; lastName: string; displayName?: string | null } | null;
}

function collectionKindLabel(drawKind: string): string {
  if (drawKind === "manual") return "Manual";
  if (drawKind === "imported") return "Imported";
  if (drawKind === "generated" || drawKind === "knockout_round") return "Generated";
  return drawKind.replace(/_/g, " ");
}

function playerLabel(
  p: { firstName: string; lastName: string; displayName?: string | null } | null,
): string {
  if (!p) return "Unknown";
  if (p.displayName?.trim()) return p.displayName.trim();
  return `${p.firstName} ${p.lastName}`.trim();
}

function registrationLabel(row: RegistrationRow, doubles: boolean): string {
  const a = playerLabel(row.player1);
  if (!doubles) return a;
  return `${a} / ${playerLabel(row.player2 ?? null)}`;
}

export default function BadmintonFixturesPage() {
  const [, params] = useRoute("/tournament/:id/badminton/fixtures");
  const tournamentId = parseInt(params?.id ?? "0");
  const search = useSearch();
  const categoryFromQuery = new URLSearchParams(search).get("categoryId");
  const initialCategoryId = categoryFromQuery ? parseInt(categoryFromQuery, 10) : null;

  const [expandedId, setExpandedId] = useState<number | null>(
    Number.isFinite(initialCategoryId) ? initialCategoryId : null,
  );

  const { data: categories = [], isLoading } = useQuery<BadmintonCategory[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

  const { data: collections = [] } = useQuery<FixtureCollection[]>({
    queryKey: ["badminton-fixture-collections", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixture-collections`),
    enabled: !!tournamentId,
  });

  const { data: fixtures = [] } = useQuery<BadmintonFixture[]>({
    queryKey: ["badminton-fixtures-all", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/fixtures`),
    enabled: !!tournamentId,
  });

  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Draw & Fixtures"
        subtitle="Plan who plays whom — generate, import, or create fixtures manually"
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={ListTree}
            title="No categories yet"
            desc="Define events on Categories first, then return here to create fixtures."
            action={{
              label: "Open Categories",
              onClick: () => {
                window.location.href = `/tournament/${tournamentId}/badminton/categories`;
              },
            }}
          />
        ) : (
          sorted.map((cat) => {
            const catCollections = collections.filter((c) => c.categoryId === cat.id);
            const catFixtures = fixtures.filter((f) => f.categoryId === cat.id);
            return (
              <CategoryFixturesPanel
                key={cat.id}
                category={cat}
                tournamentId={tournamentId}
                collections={catCollections}
                fixtures={catFixtures}
                expanded={expandedId === cat.id}
                onToggle={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
              />
            );
          })
        )}
      </div>
    </HubPageShell>
  );
}

function CategoryFixturesPanel({
  category,
  tournamentId,
  collections,
  fixtures,
  expanded,
  onToggle,
}: {
  category: BadmintonCategory;
  tournamentId: number;
  collections: FixtureCollection[];
  fixtures: BadmintonFixture[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const { data: registrations = [] } = useQuery<RegistrationRow[]>({
    queryKey: ["badminton-registrations", tournamentId, category.id],
    queryFn: () => badmintonFetch(tournamentId, `/categories/${category.id}/registrations`),
    enabled: expanded && !!tournamentId,
  });

  const acceptedCount = registrations.filter((r) => r.registration.status === "accepted").length;
  const isDoubles = category.matchType !== "singles";
  const regNameMap = new Map<number, string>();
  for (const row of registrations) {
    regNameMap.set(row.registration.id, registrationLabel(row, isDoubles));
  }

  async function handleAutoGenerate() {
    if (acceptedCount < 2) {
      setError("Need at least 2 accepted entries to generate a draw");
      return;
    }
    if (!window.confirm(`Generate knockout draw for ${category.name}? This cannot be undone.`)) {
      return;
    }
    setGenerating(true);
    setError("");
    try {
      await badmintonFetch(tournamentId, `/categories/${category.id}/generate-draw`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      void qc.invalidateQueries({ queryKey: ["badminton-fixture-collections", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["badminton-fixtures-all", tournamentId] });
      void qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draw generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={cn(hubCardClass, "overflow-hidden")}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-4 min-w-0">
          {category.colorCode ? (
            <div
              className="w-3 h-10 rounded-full flex-none"
              style={{ backgroundColor: category.colorCode }}
            />
          ) : null}
          <div className="min-w-0">
            <h3 className="text-white font-bold text-lg truncate">{category.name}</h3>
            <p className="text-white/40 text-sm mt-0.5">
              {collections.length} collection{collections.length !== 1 ? "s" : ""}
              {" · "}
              {fixtures.length} fixture{fixtures.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <span className="text-white/30 text-sm flex-none">{expanded ? "Hide" : "Open"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-white/8 p-5 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleAutoGenerate()}
              disabled={generating || acceptedCount < 2}
              className="h-9 px-4 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 text-purple-300 text-xs font-semibold transition-colors"
            >
              {generating ? "Generating…" : "Auto Generate Draw"}
            </button>
            <button
              type="button"
              disabled
              title="Available in a following update"
              className="h-9 px-4 rounded-lg bg-white/5 text-white/30 text-xs font-semibold cursor-not-allowed"
            >
              Create Fixtures Manually
            </button>
            <button
              type="button"
              disabled
              title="Import coming soon"
              className="h-9 px-4 rounded-lg bg-white/5 text-white/30 text-xs font-semibold cursor-not-allowed"
            >
              Import Existing Draw
            </button>
          </div>

          {error ? <p className="text-red-400 text-sm">{error}</p> : null}

          {collections.length === 0 ? (
            <p className="text-white/35 text-sm">
              No fixture collections yet. Generate a draw, create fixtures manually, or import when
              available.
            </p>
          ) : (
            collections.map((collection) => {
              const collectionFixtures = fixtures
                .filter((f) => f.drawId === collection.id)
                .sort((a, b) => (a.slotNumber ?? 0) - (b.slotNumber ?? 0));
              return (
                <section key={collection.id} className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-white font-semibold">{collection.roundName}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-white/50">
                      {collectionKindLabel(collection.drawKind)}
                    </span>
                    <span className="text-white/30 text-xs">
                      {collectionFixtures.length} fixture
                      {collectionFixtures.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {collectionFixtures.length === 0 ? (
                    <p className="text-white/30 text-sm">No fixtures in this collection.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {collectionFixtures.map((fixture) => (
                        <FixturePlanCard
                          key={fixture.id}
                          fixture={fixture}
                          regNameMap={regNameMap}
                          tournamentId={tournamentId}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}

function FixturePlanCard({
  fixture,
  regNameMap,
  tournamentId,
}: {
  fixture: BadmintonFixture;
  regNameMap: Map<number, string>;
  tournamentId: number;
}) {
  const sideA = fixture.registrationAId
    ? (regNameMap.get(fixture.registrationAId) ?? "TBD")
    : "BYE";
  const sideB = fixture.registrationBId
    ? (regNameMap.get(fixture.registrationBId) ?? "TBD")
    : "BYE";

  return (
    <div className="rounded-xl bg-white/5 border border-white/8 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/30 text-xs font-bold">
          Match {fixture.slotNumber ?? "—"}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
            fixture.status === "scheduled"
              ? "bg-blue-500/15 text-blue-400"
              : fixture.status === "walkover"
                ? "bg-amber-500/15 text-amber-400"
                : "bg-white/10 text-white/50",
          )}
        >
          {fixture.status}
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-white text-sm font-medium truncate">{sideA}</p>
        <p className="text-white/30 text-xs text-center">vs</p>
        <p className="text-white text-sm font-medium truncate">{sideB}</p>
      </div>
      {fixture.scoringMatchId ? (
        <p className="mt-3 text-center text-white/40 text-xs">Match created — manage in Matches</p>
      ) : (
        <Link
          href={`/tournament/${tournamentId}/badminton/matches?fixture=${fixture.id}`}
          className="mt-3 block text-center text-[#4fc3f7] text-xs font-semibold hover:underline"
        >
          Schedule / Create Match →
        </Link>
      )}
    </div>
  );
}
