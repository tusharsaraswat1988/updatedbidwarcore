import { useState, useEffect, useCallback, useRef } from "react";
import {
  useListTeams,
  getListTeamsQueryKey,
  useSyncFortuneWheel,
} from "@workspace/api-client-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Dices,
  RotateCcw,
  Trophy,
  Radio,
  Play,
  X,
  Check,
  Sparkles,
  CheckSquare,
  Square,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PoolItem = { id: string; label: string; color: string; included: boolean };

const COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6", "#3B82F6", "#8B5CF6", "#EC4899",
  "#F87171", "#FB923C", "#FBBF24", "#4ADE80", "#2DD4BF", "#60A5FA", "#A78BFA", "#F472B6",
];

const SPIN_DURATION_MS = 3500;

interface FortuneWheelModalProps {
  open: boolean;
  onClose: () => void;
  tournamentId: number;
}

function drawWheelCanvas(
  canvas: HTMLCanvasElement,
  items: { label: string; color: string }[],
  rotation: number,
  highlightWinner?: string | null
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  const size = 280;
  canvas.width = size * dpr;
  canvas.height = size * dpr;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16;

  if (items.length < 2) {
    // Empty / minimum state circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    return;
  }

  const arc = (2 * Math.PI) / items.length;

  // Outer dark boundary rim
  ctx.beginPath();
  ctx.arc(cx, cy, r + 4, 0, 2 * Math.PI);
  ctx.fillStyle = "#0c1322";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Draw team slices
  items.forEach((item, i) => {
    const start = rotation + i * arc;
    const end = start + arc;
    const isWinner = highlightWinner === item.label;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();

    ctx.fillStyle = item.color;
    ctx.fill();

    // Slice divider
    ctx.strokeStyle = "#070c18";
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Winner highlight outline
    if (isWinner) {
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Text label
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffffff";
    const fontSize = Math.max(10, Math.min(13, Math.floor(150 / items.length)));
    ctx.font = `bold ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 4;

    const maxChars = Math.min(14, Math.floor(r / (fontSize * 0.72)));
    const label =
      item.label.length > maxChars
        ? item.label.slice(0, maxChars - 1) + "…"
        : item.label;

    ctx.fillText(label, r - 16, fontSize * 0.35);
    ctx.restore();
  });

  // Center Hub
  ctx.beginPath();
  ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
  ctx.fillStyle = "#0B1120";
  ctx.fill();
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3;
  ctx.stroke();

  // Center gold dot
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, 2 * Math.PI);
  ctx.fillStyle = "#f59e0b";
  ctx.fill();

  ctx.restore();
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

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotRef = useRef(0);
  const animFrameRef = useRef<number | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  // Activate wheel on LED display when modal opens
  useEffect(() => {
    if (!open || !tournamentId) return;
    activeRef.current = true;
    syncMut.mutate({ tournamentId, data: { active: true, winner: null, spinning: false } });
    return () => {
      if (!activeRef.current) return;
      activeRef.current = false;
      if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
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
      rotRef.current = 0;
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
          data: { items: newPool.filter((p) => p.included).map(({ label, color }) => ({ label, color })) },
        });
      }
    }
  }, [teams, open]);

  const activeItems = pool.filter((p) => p.included);

  // Sync wheel preview on canvas whenever pool or winner changes
  useEffect(() => {
    if (canvasRef.current && !spinning) {
      drawWheelCanvas(
        canvasRef.current,
        activeItems,
        rotRef.current,
        winner?.label ?? null
      );
    }
  }, [activeItems, winner, spinning]);

  function syncPool(updated: PoolItem[]) {
    if (!broadcasting) return;
    syncMut.mutate({
      tournamentId,
      data: { items: updated.filter((p) => p.included).map(({ label, color }) => ({ label, color })) },
    });
  }

  function toggleTeam(id: string) {
    if (spinning) return;
    const updated = pool.map((p) => (p.id === id ? { ...p, included: !p.included } : p));
    setPool(updated);
    syncPool(updated);
  }

  function handleSelectAll() {
    if (spinning) return;
    const updated = pool.map((p) => ({ ...p, included: true }));
    setPool(updated);
    syncPool(updated);
  }

  function handleClearAll() {
    if (spinning) return;
    const updated = pool.map((p) => ({ ...p, included: false }));
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
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

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

    // Determine target slice and target rotation
    const arc = (2 * Math.PI) / activeItems.length;
    const winnerIdx = Math.max(
      0,
      activeItems.findIndex((p) => p.label === winnerLabel)
    );
    // 12 o'clock pointer is angle 1.5 * Math.PI
    const rawTarget = 1.5 * Math.PI - (winnerIdx * arc + arc / 2);

    const startRot = rotRef.current;
    const currentNorm = ((startRot % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const targetNorm = ((rawTarget % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    let delta = targetNorm - currentNorm;
    if (delta <= 0) delta += 2 * Math.PI;

    // Add 6 full spins for high-energy anticipation
    const totalRotation = delta + 6 * 2 * Math.PI;
    const finalRot = startRot + totalRotation;
    const startTime = performance.now();
    const duration = SPIN_DURATION_MS;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Ease out quartic for dramatic deceleration into the winning team
      const ease = 1 - Math.pow(1 - progress, 4);
      const curRot = startRot + totalRotation * ease;
      rotRef.current = curRot;

      if (canvasRef.current) {
        drawWheelCanvas(
          canvasRef.current,
          activeItems,
          curRot,
          progress >= 1 ? winnerLabel : null
        );
      }

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(tick);
      } else {
        rotRef.current = finalRot;
        setSpinning(false);
        if (winnerLabel) {
          const found = activeItems.find((p) => p.label === winnerLabel);
          setWinner({ label: winnerLabel, color: found?.color ?? "#EAB308" });
        }
        // Notify backend that spinning has completed
        syncMut.mutate({ tournamentId, data: { spinning: false } });
      }
    };

    animFrameRef.current = requestAnimationFrame(tick);
  }, [spinning, activeItems, tournamentId, syncMut]);

  async function rerun() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setWinner(null);
    setSpinning(false);
    await syncMut.mutateAsync({ tournamentId, data: { winner: null, spinning: false } });
    run();
  }

  function handleClose() {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    activeRef.current = false;
    syncMut.mutate({ tournamentId, data: { active: false, winner: null, spinning: false } });
    onClose();
  }

  const winnerColor = winner?.color ?? "#EAB308";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        className="
          max-w-none w-[calc(100vw-2rem)] sm:w-[94vw] lg:w-[860px]
          max-h-[calc(100vh-2rem)] h-auto
          p-0 gap-0 overflow-hidden
          border border-white/15 bg-[#0B1120] text-white shadow-2xl rounded-2xl
        "
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-white/10 bg-[#070c18]/90 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0 shadow-xs">
              <Dices className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black text-white leading-tight">
                  Fortune Wheel
                </h2>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/35">
                  Tiebreaker &amp; Draw
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-white/50 mt-0.5">
                Stage lottery wheel • Synchronized with live LED screen
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleBroadcasting}
              className={`flex items-center gap-1.5 h-7.5 px-2.5 text-xs font-bold rounded-lg border transition-all ${
                broadcasting
                  ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30"
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
              title={broadcasting ? "Wheel is broadcasting live to stage LED" : "Wheel is hidden from stage LED"}
            >
              <span className={`w-2 h-2 rounded-full ${broadcasting ? "bg-emerald-400 animate-pulse" : "bg-white/30"}`} />
              <Radio className="w-3 h-3" />
              <span>{broadcasting ? "Stage LED: ON AIR" : "Stage LED: Standby"}</span>
            </button>

            <button
              type="button"
              onClick={handleClose}
              className="flex items-center justify-center w-7.5 h-7.5 rounded-lg border border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-col md:flex-row gap-0 overflow-hidden">
          {/* Left Column: Team Pool Selection */}
          <div className="flex flex-col w-full md:w-[350px] border-b md:border-b-0 md:border-r border-white/10 bg-[#070c18]/70">
            {/* Pool Toolbar */}
            <div className="p-3 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.01]">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/25">
                  Draw Pool
                </span>
                <span className="text-xs font-bold text-white/70">
                  {activeItems.length < 2 ? (
                    <span className="text-amber-300">Min 2 required</span>
                  ) : (
                    `${activeItems.length} of ${pool.length} teams`
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  disabled={spinning}
                  className="px-2 py-0.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                >
                  All
                </button>
                <span className="text-white/20">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={spinning}
                  className="px-2 py-0.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Pool List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[220px] md:max-h-[350px] scrollbar-thin scrollbar-thumb-white/10">
              {pool.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleTeam(item.id)}
                  disabled={spinning}
                  className={`w-full flex items-center gap-2.5 py-2 px-2.5 rounded-lg border text-left transition-all ${
                    item.included
                      ? "bg-white/[0.06] border-white/20 hover:bg-white/[0.09]"
                      : "bg-white/[0.01] border-white/5 opacity-40 hover:opacity-70"
                  } ${spinning ? "cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0 shadow-xs transition-opacity"
                    style={{
                      backgroundColor: item.color,
                      boxShadow: item.included ? `0 0 8px ${item.color}99` : "none",
                    }}
                  />
                  <span className="text-xs sm:text-sm font-bold text-white flex-1 truncate">
                    {item.label}
                  </span>
                  <div
                    className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                      item.included
                        ? "bg-amber-400 border-amber-400 text-slate-950 font-black"
                        : "border-white/25 bg-transparent"
                    }`}
                  >
                    {item.included && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </button>
              ))}

              {pool.length === 0 && (
                <p className="text-center text-white/40 text-xs py-8">
                  Loading tournament teams...
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="p-3 border-t border-white/10 flex gap-2 bg-[#0B1120]/80 shrink-0">
              <Button
                size="sm"
                className="flex-1 h-10 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs sm:text-sm rounded-xl gap-2 shadow-[0_0_16px_rgba(251,191,36,0.25)] active:scale-[0.98] transition-all disabled:opacity-40"
                onClick={run}
                disabled={spinning || activeItems.length < 2}
              >
                <Play className="w-4 h-4 fill-current" />
                {spinning ? "Spinning..." : "Run Fortune Draw"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={rerun}
                disabled={spinning || activeItems.length < 2}
                className="h-10 px-3.5 bg-white/5 border-white/15 text-white hover:bg-white/10 rounded-xl gap-1.5 font-bold text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Rerun
              </Button>
            </div>
          </div>

          {/* Right Column: Live Interactive Wheel Visualizer & Winner Display */}
          <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 bg-[#070c18]/40 relative min-h-[320px] md:min-h-[420px]">
            {/* Wheel Canvas Container */}
            <div className="relative w-[280px] h-[280px] flex items-center justify-center">
              {/* Top pointer marker at 12 o'clock */}
              <div className="absolute top-1 left-1/2 -translate-x-1/2 z-20 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
                <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
                  <path
                    d="M11 26L2 4C1 2 2.5 0 5 0H17C19.5 0 21 2 20 4L11 26Z"
                    fill="#f59e0b"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </svg>
              </div>

              {/* Ambient Radial Backlight */}
              <div className="absolute inset-0 rounded-full bg-radial from-amber-500/10 via-purple-500/5 to-transparent blur-md pointer-events-none" />

              {/* Canvas wheel */}
              <canvas
                ref={canvasRef}
                style={{ width: "280px", height: "280px" }}
                className="rounded-full select-none"
              />
            </div>

            {/* Bottom Status / Winner Announcement Card */}
            <div className="w-full max-w-sm mt-4 min-h-[70px] flex items-center justify-center text-center">
              <AnimatePresence mode="wait">
                {spinning && (
                  <motion.div
                    key="spinning"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    className="flex flex-col items-center"
                  >
                    <div className="flex items-center gap-2 text-amber-300 font-black uppercase tracking-wider text-xs bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-400/30 animate-pulse">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Spinning live on LED stage...
                    </div>
                    <p className="text-[11px] text-white/50 mt-1.5">
                      Wheel is drawing winner randomly from the pool
                    </p>
                  </motion.div>
                )}

                {!spinning && winner && (
                  <motion.div
                    key="winner"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.35, duration: 0.5 }}
                    className="w-full"
                  >
                    <div
                      className="rounded-xl border p-3.5 text-center relative overflow-hidden"
                      style={{
                        backgroundColor: `${winnerColor}15`,
                        borderColor: `${winnerColor}50`,
                        boxShadow: `0 0 24px ${winnerColor}30`,
                      }}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Trophy className="w-4 h-4" style={{ color: winnerColor }} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                          Lottery Winner
                        </span>
                      </div>
                      <p
                        className="text-xl sm:text-2xl font-black tracking-tight truncate leading-tight"
                        style={{
                          color: winnerColor,
                          textShadow: `0 0 20px ${winnerColor}80`,
                        }}
                      >
                        {winner.label}
                      </p>
                      <p className="text-[11px] text-white/60 mt-1">
                        Broadcast live on LED stage screen • Press Rerun to draw again
                      </p>
                    </div>
                  </motion.div>
                )}

                {!spinning && !winner && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center"
                  >
                    {activeItems.length >= 2 ? (
                      <p className="text-xs text-white/60">
                        Ready to spin • Click <span className="text-amber-400 font-bold">"Run Fortune Draw"</span> to pick a winner
                      </p>
                    ) : (
                      <p className="text-xs text-amber-300 font-semibold">
                        Select at least 2 teams from the pool on the left to activate draw
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
