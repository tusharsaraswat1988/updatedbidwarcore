import { useMemo } from "react";
import { motion } from "framer-motion";
import { Radar, Users, ShieldUser, ArrowRight, Zap, Target } from "lucide-react";
import { useGetTeamScout, getGetTeamScoutQueryKey, useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { formatShortIndianRupee, type resolveAuctionUnit } from "@/lib/format";
import { TeamLogo } from "@/components/TeamLogo";

interface InterLotCommandCenterProps {
  tournamentId: number;
  teamId: number;
  teamColor: string;
  isPaused: boolean;
  isIdle: boolean;
  unit: ReturnType<typeof resolveAuctionUnit>;
  onViewSquad: () => void;
  onViewScout: () => void;
  sport?: string | null;
}

export function InterLotCommandCenter({
  tournamentId,
  teamId,
  teamColor,
  isPaused,
  isIdle,
  unit,
  onViewSquad,
  onViewScout,
}: InterLotCommandCenterProps) {
  // Query squad players
  const { data: allPlayers } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 15_000,
    },
  });

  // Query rival scout intelligence
  const { data: scoutData } = useGetTeamScout(tournamentId, {
    query: {
      queryKey: getGetTeamScoutQueryKey(tournamentId),
      enabled: !!tournamentId,
      staleTime: 20_000,
    },
  });

  // Compute current team role breakdown
  const roleBreakdown = useMemo(() => {
    const mine = (allPlayers ?? []).filter((p) => p.teamId === teamId && !p.isNonPlayingMember);
    const roles: Record<string, number> = {};
    for (const p of mine) {
      const r = (p.role || "Player").trim();
      roles[r] = (roles[r] || 0) + 1;
    }
    return {
      total: mine.length,
      roles: Object.entries(roles).slice(0, 4),
    };
  }, [allPlayers, teamId]);

  // Compute top rival purses
  const topRivals = useMemo(() => {
    if (!scoutData?.teams) return [];
    return scoutData.teams
      .filter((t) => t.id !== teamId)
      .sort((a, b) => b.purseRemaining - a.purseRemaining)
      .slice(0, 3);
  }, [scoutData, teamId]);

  const statusHeadline = isPaused
    ? "AUCTION PAUSED BY OPERATOR"
    : isIdle
      ? "AUCTION STANDBY"
      : "AWAITING NEXT LOT DRAW";

  const statusSubline = isPaused
    ? "Bidding suspended temporarily. Review squad & purse tactics."
    : "Stage is clear. Prepare strategy for the upcoming lot.";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="w-full h-full min-h-[40vh] rounded-3xl bg-[#1b1542] border border-[#4a4478] p-4 sm:p-5 flex flex-col justify-between shadow-2xl relative overflow-hidden select-none"
    >
      {/* Background ambient radar glow */}
      <div
        className="absolute -right-16 -top-16 w-56 h-56 rounded-full pointer-events-none opacity-20 blur-3xl"
        style={{ backgroundColor: teamColor }}
      />

      {/* ── Top Header / Standby Beacon ── */}
      <div className="flex-shrink-0 border-b border-[#4a4478]/70 pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
              {statusHeadline}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[#2a2458] border border-[#4a4478] text-[10px] text-[#a8a0c4] font-semibold">
            <Target className="w-3 h-3 text-amber-400" />
            <span>WAR ROOM</span>
          </div>
        </div>
        <p className="text-xs text-[#a8a0c4] mt-1 line-clamp-1">{statusSubline}</p>
      </div>

      {/* ── Center Content: Tactical Grid ── */}
      <div className="my-3 space-y-3 flex-1 flex flex-col justify-center min-h-0 overflow-hidden">
        {/* Squad Composition Matrix */}
        <div className="bg-[#150f33]/80 rounded-2xl p-3 border border-[#3d3670]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <ShieldUser className="w-3.5 h-3.5" style={{ color: teamColor }} />
              <span>Squad Needs ({roleBreakdown.total} In Roster)</span>
            </div>
            <button
              type="button"
              onClick={onViewSquad}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View Roster</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {roleBreakdown.roles.length > 0 ? (
              roleBreakdown.roles.map(([role, cnt]) => (
                <div
                  key={role}
                  className="bg-[#241d4c] rounded-xl px-2.5 py-1.5 border border-[#4a4478]/60 flex items-center justify-between"
                >
                  <span className="text-xs text-[#d4d4d8] font-medium truncate">{role}</span>
                  <span className="text-xs font-black px-1.5 py-0.5 rounded bg-black/40 text-amber-400 border border-amber-500/25">
                    {cnt}
                  </span>
                </div>
              ))
            ) : (
              <div className="col-span-2 py-2 text-center text-xs text-[#a8a0c4]">
                Awaiting first squad acquisition
              </div>
            )}
          </div>
        </div>

        {/* Top Rivals Threat Radar */}
        <div className="bg-[#150f33]/80 rounded-2xl p-3 border border-[#3d3670]">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white">
              <Radar className="w-3.5 h-3.5 text-purple-400" />
              <span>Rival Purse Radar</span>
            </div>
            <button
              type="button"
              onClick={onViewScout}
              className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>All Rivals</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-1.5">
            {topRivals.length > 0 ? (
              topRivals.map((rival) => (
                <div
                  key={rival.id}
                  className="bg-[#241d4c] rounded-xl px-2.5 py-1.5 border border-[#4a4478]/60 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <TeamLogo
                      logoUrl={rival.logoUrl}
                      shortCode={rival.shortCode}
                      teamName={rival.name}
                      teamColor={rival.color || "#6b7280"}
                      className="w-5 h-5 rounded-md flex-shrink-0"
                      textClassName="text-[10px]"
                    />
                    <span className="text-xs text-[#e4e4e7] font-semibold truncate">
                      {rival.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-[#a8a0c4]">Purse:</span>
                    <span className="text-xs font-mono font-black text-emerald-400">
                      {formatShortIndianRupee(rival.purseRemaining)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-2 text-center text-xs text-[#a8a0c4]">
                Loading rival purses...
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom Actions ── */}
      <div className="flex-shrink-0 pt-2 border-t border-[#4a4478]/70 flex items-center gap-2">
        <button
          type="button"
          onClick={onViewSquad}
          className="flex-1 py-2 px-3 rounded-xl bg-[#2a2458] hover:bg-[#342e6b] border border-[#4a4478] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Users className="w-3.5 h-3.5 text-amber-400" />
          <span>My Squad</span>
        </button>
        <button
          type="button"
          onClick={onViewScout}
          className="flex-1 py-2 px-3 rounded-xl bg-[#2a2458] hover:bg-[#342e6b] border border-[#4a4478] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
        >
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          <span>Rivals</span>
        </button>
      </div>
    </motion.div>
  );
}
