/**
 * Badminton Categories & Draw Management
 * Route: /tournament/:id/badminton/categories
 */

import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { EmptyState, FormField, inputClass, PageHeader, HubPageShell, BtnPrimary, DarkSelect, FormActions, FormError, FormModal } from "@/components/badminton/page-chrome";

interface BadmintonCategory {
  id: number;
  tournamentId: number;
  name: string;
  code?: string | null;
  matchType: string;
  ageGroup?: string | null;
  gender?: string | null;
  drawType: string;
  numSeeds: number;
  phase: string;
  maxPlayers?: number | null;
  entryFee?: number | null;
  colorCode?: string | null;
}

interface BadmintonPlayer {
  id: number;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  gender?: string | null;
}

interface RegistrationRow {
  registration: {
    id: number;
    player1Id: number;
    player2Id?: number | null;
    seedNumber?: number | null;
    status: string;
  };
  player1: BadmintonPlayer | null;
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

export default function BadmintonCategoriesPage() {
  const [, params] = useRoute("/tournament/:id/badminton/categories");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();
  const hubHref = `/tournament/${tournamentId}/badminton`;

  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<BadmintonCategory | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: categories = [], isLoading } = useQuery<BadmintonCategory[]>({
    queryKey: ["badminton-categories", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/categories`),
    enabled: !!tournamentId,
  });

  const sorted = [...categories].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <HubPageShell>
      <PageHeader
        title="Categories & Draws"
        subtitle={`${categories.length} categor${categories.length !== 1 ? "ies" : "y"}`}
        backHref={hubHref}
        actions={
          <BtnPrimary onClick={() => { setEditCategory(null); setShowForm(true); }}>
            + Add Category
          </BtnPrimary>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/4 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon="🏆"
            title="No categories yet"
            desc="Create draw categories like Men's Singles U-19, Women's Doubles, etc."
            action={{ label: "Add Category", onClick: () => setShowForm(true) }}
          />
        ) : (
          sorted.map((cat) => (
            <CategoryPanel
              key={cat.id}
              category={cat}
              tournamentId={tournamentId}
              expanded={expandedId === cat.id}
              onToggle={() => setExpandedId(expandedId === cat.id ? null : cat.id)}
              onEdit={() => { setEditCategory(cat); setShowForm(true); }}
              onRefresh={() => {
                qc.invalidateQueries({ queryKey: ["badminton-categories", tournamentId] });
                qc.invalidateQueries({ queryKey: ["badminton-fixtures", tournamentId, cat.id] });
                qc.invalidateQueries({ queryKey: ["badminton-registrations", tournamentId, cat.id] });
                qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
              }}
            />
          ))
        )}
      </div>

      {showForm && (
        <CategoryFormModal
          tournamentId={tournamentId}
          category={editCategory}
          onClose={() => { setShowForm(false); setEditCategory(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["badminton-categories", tournamentId] });
            qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
            setShowForm(false);
            setEditCategory(null);
          }}
        />
      )}
    </HubPageShell>
  );
}

function CategoryPanel({
  category,
  tournamentId,
  expanded,
  onToggle,
  onEdit,
  onRefresh,
}: {
  category: BadmintonCategory;
  tournamentId: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRefresh: () => void;
}) {
  const { data: registrations = [], isLoading: regsLoading } = useQuery<RegistrationRow[]>({
    queryKey: ["badminton-registrations", tournamentId, category.id],
    queryFn: () => badmintonFetch(tournamentId, `/categories/${category.id}/registrations`),
    enabled: expanded && !!tournamentId,
  });

  const { data: fixtures = [] } = useQuery<BadmintonFixture[]>({
    queryKey: ["badminton-fixtures", tournamentId, category.id],
    queryFn: () => badmintonFetch(tournamentId, `/fixtures?categoryId=${category.id}`),
    enabled: expanded && !!tournamentId,
  });

  const [generating, setGenerating] = useState(false);
  const [drawError, setDrawError] = useState("");
  const [showAddReg, setShowAddReg] = useState(false);

  const acceptedCount = registrations.filter((r) => r.registration.status === "accepted").length;
  const hasDraw = fixtures.length > 0;

  async function handleGenerateDraw() {
    if (acceptedCount < 2) {
      setDrawError("Need at least 2 accepted entries to generate a draw");
      return;
    }
    if (!window.confirm(`Generate knockout draw for ${category.name}? This cannot be undone.`)) return;
    setGenerating(true);
    setDrawError("");
    try {
      await badmintonFetch(tournamentId, `/categories/${category.id}/generate-draw`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      onRefresh();
    } catch (e) {
      setDrawError(e instanceof Error ? e.message : "Draw generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const regNameMap = new Map<number, string>();
  for (const row of registrations) {
    const p1 = row.player1;
    if (p1) {
      regNameMap.set(row.registration.id, formatPlayerName(p1));
    }
  }

  return (
    <div className="rounded-2xl bg-[#0d1529] border border-white/8 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-4 min-w-0">
          {category.colorCode && (
            <div
              className="w-3 h-10 rounded-full flex-none"
              style={{ backgroundColor: category.colorCode }}
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-white font-bold text-lg truncate">{category.name}</h3>
              {category.code && (
                <span className="text-[10px] font-bold uppercase tracking-wider bg-white/10 text-white/50 px-2 py-0.5 rounded-full">
                  {category.code}
                </span>
              )}
              <PhaseBadge phase={category.phase} />
            </div>
            <p className="text-white/40 text-sm mt-0.5">
              {formatMatchType(category.matchType)}
              {category.ageGroup ? ` · ${category.ageGroup}` : ""}
              {category.gender ? ` · ${category.gender}` : ""}
              {" · "}{category.drawType.replace("_", " ")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-none">
          <span className="text-white/30 text-sm">{acceptedCount} entries</span>
          <svg
            className={cn("w-5 h-5 text-white/40 transition-transform", expanded && "rotate-180")}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-white/8 p-5 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onEdit}
              className="h-9 px-4 rounded-lg bg-white/8 hover:bg-white/12 text-white/70 text-xs font-semibold transition-colors"
            >
              Edit Category
            </button>
            <button
              onClick={() => setShowAddReg(true)}
              className="h-9 px-4 rounded-lg bg-[#0070f3]/20 hover:bg-[#0070f3]/30 text-[#4fc3f7] text-xs font-semibold transition-colors"
            >
              + Add Entry
            </button>
            {!hasDraw && (
              <button
                onClick={handleGenerateDraw}
                disabled={generating || acceptedCount < 2}
                className="h-9 px-4 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 disabled:opacity-40 text-purple-300 text-xs font-semibold transition-colors"
              >
                {generating ? "Generating…" : "Generate Knockout Draw"}
              </button>
            )}
          </div>

          {drawError && <p className="text-red-400 text-sm">{drawError}</p>}

          {/* Registrations */}
          <section>
            <h4 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
              Entries ({registrations.length})
            </h4>
            {regsLoading ? (
              <div className="h-16 rounded-xl bg-white/4 animate-pulse" />
            ) : registrations.length === 0 ? (
              <p className="text-white/30 text-sm">No entries yet — add players to this category.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {registrations.map((row) => (
                  <div
                    key={row.registration.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/8"
                  >
                    {row.registration.seedNumber && (
                      <span className="w-6 h-6 rounded-full bg-[#ffd700]/20 text-[#ffd700] text-xs font-black flex items-center justify-center flex-none">
                        {row.registration.seedNumber}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-white text-sm font-medium truncate">
                        {row.player1 ? formatPlayerName(row.player1) : `Player #${row.registration.player1Id}`}
                      </p>
                      <p className="text-white/30 text-xs capitalize">{row.registration.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Draw / Fixtures */}
          {hasDraw && (
            <section>
              <h4 className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">
                Draw — Round 1 ({fixtures.length} fixture{fixtures.length !== 1 ? "s" : ""})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {fixtures
                  .sort((a, b) => (a.slotNumber ?? 0) - (b.slotNumber ?? 0))
                  .map((fix) => (
                    <FixtureCard
                      key={fix.id}
                      fixture={fix}
                      regNameMap={regNameMap}
                      tournamentId={tournamentId}
                    />
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showAddReg && (
        <AddRegistrationModal
          tournamentId={tournamentId}
          category={category}
          onClose={() => setShowAddReg(false)}
          onSaved={() => {
            onRefresh();
            setShowAddReg(false);
          }}
        />
      )}
    </div>
  );
}

function FixtureCard({
  fixture,
  regNameMap,
  tournamentId,
}: {
  fixture: BadmintonFixture;
  regNameMap: Map<number, string>;
  tournamentId: number;
}) {
  const sideA = fixture.registrationAId
    ? regNameMap.get(fixture.registrationAId) ?? "TBD"
    : "BYE";
  const sideB = fixture.registrationBId
    ? regNameMap.get(fixture.registrationBId) ?? "TBD"
    : "BYE";

  return (
    <div className="rounded-xl bg-white/5 border border-white/8 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-white/30 text-xs font-bold">Match {fixture.slotNumber ?? "—"}</span>
        <span className={cn(
          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
          fixture.status === "scheduled" ? "bg-blue-500/15 text-blue-400" :
          fixture.status === "walkover" ? "bg-amber-500/15 text-amber-400" :
          "bg-white/10 text-white/50",
        )}>
          {fixture.status}
        </span>
      </div>
      <div className="space-y-1.5">
        <p className="text-white text-sm font-medium truncate">{sideA}</p>
        <p className="text-white/30 text-xs text-center">vs</p>
        <p className="text-white text-sm font-medium truncate">{sideB}</p>
      </div>
      {fixture.scoringMatchId && (
        <a
          href={`/badminton/${fixture.scoringMatchId}/score?tid=${tournamentId}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-center text-[#4fc3f7] text-xs font-semibold hover:underline"
        >
          Open Scorer →
        </a>
      )}
    </div>
  );
}

function CategoryFormModal({
  tournamentId,
  category,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  category: BadmintonCategory | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: category?.name ?? "",
    code: category?.code ?? "",
    matchType: category?.matchType ?? "singles",
    ageGroup: category?.ageGroup ?? "",
    gender: category?.gender ?? "",
    drawType: category?.drawType ?? "knockout",
    numSeeds: category?.numSeeds ?? 0,
    maxPlayers: category?.maxPlayers ?? "",
    colorCode: category?.colorCode ?? "#0070f3",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Category name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        code: form.code.trim() || undefined,
        matchType: form.matchType,
        ageGroup: form.ageGroup.trim() || undefined,
        gender: form.gender.trim() || undefined,
        drawType: form.drawType,
        numSeeds: parseInt(String(form.numSeeds), 10) || 0,
        maxPlayers: form.maxPlayers ? parseInt(String(form.maxPlayers), 10) : undefined,
        colorCode: form.colorCode || undefined,
      };
      if (category) {
        await badmintonFetch(tournamentId, `/categories/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await badmintonFetch(tournamentId, `/categories`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={category ? "Edit Category" : "Add Category"}
      subtitle="Define draw category settings"
      onClose={onClose}
      size="lg"
    >
      <FormField label="Category Name *">
        <input {...f("name")} placeholder="Men's Singles U-19" className={inputClass} />
      </FormField>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Code">
          <input {...f("code")} placeholder="MS-U19" maxLength={20} className={inputClass} />
        </FormField>
        <FormField label="Color">
          <input {...f("colorCode")} type="color" className="w-full h-11 rounded-xl cursor-pointer bg-[#121c34] border border-white/12" />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Match Type">
          <DarkSelect
            value={form.matchType}
            onValueChange={(matchType) => setForm((prev) => ({ ...prev, matchType }))}
            options={[
              { value: "singles", label: "Singles" },
              { value: "doubles", label: "Doubles" },
              { value: "mixed_doubles", label: "Mixed Doubles" },
            ]}
          />
        </FormField>
        <FormField label="Draw Type">
          <DarkSelect
            value={form.drawType}
            onValueChange={(drawType) => setForm((prev) => ({ ...prev, drawType }))}
            options={[
              { value: "knockout", label: "Knockout" },
              { value: "round_robin", label: "Round Robin" },
              { value: "group_knockout", label: "Group + Knockout" },
            ]}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Age Group">
          <input {...f("ageGroup")} placeholder="U19, Senior…" className={inputClass} />
        </FormField>
        <FormField label="Gender">
          <DarkSelect
            value={form.gender || "any"}
            onValueChange={(gender) => setForm((prev) => ({ ...prev, gender: gender === "any" ? "" : gender }))}
            options={[
              { value: "any", label: "Any" },
              { value: "M", label: "Male" },
              { value: "F", label: "Female" },
              { value: "Mixed", label: "Mixed" },
            ]}
          />
        </FormField>
        <FormField label="Seeds">
          <input {...f("numSeeds")} type="number" min={0} max={32} className={inputClass} />
        </FormField>
      </div>

      <FormField label="Max Players">
        <input {...f("maxPlayers")} type="number" min={2} placeholder="Unlimited" className={inputClass} />
      </FormField>

      <FormError message={error} />

      <FormActions
        onCancel={onClose}
        onSubmit={handleSave}
        submitLabel={category ? "Save Changes" : "Add Category"}
        saving={saving}
      />
    </FormModal>
  );
}

function AddRegistrationModal({
  tournamentId,
  category,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  category: BadmintonCategory;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isDoubles = category.matchType !== "singles";

  const { data: players = [] } = useQuery<BadmintonPlayer[]>({
    queryKey: ["badminton-players", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/players`),
    enabled: !!tournamentId,
  });

  const [player1Id, setPlayer1Id] = useState("");
  const [player2Id, setPlayer2Id] = useState("");
  const [seedNumber, setSeedNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!player1Id) {
      setError("Select a player");
      return;
    }
    if (isDoubles && !player2Id) {
      setError("Select a partner for doubles");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await badmintonFetch(tournamentId, `/categories/${category.id}/registrations`, {
        method: "POST",
        body: JSON.stringify({
          player1Id: parseInt(player1Id, 10),
          player2Id: isDoubles ? parseInt(player2Id, 10) : undefined,
          seedNumber: seedNumber ? parseInt(seedNumber, 10) : undefined,
          status: "accepted",
        }),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal title="Add Entry" subtitle={category.name} onClose={onClose} size="md">
      <FormField label={isDoubles ? "Player 1 *" : "Player *"}>
        <DarkSelect
          value={player1Id || "none"}
          onValueChange={(v) => setPlayer1Id(v === "none" ? "" : v)}
          placeholder="Select player…"
          options={[
            { value: "none", label: "Select player…" },
            ...players.map((p) => ({ value: String(p.id), label: formatPlayerName(p) })),
          ]}
        />
      </FormField>

      {isDoubles && (
        <FormField label="Player 2 (Partner) *">
          <DarkSelect
            value={player2Id || "none"}
            onValueChange={(v) => setPlayer2Id(v === "none" ? "" : v)}
            placeholder="Select partner…"
            options={[
              { value: "none", label: "Select partner…" },
              ...players.filter((p) => String(p.id) !== player1Id).map((p) => ({
                value: String(p.id),
                label: formatPlayerName(p),
              })),
            ]}
          />
        </FormField>
      )}

      <FormField label="Seed Number (optional)">
        <input
          type="number"
          min={1}
          max={32}
          value={seedNumber}
          onChange={(e) => setSeedNumber(e.target.value)}
          placeholder="Leave blank for unseeded"
          className={inputClass}
        />
      </FormField>

      <FormError message={error} />

      <FormActions onCancel={onClose} onSubmit={handleSave} submitLabel="Add Entry" saving={saving} />
    </FormModal>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const styles: Record<string, string> = {
    setup: "bg-white/10 text-white/50",
    draw_generated: "bg-purple-500/15 text-purple-400",
    live: "bg-red-500/15 text-red-400",
    completed: "bg-green-500/15 text-green-400",
  };
  return (
    <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full", styles[phase] ?? styles.setup)}>
      {phase.replace("_", " ")}
    </span>
  );
}

function formatPlayerName(p: BadmintonPlayer): string {
  return p.displayName || `${p.firstName} ${p.lastName}`.trim();
}

function formatMatchType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
