import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";

interface Props {
  teamName: string;
  teamColor: string;
  tournamentName?: string;
  auctionDate?: string | null;
  playersBought?: number;
  purseSpent?: number;
}

export function Completed({ teamName, teamColor, tournamentName, auctionDate, playersBought, purseSpent }: Props) {
  const date = auctionDate
    ? new Date(auctionDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div
      className="h-full flex flex-col items-center justify-center px-6 bg-[#09090b]"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}12 0%, transparent 55%), #09090b` }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, type: "spring" }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        <div className="space-y-4">
          <div
            className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center"
            style={{ backgroundColor: `${teamColor}20`, border: `2px solid ${teamColor}50` }}
          >
            <CheckCircle2 className="w-12 h-12" style={{ color: teamColor }} />
          </div>
          <div className="space-y-1">
            <h1 className="font-display font-black text-3xl text-white leading-tight">
              {tournamentName || teamName}
            </h1>
            {date && <p className="text-sm text-[#71717a]">{date}</p>}
          </div>
        </div>

        {/* Stats */}
        {(playersBought != null || purseSpent != null) && (
          <div className="grid grid-cols-2 gap-3">
            {playersBought != null && (
              <div
                className="rounded-2xl p-4 text-center"
                style={{ backgroundColor: `${teamColor}12`, border: `1px solid ${teamColor}30` }}
              >
                <p className="font-display font-black text-3xl" style={{ color: teamColor }}>{playersBought}</p>
                <p className="text-xs text-[#71717a] mt-1 uppercase tracking-wider">Players</p>
              </div>
            )}
            {purseSpent != null && (
              <div
                className="rounded-2xl p-4 text-center"
                style={{ backgroundColor: `${teamColor}12`, border: `1px solid ${teamColor}30` }}
              >
                <p className="font-display font-black text-2xl" style={{ color: teamColor }}>
                  {formatShortIndianRupee(purseSpent)}
                </p>
                <p className="text-xs text-[#71717a] mt-1 uppercase tracking-wider">Spent</p>
              </div>
            )}
          </div>
        )}

        <div
          className="rounded-2xl border px-6 py-5 space-y-2"
          style={{ borderColor: `${teamColor}30`, backgroundColor: `${teamColor}08` }}
        >
          <p className="font-display font-bold text-xl text-white">Auction Concluded</p>
          <p className="text-sm text-[#71717a] leading-relaxed">
            Contact the tournament operator for any further queries.
          </p>
        </div>

        <p className="text-[11px] text-[#3f3f46] uppercase tracking-widest">Powered by BidWar</p>
      </motion.div>
    </div>
  );
}
