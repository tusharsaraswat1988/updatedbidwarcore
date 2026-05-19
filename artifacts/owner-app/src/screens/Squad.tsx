import { useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { ChevronLeft, User, Trophy } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { useBranding } from "@/hooks/useBranding";

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
  const { poweredByText } = useBranding();

  const { data: allPlayers, isLoading } = useListPlayers(tournamentId, {
    query: {
      queryKey: getListPlayersQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const myPlayers = (allPlayers ?? [])
    .filter(p => p.teamId === teamId && (p.status === "sold" || p.status === "retained"))
    .sort((a, b) => (b.soldPrice ?? 0) - (a.soldPrice ?? 0));

  const purseUsed = teamPurse?.purseUsed ?? team.purseUsed ?? 0;
  const spendable = teamPurse?.spendablePurse ?? (team.purse - purseUsed);
  const count     = myPlayers.length;

  return (
    <div
      className="h-full flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}10 0%, transparent 50%), #09090b` }}
    >
      {/* Header */}
      <div className="flex items-center gap-4 px-4 pt-4 pb-4 border-b border-[#27272a] flex-shrink-0">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-[#71717a] hover:text-white transition-colors p-2 -ml-2 rounded-xl hover:bg-[#18181b] active:scale-95"
          title="Back to bidding"
        >
          <ChevronLeft className="w-7 h-7" />
        </button>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-base flex-shrink-0"
          style={{ backgroundColor: `${teamColor}30`, color: teamColor, border: `2px solid ${teamColor}55` }}
        >
          {team.shortCode || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-xl leading-none truncate" style={{ color: teamColor }}>
            {team.name}
          </p>
          <p className="text-sm text-[#71717a] mt-0.5">My Squad</p>
        </div>
        <Trophy className="w-7 h-7 flex-shrink-0" style={{ color: teamColor }} />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 border-b border-[#27272a] flex-shrink-0">
        {[
          { label: "Players", value: String(count), accent: true },
          { label: "Spent",   value: formatShortIndianRupee(purseUsed), accent: false },
          { label: "Left",    value: formatShortIndianRupee(spendable), accent: true },
        ].map(({ label, value, accent }) => (
          <div key={label} className="text-center py-4 border-r border-[#27272a] last:border-r-0">
            <p
              className="font-display font-black text-3xl leading-none"
              style={accent ? { color: teamColor } : { color: "#ffffff" }}
            >
              {value}
            </p>
            <p className="text-xs text-[#52525b] uppercase tracking-wider mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div
              className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: `${teamColor}40`, borderTopColor: teamColor }}
            />
          </div>
        ) : myPlayers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-[#52525b] px-8 text-center">
            <User className="w-16 h-16 mb-4 opacity-20" />
            <p className="text-lg font-semibold">No players yet</p>
            <p className="text-sm text-[#3f3f46] mt-1">Players you win will appear here</p>
          </div>
        ) : (
          <ul className="py-2">
            {myPlayers.map((player, idx) => (
              <li
                key={player.id}
                className="flex items-center gap-4 px-5 py-4 border-b border-[#18181b] active:bg-[#18181b] transition-colors"
              >
                {/* Rank */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0 tabular-nums"
                  style={{ backgroundColor: `${teamColor}20`, color: teamColor }}
                >
                  {idx + 1}
                </div>

                {/* Photo placeholder or initial */}
                <div className="w-12 h-14 rounded-xl bg-[#27272a] border border-[#3f3f46] flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {(player as { photoUrl?: string | null }).photoUrl ? (
                    <img
                      src={(player as { photoUrl?: string | null }).photoUrl!}
                      alt={player.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-display font-black text-lg text-[#52525b]">
                      {player.name?.charAt(0) || "?"}
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white truncate leading-tight">{player.name}</p>
                  <p className="text-sm text-[#71717a] capitalize mt-0.5 flex items-center gap-2">
                    {player.role || "Player"}
                    {player.status === "retained" && (
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wide bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/30">
                        Retained
                      </span>
                    )}
                  </p>
                </div>

                {/* Price */}
                {player.soldPrice != null && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-black" style={{ color: teamColor }}>
                      {formatIndianRupee(player.soldPrice)}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-center text-sm text-[#3f3f46] uppercase tracking-widest py-4 flex-shrink-0 border-t border-[#27272a]">
        {poweredByText}
      </p>
    </div>
  );
}
