import { memo } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";

type CurrentPlayer = {
  id: number;
  name: string;
  photoUrl?: string | null;
  jerseyNumber?: number | string | null;
};

/**
 * Large player photo card (left of the main display).
 *
 * Render isolation: rerenders only when the player identity/photo or
 * the leading team color changes. Per-bid currentBid changes touch the
 * sibling BidDisplay component but not this card, because we slice the
 * minimal shape needed via primitives.
 */
export const PlayerCard = memo(function PlayerCard({ player, teamColor }: {
  player: CurrentPlayer;
  teamColor: string;
}) {
  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, scale: 0.8, x: -60 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
      className="flex-shrink-0"
    >
      <div
        className="w-40 h-52 sm:w-52 sm:h-64 md:w-64 md:h-[21rem] lg:w-72 lg:h-80 xl:w-80 xl:h-[26rem] rounded-3xl border-4 overflow-hidden flex items-center justify-center relative"
        style={{
          borderColor: teamColor,
          boxShadow: `0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22`,
        }}
      >
        {player.photoUrl ? (
          <img src={player.photoUrl} alt={player.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-card flex flex-col items-center justify-center gap-3">
            <User className="w-24 h-24 text-muted-foreground opacity-20" />
            {player.jerseyNumber && (
              <span className="font-display font-black text-5xl text-muted-foreground opacity-30">
                #{player.jerseyNumber}
              </span>
            )}
          </div>
        )}
        {player.jerseyNumber && player.photoUrl && (
          <div
            className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-sm"
            style={{ backgroundColor: teamColor, color: "#000" }}
          >
            #{player.jerseyNumber}
          </div>
        )}
      </div>
    </motion.div>
  );
});
