/**
 * Badminton Categories — event definitions only.
 * Route: /tournament/:id/badminton/categories
 * Fixture creation lives in Draw & Fixtures (Open Draw & Fixtures CTA).
 */

import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { badmintonFetch } from "@/lib/badminton-api";
import { formatCategoryPhaseLabel } from "@/lib/badminton-ux";
import { Trophy, Pencil, Trash2 } from "lucide-react";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import { EmptyState, FormField, inputClass, HubPageShell, BtnPrimary, DarkSelect, FormActions, FormError, FormModal, hubCardClass, AsyncLoadingPanel } from "@/components/badminton/page-chrome";
import { BadmintonSetupWizardChrome } from "@/components/badminton/setup-wizard-chrome";
import {
  MatchFormatPicker,
  matchFormatJsonFromPicker,
  matchFormatPickerFromStored,
  type MatchFormatPickerValue,
} from "@/components/badminton/match-format-picker";
import { useBadmintonScoringFormat } from "@/hooks/use-badminton-scoring-format";
import { matchFormatChipLabel } from "@/lib/match-format-display";
import { parseBadmintonMatchFormat } from "@workspace/badminton-core";

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
  matchFormatJson?: Record<string, unknown> | null;
}

interface BadmintonPlayer {
  id: number;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  gender?: string | null;
  franchiseName?: string | null;
  franchiseLogoUrl?: string | null;
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
  player2?: BadmintonPlayer | null;
}

export default function BadmintonCategoriesPage() {
  const [, params] = useRoute("/tournament/:id/badminton/categories");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();

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
    <HubPageShell tournamentId={tournamentId}>
      <BadmintonSetupWizardChrome
        tournamentId={tournamentId}
        stepId="categories"
        headerActions={
          <BtnPrimary onClick={() => { setEditCategory(null); setShowForm(true); }}>
            + Add Event
          </BtnPrimary>
        }
      >
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No events yet"
            desc="Create events like Men's Singles, Women's Doubles, Mixed Doubles."
            action={{ label: "Add Event", onClick: () => setShowForm(true) }}
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
              onDeleted={() => {
                if (expandedId === cat.id) setExpandedId(null);
                qc.invalidateQueries({ queryKey: ["badminton-categories", tournamentId] });
                qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
              }}
              onRefresh={() => {
                qc.invalidateQueries({ queryKey: ["badminton-categories", tournamentId] });
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
      </BadmintonSetupWizardChrome>
    </HubPageShell>
  );
}

function CategoryPanel({
  category,
  tournamentId,
  expanded,
  onToggle,
  onEdit,
  onDeleted,
  onRefresh,
}: {
  category: BadmintonCategory;
  tournamentId: number;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDeleted: () => void;
  onRefresh: () => void;
}) {
  const { data: registrations = [], isLoading: regsLoading } = useQuery<RegistrationRow[]>({
    queryKey: ["badminton-registrations", tournamentId, category.id],
    queryFn: () => badmintonFetch(tournamentId, `/categories/${category.id}/registrations`),
    enabled: expanded && !!tournamentId,
  });

  const { data: playersForLabels = [] } = useQuery<BadmintonPlayer[]>({
    queryKey: ["badminton-players", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/players`),
    enabled: expanded && !!tournamentId,
  });

  const [showAddReg, setShowAddReg] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const playerById = new Map(playersForLabels.map((p) => [p.id, p]));
  const acceptedCount = registrations.filter((r) => r.registration.status === "accepted").length;

  async function handleConfirmDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await badmintonFetch(tournamentId, `/categories/${category.id}`, { method: "DELETE" });
      setConfirmDeleteOpen(false);
      onDeleted();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const isDoublesEntry = category.matchType !== "singles";

  return (
    <div className={cn(hubCardClass, "overflow-hidden")}>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center justify-between gap-4 p-5 text-left hover:bg-white/3 transition-colors min-w-0"
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
                {(() => {
                  const fmt = parseBadmintonMatchFormat(category.matchFormatJson);
                  return fmt ? ` · ${matchFormatChipLabel(fmt)}` : "";
                })()}
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
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          title="Edit category"
          aria-label={`Edit ${category.name}`}
          className="flex-none w-14 border-l border-white/8 hover:bg-white/6 text-white/50 hover:text-white transition-colors flex items-center justify-center"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDeleteError("");
            setConfirmDeleteOpen(true);
          }}
          title="Delete category"
          aria-label={`Delete ${category.name}`}
          className="flex-none w-14 border-l border-white/8 hover:bg-red-500/10 text-white/50 hover:text-red-400 transition-colors flex items-center justify-center"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <ConfirmActionDialog
        open={confirmDeleteOpen}
        onOpenChange={(open) => {
          setConfirmDeleteOpen(open);
          if (!open) setDeleteError("");
        }}
        title="Delete category?"
        description={
          <div className="space-y-2">
            <p>
              Delete <span className="text-foreground font-medium">{category.name}</span>?
              All entries for this category will be permanently removed. Fixture collections and
              linked matches must be cleared first if they exist.
            </p>
            <p>This cannot be undone.</p>
          </div>
        }
        confirmLabel="Delete category"
        busy={deleting}
        error={deleteError || undefined}
        onConfirm={() => void handleConfirmDelete()}
      />

      {expanded && (
        <div className="border-t border-white/8 p-5 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onEdit}
              className="min-h-11 px-4 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition-colors"
            >
              Edit Event
            </button>
            <button
              onClick={() => setShowAddReg(true)}
              className="min-h-11 px-4 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors border border-primary/25"
            >
              + Add Entry
            </button>
            <Link
              href={`/tournament/${tournamentId}/badminton/fixtures?categoryId=${category.id}`}
              className="min-h-11 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-colors inline-flex items-center"
            >
              Open Tournament Draw
            </Link>
          </div>

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
                        {formatRegistrationEntryName(row, isDoublesEntry, playerById)}
                      </p>
                      <p className="text-white/30 text-xs capitalize">
                        {row.registration.seedNumber
                          ? `Seed ${row.registration.seedNumber} · ${row.registration.status}`
                          : row.registration.status}
                      </p>
                    </div>
                    {row.registration.status === "withdrawn" ? (
                      <button
                        type="button"
                        className="min-h-11 px-3 text-xs uppercase tracking-wide text-emerald-400 hover:text-emerald-300"
                        onClick={() =>
                          void badmintonFetch(
                            tournamentId,
                            `/categories/${category.id}/registrations/${row.registration.id}`,
                            { method: "PATCH", body: JSON.stringify({ status: "accepted" }) },
                          ).then(() => onRefresh())
                        }
                      >
                        Reinstate
                      </button>
                    ) : row.registration.status !== "disqualified" ? (
                      <button
                        type="button"
                        className="min-h-11 px-3 text-xs uppercase tracking-wide text-amber-400 hover:text-amber-300"
                        onClick={() =>
                          void badmintonFetch(
                            tournamentId,
                            `/categories/${category.id}/registrations/${row.registration.id}`,
                            { method: "PATCH", body: JSON.stringify({ status: "withdrawn" }) },
                          ).then(() => onRefresh())
                        }
                      >
                        Withdraw
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
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
  const { data: tournamentFormat } = useBadmintonScoringFormat(tournamentId);
  const tournamentInheritLabel = tournamentFormat
    ? `Tournament: ${matchFormatChipLabel(tournamentFormat.format, tournamentFormat.presetId)}`
    : "Tournament default (BWF Standard · 21)";

  const [form, setForm] = useState({
    name: category?.name ?? "",
    code: category?.code ?? "",
    matchType: category?.matchType ?? "singles",
    ageGroup: category?.ageGroup ?? "",
    gender: category?.gender ?? "",
    drawType: category?.drawType ?? "knockout",
    numSeeds: category?.numSeeds ?? 0,
    maxPlayers: category?.maxPlayers ?? "",
    colorCode: category?.colorCode ?? "#F59E0B",
  });
  const [formatPicker, setFormatPicker] = useState<MatchFormatPickerValue>(() =>
    matchFormatPickerFromStored(category?.matchFormatJson),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const f = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [key]: e.target.value })),
  });

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Event name is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const matchFormatJson = matchFormatJsonFromPicker(formatPicker);
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
        // null clears category override (inherit tournament)
        matchFormatJson: matchFormatJson ?? null,
      };
      if (category) {
        await badmintonFetch(tournamentId, `/categories/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await badmintonFetch(tournamentId, `/categories`, {
          method: "POST",
          body: JSON.stringify({
            ...body,
            // omit null on create — inherit tournament
            matchFormatJson: matchFormatJson ?? undefined,
          }),
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
      title={category ? "Edit Event" : "Add Event"}
      subtitle="An Event is one competition — for example Men's Singles. It later gets a Draw, Schedule, and Champion."
      onClose={onClose}
      size="lg"
    >
      <FormField label="Event Name *">
        <input {...f("name")} placeholder="Men's Singles" className={inputClass} />
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

      <MatchFormatPicker
        value={formatPicker}
        onChange={setFormatPicker}
        inheritLabel={tournamentInheritLabel}
        inheritOptionLabel="Use tournament default"
      />

      <FormError message={error} />

      <FormActions
        onCancel={onClose}
        onSubmit={handleSave}
        submitLabel={category ? "Save Changes" : "Add Event"}
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

  const { data: players = [], isLoading: playersLoading } = useQuery<BadmintonPlayer[]>({
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
      {playersLoading ? (
        <AsyncLoadingPanel tone="inverse" compact message="Loading registered players…" />
      ) : (
        <>
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
        </>
      )}
    </FormModal>
  );
}

function PhaseBadge({ phase }: { phase: string }) {
  const styles: Record<string, string> = {
    setup: "bg-muted text-muted-foreground",
    draw_generated: "bg-amber-500/15 text-amber-300",
    live: "bg-red-500/15 text-red-400",
    completed: "bg-emerald-500/15 text-emerald-400",
  };
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full min-h-7 inline-flex items-center",
        styles[phase] ?? styles.setup,
      )}
    >
      {formatCategoryPhaseLabel(phase)}
    </span>
  );
}

function formatPlayerName(p: BadmintonPlayer): string {
  const name = p.displayName?.trim() || `${p.firstName} ${p.lastName}`.trim();
  const team = p.franchiseName?.trim();
  return team ? `${team} · ${name}` : name;
}

function formatRegistrationEntryName(
  row: RegistrationRow,
  isDoubles: boolean,
  playerById?: Map<number, BadmintonPlayer>,
): string {
  const enrich = (p: BadmintonPlayer | null | undefined) => {
    if (!p?.id) return p ?? null;
    const fromList = playerById?.get(p.id);
    return fromList ? { ...p, franchiseName: fromList.franchiseName ?? p.franchiseName, franchiseLogoUrl: fromList.franchiseLogoUrl ?? p.franchiseLogoUrl } : p;
  };
  const p1 = enrich(row.player1);
  const p2 = enrich(row.player2);
  const name1 = p1?.id ? formatPlayerName(p1) : null;
  const name2 = p2?.id ? formatPlayerName(p2) : null;

  if (isDoubles) {
    if (name1 && name2) return `${name1} / ${name2}`;
    if (name1) return `${name1} / Partner not set`;
    if (name2) return `Player not set / ${name2}`;
    return "Doubles entry (players missing)";
  }

  return name1 ?? "Player name unavailable";
}

function formatMatchType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
