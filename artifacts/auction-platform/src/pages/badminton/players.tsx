/**
 * Badminton Players Management
 * Route: /tournament/:id/badminton/players
 */

import { useState } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface BadmintonPlayer {
  id: number;
  tournamentId: number;
  firstName: string;
  lastName: string;
  displayName?: string;
  shortName?: string;
  countryCode?: string;
  countryName?: string;
  stateName?: string;
  academyName?: string;
  dateOfBirth?: string;
  ageGroup?: string;
  gender?: string;
  handedness?: string;
  mobile?: string;
  email?: string;
  photoUrl?: string;
  worldRanking?: number;
  nationalRanking?: number;
  status: string;
}

export default function BadmintonPlayersPage() {
  const [, params] = useRoute("/tournament/:id/badminton/players");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editPlayer, setEditPlayer] = useState<BadmintonPlayer | null>(null);

  const { data: players = [], isLoading } = useQuery<BadmintonPlayer[]>({
    queryKey: ["badminton-players", tournamentId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/players`,
        { credentials: "include" },
      );
      return res.json();
    },
    enabled: !!tournamentId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (playerId: number) => {
      await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/players/${playerId}`,
        { method: "DELETE", credentials: "include" },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badminton-players", tournamentId] }),
  });

  const filtered = players.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      (p.displayName?.toLowerCase().includes(q)) ||
      (p.academyName?.toLowerCase().includes(q)) ||
      (p.countryName?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#060c1a] text-white">
      <PageHeader
        title="Players"
        subtitle={`${players.length} registered`}
        actions={
          <button
            onClick={() => { setEditPlayer(null); setShowForm(true); }}
            className="flex items-center gap-2 bg-[#0070f3] hover:bg-[#0060d3] rounded-xl px-4 py-2.5 font-semibold text-sm text-white transition-colors"
          >
            <span>+</span> Add Player
          </button>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search players by name, academy, country…"
            className="w-full h-12 pl-11 pr-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:border-[#4fc3f7]/40"
          />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/4 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="👤"
            title={search ? "No players match your search" : "No players yet"}
            desc={search ? "Try a different search" : "Add your first player to get started"}
            action={!search ? { label: "Add Player", onClick: () => setShowForm(true) } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onEdit={() => { setEditPlayer(player); setShowForm(true); }}
                onDelete={() => {
                  if (window.confirm(`Delete ${player.firstName} ${player.lastName}?`)) {
                    deleteMutation.mutate(player.id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <PlayerFormModal
          tournamentId={tournamentId}
          player={editPlayer}
          onClose={() => { setShowForm(false); setEditPlayer(null); }}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: ["badminton-players", tournamentId] });
            setShowForm(false);
            setEditPlayer(null);
          }}
        />
      )}
    </div>
  );
}

function PlayerCard({
  player,
  onEdit,
  onDelete,
}: {
  player: BadmintonPlayer;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const initials = `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`;

  return (
    <div className="bg-[#0d1529] rounded-2xl border border-white/8 overflow-hidden hover:border-white/15 transition-colors group">
      <div className="flex items-center gap-4 p-4">
        {/* Photo / Avatar */}
        {player.photoUrl ? (
          <img
            src={player.photoUrl}
            alt={player.firstName}
            className="w-14 h-14 rounded-xl object-cover flex-none"
          />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#0070f3]/30 to-[#7c3aed]/30 border border-white/10 flex items-center justify-center flex-none">
            <span className="text-xl font-black text-white/50">{initials}</span>
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-bold text-base leading-tight">
            {player.displayName ?? `${player.firstName} ${player.lastName}`}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {player.countryCode && (
              <span className="text-[#4fc3f7] text-xs font-semibold">{player.countryCode}</span>
            )}
            {player.ageGroup && (
              <span className="text-white/30 text-xs">{player.ageGroup}</span>
            )}
            {player.academyName && (
              <span className="text-white/30 text-xs truncate">{player.academyName}</span>
            )}
          </div>
          {(player.worldRanking || player.nationalRanking) && (
            <div className="flex items-center gap-2 mt-1">
              {player.worldRanking && (
                <span className="text-[10px] text-white/30">WR #{player.worldRanking}</span>
              )}
              {player.nationalRanking && (
                <span className="text-[10px] text-white/30">NR #{player.nationalRanking}</span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            className="w-8 h-8 rounded-lg bg-white/8 hover:bg-white/15 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
            </svg>
          </button>
          <button
            onClick={onDelete}
            className="w-8 h-8 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center justify-center text-red-400/60 hover:text-red-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function PlayerFormModal({
  tournamentId,
  player,
  onClose,
  onSaved,
}: {
  tournamentId: number;
  player: BadmintonPlayer | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    firstName: player?.firstName ?? "",
    lastName: player?.lastName ?? "",
    displayName: player?.displayName ?? "",
    countryCode: player?.countryCode ?? "",
    countryName: player?.countryName ?? "",
    stateName: player?.stateName ?? "",
    academyName: player?.academyName ?? "",
    ageGroup: player?.ageGroup ?? "",
    gender: player?.gender ?? "",
    handedness: player?.handedness ?? "R",
    mobile: player?.mobile ?? "",
    email: player?.email ?? "",
    worldRanking: player?.worldRanking?.toString() ?? "",
    nationalRanking: player?.nationalRanking?.toString() ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!form.firstName || !form.lastName) {
      setError("First name and last name are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        ...form,
        worldRanking: form.worldRanking ? parseInt(form.worldRanking) : undefined,
        nationalRanking: form.nationalRanking ? parseInt(form.nationalRanking) : undefined,
      };
      const url = player
        ? `${API_BASE}/api/tournaments/${tournamentId}/badminton/players/${player.id}`
        : `${API_BASE}/api/tournaments/${tournamentId}/badminton/players`;
      const res = await fetch(url, {
        method: player ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save player");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving player");
    } finally {
      setSaving(false);
    }
  }

  const f = (field: keyof typeof form) => ({
    value: form[field],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value })),
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1529] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#0d1529] border-b border-white/8 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-black text-lg">
            {player ? "Edit Player" : "Add Player"}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name *">
              <input {...f("firstName")} placeholder="e.g. Viktor" className={inputClass} />
            </FormField>
            <FormField label="Last Name *">
              <input {...f("lastName")} placeholder="e.g. Axelsen" className={inputClass} />
            </FormField>
          </div>

          <FormField label="Display Name">
            <input {...f("displayName")} placeholder="e.g. V. AXELSEN" className={inputClass} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Country Code">
              <input {...f("countryCode")} placeholder="DEN" maxLength={3} className={inputClass} />
            </FormField>
            <FormField label="Country Name">
              <input {...f("countryName")} placeholder="Denmark" className={inputClass} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="State">
              <input {...f("stateName")} placeholder="State/Province" className={inputClass} />
            </FormField>
            <FormField label="Academy / Club">
              <input {...f("academyName")} placeholder="Club name" className={inputClass} />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Age Group">
              <input {...f("ageGroup")} placeholder="U19, Senior…" className={inputClass} />
            </FormField>
            <FormField label="Gender">
              <select {...f("gender")} className={inputClass}>
                <option value="">Select</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </FormField>
            <FormField label="Handedness">
              <select {...f("handedness")} className={inputClass}>
                <option value="R">Right</option>
                <option value="L">Left</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="World Ranking">
              <input {...f("worldRanking")} type="number" placeholder="#" className={inputClass} />
            </FormField>
            <FormField label="National Ranking">
              <input {...f("nationalRanking")} type="number" placeholder="#" className={inputClass} />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mobile">
              <input {...f("mobile")} placeholder="+91 98765..." className={inputClass} />
            </FormField>
            <FormField label="Email">
              <input {...f("email")} type="email" placeholder="email@example.com" className={inputClass} />
            </FormField>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 h-12 rounded-xl bg-white/8 border border-white/10 text-white/60 font-semibold hover:bg-white/12 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 h-12 rounded-xl bg-[#0070f3] hover:bg-[#0060d3] disabled:opacity-60 text-white font-bold transition-colors"
            >
              {saving ? "Saving…" : player ? "Save Changes" : "Add Player"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="bg-gradient-to-b from-[#0d1529] to-transparent border-b border-white/5 px-6 py-5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white">{title}</h1>
          {subtitle && <p className="text-white/40 text-sm mt-0.5">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-white/40 text-xs font-semibold mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: string;
  title: string;
  desc: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">{icon}</div>
      <h3 className="text-white font-bold text-lg">{title}</h3>
      <p className="text-white/40 text-sm mt-1">{desc}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-6 px-6 py-3 rounded-xl bg-[#0070f3] hover:bg-[#0060d3] text-white font-semibold text-sm transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

const inputClass =
  "w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-[#4fc3f7]/40";
