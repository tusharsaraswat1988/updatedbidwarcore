import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  useGetTeam,
  useGetTeamPurses,
  usePlaceBid,
  useVerifyOwnerAccess,
  getGetAuctionStateQueryKey,
  getGetTeamQueryKey,
  getGetTeamPursesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { User, Trophy, Wallet, Users, Lock, Eye, EyeOff, RefreshCw, LogOut } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

function AccessGate({ tournamentId, teamId, teamName, teamColor, onVerified }: {
  tournamentId: number;
  teamId: number;
  teamName: string;
  teamColor: string;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const verify = useVerifyOwnerAccess();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await verify.mutateAsync({ tournamentId, teamId, data: { code: code.trim() } });
      if (result.valid) {
        sessionStorage.setItem(`owner_verified_${teamId}`, "1");
        onVerified();
      } else {
        setError("Incorrect access code. Please try again.");
        setCode("");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: `radial-gradient(ellipse at top, ${teamColor}15 0%, transparent 55%), #09090b` }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, type: "spring" }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        <div className="space-y-3">
          <div
            className="w-20 h-20 rounded-2xl mx-auto flex items-center justify-center"
            style={{ backgroundColor: `${teamColor}22`, border: `2px solid ${teamColor}66` }}
          >
            <Lock className="w-9 h-9" style={{ color: teamColor }} />
          </div>
          <h1 className="font-display font-black text-3xl text-white">{teamName}</h1>
          <p className="text-muted-foreground text-sm">Enter your team access code to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showCode ? "text" : "password"}
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ACCESS CODE"
              autoComplete="off"
              className="w-full px-5 py-4 rounded-2xl border text-center font-display font-black text-2xl tracking-[0.3em] bg-card/50 border-border text-white placeholder:text-muted-foreground/40 outline-none focus:border-primary/60 transition-all"
              style={{ caretColor: teamColor }}
            />
            <button
              type="button"
              onClick={() => setShowCode(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showCode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-destructive text-sm text-center"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            type="submit"
            disabled={loading || !code.trim()}
            whileTap={{ scale: 0.97 }}
            className="w-full py-5 rounded-2xl font-display font-black text-xl text-black disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            style={{ backgroundColor: teamColor, boxShadow: `0 0 40px ${teamColor}55` }}
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin mx-auto" /> : "ENTER"}
          </motion.button>
        </form>

        <p className="text-xs text-muted-foreground/60">
          Contact the auction operator if you don't have the code.
        </p>
      </motion.div>
    </div>
  );
}

export default function OwnerPanel() {
  const [, params] = useRoute("/tournament/:id/owner/:teamId");
  const tournamentId = parseInt(params?.id || "0");
  const teamId = parseInt(params?.teamId || "0");
  const qc = useQueryClient();

  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  const { data: team } = useGetTeam(tournamentId, teamId, {
    query: {
      queryKey: getGetTeamQueryKey(tournamentId, teamId),
      enabled: !!tournamentId && !!teamId,
    },
  });

  // Check session storage for prior verification
  useEffect(() => {
    if (!team) return;
    if (!team.accessCode) {
      setVerified(true);
    } else {
      const stored = sessionStorage.getItem(`owner_verified_${teamId}`);
      if (stored === "1") setVerified(true);
    }
    setChecking(false);
  }, [team, teamId]);

  // Real-time SSE connection
  useAuctionSocket(tournamentId);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 5000,
    },
  });

  const { data: allPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 10000,
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
  const increment = state?.bidIncrement ?? 50000;
  const nextBidAmount = (state?.currentBid || 0) + increment;
  const canBid = isActive && hasPlayer && !isLeading && purseRemaining >= nextBidAmount && (team?.isBiddingEnabled ?? true);

  async function handleBid() {
    if (!canBid || isBidding) return;
    setIsBidding(true);
    try {
      await placeBid.mutateAsync({ tournamentId, data: { teamId, amount: nextBidAmount } });
      qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
      setBidFeedback("success");
      setTimeout(() => setBidFeedback(null), 1500);
    } catch {
      setBidFeedback("error");
      setTimeout(() => setBidFeedback(null), 1500);
    } finally {
      setIsBidding(false);
    }
  }

  const teamColor = team?.color || "#F59E0B";

  if (checking || !team) {
    return (
      <FullscreenLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </FullscreenLayout>
    );
  }

  if (!verified) {
    return (
      <FullscreenLayout>
        <AccessGate
          tournamentId={tournamentId}
          teamId={teamId}
          teamName={team.name}
          teamColor={teamColor}
          onVerified={() => setVerified(true)}
        />
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div
        className="min-h-screen flex flex-col"
        style={{
          background: `radial-gradient(ellipse at top, ${teamColor}15 0%, transparent 55%), #09090b`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-base"
              style={{ backgroundColor: `${teamColor}33`, color: teamColor, border: `2px solid ${teamColor}66` }}>
              {team?.shortCode || "?"}
            </div>
            <div>
              <p className="font-display font-bold text-lg leading-none" style={{ color: teamColor }}>
                {team?.name || "Loading..."}
              </p>
              <p className="text-xs text-muted-foreground">{team?.ownerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-500/20 text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
              Live
            </span>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
              isActive ? "bg-green-500/20 text-green-400" : "bg-border/30 text-muted-foreground"
            }`}>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
              {state?.status?.toUpperCase() || "IDLE"}
            </div>
            <button
              onClick={() => {
                sessionStorage.removeItem(`owner_verified_${teamId}`);
                setVerified(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Purse Stats */}
        <div className="grid grid-cols-3 gap-3 px-6 pt-5">
          <div className="p-4 rounded-2xl border border-border bg-card/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Wallet className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Purse Left</p>
            </div>
            <p className="text-xl font-display font-black" style={{ color: teamColor }}>
              {formatShortIndianRupee(purseRemaining)}
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Players</p>
            </div>
            <p className="text-xl font-display font-black text-foreground">
              {teamPurse?.playersBought || 0}
            </p>
          </div>
          <div className="p-4 rounded-2xl border border-border bg-card/50">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Sold</p>
            </div>
            <p className="text-xl font-display font-black text-foreground">
              {state?.soldPlayersCount || 0}
            </p>
          </div>
        </div>

        {/* Current Player Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 space-y-5">
          <AnimatePresence mode="wait">
            {hasPlayer ? (
              <motion.div
                key={state?.currentPlayer?.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                className="w-full max-w-sm text-center space-y-4"
              >
                {/* Player Photo */}
                <div
                  className="w-28 h-32 mx-auto rounded-2xl border-2 overflow-hidden flex items-center justify-center transition-all duration-500"
                  style={{ borderColor: isLeading ? teamColor : "#333", boxShadow: isLeading ? `0 0 30px ${teamColor}55` : undefined }}
                >
                  {state?.currentPlayer?.photoUrl ? (
                    <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-card flex items-center justify-center">
                      <User className="w-10 h-10 text-muted-foreground opacity-30" />
                    </div>
                  )}
                </div>

                <div>
                  <h2 className="text-3xl font-display font-black">{state?.currentPlayer?.name}</h2>
                  <p className="text-muted-foreground text-sm capitalize mt-1">
                    {[state?.currentPlayer?.role, state?.currentPlayer?.city].filter(Boolean).join(" · ")}
                  </p>
                </div>

                {/* Bid Display */}
                <div className="py-5 px-6 rounded-2xl border border-border bg-card/50 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Bid</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={state?.currentBid}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-4xl font-display font-black text-primary"
                      >
                        {formatIndianRupee(state?.currentBid || 0)}
                      </motion.p>
                    </AnimatePresence>
                    {state?.currentBidTeamName && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Leading: <span className="font-bold text-foreground">{state.currentBidTeamName}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground border-t border-border pt-3">
                    Base: {formatIndianRupee(state?.currentPlayer?.basePrice)} · Increment: {formatIndianRupee(increment)}
                  </div>
                </div>

                {/* Leading Badge */}
                <AnimatePresence>
                  {isLeading && (
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0, opacity: 0 }}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
                      style={{ backgroundColor: `${teamColor}33`, color: teamColor, border: `2px solid ${teamColor}` }}
                    >
                      <Trophy className="w-4 h-4" />
                      YOU ARE LEADING!
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ) : (
              <div className="text-center text-muted-foreground space-y-4">
                <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 2.5, repeat: Infinity }}>
                  <Trophy className="w-14 h-14 mx-auto opacity-30" style={{ color: teamColor }} />
                </motion.div>
                <p className="text-xl font-semibold">
                  {state?.status === "completed"
                    ? "Auction Complete"
                    : state?.status === "paused"
                    ? "Auction Paused"
                    : "Waiting..."}
                </p>
                {state?.lastAction && (
                  <p className="text-sm max-w-xs mx-auto">{state.lastAction}</p>
                )}
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Big Bid Button */}
        <div className="px-6 pb-10 pt-2">
          <motion.button
            onClick={handleBid}
            disabled={!canBid || isBidding}
            whileTap={canBid ? { scale: 0.93 } : {}}
            className={`w-full py-9 rounded-3xl font-display font-black tracking-wide transition-all duration-150 ${
              bidFeedback === "success"
                ? "text-white text-4xl"
                : bidFeedback === "error"
                ? "bg-destructive text-white text-3xl"
                : !canBid
                ? "bg-border/30 text-muted-foreground text-3xl cursor-not-allowed opacity-50"
                : "text-black text-4xl"
            }`}
            style={canBid && !bidFeedback ? {
              backgroundColor: teamColor,
              boxShadow: `0 0 80px ${teamColor}66, 0 20px 50px ${teamColor}44`,
            } : bidFeedback === "success" ? {
              backgroundColor: "#22c55e",
              boxShadow: "0 0 60px rgba(34,197,94,0.5)",
            } : {}}
          >
            {bidFeedback === "success"
              ? "BID PLACED!"
              : bidFeedback === "error"
              ? "BID FAILED"
              : isBidding
              ? "BIDDING..."
              : !canBid && isLeading
              ? "YOU'RE LEADING"
              : !canBid && !isActive
              ? "AUCTION NOT LIVE"
              : !canBid
              ? "CANNOT BID"
              : `BID ${formatShortIndianRupee(nextBidAmount)}`}
          </motion.button>
          {canBid && (
            <p className="text-center text-xs text-muted-foreground mt-3">
              Purse remaining after bid: {formatShortIndianRupee(purseRemaining - nextBidAmount)}
            </p>
          )}
          {!canBid && !isLeading && isActive && hasPlayer && (
            <p className="text-center text-xs text-destructive mt-3">
              {!team?.isBiddingEnabled
                ? "Bidding is disabled for your team"
                : purseRemaining < nextBidAmount
                ? `Need ${formatShortIndianRupee(nextBidAmount)} but only ${formatShortIndianRupee(purseRemaining)} left`
                : ""}
            </p>
          )}
        </div>
      </div>
    </FullscreenLayout>
  );
}
