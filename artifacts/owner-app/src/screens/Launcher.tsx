import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Clock, Pause, X, Zap, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useBranding } from "@/hooks/useBranding";
import { TeamLogo } from "@/components/TeamLogo";

export interface SavedAuction {
  tournamentId: number;
  teamId:       number;
  tournamentName?: string;
  teamName?:       string;
  teamColor?:      string;
  teamLogoUrl?:    string;
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
  const idx  = list.findIndex(s => s.tournamentId === entry.tournamentId && s.teamId === entry.teamId);
  if (idx >= 0) list[idx] = { ...list[idx], ...entry };
  else list.unshift(entry);
  localStorage.setItem(SAVED_AUCTIONS_KEY, JSON.stringify(list.slice(0, 10)));
}

export function removeSavedAuction(tournamentId: number, teamId: number) {
  const list = getSavedAuctions().filter(s => !(s.tournamentId === tournamentId && s.teamId === teamId));
  localStorage.setItem(SAVED_AUCTIONS_KEY, JSON.stringify(list));
}

// ── Status helpers ──────────────────────────────────────────────────────────
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

// ── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ state }: { state: AuctionStatusRaw }) {
  if (!state) return (
    <span className="text-sm px-3 py-1 rounded-full bg-[#27272a] text-[#71717a] uppercase tracking-wider font-semibold">
      Unknown
    </span>
  );
  if (isLive(state)) return (
    <span className="text-sm px-3 py-1 rounded-full bg-green-500/20 text-green-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse inline-block" />
      Live
    </span>
  );
  if (state.status === "paused") return (
    <span className="text-sm px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 uppercase tracking-wider font-bold flex items-center gap-1.5">
      <Pause className="w-3.5 h-3.5" />
      Paused
    </span>
  );
  return (
    <span className="text-sm px-3 py-1 rounded-full bg-[#27272a] text-[#71717a] uppercase tracking-wider font-semibold flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5" />
      Upcoming
    </span>
  );
}

// ── Auction card ─────────────────────────────────────────────────────────────
function AuctionCard({ auction, state, onClick, onRemove }: {
  auction:  SavedAuction;
  state:    AuctionStatusRaw;
  onClick:  () => void;
  onRemove: () => void;
}) {
  const color = auction.teamColor || "#F59E0B";
  const live  = isLive(state);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative group"
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onClick(); }}
        className="w-full text-left p-5 rounded-2xl border transition-all active:scale-[0.98] cursor-pointer"
        style={{
          borderColor:     live ? `${color}60` : "#27272a",
          backgroundColor: live ? `${color}12` : "#18181b",
          boxShadow:       live ? `0 0 24px ${color}20` : "none",
        }}
      >
        <div className="flex items-center gap-4">
          <TeamLogo
            logoUrl={auction.teamLogoUrl}
            shortCode={auction.teamName?.substring(0, 3)}
            teamName={auction.teamName}
            teamColor={color}
            className="w-16 h-16 rounded-2xl"
            textClassName="text-xl"
          />

          {/* Names */}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="font-display font-bold text-xl text-white leading-tight truncate">
              {auction.teamName || `Team ${auction.teamId}`}
            </p>
            <p className="text-base text-[#71717a] truncate">
              {auction.tournamentName || `Tournament ${auction.tournamentId}`}
            </p>
          </div>

          {/* Status badge */}
          <div className="flex-shrink-0">
            <StatusBadge state={state} />
          </div>
        </div>

        {live && (
          <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: `${color}25` }}>
            <Zap className="w-4 h-4" style={{ color }} />
            <p className="text-sm font-semibold" style={{ color }}>Tap to join live auction</p>
          </div>
        )}
      </div>

      {/* Remove button */}
      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-3 right-3 p-1.5 rounded-full text-[#52525b] hover:text-[#a1a1aa] opacity-0 group-hover:opacity-100 transition-opacity"
        title="Remove"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

// ── Main Launcher ─────────────────────────────────────────────────────────────
export function Launcher() {
  const [, setLocation] = useLocation();
  const [saved,      setSaved]      = useState<SavedAuction[]>([]);
  const [states,     setStates]     = useState<Record<string, AuctionStatusRaw>>({});
  const [loading,    setLoading]    = useState(true);
  const [redirected, setRedirected] = useState(false);
  const { brandName, logos, poweredByText, miniBrandText } = useBranding();

  useEffect(() => {
    const list = getSavedAuctions();
    setSaved(list);

    if (list.length === 0) { setLoading(false); return; }

    Promise.all(
      list.map(async s => {
        const state = await fetchAuctionStatus(s.tournamentId);
        return { key: `${s.tournamentId}-${s.teamId}`, state };
      }),
    ).then(results => {
      const map: Record<string, AuctionStatusRaw> = {};
      for (const r of results) map[r.key] = r.state;
      setStates(map);
      setLoading(false);
    });
  }, []);

  // Auto-redirect once states are loaded
  useEffect(() => {
    if (loading || redirected) return;
    const active = saved.filter(s => !isCompleted(states[`${s.tournamentId}-${s.teamId}`]));
    const live   = active.filter(s => isLive(states[`${s.tournamentId}-${s.teamId}`]));
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
    setSaved(prev => prev.filter(s => !(s.tournamentId === tournamentId && s.teamId === teamId)));
  }

  const visible = saved.filter(s => {
    if (loading) return true;
    return !isCompleted(states[`${s.tournamentId}-${s.teamId}`]);
  });

  const liveAuctions = visible.filter(s => isLive(states[`${s.tournamentId}-${s.teamId}`]));

  const BrandLogo = () => (
    <div className="flex items-center justify-center gap-3">
      {logos.main ? (
        <img src={logos.main} alt={brandName} className="h-14 w-auto" />
      ) : logos.mini ? (
        <img src={logos.mini} alt={brandName} className="h-10 w-auto" />
      ) : (
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center font-display font-black text-xl bg-amber-400/20 text-amber-400 border-2 border-amber-400/40">
          {miniBrandText}
        </div>
      )}
      {!logos.main && (
        <span className="font-display font-black text-4xl text-white tracking-wide">{brandName}</span>
      )}
    </div>
  );

  // Loading spinner
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#09090b] gap-8">
        <BrandLogo />
        <div className="w-10 h-10 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Empty state — acts as the splash/welcome screen
  if (!loading && visible.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#09090b] px-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-8"
        >
          <BrandLogo />
          <div className="space-y-3">
            <p className="text-xl text-[#a1a1aa] leading-relaxed">
              Open your owner link to join an auction.
            </p>
            <p className="text-base text-[#52525b] leading-relaxed">
              Your tournament operator will send you a unique link.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocation("/join")}
            className="w-full max-w-xs mx-auto flex items-center justify-center gap-2 py-4 px-6 rounded-2xl font-display font-bold text-lg text-black bg-amber-400 active:scale-[0.98] transition-transform"
            style={{ boxShadow: "0 0 32px rgba(245,158,11,0.25)" }}
          >
            <Phone className="w-5 h-5" />
            Join with mobile number
          </button>
          <p className="text-sm text-[#3f3f46] uppercase tracking-widest">
            {poweredByText}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex-shrink-0 border-b border-[#27272a]">
        <div className="flex items-center gap-3 mb-3">
          {logos.mini ? (
            <img src={logos.mini} alt={brandName} className="h-8 w-auto" />
          ) : (
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-sm bg-amber-400/20 text-amber-400 border border-amber-400/30">
              {miniBrandText}
            </div>
          )}
          <span className="font-display font-black text-xl text-white">{brandName}</span>
        </div>
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display font-black text-3xl text-white">Your Auctions</h1>
          <button
            type="button"
            onClick={() => setLocation("/join")}
            className="flex-shrink-0 text-xs font-semibold text-amber-400 border border-amber-400/30 rounded-lg px-2.5 py-1.5 hover:bg-amber-400/10 transition-colors"
          >
            + Join
          </button>
        </div>
        {liveAuctions.length > 0 ? (
          <p className="text-base text-green-400 mt-1 font-semibold">
            {liveAuctions.length === 1 ? "1 auction is live — tap to join" : `${liveAuctions.length} auctions live`}
          </p>
        ) : (
          <p className="text-base text-[#71717a] mt-1">No auctions are live right now</p>
        )}
      </div>

      {/* Auction list */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-6 space-y-4 min-h-0">
        <AnimatePresence>
          {liveAuctions.length > 0 && (
            <>
              <p className="text-sm text-[#52525b] uppercase tracking-widest font-semibold">Live Now</p>
              {liveAuctions.map(s => (
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

          {visible.filter(s => !isLive(states[`${s.tournamentId}-${s.teamId}`])).length > 0 && (
            <>
              <p className="text-sm text-[#52525b] uppercase tracking-widest font-semibold pt-2">Upcoming</p>
              {visible
                .filter(s => !isLive(states[`${s.tournamentId}-${s.teamId}`]))
                .map(s => (
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
        </AnimatePresence>
      </div>

      <p className="text-center text-sm text-[#3f3f46] uppercase tracking-widest pb-5 flex-shrink-0">
        {poweredByText}
      </p>
    </div>
  );
}
