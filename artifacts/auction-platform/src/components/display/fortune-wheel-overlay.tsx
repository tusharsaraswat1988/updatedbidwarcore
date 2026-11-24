import { memo, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dices, Trophy, Sparkles } from "lucide-react";
import type { WheelItem } from "./types";
import type { LedTeam } from "@/lib/led-view/types";

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === "closed") {
    try {
      sharedAudioCtx = new AudioContextClass();
    } catch {
      return null;
    }
  }
  if (sharedAudioCtx.state === "suspended") {
    void sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playTickSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx || ctx.state !== "running") return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = "triangle";
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.012);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.012);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.014);
  } catch {
    // Audio errors silently ignored (e.g. autoplay policy)
  }
}

function adjustColorBrightness(hex: string, percent: number): string {
  let num = parseInt(hex.replace("#", ""), 16);
  if (isNaN(num)) num = 0x2563eb;
  const r = Math.min(255, Math.max(0, (num >> 16) + Math.round((255 * percent) / 100)));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + Math.round((255 * percent) / 100)));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + Math.round((255 * percent) / 100)));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawCenterGem(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx, cy + r);
  ctx.lineTo(cx - r, cy);
  ctx.closePath();
  ctx.fillStyle = "#eab308";
  ctx.fill();
  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawWheelCanvas(
  canvas: HTMLCanvasElement,
  items: WheelItem[],
  rotation: number,
  pegDeflection: number,
  teams?: LedTeam[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !items.length) return;

  const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
  const displayWidth = canvas.clientWidth || 600;
  const displayHeight = canvas.clientHeight || 600;

  if (canvas.width !== Math.floor(displayWidth * dpr) || canvas.height !== Math.floor(displayHeight * dpr)) {
    canvas.width = Math.floor(displayWidth * dpr);
    canvas.height = Math.floor(displayHeight * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const cx = displayWidth / 2;
  const cy = displayHeight / 2;
  const outerRadius = Math.min(cx, cy) - 24;
  const innerRadius = Math.max(38, Math.min(54, outerRadius * 0.2));
  const n = items.length;
  const arc = (2 * Math.PI) / n;

  // 1. Draw outer gold / metallic bezel rim with drop shadow
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius + 14, 0, 2 * Math.PI);
  ctx.fillStyle = "#1e293b";
  ctx.fill();
  ctx.restore();

  const rimGradient = ctx.createLinearGradient(
    cx - outerRadius,
    cy - outerRadius,
    cx + outerRadius,
    cy + outerRadius,
  );
  rimGradient.addColorStop(0, "#fef08a");
  rimGradient.addColorStop(0.25, "#eab308");
  rimGradient.addColorStop(0.5, "#854d0e");
  rimGradient.addColorStop(0.75, "#facc15");
  rimGradient.addColorStop(1, "#713f12");

  ctx.beginPath();
  ctx.arc(cx, cy, outerRadius + 11, 0, 2 * Math.PI);
  ctx.strokeStyle = rimGradient;
  ctx.lineWidth = 12;
  ctx.stroke();

  // Draw 24 golden perimeter studs / bolts around the bezel
  const boltCount = 24;
  for (let b = 0; b < boltCount; b++) {
    const boltAngle = (b * 2 * Math.PI) / boltCount;
    const bx = cx + (outerRadius + 11) * Math.cos(boltAngle);
    const by = cy + (outerRadius + 11) * Math.sin(boltAngle);

    ctx.beginPath();
    ctx.arc(bx, by, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#fef9c3";
    ctx.fill();
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 2. Draw Wheel Slices
  items.forEach((item, i) => {
    const start = rotation + i * arc;
    const end = start + arc;
    const sliceMid = start + arc / 2;

    // Wedge path
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, outerRadius, start, end);
    ctx.closePath();

    // Wedge radial gradient for broadcast depth
    const baseColor = item.color || "#2563eb";
    const sliceGrad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
    sliceGrad.addColorStop(0, adjustColorBrightness(baseColor, 35));
    sliceGrad.addColorStop(0.65, baseColor);
    sliceGrad.addColorStop(1, adjustColorBrightness(baseColor, -35));

    ctx.fillStyle = sliceGrad;
    ctx.fill();

    // Slice border / separator spoke
    ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Slice Divider Pin at perimeter
    const pinX = cx + (outerRadius - 4) * Math.cos(start);
    const pinY = cy + (outerRadius - 4) * Math.sin(start);
    ctx.beginPath();
    ctx.arc(pinX, pinY, 4.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#fef08a";
    ctx.fill();
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Team label and badge on wedge
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sliceMid);

    // Find team info if available
    const matchedTeam = teams?.find(
      (t) =>
        t.name.toLowerCase() === item.label.toLowerCase() ||
        t.short.toLowerCase() === item.label.toLowerCase(),
    );
    const shortCode = matchedTeam?.short || item.label.slice(0, 3).toUpperCase();
    const displayName = matchedTeam?.name || item.label;

    // Badge circle near outer rim
    const badgeR = outerRadius - 28;
    ctx.beginPath();
    ctx.arc(badgeR, 0, 15, 0, 2 * Math.PI);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(shortCode, badgeR, 0);

    // Text along radial axis
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(0, 0, 0, 0.9)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;

    const fontSize = Math.max(12, Math.min(20, Math.floor(250 / n)));
    ctx.font = `bold ${fontSize}px 'Space Grotesk', system-ui, sans-serif`;

    const maxChars = 14;
    const textLabel = displayName.length > maxChars ? displayName.slice(0, maxChars) + "…" : displayName;
    ctx.fillText(textLabel, outerRadius - 50, 0);

    ctx.restore();
  });

  // 3. Multi-layer Center Hub
  const hubGrad = ctx.createLinearGradient(
    cx - innerRadius,
    cy - innerRadius,
    cx + innerRadius,
    cy + innerRadius,
  );
  hubGrad.addColorStop(0, "#fef08a");
  hubGrad.addColorStop(0.5, "#ca8a04");
  hubGrad.addColorStop(1, "#78350f");

  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius, 0, 2 * Math.PI);
  ctx.fillStyle = "#090d16";
  ctx.fill();
  ctx.strokeStyle = hubGrad;
  ctx.lineWidth = 6;
  ctx.stroke();

  // Inner hub ring
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius - 12, 0, 2 * Math.PI);
  ctx.fillStyle = "#0f172a";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Center star / diamond emblem
  drawCenterGem(ctx, cx, cy, 14);

  // 4. Downward Top Pointer (at 12 o'clock, 3*PI/2) with spring peg deflection
  ctx.save();
  const pointerY = cy - outerRadius - 12;
  ctx.translate(cx, pointerY);
  ctx.rotate(pegDeflection);

  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 4;

  ctx.beginPath();
  ctx.moveTo(0, 32); // Arrowhead pointing DOWN into the wheel
  ctx.lineTo(-14, -8);
  ctx.lineTo(14, -8);
  ctx.closePath();

  const pointerGrad = ctx.createLinearGradient(-14, -8, 14, 32);
  pointerGrad.addColorStop(0, "#ef4444");
  pointerGrad.addColorStop(0.5, "#dc2626");
  pointerGrad.addColorStop(1, "#b91c1c");

  ctx.fillStyle = pointerGrad;
  ctx.fill();
  ctx.strokeStyle = "#fef08a";
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Pointer mount circle
  ctx.beginPath();
  ctx.arc(0, -8, 7, 0, 2 * Math.PI);
  ctx.fillStyle = "#eab308";
  ctx.fill();
  ctx.strokeStyle = "#78350f";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
  ctx.restore();
}

/**
 * Broadcast Fortune Wheel Engine:
 * - High-DPI 2D HTML5 Canvas rendering team wedges, logos/badges, divider pins, and 3D metallic hub.
 * - Dynamic deceleration physics landing accurately on the winning wedge (no hardcoded 0deg settle).
 * - Peg deflection animation & Web Audio tick sound.
 * - Stage-safe layout (cqw/cqh) and winner celebration card.
 */
export const FortuneWheelOverlay = memo(function FortuneWheelOverlay({
  items,
  winner,
  wheelSpinning,
  teams,
}: {
  items: WheelItem[];
  winner: string | null | undefined;
  wheelSpinning?: boolean;
  teams?: LedTeam[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const speedRef = useRef(0.005);
  const pegDeflectionRef = useRef(0);
  const lastPinIndexRef = useRef<number | null>(null);

  type AnimState =
    | { mode: "idle" }
    | { mode: "spin" }
    | {
        mode: "land";
        startRot: number;
        targetRot: number;
        startTime: number;
        duration: number;
        winnerLabel?: string;
      };

  const stateRef = useRef<AnimState>({ mode: "idle" });
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const teamsRef = useRef(teams);
  teamsRef.current = teams;

  const [localWinner, setLocalWinner] = useState<{
    label: string;
    color: string;
  } | null>(null);
  const [showSpinning, setShowSpinning] = useState(false);

  const landedForRef = useRef<{
    winner: string | null | undefined;
    itemsLen: number;
  }>({ winner: undefined, itemsLen: 0 });

  const hydratedRef = useRef(false);
  const prevSpinningRef = useRef(false);

  // Persistent RAF animation loop
  useEffect(() => {
    let alive = true;
    let raf = 0;

    function tick(now: number) {
      if (!alive) return;
      const s = stateRef.current;
      const nItems = Math.max(itemsRef.current.length, 1);
      const arc = (2 * Math.PI) / nItems;
      const pointerAngle = 1.5 * Math.PI; // 12 o'clock (270 degrees)

      if (s.mode === "idle") {
        speedRef.current += (0.003 - speedRef.current) * 0.04;
        rotRef.current += speedRef.current;
      } else if (s.mode === "spin") {
        // Broadcast spin speed
        speedRef.current += (0.16 - speedRef.current) * 0.08;
        rotRef.current += speedRef.current;
      } else if (s.mode === "land") {
        const progress = Math.min((now - s.startTime) / s.duration, 1);
        // Quartic deceleration curve
        const ease = 1 - Math.pow(1 - progress, 4);
        rotRef.current = s.startRot + (s.targetRot - s.startRot) * ease;

        if (progress >= 1) {
          stateRef.current = { mode: "idle" };
          speedRef.current = 0;
          setShowSpinning(false);
          const winLabel = s.winnerLabel;
          if (winLabel) {
            const w = itemsRef.current.find((i) => i.label === winLabel);
            setLocalWinner(
              w ? { label: w.label, color: w.color } : { label: winLabel, color: "#EAB308" },
            );
          }
        }
      }

      // Check peg crossing for pointer deflection & tick sound
      const pinProgress = (rotRef.current - pointerAngle) / arc;
      const currentPinIndex = Math.floor(pinProgress);
      if (lastPinIndexRef.current !== null && currentPinIndex !== lastPinIndexRef.current) {
        pegDeflectionRef.current = -0.32;
        playTickSound();
      }
      lastPinIndexRef.current = currentPinIndex;

      // Damped spring return for pointer peg
      pegDeflectionRef.current += (0 - pegDeflectionRef.current) * 0.22;

      if (canvasRef.current && itemsRef.current.length) {
        drawWheelCanvas(
          canvasRef.current,
          itemsRef.current,
          rotRef.current,
          pegDeflectionRef.current,
          teamsRef.current,
        );
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, []);

  // React to live spin/land transitions
  useEffect(() => {
    const spinning = !!wheelSpinning;

    function showStaticWinner(label: string) {
      if (items.length) {
        const w = items.find((i) => i.label === label);
        setLocalWinner(w ? { label: w.label, color: w.color } : { label, color: "#EAB308" });
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

    // Mathematical angle calculation for top pointer landing:
    // Pointer is at 12 o'clock (3*PI/2)
    const arc = (2 * Math.PI) / items.length;
    const winnerCenter = winnerIdx * arc + arc / 2;
    const pointerAngle = 1.5 * Math.PI;

    const targetAngleNorm =
      (((pointerAngle - winnerCenter) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const currentAngleNorm = ((rotRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const forwardDelta = (targetAngleNorm - currentAngleNorm + 2 * Math.PI) % (2 * Math.PI);

    // 5 full dramatic rotations + forward delta to exact winner center
    const target = rotRef.current + 5 * 2 * Math.PI + forwardDelta;

    stateRef.current = {
      mode: "land",
      startRot: rotRef.current,
      targetRot: target,
      startTime: performance.now(),
      duration: 4200,
      winnerLabel: winner,
    };
    setLocalWinner(null);
    setShowSpinning(true);
  }, [wheelSpinning, winner, items]);

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden bg-black/85 backdrop-blur-md">
      {/* Broadcast Header */}
      <motion.div
        initial={{ y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center gap-3 mb-[1.5cqh] flex-shrink-0"
      >
        <Dices className="w-[2.2cqw] h-[2.2cqw] text-amber-400 animate-pulse" />
        <h1
          className="font-['Bebas_Neue'] font-black text-[clamp(1.8rem,3.2cqw,3.6rem)] tracking-[0.1em] text-white"
          style={{ textShadow: "0 0 35px rgba(250,204,21,0.5)" }}
        >
          FORTUNE WHEEL
        </h1>
        <Dices className="w-[2.2cqw] h-[2.2cqw] text-amber-400 animate-pulse" />
      </motion.div>

      {/* Spinning indicator */}
      <div className="h-[2.5cqh] flex items-center justify-center mb-[1cqh]">
        <AnimatePresence>
          {showSpinning && !localWinner && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: [0.6, 1, 0.6], y: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.8, repeat: Infinity },
                y: { duration: 0.25 },
              }}
              className="text-amber-300 font-mono font-bold uppercase tracking-[0.35em] text-[clamp(0.65rem,0.9cqw,0.9rem)]"
            >
              SPINNING THE DRAW…
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Wheel Canvas Container */}
      <div className="relative flex items-center justify-center flex-shrink-0 h-[58cqh] w-[58cqh] max-h-[560px] max-w-[560px]">
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-full"
          style={{ filter: "drop-shadow(0 0 45px rgba(234,179,8,0.35))" }}
        />
      </div>

      {/* Winner Celebration Card */}
      <div className="h-[12cqh] flex items-center justify-center mt-[1.5cqh]">
        <AnimatePresence>
          {localWinner && (
            <motion.div
              initial={{ scale: 0.7, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="flex items-center gap-4 px-[2cqw] py-[1cqh] rounded-2xl border-2"
              style={{
                borderColor: localWinner.color,
                background: "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(7,11,22,0.98))",
                boxShadow: `0 0 50px ${localWinner.color}66, inset 0 0 20px ${localWinner.color}33`,
              }}
            >
              <div
                className="size-[clamp(2.5rem,3.8cqw,4rem)] rounded-xl flex items-center justify-center"
                style={{ backgroundColor: `${localWinner.color}25` }}
              >
                <Trophy className="size-[clamp(1.5rem,2.2cqw,2.4rem)] text-amber-300 animate-bounce" />
              </div>
              <div>
                <p className="text-[clamp(0.55rem,0.75cqw,0.75rem)] font-mono font-bold uppercase tracking-[0.3em] text-white/60">
                  Winner of the Draw
                </p>
                <p
                  className="font-['Bebas_Neue'] font-black text-[clamp(1.8rem,3.2cqw,3.6rem)] leading-none tracking-wider mt-0.5"
                  style={{
                    color: localWinner.color || "#ffffff",
                    textShadow: `0 0 25px ${localWinner.color}88`,
                  }}
                >
                  {localWinner.label}
                </p>
              </div>
              <Sparkles className="size-[clamp(1.2rem,1.8cqw,2rem)] text-amber-300 animate-spin" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
