import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Trophy, Clock, Pause, X } from "lucide-react";

export interface SavedAuction {
  tournamentId: number;
  teamId:       number;
  tournamentName?: string;
  teamName?:       string;
  teamColor?:      string;
}

export const SAVED_AUCTIONS_KEY = "owner_saved_auctions";

export function getSavedAuctions(): SavedAuction[] {
  try {
    const raw = localStorage.getItem(SAVED_AUCTIONS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedAuction[];
  } catch {
    return [];
  }
}

export function upsertSavedAuction(entry: SavedAuction) {
  const list = getSavedAuctions();
  const idx  = list.findIndex(
    (s) => s.tournamentId === entry.tournamentId && s.teamId === entry.teamId,
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], ...entry };
  } else {
    list.unshift(entry);
  }
  // Cap at 10, remove oldest first (list is in recency order)
  const capped = list.slice(0, 10);
  localStorage.setItem(SAVED_AUCTIONS_KEY, JSON.stringify(capped));
}

export function removeSavedAuction(tournamentId: number, teamId: number) {
  const list = getSavedAuctions().filter(
    (s) => !(s.tournamentId === tournamentId && s.teamId === teamId),
  );
  localStorage.setItem(SAVED_AUCTIONS_KEY, JSON.stringify(list));
}

// ── Status helpers ─────────────────────────────────────────────────────────
type AuctionStatusRaw = { status?: string; licenseStatus?: string } | null;

function isLive(s: AuctionStatusRaw)      { return s?.status === "active"; }
function isCompleted(s: AuctionStatusRaw) {
  return s?.status === "completed" || s?.licenseStatus === "completed";
}

async function fetchAuctionStatus(tournamentId: number): Promise<AuctionStatusRaw> {
  try {
    const r = await fetch(`/api/tournaments/${tournamentId}/auction`);
    if (!r.ok) return null;
    return (await r.json()) as AuctionStatusRaw;
  } catch {
    return null;
  }
}

// ── Status badge ────────────────────────────────────────────────────────────
function StatusBadge({ state }: { state: AuctionStatusRaw }) {
  if (!state) return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#27272a] text-[#71717a] uppercase tracking-wider">
      Unknown
    </span>
  );
  if (isLive(state)) return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 uppercase tracking-wider font-bold flex items-center gap-1">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
      Live
    </span>
  );
  if (state.status === "paused") return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 uppercase tracking-wider font-bold flex items-center gap-1">
      <Pause className="w-2.5 h-2.5" />
      Paused
    </span>
  );
  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#27272a] text-[#71717a] uppercase tracking-wider flex items-center gap-1">
      <Clock className="w-2.5 h-2.5" />
      Upcoming
    </span>
  );
}

// ── Auction card ────────────────────────────────────────────────────────────
function AuctionCard({
  auction,
  state,
  onClick,
  onRemove,
}: {
  auction: SavedAuction;
  state:   AuctionStatusRaw;
  onClick: () => void;
  onRemove: () => void;
}) {
  const color = auction.teamColor || "#F59E0B";
  const live  = isLive(state);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border transition-all active:scale-[0.98] relative group"
      style={{
        borderColor:     live ? `${color}60` : "#27272a",
        backgroundColor: live ? `${color}12` : "#18181b",
        boxShadow:       live ? `0 0 24px ${color}20` : "none",
      }}
    >
      <div className="flex items-center gap-3">
        {/* Team badge */}
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-base flex-shrink-0"
          style={{ backgroundColor: `${color}25`, color, border: `2px solid ${color}50` }}
        >
          {(auction.teamName?.substring(0, 3) || "?").toUpperCase()}
        </div>

        {/* Names */}
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-base text-white leading-tight truncate">
            {auction.teamName || `Team ${auction.teamId}`}
          </p>
          <p className="text-xs text-[#71717a] truncate mt-0.5">
            {auction.tournamentName || `Tournament ${auction.tournamentId}`}
          </p>
        </div>

        {/* Status + remove */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <StatusBadge state={state} />
        </div>
      </div>

      {/* Remove button */}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-2 right-2 p-1 rounded-full text-[#52525b] hover:text-[#a1a1aa] opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove"
      >
        <X className="w-3 h-3" />
      </button>
    </button>
  );
}

// ── Main Launcher ───────────────────────────────────────────────────────────
export function Launcher() {
  const [, setLocation] = useLocation();
  const [saved,   setSaved]   = useState<SavedAuction[]>([]);
  const [states,  setStates]  = useState<Record<string, AuctionStatusRaw>>({});
  const [loading, setLoading] = useState(true);
  const [redirected, setRedirected] = useState(false);

  useEffect(() => {
    const list = getSavedAuctions();
    setSaved(list);

    if (list.length === 0) { setLoading(false); return; }

    // Fetch all auction states in parallel
    Promise.all(
      list.map(async (s) => {
        const state = await fetchAuctionStatus(s.tournamentId);
        return { key: `${s.tournamentId}-${s.teamId}`, state };
      }),
    ).then((results) => {
      const map: Record<string, AuctionStatusRaw> = {};
      for (const r of results) map[r.key] = r.state;
      setStates(map);
      setLoading(false);
    });
  }, []);

  // Auto-redirect once states are loaded
  useEffect(() => {
    if (loading || redirected) return;
    // Filter out completed auctions for redirect logic
    const active = saved.filter((s) => {
      const st = states[`${s.tournamentId}-${s.teamId}`];
      return !isCompleted(st);
    });
    const live = active.filter((s) => isLive(states[`${s.tournamentId}-${s.teamId}`]));
    if (live.length === 1) {
      setRedirected(true);
      setLocation(`/tournament/${live[0].tournamentId}/owner/${live[0].teamId}`);
    }
  }, [loading, redirected, saved, states, setLocation]);

  function navigate(s: SavedAuction) {
    setLocation(`/tournament/${s.tournamentId}/owner/${s.teamId}`);
  }

  function handleRemove(tournamentId: number, teamId: number) {
    removeSavedAuction(tournamentId, teamId);
    setSaved((prev) => prev.filter(
      (s) => !(s.tournamentId === tournamentId && s.teamId === teamId),
    ));
  }

  // Filter out completed auctions for display
  const visible = saved.filter((s) => {
    if (loading) return true; // show all while loading
    const st = states[`${s.tournamentId}-${s.teamId}`];
    return !isCompleted(st);
  });

  const liveAuctions = visible.filter((s) =>
    isLive(states[`${s.tournamentId}-${s.teamId}`]),
  );

  // ── Empty state ───────────────────────────────────────────────────────────
  if (!loading && visible.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#09090b] px-8">
        <div className="text-center space-y-4">
          <Trophy className="w-12 h-12 text-[#3f3f46] mx-auto" />
          <p className="text-[#71717a] text-sm leading-relaxed">
            Open your owner link to join an auction.
          </p>
          <p className="text-[10px] text-[#3f3f46] uppercase tracking-widest">
            Powered by BidWar
          </p>
        </div>
      </div>
    );
  }

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090b]">
        <div className="w-8 h-8 border-2 border-[#F59E0B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0">
        <h1 className="font-display font-black text-2xl text-white">Your Auctions</h1>
        {liveAuctions.length > 0 && (
          <p className="text-sm text-green-400 mt-1">
            {liveAuctions.length === 1
              ? "1 auction is live — tap to join"
              : `${liveAuctions.length} auctions are live — choose one`}
          </p>
        )}
        {liveAuctions.length === 0 && (
          <p className="text-sm text-[#71717a] mt-1">No auctions are live right now</p>
        )}
      </div>

      {/* Auction list */}
      <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-3 min-h-0">
        {/* Live auctions first */}
        {liveAuctions.length > 0 && (
          <>
            <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-semibold pt-1">
              Live Now
            </p>
            {liveAuctions.map((s) => (
              <AuctionCard
                key={`${s.tournamentId}-${s.teamId}`}
                auction={s}
                state={states[`${s.tournamentId}-${s.teamId}`]}
                onClick={() => navigate(s)}
                onRemove={() => handleRemove(s.tournamentId, s.teamId)}
              />
            ))}
          </>
        )}

        {/* Upcoming auctions */}
        {visible.filter((s) => !isLive(states[`${s.tournamentId}-${s.teamId}`])).length > 0 && (
          <>
            <p className="text-[10px] text-[#52525b] uppercase tracking-widest font-semibold pt-2">
              Upcoming
            </p>
            {visible
              .filter((s) => !isLive(states[`${s.tournamentId}-${s.teamId}`]))
              .map((s) => (
                <AuctionCard
                  key={`${s.tournamentId}-${s.teamId}`}
                  auction={s}
                  state={states[`${s.tournamentId}-${s.teamId}`]}
                  onClick={() => navigate(s)}
                  onRemove={() => handleRemove(s.tournamentId, s.teamId)}
                />
              ))}
          </>
        )}
      </div>

      <p className="text-center text-[10px] text-[#3f3f46] uppercase tracking-widest pb-5 flex-shrink-0">
        Powered by BidWar
      </p>
    </div>
  );
}
