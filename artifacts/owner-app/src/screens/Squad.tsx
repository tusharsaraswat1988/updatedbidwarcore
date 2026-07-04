import { useListPlayers, getListPlayersQueryKey } from "@workspace/api-client-react";
import { ChevronLeft, User, ShieldUser } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";
import { useBranding } from "@/hooks/useBranding";
import { resolveHeaderBrandLogoUrl } from "@/lib/brand-assets";
import { TeamLogo } from "@/components/TeamLogo";

const BIDWAR_AMBER = "#F59E0B";

interface Team {
  id: number;
  name: string;
  shortCode?: string | null;
  color?: string | null;
  logoUrl?: string | null;
  purse: number;
  purseUsed?: number;
}

interface TeamPurse {
  teamId: number;
  originalPurse?: number;
  boosterTotal?: number;
  effectiveCapacity?: number;
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
  const { poweredByText, brandName, logos, iconVersion } = useBranding();
  const brandLogoSrc = resolveHeaderBrandLogoUrl(logos, iconVersion);

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
  const capacity = teamPurse?.effectiveCapacity ?? team.purse;
  const boosterTotal = teamPurse?.boosterTotal ?? 0;
  const originalPurse = teamPurse?.originalPurse ?? team.purse;
  const spendable = teamPurse?.spendablePurse ?? (capacity - purseUsed);
  const count     = myPlayers.length;

  return (
    <div
      className="auction-surface h-full min-h-0 flex flex-col bg-[#09090b] overflow-hidden safe-top safe-bottom select-none"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}10 0%, transparent 50%), #09090b` }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="border-b border-[#27272a] flex-shrink-0">
        <div className="flex items-center justify-center px-4 py-2.5 bg-[#0a0a0c] border-b border-[#27272a]/70">
          <img
            src={brandLogoSrc}
            alt={brandName}
            className="h-10 w-auto max-w-[min(280px,70vw)] object-contain object-center"
            decoding="async"
          />
        </div>
        <div className="flex items-center gap-4 px-4 pt-3 pb-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-[#71717a] hover:text-white transition-colors p-2 -ml-2 rounded-xl hover:bg-[#18181b] active:scale-95"
            title="Back to bidding"
          >
            <ChevronLeft className="w-7 h-7" />
          </button>
          <TeamLogo
            logoUrl={team.logoUrl}
            shortCode={team.shortCode}
            teamName={team.name}
            teamColor={teamColor}
            className="w-12 h-12 rounded-xl"
            textClassName="text-base"
          />
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-xl leading-none truncate" style={{ color: teamColor }}>
              {team.name}
            </p>
            <p className="text-sm text-[#71717a] mt-0.5">My Squad</p>
          </div>
          <ShieldUser className="w-7 h-7 flex-shrink-0" style={{ color: teamColor }} strokeWidth={2.25} />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 border-b border-[#27272a] flex-shrink-0">
        {[
          { label: "Players", value: String(count) },
          { label: "Spent",   value: formatShortIndianRupee(purseUsed) },
          { label: "Left",    value: formatShortIndianRupee(spendable) },
        ].map(({ label, value }) => (
          <div key={label} className="text-center py-4 border-r border-[#27272a] last:border-r-0">
            <p
              className="font-display font-black text-3xl leading-none"
              style={{ color: teamColor }}
            >
              {value}
            </p>
            <p className="text-xs text-[#52525b] uppercase tracking-wider mt-1.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-b border-[#27272a] flex-shrink-0">
        <div className="rounded-xl border border-[#27272a] bg-[#18181b] p-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-[#52525b] uppercase tracking-wider">Original</p>
            <p className="text-sm font-mono font-semibold mt-1" style={{ color: teamColor }}>{formatShortIndianRupee(originalPurse)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#52525b] uppercase tracking-wider">Boosters</p>
            <p className="text-sm font-mono font-semibold mt-1" style={{ color: BIDWAR_AMBER }}>+{formatShortIndianRupee(boosterTotal)}</p>
          </div>
          <div>
            <p className="text-[10px] text-[#52525b] uppercase tracking-wider">Total Purse</p>
            <p className="text-sm font-mono font-semibold mt-1" style={{ color: teamColor }}>{formatShortIndianRupee(capacity)}</p>
          </div>
        </div>
      </div>

      {/* Player list — scrolls inside fixed header/footer when squad grows */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain touch-pan-y">
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
                className="squad-player-row flex items-center gap-4 px-5 py-4 border-b border-[#18181b] active:bg-[#18181b] transition-colors"
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
