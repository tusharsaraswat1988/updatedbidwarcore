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

  return (
    <div className="min-h-screen bg-[#060c1a] text-white">
      <div className="bg-gradient-to-b from-[#0d1529] to-transparent border-b border-white/5 px-6 py-5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-white">Matches</h1>
            <p className="text-white/40 text-sm">{matches.length} total</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#0070f3] hover:bg-[#0060d3] rounded-xl px-4 py-2.5 font-semibold text-sm text-white transition-colors"
          >
            + Create Match
          </button>
        </div>
      </div>

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
    </div>
  );
}

function MatchRow({
  match,
  tournamentId,
}: {
  match: MatchRow;
  tournamentId: number;
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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1529] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0d1529] border-b border-white/8 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-black text-lg">Create Match</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl">×</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Match Type</label>
              <select
                value={form.matchType}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    matchType: e.target.value,
                    leftPlayer2: emptySidePlayer(),
                    rightPlayer2: emptySidePlayer(),
                  }))
                }
                className={inputClass}
              >
                <option value="singles">Singles</option>
                <option value="doubles">Doubles</option>
                <option value="mixed_doubles">Mixed</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Match #</label>
              <input {...f("matchNumber")} placeholder="M01" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Court</label>
              <input {...f("courtNumber")} placeholder="Court 1" className={inputClass} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Referee</label>
              <input {...f("refereeName")} placeholder="Optional" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Scorer PIN</label>
              <input {...f("scorerPin")} placeholder="Optional" type="tel" className={inputClass} />
            </div>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 h-12 rounded-xl bg-white/8 border border-white/10 text-white/60 font-semibold hover:bg-white/12">
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-[#0070f3] hover:bg-[#0060d3] disabled:opacity-60 text-white font-bold"
            >
              {saving ? "Creating…" : "Create Match"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass = "w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40";
const labelClass = "block text-white/40 text-xs font-semibold mb-1.5 uppercase tracking-wide";
