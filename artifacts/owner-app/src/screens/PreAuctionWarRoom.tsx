import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  BarChart3,
  Bookmark,
  Star,
  CheckCircle2,
  ChevronRight,
  Wallet,
  DollarSign,
  History,
  ArrowLeft,
  X,
  AlertCircle,
  Search,
  Plus,
  ShieldUser,
} from "lucide-react";
import {
  useListPlayers,
  getListPlayersQueryKey,
  useGetTeamScout,
  getGetTeamScoutQueryKey,
  useListTeams,
  getListTeamsQueryKey,
} from "@workspace/api-client-react";
import { formatIndianRupee, formatShortIndianRupee, resolveAuctionUnit } from "@/lib/format";
import { isOwnerAppHistoryEnabled } from "@workspace/api-base/tournament-features";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerTagBadge } from "@/components/PlayerTagBadge";
import { useBranding } from "@/hooks/useBranding";
import { resolveHeaderBrandLogoUrl } from "@/lib/brand-assets";
import { useOwnerTargets } from "@/lib/owner-targets";
import { OwnerPlayerAuctionHistory } from "@/components/OwnerPlayerAuctionHistory";
import {
  isRecognizedRole,
  normalizeSportRole,
  getSportBlueprintRules,
  calculatePurseDistribution40_40_20,
  computeDraftPoolScarcity,
  computeBudgetSimulation,
} from "@/lib/war-room-engine";

interface TeamProps {
  id: number;
  name: string;
  shortCode?: string | null;
  color?: string | null;
  logoUrl?: string | null;
  purse: number;
  purseUsed?: number;
}

interface TeamPurseProps {
  teamId: number;
  originalPurse?: number;
  boosterTotal?: number;
  effectiveCapacity?: number;
  purseRemaining: number;
  spendablePurse: number;
  playersBought?: number;
  purseUsed?: number;
  reservePurse?: number;
  futureReservePurse?: number;
  futureSlotsRequired?: number;
  slotsRequired?: number;
  maxAllowedBid?: number;
  lowestBasePrice?: number;
}

interface TournamentProps {
  id?: number;
  name?: string;
  sport?: string | null;
  auctionUnit?: string | null;
  auctionDate?: string | null;
  minimumSquadSize?: number | null;
  maximumSquadSize?: number | null;
  minBidIncrement?: number | null;
  basePrice?: number | null;
  features?: any;
}

export interface PreAuctionWarRoomProps {
  tournamentId: number;
  teamId: number;
  team: TeamProps;
  teamPurse: TeamPurseProps | null;
  tournament?: TournamentProps | null;
  onBack: () => void;
  auctionStarted?: boolean;
  returnLabel?: string;
}

type WarRoomTab = "scarcity" | "targets" | "blueprint";

function PlayerHistoryToggleButton({
  tournamentId,
  playerId,
  isExpanded,
  onToggle,
  features,
}: {
  tournamentId: number;
  playerId: number;
  isExpanded: boolean;
  onToggle: () => void;
  features?: any;
}) {
  const isEnabled = isOwnerAppHistoryEnabled(features);
  const { data } = useQuery<{ records?: any[] }>({
    queryKey: ["player-auction-history", tournamentId, playerId],
    queryFn: async () => {
      if (!playerId || !tournamentId) return null;
      const res = await fetch(
        `/api/tournaments/${tournamentId}/players/${playerId}/auction-history`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: Boolean(isEnabled && tournamentId && playerId),
    staleTime: 5 * 60 * 1000,
  });

  // Only show the history button if this player actually has auction history records!
  if (!isEnabled || !data || !Array.isArray(data.records) || data.records.length === 0) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`p-2 rounded-lg border transition-all active:scale-95 cursor-pointer text-xs ${
        isExpanded
          ? "bg-amber-400/20 border-amber-400 text-amber-300"
          : "bg-[#141A24] text-[#94A3B8] hover:text-white border-white/10"
      }`}
      title="Toggle Player Auction History"
    >
      <History className="w-4 h-4" />
    </button>
  );
}

export function PreAuctionWarRoom({
  tournamentId,
  teamId,
  team,
  teamPurse,
  tournament,
  onBack,
  auctionStarted = false,
  returnLabel,
}: PreAuctionWarRoomProps) {
  const [tab, setTab] = useState<WarRoomTab>("scarcity");
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [expandedHistoryPlayerId, setExpandedHistoryPlayerId] = useState<number | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const teamColor = team.color || "#F59E0B";
  const { brandName, logos, iconVersion } = useBranding();
  const brandLogoSrc = resolveHeaderBrandLogoUrl(logos, iconVersion);

  const { targetIds, toggleTarget, isTarget } = useOwnerTargets(tournamentId, teamId);

  // Scroll to top when tab changes
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
  }, [tab]);

  // Keyboard navigation: Escape to exit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onBack]);

  // Query tournament players pool
  const { data: allPlayers } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 10_000,
    },
  });

  // Query tournament scouting intelligence
  const { data: scoutData } = useGetTeamScout(tournamentId, {
    query: {
      queryKey: getGetTeamScoutQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 20_000,
    },
  });

  // Query list of teams
  const { data: teamsList } = useListTeams(tournamentId, {
    query: {
      queryKey: getListTeamsQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 60_000,
    },
  });

  const sportName = tournament?.sport || "Cricket";
  const displaySportName = sportName
    ? sportName.charAt(0).toUpperCase() + sportName.slice(1).toLowerCase()
    : "Cricket";
  const unit = resolveAuctionUnit(tournament?.auctionUnit);
  const totalPurse = teamPurse?.effectiveCapacity ?? teamPurse?.originalPurse ?? team.purse;
  const purseRemaining = teamPurse?.purseRemaining ?? team.purse;
  const playersBought = teamPurse?.playersBought ?? 0;
  const minSquad = tournament?.minimumSquadSize ?? 11;
  const remainingMandatorySlots =
    teamPurse?.slotsRequired ??
    Math.max(0, minSquad - playersBought);

  const teamsCount = Math.max(1, teamsList?.length || scoutData?.teams?.length || 8);
  const minBasePrice = tournament?.basePrice ?? teamPurse?.lowestBasePrice ?? 100000;

  const isCricket11 = sportName.toLowerCase().includes("cricket") && minSquad >= 11;
  const mainTeamLabel = isCricket11 ? "Starting XI" : "Starting Squad";

  // 40-40-20 Purse Distribution Rule calculations
  const {
    anchorStars: purseAnchorStars,
    coreXI: purseCoreXI,
    valueBench: purseValueBench,
  } = useMemo(() => calculatePurseDistribution40_40_20(totalPurse), [totalPurse]);

  // Available players pool in tournament
  const availablePlayers = useMemo(() => {
    return (allPlayers ?? []).filter(
      (p) => p.status === "available" || !p.status || p.status === "unsold"
    );
  }, [allPlayers]);

  // My current acquired players
  const myRoster = useMemo(() => {
    return (allPlayers ?? []).filter(
      (p) => p.teamId === teamId && (p.status === "sold" || p.status === "retained")
    );
  }, [allPlayers, teamId]);

  // Current team role counts
  const currentRoleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of myRoster) {
      if (p.isNonPlayingMember) continue;
      const norm = normalizeSportRole(p.role, sportName);
      counts[norm] = (counts[norm] || 0) + 1;
    }
    return counts;
  }, [myRoster, sportName]);

  // Sport squad blueprint definitions
  const blueprintRules = useMemo(() => {
    return getSportBlueprintRules(sportName);
  }, [sportName]);

  // Scaled squad blueprint for small/box tournaments
  const adaptiveBlueprintRules = useMemo(() => {
    const baseRules = getSportBlueprintRules(sportName);
    if (minSquad >= 11) return baseRules;
    const scale = minSquad / 11;
    return baseRules.map((r) => {
      const min = Math.max(1, Math.round(r.min * scale));
      const max = Math.max(min, Math.round(r.max * scale));
      return { ...r, min, max };
    });
  }, [sportName, minSquad]);

  // Scarcity calculations
  const scarcityAlerts = useMemo(() => {
    return computeDraftPoolScarcity({
      availablePlayers,
      teamsCount,
      sportName,
      blueprintRules,
    });
  }, [availablePlayers, teamsCount, sportName, blueprintRules]);

  // Target shortlist
  const targetedPlayers = useMemo(() => {
    return (allPlayers ?? []).filter((p) => targetIds.includes(p.id));
  }, [allPlayers, targetIds]);

  const targetedAvailable = useMemo(() => {
    return targetedPlayers.filter(
      (p) => p.status === "available" || !p.status || p.status === "unsold"
    );
  }, [targetedPlayers]);

  // Live Budget Simulation result
  const simulation = useMemo(() => {
    return computeBudgetSimulation({
      purseRemaining,
      targetedAvailablePlayers: targetedAvailable,
      remainingMandatorySlots,
      minBasePrice,
      formatCurrencyFn: (amt) => formatShortIndianRupee(amt, unit),
    });
  }, [purseRemaining, targetedAvailable, remainingMandatorySlots, minBasePrice, unit]);

  // Tournament and League-wide economy metrics for Tab 1
  const totalLeaguePurse = useMemo(() => {
    if (teamsList && teamsList.length > 0) {
      return teamsList.reduce((acc, t) => acc + (t.purse || 0), 0);
    }
    return totalPurse * teamsCount;
  }, [teamsList, totalPurse, teamsCount]);

  const totalSlotsRemaining = useMemo(() => {
    const totalNeeded = teamsCount * minSquad;
    const soldCount = (allPlayers ?? []).filter(
      (p) => p.status === "sold" || p.status === "retained"
    ).length;
    return Math.max(0, totalNeeded - soldCount);
  }, [teamsCount, minSquad, allPlayers]);

  const spentPurse = Math.max(0, totalPurse - purseRemaining);
  const maxSingleBidSafe = Math.max(
    minBasePrice,
    purseRemaining - Math.max(0, remainingMandatorySlots - 1) * minBasePrice
  );
  const avgPerSlot =
    remainingMandatorySlots > 0 ? Math.round(purseRemaining / remainingMandatorySlots) : 0;

  const priceTiers = useMemo(() => {
    let tierHigh = 0;
    let tierMid = 0;
    let tierBase = 0;
    for (const p of availablePlayers) {
      const bp = p.basePrice || minBasePrice;
      if (bp >= 100000) tierHigh++;
      else if (bp >= 25000) tierMid++;
      else tierBase++;
    }
    return { tierHigh, tierMid, tierBase };
  }, [availablePlayers, minBasePrice]);

  // Filtered players list for target management tab
  const filteredPlayers = useMemo(() => {
    return (allPlayers ?? []).filter((p) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (p.name || "").toLowerCase().includes(q);
        const matchesSerial = String(p.serialNo || "").includes(q);
        const matchesCity = (p.city || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSerial && !matchesCity) return false;
      }

      if (roleFilter === "targets") {
        return targetIds.includes(p.id);
      }
      if (roleFilter !== "all") {
        const norm = normalizeSportRole(p.role, sportName).toLowerCase();
        if (!norm.includes(roleFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [allPlayers, searchQuery, roleFilter, targetIds, sportName]);

  const toggleExpandHistory = (id: number) => {
    setExpandedHistoryPlayerId((prev) => (prev === id ? null : id));
  };

  return (
    <div
      className="auction-surface h-full min-h-0 flex flex-col bg-[#0B0F17] text-[#E1E8ED] overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Auto-return alert banner when a player goes on stage ── */}
      <AnimatePresence>
        {auctionStarted && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-400 z-50 text-xs font-semibold"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Player on stage — returning to live bidding</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Header ── */}
      <div className="border-b border-white/10 flex-shrink-0 bg-[#0E131D]">
        <div className="flex items-center justify-between gap-3 px-3.5 sm:px-5 py-2.5 sm:py-3.5">
          <div className="flex items-center gap-3 min-w-0">
            {team.logoUrl ? (
              <img
                src={team.logoUrl}
                alt={team.name}
                className="w-10 h-10 rounded-xl object-contain bg-white/5 border border-white/10 p-0.5 shrink-0"
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-white/5 border border-white/10 text-amber-400 font-bold text-sm"
              >
                {team.shortCode || team.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-bold text-lg sm:text-xl text-white leading-tight truncate">
                  Strategy & Target Planner
                </h1>
                <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded bg-white/5 text-[#94A3B8] border border-white/10 shrink-0">
                  Pre-Auction
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5 truncate">
                {team.name} · {displaySportName} Squad & Budget Planning
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#141A24] hover:bg-[#1B2230] border border-white/10 text-white font-medium text-xs sm:text-sm transition-colors active:scale-95 shrink-0 cursor-pointer shadow-sm"
            title="Return to Auction Room (ESC)"
          >
            <ArrowLeft className="w-4 h-4 text-[#94A3B8]" />
            <span className="hidden sm:inline">Back to Auction</span>
            <span className="sm:hidden">Back</span>
          </button>
        </div>

        {/* ── Segmented Pill Navigation: Tab 1: Stats · Tab 2: Targets · Tab 3: Blueprint ── */}
        <div className="px-3.5 sm:px-5 pb-3">
          <div className="bg-[#141A24] p-1 rounded-xl border border-white/10 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab("scarcity")}
              className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer relative ${
                tab === "scarcity"
                  ? "bg-[#1B2230] text-white shadow-sm border border-white/10"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-amber-400" />
              <span>Tournament Pool Stats</span>
              {scarcityAlerts.some((a) => a.isCritical) && (
                <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-2 right-2.5" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setTab("targets")}
              className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                tab === "targets"
                  ? "bg-[#1B2230] text-white shadow-sm border border-white/10"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              <Bookmark className="w-4 h-4 text-sky-400" />
              <span>Target Shortlist ({targetIds.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setTab("blueprint")}
              className={`flex-1 py-2 px-3 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                tab === "blueprint"
                  ? "bg-[#1B2230] text-white shadow-sm border border-white/10"
                  : "text-[#94A3B8] hover:text-white"
              }`}
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Squad Blueprint</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Tab Content ── */}
      <div
        ref={contentRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y p-3.5 sm:p-5 space-y-4"
      >
        {/* ══════════════ TAB 3: SQUAD BLUEPRINT & LIVE FORMATION ══════════════ */}
        {tab === "blueprint" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4 max-w-4xl mx-auto"
          >
            {/* 1. Cricket Squad Composition Requirements */}
            <div className="rounded-2xl bg-[#141A24] border border-white/10 p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Users className="w-5 h-5 text-sky-400" />
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-white">
                      {displaySportName} Squad Composition Requirements
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8]">
                      Mandatory role limits & tactical targets for your squad
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs sm:text-sm text-[#94A3B8]">
                    Current Squad: <strong className="text-white font-mono">{myRoster.length}</strong> / {minSquad} min
                  </span>
                  <span
                    className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded border ${
                      myRoster.length >= minSquad
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                        : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                    }`}
                  >
                    {myRoster.length >= minSquad
                      ? "Minimum Met"
                      : `${remainingMandatorySlots} Slots to Buy`}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-[#0B0F17] border border-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-400 to-emerald-400 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.round((myRoster.length / minSquad) * 100))}%` }}
                />
              </div>

              {/* 2-Column Clean Role Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {adaptiveBlueprintRules.map((rule) => {
                  const rolePlayers = myRoster.filter(
                    (p) => !p.isNonPlayingMember && normalizeSportRole(p.role, sportName) === rule.role
                  );
                  const isMet = rolePlayers.length >= rule.min;
                  const neededCount = Math.max(0, rule.min - rolePlayers.length);

                  return (
                    <div
                      key={rule.role}
                      className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-white">{rule.role}</span>
                            <span className="text-[11px] font-mono text-[#94A3B8] px-2 py-0.5 rounded bg-white/5 border border-white/10">
                              Range: {rule.min}{rule.max > rule.min ? `-${rule.max}` : ""}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-xs font-mono font-bold ${isMet ? "text-emerald-400" : "text-amber-400"}`}>
                              {rolePlayers.length} / {rule.min}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                isMet
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                  : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              }`}
                            >
                              {isMet ? "Secured" : `${neededCount} Needed`}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">{rule.description}</p>
                      </div>

                      {/* Acquired Players in this role */}
                      {rolePlayers.length > 0 && (
                        <div className="pt-2 border-t border-white/5 space-y-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                            Acquired ({rolePlayers.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {rolePlayers.map((player) => (
                              <div
                                key={player.id}
                                className="flex items-center gap-1.5 px-2 py-1 rounded bg-[#141A24] border border-emerald-500/30 text-xs text-white"
                              >
                                <span className="font-semibold">{player.name}</span>
                                <span className="font-mono text-emerald-400 text-[11px]">
                                  {formatIndianRupee(player.soldPrice || player.retainedPrice || player.basePrice, unit)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Browse candidate players action */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                        <span className="text-xs text-[#94A3B8]">
                          {isMet ? "Role requirement satisfied" : `Need ${neededCount} more to meet minimum`}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setRoleFilter(rule.role.toLowerCase());
                            setTab("targets");
                          }}
                          className="text-xs font-semibold text-sky-400 hover:text-sky-300 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <span>Browse {rule.role}s</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Recommended Budget Allocation */}
            <div className="rounded-2xl bg-[#141A24] border border-white/10 p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Wallet className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-white">
                      Recommended Budget Allocation
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8]">
                      Total Available Purse:{" "}
                      <strong className="text-white font-mono">{formatIndianRupee(totalPurse, unit)}</strong>
                      {spentPurse > 0 && (
                        <span>
                          {" "}· Spendable Left:{" "}
                          <strong className="text-emerald-400 font-mono">{formatIndianRupee(purseRemaining, unit)}</strong>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-white/5 text-[#94A3B8] border border-white/10">
                  Allocation Guide
                </span>
              </div>

              {/* Multi-segment Visual Allocation Bar */}
              <div className="space-y-1.5">
                <div className="w-full h-3 rounded-full overflow-hidden flex bg-black/40 border border-white/10 p-0.5">
                  <div
                    style={{ width: "40%" }}
                    className="h-full rounded-l-full bg-gradient-to-r from-amber-500 to-yellow-400"
                    title={`Star Targets: 40%`}
                  />
                  <div
                    style={{ width: "40%" }}
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-400"
                    title={`Starting Squad: 40%`}
                  />
                  <div
                    style={{ width: "20%" }}
                    className="h-full rounded-r-full bg-gradient-to-r from-emerald-500 to-teal-400"
                    title={`Reserve Buffer: 20%`}
                  />
                </div>
                <div className="flex justify-between text-xs font-mono font-semibold px-0.5">
                  <span className="text-amber-400">40% Star Targets</span>
                  <span className="text-sky-400">40% Starting Squad</span>
                  <span className="text-emerald-400">20% Reserve Buffer</span>
                </div>
              </div>

              {/* 3 Strategy Pillars */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold uppercase text-amber-300 tracking-wider">
                        Star Targets (40%)
                      </span>
                      <span className="text-xs font-mono font-bold text-white shrink-0">
                        {formatShortIndianRupee(purseAnchorStars, unit)}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Budget ceiling for top match winners. Avoid exceeding 40% on a single lot.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/5 text-xs text-amber-300 font-semibold">
                    Target ceiling: ~{formatShortIndianRupee(Math.round(purseAnchorStars / 2), unit)} / star player
                  </div>
                </div>

                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold uppercase text-sky-300 tracking-wider">
                        Starting Squad (40%)
                      </span>
                      <span className="text-xs font-mono font-bold text-white shrink-0">
                        {formatShortIndianRupee(purseCoreXI, unit)}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Spread across regular starters to ensure a competitive, balanced playing squad.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/5 text-xs text-sky-300 font-semibold">
                    Target average: ~{formatShortIndianRupee(Math.round(purseCoreXI / Math.max(1, minSquad - 2)), unit)} / player
                  </div>
                </div>

                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-xs font-bold uppercase text-emerald-300 tracking-wider">
                        Reserve Buffer (20%)
                      </span>
                      <span className="text-xs font-mono font-bold text-white shrink-0">
                        {formatShortIndianRupee(purseValueBench, unit)}
                      </span>
                    </div>
                    <p className="text-xs text-[#94A3B8] leading-relaxed">
                      Protected funds for mandatory base-price slots in late rounds.
                    </p>
                  </div>
                  <div className="mt-3 pt-2.5 border-t border-white/5 text-xs text-emerald-300 font-semibold">
                    Protects against late-auction budget lockouts
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════ TAB 1: TOURNAMENT POOL STATS & SCARCITY ══════════════ */}
        {tab === "scarcity" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4 max-w-4xl mx-auto"
          >
            {/* Draft Pool Demand & Supply Analysis */}
            <div className="rounded-2xl bg-[#141A24] border border-white/10 p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-white">
                      Draft Pool Demand & Supply Analysis
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8]">
                      {availablePlayers.length} Available Players · {teamsCount} Competing Teams
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-white/5 text-[#94A3B8] border border-white/10">
                  Pool Scarcity
                </span>
              </div>

              {scarcityAlerts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {scarcityAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl p-3 sm:p-3.5 border bg-[#1B2230] border-white/5 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm sm:text-base text-white">{alert.role}</span>
                        <span
                          className={`text-[10px] sm:text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                            alert.availableCount === 0
                              ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                              : "bg-amber-500/15 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {alert.availableCount === 0 ? "Depleted" : "High Demand"}
                        </span>
                      </div>
                      <p className="text-xs text-[#94A3B8] leading-relaxed">{alert.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                  <p className="text-sm font-semibold text-white">Draft Pool is Well-Balanced</p>
                  <p className="text-xs text-[#94A3B8] mt-0.5">
                    Adequate supply available across all squad positions.
                  </p>
                </div>
              )}
            </div>

            {/* League Economy & Draft Intelligence */}
            <div className="rounded-2xl bg-[#141A24] border border-white/10 p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <DollarSign className="w-5 h-5 text-sky-400" />
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-white">
                      Draft Pool & League Economics
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8]">
                      Macro draft pool capacity, league spending power & slot competition
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-white/5 text-[#94A3B8] border border-white/10">
                  Macro Intelligence
                </span>
              </div>

              {/* 4 Economy Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    Available Pool
                  </p>
                  <p className="font-display font-bold text-lg sm:text-xl text-amber-300 mt-1 font-mono">
                    {availablePlayers.length}
                    <span className="text-xs text-[#94A3B8] font-normal"> Players</span>
                  </p>
                  <span className="text-xs text-[#94A3B8] block mt-1">Ready for bidding</span>
                </div>

                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    Franchises
                  </p>
                  <p className="font-display font-bold text-lg sm:text-xl text-white font-mono mt-1">
                    {teamsCount}
                    <span className="text-xs text-[#94A3B8] font-normal"> Teams</span>
                  </p>
                  <span className="text-xs text-[#94A3B8] block mt-1">In competition</span>
                </div>

                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    League Purse
                  </p>
                  <p className="font-display font-bold text-lg sm:text-xl text-emerald-400 font-mono mt-1">
                    {formatShortIndianRupee(totalLeaguePurse, unit)}
                  </p>
                  <span className="text-xs text-[#94A3B8] block mt-1">Total purchasing cap</span>
                </div>

                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    Open Slots
                  </p>
                  <p className="font-display font-bold text-lg sm:text-xl text-sky-300 font-mono mt-1">
                    {totalSlotsRemaining}
                    <span className="text-xs text-[#94A3B8] font-normal"> Slots</span>
                  </p>
                  <span className="text-xs text-[#94A3B8] block mt-1">To fill across league</span>
                </div>
              </div>

              {/* Price Tier Distribution */}
              <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 space-y-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                  Draft Pool Base Price Tiers
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="rounded-lg bg-[#141A24] p-3 border border-white/5">
                    <span className="text-xs font-bold text-amber-300">Marquee Tier (≥ 1.00 L)</span>
                    <p className="text-base font-bold font-mono text-white mt-1">
                      {priceTiers.tierHigh} <span className="text-xs font-normal text-[#94A3B8]">Players</span>
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">High-impact match winners</p>
                  </div>
                  <div className="rounded-lg bg-[#141A24] p-3 border border-white/5">
                    <span className="text-xs font-bold text-sky-300">Core Regulars (25K - 1.00 L)</span>
                    <p className="text-base font-bold font-mono text-white mt-1">
                      {priceTiers.tierMid} <span className="text-xs font-normal text-[#94A3B8]">Players</span>
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">Starting squad backbone</p>
                  </div>
                  <div className="rounded-lg bg-[#141A24] p-3 border border-white/5">
                    <span className="text-xs font-bold text-emerald-300">Base / Value (&lt; 25K)</span>
                    <p className="text-base font-bold font-mono text-white mt-1">
                      {priceTiers.tierBase} <span className="text-xs font-normal text-[#94A3B8]">Players</span>
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">Bench depth & value picks</p>
                  </div>
                </div>
              </div>

              {/* Direct Call-to-Action to Tab 2 for Shortlisting */}
              <div className="rounded-xl bg-gradient-to-r from-amber-500/10 via-[#1B2230] to-[#141A24] border border-amber-500/30 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-amber-400" />
                    Ready to build your target list?
                  </h4>
                  <p className="text-xs text-[#94A3B8]">
                    Choose players, simulate your budget, and track price impacts in the Target Shortlist.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("targets")}
                  className="py-2.5 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-bold text-xs sm:text-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shrink-0 shadow-sm"
                >
                  <span>Open Target Shortlist</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════ TAB 2: TARGET SHORTLIST & BUDGET CALCULATOR ══════════════ */}
        {tab === "targets" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4 max-w-4xl mx-auto"
          >
            {/* Budget Calculation Strip */}
            <div className="rounded-2xl bg-[#141A24] border border-white/10 p-4 sm:p-5 shadow-md space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Bookmark className="w-5 h-5 text-sky-400" />
                  <div>
                    <h3 className="font-display font-bold text-base sm:text-lg text-white">
                      Target Spending & Budget Calculator
                    </h3>
                    <p className="text-xs sm:text-sm text-[#94A3B8]">
                      Projected purse remaining if you win all selected target players
                    </p>
                  </div>
                </div>

                <div
                  className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded border ${simulation.status.color}`}
                >
                  {simulation.status.badge}
                </div>
              </div>

              {/* 4 Financial Metric Pillars */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    Selected Targets
                  </p>
                  <p className="font-display font-bold text-lg sm:text-xl text-amber-300 mt-1 font-mono">
                    {targetIds.length}
                    <span className="text-xs text-[#94A3B8] font-normal">
                      {" "}
                      {targetIds.length === 1 ? "Target" : "Targets"}
                    </span>
                  </p>
                  <span className="text-xs text-[#94A3B8] block mt-1">
                    {targetedAvailable.length} available in pool
                  </span>
                </div>

                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    Estimated Spend
                  </p>
                  <p className="font-display font-bold text-lg sm:text-xl text-white font-mono mt-1">
                    {formatShortIndianRupee(simulation.estimatedTargetSpend, unit)}
                  </p>
                  <span className="text-xs text-[#94A3B8] block mt-1">
                    At current base prices
                  </span>
                </div>

                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    Purse After Targets
                  </p>
                  <p
                    className={`font-display font-bold text-lg sm:text-xl font-mono mt-1 ${
                      simulation.purseAfterTargets < 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {formatShortIndianRupee(simulation.purseAfterTargets, unit)}
                  </p>
                  <span className="text-xs text-[#94A3B8] block mt-1">
                    Remaining for squad
                  </span>
                </div>

                <div className="rounded-xl bg-[#1B2230] border border-white/5 p-3.5 sm:p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                    {simulation.unfilledSlotsAfterTargets === 0
                      ? "Surplus Balance"
                      : "Purse Left Per Slot"}
                  </p>
                  <p className="font-display font-bold text-lg sm:text-xl text-sky-300 font-mono mt-1">
                    {simulation.unfilledSlotsAfterTargets === 0
                      ? formatShortIndianRupee(simulation.surplusPurse, unit)
                      : formatShortIndianRupee(simulation.remainingPursePerSlot, unit)}
                  </p>
                  {simulation.unfilledSlotsAfterTargets === 0 ? (
                    <span className="text-xs text-emerald-400 font-semibold block mt-1">
                      Quota Met ({remainingMandatorySlots} slots)
                    </span>
                  ) : (
                    <span className="text-xs text-[#94A3B8] block mt-1">
                      {simulation.unfilledSlotsAfterTargets} remaining slots
                    </span>
                  )}
                </div>
              </div>

              {/* Status explanation alert */}
              <div
                className={`rounded-xl p-3 border text-xs sm:text-sm leading-relaxed flex items-center gap-2.5 ${simulation.status.color}`}
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{simulation.status.message}</span>
              </div>
            </div>

            {/* Target Filter & Search Toolbar */}
            <div className="rounded-2xl bg-[#141A24] border border-white/10 p-4 sm:p-5 shadow-md space-y-4">
              {/* Search Bar */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by player name, serial #, city..."
                  className="w-full pl-10 pr-16 py-2.5 rounded-xl bg-[#1B2230] border border-white/10 text-xs sm:text-sm text-white placeholder-[#94A3B8] focus:outline-hidden focus:border-amber-400 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#94A3B8] hover:text-white cursor-pointer px-2.5 py-1 rounded bg-white/5 border border-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-2 overflow-x-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {[
                  { id: "all", label: "All Players" },
                  { id: "targets", label: `Shortlisted (${targetIds.length})` },
                  { id: "batter", label: "Batters" },
                  { id: "keeper", label: "Keepers" },
                  { id: "bowler", label: "Bowlers" },
                  { id: "all-rounder", label: "All-Rounders" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRoleFilter(f.id)}
                    className={`text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      roleFilter === f.id
                        ? "bg-amber-400 text-black border-amber-400 shadow-sm"
                        : "bg-[#1B2230] text-[#94A3B8] hover:text-white border-white/10"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Players List */}
              <div className="space-y-2.5 pt-1">
                {filteredPlayers.length === 0 ? (
                  <div className="py-8 text-center text-xs sm:text-sm text-[#94A3B8]">
                    No players found matching current filters.
                  </div>
                ) : (
                  filteredPlayers.map((player) => {
                    const targeted = isTarget(player.id);
                    const isHistoryExpanded = expandedHistoryPlayerId === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`rounded-xl border p-3.5 sm:p-4 flex flex-col justify-between gap-3 transition-all ${
                          targeted
                            ? "bg-amber-500/10 border-amber-500/40 shadow-sm"
                            : "bg-[#1B2230] border-white/5"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <PlayerAvatar
                              name={player.name ?? "Player"}
                              photoUrl={(player as any).photoUrl}
                              className="w-11 h-11 rounded-xl object-cover shrink-0 border border-white/10"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs sm:text-sm text-[#94A3B8]">
                                  #{(player as any).serialNo || player.id}
                                </span>
                                <p className="font-display font-bold text-sm sm:text-base text-white truncate">
                                  {player.name}
                                </p>
                                {targeted && (
                                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-400 text-black font-mono">
                                    Target
                                  </span>
                                )}
                              </div>
                              <p className="text-xs sm:text-sm text-[#94A3B8] mt-0.5 truncate">
                                {player.role || "Player"} · {player.city || "Available Pool"}
                                <span className="text-emerald-400 font-mono font-semibold ml-2">
                                  Base: {formatIndianRupee(player.basePrice || minBasePrice, unit)}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <PlayerHistoryToggleButton
                              tournamentId={tournamentId}
                              playerId={player.id}
                              isExpanded={isHistoryExpanded}
                              onToggle={() => toggleExpandHistory(player.id)}
                              features={tournament?.features}
                            />

                            <button
                              type="button"
                              onClick={() => toggleTarget(player.id)}
                              className={`p-2.5 rounded-lg border transition-all active:scale-95 cursor-pointer shrink-0 ${
                                targeted
                                  ? "bg-amber-400 text-black border-amber-400 shadow-sm"
                                  : "bg-[#141A24] text-[#94A3B8] hover:text-white border-white/10"
                              }`}
                              title={
                                targeted
                                  ? "Remove from target shortlist"
                                  : "Add to target shortlist"
                              }
                            >
                              <Star className={`w-4 h-4 ${targeted ? "fill-black" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {isHistoryExpanded && (
                          <div className="pt-2 border-t border-white/5">
                            <OwnerPlayerAuctionHistory
                              tournamentId={tournamentId}
                              playerId={player.id}
                              unit={unit}
                              features={tournament?.features}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="p-3 sm:p-3.5 bg-[#0E131D] border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#94A3B8]">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>Private Strategy Desk · Only visible to your device</span>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs sm:text-sm transition-all active:scale-[0.98] flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <span>{returnLabel || "Return to Live Auction"}</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
