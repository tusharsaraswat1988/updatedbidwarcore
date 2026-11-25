import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target,
  ShieldUser,
  Zap,
  Sparkles,
  AlertTriangle,
  TrendingUp,
  Search,
  Star,
  X,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Flame,
  Award,
  DollarSign,
  Radar,
  History,
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
  detectProvenStars,
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

type WarRoomTab = "blueprint" | "scarcity" | "targets";

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
  const [tab, setTab] = useState<WarRoomTab>("blueprint");
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

  // Keyboard navigation
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

  // Query tournament scouting intelligence (teams count, rival purses)
  const { data: scoutData } = useGetTeamScout(tournamentId, {
    query: {
      queryKey: getGetTeamScoutQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 20_000,
    },
  });

  // Query list of teams for precise tournament competing team count
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

  // FOMO Scarcity Radar: role scarcity calculation across tournament pool
  const scarcityAlerts = useMemo(() => {
    return computeDraftPoolScarcity({
      availablePlayers,
      teamsCount,
      sportName,
      blueprintRules,
    });
  }, [availablePlayers, teamsCount, sportName, blueprintRules]);

  // Proven Stars Radar: detect players with special badges, tags, top base prices, or star achievements
  const provenStars = useMemo(() => {
    return detectProvenStars(availablePlayers, minBasePrice);
  }, [availablePlayers, minBasePrice]);

  // Personal Target Shortlist calculations
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
      formatCurrencyFn: (amt) => formatIndianRupee(amt, unit),
    });
  }, [purseRemaining, targetedAvailable, remainingMandatorySlots, minBasePrice, unit]);

  // Filtered players list for target management tab
  const filteredPlayers = useMemo(() => {
    return (allPlayers ?? []).filter((p) => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (p.name || "").toLowerCase().includes(q);
        const matchesSerial = String(p.serialNo || "").includes(q);
        const matchesCity = (p.city || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSerial && !matchesCity) return false;
      }

      // Role filter
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
      className="auction-surface h-full min-h-0 flex flex-col bg-[#140e2e] text-white overflow-hidden select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* ── Auto-return alert banner when a player goes on stage ── */}
      <AnimatePresence>
        {auctionStarted && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/25 border-b border-emerald-500/40 text-emerald-300 z-50"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-4 ring-emerald-500/30" />
            <p className="text-sm font-black tracking-wide">
              Player on stage — returning to live bidding block
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Header ── */}
      <div className="border-b border-[#4a4478] flex-shrink-0 bg-[#18123a]">
        <div className="flex items-center justify-center px-4 py-2 border-b border-[#4a4478]/70">
          <img
            src={brandLogoSrc}
            alt={brandName}
            className="h-9 w-auto max-w-[min(260px,70vw)] object-contain object-center"
            decoding="async"
          />
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{
                backgroundColor: `${teamColor}22`,
                color: teamColor,
                border: `2px solid ${teamColor}55`,
              }}
            >
              <Target className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-display font-black text-lg text-white leading-tight truncate">
                  AI Strategy War Room
                </h1>
                <span className="text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                  PRE-AUCTION
                </span>
              </div>
              <p className="text-xs text-[#a8a0c4] mt-0.5 truncate">
                {team.name} · {displaySportName} Blueprint & Scarcity Radar
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/35 border-2 border-red-500/50 text-red-200 font-black text-xs transition-all active:scale-95 shrink-0 shadow-lg cursor-pointer"
            title="Return to Auction Room (ESC)"
          >
            <X className="w-4 h-4 text-red-300 stroke-[3]" />
            <span>CLOSE</span>
            <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[9px] font-mono bg-black/60 rounded border border-red-500/40 text-red-200 ml-1">
              ESC
            </kbd>
          </button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex flex-shrink-0 border-b border-[#4a4478] bg-[#1a133d]">
        <button
          type="button"
          onClick={() => setTab("blueprint")}
          className={`flex-1 py-3 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            tab === "blueprint"
              ? "text-amber-400 border-b-2 border-amber-400 bg-amber-400/10"
              : "text-[#8d85b5] hover:text-white border-b-2 border-transparent"
          }`}
        >
          <ShieldUser className="w-4 h-4" />
          <span>Squad Blueprint</span>
        </button>

        <button
          type="button"
          onClick={() => setTab("scarcity")}
          className={`flex-1 py-3 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 relative ${
            tab === "scarcity"
              ? "text-sky-400 border-b-2 border-sky-400 bg-sky-400/10"
              : "text-[#8d85b5] hover:text-white border-b-2 border-transparent"
          }`}
        >
          <Radar className="w-4 h-4" />
          <span>Scarcity Radar</span>
          {scarcityAlerts.some((a) => a.isCritical) && (
            <span className="w-2 h-2 rounded-full bg-amber-400 absolute top-2.5 right-3" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab("targets")}
          className={`flex-1 py-3 px-2 text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
            tab === "targets"
              ? "text-emerald-400 border-b-2 border-emerald-400 bg-emerald-400/10"
              : "text-[#8d85b5] hover:text-white border-b-2 border-transparent"
          }`}
        >
          <Star className="w-4 h-4" />
          <span>Targets ({targetIds.length})</span>
        </button>
      </div>

      {/* ── Main Tab Content ── */}
      <div
        ref={contentRef}
        className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y p-3 sm:p-5 space-y-4"
      >
        {/* ══════════════ TAB 1: SQUAD BLUEPRINT & 40-40-20 RULE ══════════════ */}
        {tab === "blueprint" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* 40-40-20 Rule Hero Card */}
            <div className="rounded-3xl bg-gradient-to-br from-[#241b52] to-[#171138] border border-[#4a4478] p-4 sm:p-5 shadow-2xl relative overflow-hidden">
              <div
                className="absolute -right-10 -bottom-10 w-44 h-44 rounded-full pointer-events-none opacity-20 blur-2xl"
                style={{ backgroundColor: teamColor }}
              />

              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display font-black text-base sm:text-lg text-white">
                      The 40-40-20 Purse Distribution Rule
                    </h2>
                    <p className="text-xs text-[#a8a0c4]">
                      Total Team Purse:{" "}
                      <strong className="text-white font-mono">
                        {formatIndianRupee(totalPurse, unit)}
                      </strong>
                    </p>
                  </div>
                </div>
                <span className="hidden sm:inline-block text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded bg-[#332a68] text-amber-300 border border-[#50468e]">
                  NEW OWNER GUIDE
                </span>
              </div>

              {/* Multi-segment Visual Allocation Bar */}
              <div className="space-y-1.5 my-4">
                <div className="w-full h-4 rounded-full overflow-hidden flex bg-black/40 border border-white/10 p-0.5">
                  <div
                    style={{ width: "40%" }}
                    className="h-full rounded-l-full bg-gradient-to-r from-amber-500 to-yellow-400 relative group cursor-pointer"
                    title={`Anchor Stars: ${formatShortIndianRupee(purseAnchorStars, unit)} (40%)`}
                  />
                  <div
                    style={{ width: "40%" }}
                    className="h-full bg-gradient-to-r from-sky-500 to-indigo-400 relative group cursor-pointer"
                    title={`Core Starting XI: ${formatShortIndianRupee(purseCoreXI, unit)} (40%)`}
                  />
                  <div
                    style={{ width: "20%" }}
                    className="h-full rounded-r-full bg-gradient-to-r from-emerald-500 to-teal-400 relative group cursor-pointer"
                    title={`Value Bench: ${formatShortIndianRupee(purseValueBench, unit)} (20%)`}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono font-bold text-[#a8a0c4] px-1">
                  <span className="text-amber-400">40% Anchor Stars</span>
                  <span className="text-sky-400">40% Core XI</span>
                  <span className="text-emerald-400">20% Value Bench</span>
                </div>
              </div>

              {/* 3 Tier Cards Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {/* 40% Anchor */}
                <div className="rounded-2xl bg-[#1b1442] border border-amber-400/30 p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-black uppercase text-amber-300 tracking-wider truncate">
                        40% Anchor Stars
                      </span>
                      <span className="text-xs font-mono font-black text-white shrink-0">
                        {formatShortIndianRupee(purseAnchorStars, unit)}
                      </span>
                    </div>
                    <p className="text-xs text-[#a8a0c4] leading-relaxed">
                      Reserve for <strong>2-3 proven match winners</strong>. Avoid blowing over 40%
                      of purse on a single player.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-amber-400/20 text-[10px] text-amber-300/90 font-medium">
                    Target: {formatShortIndianRupee(Math.round(purseAnchorStars / 2), unit)}/star avg
                  </div>
                </div>

                {/* 40% Core XI */}
                <div className="rounded-2xl bg-[#1b1442] border border-sky-400/30 p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-black uppercase text-sky-300 tracking-wider truncate">
                        40% Core XI
                      </span>
                      <span className="text-xs font-mono font-black text-white shrink-0">
                        {formatShortIndianRupee(purseCoreXI, unit)}
                      </span>
                    </div>
                    <p className="text-xs text-[#a8a0c4] leading-relaxed">
                      Spread across <strong>4-6 regular starters</strong>. Disciplined bidding
                      prevents weak links in lineup.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-sky-400/20 text-[10px] text-sky-300/90 font-medium">
                    Target: {formatShortIndianRupee(Math.round(purseCoreXI / 5), unit)}/starter avg
                  </div>
                </div>

                {/* 20% Value Bench */}
                <div className="rounded-2xl bg-[#1b1442] border border-emerald-400/30 p-3 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-[11px] font-black uppercase text-emerald-300 tracking-wider truncate">
                        20% Value Bench
                      </span>
                      <span className="text-xs font-mono font-black text-white shrink-0">
                        {formatShortIndianRupee(purseValueBench, unit)}
                      </span>
                    </div>
                    <p className="text-xs text-[#a8a0c4] leading-relaxed">
                      Guaranteed buffer for <strong>3-5 bench depth</strong> and mandatory minimum
                      base-price slots.
                    </p>
                  </div>
                  <div className="mt-3 pt-2 border-t border-emerald-400/20 text-[10px] text-emerald-300/90 font-medium">
                    Protects from late-round lockouts
                  </div>
                </div>
              </div>
            </div>

            {/* Sport Squad Blueprint Table */}
            <div className="rounded-3xl bg-[#1c1647] border border-[#4a4478] p-4 sm:p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldUser className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-bold text-base text-white">
                    {displaySportName} Squad Architecture Target
                  </h3>
                </div>
                <span className="text-xs text-[#a8a0c4]">
                  My Squad: <strong className="text-white">{myRoster.length}</strong> / {minSquad} min
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {blueprintRules.map((rule) => {
                  const currentCount = currentRoleCounts[rule.role] || 0;
                  const isMet = currentCount >= rule.min;
                  const isMaxMet = currentCount >= rule.max;

                  return (
                    <div
                      key={rule.role}
                      className="rounded-2xl bg-[#241c56] border border-[#4a4478] p-3.5 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-bold text-sm text-white truncate">
                            {rule.role}
                          </p>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/40 text-amber-300 border border-amber-500/20">
                            Rec: {rule.min}-{rule.max}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#a8a0c4] mt-0.5 line-clamp-2 leading-snug">
                          {rule.description}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`text-sm font-mono font-black ${
                              isMet ? "text-emerald-400" : "text-amber-400"
                            }`}
                          >
                            {currentCount}
                          </span>
                          <span className="text-xs text-[#6b6490]">/ {rule.min}</span>
                          {isMet ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            isMaxMet
                              ? "bg-indigo-500/20 text-indigo-300"
                              : isMet
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-500/20 text-rose-300"
                          }`}
                        >
                          {isMaxMet ? "Full" : isMet ? "Secured" : "Need Priority"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ══════════════ TAB 2: SCARCITY & SPECIAL PLAYER RADAR ══════════════ */}
        {tab === "scarcity" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Scarcity Alerts Banner */}
            <div className="rounded-3xl bg-[#1c1647] border border-[#4a4478] p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radar className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-black text-base text-white">
                    Draft Pool Demand & Scarcity Radar
                  </h3>
                </div>
                <span className="text-xs text-[#a8a0c4]">
                  {availablePlayers.length} Available Players · {teamsCount} Competing Teams
                </span>
              </div>

              {scarcityAlerts.length > 0 ? (
                <div className="space-y-2">
                  {scarcityAlerts.map((alert, idx) => (
                    <div
                      key={idx}
                      className={`rounded-2xl p-3 border flex items-start gap-3 transition-colors ${
                        alert.availableCount === 0
                          ? "bg-[#221a48] border-purple-500/30 text-purple-200"
                          : "bg-[#241c4a] border-amber-500/30 text-amber-100"
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {alert.availableCount === 0 ? (
                          <Zap className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Zap className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${
                              alert.availableCount === 0
                                ? "bg-purple-500/20 text-purple-300 border-purple-500/30"
                                : "bg-amber-400/20 text-amber-300 border-amber-400/30"
                            }`}
                          >
                            {alert.availableCount === 0 ? "LIMITED DEPTH" : "HIGH DEMAND"}
                          </span>
                          <span className="font-bold text-sm text-white">{alert.role}</span>
                        </div>
                        <p className="text-xs mt-1 text-[#d4cfe6] leading-snug">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-[#241c56] border border-[#4a4478] p-4 text-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto mb-1.5" />
                  <p className="text-sm font-semibold text-white">Draft Pool is Well-Balanced</p>
                  <p className="text-xs text-[#a8a0c4] mt-0.5">
                    No critical role deficits detected. Supply matches tournament demand across all
                    positions.
                  </p>
                </div>
              )}
            </div>

            {/* Proven Stars & Marquee Assets */}
            <div className="rounded-3xl bg-[#1c1647] border border-[#4a4478] p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-400" />
                  <h3 className="font-display font-black text-base text-white">
                    Proven Stars & High-Impact Targets ({provenStars.length})
                  </h3>
                </div>
                <span className="text-xs text-[#a8a0c4]">
                  Past Top-5 badges, mobile-deduped history & valuations
                </span>
              </div>

              {provenStars.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {provenStars.map((player) => {
                    const targeted = isTarget(player.id);
                    const isHistoryExpanded = expandedHistoryPlayerId === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`rounded-2xl border p-3 flex flex-col justify-between gap-2.5 transition-all ${
                          targeted
                            ? "bg-amber-500/10 border-amber-400/60 shadow-md"
                            : "bg-[#241c56] border-[#4a4478]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <PlayerAvatar
                              name={player.name ?? "Player"}
                              photoUrl={(player as any).photoUrl}
                              className="w-11 h-11 rounded-xl object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[11px] text-[#a8a0c4]">
                                  #{(player as any).serialNo || player.id}
                                </span>
                                <p className="font-display font-bold text-sm text-white truncate">
                                  {player.name}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {player.playerTag ? (
                                  <PlayerTagBadge tagKey={player.playerTag} size="sm" />
                                ) : (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                                    ⭐ PROVEN STAR
                                  </span>
                                )}
                                {isRecognizedRole(player.role) && (
                                  <span className="text-[10px] text-[#a8a0c4]">{player.role}</span>
                                )}
                              </div>
                              <p className="text-xs font-mono font-bold text-emerald-400 mt-1">
                                Base:{" "}
                                {formatIndianRupee(player.basePrice || minBasePrice, unit)}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleExpandHistory(player.id)}
                              className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer text-xs ${
                                isHistoryExpanded
                                  ? "bg-amber-400/20 border-amber-400 text-amber-300"
                                  : "bg-[#18123a] text-[#a8a0c4] hover:text-white border-[#4a4478]"
                              }`}
                              title="Toggle Player Auction History Dossier"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleTarget(player.id)}
                              className={`p-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer shrink-0 ${
                                targeted
                                  ? "bg-amber-400 text-black border-amber-300 shadow-md"
                                  : "bg-[#18123a] text-[#8d85b5] hover:text-white border-[#4a4478]"
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

                        {/* Expandable Auction History Dossier with past Top-5 badges */}
                        {isHistoryExpanded && (
                          <div className="pt-2 border-t border-[#4a4478]/60">
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
                  })}
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-[#a8a0c4]">
                  No specifically tagged marquee stars in pool. Use the Targets tab to shortlist any
                  player.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ══════════════ TAB 3: TARGET SHORTLIST & LIVE BUDGET SIMULATOR ══════════════ */}
        {tab === "targets" && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Live Budget Simulator Widget */}
            <div className="rounded-3xl bg-gradient-to-br from-[#241c52] to-[#18123a] border border-[#4a4478] p-4 sm:p-5 shadow-2xl space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-400/20 border border-emerald-400/40 text-emerald-300">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-black text-base text-white">
                      Live Budget & Shortlist Simulator
                    </h3>
                    <p className="text-xs text-[#a8a0c4]">
                      Simulates purse impact if all shortlisted targets are acquired
                    </p>
                  </div>
                </div>

                <div
                  className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${simulation.status.color}`}
                >
                  {simulation.status.badge}
                </div>
              </div>

              {/* Real-time Math Matrix */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-2xl bg-[#1b1442] border border-[#4a4478] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8a0c4]">
                    Targets Shortlisted
                  </p>
                  <p className="font-display font-black text-lg text-amber-300 mt-0.5">
                    {targetIds.length === 0 ? "0" : targetIds.length}
                    <span className="text-xs text-[#8d85b5] font-normal">
                      {" "}
                      {targetIds.length === 1 ? "Target" : "Targets"}
                    </span>
                  </p>
                  <span className="text-[9px] text-[#a8a0c4] font-medium block mt-0.5">
                    {targetedAvailable.length} active in pool
                  </span>
                </div>

                <div className="rounded-2xl bg-[#1b1442] border border-[#4a4478] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8a0c4]">
                    Est. Target Spend
                  </p>
                  <p className="font-display font-black text-lg text-white font-mono mt-0.5">
                    {formatShortIndianRupee(simulation.estimatedTargetSpend, unit)}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#1b1442] border border-[#4a4478] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8a0c4]">
                    Purse After Targets
                  </p>
                  <p
                    className={`font-display font-black text-lg font-mono mt-0.5 ${
                      simulation.purseAfterTargets < 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {formatShortIndianRupee(simulation.purseAfterTargets, unit)}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#1b1442] border border-[#4a4478] p-3 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#a8a0c4]">
                    {simulation.unfilledSlotsAfterTargets === 0
                      ? "Surplus Reserve"
                      : "Remaining / Unfilled Slot"}
                  </p>
                  <p className="font-display font-black text-lg text-sky-300 font-mono mt-0.5">
                    {simulation.unfilledSlotsAfterTargets === 0
                      ? formatShortIndianRupee(simulation.surplusPurse, unit)
                      : formatShortIndianRupee(simulation.remainingPursePerSlot, unit)}
                  </p>
                  {simulation.unfilledSlotsAfterTargets === 0 && (
                    <span className="text-[9px] text-emerald-400 font-semibold block mt-0.5">
                      Quota Met ({remainingMandatorySlots} slots)
                    </span>
                  )}
                </div>
              </div>

              {/* Status explanation alert */}
              <div
                className={`rounded-2xl p-3 border text-xs leading-relaxed flex items-center gap-2.5 ${simulation.status.color}`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{simulation.status.message}</span>
              </div>
            </div>

            {/* Target Filter & Search Toolbar */}
            <div className="rounded-3xl bg-[#1c1647] border border-[#4a4478] p-4 sm:p-5 shadow-xl space-y-3">
              {/* Search Bar - Full Width Row */}
              <div className="relative w-full">
                <Search className="w-4 h-4 text-[#8d85b5] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search player by name, #serial, city..."
                  className="w-full pl-10 pr-14 py-2.5 rounded-xl bg-[#140e2e] border border-[#4a4478] text-sm text-white placeholder-[#6b6490] focus:outline-hidden focus:border-amber-400 transition-colors"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#a8a0c4] hover:text-white cursor-pointer px-2 py-0.5 rounded-md bg-[#241c56] border border-[#4a4478]"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Filter Pills - Smooth Horizontal Scroll without native Windows scrollbars */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {[
                  { id: "all", label: "All Pool" },
                  { id: "targets", label: `⭐ Targets (${targetIds.length})` },
                  { id: "batter", label: "Batters" },
                  { id: "keeper", label: "Keepers" },
                  { id: "bowler", label: "Bowlers" },
                  { id: "all-rounder", label: "All-Rounders" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setRoleFilter(f.id)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl border whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                      roleFilter === f.id
                        ? "bg-amber-400 text-black border-amber-300 shadow-sm"
                        : "bg-[#18123a] text-[#8d85b5] hover:text-white border-[#4a4478]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Players Grid */}
              <div className="space-y-2 pt-2">
                {filteredPlayers.length === 0 ? (
                  <div className="py-12 text-center text-xs text-[#a8a0c4]">
                    No players found matching current filters.
                  </div>
                ) : (
                  filteredPlayers.map((player) => {
                    const targeted = isTarget(player.id);
                    const isSoldToMe = player.teamId === teamId && player.status === "sold";
                    const isSoldOther =
                      player.teamId && player.teamId !== teamId && player.status === "sold";
                    const isHistoryExpanded = expandedHistoryPlayerId === player.id;

                    return (
                      <div
                        key={player.id}
                        className={`rounded-2xl border p-3 flex flex-col justify-between gap-2.5 transition-all ${
                          targeted
                            ? "bg-amber-500/10 border-amber-400/60 shadow-md"
                            : "bg-[#241c56] border-[#4a4478] hover:border-[#655e9e]"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <PlayerAvatar
                              name={player.name}
                              photoUrl={player.photoUrl}
                              className="w-12 h-12 rounded-xl object-cover shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs text-[#a8a0c4]">
                                  #{player.serialNo || player.id}
                                </span>
                                <p className="font-display font-bold text-sm text-white truncate">
                                  {player.name}
                                </p>
                                {targeted && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-400 text-black shadow-xs">
                                    ⭐ TARGET
                                  </span>
                                )}
                                {isSoldToMe && (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    ACQUIRED
                                  </span>
                                )}
                                {targeted && isSoldOther ? (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-300 border border-amber-400/50 shadow-xs flex items-center gap-1">
                                    <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                                    <span>SOLD TO RIVAL · PIVOT READY</span>
                                  </span>
                                ) : isSoldOther ? (
                                  <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                    SOLD
                                  </span>
                                ) : null}
                              </div>

                              <div className="flex items-center gap-2 mt-1 text-xs text-[#a8a0c4]">
                                {isRecognizedRole(player.role) && (
                                  <span className="font-semibold text-white/90">
                                    {player.role}
                                  </span>
                                )}
                                {player.city && <span>· {player.city}</span>}
                                <span>
                                  · Base:{" "}
                                  <strong className="text-emerald-400 font-mono">
                                    {formatIndianRupee(player.basePrice || minBasePrice, unit)}
                                  </strong>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => toggleExpandHistory(player.id)}
                              className={`p-2 rounded-xl border transition-all active:scale-95 cursor-pointer text-xs ${
                                isHistoryExpanded
                                  ? "bg-amber-400/20 border-amber-400 text-amber-300"
                                  : "bg-[#18123a] text-[#a8a0c4] hover:text-white border-[#4a4478]"
                              }`}
                              title="Toggle Player Auction History Dossier"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleTarget(player.id)}
                              className={`p-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer shrink-0 ${
                                targeted
                                  ? "bg-amber-400 text-black border-amber-300 shadow-lg scale-105"
                                  : "bg-[#18123a] text-[#8d85b5] hover:text-white hover:border-[#655e9e] border-[#4a4478]"
                              }`}
                              title={
                                targeted
                                  ? "Remove from target shortlist"
                                  : "⭐ Add to target shortlist"
                              }
                            >
                              <Star className={`w-4 h-4 ${targeted ? "fill-black" : ""}`} />
                            </button>
                          </div>
                        </div>

                        {/* Expandable Auction History Dossier with past Top-5 badges */}
                        {isHistoryExpanded && (
                          <div className="pt-2 border-t border-[#4a4478]/60">
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
      <div className="p-3 bg-[#120d2a] border-t border-[#4a4478] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2 text-xs text-[#a8a0c4]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Private Strategy Room · Only visible to your team</span>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="py-2 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer shadow-md"
        >
          <span>{returnLabel || "Return to Live Auction"}</span>
          <ChevronRight className="w-4 h-4 stroke-[3]" />
        </button>
      </div>
    </div>
  );
}
