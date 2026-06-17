/**
 * Badminton Matches Management
 * Route: /tournament/:id/badminton/matches
 */

import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Target, X, Pencil } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { isPairMatchKind, mergeDoublesSideJson } from "@workspace/badminton-core";
import {
  PairSidePicker,
  emptySidePlayer,
  sidePlayerFormToJson,
  sideJsonToPlayerForm,
} from "@/components/badminton/pair-side-picker";
import { CourtAutocomplete } from "@/components/badminton/court-autocomplete";
import {
  BtnPrimary,
  DarkSelect,
  FormActions,
  FormError,
  FormField,
  FormModal,
  HubPageShell,
  inputClass,
  PageHeader,
  EmptyState,
  HubFilterTabs,
  hubCardClass,
} from "@/components/badminton/page-chrome";
import { badmintonBroadcastPath } from "@/lib/badminton-broadcast-urls";
import { badmintonMatchControlPath, badmintonUmpireScorerPath } from "@/lib/badminton-routes";
import { suggestScorerPin } from "@/lib/badminton-scorer-pin";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface MatchRow {
  id: number;
  status: string;
  scheduledAt: string | null;
  detail: Record<string, unknown> | null;
  state: BadmintonMatchState | null;
}

export default function BadmintonMatchesPage() {
  const [, params] = useRoute("/tournament/:id/badminton/matches");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<"all" | "live" | "scheduled" | "completed">("all");

  const { data: matches = [], isLoading } = useQuery<MatchRow[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches`,
        { credentials: "include" },
      );
      return res.json();
    },
    enabled: !!tournamentId,
    refetchInterval: 10000,
  });

  const filtered = matches.filter((m) => {
    if (filter === "all") return true;
    return m.status === filter;
  });

  const counts = {
    all: matches.length,
    live: matches.filter((m) => m.status === "live").length,
    scheduled: matches.filter((m) => m.status === "scheduled").length,
    completed: matches.filter((m) => m.status === "completed").length,
  };

  const deleteMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${matchId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Delete failed" }));
        throw new Error(typeof err.error === "string" ? err.error : "Delete failed");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      qc.invalidateQueries({ queryKey: ["badminton-dashboard", tournamentId] });
    },
  });

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Matches"
        subtitle="Match Control = tournament director · Umpire Scorer = court scoring (PIN)"
        actions={
          <BtnPrimary onClick={() => setShowCreate(true)}>+ Create Match</BtnPrimary>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <HubFilterTabs
          tabs={["all", "live", "scheduled", "completed"] as const}
          active={filter}
          onChange={setFilter}
          counts={counts}
          liveTab="live"
        />

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No matches yet"
            desc="Create your first match to get started"
            action={{ label: "Create Match", onClick: () => setShowCreate(true) }}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                tournamentId={tournamentId}
                onDelete={() => {
                  deleteMutation.mutate(match.id, {
                    onError: (e) => window.alert(e.message),
                  });
                }}
                deleting={deleteMutation.isPending && deleteMutation.variables === match.id}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <MatchFormModal
          tournamentId={tournamentId}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
            setShowCreate(false);
          }}
        />
      )}
    </HubPageShell>
  );
}

function MatchRow({
  match,
  tournamentId,
  onDelete,
  deleting,
}: {
  match: MatchRow;
  tournamentId: number;
  onDelete: () => void;
  deleting?: boolean;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const qc = useQueryClient();
  const state = match.state;
  const detail = match.detail ?? {};
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";
  const matchLabel = state
    ? `${state.leftSide.shortLabel} vs ${state.rightSide.shortLabel}`
    : ((detail.matchLabel as string | undefined) ?? `Match #${match.id}`);

  function handleConfirmDelete() {
    onDelete();
    setConfirmOpen(false);
  }

  return (
    <div className={cn(
      hubCardClass,
      "overflow-hidden transition-colors",
      isLive && "border-red-500/30",
      !isLive && "hover:border-primary/25",
    )}>
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="flex-none">
          {isLive ? (
            <div className="w-10 h-10 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            </div>
          ) : isCompleted ? (
            <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/25 flex items-center justify-center">
              <span className="text-green-400 text-sm font-bold">✓</span>
            </div>
          ) : (
            <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
              <span className="text-muted-foreground text-xs font-mono font-bold">#{match.id}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {state ? (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-foreground font-semibold text-sm">{state.leftSide.shortLabel}</span>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-xl font-display font-bold tabular-nums",
                  isLive ? "text-primary" : "text-muted-foreground",
                )}>
                  {state.leftScore}
                </span>
                <span className="text-muted-foreground text-sm mx-0.5">—</span>
                <span className={cn(
                  "text-xl font-display font-bold tabular-nums",
                  isLive ? "text-red-400" : "text-muted-foreground",
                )}>
                  {state.rightScore}
                </span>
              </div>
              <span className="text-foreground font-semibold text-sm">{state.rightSide.shortLabel}</span>
              <span className="text-muted-foreground text-xs font-mono">G{state.currentGame}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-foreground font-semibold text-sm">
                {(detail.matchLabel as string | undefined) ?? `Match #${match.id}`}
              </span>
              {detail.roundName ? (
                <span className="text-muted-foreground text-xs">{String(detail.roundName)}</span>
              ) : null}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            {detail.courtNumber ? (
              <span className="text-muted-foreground text-xs font-mono">Court {String(detail.courtNumber)}</span>
            ) : null}
            {detail.matchType ? (
              <Badge variant="outline" className="text-[10px] capitalize">
                {(detail.matchType as string).replace("_", " ")}
              </Badge>
            ) : null}
            {detail.scorerPin ? (
              <span className="text-muted-foreground text-xs font-mono" title="Share with court umpire">
                PIN {String(detail.scorerPin)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-none">
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <a
              href={badmintonMatchControlPath(tournamentId, match.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-200 text-xs font-semibold flex items-center transition-all"
              title="Tournament director — pause, retirement, walkover"
            >
              Match Control
            </a>
            <a
              href={badmintonUmpireScorerPath(match.id, tournamentId)}
              target="_blank"
              rel="noopener noreferrer"
              className="h-9 px-3 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center transition-colors"
              title="Court umpire — scoring with PIN"
            >
              Umpire Scorer
            </a>
            <Link
              href={badmintonBroadcastPath(tournamentId, match.id)}
              className="h-9 px-3 rounded-lg bg-primary/10 hover:bg-primary/20 border border-primary/25 text-primary text-xs font-semibold flex items-center transition-colors"
            >
              Broadcast
            </Link>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className="h-9 px-3 rounded-lg bg-secondary hover:bg-accent border border-border text-muted-foreground hover:text-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Edit match details"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          </div>

          <div className="h-8 w-px bg-border/70 shrink-0" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={deleting || isLive}
            title={
              isLive
                ? "End the match before deleting"
                : "Delete match"
            }
            aria-label="Delete match"
            className="h-7 w-7 shrink-0 rounded-md border border-white/20 bg-white/10 text-white/90 hover:bg-white/20 hover:text-white flex items-center justify-center transition-colors disabled:opacity-35 disabled:cursor-not-allowed"
          >
            {deleting ? (
              <span className="text-[10px] font-bold">…</span>
            ) : (
              <X className="w-3.5 h-3.5" strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>

      {editOpen ? (
        <MatchFormModal
          tournamentId={tournamentId}
          match={match}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
            setEditOpen(false);
          }}
        />
      ) : null}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Delete match?</AlertDialogTitle>
            <AlertDialogDescription>
              {isCompleted
                ? `Delete ${matchLabel}? All scores and history will be permanently removed.`
                : `Delete ${matchLabel}? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="gap-1.5">
              <X className="w-3.5 h-3.5" />
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting…" : "Delete match"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function buildMatchFormState(match?: MatchRow) {
  const detail = match?.detail ?? {};
  const left = (detail.leftSideJson as Record<string, unknown> | undefined) ?? {};
  const right = (detail.rightSideJson as Record<string, unknown> | undefined) ?? {};
  return {
    matchType: (detail.matchType as string | undefined) ?? "singles",
    courtNumber: (detail.courtNumber as string | undefined) ?? "",
    courtId: (detail.courtId as number | null | undefined) ?? null,
    matchLabel: (detail.matchLabel as string | undefined) ?? "",
    scorerPin: (detail.scorerPin as string | undefined) ?? suggestScorerPin(),
    umpireName: (detail.umpireName as string | undefined) ?? "",
    leftPlayer1: sideJsonToPlayerForm(left, 0),
    leftPlayer2: sideJsonToPlayerForm(left, 1),
    rightPlayer1: sideJsonToPlayerForm(right, 0),
    rightPlayer2: sideJsonToPlayerForm(right, 1),
  };
}

function MatchFormModal({
  tournamentId,
  match,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  match?: MatchRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!match;
  const rosterLocked = isEdit && match.status !== "scheduled";
  const [form, setForm] = useState(() => buildMatchFormState(match));
  const isPair = isPairMatchKind(form.matchType);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  type StringFormField = Exclude<
    keyof typeof form,
    "leftPlayer1" | "leftPlayer2" | "rightPlayer1" | "rightPlayer2"
  >;

  const f = (field: StringFormField) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  function buildSideJson(player1: SidePlayerForm, player2: SidePlayerForm) {
    const side1 = sidePlayerFormToJson(player1);
    if (!isPair) return side1;
    const side2 = sidePlayerFormToJson(player2);
    return mergeDoublesSideJson(side1, side2);
  }

  async function handleSubmit() {
    if (!rosterLocked) {
      if (!form.leftPlayer1.masterId || !form.rightPlayer1.masterId) {
        setError("Select a player for each side");
        return;
      }
      if (isPair && (!form.leftPlayer2.masterId || !form.rightPlayer2.masterId)) {
        setError("Select 2 players per side for doubles");
        return;
      }
    }
    if (form.scorerPin.trim().length < 4) {
      setError("Scorer PIN must be at least 4 digits");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        courtId: form.courtId ?? undefined,
        courtNumber: form.courtNumber || undefined,
        matchLabel: form.matchLabel.trim() || undefined,
        scorerPin: form.scorerPin.trim(),
        umpireName: form.umpireName || undefined,
        ...(rosterLocked
          ? {}
          : {
              matchType: form.matchType,
              leftSideJson: buildSideJson(form.leftPlayer1, form.leftPlayer2),
              rightSideJson: buildSideJson(form.rightPlayer1, form.rightPlayer2),
            }),
      };

      const res = await fetch(
        isEdit
          ? `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches/${match.id}`
          : `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: isEdit ? "Update failed" : "Create failed" }));
        throw new Error(typeof err.error === "string" ? err.error : isEdit ? "Update failed" : "Create failed");
      }
      const saved = (await res.json()) as { detail?: { scorerPin?: string } };
      const pin = saved.detail?.scorerPin ?? form.scorerPin;
      toast({
        title: isEdit ? "Match updated" : "Match created",
        description: isEdit ? undefined : `Scorer PIN for this match: ${pin}`,
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={isEdit ? "Edit Match" : "Create Match"}
      subtitle={
        isEdit
          ? rosterLocked
            ? "Update match name, court, umpire, or scorer PIN"
            : "Update match setup before it goes live"
          : "Schedule a new badminton match"
      }
      onClose={onClose}
      size="lg"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Match Type">
          <DarkSelect
            value={form.matchType}
            disabled={rosterLocked}
            onValueChange={(matchType) =>
              setForm((prev) => ({
                ...prev,
                matchType,
                leftPlayer2: emptySidePlayer(),
                rightPlayer2: emptySidePlayer(),
              }))
            }
            options={[
              { value: "singles", label: "Singles" },
              { value: "doubles", label: "Doubles" },
              { value: "mixed_doubles", label: "Mixed Doubles" },
            ]}
          />
        </FormField>
        <FormField label="Match Name">
          <input {...f("matchLabel")} placeholder="League Match 1" className={inputClass} />
        </FormField>
        <FormField label="Court">
          <CourtAutocomplete
            tournamentId={tournamentId}
            value={form.courtNumber}
            courtId={form.courtId}
            onChange={({ courtNumber, courtId }) =>
              setForm((prev) => ({ ...prev, courtNumber, courtId }))
            }
            placeholder="Search courts…"
          />
        </FormField>
      </div>

      {!rosterLocked ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <PairSidePicker
            tournamentId={tournamentId}
            sideLabel="Left"
            isPair={isPair}
            player1={form.leftPlayer1}
            player2={form.leftPlayer2}
            onPlayer1Change={(leftPlayer1) => setForm((p) => ({ ...p, leftPlayer1 }))}
            onPlayer2Change={(leftPlayer2) => setForm((p) => ({ ...p, leftPlayer2 }))}
          />
          <PairSidePicker
            tournamentId={tournamentId}
            sideLabel="Right"
            isPair={isPair}
            player1={form.rightPlayer1}
            player2={form.rightPlayer2}
            onPlayer1Change={(rightPlayer1) => setForm((p) => ({ ...p, rightPlayer1 }))}
            onPlayer2Change={(rightPlayer2) => setForm((p) => ({ ...p, rightPlayer2 }))}
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/30 px-3 py-2">
          Player lineup is locked while the match is live or completed. You can still update match name, court, umpire, and scorer PIN.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Umpire's Name">
          <input {...f("umpireName")} placeholder="Optional" className={inputClass} />
        </FormField>
        <FormField label="Scorer PIN">
          <div className="flex gap-2">
            <input
              {...f("scorerPin")}
              placeholder="4-digit PIN"
              type="tel"
              inputMode="numeric"
              maxLength={8}
              className={inputClass}
            />
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, scorerPin: suggestScorerPin() }))}
              className="h-11 px-3 rounded-lg border border-border bg-secondary text-secondary-foreground text-xs font-semibold shrink-0 hover-elevate"
            >
              New PIN
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            Unique per match — share with the court umpire only.
          </p>
        </FormField>
      </div>

      <FormError message={error} />

      <FormActions
        onCancel={onClose}
        onSubmit={handleSubmit}
        submitLabel={isEdit ? "Save Changes" : "Create Match"}
        saving={saving}
      />
    </FormModal>
  );
}
