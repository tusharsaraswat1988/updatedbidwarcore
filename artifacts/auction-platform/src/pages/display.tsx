import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  useGetTeamPurses,
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
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
        className="text-8xl font-display font-black text-red-500 border-[8px] border-red-500 px-8 py-4 rounded-2xl"
        style={{
          textShadow: "0 0 40px rgba(239,68,68,0.8)",
          boxShadow: "0 0 60px rgba(239,68,68,0.6)",
          transform: "rotate(-12deg)",
        }}
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

  // Real-time WebSocket connection
  useAuctionSocket(tournamentId);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 5000,
    },
  });

  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 10000,
    },
  });

  useEffect(() => {
    if (state?.lastAction && state.lastAction.startsWith("SOLD:") && state.lastAction !== lastAction) {
      setShowSold(true);
      setLastAction(state.lastAction);
      const timer = setTimeout(() => setShowSold(false), 3500);
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
          background: `radial-gradient(ellipse at 30% 20%, ${teamColor}18 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, ${teamColor}12 0%, transparent 55%), #09090b`,
          transition: "background 0.8s ease",
        }}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-border/40 bg-black/20 backdrop-blur-sm">
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
            <div className="text-xs text-muted-foreground font-mono tabular-nums">
              <span className="text-green-400 font-bold">{state?.soldPlayersCount || 0}</span> Sold
              {" · "}
              <span className="text-muted-foreground">{state?.remainingPlayersCount || 0}</span> Left
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 relative overflow-hidden">
          <AnimatePresence>{showSold && <SoldStamp />}</AnimatePresence>

          {state?.currentPlayer ? (
            <div className="w-full max-w-5xl">
              <div className="flex flex-col md:flex-row items-center gap-12">
                {/* Player Photo */}
                <motion.div
                  key={state.currentPlayer.id}
                  initial={{ opacity: 0, scale: 0.8, x: -60 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="flex-shrink-0"
                >
                  <div
                    className="w-52 h-60 md:w-72 md:h-80 rounded-3xl border-4 overflow-hidden flex items-center justify-center relative"
                    style={{
                      borderColor: teamColor,
                      boxShadow: `0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22`,
                    }}
                  >
                    {state.currentPlayer.photoUrl ? (
                      <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-card flex flex-col items-center justify-center gap-3">
                        <User className="w-24 h-24 text-muted-foreground opacity-20" />
                        {state.currentPlayer.jerseyNumber && (
                          <span className="font-display font-black text-5xl text-muted-foreground opacity-30">
                            #{state.currentPlayer.jerseyNumber}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Jersey badge */}
                    {state.currentPlayer.jerseyNumber && state.currentPlayer.photoUrl && (
                      <div
                        className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-sm"
                        style={{ backgroundColor: teamColor, color: "#000" }}
                      >
                        #{state.currentPlayer.jerseyNumber}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Player Info + Bid */}
                <motion.div
                  key={`info-${state.currentPlayer.id}`}
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, type: "spring" }}
                  className="flex-1 text-center md:text-left space-y-5"
                >
                  <div>
                    <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest mb-2">
                      {[state.currentPlayer.role, state.currentPlayer.city, state.currentPlayer.battingStyle]
                        .filter(Boolean).join(" · ")}
                    </p>
                    <h1 className="text-6xl md:text-7xl xl:text-8xl font-display font-black tracking-tight leading-none text-white">
                      {state.currentPlayer.name}
                    </h1>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Current Bid</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={state.currentBid}
                        initial={{ scale: 0.6, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.2, opacity: 0 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="text-7xl md:text-8xl font-display font-black leading-none"
                        style={{ color: teamColor, textShadow: `0 0 80px ${teamColor}99` }}
                      >
                        {formatIndianRupee(state.currentBid || 0)}
                      </motion.p>
                    </AnimatePresence>
                  </div>

                  {state.currentBidTeamName ? (
                    <motion.div
                      key={state.currentBidTeamId}
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl border-2"
                      style={{
                        borderColor: teamColor,
                        backgroundColor: `${teamColor}18`,
                        boxShadow: `0 0 40px ${teamColor}44`,
                      }}
                    >
                      <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: teamColor }} />
                      <span className="text-3xl font-display font-black" style={{ color: teamColor }}>
                        {state.currentBidTeamName}
                      </span>
                    </motion.div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border/50 text-muted-foreground">
                      <span className="text-lg font-semibold">Waiting for first bid...</span>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Base Price: <span className="font-semibold text-foreground">{formatIndianRupee(state.currentPlayer.basePrice)}</span>
                    {state.bidIncrement && (
                      <span className="ml-3">· Increment: <span className="font-semibold text-foreground">{formatIndianRupee(state.bidIncrement)}</span></span>
                    )}
                  </p>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              <motion.div
                animate={{ opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Trophy className="w-20 h-20 text-primary/40 mx-auto" />
              </motion.div>
              <h2 className="text-5xl font-display font-bold text-muted-foreground">
                {state?.status === "completed"
                  ? "Auction Complete"
                  : isPaused
                  ? "Auction Paused"
                  : "Live Auction"}
              </h2>
              {state?.lastAction && (
                <p className="text-muted-foreground text-xl max-w-lg mx-auto">{state.lastAction}</p>
              )}
              {!isActive && !isPaused && (
                <p className="text-muted-foreground text-base">Waiting for operator to start...</p>
              )}
            </div>
          )}
        </div>

        {/* Bottom: Team Purse Strip */}
        {teamPurses && teamPurses.length > 0 && (
          <div className="px-6 py-4 border-t border-border/30 bg-black/30 backdrop-blur-sm">
            <div className="flex items-center gap-3 overflow-x-auto">
              {teamPurses.map(team => {
                const pctUsed = Math.min(100, (team.purseUsed / team.purse) * 100);
                const isLeading = state?.currentBidTeamId === team.teamId;
                return (
                  <div
                    key={team.teamId}
                    className={`flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isLeading ? "scale-105" : ""}`}
                    style={{
                      backgroundColor: `${team.color}18`,
                      border: `1px solid ${team.color}${isLeading ? "88" : "33"}`,
                      boxShadow: isLeading ? `0 0 20px ${team.color}44` : undefined,
                    }}
                  >
                    <div className="w-3 h-10 rounded-full" style={{ backgroundColor: team.color || "#666" }} />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold leading-tight" style={{ color: isLeading ? team.color : "#fff" }}>
                          {team.shortCode}
                        </p>
                        {isLeading && (
                          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: team.color || "#fff" }} />
                        )}
                      </div>
                      <p className="text-sm font-mono font-bold" style={{ color: team.color || "#fff" }}>
                        {formatShortIndianRupee(team.purseRemaining)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{team.playersBought}P · {Math.round(pctUsed)}% used</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </FullscreenLayout>
  );
}
