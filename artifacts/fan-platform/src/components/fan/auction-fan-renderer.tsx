import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Gavel,
  Timer,
  Users,
  Trophy,
  History,
  Search,
  CheckCircle2,
  XCircle,
  Pause,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Radio,
  Eye,
  Shield,
  Clock,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { usePolledJson } from "@/lib/api/use-polled-json";
import { cn } from "@/lib/utils";
import { cldUrl } from "@/lib/cloudinary";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export interface AuctionFanRendererProps {
  tournamentId: number;
}

export interface AuctionPlayer {
  id?: number;
  serialNo?: number;
  name?: string;
  role?: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  specialization?: string | null;
  photoUrl?: string | null;
  basePrice?: number | null;
  jerseyNumber?: string | null;
  playerTag?: string | null;
  specifications?: Array<{ groupName: string; value: string }>;
  city?: string | null;
  age?: number | null;
}

export interface PurseRow {
  teamId: number;
  teamName: string;
  shortCode?: string;
  color?: string | null;
  logoUrl?: string | null;
  originalPurse?: number;
  boosterTotal?: number;
  effectiveCapacity?: number;
  purse?: number;
  purseUsed?: number;
  purseRemaining?: number;
  playersBought?: number;
  retainedCount?: number;
  slotsRequired?: number;
  maxAllowedBid?: number;
  topPlayerName?: string | null;
  topPlayerAmount?: number | null;
}

export interface AuctionOutcome {
  type: "sold" | "unsold" | "deferred";
  playerId: number | null;
  playerName: string;
  photoUrl?: string | null;
  teamId?: number | null;
  teamName?: string | null;
  teamColor?: string | null;
  teamLogoUrl?: string | null;
  amount?: number | null;
  basePrice?: number | null;
  role?: string | null;
  city?: string | null;
  age?: number | null;
}

export interface AuctionSnapshot {
  status?: string;
  revision?: number;
  currentPlayer?: AuctionPlayer | null;
  currentBid?: number | null;
  currentBidTeamId?: number | null;
  currentBidTeamName?: string | null;
  currentBidTeamColor?: string | null;
  currentBidTeamLogoUrl?: string | null;
  bidIncrement?: number;
  timerSeconds?: number;
  bidTimerSeconds?: number;
  timerEndsAt?: string | null;
  pausedTimeRemaining?: number | null;
  soldPlayersCount?: number;
  unsoldPlayersCount?: number;
  remainingPlayersCount?: number;
  lastAction?: string | null;
  outcome?: AuctionOutcome | null;
  lastSoldPlayer?: {
    id: number;
    name: string;
    role?: string | null;
    photoUrl?: string | null;
    soldToTeamId?: number;
    soldToTeamName?: string | null;
    soldToTeamColor?: string | null;
    soldAmount?: number;
  } | null;
  displayCountdown?: {
    type: string;
    endsAt: string;
    message: string | null;
  } | null;
  teamPurses?: PurseRow[];
}

export interface TournamentPlayer {
  id: number;
  serialNo?: number;
  name: string;
  role: string | null;
  battingStyle?: string | null;
  bowlingStyle?: string | null;
  specialization?: string | null;
  photoUrl: string | null;
  basePrice: number | null;
  soldPrice: number | null;
  retainedPrice: number | null;
  status: "available" | "sold" | "unsold" | "retained" | "withdrawn" | string;
  teamId: number | null;
  jerseyNumber?: string | null;
  playerTag?: string | null;
  specifications?: Array<{ groupName: string; value: string }>;
  city?: string | null;
  age?: number | null;
}

function inr(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  if (value >= 10000000) {
    return `₹${(value / 10000000).toFixed(2)} Cr`;
  }
  if (value >= 100000) {
    return `₹${(value / 100000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function inrFull(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusLabel(status: string | undefined): string {
  if (status === "active") return "Live Auction";
  if (status === "paused") return "Paused";
  if (status === "completed") return "Completed";
  if (!status || status === "idle") return "Waiting";
  return status;
}

function useSecondsLeft(endsAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [endsAt]);
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  return Math.max(0, Math.ceil(ms / 1000));
}

/**
 * Electrifying Hammer Drop Outcome Result Banner
 * Renders bold SOLD / UNSOLD notification card with player portrait, buyer badge, and winning bid.
 */
export function OutcomeResultCard({
  outcome,
  onDismiss,
}: {
  outcome: AuctionOutcome;
  onDismiss?: () => void;
}) {
  const isSold = outcome.type === "sold";
  const accent = isSold ? (outcome.teamColor || "#22c55e") : "#ef4444";

  return (
    <div
      className="relative overflow-hidden rounded-3xl border-2 p-5 sm:p-7 shadow-2xl transition-all duration-300 animate-in fade-in zoom-in-95"
      style={{
        backgroundColor: isSold ? "rgba(15, 23, 42, 0.95)" : "rgba(30, 10, 10, 0.95)",
        borderColor: accent,
        boxShadow: `0 0 45px ${accent}33`,
      }}
      data-testid="auction-outcome-card"
    >
      {/* Background glow watermark */}
      <div
        className="pointer-events-none absolute -top-12 -right-12 h-64 w-64 rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: accent }}
      />

      <div className="relative flex flex-col md:flex-row items-center gap-5 sm:gap-7">
        {/* Photo Container with dramatic SOLD / UNSOLD stamp badge */}
        <div className="relative shrink-0">
          <div
            className="h-32 w-32 sm:h-40 sm:w-40 rounded-3xl overflow-hidden border-4 flex items-center justify-center bg-slate-900 shadow-xl"
            style={{ borderColor: accent, boxShadow: `0 0 25px ${accent}40` }}
          >
            {outcome.photoUrl ? (
              <img
                src={cldUrl(outcome.photoUrl, "soldCard")}
                alt={outcome.playerName}
                className={`h-full w-full object-cover ${isSold ? "" : "grayscale"}`}
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-500">
                <User className="h-16 w-16" />
                <span className="text-[10px] uppercase font-bold tracking-wider mt-1">No Photo</span>
              </div>
            )}
          </div>

          {/* Stamped badge */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span
              className={`font-display font-black text-xl sm:text-2xl px-3 py-1 rounded-xl border-4 shadow-2xl tracking-widest ${
                isSold
                  ? "bg-emerald-600/95 text-white border-white/60 shadow-emerald-500/50"
                  : "bg-rose-700/95 text-white border-white/60 shadow-rose-500/50"
              }`}
              style={{ transform: "rotate(-12deg)" }}
            >
              {isSold ? "SOLD" : "UNSOLD"}
            </span>
          </div>
        </div>

        {/* Info Column */}
        <div className="flex-1 min-w-0 text-center md:text-left space-y-2.5">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-black uppercase tracking-widest"
            style={{
              backgroundColor: `${accent}20`,
              color: accent,
              border: `1px solid ${accent}40`,
            }}
          >
            <Gavel className="h-3.5 w-3.5" />
            <span>{isSold ? "Hammer Down · Lot Concluded" : "Hammer Down · Unsold"}</span>
          </div>

          <h2 className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight truncate">
            {outcome.playerName}
          </h2>

          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            {outcome.role && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-semibold capitalize">
                {outcome.role}
              </span>
            )}
            {outcome.city && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-400">
                📍 {outcome.city}
              </span>
            )}
            {outcome.age && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-400">
                Age {outcome.age}
              </span>
            )}
            {outcome.basePrice && outcome.basePrice > 0 && (
              <span className="text-xs text-slate-400">
                Base: {inr(outcome.basePrice)}
              </span>
            )}
          </div>

          {isSold ? (
            <div className="pt-2 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 justify-center md:justify-start">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Winning Bid</p>
                <p
                  className="font-display font-black text-3xl sm:text-4xl leading-none text-emerald-400"
                  style={{ textShadow: `0 0 25px ${accent}60` }}
                >
                  {inrFull(outcome.amount ?? 0)}
                </p>
              </div>

              {outcome.teamName && (
                <div
                  className="inline-flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border"
                  style={{
                    backgroundColor: `${accent}15`,
                    borderColor: `${accent}50`,
                  }}
                >
                  {outcome.teamLogoUrl ? (
                    <img
                      src={cldUrl(outcome.teamLogoUrl, "teamLogo")}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span
                      className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-black text-white shrink-0"
                      style={{ background: accent }}
                    >
                      {outcome.teamName.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <div className="text-left">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Acquired By</p>
                    <p className="text-sm font-bold text-white truncate max-w-[160px] sm:max-w-[200px]">{outcome.teamName}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="pt-2">
              <p className="text-xs sm:text-sm text-rose-300 font-medium">
                No winning bids placed. Player returns to the tournament auction pool for re-auction.
              </p>
            </div>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close outcome banner"
            className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 text-slate-400 hover:text-white hover:bg-white/20 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Interactive Team Squad Sheet Modal
 * Displays complete purchased player roster, total purse spent, and squad capacity.
 */
export function TeamSquadDialog({
  isOpen,
  onClose,
  team,
  squad,
  allTeams,
  onSelectTeam,
}: {
  isOpen: boolean;
  onClose: () => void;
  team: PurseRow | null;
  squad: TournamentPlayer[];
  allTeams: PurseRow[];
  onSelectTeam: (teamId: number) => void;
}) {
  if (!team) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-slate-950 text-white border-slate-800 p-0 overflow-hidden rounded-3xl">
        {/* Header */}
        <DialogHeader className="p-5 sm:p-6 border-b border-white/10 bg-gradient-to-r from-slate-900 to-slate-950">
          <div className="flex items-center gap-3">
            {team.logoUrl ? (
              <img
                src={cldUrl(team.logoUrl, "teamLogo")}
                alt=""
                className="h-12 w-12 rounded-2xl object-cover border border-white/20"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-2xl flex items-center justify-center font-display font-black text-sm text-white"
                style={{ background: team.color || "#f59e0b" }}
              >
                {team.shortCode || team.teamName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-xl sm:text-2xl font-black text-white truncate">
                {team.teamName}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Official Auction Roster · {squad.length} {squad.length === 1 ? "Player" : "Players"} Acquired
              </DialogDescription>
            </div>
          </div>

          {/* Quick Team Switching Tabs */}
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {allTeams.map((t) => (
              <button
                key={t.teamId}
                type="button"
                onClick={() => onSelectTeam(t.teamId)}
                className={cn(
                  "flex items-center gap-1.5 shrink-0 px-2.5 py-1 rounded-xl text-xs font-bold transition cursor-pointer",
                  t.teamId === team.teamId
                    ? "bg-amber-500 text-slate-950 font-black shadow"
                    : "bg-white/[0.06] text-slate-300 hover:bg-white/10"
                )}
              >
                <span className="h-2 w-2 rounded-full shrink-0" style={{ background: t.color || "#f59e0b" }} />
                <span>{t.shortCode || t.teamName}</span>
                <span className="text-[10px] opacity-75">({t.playersBought ?? 0})</span>
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-white/[0.02] border-b border-white/10 text-center">
          <div className="rounded-xl bg-white/[0.03] p-2.5">
            <p className="text-[10px] uppercase font-bold text-slate-400">Purse Left</p>
            <p className="font-display font-black text-base text-amber-400">{inr(team.purseRemaining)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-2.5">
            <p className="text-[10px] uppercase font-bold text-slate-400">Purse Spent</p>
            <p className="font-display font-black text-base text-slate-200">{inr(team.purseUsed)}</p>
          </div>
          <div className="rounded-xl bg-white/[0.03] p-2.5">
            <p className="text-[10px] uppercase font-bold text-slate-400">Max Bid Left</p>
            <p className="font-display font-black text-base text-emerald-400">{inr(team.maxAllowedBid)}</p>
          </div>
        </div>

        {/* Squad List */}
        <div className="max-h-[50vh] overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {squad.length > 0 ? (
            <div className="grid gap-2.5 sm:grid-cols-2">
              {squad.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.05]"
                >
                  {player.photoUrl ? (
                    <img
                      src={cldUrl(player.photoUrl, "thumbnail")}
                      alt=""
                      className="h-11 w-11 rounded-xl object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-slate-400">
                      <User className="h-5 w-5 text-slate-500" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate font-bold text-sm text-white">{player.name}</p>
                      {player.playerTag && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {player.playerTag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 capitalize">{player.role || "Squad Member"}</p>
                    <p className="text-xs font-black text-amber-400 mt-0.5">
                      {inr(player.soldPrice || player.retainedPrice || player.basePrice)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center text-slate-400 text-sm">
              <User className="h-10 w-10 mx-auto text-slate-600 mb-2" />
              <p className="font-semibold text-slate-300">No players acquired yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Winning bids from the auction floor will automatically appear here.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AuctionFanRenderer({ tournamentId }: AuctionFanRendererProps) {
  // 1. Polled fallback / initial snapshot
  const { data: polledData, error, loading } = usePolledJson<AuctionSnapshot>(
    tournamentId > 0 ? `/api/tournaments/${tournamentId}/auction` : null,
    3000,
  );

  // 2. Real-time authoritative state (merges polled data + SSE live updates)
  const [liveData, setLiveData] = useState<AuctionSnapshot | null>(null);
  const [isSseConnected, setIsSseConnected] = useState(false);

  // 3. Tournament player pool for squads & lot history
  const [players, setPlayers] = useState<TournamentPlayer[]>([]);

  // 4. Active view tab & UI states
  const [activeView, setActiveView] = useState<"floor" | "purses" | "lots" | "squads">("floor");
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
  const [lotStatusFilter, setLotStatusFilter] = useState<"all" | "sold" | "unsold">("all");
  const [dismissedOutcomePlayerId, setDismissedOutcomePlayerId] = useState<number | null>(null);

  // 5. Squad sheet dialog state
  const [squadModalTeamId, setSquadModalTeamId] = useState<number | null>(null);

  // Keep liveData synced with polled fallback when newer
  useEffect(() => {
    if (polledData) {
      setLiveData((prev) => {
        if (!prev) return polledData;
        if ((polledData.revision ?? 0) >= (prev.revision ?? 0)) {
          return { ...prev, ...polledData };
        }
        return prev;
      });
    }
  }, [polledData]);

  // Fetch auction snapshot directly when needed
  const fetchAuctionState = useCallback(async () => {
    if (!tournamentId || tournamentId <= 0) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/auction`);
      if (res.ok) {
        const json = await res.json();
        setLiveData((prev) => ({ ...(prev || {}), ...json }));
      }
    } catch {
      // ignore
    }
  }, [tournamentId]);

  // Fetch full tournament player pool for squad rosters and completed lots
  const fetchPlayers = useCallback(async () => {
    if (!tournamentId || tournamentId <= 0) return;
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/players`);
      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json)) {
          setPlayers(json);
        }
      }
    } catch {
      // ignore fetch errors
    }
  }, [tournamentId]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  // Real-time SSE Connection to /api/tournaments/:tournamentId/auction/events
  useEffect(() => {
    if (!tournamentId || tournamentId <= 0) return;

    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/tournaments/${tournamentId}/auction/events`);

      es.onopen = () => {
        setIsSseConnected(true);
      };

      es.onmessage = (event) => {
        try {
          if (!event.data || event.data.trim() === ": heartbeat" || event.data.trim() === ": connected") {
            return;
          }
          const payload = JSON.parse(event.data);

          if (payload?.type === "auction_state" && payload?.state) {
            setLiveData((prev) => ({
              ...(prev || {}),
              ...payload.state,
              revision: payload.version ?? payload.state?.revision ?? prev?.revision,
            }));
            fetchPlayers();
          } else if (payload?.type === "bid") {
            setLiveData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                currentBid: payload.currentBid ?? payload.amount ?? prev.currentBid,
                currentBidTeamId: payload.currentBidTeamId ?? payload.teamId ?? prev.currentBidTeamId,
                currentBidTeamName: payload.currentBidTeamName ?? payload.teamName ?? prev.currentBidTeamName,
                currentBidTeamColor: payload.currentBidTeamColor ?? payload.teamColor ?? prev.currentBidTeamColor,
                currentBidTeamLogoUrl: payload.currentBidTeamLogoUrl ?? payload.teamLogoUrl ?? prev.currentBidTeamLogoUrl,
              };
            });
          } else if (payload?.type === "cheer_message") {
            window.dispatchEvent(
              new CustomEvent("bidwar_fan_cheer", {
                detail: {
                  id: `cheer-${payload.timestamp || Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                  supporterLabel: payload.supporterLabel || "FAN SUPPORTERS",
                  message: payload.message || "Cheer!",
                  teamId: payload.teamId,
                  teamName: payload.supporterLabel || "Team",
                  teamColor: payload.teamColor,
                  timestamp: payload.timestamp || Date.now(),
                },
              })
            );
          } else if (payload?.type === "sold" || payload?.type === "unsold") {
            fetchAuctionState();
            fetchPlayers();
          }
        } catch {
          // parse error
        }
      };

      es.onerror = () => {
        setIsSseConnected(false);
      };
    } catch {
      setIsSseConnected(false);
    }

    return () => {
      if (es) {
        es.close();
      }
    };
  }, [tournamentId, fetchPlayers, fetchAuctionState]);

  const data = liveData || polledData;
  const secondsLeft = useSecondsLeft(data?.timerEndsAt);
  const live = data?.status === "active";
  const isPaused = data?.status === "paused";
  const isCompleted = data?.status === "completed";
  const currentPlayer = data?.currentPlayer;

  // Outcome to render (if active and not dismissed)
  const activeOutcome = data?.outcome && data.outcome.playerId !== dismissedOutcomePlayerId ? data.outcome : null;

  // Breakdown & Progress derivation
  const soldCount = data?.soldPlayersCount ?? players.filter((p) => p.status === "sold" || p.status === "retained").length;
  const unsoldCount = data?.unsoldPlayersCount ?? players.filter((p) => p.status === "unsold").length;
  const remainingCount = data?.remainingPlayersCount ?? players.filter((p) => p.status === "available").length;
  const totalLots = soldCount + unsoldCount + remainingCount || players.length || 1;
  const completedLots = soldCount + unsoldCount;
  const progressPercent = Math.min(100, Math.round((completedLots / totalLots) * 100));

  // Team lookup map
  const teamPurses = data?.teamPurses || [];
  const teamMap = useMemo(() => {
    const map = new Map<number, PurseRow>();
    for (const t of teamPurses) {
      map.set(t.teamId, t);
    }
    return map;
  }, [teamPurses]);

  // Team-wise purchased players list
  const teamPurchasedPlayers = useMemo(() => {
    const map = new Map<number, TournamentPlayer[]>();
    for (const p of players) {
      if ((p.status === "sold" || p.status === "retained") && p.teamId != null) {
        const list = map.get(p.teamId) || [];
        list.push(p);
        map.set(p.teamId, list);
      }
    }
    return map;
  }, [players]);

  // Completed lots history (Sold & Unsold)
  const completedLotsList = useMemo(() => {
    return players
      .filter((p) => p.status === "sold" || p.status === "unsold" || p.status === "retained")
      .sort((a, b) => (b.serialNo ?? 0) - (a.serialNo ?? 0));
  }, [players]);

  // Top Buys Leaderboard for Completed Summary & Analytics
  const topBuys = useMemo(() => {
    return players
      .filter((p) => (p.status === "sold" || p.status === "retained") && p.soldPrice && p.soldPrice > 0)
      .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0))
      .slice(0, 5);
  }, [players]);

  // Total money spent across all teams
  const totalMoneySpent = useMemo(() => {
    return teamPurses.reduce((acc, t) => acc + (t.purseUsed ?? 0), 0);
  }, [teamPurses]);

  // Selected team squad for inspector view
  const currentSelectedTeam = selectedTeamId ? teamMap.get(selectedTeamId) : null;
  const currentSelectedSquad = selectedTeamId ? teamPurchasedPlayers.get(selectedTeamId) || [] : [];

  // Squad modal target team & players
  const modalTargetTeam = squadModalTeamId ? teamMap.get(squadModalTeamId) ?? null : null;
  const modalTargetSquad = squadModalTeamId ? teamPurchasedPlayers.get(squadModalTeamId) || [] : [];

  if (!tournamentId || tournamentId <= 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-[#131B2E]">
        <AlertCircle className="mx-auto h-10 w-10 text-amber-500 mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">Auction Unavailable</h3>
        <p className="mt-1 text-sm text-slate-500">The auction module for this tournament is not configured or offline.</p>
      </div>
    );
  }

  if (loading && !data && players.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center dark:border-white/10 dark:bg-[#131B2E]">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-amber-500 border-t-transparent mb-4" />
        <h3 className="text-base font-bold text-slate-900 dark:text-white">Connecting to the Live Auction Floor…</h3>
        <p className="mt-1 text-xs text-slate-500">Retrieving official team purses and player lots</p>
      </div>
    );
  }

  if (error && !data && players.length === 0) {
    return (
      <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-8 text-center text-sm text-red-600 dark:text-red-400">
        <AlertCircle className="mx-auto h-8 w-8 mb-2" />
        <p className="font-semibold">{error}</p>
        <button
          onClick={() => {
            fetchAuctionState();
            fetchPlayers();
          }}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-red-700 transition"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6" data-testid="auction-fan-renderer">
      {/* ── Sub-Navigation Bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3 dark:border-white/10">
        <div className="flex items-center gap-1.5 overflow-x-auto p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.04]">
          <button
            type="button"
            onClick={() => setActiveView("floor")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeView === "floor"
                ? "bg-white text-slate-900 shadow-sm dark:bg-amber-500 dark:text-slate-950 font-black"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Gavel className="h-3.5 w-3.5" />
            <span>Auction Floor</span>
            {live && <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />}
          </button>

          <button
            type="button"
            onClick={() => setActiveView("purses")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeView === "purses"
                ? "bg-white text-slate-900 shadow-sm dark:bg-amber-500 dark:text-slate-950 font-black"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Team Purses ({teamPurses.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!selectedTeamId && teamPurses[0]) {
                setSelectedTeamId(teamPurses[0].teamId);
              }
              setActiveView("squads");
            }}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeView === "squads"
                ? "bg-white text-slate-900 shadow-sm dark:bg-amber-500 dark:text-slate-950 font-black"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Team Squads</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveView("lots")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              activeView === "lots"
                ? "bg-white text-slate-900 shadow-sm dark:bg-amber-500 dark:text-slate-950 font-black"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span>Lot History ({completedLots})</span>
          </button>
        </div>

        {/* Live SSE status indicator */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase",
              isSseConnected
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:text-emerald-400"
                : "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400"
            )}
          >
            <Radio className={cn("h-3 w-3", isSseConnected && "text-emerald-500 animate-pulse")} />
            {isSseConnected ? "Live Sync Active" : "Polled Sync"}
          </span>

          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider",
              live
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse"
                : isPaused
                ? "bg-amber-500 text-slate-950 font-black"
                : isCompleted
                ? "bg-emerald-600 text-white"
                : "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-300"
            )}
          >
            {statusLabel(data?.status)}
          </span>
        </div>
      </div>

      {/* ── Main Auction Floor View ───────────────────────────────────── */}
      {activeView === "floor" && (
        <>
          {/* HAMMER DROP OUTCOME BANNER (SOLD / UNSOLD) */}
          {activeOutcome && (
            <OutcomeResultCard
              outcome={activeOutcome}
              onDismiss={() => {
                if (activeOutcome.playerId) {
                  setDismissedOutcomePlayerId(activeOutcome.playerId);
                }
              }}
            />
          )}

          {/* PAUSED BANNER */}
          {isPaused && (
            <div className="flex items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/15 p-4 text-amber-900 dark:text-amber-200">
              <Pause className="h-6 w-6 text-amber-500 shrink-0" />
              <div>
                <p className="font-bold text-sm">Auction Floor Paused</p>
                <p className="text-xs text-amber-800 dark:text-amber-300">
                  The auctioneer has temporarily paused bidding. All current lots and purse balances are preserved.
                  {data?.pausedTimeRemaining ? ` Resumes in approximately ${data.pausedTimeRemaining}s.` : ""}
                </p>
              </div>
            </div>
          )}

          {/* DISPLAY COUNTDOWN / INTERMISSION BANNER */}
          {data?.displayCountdown && (
            <div className="flex items-center justify-between rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 text-sky-900 dark:text-sky-200">
              <div className="flex items-center gap-2.5">
                <Clock className="h-5 w-5 text-sky-500" />
                <div>
                  <p className="text-xs uppercase font-bold text-sky-600 dark:text-sky-400">Scheduled Break</p>
                  <p className="font-bold text-sm">{data.displayCountdown.message || "Intermission in Progress"}</p>
                </div>
              </div>
              <div className="rounded-xl bg-sky-500/20 px-3 py-1 font-mono text-sm font-black text-sky-700 dark:text-sky-300">
                Resuming Shortly
              </div>
            </div>
          )}

          {/* COMPLETED DASHBOARD */}
          {isCompleted && (
            <section className="rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 p-6 text-white shadow-xl sm:p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <Trophy className="h-6 w-6" />
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black text-white sm:text-3xl">Auction Concluded</h2>
                  <p className="text-xs text-emerald-300/80">All scheduled player lots have been finalized.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Spent</p>
                  <p className="mt-1 font-display text-2xl font-black text-amber-400">{inr(totalMoneySpent)}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Players Sold</p>
                  <p className="mt-1 font-display text-2xl font-black text-emerald-400">{soldCount}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Unsold Lots</p>
                  <p className="mt-1 font-display text-2xl font-black text-slate-400">{unsoldCount}</p>
                </div>
                <div className="rounded-2xl bg-white/[0.04] border border-white/10 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Teams</p>
                  <p className="mt-1 font-display text-2xl font-black text-sky-400">{teamPurses.length}</p>
                </div>
              </div>

              {/* Top Buys Podium */}
              {topBuys.length > 0 && (
                <div>
                  <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wider">
                    <Sparkles className="h-4 w-4" /> Top Buys of the Auction
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {topBuys.map((p, idx) => {
                      const buyerTeam = p.teamId ? teamMap.get(p.teamId) : null;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center gap-3 rounded-2xl bg-white/[0.03] border border-white/10 p-3"
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-xs font-black text-amber-300">
                            #{idx + 1}
                          </span>
                          {p.photoUrl ? (
                            <img
                              src={cldUrl(p.photoUrl, "thumbnail")}
                              alt={p.name}
                              className="h-12 w-12 rounded-xl object-cover border border-white/10"
                            />
                          ) : (
                            <div className="flex h-12 w-12 rounded-xl bg-slate-800 items-center justify-center text-sm font-bold text-slate-300">
                              <User className="h-6 w-6 text-slate-500" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-white">{p.name}</p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {buyerTeam ? buyerTeam.teamName : p.role || "Player"}
                            </p>
                            <p className="text-xs font-black text-amber-400">{inr(p.soldPrice)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── CURRENT PLAYER LOT (HERO HAMMER STAGE) ────────────────── */}
          {currentPlayer ? (
            <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-lg transition-all dark:border-white/10 dark:bg-[#131B2E] sm:p-7">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
                  <Gavel className="h-3.5 w-3.5" />
                  <span>On The Hammer · Lot #{currentPlayer.serialNo || currentPlayer.id}</span>
                </div>

                {secondsLeft != null && live && (
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider transition-all",
                      secondsLeft <= 5
                        ? "bg-red-500 text-white animate-bounce shadow-md shadow-red-500/40"
                        : "bg-slate-100 text-slate-800 dark:bg-white/10 dark:text-amber-300"
                    )}
                  >
                    <Timer className="h-4 w-4" />
                    <span>{secondsLeft}s Remaining</span>
                  </div>
                )}
              </div>

              <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
                {/* Left: Player Profile & Artwork */}
                <div className="flex flex-col sm:flex-row gap-5">
                  {/* Photo with fallback avatar */}
                  <div className="relative shrink-0 mx-auto sm:mx-0">
                    {currentPlayer.photoUrl ? (
                      <img
                        src={cldUrl(currentPlayer.photoUrl, "soldCard")}
                        alt={currentPlayer.name || "Player"}
                        className="h-36 w-36 sm:h-44 sm:w-44 rounded-3xl object-cover border-2 border-amber-500/30 shadow-md"
                      />
                    ) : (
                      <div className="flex h-36 w-36 sm:h-44 sm:w-44 rounded-3xl bg-gradient-to-br from-amber-500/20 to-slate-800 border-2 border-amber-500/30 items-center justify-center font-display text-4xl font-black text-amber-400 shadow-md">
                        <User className="h-16 w-16 text-amber-400/50" />
                      </div>
                    )}

                    {currentPlayer.jerseyNumber && (
                      <span className="absolute bottom-2 right-2 rounded-xl bg-slate-950/90 px-2 py-0.5 text-xs font-mono font-black text-amber-400 border border-white/10 shadow">
                        #{currentPlayer.jerseyNumber}
                      </span>
                    )}
                  </div>

                  {/* Player Specs */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {currentPlayer.playerTag && (
                        <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300">
                          {currentPlayer.playerTag.replace("_", " ")}
                        </span>
                      )}
                      {currentPlayer.city && (
                        <span className="text-xs text-slate-400 font-medium">📍 {currentPlayer.city}</span>
                      )}
                    </div>

                    <h2 className="font-display text-2xl sm:text-3xl font-black text-slate-900 dark:text-white truncate">
                      {currentPlayer.name || "Next Player"}
                    </h2>

                    {currentPlayer.role && (
                      <p className="mt-1 text-sm font-semibold capitalize text-amber-600 dark:text-amber-400">
                        {currentPlayer.role}
                      </p>
                    )}

                    {/* Detailed Cricket/Sport Specs */}
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {currentPlayer.battingStyle && (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                          🏏 {currentPlayer.battingStyle}
                        </span>
                      )}
                      {currentPlayer.bowlingStyle && (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                          🎯 {currentPlayer.bowlingStyle}
                        </span>
                      )}
                      {currentPlayer.specialization && (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-white/[0.05] dark:text-slate-300">
                          ⭐ {currentPlayer.specialization}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span>Base Price: <strong className="text-slate-900 dark:text-white font-bold">{inr(currentPlayer.basePrice)}</strong></span>
                      {data?.bidIncrement && (
                        <span>Next Step: <strong className="text-amber-600 dark:text-amber-400 font-bold">+{inr(data.bidIncrement)}</strong></span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Live Bidding Console (Read-Only) */}
                <div className="flex flex-col justify-between rounded-3xl bg-slate-950 p-6 text-white shadow-xl dark:bg-black/50 border border-white/10">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-amber-400">
                      <span>Current Hammer Bid</span>
                      {data?.currentBidTeamName && (
                        <span className="inline-flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" /> High Bidder
                        </span>
                      )}
                    </div>

                    <p className="mt-2 font-display text-4xl sm:text-5xl font-black text-amber-400 tracking-tight">
                      {inrFull(data?.currentBid || currentPlayer.basePrice)}
                    </p>

                    {/* Leading Bidder Showcase */}
                    {data?.currentBidTeamName ? (
                      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.06] border border-white/10 p-3">
                        {data.currentBidTeamLogoUrl ? (
                          <img
                            src={cldUrl(data.currentBidTeamLogoUrl, "teamLogo")}
                            alt={data.currentBidTeamName}
                            className="h-9 w-9 rounded-full object-cover border border-white/20"
                          />
                        ) : (
                          <span
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                            style={{ background: data.currentBidTeamColor || "#f59e0b" }}
                          >
                            {data.currentBidTeamName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Leading Bid Team</p>
                          <p className="truncate text-sm font-bold text-white">{data.currentBidTeamName}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 rounded-2xl bg-white/[0.03] border border-white/5 p-3 text-xs text-slate-400">
                        Waiting for opening bid from team owners…
                      </div>
                    )}
                  </div>

                  {/* Read-Only Spectator Pill */}
                  <div className="mt-5 border-t border-white/10 pt-3 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-amber-500" />
                      Public Live Spectator Stream
                    </span>
                    <span className="font-bold text-slate-300">Read-Only</span>
                  </div>
                </div>
              </div>
            </section>
          ) : !isCompleted && !activeOutcome ? (
            /* BETWEEN LOTS / WAITING HOLDING CARD */
            <section className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 border border-amber-500/30 mb-3">
                <Gavel className="h-7 w-7 animate-pulse" />
              </div>
              <h3 className="font-display text-xl font-black text-slate-900 dark:text-white">
                {live ? "Preparing Next Player Lot…" : "Auction Floor Ready"}
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs sm:text-sm text-slate-500">
                {live
                  ? "The auctioneer is bringing up the next player lot. Live bids will appear automatically."
                  : "The tournament auction has not commenced yet. As soon as the auctioneer opens the first lot, bids and team purse actions will update here."}
              </p>
            </section>
          ) : null}

          {/* ── LAST SOLD PLAYER ALERT ─────────────────────────────────── */}
          {data?.lastSoldPlayer?.name && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-200 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs">
                  ✓
                </span>
                <span>
                  Previous Lot Sold: <strong className="font-black text-emerald-950 dark:text-white">{data.lastSoldPlayer.name}</strong>
                  {data.lastSoldPlayer.soldToTeamName ? ` to ${data.lastSoldPlayer.soldToTeamName}` : ""}
                </span>
              </div>
              {data.lastSoldPlayer.soldAmount != null && (
                <span className="font-display font-black text-emerald-800 dark:text-emerald-300">
                  {inr(data.lastSoldPlayer.soldAmount)}
                </span>
              )}
            </div>
          )}

          {/* ── PROGRESS & LOT SUMMARY ─────────────────────────────────── */}
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
            <div className="mb-3 flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Auction Progress: {completedLots} of {totalLots} lots ({progressPercent}%)
              </span>
              <span className="text-slate-400">{remainingCount} lots remaining</span>
            </div>

            {/* Multi-segment progress bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10 flex">
              <div
                style={{ width: `${totalLots > 0 ? (soldCount / totalLots) * 100 : 0}%` }}
                className="h-full bg-emerald-500 transition-all duration-500"
                title={`Sold: ${soldCount}`}
              />
              <div
                style={{ width: `${totalLots > 0 ? (unsoldCount / totalLots) * 100 : 0}%` }}
                className="h-full bg-rose-500 transition-all duration-500"
                title={`Unsold: ${unsoldCount}`}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Sold</p>
                <p className="font-display text-2xl font-black text-emerald-900 dark:text-white">{soldCount}</p>
              </div>
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">Unsold</p>
                <p className="font-display text-2xl font-black text-rose-900 dark:text-white">{unsoldCount}</p>
              </div>
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">Remaining</p>
                <p className="font-display text-2xl font-black text-amber-900 dark:text-white">{remainingCount}</p>
              </div>
            </div>
          </section>

          {/* ── QUICK TEAM PURSES PREVIEW ──────────────────────────────── */}
          {teamPurses.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <Users className="h-4 w-4 text-amber-500" />
                  Team Purses & Squad Status
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (teamPurses[0]) {
                      setSquadModalTeamId(teamPurses[0].teamId);
                    }
                  }}
                  className="text-xs font-bold text-amber-500 hover:text-amber-400 transition cursor-pointer"
                >
                  View All Squads Sheet →
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teamPurses.map((team) => (
                  <article
                    key={team.teamId}
                    onClick={() => {
                      setSquadModalTeamId(team.teamId);
                    }}
                    className="group cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-amber-500/50 hover:shadow-md dark:border-white/10 dark:bg-[#131B2E]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {team.logoUrl ? (
                          <img
                            src={cldUrl(team.logoUrl, "teamLogo")}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ background: team.color || "#f59e0b" }}
                          />
                        )}
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-500 transition">
                          {team.teamName}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                    </div>

                    <div className="mt-3 flex items-baseline justify-between border-t border-slate-100 pt-2 text-xs dark:border-white/5">
                      <span className="text-slate-500">Purse Left:</span>
                      <strong className="font-display font-black text-amber-600 dark:text-amber-400 text-sm">
                        {inr(team.purseRemaining)}
                      </strong>
                    </div>

                    <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                      <span>{team.playersBought ?? 0} {(team.playersBought ?? 0) === 1 ? "Player" : "Players"} Bought</span>
                      <span className="text-amber-600 dark:text-amber-400 font-semibold group-hover:underline">
                        Open Squad Sheet
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* ── VIEW 2: TEAM PURSES DETAILED BREAKDOWN ────────────────────── */}
      {activeView === "purses" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-amber-500" />
              Official Team Purses & Spending
            </h3>
            <span className="text-xs text-slate-400">Total Teams: {teamPurses.length}</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teamPurses.map((team) => {
              const boughtCount = team.playersBought ?? 0;
              const totalBudget = team.effectiveCapacity || team.purse || team.originalPurse || 1;
              const used = team.purseUsed ?? 0;
              const remaining = team.purseRemaining ?? (totalBudget - used);
              const spentPercent = Math.min(100, Math.round((used / totalBudget) * 100));
              const hasBooster = Boolean(team.boosterTotal && team.boosterTotal > 0);

              return (
                <div
                  key={team.teamId}
                  className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-amber-500/40 dark:border-white/10 dark:bg-[#131B2E]"
                >
                  <div className="flex items-center gap-3">
                    {team.logoUrl ? (
                      <img
                        src={cldUrl(team.logoUrl, "teamLogo")}
                        alt=""
                        className="h-10 w-10 rounded-2xl object-cover border border-white/10"
                      />
                    ) : (
                      <div
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black text-white"
                        style={{ background: team.color || "#f59e0b" }}
                      >
                        {team.shortCode || team.teamName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-display font-bold text-base text-slate-900 dark:text-white">
                        {team.teamName}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {boughtCount} {boughtCount === 1 ? "Player" : "Players"} Bought
                      </p>
                    </div>
                  </div>

                  <div className="my-4 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold text-slate-500">Purse Remaining</span>
                      <span className="font-display text-xl font-black text-amber-500">
                        {inr(remaining)}
                      </span>
                    </div>

                    {/* Purse spent bar */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
                      <div
                        style={{ width: `${spentPercent}%` }}
                        className="h-full bg-amber-500 rounded-full"
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                      <span>Spent: {inr(used)}</span>
                      <span>
                        Total: {inr(totalBudget)}
                        {hasBooster && (
                          <span className="ml-1 text-[9px] text-amber-500 font-semibold" title={`Base ${inr(team.originalPurse)} + Booster ${inr(team.boosterTotal)}`}>
                            (incl. booster)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 border-t border-slate-100 pt-3 text-xs dark:border-white/5">
                    <div className="flex justify-between text-slate-600 dark:text-slate-300">
                      <span>Max Allowed Bid:</span>
                      <strong>{inr(team.maxAllowedBid)}</strong>
                    </div>
                    {team.topPlayerName && (
                      <div className="flex justify-between text-slate-600 dark:text-slate-300">
                        <span className="truncate">Top Buy ({team.topPlayerName}):</span>
                        <strong className="text-emerald-500">{inr(team.topPlayerAmount)}</strong>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSquadModalTeamId(team.teamId);
                    }}
                    className="mt-4 w-full rounded-xl bg-slate-100 py-2 text-center text-xs font-bold text-slate-700 transition hover:bg-amber-500 hover:text-slate-950 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-amber-500 dark:hover:text-slate-950 cursor-pointer"
                  >
                    Inspect Bought Squad ({boughtCount}) →
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── VIEW 3: TEAM-WISE PURCHASED PLAYERS (SQUADS) ────────────── */}
      {activeView === "squads" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-amber-500" />
                Team Roster & Squad Inspector
              </h3>
              <p className="text-xs text-slate-400">Select any team to view their purchased players</p>
            </div>

            {/* Team selector pills */}
            <div className="flex flex-wrap gap-1.5">
              {teamPurses.map((t) => (
                <button
                  key={t.teamId}
                  type="button"
                  onClick={() => setSelectedTeamId(t.teamId)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-bold transition cursor-pointer",
                    selectedTeamId === t.teamId
                      ? "bg-amber-500 text-slate-950 font-black shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10"
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color || "#f59e0b" }} />
                  <span>{t.shortCode || t.teamName}</span>
                  <span className="text-[10px] opacity-75">({t.playersBought ?? 0})</span>
                </button>
              ))}
            </div>
          </div>

          {currentSelectedTeam ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-[#131B2E]">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-white/5">
                <div className="flex items-center gap-3">
                  {currentSelectedTeam.logoUrl ? (
                    <img
                      src={cldUrl(currentSelectedTeam.logoUrl, "teamLogo")}
                      alt=""
                      className="h-10 w-10 rounded-2xl object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xs font-black text-white"
                      style={{ background: currentSelectedTeam.color || "#f59e0b" }}
                    >
                      {currentSelectedTeam.shortCode || currentSelectedTeam.teamName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="font-display font-black text-lg text-slate-900 dark:text-white">
                      {currentSelectedTeam.teamName}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {currentSelectedSquad.length} {currentSelectedSquad.length === 1 ? "Player" : "Players"} in Roster · Purse Left: {inr(currentSelectedTeam.purseRemaining)}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Total Spent</p>
                  <p className="font-display text-lg font-black text-amber-500">{inr(currentSelectedTeam.purseUsed)}</p>
                </div>
              </div>

              {currentSelectedSquad.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {currentSelectedSquad.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3 dark:border-white/5 dark:bg-white/[0.02]"
                    >
                      {player.photoUrl ? (
                        <img
                          src={cldUrl(player.photoUrl, "thumbnail")}
                          alt=""
                          className="h-12 w-12 rounded-xl object-cover border border-white/10"
                        />
                      ) : (
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-slate-300">
                          <User className="h-6 w-6 text-slate-500" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate font-bold text-sm text-slate-900 dark:text-white">{player.name}</p>
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                            {player.status === "retained" ? "Retained" : "Bought"}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 capitalize">{player.role || "Squad Player"}</p>
                        <p className="text-xs font-black text-amber-600 dark:text-amber-400 mt-0.5">
                          {inr(player.soldPrice || player.retainedPrice || player.basePrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500">
                  This team has not acquired any players under the hammer yet.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-[#131B2E]">
              Please choose a team above to view their squad details.
            </div>
          )}
        </section>
      )}

      {/* ── VIEW 4: LOT HISTORY & COMPLETED FEED ───────────────────────── */}
      {activeView === "lots" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <History className="h-5 w-5 text-amber-500" />
                Completed Lots & Auction Stream
              </h3>
              <p className="text-xs text-slate-400">Chronological activity of concluded player lots</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLotStatusFilter("all")}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer transition",
                  lotStatusFilter === "all"
                    ? "bg-amber-500 text-slate-950 font-black"
                    : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                )}
              >
                All ({completedLotsList.length})
              </button>
              <button
                type="button"
                onClick={() => setLotStatusFilter("sold")}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer transition",
                  lotStatusFilter === "sold"
                    ? "bg-emerald-500 text-white font-black"
                    : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                )}
              >
                Sold ({soldCount})
              </button>
              <button
                type="button"
                onClick={() => setLotStatusFilter("unsold")}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-bold cursor-pointer transition",
                  lotStatusFilter === "unsold"
                    ? "bg-rose-500 text-white font-black"
                    : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300"
                )}
              >
                Unsold ({unsoldCount})
              </button>
            </div>
          </div>

          {completedLotsList.length > 0 ? (
            <div className="space-y-2">
              {completedLotsList
                .filter((p) => {
                  if (lotStatusFilter === "sold") return p.status === "sold" || p.status === "retained";
                  if (lotStatusFilter === "unsold") return p.status === "unsold";
                  return true;
                })
                .map((player) => {
                  const buyer = player.teamId ? teamMap.get(player.teamId) : null;
                  const isSold = player.status === "sold" || player.status === "retained";

                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-amber-500/30 dark:border-white/10 dark:bg-[#131B2E]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {player.photoUrl ? (
                          <img
                            src={cldUrl(player.photoUrl, "thumbnail")}
                            alt=""
                            className="h-10 w-10 rounded-xl object-cover border border-white/10"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-xs font-bold text-slate-300">
                            <User className="h-5 w-5 text-slate-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-bold text-sm text-slate-900 dark:text-white">{player.name}</p>
                            {player.serialNo && (
                              <span className="text-[10px] font-mono text-slate-400">Lot #{player.serialNo}</span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 capitalize">{player.role || "Player"}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-right">
                        {isSold ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" /> SOLD
                            </span>
                            <p className="font-display font-black text-sm text-slate-900 dark:text-white">
                              {inr(player.soldPrice || player.retainedPrice || player.basePrice)}
                            </p>
                            {buyer && (
                              <p className="text-[11px] text-slate-500 truncate max-w-[130px]">to {buyer.teamName}</p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase text-rose-600 dark:text-rose-400">
                              <XCircle className="h-3 w-3" /> UNSOLD
                            </span>
                            <p className="text-xs text-slate-400">Base {inr(player.basePrice)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center text-xs text-slate-500 dark:border-white/10 dark:bg-[#131B2E]">
              No auction lots have concluded yet. Finished results will automatically flow here.
            </div>
          )}
        </section>
      )}

      {/* ── INTERACTIVE SQUAD SHEET DIALOG ────────────────────────────── */}
      <TeamSquadDialog
        isOpen={squadModalTeamId != null}
        onClose={() => setSquadModalTeamId(null)}
        team={modalTargetTeam}
        squad={modalTargetSquad}
        allTeams={teamPurses}
        onSelectTeam={(teamId) => setSquadModalTeamId(teamId)}
      />
    </div>
  );
}

export default AuctionFanRenderer;
