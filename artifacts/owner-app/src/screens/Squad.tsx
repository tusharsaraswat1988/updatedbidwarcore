import { useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { ChevronLeft, User } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

interface Team {
  id: number;
  name: string;
  shortCode?: string | null;
  color?: string | null;
  purse: number;
  purseUsed?: number;
}

interface TeamPurse {
  teamId: number;
  purseRemaining: number;
  spendablePurse: number;
  playersBought?: number;
  purseUsed?: number;
}

interface Props {
  tournamentId: number;
  teamId: number;
  team: Team;
  teamPurse: TeamPurse | null;
  onBack: () => void;
}

export function Squad({ tournamentId, teamId, team, teamPurse, onBack }: Props) {
  const teamColor = team.color || "#F59E0B";

  const { data: allPlayers, isLoading } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const myPlayers = (allPlayers ?? [])
    .filter(p => p.teamId === teamId && (p.status === "sold" || p.status === "retained"))
    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));

  const purseUsed  = teamPurse?.purseUsed ?? team.purseUsed ?? 0;
  const spendable  = teamPurse?.spendablePurse ?? (team.purse - purseUsed);
  const count      = myPlayers.length;

  return (
    <div
      className="h-full flex flex-col bg-[#09090b] overflow-hidden"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}10 0%, transparent 50%), #09090b` }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-3 border-b border-[#27272a] flex-shrink-0">
        <button
          onClick={onBack}
          className="p-2 -ml-1.5 text-[#71717a] hover:text-white transition-colors rounded-lg"
          title="Back to bidding"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs flex-shrink-0"
          style={{ backgroundColor: `${teamColor}30`, color: teamColor, border: `2px solid ${teamColor}55` }}
        >
          {team.shortCode || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-sm leading-none truncate" style={{ color: teamColor }}>
            {team.name}
          </p>
          <p className="text-[10px] text-[#71717a] mt-0.5">My Squad</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 border-b border-[#27272a] flex-shrink-0">
        {[
          { label: "Players", value: String(count) },
          { label: "Spent",   value: formatShortIndianRupee(purseUsed) },
          { label: "Left",    value: formatShortIndianRupee(spendable) },
        ].map(({ label, value }) => (
          <div key={label} className="text-center py-3 border-r border-[#27272a] last:border-r-0">
            <p className="font-display font-bold text-xl leading-none text-white">{value}</p>
            <p className="text-[9px] text-[#52525b] uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${teamColor} transparent transparent transparent` }} />
          </div>
        ) : myPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-56 text-[#52525b]">
            <User className="w-10 h-10 mb-2 opacity-30" />
            <p className="text-sm font-medium">No players yet</p>
            <p className="text-xs text-[#3f3f46] mt-1">Players you win will appear here</p>
          </div>
        ) : (
          <ul>
            {myPlayers.map((player, idx) => (
              <li
                key={player.id}
                className="flex items-center gap-3 px-4 py-3.5 border-b border-[#18181b]"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold flex-shrink-0 tabular-nums"
                  style={{ backgroundColor: `${teamColor}20`, color: teamColor }}
                >
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{player.name}</p>
                  <p className="text-[11px] text-[#71717a] capitalize mt-0.5">
                    {player.role || "Player"}
                    {player.status === "retained" && (
                      <span className="ml-2 text-amber-400 font-semibold">Retained</span>
                    )}
                  </p>
                </div>
                {player.soldPrice != null && (
                  <p className="text-sm font-bold flex-shrink-0" style={{ color: teamColor }}>
                    {formatIndianRupee(player.soldPrice)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-[10px] text-[#3f3f46] uppercase tracking-widest py-3 flex-shrink-0 border-t border-[#27272a]">
        Powered by BidWar
      </p>
    </div>
  );
}
