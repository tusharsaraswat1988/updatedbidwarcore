import { memo } from "react";
import { motion } from "framer-motion";
import { User } from "lucide-react";
import { cldUrl } from "@/lib/cloudinary";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";

/**
 * Large player photo card (left of the main display).
 *
 * When a player has a tag, the border and glow switch to the tag's colour,
 * and a premium pill badge is anchored to the bottom of the frame.
 * All effects are static (no blur/shadow animation) — GPU-safe for TV and broadcast overlays.
 *
 * Render isolation: receives ONLY primitive props (id, name, photoUrl,
 * jerseyNumber, teamColor, playerTag). This is critical — `state.currentPlayer`
 * gets a fresh object reference on every SSE update, so passing the object
 * would defeat React.memo's shallow compare. By passing only primitives,
 * bid updates do NOT rerender this card.
 */
export const PlayerCard = memo(function PlayerCard({
  playerId,
  name,
  photoUrl,
  jerseyNumber,
  teamColor,
  playerTag,
}: {
  playerId: number;
  name: string;
  photoUrl: string | null | undefined;
  jerseyNumber: number | string | null | undefined;
  teamColor: string;
  playerTag?: string | null;
}) {
  const tag = getTagTheme(playerTag);
  const borderColor = tag?.color ?? teamColor;
  const boxShadow = tag
    ? `0 0 16px ${tag.glow}, 0 0 48px ${tag.glow}, 0 0 80px ${teamColor}22`
    : `0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22`;

  return (
    <motion.div
      key={playerId}
      initial={{ opacity: 0, scale: 0.8, x: -60 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      transition={{ duration: 0.5, type: "spring" }}
      className="flex-shrink-0 relative"
      style={{ paddingBottom: tag ? 18 : 0 }}
    >
      <div
        className="w-40 h-52 sm:w-52 sm:h-64 md:w-64 md:h-[21rem] lg:w-72 lg:h-80 xl:w-80 xl:h-[26rem] rounded-3xl border-4 overflow-hidden flex items-center justify-center relative"
        style={{ borderColor, boxShadow }}
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

      {/* Tag badge plate — sits below the photo frame, centred */}
      {tag && (
        <div
          className="absolute left-1/2 z-10 whitespace-nowrap"
          style={{
            bottom: 0,
            transform: "translateX(-50%)",
            padding: "5px 20px",
            borderRadius: 999,
            background: `linear-gradient(135deg, ${tag.bg}, rgba(0,0,0,0.55))`,
            border: `1.5px solid ${tag.border}`,
            boxShadow: `0 2px 18px ${tag.glow}`,
            animation: TAG_PULSE_ANIMATION,
          }}
        >
          <span style={{
            fontSize: "clamp(11px, 1.2vw, 15px)",
            fontWeight: 800,
            letterSpacing: "0.18em",
            color: tag.color,
            textTransform: "uppercase",
          }}>
            {tag.label}
          </span>
        </div>
      )}
    </motion.div>
  );
});
