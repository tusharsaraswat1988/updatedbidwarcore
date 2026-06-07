import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute } from "wouter";
import {
  useListTeams,
  getListTeamsQueryKey,
  useSyncFortuneWheel,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dices, RotateCcw, Trophy, Radio, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PoolItem = { id: string; label: string; color: string; included: boolean };

const COLORS = [
  "#EF4444","#F97316","#EAB308","#22C55E","#14B8A6","#3B82F6","#8B5CF6","#EC4899",
  "#F87171","#FB923C","#FBBF24","#4ADE80","#2DD4BF","#60A5FA","#A78BFA","#F472B6",
];

const SPIN_DURATION_MS = 3500;

export default function FortuneWheel() {
  const [, params] = useRoute("/tournament/:id/fortune-wheel");
  const tournamentId = parseInt(params?.id || "0");

  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const syncMut = useSyncFortuneWheel();

  const [pool, setPool] = useState<PoolItem[]>([]);
  const [broadcasting, setBroadcasting] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<{ label: string; color: string } | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Activate fortune wheel on all displays when operator opens this page
  useEffect(() => {
    syncMut.mutate({ tournamentId, data: { active: true, winner: null, spinning: false } });
    return () => {
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      syncMut.mutate({ tournamentId, data: { active: false, winner: null, spinning: false } });
    };
  }, [tournamentId]);

  // Load teams as default pool entries (all included)
  useEffect(() => {
    if (teams && pool.length === 0) {
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
  }, [teams]);

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

    // Clear any pending stop timer from a previous run
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);

    // Send spin=true with current pool — server picks random winner and stores it
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

    // After animation time, set spinning=false → LED display lands on winner
    stopTimerRef.current = setTimeout(async () => {
      await syncMut.mutateAsync({ tournamentId, data: { spinning: false } });
      setSpinning(false);

      // Show winner on operator panel
      if (winnerLabel) {
        const found = activeItems.find(p => p.label === winnerLabel);
        setWinner({
          label: winnerLabel,
          color: found?.color ?? "#EAB308",
        });
      }
    }, SPIN_DURATION_MS);
  }, [spinning, activeItems, tournamentId, syncMut]);

  async function rerun() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    setWinner(null);
    setSpinning(false);
    // Reset state then immediately run
    await syncMut.mutateAsync({ tournamentId, data: { winner: null, spinning: false } });
    run();
  }

  const winnerColor = winner?.color ?? "#EAB308";

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Dices className="w-8 h-8 text-primary" /> Fortune Wheel
            </h1>
            <p className="text-muted-foreground mt-2">
              Server picks a random winner — operator cannot influence the result.
            </p>
          </div>
          <Button
            variant={broadcasting ? "default" : "outline"}
            size="sm"
            className={`gap-2 mt-1 ${broadcasting ? "bg-red-600 hover:bg-red-500 text-white" : ""}`}
            onClick={toggleBroadcasting}
          >
            <Radio className="w-4 h-4" />
            {broadcasting ? "Broadcasting to LED" : "Not Broadcasting"}
          </Button>
        </div>

        <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p>
            <strong className="text-foreground">How it works:</strong> Teams are loaded from your tournament.
            Uncheck any team to exclude them from this draw. Press{" "}
            <strong className="text-foreground">Run</strong> — the server picks a random winner and the LED display
            shows the full spin animation. Use <strong className="text-foreground">Rerun</strong> to draw again.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-5">
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Draw Pool ({activeItems.length} / {pool.length})</h3>
                  <Badge variant="outline" className="text-xs">
                    {activeItems.length < 2 ? "Need at least 2" : `${activeItems.length} in draw`}
                  </Badge>
                </div>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
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
                        className={`w-3 h-3 rounded-full flex-shrink-0 transition-opacity ${item.included ? "opacity-100" : "opacity-30"}`}
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
                    <p className="text-center text-muted-foreground text-sm py-6">
                      Loading teams...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-2 text-base"
                onClick={run}
                disabled={spinning || activeItems.length < 2}
              >
                <Play className="w-5 h-5" />
                {spinning ? "Spinning..." : "Run"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={rerun}
                disabled={spinning || activeItems.length < 2}
                className="gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Rerun
              </Button>
            </div>
          </div>

          {/* Winner display */}
          <div className="flex flex-col items-center justify-center gap-6">
            <AnimatePresence mode="wait">
              {spinning && (
                <motion.div
                  key="spinning-indicator"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-center"
                >
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Dices className="w-10 h-10 text-primary animate-pulse" />
                  </div>
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
                  key="winner-card"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                  className="w-full"
                >
                  <Card className="border-2" style={{ borderColor: winnerColor }}>
                    <CardContent className="p-8 text-center">
                      <Trophy className="w-10 h-10 mx-auto mb-3" style={{ color: winnerColor }} />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
                        Winner
                      </p>
                      <p
                        className="text-4xl font-display font-black"
                        style={{ color: winnerColor, textShadow: `0 0 40px ${winnerColor}88` }}
                      >
                        {winner.label}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
              {!spinning && !winner && (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center text-muted-foreground"
                >
                  <Dices className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-sm">Press Run to draw a winner</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
