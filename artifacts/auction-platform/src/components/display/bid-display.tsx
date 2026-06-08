import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar } from "lucide-react";
import { formatIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import { AuctionCountdown } from "./auction-countdown";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";
import { BROADCAST_LABEL_CLASS, BROADCAST_META_CLASS } from "@/lib/display-broadcast-layout";

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
  freezeBidTimer = false,
  disableBidAnimations = false,
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
  freezeBidTimer?: boolean;
  disableBidAnimations?: boolean;
}) {
  const tag = getTagTheme(playerTag);
  const prevBidRef = useRef<number | null>(currentBid ?? null);
  const [bidDelta, setBidDelta] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevBidRef.current;
    const next = currentBid ?? 0;
    if (
      !disableBidAnimations &&
      prev != null &&
      next > prev &&
      currentBidTeamId
    ) {
      setBidDelta(next - prev);
      const timer = setTimeout(() => setBidDelta(null), 1000);
      prevBidRef.current = next;
      return () => clearTimeout(timer);
    }
    prevBidRef.current = next;
    return undefined;
  }, [currentBid, currentBidTeamId, disableBidAnimations]);

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
              <p className={`${BROADCAST_LABEL_CLASS} text-muted-foreground`}>
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
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-[5.5rem] 2xl:text-[6.5rem] font-display font-black tracking-tight leading-none text-white">
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

      <div className="relative">
        <p className={`${BROADCAST_LABEL_CLASS} text-muted-foreground mb-1`}>Current Bid</p>
        {disableBidAnimations ? (
          <p
            className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.75rem] xl:text-[6.75rem] 2xl:text-[7.5rem] font-display font-black leading-none"
            style={{ color: teamColor, textShadow: `0 0 80px ${teamColor}99` }}
          >
            {formatIndianRupee(currentBid || 0)}
          </p>
        ) : (
          <div className="relative inline-block">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentBid ?? 0}
                initial={{ scale: 0.55, opacity: 0, y: 24 }}
                animate={{
                  scale: [1.12, 1],
                  opacity: 1,
                  y: 0,
                }}
                exit={{ scale: 1.15, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 22 }}
                className="text-5xl sm:text-6xl md:text-7xl lg:text-[5.75rem] xl:text-[6.75rem] 2xl:text-[7.5rem] font-display font-black leading-none"
                style={{
                  color: teamColor,
                  textShadow: `0 0 80px ${teamColor}99, 0 0 24px ${teamColor}`,
                }}
              >
                {formatIndianRupee(currentBid || 0)}
              </motion.p>
            </AnimatePresence>
            <AnimatePresence>
              {bidDelta != null && bidDelta > 0 ? (
                <motion.span
                  key={bidDelta}
                  initial={{ opacity: 0, y: 8, scale: 0.85 }}
                  animate={{ opacity: 1, y: -4, scale: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="absolute -top-2 left-full ml-3 md:ml-4 whitespace-nowrap px-3 py-1 rounded-full text-sm md:text-base font-display font-black border-2"
                  style={{
                    color: teamColor,
                    borderColor: `${teamColor}88`,
                    backgroundColor: `${teamColor}22`,
                    boxShadow: `0 0 24px ${teamColor}66`,
                  }}
                >
                  +{formatIndianRupee(bidDelta)}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        )}
      </div>

      {currentBidTeamName ? (
        disableBidAnimations ? (
          <div
            className="inline-flex items-center gap-4 md:gap-5 px-7 py-4 md:px-10 md:py-5 rounded-2xl md:rounded-3xl border-[3px]"
            style={{
              borderColor: teamColor,
              backgroundColor: `${teamColor}22`,
              boxShadow: `0 0 48px ${teamColor}55, 0 0 96px ${teamColor}22`,
            }}
          >
            {currentBidTeamLogoUrl ? (
              <img
                src={cldUrl(currentBidTeamLogoUrl, "teamLogo")}
                alt={currentBidTeamName}
                className="w-14 h-14 md:w-20 md:h-20 lg:w-24 lg:h-24 object-contain rounded-xl flex-shrink-0"
                style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.45))" }}
                loading="eager"
                decoding="async"
                onError={e => (e.currentTarget.style.display = "none")}
              />
            ) : (
              <div className="w-5 h-5 md:w-6 md:h-6 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />
            )}
            <span className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-display font-black leading-tight" style={{ color: teamColor, textShadow: `0 0 24px ${teamColor}55` }}>
              {currentBidTeamName}
            </span>
          </div>
        ) : (
        <motion.div
          key={currentBidTeamId ?? 0}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          className="inline-flex items-center gap-4 md:gap-5 px-7 py-4 md:px-10 md:py-5 rounded-2xl md:rounded-3xl border-[3px]"
          style={{
            borderColor: teamColor,
            backgroundColor: `${teamColor}22`,
            boxShadow: `0 0 48px ${teamColor}55, 0 0 96px ${teamColor}22`,
          }}
        >
          {currentBidTeamLogoUrl ? (
            <img
              src={cldUrl(currentBidTeamLogoUrl, "teamLogo")}
              alt={currentBidTeamName}
              className="w-14 h-14 md:w-20 md:h-20 lg:w-24 lg:h-24 object-contain rounded-xl flex-shrink-0"
              style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.45))" }}
              loading="eager"
              decoding="async"
              onError={e => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: teamColor }} />
          )}
          <span className="text-2xl md:text-4xl lg:text-5xl xl:text-6xl font-display font-black leading-tight" style={{ color: teamColor, textShadow: `0 0 24px ${teamColor}55` }}>
            {currentBidTeamName}
          </span>
        </motion.div>
        )
      ) : (
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border/50 text-muted-foreground">
          <span className="text-lg font-semibold">Waiting for first bid...</span>
        </div>
      )}

      {freezeBidTimer ? (
        timerEndsAt ? (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-yellow-500/35 bg-yellow-500/10">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-400/90">Timer Paused</span>
          </div>
        ) : null
      ) : (
        <AuctionCountdown timerEndsAt={timerEndsAt} timerType={timerType} />
      )}

      <p className={BROADCAST_META_CLASS}>
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
