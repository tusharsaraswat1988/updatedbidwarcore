/**
 * Minimal player picker for match scheduling — photo + name only.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type MasterPlayerOption = {
  id: string;
  displayName: string;
  photoUrl: string | null;
  franchiseName: string | null;
  franchiseLogoUrl: string | null;
  /** @deprecated use franchiseLogoUrl */
  teamLogoUrl?: string | null;
  alreadyImported: boolean;
  badmintonPlayerId: number | null;
};

export type SidePreview = {
  label: string;
  shortLabel: string;
  photoUrl?: string;
  franchiseName?: string;
  franchiseLogoUrl?: string;
  /** @deprecated use franchiseLogoUrl */
  teamLogoUrl?: string;
  masterPlayerId?: string;
  playerIds: number[];
};

function PlayerAvatar({
  photoUrl,
  displayName,
  franchiseLogoUrl,
  size = "md",
}: {
  photoUrl: string | null;
  displayName: string;
  franchiseLogoUrl?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const dim = size === "lg" ? "w-12 h-12" : size === "md" ? "w-10 h-10" : "w-8 h-8";
  const badgeDim = size === "lg" ? "w-5 h-5" : "w-4 h-4";

  return (
    <div className="relative flex-none">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className={`${dim} rounded-lg object-cover`}
          loading="lazy"
        />
      ) : (
        <div
          className={`${dim} rounded-lg bg-white/10 flex items-center justify-center font-bold text-white/40`}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      {franchiseLogoUrl ? (
        <img
          src={franchiseLogoUrl}
          alt=""
          className={`absolute -bottom-0.5 -right-0.5 ${badgeDim} rounded-full object-cover border border-[#0d1529] bg-white/90`}
          loading="lazy"
        />
      ) : null}
    </div>
  );
}

function SelectedPlayerRow({
  displayName,
  photoUrl,
  franchiseLogoUrl,
  onChange,
}: {
  displayName: string;
  photoUrl: string;
  franchiseLogoUrl?: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-1">
      <PlayerAvatar
        photoUrl={photoUrl || null}
        displayName={displayName}
        franchiseLogoUrl={franchiseLogoUrl}
        size="md"
      />
      <span className="flex-1 text-white font-semibold text-sm truncate">{displayName}</span>
      <button
        type="button"
        onClick={onChange}
        className="text-[#4fc3f7] text-xs font-semibold hover:text-[#7dd3fc] shrink-0"
      >
        Change
      </button>
    </div>
  );
}

export function MasterPlayerPicker({
  tournamentId,
  label,
  value,
  selectedDisplayName,
  selectedPhotoUrl,
  selectedFranchiseLogoUrl,
  onSelect,
  onClear,
}: {
  tournamentId: number;
  label: string;
  value: string | null;
  selectedDisplayName?: string;
  selectedPhotoUrl?: string;
  selectedFranchiseLogoUrl?: string;
  onSelect: (player: MasterPlayerOption, sideJson: SidePreview) => void;
  onClear?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { data: players = [] } = useQuery<MasterPlayerOption[]>({
    queryKey: ["master-players", tournamentId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/master-players`,
        { credentials: "include" },
      );
      if (!res.ok) return [];
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      return rows.map((p) => ({
        id: String(p.id),
        displayName: String(p.displayName ?? ""),
        photoUrl: (p.photoUrl as string | null) ?? null,
        franchiseName: (p.franchiseName ?? p.teamName ?? null) as string | null,
        franchiseLogoUrl: (p.franchiseLogoUrl ?? p.teamLogoUrl ?? null) as string | null,
        teamLogoUrl: (p.teamLogoUrl as string | null) ?? null,
        alreadyImported: Boolean(p.alreadyImported),
        badmintonPlayerId: (p.badmintonPlayerId as number | null) ?? null,
      }));
    },
    enabled: !!tournamentId,
  });

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return players;
    return players.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [players, query]);

  async function pick(player: MasterPlayerOption) {
    const res = await fetch(
      `${API_BASE}/api/tournaments/${tournamentId}/badminton/master-players/${player.id}/side-json${
        player.badmintonPlayerId ? `?badmintonPlayerId=${player.badmintonPlayerId}` : ""
      }`,
      { credentials: "include" },
    );
    const sideJson = res.ok ? ((await res.json()) as SidePreview) : null;
    if (sideJson) {
      onSelect(player, sideJson);
    }
    setOpen(false);
    setQuery("");
  }

  function closeModal() {
    setOpen(false);
    setQuery("");
  }

  function pickerModal() {
    return (
      <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
        <div className="bg-[#0d1529] border border-white/10 rounded-2xl w-full max-w-md max-h-[70vh] flex flex-col">
          <div className="p-4 border-b border-white/8 flex items-center justify-between gap-3">
            <h3 className="font-bold text-white truncate">{label}</h3>
            <button type="button" onClick={closeModal} className="text-white/40 hover:text-white text-2xl leading-none">
              ×
            </button>
          </div>
          <div className="p-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30"
              autoFocus
            />
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
            {filtered.length === 0 ? (
              <p className="text-white/30 text-sm text-center py-8">No players found</p>
            ) : (
              filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 text-left"
                >
                  <PlayerAvatar
                    photoUrl={p.photoUrl}
                    displayName={p.displayName}
                    franchiseLogoUrl={p.franchiseLogoUrl ?? p.teamLogoUrl}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-white font-medium text-sm truncate block">{p.displayName}</span>
                    {p.franchiseName ? (
                      <span className="text-white/35 text-[10px] truncate block">
                        Franchise: {p.franchiseName}
                      </span>
                    ) : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (value && selectedDisplayName) {
    return (
      <div className="space-y-1">
        <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wide">{label}</p>
        <SelectedPlayerRow
          displayName={selectedDisplayName}
          photoUrl={selectedPhotoUrl ?? ""}
          franchiseLogoUrl={selectedFranchiseLogoUrl}
          onChange={() => {
            onClear?.();
            setOpen(true);
          }}
        />
        {open ? pickerModal() : null}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-white/40 text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full h-11 px-3 rounded-xl bg-white/5 border border-dashed border-white/15 text-white/40 text-sm hover:border-[#4fc3f7]/40 hover:text-white/60 transition-colors"
      >
        + Select player
      </button>
      {open ? pickerModal() : null}
    </div>
  );
}

