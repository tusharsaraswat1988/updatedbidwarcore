import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Users, UserX, ChevronDown, ChevronRight, Zap, AlertCircle } from "lucide-react";
import { useGetTeamScout, getGetTeamScoutQueryKey } from "@workspace/api-client-react";
import { formatShortIndianRupee } from "@/lib/format";

interface Props {
  tournamentId: number;
  teamId: number;
  teamColor: string;
  onBack: () => void;
  auctionStarted: boolean;
}

type Tab = "teams" | "unsold";

function TeamRow({
  team,
  isOwn,
  teamColor,
}: {
  team: {
    id: number;
    name: string;
    shortCode?: string | null;
    color?: string | null;
    purse: number;
    purseRemaining: number;
    spendablePurse: number;
    reservePurse: number;
    slotsRequired: number;
    playersBought: number;
    maximumSquadSize: number;
    maxBidCapacity: number;
    players: { id: number; name: string; role?: string | null; status: string; soldPrice?: number | null; isNonPlayingMember?: boolean }[];
  };
  isOwn: boolean;
  teamColor: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = isOwn ? teamColor : (team.color || "#6b7280");
  const purseUsed = team.purse - team.purseRemaining;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: isOwn ? `${color}40` : "#27272a" }}
    >
      <button
        className="w-full text-left px-4 py-3.5 flex items-center gap-3"
        style={{ backgroundColor: isOwn ? `${color}10` : "#18181b" }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Team badge */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-xs flex-shrink-0"
          style={{ backgroundColor: `${color}20`, color, border: `2px solid ${color}44` }}
        >
          {team.shortCode || "?"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-display font-bold text-sm truncate" style={{ color: isOwn ? color : "#fafafa" }}>
              {team.name}
            </p>
            {isOwn && (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide flex-shrink-0"
                style={{ backgroundColor: `${color}22`, color }}>
                YOU
              </span>
            )}
          </div>
          <p className="text-xs text-[#52525b] mt-0.5">{team.playersBought} bought{team.maximumSquadSize ? ` / ${team.maximumSquadSize} max` : ""}</p>
        </div>

        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <p className="font-display font-black text-sm" style={{ color: isOwn ? color : "#e4e4e7" }}>
            {formatShortIndianRupee(team.spendablePurse)}
          </p>
          <p className="text-[10px] text-[#52525b] uppercase tracking-wide">spendable</p>
        </div>

        <div className="ml-2 flex-shrink-0">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-[#52525b]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#52525b]" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            {/* Purse breakdown */}
            <div className="px-4 py-3 border-t border-[#27272a] bg-[#09090b]">
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { label: "Total", value: formatShortIndianRupee(team.purse) },
                  { label: "Spent", value: formatShortIndianRupee(purseUsed) },
                  { label: "Reserved", value: formatShortIndianRupee(team.reservePurse) },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center rounded-xl bg-[#18181b] py-2">
                    <p className="font-display font-bold text-sm text-[#e4e4e7]">{value}</p>
                    <p className="text-[10px] text-[#52525b] uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>

              {/* Max bid capacity */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3"
                style={{ backgroundColor: `${color}12`, border: `1px solid ${color}30` }}>
                <Zap className="w-4 h-4 flex-shrink-0" style={{ color }} />
                <p className="text-sm font-semibold" style={{ color }}>
                  Max bid capacity: {formatShortIndianRupee(team.maxBidCapacity)}
                </p>
              </div>

              {team.slotsRequired > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl mb-3 bg-amber-500/10 border border-amber-500/25">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                  <p className="text-xs text-amber-400 font-semibold">
                    {team.slotsRequired} slot{team.slotsRequired !== 1 ? "s" : ""} still needed — {formatShortIndianRupee(team.reservePurse)} locked
                  </p>
                </div>
              )}

              {/* Squad list */}
              {team.players.length === 0 ? (
                <p className="text-xs text-[#3f3f46] text-center py-2">No players yet</p>
              ) : (
                <div className="space-y-1.5">
                  {team.players.map((p) => (
                    <div key={p.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-[#18181b]">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                      <span className="text-sm text-[#e4e4e7] font-medium flex-1 min-w-0 truncate">{p.name}</span>
                      {p.role && <span className="text-[10px] text-[#52525b] flex-shrink-0">{p.role}</span>}
                      {p.isNonPlayingMember && (
                        <span className="text-[10px] text-[#52525b] flex-shrink-0">NPM</span>
                      )}
                      {p.soldPrice != null && (
                        <span className="text-[11px] font-semibold text-[#a1a1aa] flex-shrink-0">
                          {formatShortIndianRupee(p.soldPrice)}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Scout({ tournamentId, teamId, teamColor, onBack, auctionStarted }: Props) {
  const [tab, setTab] = useState<Tab>("teams");

  const { data, isLoading, isError } = useGetTeamScout(tournamentId, {
    query: {
      queryKey: getGetTeamScoutQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 30000,
    },
  });

  const ownTeam = data?.teams.find((t) => t.id === teamId);
  const rivals  = data?.teams.filter((t) => t.id !== teamId) ?? [];
  const sortedTeams = ownTeam ? [ownTeam, ...rivals] : (data?.teams ?? []);

  // Group unsold players by category
  type UnsoldPlayer = { id: number; name: string; role?: string | null; basePrice: number; categoryId?: number | null; categoryName?: string | null; categoryColor?: string | null };
  type GroupedCategory = { name: string | null; color: string | null; players: UnsoldPlayer[] };
  const categoryGroups: GroupedCategory[] = [];
  if (data?.unsoldPlayers) {
    for (const pl of data.unsoldPlayers) {
      const key = pl.categoryName ?? "__none__";
      let grp = categoryGroups.find((g) => (g.name ?? "__none__") === key);
      if (!grp) {
        grp = { name: pl.categoryName ?? null, color: pl.categoryColor ?? null, players: [] };
        categoryGroups.push(grp);
      }
      grp.players.push(pl);
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom">
      {/* Auto-return banner */}
      <AnimatePresence>
        {auctionStarted && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500/20 border-b border-green-500/30"
          >
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <p className="text-sm font-bold text-green-400">Player going live — returning to bid screen...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-3 border-b border-[#27272a] flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-[#71717a] hover:text-white transition-colors rounded-xl hover:bg-[#18181b] active:scale-90 flex-shrink-0"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-lg text-white leading-none">Scout</p>
          <p className="text-xs text-[#52525b] mt-0.5">Rival intelligence</p>
        </div>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center font-display font-black text-xs flex-shrink-0"
          style={{ backgroundColor: `${teamColor}20`, color: teamColor, border: `2px solid ${teamColor}44` }}
        >
          <Users className="w-4 h-4" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex flex-shrink-0 border-b border-[#27272a] bg-[#09090b]">
        {(["teams", "unsold"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-bold uppercase tracking-wide transition-colors ${
              tab === t ? "text-white border-b-2" : "text-[#52525b] border-b-2 border-transparent"
            }`}
            style={tab === t ? { borderColor: teamColor, color: teamColor } : {}}
          >
            {t === "teams" ? (
              <span className="flex items-center justify-center gap-2">
                <Users className="w-4 h-4" />
                Teams {data ? `(${data.teams.length})` : ""}
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <UserX className="w-4 h-4" />
                Unsold {data ? `(${data.unsoldPlayers.length})` : ""}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: teamColor, borderTopColor: "transparent" }} />
          </div>
        )}
        {isError && (
          <div className="flex items-center justify-center h-40 px-6 text-center">
            <p className="text-sm text-[#52525b]">Failed to load scout data. Pull down to retry.</p>
          </div>
        )}

        {/* Teams tab */}
        {!isLoading && !isError && tab === "teams" && (
          <div className="px-4 py-4 space-y-3">
            {sortedTeams.length === 0 && (
              <p className="text-center text-sm text-[#52525b] py-10">No teams in this tournament yet.</p>
            )}
            {sortedTeams.map((team) => (
              <TeamRow
                key={team.id}
                team={team}
                isOwn={team.id === teamId}
                teamColor={teamColor}
              />
            ))}
          </div>
        )}

        {/* Unsold tab */}
        {!isLoading && !isError && tab === "unsold" && (
          <div className="px-4 py-4 space-y-5">
            {data?.unsoldPlayers.length === 0 && (
              <p className="text-center text-sm text-[#52525b] py-10">No unsold players.</p>
            )}
            {categoryGroups.map((grp) => (
              <div key={grp.name ?? "other"}>
                {grp.name && (
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: grp.color || "#6b7280" }} />
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: grp.color || "#6b7280" }}>
                      {grp.name}
                    </p>
                    <div className="flex-1 h-px bg-[#27272a]" />
                    <span className="text-xs text-[#52525b]">{grp.players.length}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  {grp.players.map((pl) => (
                    <div
                      key={pl.id}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#18181b] border border-[#27272a]"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#e4e4e7] truncate">{pl.name}</p>
                        {pl.role && <p className="text-[10px] text-[#52525b] mt-0.5">{pl.role}</p>}
                      </div>
                      <p className="text-sm font-bold text-[#a1a1aa] flex-shrink-0">
                        {formatShortIndianRupee(pl.basePrice)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
