/**
 * Badminton Players Management
 * Route: /tournament/:id/badminton/players
 */

import { useState, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { Users, Pencil, Trash2, Upload, User, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ImageEditorDialog } from "@/components/image-editor-dialog";
import {
  PLAYER_PHOTO_ASPECT,
  PLAYER_PHOTO_EXPORT_MAX_MB,
  PLAYER_PHOTO_WIDTH,
} from "@/lib/player-photo";
import { badmintonFetch } from "@/lib/badminton-api";
import { toastError, toastSuccess } from "@/lib/badminton-ux";
import { ConfirmActionDialog } from "@/components/badminton/confirm-action-dialog";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";
import { identityFromOrganizerPlayer } from "@/lib/team-player-identity";
import { apiFetch } from "@workspace/api-base";
import { parseIndianMobile, sanitizeMobileInput } from "@workspace/api-base/mobile";
import { parseOptionalEmail } from "@workspace/api-base/email";
import { OptionalEmailField } from "@/components/optional-email-field";
import { CityAutocomplete } from "@/components/city-autocomplete";
import { JerseySizeSelect } from "@/components/jersey-size-select";
import { PlayerGenderSelect, formatPlayerGender } from "@/components/player-gender-select";
import type { JerseySize } from "@workspace/api-base/jersey-size";
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
  AsyncLoadingPanel,
  hubCardClass,
} from "@/components/badminton/page-chrome";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

interface BadmintonPlayerMeta {
  city?: string | null;
  age?: number | null;
  role?: string | null;
  jerseyNumber?: string | null;
  jerseySize?: string | null;
  achievements?: string | null;
}

interface BadmintonPlayer {
  id: number;
  tournamentId: number;
  firstName: string;
  lastName: string;
  displayName?: string;
  shortName?: string;
  gender?: string;
  handedness?: string;
  mobile?: string;
  email?: string;
  photoUrl?: string;
  academyName?: string;
  status: string;
  metaJson?: BadmintonPlayerMeta | null;
  franchiseName?: string | null;
  franchiseLogoUrl?: string | null;
}

interface SportRole {
  id: number;
  roleName: string;
}

function playerFullName(player: BadmintonPlayer): string {
  return `${player.firstName} ${player.lastName}`.trim();
}

function playerMeta(player: BadmintonPlayer): BadmintonPlayerMeta {
  return (player.metaJson ?? {}) as BadmintonPlayerMeta;
}

export default function BadmintonPlayersPage() {
  const [, params] = useRoute("/tournament/:id/badminton/players");
  const tournamentId = parseInt(params?.id ?? "0");
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<"all" | "M" | "F" | "unspecified">("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editPlayer, setEditPlayer] = useState<BadmintonPlayer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BadmintonPlayer | null>(null);
  const [deleteError, setDeleteError] = useState("");

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
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/players/${playerId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Could not delete player");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["badminton-players", tournamentId] });
      toastSuccess("Player deleted");
      setDeleteTarget(null);
      setDeleteError("");
    },
    onError: (e) => {
      setDeleteError(e instanceof Error ? e.message : "Could not delete player");
      toastError(e, "Could not delete player");
    },
  });

  const teamOptions = useMemo(() => {
    const names = new Set<string>();
    for (const player of players) {
      const team = player.franchiseName?.trim();
      if (team) names.add(team);
    }
    return [...names].sort((a, b) => a.localeCompare(b)).map((name) => ({
      value: name,
      label: name,
    }));
  }, [players]);

  const filtersActive =
    genderFilter !== "all" || teamFilter !== "all" || search.trim().length > 0;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return players.filter((p) => {
      const meta = playerMeta(p);
      const matchesSearch =
        !q ||
        p.firstName.toLowerCase().includes(q) ||
        p.lastName.toLowerCase().includes(q) ||
        meta.city?.toLowerCase().includes(q) ||
        meta.role?.toLowerCase().includes(q) ||
        p.franchiseName?.toLowerCase().includes(q) ||
        p.mobile?.includes(q);

      const matchesGender =
        genderFilter === "all" ||
        (genderFilter === "M" && p.gender === "M") ||
        (genderFilter === "F" && p.gender === "F") ||
        (genderFilter === "unspecified" && p.gender !== "M" && p.gender !== "F");

      const matchesTeam =
        teamFilter === "all" ||
        (teamFilter === "unassigned" && !p.franchiseName?.trim()) ||
        (teamFilter !== "unassigned" && p.franchiseName === teamFilter);

      return matchesSearch && matchesGender && matchesTeam;
    });
  }, [players, search, genderFilter, teamFilter]);

  return (
    <HubPageShell tournamentId={tournamentId}>
      <PageHeader
        title="Players"
        subtitle="Register players for category entries and fixtures"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <BtnSecondary onClick={() => setShowImport(true)}>Import From Auction</BtnSecondary>
            <BtnPrimary onClick={() => { setEditPlayer(null); setShowForm(true); }}>
              + Add Player
            </BtnPrimary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col gap-3 mb-6 lg:flex-row lg:items-end">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search players by name, team, city, role, mobile…"
            className="flex-1 min-w-0"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:w-[22rem] shrink-0">
            <FormField label="Gender">
              <DarkSelect
                value={genderFilter}
                onValueChange={(value) =>
                  setGenderFilter(value as "all" | "M" | "F" | "unspecified")
                }
                options={[
                  { value: "all", label: "All genders" },
                  { value: "M", label: "Male" },
                  { value: "F", label: "Female" },
                  { value: "unspecified", label: "Not specified" },
                ]}
              />
            </FormField>
            <FormField label="Team">
              <DarkSelect
                value={teamFilter}
                onValueChange={setTeamFilter}
                placeholder="All teams"
                options={[
                  { value: "all", label: "All teams" },
                  { value: "unassigned", label: "No team assigned" },
                  ...teamOptions,
                ]}
              />
            </FormField>
          </div>
        </div>

        {filtersActive && filtered.length !== players.length ? (
          <p className="text-sm text-muted-foreground mb-4">
            Showing {filtered.length} of {players.length} players
          </p>
        ) : null}

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtersActive ? "No players match your filters" : "No players yet"}
            desc={
              filtersActive
                ? "Try clearing search or changing gender/team filters"
                : "Import from auction or add a walk-in player manually"
            }
            action={!filtersActive ? { label: "Add Player", onClick: () => setShowForm(true) } : undefined}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((player) => (
              <PlayerCard
                key={player.id}
                player={player}
                onEdit={() => { setEditPlayer(player); setShowForm(true); }}
                onDelete={() => {
                  setDeleteError("");
                  setDeleteTarget(player);
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
            qc.invalidateQueries({ queryKey: ["badminton-match-roster", tournamentId] });
            toastSuccess(editPlayer ? "Player updated" : "Player added");
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
            qc.invalidateQueries({ queryKey: ["badminton-match-roster", tournamentId] });
            qc.invalidateQueries({ queryKey: ["master-players", tournamentId] });
            toastSuccess("Players imported");
            setShowImport(false);
          }}
        />
      )}

      <ConfirmActionDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete player?"
        description={
          <div className="space-y-2">
            <p>
              Delete{" "}
              <span className="text-foreground font-medium">
                {deleteTarget ? playerFullName(deleteTarget) : "this player"}
              </span>
              ?
            </p>
            <p>They will be removed from the roster. Category entries that use this player may need updating.</p>
          </div>
        }
        confirmLabel="Delete player"
        busy={deleteMutation.isPending}
        error={deleteError}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
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

const BADMINTON_TRIAL_IMPORT_LIMIT = 4;

interface ImportSource {
  id: number;
  name: string;
  sport?: string;
  licenseStatus?: string;
}

function isLicensedTournament(licenseStatus: string | undefined): boolean {
  return licenseStatus === "active" || licenseStatus === "completed";
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
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [sourceId, setSourceId] = useState(String(tournamentId));
  const [savingSource, setSavingSource] = useState(false);

  const { data: settings } = useQuery<{ linkedAuctionTournamentId?: number | null }>({
    queryKey: ["badminton-settings", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/settings`),
    enabled: !!tournamentId,
  });

  const { data: account } = useQuery<{ tournaments?: ImportSource[] }>({
    queryKey: ["organizer-account-me"],
    queryFn: async () => {
      const res = await apiFetch("/auth/organizer-account/me");
      if (!res.ok) return { tournaments: [] };
      return res.json();
    },
  });

  const { data: rosterPlayers = [] } = useQuery<BadmintonPlayer[]>({
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

  const badmintonSources = useMemo(
    () => (account?.tournaments ?? []).filter((t) => t.sport === "badminton"),
    [account?.tournaments],
  );

  useEffect(() => {
    if (badmintonSources.length === 0) return;
    const linked = settings?.linkedAuctionTournamentId;
    if (linked && badmintonSources.some((t) => t.id === linked)) {
      setSourceId(String(linked));
      return;
    }
    if (badmintonSources.some((t) => t.id === tournamentId)) {
      setSourceId(String(tournamentId));
      return;
    }
    setSourceId(String(badmintonSources[0].id));
  }, [settings?.linkedAuctionTournamentId, badmintonSources, tournamentId]);

  const selectedSource = badmintonSources.find((t) => t.id === parseInt(sourceId, 10));
  const isTrialSource = !!selectedSource && !isLicensedTournament(selectedSource.licenseStatus);
  const remainingTrialSlots = Math.max(0, BADMINTON_TRIAL_IMPORT_LIMIT - rosterPlayers.length);

  const sourceOptions = badmintonSources.map((t) => {
    const licensed = isLicensedTournament(t.licenseStatus);
    return {
      value: String(t.id),
      label: licensed
        ? `#${t.id} — ${t.name} · Licensed`
        : `#${t.id} — ${t.name} · Trial (max ${BADMINTON_TRIAL_IMPORT_LIMIT} players)`,
    };
  });

  async function handleSourceChange(nextSourceId: string) {
    setSourceId(nextSourceId);
    setSelected(new Set());
    setSavingSource(true);
    try {
      const linkedId = parseInt(nextSourceId, 10);
      await badmintonFetch(tournamentId, `/settings`, {
        method: "PATCH",
        body: JSON.stringify({
          linkedAuctionTournamentId: Number.isFinite(linkedId) ? linkedId : null,
        }),
      });
      qc.invalidateQueries({ queryKey: ["badminton-settings", tournamentId] });
      qc.invalidateQueries({ queryKey: ["master-players", tournamentId, nextSourceId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save auction source");
    } finally {
      setSavingSource(false);
    }
  }

  const { data: masterPlayers = [], isLoading } = useQuery<MasterPlayerImport[]>({
    queryKey: ["master-players", tournamentId, sourceId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/master-players`,
        { credentials: "include" },
      );
      return res.json();
    },
    enabled: !!tournamentId && !savingSource,
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setError("");
        return next;
      }
      if (isTrialSource && next.size >= remainingTrialSlots) {
        setError(
          remainingTrialSlots > 0
            ? `Trial limit: ${remainingTrialSlots} slot${remainingTrialSlots === 1 ? "" : "s"} left (max ${BADMINTON_TRIAL_IMPORT_LIMIT} players). Upgrade license for full roster.`
            : `Trial limit reached (${BADMINTON_TRIAL_IMPORT_LIMIT} players). Upgrade license to import more.`,
        );
        return prev;
      }
      next.add(id);
      setError("");
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
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Import failed");
      }
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const available = masterPlayers.filter((p) => !p.alreadyImported);
  const allSelected = available.length > 0 && available.every((p) => selected.has(p.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
      setError("");
      return;
    }
    const ids = available.map((p) => p.id);
    const limit = isTrialSource ? remainingTrialSlots : ids.length;
    setSelected(new Set(ids.slice(0, limit)));
    if (isTrialSource && ids.length > limit) {
      setError(
        limit > 0
          ? `Trial limit: selected ${limit} of ${ids.length} players (${BADMINTON_TRIAL_IMPORT_LIMIT} max). Upgrade license for full roster.`
          : `Trial limit reached (${BADMINTON_TRIAL_IMPORT_LIMIT} players). Upgrade license to import more.`,
      );
    } else {
      setError("");
    }
  }

  return (
    <FormModal
      title="Import From Auction"
      subtitle="Copy auction players into your badminton roster. Only imported players appear when you create matches."
      onClose={onClose}
      size="xl"
      footer={
        <div className="flex items-center gap-3">
          {error && <p className="text-red-300 text-sm flex-1">{error}</p>}
          <BtnSecondary onClick={onClose}>Cancel</BtnSecondary>
          <BtnPrimary onClick={handleImport} disabled={importing || selected.size === 0}>
            {importing ? "Importing…" : `Add to badminton (${selected.size})`}
          </BtnPrimary>
        </div>
      }
    >
      <div className="space-y-4 -mt-2">
        {badmintonSources.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-white/50">No badminton tournaments found on your account.</p>
            <p className="text-white/30 text-sm">Create a badminton tournament first, or use + Add Player for walk-ins.</p>
          </div>
        ) : (
          <>
        <FormField label="Auction source">
          <DarkSelect
            value={sourceId}
            onValueChange={handleSourceChange}
            disabled={savingSource}
            placeholder="Select badminton tournament…"
            options={sourceOptions}
          />
          <p className="text-white/35 text-xs mt-2">
            Only your badminton tournaments appear here. Auction status does not matter — licensed events have no import cap.
          </p>
        </FormField>

        {isTrialSource && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
            <strong className="font-semibold">Trial tournament.</strong>{" "}
            You can register up to {BADMINTON_TRIAL_IMPORT_LIMIT} players for badminton
            {remainingTrialSlots > 0
              ? ` — ${remainingTrialSlots} slot${remainingTrialSlots === 1 ? "" : "s"} remaining.`
              : " — limit reached."}{" "}
            Upgrade to a licensed plan for the full roster.
          </div>
        )}

        {isLoading || savingSource ? (
          <AsyncLoadingPanel tone="inverse" message="Loading auction players…" />
        ) : available.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <p className="text-white/50">No auction players to import from this source.</p>
            <p className="text-white/30 text-sm">
              Add players in the auction first, or choose a different source tournament above.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 pb-1">
              <p className="text-white/45 text-sm">
                {available.length} player{available.length === 1 ? "" : "s"} ready to add
              </p>
              <button
                type="button"
                onClick={toggleAll}
                className="text-xs text-[#4fc3f7] hover:underline"
              >
                {allSelected ? "Clear selection" : "Select all"}
              </button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {available.map((p) => (
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
              ))}
            </div>
          </>
        )}
          </>
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
  const meta = playerMeta(player);
  const fullName = playerFullName(player);
  const initials = `${player.firstName.charAt(0)}${player.lastName.charAt(0)}`;
  const glowColor = "hsl(var(--primary))";

  return (
    <div
      className={cn(
        hubCardClass,
        "overflow-hidden hover:border-primary/30 transition-all group",
      )}
      style={{ boxShadow: `0 0 0 1px transparent, 0 0 24px ${glowColor}11` }}
    >
      <div className="flex items-center gap-4 p-4">
        {player.photoUrl ? (
          <div
            className="w-14 h-14 rounded-xl overflow-hidden flex-none border-[3px]"
            style={{ borderColor: glowColor, boxShadow: `0 0 16px ${glowColor}33` }}
          >
            <img
              src={player.photoUrl}
              alt={fullName}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div
            className="w-14 h-14 rounded-xl bg-primary/10 border-[3px] flex items-center justify-center flex-none"
            style={{ borderColor: glowColor, boxShadow: `0 0 16px ${glowColor}33` }}
          >
            <span className="text-lg font-display font-bold text-primary">{initials}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <TeamPlayerCard
            identity={identityFromOrganizerPlayer(player)}
            size="sm"
            layout="stack"
            showBadge={Boolean(player.franchiseName)}
            playerClassName="text-foreground font-display font-semibold text-base"
            teamClassName="text-primary"
          />
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {formatPlayerGender(player.gender) ? (
              <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {formatPlayerGender(player.gender)}
              </span>
            ) : null}
            {meta.role ? (
              <span className="inline-flex items-center rounded-md border border-primary/45 bg-primary/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-primary">
                {meta.role}
              </span>
            ) : null}
            {meta.city ? (
              <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {meta.city}
              </span>
            ) : null}
            {meta.age != null ? (
              <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Age {meta.age}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 min-w-11 rounded-md bg-secondary hover:bg-accent border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Edit player"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="min-h-11 min-w-11 rounded-md bg-destructive/10 hover:bg-destructive/20 border border-destructive/25 flex items-center justify-center text-destructive transition-colors"
            aria-label="Delete player"
          >
            <Trash2 className="w-3.5 h-3.5" />
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
  const existingMeta = player ? playerMeta(player) : null;
  const [form, setForm] = useState({
    name: player ? playerFullName(player) : "",
    mobile: player?.mobile ? sanitizeMobileInput(player.mobile) : "",
    email: player?.email ?? "",
    photoUrl: player?.photoUrl ?? "",
    photoPublicId: "",
    city: existingMeta?.city ?? player?.academyName ?? "",
    age: existingMeta?.age != null ? String(existingMeta.age) : "",
    gender: player?.gender ?? "",
    role: existingMeta?.role ?? "",
    handedness: player?.handedness ?? "R",
    jerseyNumber: existingMeta?.jerseyNumber ?? "",
    jerseySize: (existingMeta?.jerseySize as JerseySize | "") ?? "",
    achievements: existingMeta?.achievements ?? "",
  });
  const [sportRoles, setSportRoles] = useState<SportRole[]>([]);
  const [photoEditorOpen, setPhotoEditorOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mobileError, setMobileError] = useState("");
  const [emailError, setEmailError] = useState("");

  useEffect(() => {
    fetch("/api/sports/by-slug/badminton/roles")
      .then((r) => r.json())
      .then((roles: SportRole[]) => {
        setSportRoles(roles);
        if (!player && roles.length > 0) {
          setForm((prev) => (prev.role ? prev : { ...prev, role: roles[0].roleName }));
        }
      })
      .catch(() => {});
  }, [player]);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    const mobileResult = parseIndianMobile(form.mobile);
    if (!mobileResult.ok) {
      setMobileError(mobileResult.error);
      return;
    }
    setMobileError("");

    const emailResult = parseOptionalEmail(form.email);
    if (!emailResult.ok) {
      setEmailError(emailResult.error);
      return;
    }
    setEmailError("");

    if (!form.name.trim()) {
      setError("Full name is required");
      return;
    }
    if (!form.role.trim()) {
      setError("Role is required");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const payload = {
        name: form.name.trim(),
        mobile: mobileResult.normalized,
        email: emailResult.email || undefined,
        photoUrl: form.photoUrl || null,
        photoPublicId: form.photoPublicId || null,
        city: form.city.trim() || undefined,
        age: form.age ? parseInt(form.age, 10) : undefined,
        gender: form.gender === "M" || form.gender === "F" ? form.gender : undefined,
        role: form.role.trim(),
        handedness: form.handedness,
        jerseyNumber: form.jerseyNumber.trim() || undefined,
        jerseySize: form.jerseySize || undefined,
        achievements: form.achievements.trim() || undefined,
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
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Failed to save player");
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error saving player");
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormModal
      title={player ? "Edit Player" : "Add Walk-in Player"}
      subtitle="Same fields as auction player registration — photo and details show on scoreboard and match picker"
      onClose={onClose}
      size="lg"
    >
      <FormField label="Player Photo">
        <div className="flex gap-3 items-start">
          <div className="w-16 h-16 rounded-xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
            {form.photoUrl ? (
              <img src={form.photoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-6 h-6 text-muted-foreground/40" />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <BtnSecondary type="button" onClick={() => setPhotoEditorOpen(true)} className="gap-1.5 text-xs h-9">
              {form.photoUrl ? <Pencil className="w-3.5 h-3.5" /> : <Upload className="w-3.5 h-3.5" />}
              {form.photoUrl ? "Change Photo" : "Upload Photo"}
            </BtnSecondary>
            {form.photoUrl ? (
              <BtnSecondary
                type="button"
                onClick={() => {
                  setField("photoUrl", "");
                  setField("photoPublicId", "");
                }}
                className="gap-1.5 text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <X className="w-3.5 h-3.5" />
                Remove
              </BtnSecondary>
            ) : null}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Court-side photo from phone camera works — crop before save. Without photo, initials show on screen.
        </p>
      </FormField>

      <ImageEditorDialog
        open={photoEditorOpen}
        onClose={() => setPhotoEditorOpen(false)}
        initialUrl={form.photoUrl || undefined}
        aspect={PLAYER_PHOTO_ASPECT}
        title="Player Photo"
        exportMaxWidthOrHeight={PLAYER_PHOTO_WIDTH}
        exportMaxSizeMB={PLAYER_PHOTO_EXPORT_MAX_MB}
        exportHint="Higher resolution for sharp LED display — use a clear, well-lit photo."
        onSave={(upload) => {
          setField("photoUrl", upload.url);
          setField("photoPublicId", upload.publicId);
          setPhotoEditorOpen(false);
        }}
      />

      <FormField label="Mobile Number *">
        <input
          required
          value={form.mobile}
          onChange={(e) => {
            setField("mobile", sanitizeMobileInput(e.target.value));
            if (mobileError) setMobileError("");
          }}
          placeholder="10-digit mobile (e.g. 9876543210)"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={10}
          className={inputClass}
        />
        {mobileError ? <p className="text-destructive text-xs mt-1">{mobileError}</p> : null}
      </FormField>

      <OptionalEmailField
        id="walk-in-email"
        value={form.email}
        onChange={(v) => {
          setField("email", v);
          if (emailError) setEmailError("");
        }}
        error={emailError || undefined}
        inputClassName={inputClass}
      />

      <FormField label="Full Name *">
        <input
          required
          value={form.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="Your full name"
          autoComplete="name"
          className={inputClass}
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FormField label="City">
          <CityAutocomplete
            value={form.city}
            onChange={(v) => setField("city", v)}
            className={inputClass}
          />
        </FormField>
        <FormField label="Age">
          <input
            type="number"
            inputMode="numeric"
            value={form.age}
            onChange={(e) => setField("age", e.target.value)}
            className={inputClass}
          />
        </FormField>
        <PlayerGenderSelect
          value={form.gender}
          onChange={(v) => setField("gender", v)}
          triggerClassName={inputClass}
        />
      </div>

      <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
        <FormField label="Role *">
          <DarkSelect
            value={form.role || "none"}
            onValueChange={(role) => setField("role", role === "none" ? "" : role)}
            placeholder="Select role…"
            options={[
              { value: "none", label: "Select role…" },
              ...(sportRoles.length > 0
                ? sportRoles.map((r) => ({ value: r.roleName, label: r.roleName }))
                : [
                    { value: "Singles Player", label: "Singles Player" },
                    { value: "Doubles Player", label: "Doubles Player" },
                    { value: "Mixed Doubles", label: "Mixed Doubles" },
                  ]),
            ]}
          />
        </FormField>

        <FormField label="Playing Hand">
          <DarkSelect
            value={form.handedness}
            onValueChange={(handedness) => setField("handedness", handedness)}
            options={[
              { value: "R", label: "Right" },
              { value: "L", label: "Left" },
            ]}
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FormField label="Jersey Number">
          <input
            value={form.jerseyNumber}
            onChange={(e) => setField("jerseyNumber", e.target.value)}
            inputMode="numeric"
            className={inputClass}
          />
        </FormField>
        <JerseySizeSelect
          value={form.jerseySize}
          onChange={(v) => setField("jerseySize", v)}
          triggerClassName={inputClass}
        />
      </div>

      <FormField label="Achievements">
        <textarea
          value={form.achievements}
          onChange={(e) => setField("achievements", e.target.value)}
          rows={3}
          className={cn(inputClass, "min-h-[88px] resize-y")}
        />
      </FormField>

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
