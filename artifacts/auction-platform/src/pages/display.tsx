import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  useGetTeamPurses,
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { User, Trophy } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

function SoldStamp() {
  return (
    <motion.div
      initial={{ scale: 3, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: -12 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
    >
      <div
        className="text-8xl font-display font-black text-red-500 border-[8px] border-red-500 px-8 py-4 rounded-lg"
        style={{ textShadow: "0 0 40px rgba(239,68,68,0.8)", boxShadow: "0 0 40px rgba(239,68,68,0.5)", transform: "rotate(-12deg)" }}
      >
        SOLD!
      </div>
    </motion.div>
  );
}

export default function DisplayView() {
  const [, params] = useRoute("/tournament/:id/display");
  const tournamentId = parseInt(params?.id || "0");
  const [showSold, setShowSold] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 1000,
    },
  });

  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 3000,
    },
  });

  useEffect(() => {
    if (state?.lastAction && state.lastAction.startsWith("SOLD:") && state.lastAction !== lastAction) {
      setShowSold(true);
      setLastAction(state.lastAction);
      const timer = setTimeout(() => setShowSold(false), 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [state?.lastAction, lastAction]);

  const isActive = state?.status === "active";
  const isPaused = state?.status === "paused";
  const teamColor = state?.currentBidTeamColor || "#F59E0B";

  return (
    <FullscreenLayout>
      <div
        className="min-h-screen flex flex-col select-none"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, ${teamColor}15 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, ${teamColor}10 0%, transparent 60%), #09090b`,
          transition: "background 1s ease",
        }}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-primary" />
            <span className="font-display font-black text-xl tracking-widest text-primary uppercase">BIDWAR</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full border ${
              isActive ? "bg-green-500/20 border-green-500/40 text-green-400" :
              isPaused ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400" :
              "bg-border/30 border-border text-muted-foreground"
            }`}>
              {isActive && <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />}
              <span className="text-xs font-bold uppercase tracking-widest">{state?.status || "IDLE"}</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono">
              {state?.soldPlayersCount || 0} Sold · {state?.remainingPlayersCount || 0} Left
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 relative">
          <AnimatePresence>{showSold && <SoldStamp />}</AnimatePresence>

          {state?.currentPlayer ? (
            <div className="w-full max-w-5xl">
              <div className="flex flex-col md:flex-row items-center gap-12">
                {/* Player Photo */}
                <motion.div
                  key={state.currentPlayer.id}
                  initial={{ opacity: 0, scale: 0.8, x: -40 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ duration: 0.5 }}
                  className="flex-shrink-0"
                >
                  <div
                    className="w-48 h-56 md:w-64 md:h-72 rounded-2xl border-4 overflow-hidden flex items-center justify-center"
                    style={{ borderColor: teamColor, boxShadow: `0 0 40px ${teamColor}44` }}
                  >
                    {state.currentPlayer.photoUrl ? (
                      <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-card flex items-center justify-center">
                        <User className="w-20 h-20 text-muted-foreground opacity-30" />
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Player Info + Bid */}
                <motion.div
                  key={`info-${state.currentPlayer.id}`}
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="flex-1 text-center md:text-left space-y-6"
                >
                  <div>
                    <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-2">
                      {state.currentPlayer.role || "Player"} · {state.currentPlayer.city || ""}
                    </p>
                    <h1 className="text-6xl md:text-7xl font-display font-black tracking-tight leading-none text-white">
                      {state.currentPlayer.name}
                    </h1>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground uppercase tracking-widest">Current Bid</p>
                    <motion.div
                      key={state.currentBid}
                      initial={{ scale: 0.7, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", bounce: 0.5 }}
                    >
                      <p
                        className="text-7xl md:text-8xl font-display font-black"
                        style={{ color: teamColor, textShadow: `0 0 60px ${teamColor}88` }}
                      >
                        {formatIndianRupee(state.currentBid || 0)}
                      </p>
                    </motion.div>
                  </div>
                  {state.currentBidTeamName && (
                    <motion.div
                      key={state.currentBidTeamId}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="inline-flex items-center gap-3 px-6 py-3 rounded-full border-2"
                      style={{
                        borderColor: teamColor,
                        backgroundColor: `${teamColor}22`,
                        boxShadow: `0 0 30px ${teamColor}44`,
                      }}
                    >
                      <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: teamColor }} />
                      <span className="text-2xl font-display font-black" style={{ color: teamColor }}>
                        {state.currentBidTeamName}
                      </span>
                    </motion.div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Base Price: {formatIndianRupee(state.currentPlayer.basePrice)}
                  </p>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Trophy className="w-16 h-16 text-primary/30 mx-auto" />
              <h2 className="text-4xl font-display font-bold text-muted-foreground">
                {state?.status === "completed"
                  ? "Auction Complete"
                  : isPaused
                  ? "Auction Paused"
                  : "Waiting for Auction"}
              </h2>
              {state?.lastAction && <p className="text-muted-foreground text-lg">{state.lastAction}</p>}
            </div>
          )}
        </div>

        {/* Bottom: Team Purse Strip */}
        {teamPurses && teamPurses.length > 0 && (
          <div className="px-6 py-4 border-t border-border/30 bg-card/30 backdrop-blur-sm">
            <div className="flex items-center gap-4 overflow-x-auto">
              {teamPurses.map(team => (
                <div
                  key={team.teamId}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50"
                  style={{ borderColor: `${team.color}33` }}
                >
                  <div className="w-3 h-8 rounded-sm" style={{ backgroundColor: team.color || "#666" }} />
                  <div>
                    <p className="text-xs font-bold leading-tight">{team.shortCode}</p>
                    <p className="text-xs font-mono" style={{ color: team.color || "#fff" }}>
                      {formatShortIndianRupee(team.purseRemaining)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{team.playersBought}P</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </FullscreenLayout>
  );
}
