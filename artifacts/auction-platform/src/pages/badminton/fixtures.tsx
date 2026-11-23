/**
 * Draw & Fixtures — planning module
 * Route: /tournament/:id/badminton/fixtures
 *
 * Category → Fixture Collections → Fixtures
 * Planning only: Schedule / Create Match. No Start Match / Scoring / Live.
 *
 * Fixture Source Adapters (all write via shared backend writer):
 *   Auto Generate | Manual Entry | Import (gated — not available yet)
 */

import { useState, useEffect } from "react";
import { useRoute, Link, useSearch, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { ListTree } from "lucide-react";
import { TeamPlayerVs } from "@/components/badminton/team-player-card";
import {
  buildFranchiseLookupFromPlayers,
  identityFromRegistrationPlayers,
  type TeamPlayerIdentity,
} from "@/lib/team-player-identity";
import {
  EmptyState,
  HubPageShell,
  hubCardClass,
  FormModal,
  FormField,
  FormActions,
  FormError,
  DarkSelect,
  inputClass,
  BtnPrimary,
} from "@/components/badminton/page-chrome";
import {
  BadmintonIaPageChrome,
} from "@/components/badminton/ia-workflow-chrome";
import { BadmintonEventsPanel } from "@/pages/badminton/categories";
import { BadmintonFixtureTabs } from "@/components/badminton/badminton-subnav-tabs";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import { toastError, toastSuccess } from "@/lib/badminton-ux";

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
  courtId?: number | null;
  scheduledAt?: string | null;
}

interface RegistrationRow {
  registration: {
    id: number;
    player1Id: number;
    player2Id?: number | null;
    seedNumber?: number | null;
    status: string;
  };
  player1: {
    id?: number;
    firstName: string;
    lastName: string;
    displayName?: string | null;
    franchiseName?: string | null;
    franchiseLogoUrl?: string | null;
  } | null;
  player2?: {
    id?: number;
    firstName: string;
    lastName: string;
    displayName?: string | null;
    franchiseName?: string | null;
    franchiseLogoUrl?: string | null;
  } | null;
}

type ManualPair = { registrationAId: string; registrationBId: string };

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
  return `${a} & ${playerLabel(row.player2 ?? null)}`;
}

const STRUCTURE_SECTIONS = ["events", "draw"] as const;
type StructureSection = (typeof STRUCTURE_SECTIONS)[number];

export default function BadmintonFixturesPage() {
  const [, params] = useRoute("/tournament/:id/badminton/fixtures");
  const [, setLocation] = useLocation();
  const tournamentId = parseInt(params?.id ?? "0");
  const search = useSearch();
  const paramsQs = new URLSearchParams(search);
  const categoryFromQuery = paramsQs.get("categoryId");
  const initialCategoryId = categoryFromQuery ? parseInt(categoryFromQuery, 10) : null;
  // Default: Events first; Draw when section=draw or category deep-link
  const activeSection: StructureSection = paramsQs.has("section")
    ? paramsQs.get("section") === "events"
      ? "events"
      : "draw"
    : categoryFromQuery
      ? "draw"
      : "events";

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
      <BadmintonIaPageChrome
        tournamentId={tournamentId}
        stepId="structure"
        tabs={
          <BadmintonFixtureTabs
            tournamentId={tournamentId}
            activeSection={activeSection}
          />
        }
        titleOverride={activeSection === "events" ? "Events" : "Draw"}
        purposeOverride={
          activeSection === "events"
            ? "Define the competitions that make up this tournament."
            : "Decide who plays whom in each event."
        }
        taskOverride={
          activeSection === "events"
            ? "Create events and add entries before building the draw."
            : "Generate or build the draw, then move on to Schedule."
        }
      >
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {activeSection === "events" ? (
          <BadmintonEventsPanel tournamentId={tournamentId} />
        ) : null}

        {activeSection === "draw" ? (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border/40">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Draw Collections</span>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-mono font-bold">
                  {collections.length}
                </span>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  • {fixtures.length} total fixture{fixtures.length === 1 ? "" : "s"} generated
                </span>
              </div>
            </div>
            {isLoading ? (
              <div className="space-y-3" aria-busy="true" aria-label="Loading draw">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
                ))}
              </div>
            ) : sorted.length === 0 ? (
              <EmptyState
                icon={ListTree}
                title="No events yet"
                desc="Define events first, then create the tournament draw."
                action={{
                  label: "Open Events",
                  onClick: () =>
                    setLocation(`/tournament/${tournamentId}/badminton/fixtures?section=events`),
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
          </>
        ) : null}
      </div>
      </BadmintonIaPageChrome>
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
  const [confirmGenerate, setConfirmGenerate] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [error, setError] = useState("");

  const { data: registrations = [] } = useQuery<RegistrationRow[]>({
    queryKey: ["badminton-registrations", tournamentId, category.id],
    queryFn: () => badmintonFetch(tournamentId, `/categories/${category.id}/registrations`),
    enabled: expanded && !!tournamentId,
  });

  const { data: players = [] } = useQuery<
    Array<{
      id: number;
      franchiseName?: string | null;
      franchiseLogoUrl?: string | null;
    }>
  >({
    queryKey: ["badminton-players", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/players`),
    enabled: expanded && !!tournamentId,
  });

  const franchiseByPlayerId = buildFranchiseLookupFromPlayers(players);

  const accepted = registrations.filter((r) => r.registration.status === "accepted");
  const acceptedCount = accepted.length;
  const isDoubles = category.matchType !== "singles";
  const isLeague =
    category.drawType === "round_robin" || category.drawType === "group_knockout";
  const regIdentityMap = new Map<number, TeamPlayerIdentity>();
  for (const row of registrations) {
    const playersForReg = [
      row.player1 ? { ...row.player1, id: row.player1.id ?? row.registration.player1Id } : null,
      row.player2
        ? { ...row.player2, id: row.player2.id ?? row.registration.player2Id ?? undefined }
        : null,
    ];
    regIdentityMap.set(
      row.registration.id,
      identityFromRegistrationPlayers(
        isDoubles ? playersForReg : [playersForReg[0]],
        franchiseByPlayerId,
      ),
    );
  }

  function invalidatePlanning() {
    void qc.invalidateQueries({ queryKey: ["badminton-fixture-collections", tournamentId] });
    void qc.invalidateQueries({ queryKey: ["badminton-fixtures-all", tournamentId] });
    void qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
  }

  async function handleAutoGenerate() {
    if (acceptedCount < 2) {
      setError("Add at least 2 accepted entries in Categories before generating a draw.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const endpoint = isLeague
        ? `/categories/${category.id}/generate-league`
        : `/categories/${category.id}/generate-draw`;
      await badmintonFetch(tournamentId, endpoint, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toastSuccess(
        isLeague ? "League fixtures generated" : "Fixtures generated",
        `${category.name} draw is ready to schedule.`,
      );
      setConfirmGenerate(false);
      invalidatePlanning();
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "Could not generate fixtures. Check entries and try again.";
      setError(msg);
      toastError(e, "Draw generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className={cn(hubCardClass, "overflow-hidden")}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-4 min-w-0">
          {category.colorCode ? (
            <div
              className="w-3 h-10 rounded-full flex-none"
              style={{ backgroundColor: category.colorCode }}
            />
          ) : null}
          <div className="min-w-0">
            <h3 className="text-foreground font-bold text-lg truncate">{category.name}</h3>
            <p className="text-muted-foreground text-sm mt-0.5">
              {collections.length} collection{collections.length !== 1 ? "s" : ""}
              {" · "}
              {fixtures.length} match{fixtures.length !== 1 ? "es" : ""} in draw
            </p>
          </div>
        </div>
        <span className="text-muted-foreground text-sm flex-none font-medium">{expanded ? "Hide" : "Open"}</span>
      </button>

      {expanded ? (
        <div className="border-t border-border p-5 space-y-6">
          {isLeague ? (
            <LeagueGroupsPanel tournamentId={tournamentId} categoryId={category.id} />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setError("");
                if (isLeague) {
                  setConfirmGenerate(true);
                  return;
                }
                if (acceptedCount < 2) {
                  setError("Add at least 2 accepted entries in Categories before generating a draw.");
                  return;
                }
                setConfirmGenerate(true);
              }}
              disabled={generating || (!isLeague && acceptedCount < 2)}
              className="min-h-11 px-4 rounded-lg bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 disabled:opacity-40 text-purple-700 dark:text-purple-300 text-sm font-bold transition-colors cursor-pointer"
              title={
                isLeague
                  ? "Generate pair-vs-pair league fixtures from groups"
                  : acceptedCount < 2
                    ? "Need 2+ accepted entries"
                    : "Generate knockout fixtures"
              }
            >
              {generating
                ? "Generating…"
                : isLeague
                  ? "Generate League Fixtures"
                  : "Auto Generate Draw"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowManual(true);
              }}
              disabled={acceptedCount < 1}
              className="min-h-11 px-4 rounded-lg bg-card border border-border hover:bg-muted/80 disabled:opacity-40 text-foreground text-xs font-semibold transition-colors cursor-pointer shadow-xs"
            >
              Create Fixtures Manually
            </button>
            <button
              type="button"
              disabled
              title="Import is not available in this release"
              className="min-h-11 px-4 rounded-lg bg-muted text-muted-foreground/60 text-xs font-semibold cursor-not-allowed"
            >
              Import Existing Draw (coming soon)
            </button>
          </div>

          {error ? <FormError message={error} /> : null}

          {collections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center space-y-2">
              <p className="text-foreground text-sm font-semibold">No draw yet</p>
              <p className="text-muted-foreground text-xs max-w-md mx-auto">
                Generate a draw for this event, or create pairings manually. Then open Schedule to assign courts and times.
              </p>
            </div>
          ) : (
            collections.map((collection) => {
              const collectionFixtures = fixtures
                .filter((f) => f.drawId === collection.id)
                .sort((a, b) => (a.slotNumber ?? 0) - (b.slotNumber ?? 0));
              return (
                <section key={collection.id} className="space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-foreground font-semibold">{collection.roundName}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted border border-border/70 text-muted-foreground">
                      {collectionKindLabel(collection.drawKind)}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {collectionFixtures.length} fixture
                      {collectionFixtures.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  {collectionFixtures.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No fixtures in this collection.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {collectionFixtures.map((fixture) => (
                        <FixturePlanCard
                          key={fixture.id}
                          fixture={fixture}
                          regIdentityMap={regIdentityMap}
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

      {showManual ? (
        <ManualFixturesModal
          tournamentId={tournamentId}
          category={category}
          accepted={accepted}
          isDoubles={isDoubles}
          onClose={() => setShowManual(false)}
          onSaved={() => {
            toastSuccess("Fixtures created", "Open Scheduling to assign courts and times.");
            setShowManual(false);
            invalidatePlanning();
          }}
        />
      ) : null}

      <ConfirmActionDialog
        open={confirmGenerate}
        onOpenChange={setConfirmGenerate}
        title={isLeague ? "Generate league fixtures?" : "Generate knockout draw?"}
        description={
          <div className="space-y-2">
            <p>
              {isLeague ? (
                <>
                  Create team-tie league fixtures for{" "}
                  <span className="text-foreground font-medium">{category.name}</span> from
                  configured groups (pair slot vs pair slot).
                </>
              ) : (
                <>
                  Create a knockout fixture collection for{" "}
                  <span className="text-foreground font-medium">{category.name}</span> using{" "}
                  {acceptedCount} accepted entries.
                </>
              )}
            </p>
            <p>You can schedule courts and times afterward in Scheduling.</p>
          </div>
        }
        confirmLabel={isLeague ? "Generate league" : "Generate draw"}
        destructive={false}
        busy={generating}
        error={error}
        onConfirm={() => void handleAutoGenerate()}
      />
    </div>
  );
}

function ManualFixturesModal({
  tournamentId,
  category,
  accepted,
  isDoubles,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  category: BadmintonCategory;
  accepted: RegistrationRow[];
  isDoubles: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [roundName, setRoundName] = useState("Manual Fixtures");
  const [pairs, setPairs] = useState<ManualPair[]>([
    { registrationAId: "", registrationBId: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const entryOptions = accepted.map((row) => ({
    value: String(row.registration.id),
    label: registrationLabel(row, isDoubles),
  }));

  function updatePair(index: number, field: keyof ManualPair, value: string) {
    setPairs((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    );
  }

  async function handleSave() {
    const fixtures = pairs
      .map((p) => ({
        registrationAId: p.registrationAId ? parseInt(p.registrationAId, 10) : null,
        registrationBId: p.registrationBId ? parseInt(p.registrationBId, 10) : null,
      }))
      .filter((f) => f.registrationAId != null || f.registrationBId != null);

    if (fixtures.length === 0) {
      setError("Add at least one fixture with a player on either side");
      return;
    }
    const sameSide = fixtures.find(
      (f) =>
        f.registrationAId != null &&
        f.registrationBId != null &&
        f.registrationAId === f.registrationBId,
    );
    if (sameSide) {
      setError("Side A and Side B cannot be the same entry in a fixture");
      return;
    }
    if (!roundName.trim()) {
      setError("Collection name is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await badmintonFetch(
        tournamentId,
        `/categories/${category.id}/fixture-collections/manual`,
        {
          method: "POST",
          body: JSON.stringify({
            roundName: roundName.trim(),
            fixtures,
          }),
        },
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create fixtures");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title="Create Fixtures Manually"
      subtitle={category.name}
      onClose={onClose}
      size="lg"
    >
      <FormField label="Collection name" required>
        <input
          required
          aria-required="true"
          value={roundName}
          onChange={(e) => setRoundName(e.target.value)}
          placeholder="Manual Fixtures"
          className={inputClass}
        />
      </FormField>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          Fixtures (A vs B)
        </p>
        {pairs.map((pair, index) => (
          <div
            key={index}
            className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-2 items-end"
          >
            <FormField label={`Side A · Fixture ${index + 1}`}>
              <DarkSelect
                value={pair.registrationAId || "none"}
                onValueChange={(v) =>
                  updatePair(index, "registrationAId", v === "none" ? "" : v)
                }
                options={[
                  { value: "none", label: "Select entry…" },
                  ...entryOptions,
                ]}
              />
            </FormField>
            <span className="text-muted-foreground text-xs pb-3 text-center hidden sm:block font-bold">vs</span>
            <FormField label={`Side B · Fixture ${index + 1}`}>
              <DarkSelect
                value={pair.registrationBId || "none"}
                onValueChange={(v) =>
                  updatePair(index, "registrationBId", v === "none" ? "" : v)
                }
                options={[
                  { value: "none", label: "Select entry…" },
                  ...entryOptions,
                ]}
              />
            </FormField>
            <button
              type="button"
              disabled={pairs.length <= 1}
              onClick={() => setPairs((prev) => prev.filter((_, i) => i !== index))}
              className="h-11 px-3 rounded-xl text-xs text-muted-foreground hover:text-destructive disabled:opacity-30 cursor-pointer"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPairs((prev) => [...prev, { registrationAId: "", registrationBId: "" }])
          }
          className="text-xs font-semibold text-primary hover:underline"
        >
          + Add another fixture
        </button>
      </div>

      <FormError message={error} />
      <FormActions
        onCancel={onClose}
        onSubmit={() => void handleSave()}
        submitLabel="Create collection"
        saving={saving}
      />
    </FormModal>
  );
}

function LeagueGroupsPanel({
  tournamentId,
  categoryId,
}: {
  tournamentId: number;
  categoryId: number;
}) {
  const qc = useQueryClient();
  type LeagueGroup = {
    id: number;
    name: string;
    sortOrder: number;
    teams: Array<{ teamId: number; teamName: string; seed: number | null }>;
  };
  type FranchiseTeam = {
    auctionTeamId: number;
    name: string;
    shortName?: string;
  };
  type StandingRow = {
    rank: number;
    registrationId?: number;
    label: string;
    groupId?: number | null;
    groupName?: string | null;
    played: number;
    won: number;
    lost: number;
    marginPoints: number;
  };

  const { data: groups = [], isLoading } = useQuery<LeagueGroup[]>({
    queryKey: ["badminton-league-groups", tournamentId, categoryId],
    queryFn: () => badmintonFetch(tournamentId, `/categories/${categoryId}/groups`),
  });

  const { data: franchiseTeams = [] } = useQuery<FranchiseTeam[]>({
    queryKey: ["badminton-franchise-teams", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/franchise-teams`),
  });

  const { data: standings = [] } = useQuery<StandingRow[]>({
    queryKey: ["badminton-league-standings", tournamentId, categoryId],
    queryFn: () => badmintonFetch(tournamentId, `/categories/${categoryId}/standings`),
  });

  const [draftGroups, setDraftGroups] = useState<
    Array<{ name: string; teamIds: number[] }>
  >([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (isLoading) return;
    if (groups.length > 0) {
      setDraftGroups(
        groups.map((g) => ({
          name: g.name,
          teamIds: g.teams.map((t) => t.teamId),
        })),
      );
      setInitialized(true);
      return;
    }
    setDraftGroups([
      { name: "Group 1", teamIds: [] },
      { name: "Group 2", teamIds: [] },
    ]);
    setInitialized(true);
  }, [groups, isLoading, initialized]);

  function toggleTeam(groupIndex: number, teamId: number) {
    setDraftGroups((prev) =>
      prev.map((g, i) => {
        if (i !== groupIndex) {
          return { ...g, teamIds: g.teamIds.filter((id) => id !== teamId) };
        }
        const has = g.teamIds.includes(teamId);
        return {
          ...g,
          teamIds: has ? g.teamIds.filter((id) => id !== teamId) : [...g.teamIds, teamId],
        };
      }),
    );
  }

  async function saveGroups() {
    setSaving(true);
    setSaveError("");
    try {
      await badmintonFetch(tournamentId, `/categories/${categoryId}/groups`, {
        method: "PUT",
        body: JSON.stringify({
          groups: draftGroups.map((g, idx) => ({
            name: g.name,
            sortOrder: idx,
            teamIds: g.teamIds,
          })),
        }),
      });
      void qc.invalidateQueries({
        queryKey: ["badminton-league-groups", tournamentId, categoryId],
      });
      toastSuccess("Groups saved", "Assign pairs to franchise teams, then generate league.");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save groups");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-4">
      <div>
        <h4 className="text-foreground font-semibold">League Groups</h4>
        <p className="text-muted-foreground text-xs mt-1">
          Assign franchise teams to each group. Pairs are matched by slot (Rubber 1 vs Rubber 1, etc.).
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading groups…</p>
      ) : (
        <div className="space-y-4">
          {draftGroups.map((group, groupIndex) => (
            <div key={groupIndex} className="rounded-lg border border-border bg-card p-3 space-y-2 shadow-xs">
              <input
                value={group.name}
                onChange={(e) =>
                  setDraftGroups((prev) =>
                    prev.map((g, i) =>
                      i === groupIndex ? { ...g, name: e.target.value } : g,
                    ),
                  )
                }
                className={inputClass}
                placeholder="Group name"
              />
              <div className="flex flex-wrap gap-2">
                {franchiseTeams.map((team) => {
                  const selected = group.teamIds.includes(team.auctionTeamId);
                  const usedElsewhere = draftGroups.some(
                    (g, i) => i !== groupIndex && g.teamIds.includes(team.auctionTeamId),
                  );
                  return (
                    <button
                      key={team.auctionTeamId}
                      type="button"
                      disabled={usedElsewhere && !selected}
                      onClick={() => toggleTeam(groupIndex, team.auctionTeamId)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                        selected
                          ? "bg-cyan-600 text-white dark:bg-cyan-500/30 dark:text-cyan-100 border border-cyan-600"
                          : "bg-muted text-foreground border border-border hover:bg-muted/80",
                        usedElsewhere && !selected && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      {team.shortName ?? team.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setDraftGroups((prev) => [
                ...prev,
                { name: `Group ${prev.length + 1}`, teamIds: [] },
              ])
            }
            className="text-xs font-semibold text-primary hover:underline cursor-pointer"
          >
            + Add group
          </button>
        </div>
      )}

      {saveError ? <FormError message={saveError} /> : null}

      <div className="flex flex-wrap gap-2">
        <BtnPrimary type="button" onClick={() => void saveGroups()} disabled={saving}>
          {saving ? "Saving…" : "Save Groups"}
        </BtnPrimary>
      </div>

      {standings.length > 0 ? (
        <div className="space-y-4">
          {(groups.length > 1
            ? groups.map((g) => ({
                key: String(g.id),
                title: g.name,
                rows: standings
                  .filter((s) => s.groupId === g.id)
                  .map((row, i) => ({ ...row, rank: i + 1 })),
              }))
            : [
                {
                  key: "all",
                  title: "Pair Standings",
                  rows: standings,
                },
              ]
          ).map((board) =>
            board.rows.length === 0 ? null : (
              <div key={board.key} className="overflow-x-auto">
                <h5 className="text-foreground text-xs font-bold uppercase tracking-wider mb-2">
                  {board.title}
                  <span className="normal-case font-normal text-muted-foreground ml-2">
                    (wins → point difference)
                  </span>
                </h5>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground border-b border-border/60 text-left">
                      <th className="py-1.5 pr-2">#</th>
                      <th className="py-1.5 pr-2">Pair</th>
                      <th className="py-1.5 pr-2">P</th>
                      <th className="py-1.5 pr-2">W</th>
                      <th className="py-1.5 pr-2">L</th>
                      <th className="py-1.5">Diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {board.rows.map((row) => (
                      <tr
                        key={`${board.key}-${row.registrationId ?? row.rank}-${row.label}`}
                        className="border-b border-border/40 text-foreground"
                      >
                        <td className="py-2 pr-2 font-mono">{row.rank}</td>
                        <td className="py-2 pr-2 font-medium">{row.label}</td>
                        <td className="py-2 pr-2 tabular-nums">{row.played}</td>
                        <td className="py-2 pr-2 tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">{row.won}</td>
                        <td className="py-2 pr-2 tabular-nums text-muted-foreground">{row.lost}</td>
                        <td className="py-2 font-bold tabular-nums text-primary">{row.marginPoints}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          )}
          <p className="text-[10px] text-muted-foreground">
            Ranked by wins, then point difference on won matches. Male: top 4 per
            group → QF. Female: top 4 overall → SF.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function FixturePlanCard({
  fixture,
  regIdentityMap,
  tournamentId,
}: {
  fixture: BadmintonFixture;
  regIdentityMap: Map<number, TeamPlayerIdentity>;
  tournamentId: number;
}) {
  const sideA = fixture.registrationAId
    ? (regIdentityMap.get(fixture.registrationAId) ?? { playerName: "TBD" })
    : { playerName: "BYE" };
  const sideB = fixture.registrationBId
    ? (regIdentityMap.get(fixture.registrationBId) ?? { playerName: "TBD" })
    : { playerName: "BYE" };

  return (
    <div className="rounded-xl bg-card border border-border p-4 shadow-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted-foreground text-xs font-bold">
          Match {fixture.slotNumber ?? "—"}
        </span>
        <span
          className={cn(
            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
            fixture.status === "scheduled"
              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/25"
              : fixture.status === "walkover"
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25"
                : "bg-muted text-muted-foreground border-border/70",
          )}
        >
          {fixture.status}
        </span>
      </div>
      <TeamPlayerVs left={sideA} right={sideB} size="sm" layout="stack" tone="muted" />
      {fixture.scoringMatchId ? (
        <a
          href={`/tournament/${tournamentId}/badminton/matches/${fixture.scoringMatchId}/control`}
          className="mt-3 block text-center text-primary text-xs font-semibold hover:underline min-h-11 leading-[2.75rem]"
        >
          Match Control →
        </a>
      ) : (
        <Link
          href={`/tournament/${tournamentId}/badminton/schedule?fixture=${fixture.id}`}
          className="mt-3 block text-center text-primary text-xs font-semibold hover:underline min-h-11 leading-[2.75rem]"
        >
          Open Scheduling →
        </Link>
      )}
    </div>
  );
}
