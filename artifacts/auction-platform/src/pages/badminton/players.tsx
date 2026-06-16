/**
 * Badminton Players Management
 * Route: /tournament/:id/badminton/players
 */

import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  BtnPrimary,
  BtnSecondary,
  DarkSelect,
  EmptyState,
  FormActions,
  FormError,
  FormField,
  FormModal,
  HubPageShell,
  inputClass,
  PageHeader,
  SearchInput,
  CheckboxRow,
} from "@/components/badminton/page-chrome";

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
  const [showImport, setShowImport] = useState(false);
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
    <HubPageShell>
      <PageHeader
        title="Players"
        subtitle={`${players.length} registered`}
        backHref={`/tournament/${tournamentId}/badminton`}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Link href={`/tournament/${tournamentId}/badminton/branding`}>
              <BtnSecondary>Branding & Import</BtnSecondary>
            </Link>
            <BtnSecondary onClick={() => setShowImport(true)}>Import From Auction</BtnSecondary>
            <BtnPrimary onClick={() => { setEditPlayer(null); setShowForm(true); }}>
              + Add Player
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <AutoSyncSettings tournamentId={tournamentId} />

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search players by name, academy, country…"
          className="mb-6"
        />

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

      {showImport && (
        <ImportMasterPlayersModal
          tournamentId={tournamentId}
          onClose={() => setShowImport(false)}
          onImported={() => {
            qc.invalidateQueries({ queryKey: ["badminton-players", tournamentId] });
            qc.invalidateQueries({ queryKey: ["master-players", tournamentId] });
            setShowImport(false);
          }}
        />
      )}
    </HubPageShell>
  );
}

interface MasterPlayerImport {
  id: string;
  displayName: string;
  photoUrl: string | null;
  franchiseName?: string | null;
  franchiseLogoUrl?: string | null;
  teamName: string | null;
  teamLogoUrl: string | null;
  sponsorName: string | null;
  sponsorLogoUrl: string | null;
  alreadyImported: boolean;
}

function AutoSyncSettings({ tournamentId }: { tournamentId: number }) {
  const qc = useQueryClient();
  const { data: settings } = useQuery<{ autoSyncAuctionPlayers?: boolean; linkedAuctionTournamentId?: number }>({
    queryKey: ["badminton-master-settings", tournamentId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/settings`,
        { credentials: "include" },
      );
      return res.json();
    },
    enabled: !!tournamentId,
  });

  const [auctionId, setAuctionId] = useState("");
  const [saving, setSaving] = useState(false);

  async function save(enabled: boolean) {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/tournaments/${tournamentId}/badminton/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          autoSyncAuctionPlayers: enabled,
          linkedAuctionTournamentId: auctionId ? parseInt(auctionId, 10) : null,
        }),
      });
      qc.invalidateQueries({ queryKey: ["badminton-master-settings", tournamentId] });
      qc.invalidateQueries({ queryKey: ["master-players", tournamentId] });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 p-4 rounded-2xl bg-[#0d1529] border border-white/8">
      <div className="flex flex-wrap items-center gap-4">
        <CheckboxRow
          checked={settings?.autoSyncAuctionPlayers ?? false}
          onChange={(checked) => save(checked)}
          label="Auto Sync Auction Players"
          disabled={saving}
        />
        <input
          type="number"
          placeholder="Linked auction tournament ID"
          value={auctionId || (settings?.linkedAuctionTournamentId?.toString() ?? "")}
          onChange={(e) => setAuctionId(e.target.value)}
          className={cn(inputClass, "h-10 w-52")}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => save(settings?.autoSyncAuctionPlayers ?? false)}
          className="text-xs text-[#4fc3f7] hover:underline disabled:opacity-50"
        >
          Save linked tournament
        </button>
      </div>
      <p className="text-white/30 text-xs mt-2">
        When enabled, master players from the linked auction tournament appear automatically — no manual import.
      </p>
    </div>
  );
}

function ImportMasterPlayersModal({
  tournamentId,
  onClose,
  onImported,
}: {
  tournamentId: number;
  onClose: () => void;
  onImported: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");

  const { data: masterPlayers = [], isLoading } = useQuery<MasterPlayerImport[]>({
    queryKey: ["master-players", tournamentId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/master-players`,
        { credentials: "include" },
      );
      return res.json();
    },
    enabled: !!tournamentId,
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/import-master-players`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ masterPlayerIds: [...selected] }),
        },
      );
      if (!res.ok) throw new Error("Import failed");
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const available = masterPlayers.filter((p) => !p.alreadyImported);

  return (
    <FormModal
      title="Import From Auction"
      subtitle="Select master players to add to this tournament"
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex items-center gap-3">
          {error && <p className="text-red-300 text-sm flex-1">{error}</p>}
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={handleImport} disabled={importing || selected.size === 0}>
            {importing ? "Importing…" : `Import Selected (${selected.size})`}
          </BtnPrimary>
        </div>
      }
    >
      <div className="space-y-2 -mt-2">
        {isLoading ? (
          <p className="text-white/40 text-center py-8">Loading players…</p>
        ) : available.length === 0 ? (
          <p className="text-white/40 text-center py-8">No players available to import</p>
        ) : (
          available.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-4 p-3 rounded-xl border border-white/10 bg-[#121c34]/50 hover:border-[#4fc3f7]/25 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggle(p.id)}
                className="w-4 h-4 accent-[#0070f3] shrink-0"
              />
              {p.photoUrl ? (
                <img src={p.photoUrl} alt="" className="w-12 h-12 rounded-xl object-cover ring-1 ring-white/10" loading="lazy" />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-[#1a2847] flex items-center justify-center font-bold text-white/40 ring-1 ring-white/10">
                  {p.displayName.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold">{p.displayName}</p>
                <p className="text-white/40 text-xs">
                  {(() => {
                    const franchise = p.franchiseName ?? p.teamName;
                    if (franchise) return franchise;
                    return "—";
                  })()}
                </p>
              </div>
              {(p.franchiseLogoUrl ?? p.teamLogoUrl) && (
                <img
                  src={p.franchiseLogoUrl ?? p.teamLogoUrl ?? ""}
                  alt=""
                  className="w-8 h-8 object-contain opacity-80"
                  loading="lazy"
                />
              )}
            </label>
          ))
        )}
      </div>
    </FormModal>
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
    <FormModal
      title={player ? "Edit Player" : "Add Player"}
      subtitle="Player profile for draws and scoring"
      onClose={onClose}
      size="lg"
    >
      <div className="grid grid-cols-2 gap-4">
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

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Country Code">
          <input {...f("countryCode")} placeholder="DEN" maxLength={3} className={inputClass} />
        </FormField>
        <FormField label="Country Name">
          <input {...f("countryName")} placeholder="Denmark" className={inputClass} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="State">
          <input {...f("stateName")} placeholder="State/Province" className={inputClass} />
        </FormField>
        <FormField label="Academy / Club">
          <input {...f("academyName")} placeholder="Club name" className={inputClass} />
        </FormField>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <FormField label="Age Group">
          <input {...f("ageGroup")} placeholder="U19, Senior…" className={inputClass} />
        </FormField>
        <FormField label="Gender">
          <DarkSelect
            value={form.gender || "none"}
            onValueChange={(gender) => setForm((prev) => ({ ...prev, gender: gender === "none" ? "" : gender }))}
            options={[
              { value: "none", label: "Select" },
              { value: "M", label: "Male" },
              { value: "F", label: "Female" },
            ]}
          />
        </FormField>
        <FormField label="Handedness">
          <DarkSelect
            value={form.handedness}
            onValueChange={(handedness) => setForm((prev) => ({ ...prev, handedness }))}
            options={[
              { value: "R", label: "Right" },
              { value: "L", label: "Left" },
            ]}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="World Ranking">
          <input {...f("worldRanking")} type="number" placeholder="#" className={inputClass} />
        </FormField>
        <FormField label="National Ranking">
          <input {...f("nationalRanking")} type="number" placeholder="#" className={inputClass} />
        </FormField>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Mobile">
          <input {...f("mobile")} placeholder="+91 98765..." className={inputClass} />
        </FormField>
        <FormField label="Email">
          <input {...f("email")} type="email" placeholder="email@example.com" className={inputClass} />
        </FormField>
      </div>

      <FormError message={error} />

      <FormActions
        onCancel={onClose}
        onSubmit={handleSave}
        submitLabel={player ? "Save Changes" : "Add Player"}
        saving={saving}
      />
    </FormModal>
  );
}
