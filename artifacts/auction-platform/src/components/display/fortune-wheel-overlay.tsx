import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dices } from "lucide-react";
import type { WheelItem } from "./types";

function drawWheelCanvas(
  canvas: HTMLCanvasElement,
  items: WheelItem[],
  rotation: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !items.length) return;
  const { width, height } = canvas;
  const cx = width / 2,
    cy = height / 2;
  const r = Math.min(cx, cy) - 12;
  const arc = (2 * Math.PI) / items.length;
  ctx.clearRect(0, 0, width, height);
  items.forEach((item, i) => {
    const start = rotation + i * arc,
      end = start + arc;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, end);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = "#0a0a0a";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + arc / 2);
    ctx.textAlign = "right";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.min(18, 160 / items.length)}px system-ui`;
    ctx.shadowColor = "rgba(0,0,0,0.7)";
    ctx.shadowBlur = 6;
    const maxLen = 14;
    const label =
      item.label.length > maxLen
        ? item.label.slice(0, maxLen) + "…"
        : item.label;
    ctx.fillText(label, r - 18, 6);
    ctx.restore();
  });
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, 2 * Math.PI);
  ctx.fillStyle = "#09090b";
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 3;
  ctx.stroke();
}

/**
 * Fortune wheel overlay. Performance-critical:
 *  - Owns a single, persistent RAF loop that runs for the entire
 *    component lifetime (never restarted by state changes). The loop
 *    reads stateRef each frame, eliminating effect-cleanup races
 *    between fast-spin → landing transitions.
 *  - Drawing happens directly on canvas; no React rerenders per frame.
 *  - React.memo'd at module boundary so wheel spinning never invokes
 *    a DisplayShell rerender, and DisplayShell rerenders never restart
 *    the RAF loop.
 */
export const FortuneWheelOverlay = memo(function FortuneWheelOverlay({
  items,
  winner,
  wheelSpinning,
}: {
  items: WheelItem[];
  winner: string | null | undefined;
  wheelSpinning?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const speedRef = useRef(0.005);
  // State machine driven entirely via refs to avoid React effect-cleanup races
  // between fast-spin and landing animations. A single RAF loop reads stateRef.
  type AnimState =
    | { mode: "idle" }
    | { mode: "spin" }
    | {
        mode: "land";
        startRot: number;
        targetRot: number;
        startTime: number;
        duration: number;
      };
  const stateRef = useRef<AnimState>({ mode: "idle" });
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const [localWinner, setLocalWinner] = useState<{
    label: string;
    color: string;
  } | null>(null);
  const [showSpinning, setShowSpinning] = useState(false);
  // Track which (winner, items.length) we have already kicked a landing for,
  // so we don't restart the landing animation on every items poll update.
  const landedForRef = useRef<{
    winner: string | null | undefined;
    itemsLen: number;
  }>({ winner: undefined, itemsLen: 0 });
  // Only animate spin/land on live transitions — never replay persisted session
  // state when the LED display first mounts (stale wheelSpinning / wheelWinner).
  const hydratedRef = useRef(false);
  const prevSpinningRef = useRef(false);

  // Single, persistent RAF loop. Never cancelled by state changes — the loop
  // simply reads stateRef each frame, so spin → land transitions are race-free.
  useEffect(() => {
    let alive = true;
    let raf = 0;
    function tick(now: number) {
      if (!alive) return;
      const s = stateRef.current;
      if (s.mode === "idle") {
        speedRef.current += (0.003 - speedRef.current) * 0.04;
        rotRef.current += speedRef.current;
      } else if (s.mode === "spin") {
        // Fast spin — matches operator's perceived speed (~0.25 rad/frame)
        speedRef.current += (0.12 - speedRef.current) * 0.08;
        rotRef.current += speedRef.current;
      } else if (s.mode === "land") {
        const progress = Math.min((now - s.startTime) / s.duration, 1);
        const ease = 1 - Math.pow(1 - progress, 4);
        rotRef.current = s.startRot + (s.targetRot - s.startRot) * ease;
        if (progress >= 1) {
          stateRef.current = { mode: "idle" };
          speedRef.current = 0.003;
          setShowSpinning(false);
          const winLabel = (s as { winnerLabel?: string }).winnerLabel;
          if (winLabel) {
            const w = itemsRef.current.find((i) => i.label === winLabel);
            setLocalWinner(
              w
                ? { label: w.label, color: w.color }
                : { label: winLabel, color: "#EAB308" },
            );
          }
        }
      }
      if (canvasRef.current && itemsRef.current.length) {
        drawWheelCanvas(canvasRef.current, itemsRef.current, rotRef.current);
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // React only to live spin/land transitions after hydration. Persisted
  // wheelSpinning / wheelWinner from a previous draw must not replay on mount.
  useEffect(() => {
    const spinning = !!wheelSpinning;

    function showStaticWinner(label: string) {
      if (items.length) {
        const w = items.find((i) => i.label === label);
        setLocalWinner(
          w
            ? { label: w.label, color: w.color }
            : { label, color: "#EAB308" },
        );
        landedForRef.current = { winner: label, itemsLen: items.length };
      } else {
        setLocalWinner({ label, color: "#EAB308" });
      }
      setShowSpinning(false);
    }

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      prevSpinningRef.current = spinning;
      stateRef.current = { mode: "idle" };
      setShowSpinning(false);
      if (!spinning && winner) {
        showStaticWinner(winner);
      }
      return;
    }

    const spinStarted = spinning && !prevSpinningRef.current;
    const spinStopped = !spinning && prevSpinningRef.current;
    prevSpinningRef.current = spinning;

    if (spinning) {
      if (spinStarted) {
        stateRef.current = { mode: "spin" };
        landedForRef.current = { winner: undefined, itemsLen: 0 };
        setLocalWinner(null);
        setShowSpinning(true);
      }
      return;
    }

    if (!winner) {
      if (stateRef.current.mode !== "land") {
        stateRef.current = { mode: "idle" };
      }
      landedForRef.current = { winner: null, itemsLen: 0 };
      setLocalWinner(null);
      setShowSpinning(false);
      return;
    }

    // Winner present but spin did not just finish — show card, no landing replay.
    if (!spinStopped) {
      if (
        landedForRef.current.winner !== winner ||
        landedForRef.current.itemsLen !== items.length
      ) {
        showStaticWinner(winner);
      }
      return;
    }

    if (
      landedForRef.current.winner === winner &&
      landedForRef.current.itemsLen === items.length
    ) {
      return;
    }
    landedForRef.current = { winner, itemsLen: items.length };

    if (!items.length) {
      showStaticWinner(winner);
      return;
    }

    const winnerIdx = items.findIndex((i) => i.label === winner);
    if (winnerIdx < 0) {
      stateRef.current = { mode: "idle" };
      showStaticWinner(winner);
      return;
    }

    const arc = (2 * Math.PI) / items.length;
    const sliceCenter = winnerIdx * arc + arc / 2;
    const currentNorm =
      ((rotRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const targetNorm =
      (((2 * Math.PI - sliceCenter) % (2 * Math.PI)) + 2 * Math.PI) %
      (2 * Math.PI);
    const distToTarget =
      (targetNorm - currentNorm + 2 * Math.PI) % (2 * Math.PI);
    const target = rotRef.current + 4 * 2 * Math.PI + distToTarget;

    stateRef.current = {
      mode: "land",
      startRot: rotRef.current,
      targetRot: target,
      startTime: performance.now(),
      duration: 4000,
      ...({ winnerLabel: winner } as object),
    } as AnimState;
    setLocalWinner(null);
    setShowSpinning(true);
  }, [wheelSpinning, winner, items]);

  useEffect(() => {
    if (canvasRef.current && items.length)
      drawWheelCanvas(canvasRef.current, items, rotRef.current);
  }, [items]);

  // Responsive canvas size — fill 70vh, cap at 700
  const size =
    typeof window !== "undefined"
      ? Math.min(window.innerHeight * 0.68, 700)
      : 600;

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #1a1a2e 0%, #09090b 100%)",
      }}
    >
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-3 mb-4 flex-shrink-0"
      >
        <Dices className="w-8 h-8 md:w-10 md:h-10 text-primary" />
        <h1
          className="font-display font-black text-3xl md:text-5xl tracking-tight text-white"
          style={{ textShadow: "0 0 40px rgba(234,179,8,0.5)" }}
        >
          FORTUNE WHEEL
        </h1>
        <Dices className="w-8 h-8 md:w-10 md:h-10 text-primary" />
      </motion.div>

      {/* Spinning indicator */}
      <AnimatePresence>
        {showSpinning && !localWinner && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: [0.5, 1, 0.5], y: 0 }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.8, repeat: Infinity },
              y: { duration: 0.3 },
            }}
            className="text-primary font-bold uppercase tracking-[0.3em] text-sm mb-3 flex-shrink-0"
          >
            Spinning...
          </motion.p>
        )}
      </AnimatePresence>

      <div className="relative flex-shrink-0">
        <div className="absolute top-1/2 -right-5 -translate-y-1/2 z-10">
          <div className="w-0 h-0 border-t-[16px] border-b-[16px] border-r-[36px] border-t-transparent border-b-transparent border-r-primary drop-shadow-lg" />
        </div>
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="rounded-full"
          style={{ filter: "drop-shadow(0 0 60px rgba(234,179,8,0.4))" }}
        />
      </div>
      <AnimatePresence>
        {localWinner && (
          <motion.div
            initial={{ scale: 0, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.7 }}
            className="mt-6 text-center px-8 md:px-12 py-4 md:py-6 rounded-3xl border-4 flex-shrink-0"
            style={{
              borderColor: localWinner.color,
              background: `${localWinner.color}22`,
              boxShadow: `0 0 80px ${localWinner.color}55`,
            }}
          >
            <p className="text-base md:text-lg font-bold text-muted-foreground uppercase tracking-widest mb-2">
              Winner
            </p>
            <p
              className="font-display font-black text-5xl md:text-7xl"
              style={{
                color: localWinner.color,
                textShadow: `0 0 60px ${localWinner.color}`,
              }}
            >
              {localWinner.label}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
