import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import { AuctionCountdown } from "./auction-countdown";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";

/**
 * Right column of the main broadcast — player name, specs, current bid,
 * leading team chip, server countdown, base price + increment row.
 *
 * Render isolation:
 *  - Receives flat primitive props so React.memo's shallow compare
 *    catches everything that should rerender it. The parent passes
 *    primitives (not the live `currentPlayer` object) because that
 *    object identity changes on every SSE update.
 *  - The countdown is mounted as <AuctionCountdown/>, whose internal
 *    interval keeps tick rerenders inside that subtree only — they
 *    never propagate to BidDisplay, PlayerCard, or DisplayShell.
 *  - The bid pulse (`AnimatePresence mode="wait"` on currentBid) is
 *    keyed on `currentBid`, so it animates exactly once per bid change
 *    with no spillover to siblings.
 */
export const BidDisplay = memo(function BidDisplay({
  playerId,
  playerName,
  playerBasePrice,
  playerAvailabilityDates,
  playerAchievements,
  playerSpecs,
  tournamentMatchDates,
  teamColor,
  currentBid,
  currentBidTeamId,
  currentBidTeamName,
  currentBidTeamLogoUrl,
  bidIncrement,
  timerEndsAt,
  timerType,
  playerTag,
}: {
  playerId: number;
  playerName: string;
  playerBasePrice: number;
  playerAvailabilityDates: string | null | undefined;
  playerAchievements: string | null | undefined;
  playerSpecs: string[];
  tournamentMatchDates: string | null | undefined;
  teamColor: string;
  currentBid: number | null | undefined;
  currentBidTeamId: number | null | undefined;
  currentBidTeamName: string | null | undefined;
  currentBidTeamLogoUrl: string | null | undefined;
  bidIncrement: number | null | undefined;
  timerEndsAt: string | null | undefined;
  timerType: string | null | undefined;
  playerTag?: string | null;
}) {
  const tag = getTagTheme(playerTag);
  return (
    <motion.div
      key={`info-${playerId}`}
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1, type: "spring" }}
      className="flex-1 text-center md:text-left space-y-4"
    >
      <div>
        {(playerSpecs.length > 0 || tag) && (
          <div className="flex items-center gap-3 flex-wrap mb-2">
            {playerSpecs.length > 0 && (
              <p className="text-xs md:text-sm font-mono text-muted-foreground uppercase tracking-widest">
                {playerSpecs.join(" · ")}
              </p>
            )}
            {tag && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 12px",
                  borderRadius: 999,
                  fontSize: "clamp(10px, 1vw, 13px)",
                  fontWeight: 800,
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  background: tag.bg,
                  border: `1.5px solid ${tag.border}`,
                  color: tag.color,
                  boxShadow: `0 0 10px ${tag.glow}`,
                  animation: TAG_PULSE_ANIMATION,
                  flexShrink: 0,
                }}
              >
                {tag.label}
              </span>
            )}
          </div>
        )}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-display font-black tracking-tight leading-none text-white">
          {playerName}
        </h1>
        {(() => {
          const matchDates = (tournamentMatchDates || "").split(",").filter(Boolean) as string[];
          if (matchDates.length === 0) return null;
          const availSet = new Set<string>((playerAvailabilityDates || "").split(",").filter(Boolean) as string[]);
          return (
            <div className="flex items-center gap-2 flex-wrap mt-2">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              {matchDates.map((iso: string) => {
                const avail = availSet.has(iso);
                const label = new Date(iso + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
                return (
                  <span
                    key={iso}
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${avail ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-400 line-through opacity-60"}`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          );
        })()}
      </div>

      <div>
        <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Current Bid</p>
        <AnimatePresence mode="wait">
          <motion.p
            key={currentBid ?? 0}
            initial={{ scale: 0.6, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 1.2, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.5 }}
            className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black leading-none"
            style={{ color: teamColor, textShadow: `0 0 80px ${teamColor}99` }}
          >
            {formatIndianRupee(currentBid || 0)}
          </motion.p>
        </AnimatePresence>
      </div>

      {currentBidTeamName ? (
        <motion.div
          key={currentBidTeamId ?? 0}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2"
          style={{
            borderColor: teamColor,
            backgroundColor: `${teamColor}18`,
            boxShadow: `0 0 40px ${teamColor}44`,
          }}
        >
          {currentBidTeamLogoUrl ? (
            <img
              src={cldUrl(currentBidTeamLogoUrl, "teamLogo")}
              alt={currentBidTeamName}
              className="w-12 h-12 object-contain rounded-lg flex-shrink-0"
              style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
              loading="eager"
              decoding="async"
              onError={e => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="w-4 h-4 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: teamColor }} />
          )}
          <span className="text-xl md:text-3xl font-display font-black" style={{ color: teamColor }}>
            {currentBidTeamName}
          </span>
        </motion.div>
      ) : (
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border/50 text-muted-foreground">
          <span className="text-lg font-semibold">Waiting for first bid...</span>
        </div>
      )}

      <AuctionCountdown timerEndsAt={timerEndsAt} timerType={timerType} />

      <p className="text-sm text-muted-foreground">
        Base Price: <span className="font-semibold text-foreground">{formatIndianRupee(playerBasePrice)}</span>
        {bidIncrement && (
          <span className="ml-3">· Increment: <span className="font-semibold text-foreground">{formatIndianRupee(bidIncrement)}</span></span>
        )}
        {playerAchievements && (
          <span className="ml-3 text-yellow-400">· {playerAchievements}</span>
        )}
      </p>
    </motion.div>
  );
});
