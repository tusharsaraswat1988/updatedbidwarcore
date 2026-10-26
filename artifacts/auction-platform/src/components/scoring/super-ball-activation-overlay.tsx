import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Zap, Sparkles } from "lucide-react";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  useSuperBallActivation,
  type SuperBallActivationEvent,
} from "@/hooks/use-super-ball-activation";

interface SuperBallActivationOverlayProps {
  tournamentId: number;
  /** Optional manual trigger event for testing or direct parent control */
  event?: SuperBallActivationEvent | null;
  /** Optional dismiss callback */
  onDismiss?: () => void;
  /** Custom auto-dismiss duration in ms (default 3200ms) */
  durationMs?: number;
}

/**
 * 60fps Canvas Particle, Shockwave & Electric Arc Engine.
 * Renders electric blue and gold radiant energy bursts and lightning arcs.
 */
function SuperBallParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", onResize);

    const cx = width / 2;
    const cy = height / 2;

    // Palette: Electric Cyan/Blue & Rich Gold/Amber
    const palette = [
      "#00e5ff",
      "#38bdf8",
      "#2563eb",
      "#ffd700",
      "#f59e0b",
      "#ffffff",
      "#fef08a",
    ];

    // High velocity sparks
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
    };

    const particles: Particle[] = [];
    const count = 120;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 14 + 4;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 1.5,
        color: palette[Math.floor(Math.random() * palette.length)] ?? "#ffd700",
        alpha: 1,
        decay: Math.random() * 0.02 + 0.012,
      });
    }

    // Shockwave expansion rings
    type Shockwave = { r: number; maxR: number; alpha: number; color: string; width: number };
    const shockwaves: Shockwave[] = [
      { r: 20, maxR: Math.max(width, height) * 0.75, alpha: 0.9, color: "#00e5ff", width: 4 },
      { r: 10, maxR: Math.max(width, height) * 0.55, alpha: 0.8, color: "#ffd700", width: 5 },
      { r: 5, maxR: Math.max(width, height) * 0.35, alpha: 0.7, color: "#ffffff", width: 2 },
    ];

    // Electric lightning discharge arcs
    function drawElectricArc(
      startX: number,
      startY: number,
      endX: number,
      endY: number,
      segments: number,
      offset: number,
      color: string,
      alpha: number,
    ) {
      if (!ctx) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(startX, startY);

      let currentX = startX;
      let currentY = startY;
      const dx = (endX - startX) / segments;
      const dy = (endY - startY) / segments;

      for (let s = 1; s < segments; s++) {
        const jitter = (Math.random() - 0.5) * offset;
        currentX = startX + dx * s + jitter;
        currentY = startY + dy * s + jitter;
        ctx.lineTo(currentX, currentY);
      }
      ctx.lineTo(endX, endY);

      ctx.strokeStyle = color;
      ctx.lineWidth = Math.random() * 2 + 1.5;
      ctx.globalAlpha = alpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.restore();
    }

    let frameCount = 0;

    function render() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      frameCount++;

      // 1. Draw Shockwaves
      shockwaves.forEach((sw) => {
        if (sw.alpha <= 0) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, sw.r, 0, Math.PI * 2);
        ctx.strokeStyle = sw.color;
        ctx.globalAlpha = sw.alpha;
        ctx.lineWidth = sw.width;
        ctx.shadowColor = sw.color;
        ctx.shadowBlur = 24;
        ctx.stroke();
        ctx.restore();

        sw.r += 16;
        sw.alpha -= 0.024;
      });

      // 2. Draw Electric Arcs around center (living lightning discharge)
      if (frameCount % 2 === 0) {
        const arcCount = 4;
        for (let a = 0; a < arcCount; a++) {
          const angle = Math.random() * Math.PI * 2;
          const distInner = Math.random() * 60 + 80;
          const distOuter = Math.random() * 120 + 200;
          const startX = cx + Math.cos(angle) * distInner;
          const startY = cy + Math.sin(angle) * distInner;
          const endX = cx + Math.cos(angle + (Math.random() - 0.5) * 0.8) * distOuter;
          const endY = cy + Math.sin(angle + (Math.random() - 0.5) * 0.8) * distOuter;
          const arcColor = Math.random() > 0.4 ? "#00e5ff" : "#ffd700";
          drawElectricArc(startX, startY, endX, endY, 6, 25, arcColor, Math.random() * 0.7 + 0.3);
        }
      }

      // 3. Draw & Update Sparks
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
      }

      if (particles.length > 0 || shockwaves.some((s) => s.alpha > 0)) {
        animId = requestAnimationFrame(render);
      }
    }

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-10 w-full h-full"
    />
  );
}

/**
 * 3D Metallic White Cricket Ball with Gold Stitching & Electric Rim Lighting.
 * Pure vector SVG rendering for pixel-perfect clarity at any resolution.
 */
function MetallicCricketBall({ size = 260 }: { size?: number }) {
  return (
    <div
      className="relative flex items-center justify-center pointer-events-none"
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full filter drop-shadow-[0_15px_45px_rgba(0,0,0,0.9)]"
      >
        <defs>
          {/* Sphere 3D Metallic Gradient */}
          <radialGradient
            id="cricketBallMetal"
            cx="32%"
            cy="28%"
            r="68%"
            fx="30%"
            fy="25%"
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="25%" stopColor="#f1f5f9" stopOpacity="1" />
            <stop offset="55%" stopColor="#cbd5e1" stopOpacity="1" />
            <stop offset="85%" stopColor="#64748b" stopOpacity="1" />
            <stop offset="100%" stopColor="#1e293b" stopOpacity="1" />
          </radialGradient>

          {/* Electric Blue Rim Light */}
          <linearGradient id="electricBlueRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f0ff" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>

          {/* Gold Rim Light */}
          <linearGradient id="goldRim" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#ffd700" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>

          {/* Gold Stitching Glow */}
          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Base Sphere */}
        <circle cx="100" cy="100" r="92" fill="url(#cricketBallMetal)" />

        {/* 2. Electric Rim Shadows */}
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="url(#electricBlueRim)"
          style={{ mixBlendMode: "color-dodge" }}
        />
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="url(#goldRim)"
          style={{ mixBlendMode: "screen" }}
        />

        {/* 3. Outer Sphere Border */}
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1.5"
          opacity="0.8"
        />

        {/* 4. Cricket Ball Curved Primary Seam (Gold Metallic Ridge) */}
        <path
          d="M 28,155 C 65,130 135,70 172,45"
          fill="none"
          stroke="#b45309"
          strokeWidth="6"
          opacity="0.6"
        />
        <path
          d="M 28,155 C 65,130 135,70 172,45"
          fill="none"
          stroke="#ffd700"
          strokeWidth="3.5"
          filter="url(#goldGlow)"
        />

        {/* 5. Gold Cricket-Ball Cross Stitching Ticks */}
        {[
          { x: 38, y: 147, rot: -45 },
          { x: 50, y: 138, rot: -42 },
          { x: 63, y: 128, rot: -40 },
          { x: 77, y: 117, rot: -38 },
          { x: 91, y: 106, rot: -36 },
          { x: 105, y: 95, rot: -34 },
          { x: 119, y: 84, rot: -32 },
          { x: 133, y: 73, rot: -30 },
          { x: 147, y: 62, rot: -28 },
          { x: 161, y: 52, rot: -26 },
        ].map((stitch, idx) => (
          <g
            key={idx}
            transform={`translate(${stitch.x}, ${stitch.y}) rotate(${stitch.rot})`}
          >
            {/* Left Cross-Stitch */}
            <line
              x1="-5"
              y1="-4"
              x2="5"
              y2="4"
              stroke="#ffffff"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            {/* Right Cross-Stitch */}
            <line
              x1="-5"
              y1="4"
              x2="5"
              y2="-4"
              stroke="#ffd700"
              strokeWidth="2"
              strokeLinecap="round"
              filter="url(#goldGlow)"
            />
          </g>
        ))}

        {/* 6. Specular Glint Highlight */}
        <ellipse
          cx="60"
          cy="55"
          rx="22"
          ry="14"
          transform="rotate(-30 60 55)"
          fill="#ffffff"
          opacity="0.75"
        />
      </svg>
    </div>
  );
}

/**
 * Premium Full-Screen SUPER BALL Activation Broadcast Overlay.
 *
 * Timeline (3.0s total):
 * 0.00 - 0.25s: Phase 1 Impact (Darken, vignette, energy flash)
 * 0.20 - 0.80s: Phase 2 Ball Entry (Metallic ball spins into position, energy rings ignite)
 * 0.60 - 1.40s: Phase 3 Reveal (SUPER BALL text locks in with shockwave & lens flare)
 * 1.40 - 2.20s: Phase 4 Hero Hold (Living arcs, pulsing energy rings, subtle ball hover)
 * 2.20 - 3.10s: Phase 5 Exit (Energy expands, light collapses, returns cleanly to live screen)
 */
export function SuperBallActivationOverlay({
  tournamentId,
  event: externalEvent,
  onDismiss,
  durationMs = 3200,
}: SuperBallActivationOverlayProps) {
  const { activeActivation, dismissActivation } = useSuperBallActivation(tournamentId);

  // Use either the internal hook activation or an explicitly passed test event
  const currentEvent = externalEvent ?? activeActivation;

  useEffect(() => {
    if (!currentEvent) return;

    const timer = setTimeout(() => {
      dismissActivation();
      onDismiss?.();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [currentEvent, dismissActivation, onDismiss, durationMs]);

  if (!currentEvent) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`super-ball-overlay-${currentEvent.id}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="fixed inset-0 z-[99999] pointer-events-none flex items-center justify-center overflow-hidden select-none"
        style={{
          width: "100vw",
          height: "100vh",
          background:
            "radial-gradient(circle at center, rgba(8,16,36,0.92) 0%, rgba(3,5,10,0.97) 60%, rgba(1,2,4,0.99) 100%)",
        }}
      >
        {/* Phase 1 & 2: 60fps Electric Particle & Shockwave Canvas */}
        <SuperBallParticleCanvas />

        {/* Ambient Stadium Energy Aura */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/20 via-blue-950/20 to-transparent pointer-events-none blur-3xl animate-pulse" />

        {/* Anamorphic Lens Flare Horizontal Beam */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1.8, 1], opacity: [0, 1, 0.4] }}
          exit={{ scaleX: 2.5, opacity: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.4 }}
          className="absolute h-[3px] w-full bg-gradient-to-r from-transparent via-[#00e5ff] to-transparent pointer-events-none z-20 blur-[1px]"
        />

        {/* Secondary Gold Lens Flare Beam */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 1.5, 0.8], opacity: [0, 0.9, 0.3] }}
          exit={{ scaleX: 2.2, opacity: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.55 }}
          className="absolute h-[2px] w-3/4 bg-gradient-to-r from-transparent via-[#ffd700] to-transparent pointer-events-none z-20 blur-[1px]"
        />

        {/* Main Central Stage Composition */}
        <div className="relative z-30 flex flex-col items-center justify-center text-center px-4 w-full max-w-5xl">
          {/* Ball & Energy Rings Hero Container */}
          <div className="relative flex items-center justify-center mb-4 sm:mb-6">
            {/* Outer Counter-Rotating Cyan Energy Ring */}
            <motion.div
              initial={{ scale: 0, rotate: 0, opacity: 0 }}
              animate={{
                scale: 1,
                rotate: 360,
                opacity: [0, 0.9, 0.75],
              }}
              exit={{ scale: 1.6, opacity: 0 }}
              transition={{
                scale: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
                rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                opacity: { duration: 0.4 },
              }}
              className="absolute w-[340px] h-[340px] sm:w-[420px] sm:h-[420px] rounded-full border-2 border-dashed border-cyan-400/60 shadow-[0_0_60px_rgba(0,229,255,0.4)] pointer-events-none"
            />

            {/* Inner Rotating Gold Energy Ring */}
            <motion.div
              initial={{ scale: 0, rotate: 0, opacity: 0 }}
              animate={{
                scale: 1,
                rotate: -360,
                opacity: [0, 1, 0.85],
              }}
              exit={{ scale: 1.4, opacity: 0 }}
              transition={{
                scale: { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 },
                rotate: { duration: 6, repeat: Infinity, ease: "linear" },
                opacity: { duration: 0.4, delay: 0.1 },
              }}
              className="absolute w-[290px] h-[290px] sm:w-[350px] sm:h-[350px] rounded-full border-[3px] border-[#ffd700]/70 shadow-[0_0_70px_rgba(255,215,0,0.5)] pointer-events-none"
            />

            {/* Glowing Golden Core Shockwave Aura */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{
                scale: [0.8, 1.1, 0.95],
                opacity: [0.3, 0.8, 0.5],
              }}
              transition={{
                duration: 2.2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
              className="absolute w-[260px] h-[260px] sm:w-[320px] sm:h-[320px] rounded-full bg-gradient-to-tr from-cyan-500/25 via-amber-500/30 to-yellow-400/20 blur-2xl pointer-events-none"
            />

            {/* Phase 2: Metallic White Cricket Ball Rapid Entry & Spin */}
            <motion.div
              initial={{ scale: 0.05, rotate: -240, y: -40, opacity: 0 }}
              animate={{
                scale: [0.05, 1.12, 1],
                rotate: [-240, 25, 0],
                y: [-40, 0, 0],
                opacity: 1,
              }}
              exit={{ scale: 0.4, opacity: 0, transition: { duration: 0.3 } }}
              transition={{
                duration: 0.65,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.15,
              }}
              className="relative z-30 transform-gpu"
            >
              <MetallicCricketBall size={220} />
            </motion.div>
          </div>

          {/* Phase 3 & 4: "SUPER BALL" Typography Reveal */}
          <div className="relative z-40 flex flex-col items-center">
            {/* Top Kinetic Category Badge */}
            <motion.div
              initial={{ y: -30, opacity: 0, scale: 0.85 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.45 }}
              className="flex items-center gap-2 px-6 py-1.5 -skew-x-12 bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-700 border-2 border-cyan-300 shadow-[0_0_35px_rgba(6,182,212,0.8)] mb-3"
            >
              <Zap className="skew-x-12 w-4 h-4 text-yellow-300 fill-yellow-300 animate-bounce" />
              <span className="skew-x-12 text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-white">
                BIDWAR SPECIAL BROADCAST EVENT
              </span>
              <Zap className="skew-x-12 w-4 h-4 text-yellow-300 fill-yellow-300 animate-bounce" />
            </motion.div>

            {/* Giant Chiseled 3D Metallic "SUPER BALL" Title */}
            <motion.div
              initial={{ scale: 2.2, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 1.15, opacity: 0, transition: { duration: 0.3 } }}
              transition={{
                duration: 0.55,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.5,
              }}
              className="relative flex items-center justify-center flex-wrap gap-3 sm:gap-6"
            >
              {/* "SUPER" - Electric Cyan / Ice Chrome */}
              <h1
                className="text-6xl sm:text-8xl md:text-9xl font-black uppercase tracking-[0.08em] leading-none text-transparent bg-clip-text bg-gradient-to-b from-white via-cyan-100 to-cyan-400 drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]"
                style={{
                  fontFamily: BROADCAST_FONTS.display,
                  filter: "drop-shadow(0 0 40px rgba(6,182,212,0.85))",
                }}
              >
                SUPER
              </h1>

              {/* "BALL" - 24K Liquid Gold Metallic Chrome */}
              <h1
                className="text-6xl sm:text-8xl md:text-9xl font-black uppercase tracking-[0.08em] leading-none text-transparent bg-clip-text bg-gradient-to-b from-[#fffbeb] via-[#fde047] to-[#d97706] drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]"
                style={{
                  fontFamily: BROADCAST_FONTS.display,
                  filter: "drop-shadow(0 0 50px rgba(251,191,36,0.95))",
                }}
              >
                BALL
              </h1>
            </motion.div>

            {/* Phase 4: Subtitle & Multiplier Badge */}
            <motion.div
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 15, opacity: 0 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.7 }}
              className="mt-3 sm:mt-4 flex items-center gap-3 px-8 py-2 -skew-x-12 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 border-2 border-amber-400/80 shadow-[0_0_40px_rgba(245,158,11,0.6)] backdrop-blur-md"
            >
              <Sparkles className="skew-x-12 w-4 h-4 text-amber-300" />
              <span className="skew-x-12 text-base sm:text-2xl font-black uppercase tracking-[0.25em] text-amber-200">
                ⚡ 2X RUNS MULTIPLIER ACTIVATED ⚡
              </span>
              <Sparkles className="skew-x-12 w-4 h-4 text-amber-300" />
            </motion.div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
