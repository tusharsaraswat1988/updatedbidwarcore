/**
 * Badminton Matches Management
 * Route: /tournament/:id/badminton/matches
 */

import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { isPairMatchKind, mergeDoublesSideJson } from "@workspace/badminton-core";
import {
  PairSidePicker,
  emptySidePlayer,
  sidePlayerFormToJson,
  type SidePlayerForm,
} from "@/components/badminton/pair-side-picker";
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
} from "@/components/badminton/page-chrome";

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
    <HubPageShell>
      <PageHeader
        title="Matches"
        subtitle={`${matches.length} total`}
        backHref={`/tournament/${tournamentId}/badminton`}
        actions={
          <BtnPrimary onClick={() => setShowCreate(true)}>+ Create Match</BtnPrimary>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Filter tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
          {(["all", "live", "scheduled", "completed"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all",
                filter === tab
                  ? "bg-[#0070f3] text-white"
                  : "bg-white/5 border border-white/8 text-white/50 hover:bg-white/8",
              )}
            >
              {tab === "live" && <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
              <span className="capitalize">{tab}</span>
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded-full",
                filter === tab ? "bg-white/20" : "bg-white/10",
              )}>
                {counts[tab]}
              </span>
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/4 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-white font-bold text-lg">No matches yet</h3>
            <p className="text-white/40 text-sm mt-1">Create your first match to get started</p>
            <button
              onClick={() => setShowCreate(true)}
              className="mt-6 px-6 py-3 rounded-xl bg-[#0070f3] text-white font-semibold text-sm"
            >
              Create Match
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((match) => (
              <MatchRow
                key={match.id}
                match={match}
                tournamentId={tournamentId}
                onDelete={() => {
                  const state = match.state;
                  const detail = match.detail ?? {};
                  const label = state
                    ? `${state.leftSide.shortLabel} vs ${state.rightSide.shortLabel}`
                    : ((detail.matchLabel as string | undefined) ?? `Match #${match.id}`);

                  if (match.status === "live") {
                    window.alert(
                      "Live matches cannot be deleted. Complete, retire, or walk over the match first.",
                    );
                    return;
                  }

                  const message =
                    match.status === "completed"
                      ? `Delete ${label}? All scores and history will be permanently removed.`
                      : `Delete ${label}? This cannot be undone.`;

                  if (window.confirm(message)) {
                    deleteMutation.mutate(match.id, {
                      onError: (e) => window.alert(e.message),
                    });
                  }
                }}
                deleting={deleteMutation.isPending && deleteMutation.variables === match.id}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateMatchModal
          tournamentId={tournamentId}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
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
  const state = match.state;
  const detail = match.detail ?? {};
  const isLive = match.status === "live";
  const isCompleted = match.status === "completed";

  return (
    <div className={cn(
      "bg-[#0d1529] rounded-2xl border overflow-hidden transition-colors",
      isLive ? "border-red-500/20" : "border-white/8 hover:border-white/15",
    )}>
      <div className="flex items-center gap-4 px-4 py-3">
        {/* Status indicator */}
        <div className="flex-none">
          {isLive ? (
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            </div>
          ) : isCompleted ? (
            <div className="w-10 h-10 rounded-xl bg-green-500/15 border border-green-500/25 flex items-center justify-center text-lg">✓</div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <span className="text-white/30 text-xs font-bold">#{match.id}</span>
            </div>
          )}
        </div>

        {/* Match info */}
        <div className="flex-1 min-w-0">
          {state ? (
            <div className="flex items-center gap-3">
              <span className="text-white font-bold text-sm">{state.leftSide.shortLabel}</span>
              <div className="flex items-center gap-1">
                <span className={cn(
                  "text-xl font-black tabular-nums",
                  isLive ? "text-[#00e5ff]" : "text-white/60",
                )}>
                  {state.leftScore}
                </span>
                <span className="text-white/20 text-sm mx-0.5">—</span>
                <span className={cn(
                  "text-xl font-black tabular-nums",
                  isLive ? "text-[#ff6b6b]" : "text-white/60",
                )}>
                  {state.rightScore}
                </span>
              </div>
              <span className="text-white font-bold text-sm">{state.rightSide.shortLabel}</span>
              <span className="text-white/30 text-xs">G{state.currentGame}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-white font-bold text-sm">
                {(detail.matchLabel as string | undefined) ?? `Match #${match.id}`}
              </span>
              {detail.roundName ? (
                <span className="text-white/30 text-xs">{String(detail.roundName)}</span>
              ) : null}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            {detail.courtNumber ? (
              <span className="text-white/30 text-xs">Court {String(detail.courtNumber)}</span>
            ) : null}
            {detail.matchType ? (
              <span className="text-white/20 text-xs capitalize">
                {(detail.matchType as string).replace("_", " ")}
              </span>
            ) : null}
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 flex-none">
          <Link
            href={`/tournament/${tournamentId}/badminton/matches/${match.id}/control`}
            className="h-9 px-3 rounded-xl bg-[#0070f3]/15 hover:bg-[#0070f3]/25 border border-[#0070f3]/30 text-[#4fc3f7] text-xs font-semibold flex items-center transition-all"
          >
            Control
          </Link>
          <Link
            href={`/badminton/${match.id}/score?tid=${tournamentId}`}
            className="h-9 px-3 rounded-xl bg-white/8 hover:bg-[#0070f3]/20 border border-white/10 hover:border-[#0070f3]/30 text-white/60 hover:text-[#4fc3f7] text-xs font-semibold flex items-center transition-all"
          >
            Score
          </Link>
          <Link
            href={`/badminton/${match.id}/display?tid=${tournamentId}`}
            className="h-9 px-3 rounded-xl bg-white/8 hover:bg-white/12 border border-white/10 text-white/50 text-xs font-medium flex items-center transition-colors"
          >
            Display
          </Link>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting || match.status === "live"}
            title={
              match.status === "live"
                ? "End the match before deleting"
                : "Delete match"
            }
            className="h-9 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300/80 hover:text-red-300 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateMatchModal({
  tournamentId,
  onClose,
  onCreated,
}: {
  tournamentId: number;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    matchType: "singles",
    courtNumber: "",
    matchNumber: "",
    scorerPin: "",
    refereeName: "",
    leftPlayer1: emptySidePlayer(),
    leftPlayer2: emptySidePlayer(),
    rightPlayer1: emptySidePlayer(),
    rightPlayer2: emptySidePlayer(),
  });
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

  async function handleCreate() {
    if (!form.leftPlayer1.masterId || !form.rightPlayer1.masterId) {
      setError("Select a player for each side");
      return;
    }
    if (isPair && (!form.leftPlayer2.masterId || !form.rightPlayer2.masterId)) {
      setError("Select 2 players per side for doubles");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/matches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            matchType: form.matchType,
            courtNumber: form.courtNumber || undefined,
            matchNumber: form.matchNumber || undefined,
            scorerPin: form.scorerPin || undefined,
            refereeName: form.refereeName || undefined,
            leftSideJson: buildSideJson(form.leftPlayer1, form.leftPlayer2),
            rightSideJson: buildSideJson(form.rightPlayer1, form.rightPlayer2),
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to create match");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal title="Create Match" subtitle="Schedule a new badminton match" onClose={onClose} size="lg">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="Match Type">
          <DarkSelect
            value={form.matchType}
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
        <FormField label="Match #">
          <input {...f("matchNumber")} placeholder="M01" className={inputClass} />
        </FormField>
        <FormField label="Court">
          <input {...f("courtNumber")} placeholder="Court 1" className={inputClass} />
        </FormField>
      </div>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Referee">
          <input {...f("refereeName")} placeholder="Optional" className={inputClass} />
        </FormField>
        <FormField label="Scorer PIN">
          <input {...f("scorerPin")} placeholder="Optional" type="tel" className={inputClass} />
        </FormField>
      </div>

      <FormError message={error} />

      <FormActions
        onCancel={onClose}
        onSubmit={handleCreate}
        submitLabel="Create Match"
        saving={saving}
      />
    </FormModal>
  );
}
