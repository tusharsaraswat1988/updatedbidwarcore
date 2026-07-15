import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Trophy, TrendingUp } from "lucide-react";
import { BROADCAST_THEME, getAuctionStateStyling } from "@/lib/broadcast-theme";

export type AuctionCardState = "live" | "sold" | "unsold" | "upcoming";

interface AuctionCardHeroProps {
  playerName: string;
  playerRole?: string;
  currentBid?: number;
  basePrice?: number;
  team?: string;
  state: AuctionCardState;
  imageSrc?: string;
  imageAlt?: string;
  animationsEnabled?: boolean;
}

/**
 * Broadcast-grade auction card hero component
 * Features: animated bid ticker, state badges, team integration
 * Respects prefers-reduced-motion for accessibility
 */
export function AuctionCardHero({
  playerName,
  playerRole = "Player",
  currentBid = 0,
  basePrice = 0,
  team,
  state,
  imageSrc,
  imageAlt,
  animationsEnabled = true,
}: AuctionCardHeroProps) {
  const [displayBid, setDisplayBid] = useState(basePrice);
  const [prevBid, setPrevBid] = useState(basePrice);
  const styling = getAuctionStateStyling(state);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const shouldAnimate = animationsEnabled && !prefersReducedMotion;

  // Animate bid changes
  useEffect(() => {
    if (currentBid !== prevBid) {
      setPrevBid(displayBid);
      const timer = setTimeout(() => setDisplayBid(currentBid), 50);
      return () => clearTimeout(timer);
    }
  }, [currentBid, prevBid, displayBid]);

  const bidIncrement = currentBid - basePrice;
  const bidIncrementPercent = basePrice > 0 ? ((bidIncrement / basePrice) * 100).toFixed(0) : "0";

  return (
    <div
      className={`
        relative rounded-xl overflow-hidden border transition-all duration-300
        ${styling.border} ${styling.bg}
        hover:shadow-lg hover:border-opacity-100 border-opacity-70
      `}
    >
      {/* State Badge - Broadcast Style */}
      <div className="absolute top-4 right-4 z-10">
        <motion.div
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full
            bg-black/60 backdrop-blur-sm border ${styling.border}
          `}
          animate={
            state === "live" && shouldAnimate ? { opacity: [1, 0.6, 1] } : undefined
          }
          transition={state === "live" ? { duration: 2, repeat: Infinity } : undefined}
        >
          {state === "live" && (
            <div className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          )}
          <span className={`text-xs font-bold tracking-widest ${styling.text}`}>
            {styling.badge}
          </span>
        </motion.div>
      </div>

      {/* Image Section */}
      {imageSrc && (
        <div className="relative w-full h-48 bg-gradient-to-br from-gray-700 to-gray-900 overflow-hidden">
          <img
            src={imageSrc}
            alt={imageAlt || playerName}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {/* Gradient overlay for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
        </div>
      )}

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Player Info */}
        <div>
          <h3 className="font-display font-bold text-lg leading-tight text-white">
            {playerName}
          </h3>
          {playerRole && (
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-medium">
              {playerRole}
            </p>
          )}
        </div>

        {/* Bid Display - Ticker Style */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <motion.div
              key={displayBid}
              className="font-display font-bold text-2xl text-white tracking-tight"
              animate={
                shouldAnimate
                  ? { y: [10, 0], opacity: [0.5, 1] }
                  : undefined
              }
              transition={
                shouldAnimate
                  ? { duration: 0.3, ease: "easeOut" }
                  : undefined
              }
            >
              ₹{displayBid.toLocaleString("en-IN")}
            </motion.div>
            {bidIncrement > 0 && (
              <motion.div
                className="flex items-center gap-1 text-orange text-sm font-bold"
                initial={shouldAnimate ? { opacity: 0, x: -10 } : undefined}
                animate={shouldAnimate ? { opacity: 1, x: 0 } : undefined}
                transition={
                  shouldAnimate ? { duration: 0.3, ease: "easeOut" } : undefined
                }
              >
                <TrendingUp className="w-4 h-4" />
                +{bidIncrementPercent}%
              </motion.div>
            )}
          </div>
          {basePrice > 0 && (
            <p className="text-xs text-gray-500">
              Base Price: ₹{basePrice.toLocaleString("en-IN")}
            </p>
          )}
        </div>

        {/* Team Badge */}
        {team && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
            <Trophy className="w-4 h-4 text-gold" />
            <span className="text-sm font-semibold text-gold">{team}</span>
          </div>
        )}

        {/* Live Indicator Stripe (for live auctions) */}
        {state === "live" && (
          <motion.div
            className="flex items-center gap-2 pt-2 text-orange text-xs font-bold uppercase tracking-wider"
            animate={shouldAnimate ? { opacity: [1, 0.7, 1] } : undefined}
            transition={shouldAnimate ? { duration: 2, repeat: Infinity } : undefined}
          >
            <Zap className="w-3.5 h-3.5" />
            Real-time Bidding Active
          </motion.div>
        )}
      </div>

      {/* Sold Stamp Overlay (for sold auctions) */}
      <AnimatePresence>
        {state === "sold" && (
          <motion.div
            className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            initial={shouldAnimate ? { opacity: 0 } : undefined}
            animate={shouldAnimate ? { opacity: 1 } : undefined}
            exit={shouldAnimate ? { opacity: 0 } : undefined}
            transition={shouldAnimate ? { duration: 0.3 } : undefined}
          >
            <motion.div
              className="text-6xl font-display font-bold text-green/80"
              initial={
                shouldAnimate
                  ? { scale: 0, rotate: -45 }
                  : undefined
              }
              animate={
                shouldAnimate
                  ? { scale: 1, rotate: 0 }
                  : { scale: 1, rotate: 0 }
              }
              transition={
                shouldAnimate
                  ? {
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                      delay: 0.1,
                    }
                  : undefined
              }
            >
              ✓
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Mini version for carousel/showcase
 */
export function AuctionCardMini({
  playerName,
  currentBid,
  state,
  imageSrc,
}: Pick<
  AuctionCardHeroProps,
  "playerName" | "currentBid" | "state" | "imageSrc"
>) {
  const styling = getAuctionStateStyling(state);

  return (
    <div
      className={`
        relative rounded-lg overflow-hidden border h-40 group
        ${styling.border} ${styling.bg}
      `}
    >
      {imageSrc && (
        <img
          src={imageSrc}
          alt={playerName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute bottom-0 left-0 right-0 p-3">
        <p className="font-display font-bold text-white text-sm leading-tight">
          {playerName}
        </p>
        {currentBid && (
          <p className="text-xs text-gold font-semibold mt-1">
            ₹{currentBid.toLocaleString("en-IN")}
          </p>
        )}
      </div>

      {/* State indicator */}
      <div className="absolute top-2 right-2">
        <div
          className={`w-2 h-2 rounded-full ${
            state === "live" ? "bg-orange animate-pulse" : `bg-${styling.text}`
          }`}
        />
      </div>
    </div>
  );
}
