import { useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  useGetTeam,
  useGetTeamPurses,
  usePlaceBid,
  getGetAuctionStateQueryKey,
  getGetTeamQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { User, Trophy, Wallet, Users } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

export default function OwnerPanel() {
  const [, params] = useRoute("/tournament/:id/owner/:teamId");
  const tournamentId = parseInt(params?.id || "0");
  const teamId = parseInt(params?.teamId || "0");
  const qc = useQueryClient();

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 1000,
    },
  });

  const { data: team } = useGetTeam(tournamentId, teamId, {
    query: {
      queryKey: getGetTeamQueryKey(tournamentId, teamId),
      enabled: !!tournamentId && !!teamId,
      refetchInterval: 3000,
    },
  });

  const { data: allPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 3000,
    },
  });

  const placeBid = usePlaceBid();
  const [isBidding, setIsBidding] = useState(false);
  const [bidFeedback, setBidFeedback] = useState<"success" | "error" | null>(null);

  const isLeading = state?.currentBidTeamId === teamId;
  const isActive = state?.status === "active";
  const hasPlayer = !!state?.currentPlayer;
  const teamPurse = allPurses?.find(t => t.teamId === teamId);
  const purseRemaining = teamPurse?.purseRemaining ?? (team ? team.purse - (team.purseUsed || 0) : 0);
  const nextBidAmount = (state?.currentBid || 0) + 50000;
  const canBid = isActive && hasPlayer && !isLeading && purseRemaining >= nextBidAmount && (team?.isBiddingEnabled ?? true);

  async function handleBid() {
    if (!canBid || isBidding) return;
    setIsBidding(true);
    try {
      await placeBid.mutateAsync({ tournamentId, data: { teamId, amount: nextBidAmount } });
      qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
      setBidFeedback("success");
      setTimeout(() => setBidFeedback(null), 1200);
    } catch {
      setBidFeedback("error");
      setTimeout(() => setBidFeedback(null), 1200);
    } finally {
      setIsBidding(false);
    }
  }

  const teamColor = team?.color || "#F59E0B";

  return (
    <FullscreenLayout>
      <div
        className="min-h-screen flex flex-col"
        style={{ background: `radial-gradient(ellipse at top, ${teamColor}12 0%, transparent 60%), #09090b` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: teamColor }} />
            <div>
              <p className="font-display font-bold text-lg leading-none" style={{ color: teamColor }}>
                {team?.name || "Loading..."}
              </p>
              <p className="text-xs text-muted-foreground">{team?.shortCode}</p>
            </div>
          </div>
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${
            isActive ? "bg-green-500/20 text-green-400" : "bg-border/30 text-muted-foreground"
          }`}>
            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
            {state?.status?.toUpperCase() || "IDLE"}
          </div>
        </div>

        {/* Purse Stats */}
        <div className="grid grid-cols-2 gap-4 px-6 pt-6">
          <div className="p-4 rounded-2xl border border-border bg-card/50">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Purse Left</p>
            </div>
            <p className="text-2xl font-display font-black" style={{ color: teamColor }}>
              {formatShortIndianRupee(purseRemaining)}
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card/50">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Players Bought</p>
            </div>
            <p className="text-2xl font-display font-black text-foreground">
              {teamPurse?.playersBought || 0}
            </p>
          </div>
        </div>

        {/* Current Player Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 space-y-6">
          <AnimatePresence mode="wait">
            {hasPlayer ? (
              <motion.div
                key={state?.currentPlayer?.id}
                initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }}
                className="w-full max-w-sm text-center space-y-4"
              >
                <div
                  className="w-24 h-28 mx-auto rounded-2xl border-2 overflow-hidden flex items-center justify-center"
                  style={{ borderColor: isLeading ? teamColor : "#333" }}
                >
                  {state?.currentPlayer?.photoUrl ? (
                    <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-card flex items-center justify-center">
                      <User className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-3xl font-display font-black">{state?.currentPlayer?.name}</h2>
                  <p className="text-muted-foreground text-sm capitalize">
                    {state?.currentPlayer?.role} · {state?.currentPlayer?.city}
                  </p>
                </div>

                <div className="py-4 px-6 rounded-2xl border border-border bg-card/50">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Bid</p>
                  <motion.p
                    key={state?.currentBid}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-4xl font-display font-black text-primary"
                  >
                    {formatIndianRupee(state?.currentBid || 0)}
                  </motion.p>
                  {state?.currentBidTeamName && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Leading: <span className="font-bold text-foreground">{state.currentBidTeamName}</span>
                    </p>
                  )}
                </div>

                {isLeading && (
                  <motion.div
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
                    style={{ backgroundColor: `${teamColor}33`, color: teamColor, border: `2px solid ${teamColor}` }}
                  >
                    <Trophy className="w-4 h-4" />
                    YOU ARE LEADING!
                  </motion.div>
                )}
              </motion.div>
            ) : (
              <div className="text-center text-muted-foreground space-y-3">
                <Trophy className="w-12 h-12 mx-auto opacity-20" />
                <p className="text-lg font-medium">
                  {state?.status === "paused" ? "Auction Paused" : "Waiting..."}
                </p>
                <p className="text-sm">{state?.lastAction || "No player up for bid"}</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Big Bid Button */}
        <div className="px-6 pb-8">
          <motion.button
            onClick={handleBid}
            disabled={!canBid || isBidding}
            whileTap={canBid ? { scale: 0.95 } : {}}
            className={`w-full py-8 rounded-3xl font-display font-black text-4xl tracking-wide transition-all duration-200 ${
              !canBid
                ? "opacity-30 cursor-not-allowed bg-border text-muted-foreground"
                : bidFeedback === "error"
                ? "bg-destructive text-white"
                : bidFeedback === "success"
                ? "bg-green-500 text-white"
                : "text-black"
            }`}
            style={canBid && !bidFeedback ? {
              backgroundColor: teamColor,
              boxShadow: `0 0 60px ${teamColor}66, 0 20px 40px ${teamColor}44`,
            } : {}}
          >
            {!canBid && isLeading
              ? "LEADING"
              : !canBid
              ? "CANNOT BID"
              : bidFeedback === "success"
              ? "BID PLACED!"
              : bidFeedback === "error"
              ? "FAILED"
              : isBidding
              ? "BIDDING..."
              : `BID ${formatShortIndianRupee(nextBidAmount)}`}
          </motion.button>
          {!canBid && !isLeading && isActive && hasPlayer && (
            <p className="text-center text-xs text-muted-foreground mt-3">
              {!team?.isBiddingEnabled
                ? "Bidding disabled for your team"
                : `Insufficient purse (need ${formatShortIndianRupee(nextBidAmount)})`}
            </p>
          )}
        </div>
      </div>
    </FullscreenLayout>
  );
}
