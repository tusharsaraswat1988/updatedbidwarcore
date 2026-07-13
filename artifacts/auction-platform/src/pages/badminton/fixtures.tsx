/**
 * Draw & Fixtures — planning module
 * Route: /tournament/:id/badminton/fixtures
 *
 * Category → Fixture Collections → Fixtures
 * Planning only: Schedule / Create Match. No Start Match / Scoring / Live.
 *
 * Fixture Source Adapters (all write via shared backend writer):
 *   Auto Generate | Manual Entry | Import (Phase 1 stub)
 */

import { useState } from "react";
import { useRoute, Link, useSearch } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { ListTree } from "lucide-react";
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
import { BadmintonSetupWizardChrome } from "@/components/badminton/setup-wizard-chrome";
import { SetupTerm } from "@/components/badminton/setup-guide-panel";
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
  player1: { firstName: string; lastName: string; displayName?: string | null } | null;
  player2?: { firstName: string; lastName: string; displayName?: string | null } | null;
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
      <BadmintonSetupWizardChrome
        tournamentId={tournamentId}
        stepId="draws"
        headerActions={
          sorted.length > 0 ? (
            <Link href={`/tournament/${tournamentId}/badminton/schedule`}>
              <BtnPrimary type="button">Go to Court Schedule</BtnPrimary>
            </Link>
          ) : null
        }
        guideExtras={
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                {
                  title: "Generate Automatically",
                  desc: "Software builds the draw from event entries.",
                },
                {
                  title: "Import Existing Draw",
                  desc: "Bring in a draw you already planned elsewhere.",
                },
                {
                  title: "Create Manually",
                  desc: "Enter each pairing yourself.",
                },
              ].map((option) => (
                <div
                  key={option.title}
                  className="rounded-lg border border-border/70 bg-background/50 px-3 py-2.5"
                >
                  <p className="text-xs font-semibold text-foreground">{option.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{option.desc}</p>
                </div>
              ))}
            </div>
            <SetupTerm
              term="Fixture"
              meaning="one planned match in the draw (who plays whom) — before a court/time is assigned."
            />
            <p className="text-xs text-muted-foreground">
              Every option creates the same tournament fixtures. Pick the path that is easiest for you.
            </p>
          </div>
        }
      >
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading fixtures">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={ListTree}
            title="No events yet"
            desc="Define events first, then return here to create the tournament draw."
            action={{
              label: "Open Events",
              href: `/tournament/${tournamentId}/badminton/categories`,
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
      </BadmintonSetupWizardChrome>
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
  const [showImportInfo, setShowImportInfo] = useState(false);
  const [error, setError] = useState("");

  const { data: registrations = [] } = useQuery<RegistrationRow[]>({
    queryKey: ["badminton-registrations", tournamentId, category.id],
    queryFn: () => badmintonFetch(tournamentId, `/categories/${category.id}/registrations`),
    enabled: expanded && !!tournamentId,
  });

  const accepted = registrations.filter((r) => r.registration.status === "accepted");
  const acceptedCount = accepted.length;
  const isDoubles = category.matchType !== "singles";
  const regNameMap = new Map<number, string>();
  for (const row of registrations) {
    regNameMap.set(row.registration.id, registrationLabel(row, isDoubles));
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
      await badmintonFetch(tournamentId, `/categories/${category.id}/generate-draw`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toastSuccess("Fixtures generated", `${category.name} draw is ready to schedule.`);
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
              onClick={() => {
                setError("");
                if (acceptedCount < 2) {
                  setError("Add at least 2 accepted entries in Categories before generating a draw.");
                  return;
                }
                setConfirmGenerate(true);
              }}
              disabled={generating || acceptedCount < 2}
              className="min-h-11 px-4 rounded-lg bg-purple-500/25 hover:bg-purple-500/35 disabled:opacity-40 text-purple-200 text-sm font-bold transition-colors"
              title={acceptedCount < 2 ? "Need 2+ accepted entries" : "Generate knockout fixtures"}
            >
              {generating ? "Generating…" : "Auto Generate Draw"}
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setShowManual(true);
              }}
              disabled={acceptedCount < 1}
              className="min-h-11 px-4 rounded-lg bg-white/8 hover:bg-white/12 disabled:opacity-40 text-white/80 text-xs font-semibold transition-colors"
            >
              Create Fixtures Manually
            </button>
            <button
              type="button"
              onClick={() => setShowImportInfo(true)}
              className="min-h-11 px-4 rounded-lg bg-white/5 hover:bg-white/8 text-white/50 text-xs font-semibold transition-colors"
            >
              Import Existing Draw
            </button>
          </div>

          {error ? <FormError message={error} /> : null}

          {collections.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-5 text-center space-y-2">
              <p className="text-white/70 text-sm font-semibold">No fixture collections yet</p>
              <p className="text-white/40 text-xs max-w-md mx-auto">
                Generate a draw for this category, or create fixtures manually. Then open Scheduling to assign courts and times.
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

      {showImportInfo ? (
        <ImportPlaceholderModal onClose={() => setShowImportInfo(false)} />
      ) : null}

      <ConfirmActionDialog
        open={confirmGenerate}
        onOpenChange={setConfirmGenerate}
        title="Generate knockout draw?"
        description={
          <div className="space-y-2">
            <p>
              Create a knockout fixture collection for{" "}
              <span className="text-foreground font-medium">{category.name}</span> using{" "}
              {acceptedCount} accepted entries.
            </p>
            <p>You can schedule courts and times afterward in Scheduling.</p>
          </div>
        }
        confirmLabel="Generate draw"
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
      <FormField label="Collection name">
        <input
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
            <span className="text-white/30 text-xs pb-3 text-center hidden sm:block">vs</span>
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
              className="h-11 px-3 rounded-xl text-xs text-white/40 hover:text-red-400 disabled:opacity-30"
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

function ImportPlaceholderModal({ onClose }: { onClose: () => void }) {
  return (
    <FormModal
      title="Import Existing Draw"
      subtitle="Coming in a later phase"
      onClose={onClose}
      size="md"
    >
      <p className="text-sm text-muted-foreground leading-relaxed">
        Import will accept association draws, Excel sheets, CSV lists, and PDF brackets. In Phase 1
        this is a placeholder only — no file is uploaded or parsed. When ready, Import will create a
        Fixture Collection (kind: imported) through the same fixture writer as Auto and Manual.
      </p>
      <FormActions onCancel={onClose} onSubmit={onClose} submitLabel="Got it" saving={false} />
    </FormModal>
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
        <a
          href={`/tournament/${tournamentId}/badminton/matches/${fixture.scoringMatchId}/control`}
          className="mt-3 block text-center text-amber-300 text-xs font-semibold hover:underline min-h-11 leading-[2.75rem]"
        >
          Match Control →
        </a>
      ) : (
        <Link
          href={`/tournament/${tournamentId}/badminton/schedule?fixture=${fixture.id}`}
          className="mt-3 block text-center text-[#4fc3f7] text-xs font-semibold hover:underline min-h-11 leading-[2.75rem]"
        >
          Open Scheduling →
        </Link>
      )}
    </div>
  );
}
