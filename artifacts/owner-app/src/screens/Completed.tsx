import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";
import { useBranding } from "@/hooks/useBranding";

interface Props {
  teamName: string;
  teamColor: string;
  tournamentName?: string;
  auctionDate?: string | null;
  playersBought?: number;
  purseSpent?: number;
}

export function Completed({ teamName, teamColor, tournamentName, auctionDate, playersBought, purseSpent }: Props) {
  const { brandName, logos, poweredByText, miniBrandText } = useBranding();

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
        {/* Brand */}
        <div className="flex items-center justify-center gap-2">
          {logos.mini ? (
            <img src={logos.mini} alt={brandName} className="h-8 w-auto opacity-60" />
          ) : (
            <div className="w-8 h-8 rounded-lg flex items-center justify-center font-display font-black text-xs bg-amber-400/20 text-amber-400 border border-amber-400/30 opacity-60">
              {miniBrandText}
            </div>
          )}
          <span className="font-display font-black text-lg text-white/60 tracking-wide">{brandName}</span>
        </div>

        <div className="space-y-4">
          <div
            className="w-28 h-28 rounded-3xl mx-auto flex items-center justify-center"
            style={{ backgroundColor: `${teamColor}20`, border: `3px solid ${teamColor}50` }}
          >
            <CheckCircle2 className="w-16 h-16" style={{ color: teamColor }} />
          </div>
          <div className="space-y-1">
            <h1 className="font-display font-black text-4xl text-white leading-tight">
              {tournamentName || teamName}
            </h1>
            {date && <p className="text-lg text-[#71717a]">{date}</p>}
          </div>
        </div>

        {/* Stats */}
        {(playersBought != null || purseSpent != null) && (
          <div className="grid grid-cols-2 gap-4">
            {playersBought != null && (
              <div
                className="rounded-2xl p-5 text-center"
                style={{ backgroundColor: `${teamColor}12`, border: `1px solid ${teamColor}30` }}
              >
                <p className="font-display font-black text-5xl" style={{ color: teamColor }}>{playersBought}</p>
                <p className="text-sm text-[#71717a] mt-2 uppercase tracking-wider">Players Won</p>
              </div>
            )}
            {purseSpent != null && (
              <div
                className="rounded-2xl p-5 text-center"
                style={{ backgroundColor: `${teamColor}12`, border: `1px solid ${teamColor}30` }}
              >
                <p className="font-display font-black text-3xl" style={{ color: teamColor }}>
                  {formatShortIndianRupee(purseSpent)}
                </p>
                <p className="text-sm text-[#71717a] mt-2 uppercase tracking-wider">Total Spent</p>
              </div>
            )}
          </div>
        )}

        <div
          className="rounded-2xl border px-6 py-5 space-y-2"
          style={{ borderColor: `${teamColor}30`, backgroundColor: `${teamColor}08` }}
        >
          <p className="font-display font-bold text-2xl text-white">Auction Concluded</p>
          <p className="text-base text-[#71717a] leading-relaxed">
            Contact the tournament operator for any further queries.
          </p>
        </div>

        <p className="text-sm text-[#3f3f46] uppercase tracking-widest">{poweredByText}</p>
      </motion.div>
    </div>
  );
}
