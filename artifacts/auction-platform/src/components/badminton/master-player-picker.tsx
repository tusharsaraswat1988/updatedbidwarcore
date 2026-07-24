/**
 * Minimal player picker for match scheduling — photo + name only.
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import {
  AsyncLoadingPanel,
  FormModal,
  SearchInput,
  PickerTrigger,
  labelClass,
} from "@/components/badminton/form-ui";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

export type MasterPlayerOption = {
  badmintonPlayerId: number;
  masterPlayerId: string | null;
  displayName: string;
  photoUrl: string | null;
  franchiseName: string | null;
  franchiseLogoUrl: string | null;
  /** @deprecated use franchiseLogoUrl */
  teamLogoUrl?: string | null;
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
          className={`${dim} rounded-xl object-cover ring-1 ring-white/10`}
          loading="lazy"
        />
      ) : (
        <div
          className={`${dim} rounded-xl bg-[#1a2847] flex items-center justify-center font-bold text-white/50 ring-1 ring-white/10`}
        >
          {displayName.charAt(0).toUpperCase()}
        </div>
      )}
      {franchiseLogoUrl ? (
        <img
          src={franchiseLogoUrl}
          alt=""
          className={`absolute -bottom-0.5 -right-0.5 ${badgeDim} rounded-full object-cover border-2 border-[#0a1224] bg-[#121c34]`}
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
    <div className="flex items-center gap-3 rounded-xl border border-[#4fc3f7]/20 bg-[#121c34] px-3 py-2.5">
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
        className="text-[#4fc3f7] text-xs font-semibold hover:text-[#7dd3fc] shrink-0 px-2 py-1 rounded-lg hover:bg-[#4fc3f7]/10 transition-colors"
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
  const [pickingId, setPickingId] = useState<string | null>(null);

  const { data: players = [], isLoading, isFetching } = useQuery<MasterPlayerOption[]>({
    queryKey: ["badminton-match-roster", tournamentId],
    queryFn: async () => {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/match-roster`,
        { credentials: "include" },
      );
      if (!res.ok) return [];
      const rows = (await res.json()) as Array<Record<string, unknown>>;
      return rows.map((p) => ({
        badmintonPlayerId: Number(p.badmintonPlayerId),
        masterPlayerId: (p.masterPlayerId as string | null) ?? null,
        displayName: String(p.displayName ?? ""),
        photoUrl: (p.photoUrl as string | null) ?? null,
        franchiseName: (p.franchiseName ?? p.teamName ?? null) as string | null,
        franchiseLogoUrl: (p.franchiseLogoUrl ?? p.teamLogoUrl ?? null) as string | null,
        teamLogoUrl: (p.teamLogoUrl as string | null) ?? null,
      }));
    },
    enabled: !!tournamentId && open,
  });

  const listLoading = isLoading || (isFetching && players.length === 0);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return players;
    return players.filter((p) => p.displayName.toLowerCase().includes(q));
  }, [players, query]);

  async function pick(player: MasterPlayerOption) {
    const pickKey = String(player.badmintonPlayerId);
    setPickingId(pickKey);
    try {
      const res = await fetch(
        `${API_BASE}/api/tournaments/${tournamentId}/badminton/players/${player.badmintonPlayerId}/side-json`,
        { credentials: "include" },
      );
      const sideJson = res.ok ? ((await res.json()) as SidePreview) : null;
      if (sideJson) {
        onSelect(player, sideJson);
      }
      setOpen(false);
      setQuery("");
    } finally {
      setPickingId(null);
    }
  }

  function closeModal() {
    if (pickingId) return;
    setOpen(false);
    setQuery("");
  }

  const pickerModal = open ? (
    <FormModal title={label} subtitle="Choose from players registered in this tournament" onClose={closeModal} size="md">
      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder="Search by name…"
      />
      <div className="max-h-[45vh] overflow-y-auto space-y-1 -mx-1 px-1">
        {pickingId ? (
          <AsyncLoadingPanel
            tone="inverse"
            compact
            message="Loading player details for this side…"
          />
        ) : listLoading ? (
          <AsyncLoadingPanel
            tone="inverse"
            compact
            message="Loading players from your tournament roster…"
          />
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 px-4 space-y-2">
            <p className="text-white/35 text-sm">
              {query.trim() ? "No players match your search" : "No players registered in this tournament yet"}
            </p>
            {!query.trim() ? (
              <p className="text-white/25 text-xs">
                Add players under Badminton → Players, or import from your Player Registry first.
              </p>
            ) : null}
          </div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.badmintonPlayerId}
              type="button"
              onClick={() => pick(p)}
              disabled={!!pickingId}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-transparent hover:border-white/10 hover:bg-white/[0.04] text-left transition-colors disabled:opacity-50"
            >
              <PlayerAvatar
                photoUrl={p.photoUrl}
                displayName={p.displayName}
                franchiseLogoUrl={p.franchiseLogoUrl ?? p.teamLogoUrl}
                size="md"
              />
              <div className="min-w-0 flex-1">
                {p.franchiseName ? (
                  <span className="text-white/45 text-[10px] font-bold uppercase tracking-wide truncate block">
                    {p.franchiseName}
                  </span>
                ) : null}
                <span className="text-white font-medium text-sm truncate block">{p.displayName}</span>
              </div>
              {pickingId === String(p.badmintonPlayerId) ? (
                <Loader2 className="w-4 h-4 text-[#4fc3f7] animate-spin shrink-0" />
              ) : null}
            </button>
          ))
        )}
      </div>
    </FormModal>
  ) : null;

  if (value && selectedDisplayName) {
    return (
      <div className="space-y-2">
        <p className={labelClass}>{label}</p>
        <SelectedPlayerRow
          displayName={selectedDisplayName}
          photoUrl={selectedPhotoUrl ?? ""}
          franchiseLogoUrl={selectedFranchiseLogoUrl}
          onChange={() => {
            onClear?.();
            setOpen(true);
          }}
        />
        {pickerModal}
      </div>
    );
  }

  return (
    <>
      <PickerTrigger label={label} onClick={() => setOpen(true)} />
      {pickerModal}
    </>
  );
}
