import { useState, useRef, useEffect, useCallback } from "react";
import { useRoute } from "wouter";
import {
  useListTeams,
  useListPlayers,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
  useSyncFortuneWheel,
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dices, Plus, X, RotateCcw, Trophy, Radio } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type WheelItem = { id: string; label: string; color: string };

const COLORS = [
  "#EF4444","#F97316","#EAB308","#22C55E","#14B8A6","#3B82F6","#8B5CF6","#EC4899",
  "#F87171","#FB923C","#FBBF24","#4ADE80","#2DD4BF","#60A5FA","#A78BFA","#F472B6",
];

function drawWheel(canvas: HTMLCanvasElement, items: WheelItem[], rotation: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !items.length) return;
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(cx, cy) - 10;
  const arc = (2 * Math.PI) / items.length;

  ctx.clearRect(0, 0, width, height);

  items.forEach((item, i) => {
    const start = rotation + i * arc;
    const end = start + arc;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.min(14, 120 / items.length)}px system-ui`;
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 4;
    const maxLen = 12;
    const label = item.label.length > maxLen ? item.label.slice(0, maxLen) + "…" : item.label;
    ctx.fillText(label, r - 14, 5);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
  ctx.fillStyle = "#09090b";
  ctx.fill();
  ctx.strokeStyle = "#444";
  ctx.lineWidth = 2;
  ctx.stroke();
}

export default function FortuneWheel() {
  const [, params] = useRoute("/tournament/:id/fortune-wheel");
  const tournamentId = parseInt(params?.id || "0");

  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const syncMut = useSyncFortuneWheel();

  const [items, setItems] = useState<WheelItem[]>([]);
  const [customLabel, setCustomLabel] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<WheelItem | null>(null);
  const [rotation, setRotation] = useState(0);
  const [broadcasting, setBroadcasting] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const [canvasSize, setCanvasSize] = useState(360);

  // Responsive canvas size
  useEffect(() => {
    function updateSize() {
      if (canvasContainerRef.current) {
        const w = canvasContainerRef.current.clientWidth;
        setCanvasSize(Math.min(w, 420));
      }
    }
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (canvasContainerRef.current) ro.observe(canvasContainerRef.current);
    return () => ro.disconnect();
  }, []);

  const syncItems = useCallback((newItems: WheelItem[]) => {
    if (!broadcasting) return;
    syncMut.mutate({
      tournamentId,
      data: { items: newItems.map(({ label, color }) => ({ label, color })) },
    });
  }, [broadcasting, tournamentId]);

  // On mount: activate fortune wheel on all displays
  useEffect(() => {
    syncMut.mutate({ tournamentId, data: { active: true, winner: null } });
    return () => {
      syncMut.mutate({ tournamentId, data: { active: false, winner: null } });
    };
  }, [tournamentId]);

  // Load teams as default entries
  useEffect(() => {
    if (teams && items.length === 0) {
      const newItems = teams.map((t, i) => ({
        id: String(t.id),
        label: t.name,
        color: t.color || COLORS[i % COLORS.length],
      }));
      setItems(newItems);
      syncItems(newItems);
    }
  }, [teams]);

  useEffect(() => {
    if (canvasRef.current) {
      drawWheel(canvasRef.current, items, rotation);
    }
  }, [items, rotation, canvasSize]);

  function toggleBroadcasting() {
    const next = !broadcasting;
    setBroadcasting(next);
    if (next) {
      // Turning ON — reactivate display
      syncMut.mutate({ tournamentId, data: { active: true, winner: winner ? winner.label : null } });
      syncItems(items);
    } else {
      // Turning OFF — immediately hide on display
      syncMut.mutate({ tournamentId, data: { active: false, winner: null, spinning: false } });
    }
  }

  function addCustom() {
    if (!customLabel.trim()) return;
    const newItems = [
      ...items,
      { id: Date.now().toString(), label: customLabel.trim(), color: COLORS[items.length % COLORS.length] },
    ];
    setItems(newItems);
    setCustomLabel("");
    syncItems(newItems);
  }

  function removeItem(id: string) {
    const newItems = items.filter(i => i.id !== id);
    setItems(newItems);
    syncItems(newItems);
  }

  function loadTeams() {
    if (!teams) return;
    const newItems = teams.map((t, i) => ({
      id: String(t.id),
      label: t.name,
      color: t.color || COLORS[i % COLORS.length],
    }));
    setItems(newItems);
    setWinner(null);
    syncItems(newItems);
    // Clear winner on display
    syncMut.mutate({ tournamentId, data: { winner: null } });
  }

  function spin() {
    if (spinning || items.length < 2) return;
    setSpinning(true);
    setWinner(null);

    // Immediately broadcast spin start to all displays so they animate simultaneously
    if (broadcasting) {
      syncMut.mutate({ tournamentId, data: { spinning: true } });
    }

    const extraSpins = 5 + Math.floor(Math.random() * 5);
    const targetAngle = rotation + extraSpins * 2 * Math.PI + Math.random() * 2 * Math.PI;
    const duration = 4000;
    const startTime = performance.now();
    const startRotation = rotation;

    function easeOut(t: number) {
      return 1 - Math.pow(1 - t, 4);
    }

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const current = startRotation + (targetAngle - startRotation) * easeOut(progress);
      setRotation(current);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        const arc = (2 * Math.PI) / items.length;
        const normalised = (((-current) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        const idx = Math.floor(normalised / arc) % items.length;
        const won = items[idx];
        setWinner(won);
        setSpinning(false);
        // Broadcast winner to display — display will snap to winner
        if (broadcasting) {
          syncMut.mutate({ tournamentId, data: { spinning: false, winner: won.label } });
        }
      }
    }

    animRef.current = requestAnimationFrame(animate);
  }

  return (
    <AppLayout tournamentId={tournamentId}>
      <div className="space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-4xl font-bold tracking-tight flex items-center gap-3">
              <Dices className="w-8 h-8 text-primary" /> Fortune Wheel
            </h1>
            <p className="text-muted-foreground mt-2">Spin to pick a random winner — useful for tie-breaks, draft order, or any fair draw.</p>
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
          <p><strong className="text-foreground">How it works:</strong> The wheel is automatically loaded with all your teams. Add extra entries if needed (e.g. player names). Press <strong className="text-foreground">Spin</strong> and the wheel picks a winner at random.</p>
          <p>Turn on <strong className="text-foreground">Broadcasting to LED</strong> to show the spinning wheel on your big screen during the event.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Wheel */}
          <div className="flex flex-col items-center gap-6" ref={canvasContainerRef}>
            <div className="relative w-full flex justify-center">
              <div className="absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                <div className="w-0 h-0 border-t-[12px] border-b-[12px] border-r-[28px] border-t-transparent border-b-transparent border-r-primary" />
              </div>
              <canvas
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                className="rounded-full"
                style={{ filter: "drop-shadow(0 0 40px rgba(234,179,8,0.3))" }}
              />
            </div>
            <div className="flex gap-3">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-10 gap-2 text-lg"
                onClick={spin}
                disabled={spinning || items.length < 2}
              >
                <Dices className="w-5 h-5" />
                {spinning ? "Spinning..." : "SPIN"}
              </Button>
              <Button variant="outline" size="lg" onClick={() => {
                setWinner(null);
                setRotation(0);
                syncMut.mutate({ tournamentId, data: { winner: null, spinning: false } });
              }}>
                <RotateCcw className="w-5 h-5" />
              </Button>
            </div>

            <AnimatePresence>
              {winner && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="w-full"
                >
                  <Card className="border-2" style={{ borderColor: winner.color }}>
                    <CardContent className="p-6 text-center">
                      <Trophy className="w-8 h-8 mx-auto mb-2" style={{ color: winner.color }} />
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Winner</p>
                      <p className="text-4xl font-display font-black" style={{ color: winner.color, textShadow: `0 0 40px ${winner.color}88` }}>
                        {winner.label}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Controls */}
          <div className="space-y-5">
            <Card className="border-border">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Wheel Entries ({items.length})</h3>
                  <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={loadTeams}>
                    <RotateCcw className="w-3.5 h-3.5" /> Load Teams
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={customLabel}
                    onChange={e => setCustomLabel(e.target.value)}
                    placeholder="Add custom entry..."
                    onKeyDown={e => e.key === "Enter" && addCustom()}
                  />
                  <Button size="sm" onClick={addCustom} className="gap-1">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-card/50 border border-border/50">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-sm flex-1 truncate">{item.label}</span>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {items.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-4">No entries yet. Load teams or add custom entries.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/30">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-2">How to use</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>· Opening this page activates the fortune wheel on all LED displays</li>
                  <li>· Load teams automatically with "Load Teams"</li>
                  <li>· Remove teams not in the tiebreaker</li>
                  <li>· Press SPIN — all screens animate simultaneously</li>
                  <li>· Leaving this page returns displays to auction view</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
