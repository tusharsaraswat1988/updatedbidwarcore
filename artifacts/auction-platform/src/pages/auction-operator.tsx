import { useCallback } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  useListTeams,
  useListPlayers,
  useListBids,
  useStartAuction,
  usePauseAuction,
  useNextPlayer,
  usePlaceBid,
  useSellPlayer,
  useMarkUnsold,
  useUndoLastAction,
  getGetAuctionStateQueryKey,
  getListBidsQueryKey,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, CheckCircle, XCircle, Undo2,
  Shuffle, User, Trophy, Clock, Gavel,
} from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

export default function AuctionOperator() {
  const [, params] = useRoute("/tournament/:id/auction");
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 1500,
    },
  });

  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: players } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: bids } = useListBids(tournamentId, {
    query: {
      queryKey: getListBidsQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 2000,
    },
  });

  const startAuction = useStartAuction();
  const pauseAuction = usePauseAuction();
  const nextPlayer = useNextPlayer();
  const placeBid = usePlaceBid();
  const sellPlayer = useSellPlayer();
  const markUnsold = useMarkUnsold();
  const undoAction = useUndoLastAction();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListBidsQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
  }, [qc, tournamentId]);

  async function handleNextPlayer(mode: "sequential" | "random", playerId?: number) {
    await nextPlayer.mutateAsync({ tournamentId, data: { mode, playerId } });
    invalidate();
  }

  async function handleBid(teamId: number) {
    if (!state?.currentBid && state?.currentBid !== 0) return;
    const nextBid = (state.currentBid || 0) + 50000;
    await placeBid.mutateAsync({ tournamentId, data: { teamId, amount: nextBid } });
    invalidate();
  }

  async function handleSell() {
    await sellPlayer.mutateAsync({ tournamentId });
    invalidate();
  }

  async function handleUnsold() {
    await markUnsold.mutateAsync({ tournamentId });
    invalidate();
  }

  async function handleUndo() {
    await undoAction.mutateAsync({ tournamentId });
    invalidate();
  }

  const isActive = state?.status === "active";
  const isPaused = state?.status === "paused";
  const hasPlayer = !!state?.currentPlayer;
  const hasBid = !!state?.currentBidTeamId;
  const available = (players || []).filter(p => p.status === "available");

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Gavel className="w-7 h-7 text-primary" />
              Operator Panel
            </h1>
            <p className="text-muted-foreground mt-1">
              Status:{" "}
              <span className={`font-bold ${isActive ? "text-green-400" : isPaused ? "text-yellow-400" : "text-muted-foreground"}`}>
                {state?.status?.toUpperCase() || "IDLE"}
              </span>
              {" · "}{state?.soldPlayersCount || 0} Sold · {state?.unsoldPlayersCount || 0} Unsold · {state?.remainingPlayersCount || 0} Remaining
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {!isActive ? (
              <Button
                size="lg"
                className="bg-green-600 hover:bg-green-500 text-white gap-2 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
                onClick={async () => { await startAuction.mutateAsync({ tournamentId }); invalidate(); }}
                disabled={startAuction.isPending}
              >
                <Play className="w-5 h-5" /> {isPaused ? "Resume" : "Start Auction"}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="outline"
                className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10 gap-2"
                onClick={async () => { await pauseAuction.mutateAsync({ tournamentId }); invalidate(); }}
              >
                <Pause className="w-5 h-5" /> Pause
              </Button>
            )}
            <Button variant="outline" className="gap-2" onClick={() => handleNextPlayer("sequential")} disabled={nextPlayer.isPending}>
              <SkipForward className="w-4 h-4" /> Next Player
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => handleNextPlayer("random")} disabled={nextPlayer.isPending}>
              <Shuffle className="w-4 h-4" /> Random
            </Button>
            <Button variant="ghost" size="icon" onClick={handleUndo} disabled={undoAction.isPending} title="Undo last action">
              <Undo2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Player + Bid + Teams */}
          <div className="lg:col-span-2 space-y-4">
            {/* Current Player */}
            <AnimatePresence mode="wait">
              {hasPlayer ? (
                <motion.div
                  key={state?.currentPlayer?.id}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="border-primary/30 bg-gradient-to-br from-card to-card/50 overflow-hidden">
                    <CardContent className="p-6 flex items-start gap-6">
                      <div className="w-24 h-28 rounded-xl bg-card border border-border flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {state?.currentPlayer?.photoUrl ? (
                          <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-10 h-10 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h2 className="text-3xl font-display font-bold leading-none">{state?.currentPlayer?.name}</h2>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          {state?.currentPlayer?.role && <Badge variant="outline" className="capitalize">{state.currentPlayer.role}</Badge>}
                          {state?.currentPlayer?.city && <Badge variant="secondary">{state.currentPlayer.city}</Badge>}
                          {state?.currentPlayer?.battingStyle && <Badge variant="secondary" className="text-xs">{state.currentPlayer.battingStyle}</Badge>}
                        </div>
                        {state?.currentPlayer?.achievements && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-1">{state.currentPlayer.achievements}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ) : (
                <motion.div key="no-player" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="border-dashed border-2 border-border h-40 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                      <User className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p className="font-medium">No player selected</p>
                      <p className="text-sm mt-1">Click "Next Player" or "Random" to begin</p>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bid Display + SOLD/UNSOLD */}
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Current Bid</p>
                    <motion.p
                      key={state?.currentBid}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-5xl font-display font-bold text-primary"
                      style={{ textShadow: "0 0 30px rgba(234,179,8,0.5)" }}
                    >
                      {formatIndianRupee(state?.currentBid || 0)}
                    </motion.p>
                    {hasPlayer && (
                      <p className="text-xs text-muted-foreground mt-1">Base: {formatIndianRupee(state?.currentPlayer?.basePrice)}</p>
                    )}
                  </div>
                  {hasBid && (
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Leading</p>
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: state?.currentBidTeamColor || "#fff" }} />
                        <span className="font-bold text-xl">{state?.currentBidTeamName}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-6">
                  <Button
                    size="lg"
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-bold text-lg h-14 gap-2 shadow-[0_0_20px_rgba(34,197,94,0.4)]"
                    disabled={!hasBid || sellPlayer.isPending}
                    onClick={handleSell}
                  >
                    <CheckCircle className="w-5 h-5" /> SOLD
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="flex-1 border-destructive/50 text-destructive hover:bg-destructive/10 font-bold text-lg h-14 gap-2"
                    disabled={!hasPlayer || markUnsold.isPending}
                    onClick={handleUnsold}
                  >
                    <XCircle className="w-5 h-5" /> UNSOLD
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Team Bid Buttons */}
            {teams && teams.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Bid by Team</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {teams.map(team => {
                    const purseLeft = team.purse - (team.purseUsed || 0);
                    const isLeading = state?.currentBidTeamId === team.id;
                    const nextBid = (state?.currentBid || 0) + 50000;
                    const canBid = isActive && hasPlayer && purseLeft >= nextBid && !!team.isBiddingEnabled;
                    return (
                      <button
                        key={team.id}
                        disabled={!canBid || placeBid.isPending}
                        onClick={() => handleBid(team.id)}
                        className={`relative p-4 rounded-xl border-2 font-bold text-left transition-all ${
                          isLeading ? "scale-[1.02]" : "border-border"
                        } ${!canBid ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"}`}
                        style={{
                          borderColor: isLeading ? team.color || "#fff" : undefined,
                          boxShadow: isLeading ? `0 0 20px ${team.color}44` : undefined,
                        }}
                      >
                        {isLeading && (
                          <div className="absolute top-2 right-2 w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: team.color || "#fff" }} />
                        )}
                        <div className="flex items-center gap-2 mb-2">
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold"
                            style={{ backgroundColor: `${team.color}33`, color: team.color || "#fff" }}
                          >
                            {team.shortCode}
                          </div>
                          <span className="text-sm font-bold truncate">{team.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{formatShortIndianRupee(purseLeft)} left</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right: History + Queue */}
          <div className="space-y-4">
            {state?.lastAction && (
              <div className="px-4 py-3 bg-card border border-border rounded-lg">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Action</p>
                <p className="text-sm font-medium">{state.lastAction}</p>
              </div>
            )}

            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Bid History</p>
                </div>
                <ScrollArea className="h-48">
                  <div className="space-y-2 pr-2">
                    {(bids || []).slice(0, 15).map(bid => (
                      <div key={bid.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bid.teamColor || "#666" }} />
                          <span className="truncate text-xs text-muted-foreground">{bid.playerName}</span>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="font-mono font-semibold text-xs text-primary">{formatShortIndianRupee(bid.amount)}</p>
                          <p className="text-[10px] text-muted-foreground">{bid.teamName}</p>
                        </div>
                      </div>
                    ))}
                    {!bids?.length && <p className="text-center text-muted-foreground text-sm py-4">No bids yet</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Queue ({available.length})</p>
                </div>
                <ScrollArea className="h-48">
                  <div className="space-y-1 pr-2">
                    {available.slice(0, 20).map(player => (
                      <button
                        key={player.id}
                        disabled={!isActive || nextPlayer.isPending}
                        onClick={() => handleNextPlayer("sequential", player.id)}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-accent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium truncate">{player.name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground font-mono flex-shrink-0 ml-2">
                          {formatShortIndianRupee(player.basePrice)}
                        </span>
                      </button>
                    ))}
                    {available.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">All players processed</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
