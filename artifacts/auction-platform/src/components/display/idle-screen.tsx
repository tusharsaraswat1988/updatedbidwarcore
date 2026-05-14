import { memo } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

/**
 * Idle / between-players state. Shown when there is no current player
 * loaded — covers paused, completed, or pre-start auctions.
 *
 * Render isolation: receives only its display slices via primitives.
 */
export const IdleScreen = memo(function IdleScreen({
  tournamentName,
  tournamentLogoUrl,
  status,
  lastAction,
  isActive,
  isPaused,
}: {
  tournamentName: string | null | undefined;
  tournamentLogoUrl: string | null | undefined;
  status: string | null | undefined;
  lastAction: string | null | undefined;
  isActive: boolean;
  isPaused: boolean;
}) {
  return (
    <div className="text-center space-y-6">
      {tournamentLogoUrl ? (
        <motion.img
          src={tournamentLogoUrl}
          alt={tournamentName ?? ""}
          className="w-32 h-32 object-contain mx-auto"
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      ) : (
        <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 3, repeat: Infinity }}>
          <Trophy className="w-20 h-20 text-primary/40 mx-auto" />
        </motion.div>
      )}
      <h2 className="text-5xl font-display font-bold text-muted-foreground">
        {status === "completed" ? "Auction Complete" : isPaused ? "Auction Paused" : tournamentName || "Live Auction"}
      </h2>
      {lastAction && (
        <p className="text-muted-foreground text-xl max-w-lg mx-auto">{lastAction}</p>
      )}
      {!isActive && !isPaused && (
        <p className="text-muted-foreground text-base">Waiting for operator to start...</p>
      )}
    </div>
  );
});
