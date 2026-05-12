import { useCallback, useEffect, useState } from "react";
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
  useManualSell,
  useMarkUnsold,
  useUndoLastAction,
  useReAuctionPlayer,
  useResetTrialAuction,
  useStartTimer,
  useSetTeamPurseView,
  getGetAuctionStateQueryKey,
  getListBidsQueryKey,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipForward, CheckCircle, XCircle, Undo2,
  Shuffle, User, Trophy, Clock, Gavel, RotateCcw, AlertTriangle,
  Settings2, RefreshCw, Timer, LayoutGrid,
} from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

export default function AuctionOperator() {
  const [, params] = useRoute("/tournament/:id/auction");
  const tournamentId = parseInt(params?.id || "0");
  const qc = useQueryClient();

  const [manualSellOpen, setManualSellOpen] = useState(false);
  const [manualTeamId, setManualTeamId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [reAuctionTab, setReAuctionTab] = useState<"queue" | "sold" | "unsold">("queue");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [timerSecs, setTimerSecs] = useState("30");

  useAuctionSocket(tournamentId);

  const { data: state } = useGetAuctionState(tournamentId, {
    query: { queryKey: getGetAuctionStateQueryKey(tournamentId), enabled: !!tournamentId, refetchInterval: 5000 },
  });
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: players } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: bids } = useListBids(tournamentId, {
    query: { queryKey: getListBidsQueryKey(tournamentId), enabled: !!tournamentId, refetchInterval: 5000 },
  });

  const startAuction = useStartAuction();
  const pauseAuction = usePauseAuction();
  const nextPlayer = useNextPlayer();
  const placeBid = usePlaceBid();
  const sellPlayer = useSellPlayer();
  const manualSellMut = useManualSell();
  const markUnsold = useMarkUnsold();
  const undoAction = useUndoLastAction();
  const reAuction = useReAuctionPlayer();
  const resetTrial = useResetTrialAuction();
  const startTimerMut = useStartTimer();
  const setTeamPurseView = useSetTeamPurseView();

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: getGetAuctionStateQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListBidsQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListPlayersQueryKey(tournamentId) });
    qc.invalidateQueries({ queryKey: getListTeamsQueryKey(tournamentId) });
  }, [qc, tournamentId]);

  async function handleNextPlayer(mode: "sequential" | "random", playerId?: number) {
    await nextPlayer.mutateAsync({ tournamentId, data: { mode, playerId } });
    invalidate();
  }

  async function handleBid(teamId: number) {
    const increment = state?.bidIncrement ?? 50000;
    const nextBid = (state?.currentBid || 0) + increment;
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

  async function handleManualSell() {
    if (!manualTeamId || !manualAmount) return;
    await manualSellMut.mutateAsync({
      tournamentId,
      data: { teamId: parseInt(manualTeamId), amount: parseInt(manualAmount) || 0 },
    });
    setManualSellOpen(false);
    setManualTeamId("");
    setManualAmount("");
    invalidate();
  }

  async function handleReAuction(playerId: number, startFromBase: boolean) {
    await reAuction.mutateAsync({ tournamentId, data: { playerId, startFromBase } });
    invalidate();
  }

  async function handleResetTrial() {
    await resetTrial.mutateAsync({ tournamentId });
    setShowResetConfirm(false);
    invalidate();
  }

  async function handleStartTimer() {
    const secs = parseInt(timerSecs) || 30;
    await startTimerMut.mutateAsync({ tournamentId, data: { seconds: secs } });
    invalidate();
  }

  // Client-side countdown from server timerEndsAt
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!state?.timerEndsAt) { setTimeLeft(null); return; }
    const update = () => {
      const diff = Math.ceil((new Date(state.timerEndsAt!).getTime() - Date.now()) / 1000);
      setTimeLeft(diff > 0 ? diff : 0);
    };
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [state?.timerEndsAt]);

  const isActive = state?.status === "active";
  const isPaused = state?.status === "paused";
  const hasPlayer = !!state?.currentPlayer;
  const hasBid = !!state?.currentBidTeamId;
  const available = (players || []).filter(p => p.status === "available");
  const soldPlayers = (players || []).filter(p => p.status === "sold");
  const unsoldPlayers = (players || []).filter(p => p.status === "unsold");
  const retainedPlayers = (players || []).filter(p => p.status === "retained");
  const increment = state?.bidIncrement ?? 50000;
  const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t]));

  const rightPanelPlayers = reAuctionTab === "queue"
    ? available
    : reAuctionTab === "sold"
    ? soldPlayers
    : unsoldPlayers;

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Gavel className="w-7 h-7 text-primary" />
              Operator Panel
              <span className="inline-flex items-center gap-1.5 text-xs font-normal px-2 py-1 rounded-full bg-green-500/20 text-green-400">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                Live
              </span>
            </h1>
            <p className="text-muted-foreground mt-1">
              <span className={`font-bold ${isActive ? "text-green-400" : isPaused ? "text-yellow-400" : "text-muted-foreground"}`}>
                {state?.status?.toUpperCase() || "IDLE"}
              </span>
              {" · "}{state?.soldPlayersCount || 0} Sold · {state?.unsoldPlayersCount || 0} Unsold · {state?.remainingPlayersCount || 0} Remaining
              {retainedPlayers.length > 0 && <span> · <span className="text-purple-400">{retainedPlayers.length} Retained</span></span>}
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
              <SkipForward className="w-4 h-4" /> Next
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => handleNextPlayer("random")} disabled={nextPlayer.isPending}>
              <Shuffle className="w-4 h-4" /> Random
            </Button>
            <Button variant="ghost" size="icon" onClick={handleUndo} disabled={undoAction.isPending} title="Undo last action">
              <Undo2 className="w-5 h-5" />
            </Button>
            <Button
              variant={state?.teamPurseViewActive ? "default" : "outline"}
              size="sm"
              className={`gap-2 ${state?.teamPurseViewActive ? "bg-primary text-black shadow-[0_0_15px_rgba(234,179,8,0.4)]" : "border-border text-muted-foreground hover:text-foreground"}`}
              title="Show/hide team purse view on LED"
              onClick={async () => {
                await setTeamPurseView.mutateAsync({ tournamentId, data: { active: !state?.teamPurseViewActive } });
                invalidate();
              }}
              disabled={setTeamPurseView.isPending}
            >
              <LayoutGrid className="w-4 h-4" />
              {state?.teamPurseViewActive ? "Hide Purses" : "Show Purses"}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-orange-500/40 text-orange-400 hover:bg-orange-500/10"
              title="Reset for live auction"
              onClick={() => setShowResetConfirm(true)}
            >
              <RefreshCw className="w-4 h-4" />
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
                          {state?.currentPlayer?.jerseyNumber && <Badge variant="outline" className="font-mono">#{state.currentPlayer.jerseyNumber}</Badge>}
                          {state?.currentPlayer?.availabilityDates && (
                            <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">
                              Avail: {state.currentPlayer.availabilityDates}
                            </Badge>
                          )}
                        </div>
                        {state?.currentPlayer?.achievements && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{state.currentPlayer.achievements}</p>
                        )}
                        {state?.currentPlayer?.cricheroUrl && (
                          <a href={state.currentPlayer.cricheroUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline mt-1 inline-block">
                            Crichero Profile
                          </a>
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
                      <p className="text-sm mt-1">Click "Next" or "Random" to begin</p>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Bid Display + SOLD/UNSOLD/Manual */}
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                      Current Bid <span className="normal-case font-normal">(+{formatShortIndianRupee(increment)} per raise)</span>
                    </p>
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
                {/* Timer */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/50">
                  <Timer className={`w-4 h-4 flex-shrink-0 ${timeLeft !== null && timeLeft <= 5 ? "text-red-400 animate-pulse" : "text-muted-foreground"}`} />
                  {timeLeft !== null ? (
                    <span className={`text-2xl font-display font-black tabular-nums ${timeLeft <= 5 ? "text-red-400" : timeLeft <= 10 ? "text-orange-400" : "text-foreground"}`}>
                      {timeLeft}s
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No timer running</span>
                  )}
                  <div className="flex items-center gap-2 ml-auto">
                    <Input
                      type="number"
                      value={timerSecs}
                      onChange={e => setTimerSecs(e.target.value)}
                      className="w-16 h-8 text-center text-sm"
                      min={5}
                      max={300}
                    />
                    <span className="text-xs text-muted-foreground">sec</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                      onClick={handleStartTimer}
                      disabled={!hasPlayer || startTimerMut.isPending}
                    >
                      <Timer className="w-3.5 h-3.5" /> Start
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 mt-4 flex-wrap">
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
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 h-14 gap-2 px-5"
                    disabled={!hasPlayer}
                    onClick={() => {
                      setManualAmount(String(state?.currentBid || state?.currentPlayer?.basePrice || 0));
                      setManualTeamId("");
                      setManualSellOpen(true);
                    }}
                  >
                    <Settings2 className="w-4 h-4" /> Manual Sell
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Team Bid Buttons */}
            {teams && teams.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Quick Bid by Team — next bid: {formatIndianRupee((state?.currentBid || 0) + increment)}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {teams.map(team => {
                    const purseLeft = team.purse - (team.purseUsed || 0);
                    const isLeading = state?.currentBidTeamId === team.id;
                    const nextBid = (state?.currentBid || 0) + increment;
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
                          {team.logoUrl ? (
                            <img src={team.logoUrl} alt={team.name} className="w-6 h-6 rounded object-contain" />
                          ) : (
                            <div
                              className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold"
                              style={{ backgroundColor: `${team.color}33`, color: team.color || "#fff" }}
                            >
                              {team.shortCode}
                            </div>
                          )}
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
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm font-semibold">Bid History</p>
                </div>
                <ScrollArea className="h-40">
                  <div className="space-y-2 pr-2">
                    {(bids || []).slice(0, 20).map(bid => (
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

            {/* Player Queue + Re-auction tabs */}
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex gap-1 mb-3 rounded-lg bg-muted/30 p-1">
                  {(["queue", "sold", "unsold"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setReAuctionTab(tab)}
                      className={`flex-1 text-xs py-1.5 px-2 rounded-md font-semibold transition-all capitalize ${
                        reAuctionTab === tab ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab === "queue" ? `Queue (${available.length})` : tab === "sold" ? `Sold (${soldPlayers.length})` : `Unsold (${unsoldPlayers.length})`}
                    </button>
                  ))}
                </div>
                <ScrollArea className="h-52">
                  <div className="space-y-1 pr-2">
                    {rightPanelPlayers.slice(0, 30).map(player => {
                      const team = player.teamId ? teamMap[player.teamId] : null;
                      const isQueue = reAuctionTab === "queue";
                      return (
                        <div
                          key={player.id}
                          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">{player.name}</span>
                              {team && <span className="text-[10px] text-muted-foreground">{team.name}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                            <span className="text-xs text-muted-foreground font-mono">{formatShortIndianRupee(player.soldPrice || player.basePrice)}</span>
                            {isQueue ? (
                              <button
                                disabled={!isActive || nextPlayer.isPending}
                                onClick={() => handleNextPlayer("sequential", player.id)}
                                className="text-xs px-2 py-1 rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Select
                              </button>
                            ) : (
                              <button
                                disabled={reAuction.isPending}
                                onClick={() => handleReAuction(player.id, true)}
                                className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                              >
                                <RotateCcw className="w-3 h-3" /> Re-bid
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {rightPanelPlayers.length === 0 && (
                      <p className="text-center text-muted-foreground text-sm py-4">
                        {reAuctionTab === "queue" ? "All players processed" : `No ${reAuctionTab} players`}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Manual Sell Dialog */}
      <Dialog open={manualSellOpen} onOpenChange={setManualSellOpen}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5" /> Manual Sell
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sell <strong className="text-foreground">{state?.currentPlayer?.name}</strong> directly to a team at a set price.
            </p>
            <div className="space-y-2">
              <Label>Team</Label>
              <Select value={manualTeamId} onValueChange={setManualTeamId}>
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent className="dark">
                  {(teams || []).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color || "#666" }} />
                        {t.name} — {formatShortIndianRupee(t.purse - t.purseUsed)} left
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                value={manualAmount}
                onChange={e => setManualAmount(e.target.value)}
                placeholder="e.g. 500000"
              />
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-blue-600 hover:bg-blue-500"
                disabled={!manualTeamId || !manualAmount || manualSellMut.isPending}
                onClick={handleManualSell}
              >
                Confirm Sell
              </Button>
              <Button variant="outline" onClick={() => setManualSellOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Trial Confirm Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm dark">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-400">
              <AlertTriangle className="w-5 h-5" /> Reset for Live Auction
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will reset ALL sold/unsold players back to "available" and clear all trial bids.
              Retained players will NOT be affected.
            </p>
            <p className="text-xs text-orange-400 font-semibold">This cannot be undone.</p>
            <div className="flex gap-3">
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-500 text-white"
                disabled={resetTrial.isPending}
                onClick={handleResetTrial}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Yes, Reset All
              </Button>
              <Button variant="outline" onClick={() => setShowResetConfirm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
