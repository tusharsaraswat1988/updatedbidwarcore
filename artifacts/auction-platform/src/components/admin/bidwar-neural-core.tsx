import { useEffect, useRef } from "react";

export type BidWarNeuralCoreProps = {
  size?: number;
  charged?: boolean;
  active?: boolean;
  className?: string;
};

type Node3D = {
  x: number;
  y: number;
  z: number;
  colorType: "pearl" | "radiantGold" | "champagne";
  isRadiantStar: boolean;
};

/**
 * BidWar AI Neural Core Canvas Component — Champagne Gold & Pearl Reference Edition
 *
 * Faithfully matches the reference image:
 * - Central sphere: Sculpted warm pearl-beige metallic surface with soft ivory highlights
 * - Outer halo: Pure warm champagne glow and pearl-beige atmospheric lighting (Zero blue/cyan)
 * - Neural nodes: Porcelain pearl spheres, polished champagne metallic nodes, and radiant warm amber-gold starburst emitters
 * - Neural connections: Delicate warm golden-beige filaments
 * - Ground plane: Warm bronze-taupe shadow with faint champagne concentric ripples
 */
export function BidWarNeuralCore({
  size = 320,
  charged = false,
  active = false,
  className = "",
}: BidWarNeuralCoreProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const chargedRef = useRef(charged);
  const activeRef = useRef(active);

  const stateRef = useRef({
    rotX: 0,
    rotY: 0,
    targetRotX: 0,
    targetRotY: 0,
    energy: 0.28,
    targetEnergy: 0.28,
    pulse: 0,
    hover: 0,
    paused: false,
  });

  chargedRef.current = charged;
  activeRef.current = active;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High DPI scaling (capped at 2 for performance)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    // Central core radius matching reference proportions
    const radius = size * 0.35;

    // Check for reduced motion preference
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Generate 96 Fibonacci sphere nodes matching reference material taxonomy
    const N = 96;
    const nodes: Node3D[] = [];
    const goldenRatioAngle = Math.PI * (3 - Math.sqrt(5));

    for (let i = 0; i < N; i += 1) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenRatioAngle * i;

      // Color taxonomy matching reference:
      // - 45% Polished pearl porcelain
      // - 40% Metallic champagne gold
      // - 15% Radiant amber-gold glowing miniature suns
      let colorType: "pearl" | "radiantGold" | "champagne" = "pearl";
      let isRadiantStar = false;

      if (i % 7 === 0) {
        colorType = "radiantGold";
        isRadiantStar = true;
      } else if (i % 2 === 0) {
        colorType = "champagne";
      }

      nodes.push({
        x: Math.cos(theta) * r,
        y,
        z: Math.sin(theta) * r,
        colorType,
        isRadiantStar,
      });
    }

    // Connect node pairs within Euclidean geodesic threshold
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < N; i += 1) {
      for (let j = i + 1; j < N; j += 1) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 0.46) {
          pairs.push([i, j]);
        }
      }
    }

    // Pointer movement handler
    const handleMove = (clientX: number, clientY: number) => {
      if (prefersReducedMotion) return;
      const rect = canvas.getBoundingClientRect();
      const mx = clientX - (rect.left + rect.width / 2);
      const my = clientY - (rect.top + rect.height / 2);
      const dist = Math.hypot(mx, my);
      const influence = Math.max(0, 1 - dist / 500);

      const s = stateRef.current;
      s.targetRotY = (mx / 240) * 0.95;
      s.targetRotX = (-my / 240) * 0.95;
      s.targetEnergy = 0.3 + influence * 0.7;
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches && e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleLeave = () => {
      const s = stateRef.current;
      s.targetRotX = 0;
      s.targetRotY = 0;
      s.targetEnergy = 0.28;
    };

    // Pause canvas loop when tab is hidden to conserve battery & GPU
    const handleVisibilityChange = () => {
      stateRef.current.paused = document.hidden;
      if (!document.hidden) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(render);
      }
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("mouseout", handleLeave, { passive: true });
    window.addEventListener("touchend", handleLeave, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);

    let autoSpin = 0;

    const render = () => {
      if (stateRef.current.paused) return;

      const s = stateRef.current;
      const damping = prefersReducedMotion ? 0.02 : 0.06;
      s.rotX += (s.targetRotX - s.rotX) * damping;
      s.rotY += (s.targetRotY - s.rotY) * damping;

      s.hover += ((activeRef.current ? 1 : 0) - s.hover) * 0.1;
      const baseE = chargedRef.current ? 1.9 : s.targetEnergy;
      const targetE = baseE + s.hover * 0.65;
      s.energy += (targetE - s.energy) * 0.08;

      const spinStep = prefersReducedMotion ? 0.0006 : 0.0016 + s.hover * 0.0014;
      autoSpin += spinStep;
      s.pulse += 0.042 + s.hover * 0.02;

      ctx.clearRect(0, 0, size, size);

      const ry = s.rotY + autoSpin;
      const rx = s.rotX;
      const cosY = Math.cos(ry);
      const sinY = Math.sin(ry);
      const cosX = Math.cos(rx);
      const sinX = Math.sin(rx);

      // 3D coordinate projection with perspective
      const proj = nodes.map((n) => {
        const x = n.x * cosY - n.z * sinY;
        const z = n.x * sinY + n.z * cosY;
        const y = n.y;
        const y2 = y * cosX - z * sinX;
        const z2 = y * sinX + z * cosX;
        const persp = 1 / (1.65 - z2 * 0.5);

        return {
          sx: cx + x * radius * persp,
          sy: cy + y2 * radius * persp,
          depth: (z2 + 1) / 2, // 0 (far) to 1 (near)
          rawZ: z2,
          colorType: n.colorType,
          isRadiantStar: n.isRadiantStar,
        };
      });

      // =========================================================================
      // 1. FLOOR SHADOW & CONCENTRIC CHAMPAGNE RIPPLES (Matching Reference Image)
      // =========================================================================
      ctx.save();
      const shadowY = cy + radius * 1.09;

      // Concentric champagne ripple rings on floor plane
      ctx.strokeStyle = "rgba(215, 190, 145, 0.14)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, shadowY + 2, radius * 1.15, radius * 0.28, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(215, 190, 145, 0.08)";
      ctx.beginPath();
      ctx.ellipse(cx, shadowY + 4, radius * 1.35, radius * 0.32, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Diffused warm bronze penumbra
      const penumbraGrad = ctx.createRadialGradient(
        cx, shadowY, 0,
        cx, shadowY, radius * 0.95
      );
      penumbraGrad.addColorStop(0, "rgba(110, 92, 70, 0.15)");
      penumbraGrad.addColorStop(0.5, "rgba(140, 120, 95, 0.05)");
      penumbraGrad.addColorStop(1, "rgba(248, 247, 242, 0)");

      ctx.beginPath();
      ctx.ellipse(cx, shadowY, radius * 0.95, radius * 0.24, 0, 0, Math.PI * 2);
      ctx.fillStyle = penumbraGrad;
      ctx.fill();

      // Dense contact umbra under central sphere
      const umbraGrad = ctx.createRadialGradient(
        cx, shadowY - 4, 0,
        cx, shadowY - 4, radius * 0.48
      );
      umbraGrad.addColorStop(0, "rgba(100, 80, 58, 0.24)");
      umbraGrad.addColorStop(0.65, "rgba(125, 105, 80, 0.08)");
      umbraGrad.addColorStop(1, "rgba(248, 247, 242, 0)");

      ctx.beginPath();
      ctx.ellipse(cx, shadowY - 4, radius * 0.48, radius * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = umbraGrad;
      ctx.fill();
      ctx.restore();

      // =========================================================================
      // 2. WARM CHAMPAGNE AMBIENT HALO (Seamless blending, ZERO Blue)
      // =========================================================================
      ctx.save();
      const haloR = radius * (1.2 + Math.sin(s.pulse) * 0.02);
      const ambientHalo = ctx.createRadialGradient(
        cx, cy, radius * 0.88,
        cx, cy, haloR
      );
      ambientHalo.addColorStop(0, `rgba(255, 225, 145, ${0.16 + s.hover * 0.1})`);
      ambientHalo.addColorStop(0.45, `rgba(240, 210, 150, ${0.08 + s.hover * 0.06})`);
      ambientHalo.addColorStop(1, "rgba(248, 247, 242, 0)");

      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fillStyle = ambientHalo;
      ctx.fill();
      ctx.restore();

      // =========================================================================
      // 3. CENTRAL SPHERE: SCULPTED PEARL-BEIGE CHAMPAGNE SURFACE
      // =========================================================================
      const lightX = cx - radius * 0.32;
      const lightY = cy - radius * 0.36;
      const sphereGrad = ctx.createRadialGradient(
        lightX, lightY, radius * 0.04,
        cx, cy, radius * 0.98
      );
      // Soft ivory specular highlight apex
      sphereGrad.addColorStop(0, "rgba(255, 254, 250, 1)");
      // Warm pearl ivory highlight zone
      sphereGrad.addColorStop(0.24, "rgba(247, 242, 233, 1)");
      // Champagne metallic body tone
      sphereGrad.addColorStop(0.58, "rgba(226, 214, 194, 1)");
      // Subtle golden bronze depth shading
      sphereGrad.addColorStop(0.88, "rgba(182, 165, 142, 1)");
      // Warm ground reflection rim
      sphereGrad.addColorStop(1, "rgba(215, 200, 178, 1)");

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.96, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.restore();

      // =========================================================================
      // 4. SURFACE CRATER DOCKING PORTS & INTERNAL GOLDEN GLOW PORTS
      // =========================================================================
      // Subtle sculpted ports on the sphere where filaments attach
      proj.forEach((p) => {
        if (p.depth > 0.45) {
          const portR = 2.2 * (0.8 + p.depth * 0.5);
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, portR, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(210, 195, 172, 0.45)";
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.sx, p.sy, portR * 0.6, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 218, 130, 0.85)";
          ctx.fill();
        }
      });

      // Internal warm golden core luminescence through center
      const corePulse = 0.25 + s.energy * 0.3 + Math.sin(s.pulse) * 0.05;
      const innerCoreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius * 0.72);
      innerCoreGrad.addColorStop(0, `rgba(255, 248, 220, ${Math.min(0.85, corePulse * 0.9)})`);
      innerCoreGrad.addColorStop(0.35, `rgba(255, 215, 125, ${Math.min(0.65, corePulse * 0.7)})`);
      innerCoreGrad.addColorStop(0.7, `rgba(235, 195, 120, ${Math.min(0.25, corePulse * 0.3)})`);
      innerCoreGrad.addColorStop(1, "rgba(226, 214, 194, 0)");

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.72, 0, Math.PI * 2);
      ctx.fillStyle = innerCoreGrad;
      ctx.fill();
      ctx.restore();

      // =========================================================================
      // 5. CHAMPAGNE SPECULAR GLOSS CURVATURE SHEEN
      // =========================================================================
      ctx.save();
      ctx.beginPath();
      const glossGrad = ctx.createRadialGradient(
        cx - radius * 0.32, cy - radius * 0.36, 0,
        cx - radius * 0.32, cy - radius * 0.36, radius * 0.48
      );
      glossGrad.addColorStop(0, "rgba(255, 255, 255, 0.65)");
      glossGrad.addColorStop(0.35, "rgba(255, 240, 200, 0.28)");
      glossGrad.addColorStop(1, "rgba(247, 242, 233, 0)");
      ctx.fillStyle = glossGrad;
      ctx.arc(cx, cy, radius * 0.95, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // =========================================================================
      // 6. DELICATE WARM GOLDEN-BEIGE NEURAL FILAMENTS (Zero Blue)
      // =========================================================================
      for (let k = 0; k < pairs.length; k += 1) {
        const [i, j] = pairs[k];
        const a = proj[i];
        const b = proj[j];
        const depth = (a.depth + b.depth) / 2;
        const isForeground = a.rawZ > -0.28 || b.rawZ > -0.28;

        const baseAlpha = (0.08 + depth * 0.32) * (0.8 + s.energy * 0.7);

        if (isForeground) {
          // Sharp, warm champagne golden filament
          ctx.strokeStyle = `rgba(228, 202, 155, ${Math.min(0.92, baseAlpha * 1.3)})`;
          ctx.lineWidth = 0.65 + depth * 0.95;
        } else {
          // Soft rear filament in muted pearl beige
          ctx.strokeStyle = `rgba(195, 178, 150, ${Math.min(0.32, baseAlpha * 0.45)})`;
          ctx.lineWidth = 0.5;
        }

        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
        ctx.stroke();
      }

      // =========================================================================
      // 7. NEURAL NODES: PEARL SPHERES & RADIANT GOLDEN SUNS
      // =========================================================================
      const sortedIndices = proj
        .map((p, idx) => ({ idx, depth: p.depth }))
        .sort((a, b) => a.depth - b.depth);

      for (let sIdx = 0; sIdx < sortedIndices.length; sIdx += 1) {
        const idx = sortedIndices[sIdx].idx;
        const p = proj[idx];
        const twinkle = 0.5 + 0.5 * Math.sin(s.pulse * 1.8 + idx * 0.8);
        const r = (1.2 + p.depth * 2.8) * (1 + s.energy * 0.16);
        const alpha = (0.35 + p.depth * 0.65) * (0.85 + twinkle * 0.15);

        // A. RADIANT GOLDEN MINIATURE SUNS (Filament light bulbs with starburst flares)
        if (p.isRadiantStar) {
          const starGlowR = r * (2.8 + twinkle * 0.8);
          const starGrad = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, starGlowR);
          starGrad.addColorStop(0, `rgba(255, 252, 235, ${Math.min(1, alpha * 1.4)})`);
          starGrad.addColorStop(0.3, `rgba(255, 205, 95, ${Math.min(0.85, alpha * 1.1)})`);
          starGrad.addColorStop(0.7, `rgba(240, 170, 55, ${Math.min(0.45, alpha * 0.6)})`);
          starGrad.addColorStop(1, "rgba(240, 170, 55, 0)");

          ctx.beginPath();
          ctx.arc(p.sx, p.sy, starGlowR, 0, Math.PI * 2);
          ctx.fillStyle = starGrad;
          ctx.fill();

          // 4-Point delicate starburst flare cross
          if (p.depth > 0.55) {
            const flareLen = r * 3.4;
            ctx.strokeStyle = `rgba(255, 245, 215, ${alpha * 0.75})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(p.sx - flareLen, p.sy);
            ctx.lineTo(p.sx + flareLen, p.sy);
            ctx.moveTo(p.sx, p.sy - flareLen);
            ctx.lineTo(p.sx, p.sy + flareLen);
            ctx.stroke();
          }

          // Radiant white-gold core
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r * 1.1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 254, 245, ${alpha})`;
          ctx.fill();
        }

        // B. POLISHED METALLIC CHAMPAGNE GOLD NODES
        else if (p.colorType === "champagne") {
          const nodeGrad = ctx.createRadialGradient(
            p.sx - r * 0.28, p.sy - r * 0.28, r * 0.05,
            p.sx, p.sy, r
          );
          nodeGrad.addColorStop(0, `rgba(255, 245, 215, ${Math.min(1, alpha * 1.3)})`);
          nodeGrad.addColorStop(0.4, `rgba(228, 196, 138, ${alpha})`);
          nodeGrad.addColorStop(1, `rgba(165, 136, 88, ${alpha})`);

          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
          ctx.fillStyle = nodeGrad;
          ctx.fill();

          // Specular white glint on foreground nodes
          if (p.depth > 0.62) {
            ctx.beginPath();
            ctx.arc(p.sx - r * 0.3, p.sy - r * 0.3, r * 0.36, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.95})`;
            ctx.fill();
          }
        }

        // C. POLISHED PORCELAIN PEARL NODES
        else {
          const pearlGrad = ctx.createRadialGradient(
            p.sx - r * 0.28, p.sy - r * 0.28, r * 0.05,
            p.sx, p.sy, r
          );
          pearlGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, alpha * 1.4)})`);
          pearlGrad.addColorStop(0.45, `rgba(244, 238, 228, ${alpha})`);
          pearlGrad.addColorStop(1, `rgba(195, 182, 162, ${alpha})`);

          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
          ctx.fillStyle = pearlGrad;
          ctx.fill();

          // Specular white glint on foreground nodes
          if (p.depth > 0.6) {
            ctx.beginPath();
            ctx.arc(p.sx - r * 0.32, p.sy - r * 0.32, r * 0.38, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.98})`;
            ctx.fill();
          }
        }
      }

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("mouseout", handleLeave);
      window.removeEventListener("touchend", handleLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size }}
      className={`block select-none ${className}`}
      aria-hidden="true"
    />
  );
}
