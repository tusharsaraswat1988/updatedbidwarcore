import { useState, useEffect, useCallback, useRef } from "react";
import {
  useListTeams,
  getListTeamsQueryKey,
  useSyncFortuneWheel,
} from "@workspace/api-client-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dices, RotateCcw, Trophy, Radio, Play, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PoolItem = { id: string; label: string; color: string; included: boolean };

const COLORS = [
  "#EF4444","#F97316","#EAB308","#22C55E","#14B8A6","#3B82F6","#8B5CF6","#EC4899",
  "#F87171","#FB923C","#FBBF24","#4ADE80","#2DD4BF","#60A5FA","#A78BFA","#F472B6",
];

const SPIN_DURATION_MS = 3500;

interface FortuneWheelModalProps {
  open: boolean;
  onClose: () => void;
  tournamentId: number;
}

export function FortuneWheelModal({ open, onClose, tournamentId }: FortuneWheelModalProps) {
  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId && open },
  });

  const syncMut = useSyncFortuneWheel();

  const [pool, setPool] = useState<PoolItem[]>([]);
  const [broadcasting, setBroadcasting] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<{ label: string; color: string } | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  // Activate wheel on LED display when modal opens
  useEffect(() => {
    if (!open || !tournamentId) return;
    activeRef.current = true;
    syncMut.mutate({ tournamentId, data: { active: true, winner: null } });
    return () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      syncMut.mutate({ tournamentId, data: { active: false, winner: null, spinning: false } });
    };
  }, [open, tournamentId]);

  // Reset local state when modal reopens
  useEffect(() => {
    if (open) {
      setPool([]);
      setSpinning(false);
      setWinner(null);
      setBroadcasting(true);
    }
  }, [open]);

  // Load teams as default pool (all included)
  useEffect(() => {
    if (teams && pool.length === 0 && open) {
      const newPool = teams.map((t, i) => ({
        id: String(t.id),
        label: t.name,
        color: t.color || COLORS[i % COLORS.length],
        included: true,
      }));
      setPool(newPool);
      if (broadcasting) {
        syncMut.mutate({
          tournamentId,
          data: { items: newPool.filter(p => p.included).map(({ label, color }) => ({ label, color })) },
        });
      }
    }
  }, [teams, open]);

  const activeItems = pool.filter(p => p.included);

  function syncPool(updated: PoolItem[]) {
    if (!broadcasting) return;
    syncMut.mutate({
      tournamentId,
      data: { items: updated.filter(p => p.included).map(({ label, color }) => ({ label, color })) },
    });
  }

  function toggleTeam(id: string) {
    const updated = pool.map(p => p.id === id ? { ...p, included: !p.included } : p);
    setPool(updated);
    syncPool(updated);
  }

  function toggleBroadcasting() {
    const next = !broadcasting;
    setBroadcasting(next);
    if (next) {
      syncMut.mutate({
        tournamentId,
        data: {
          active: true,
          winner: winner ? winner.label : null,
          items: activeItems.map(({ label, color }) => ({ label, color })),
        },
      });
    } else {
      syncMut.mutate({ tournamentId, data: { active: false, winner: null, spinning: false } });
    }
  }

  const run = useCallback(async () => {
    if (spinning || activeItems.length < 2) return;
    setSpinning(true);
    setWinner(null);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);

    let winnerLabel: string | null = null;
    try {
      const result = await syncMut.mutateAsync({
        tournamentId,
        data: {
          spinning: true,
          items: activeItems.map(({ label, color }) => ({ label, color })),
        },
      });
      winnerLabel = result.wheelWinner ?? null;
    } catch {
      setSpinning(false);
      return;
    }

    stopTimerRef.current = setTimeout(async () => {
      await syncMut.mutateAsync({ tournamentId, data: { spinning: false } });
      setSpinning(false);
      if (winnerLabel) {
        const found = activeItems.find(p => p.label === winnerLabel);
        setWinner({ label: winnerLabel, color: found?.color ?? "#EAB308" });
      }
    }, SPIN_DURATION_MS);
  }, [spinning, activeItems, tournamentId, syncMut]);

  async function rerun() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    setWinner(null);
    setSpinning(false);
    await syncMut.mutateAsync({ tournamentId, data: { winner: null, spinning: false } });
    run();
  }

  function handleClose() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    activeRef.current = false;
    syncMut.mutate({ tournamentId, data: { active: false, winner: null, spinning: false } });
    onClose();
  }

  const winnerColor = winner?.color ?? "#EAB308";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="
          max-w-none w-[calc(100vw-2rem)] sm:w-[90vw] lg:w-[820px]
          max-h-[calc(100vh-2rem)] h-auto
          p-0 gap-0 overflow-hidden
          border border-border/60 bg-background
        "
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 bg-card/40">
          <div className="flex items-center gap-3">
            <Dices className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-bold leading-tight">Fortune Wheel</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Server picks a random winner
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleBroadcasting}
              className={`flex items-center gap-1.5 h-7 px-3 text-xs font-semibold rounded border transition-all
                ${broadcasting
                  ? "bg-red-600/20 border-red-500/40 text-red-400 hover:bg-red-600/30"
                  : "bg-muted/30 border-border/50 text-muted-foreground hover:bg-muted/50"
                }`}
            >
              <Radio className="w-3 h-3" />
              {broadcasting ? "Broadcasting" : "Not Broadcasting"}
            </button>
            <button
              onClick={handleClose}
              className="flex items-center justify-center w-7 h-7 rounded border border-border/40 bg-muted/20 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-all"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col sm:flex-row gap-0 overflow-hidden">
          {/* Left: Pool + actions */}
          <div className="flex flex-col sm:w-[340px] border-b sm:border-b-0 sm:border-r border-border/40">
            {/* Pool list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[280px] sm:max-h-[360px]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Draw Pool
                </span>
                <Badge variant="outline" className="text-xs">
                  {activeItems.length < 2
                    ? <span className="text-amber-400">Need at least 2</span>
                    : `${activeItems.length} / ${pool.length} in draw`}
                </Badge>
              </div>
              {pool.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleTeam(item.id)}
                  disabled={spinning}
                  className={`w-full flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors text-left
                    ${item.included
                      ? "bg-card/80 border-border/80"
                      : "bg-muted/20 border-border/30 opacity-50"
                    }
                    ${spinning ? "cursor-not-allowed" : "hover:bg-card cursor-pointer"}
                  `}
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 transition-opacity ${item.included ? "opacity-100" : "opacity-30"}`}
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm flex-1 truncate">{item.label}</span>
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors
                    ${item.included ? "border-primary bg-primary" : "border-border bg-transparent"}`}>
                    {item.included && (
                      <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
              {pool.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">
                  Loading teams...
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="p-4 pt-3 border-t border-border/30 flex gap-2.5">
              <Button
                size="sm"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2"
                onClick={run}
                disabled={spinning || activeItems.length < 2}
              >
                <Play className="w-4 h-4" />
                {spinning ? "Spinning..." : "Run"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={rerun}
                disabled={spinning || activeItems.length < 2}
                className="gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                Rerun
              </Button>
            </div>
          </div>

          {/* Right: Status + winner */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-[200px] sm:min-h-[320px]">
            <AnimatePresence mode="wait">
              {spinning && (
                <motion.div
                  key="spinning"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center"
                >
                  <Dices className="w-12 h-12 mx-auto mb-4 text-primary animate-pulse" />
                  <p className="text-primary font-bold uppercase tracking-[0.3em] text-sm animate-pulse">
                    Spinning on LED...
                  </p>
                  <p className="text-muted-foreground text-xs mt-2">
                    Watch the big screen
                  </p>
                </motion.div>
              )}
              {!spinning && winner && (
                <motion.div
                  key="winner"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.8, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                  className="w-full max-w-sm"
                >
                  <div
                    className="rounded-xl border-2 p-6 text-center"
                    style={{ borderColor: winnerColor, boxShadow: `0 0 32px ${winnerColor}22` }}
                  >
                    <Trophy className="w-9 h-9 mx-auto mb-3" style={{ color: winnerColor }} />
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                      Winner
                    </p>
                    <p
                      className="text-3xl font-display font-black leading-tight"
                      style={{ color: winnerColor, textShadow: `0 0 30px ${winnerColor}88` }}
                    >
                      {winner.label}
                    </p>
                  </div>
                  <p className="text-center text-xs text-muted-foreground mt-3">
                    Press Rerun to draw again
                  </p>
                </motion.div>
              )}
              {!spinning && !winner && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-muted-foreground"
                >
                  <Dices className="w-14 h-14 mx-auto mb-4 opacity-15" />
                  <p className="text-sm">Press Run to draw a winner</p>
                  <p className="text-xs mt-1 opacity-60">Animation plays on the LED screen</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
