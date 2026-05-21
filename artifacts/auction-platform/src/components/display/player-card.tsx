import { memo } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { cldUrl } from "@/lib/cloudinary";

/**
 * Large player photo card (left of the main display).
 *
 * Render isolation: receives ONLY primitive props (id, name, photoUrl,
 * jerseyNumber, teamColor). This is critical — `state.currentPlayer`
 * gets a fresh object reference on every SSE update (the auction
 * socket writes `setQueryData(key, msg.state)` with a new top-level
 * object), so passing the object would defeat React.memo's shallow
 * compare. By passing only primitives, bid updates (which change
 * `currentBid`/`currentBidTeamId` but not these fields) do NOT
 * rerender this card.
 */
export const PlayerCard = memo(function PlayerCard({
  playerId,
  name,
  photoUrl,
  jerseyNumber,
  teamColor,
}: {
  playerId: number;
  name: string;
  photoUrl: string | null | undefined;
  jerseyNumber: number | string | null | undefined;
  teamColor: string;
}) {
  return (
    <motion.div
      key={playerId}
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
        {photoUrl ? (
          <img
            src={cldUrl(photoUrl, "playerCard")}
            alt={name}
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
        ) : (
          <div className="w-full h-full bg-card flex flex-col items-center justify-center gap-3">
            <User className="w-24 h-24 text-muted-foreground opacity-20" />
            {jerseyNumber && (
              <span className="font-display font-black text-5xl text-muted-foreground opacity-30">
                #{jerseyNumber}
              </span>
            )}
          </div>
        )}
        {jerseyNumber && photoUrl && (
          <div
            className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-sm"
            style={{ backgroundColor: teamColor, color: "#000" }}
          >
            #{jerseyNumber}
          </div>
        )}
      </div>
    </motion.div>
  );
});
