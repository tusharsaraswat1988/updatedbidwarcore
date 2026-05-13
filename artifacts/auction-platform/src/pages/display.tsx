import { useEffect, useRef, useState } from "react";
import { useRoute } from "wouter";
import {
  useGetAuctionState,
  useGetTeamPurses,
  useGetTournament,
  getGetAuctionStateQueryKey,
  getGetTeamPursesQueryKey,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useAuctionSocket } from "@/hooks/use-auction-socket";
import { FullscreenLayout } from "@/components/layout";
import { motion, AnimatePresence } from "framer-motion";
import { User, Trophy, Calendar, Timer, Dices, Wallet } from "lucide-react";
import { formatIndianRupee, formatShortIndianRupee } from "@/lib/format";

type WheelItem = { label: string; color: string };

/** Rotating sponsor logo carousel — top-right corner of LED display */
function SponsorCarousel({ logos }: { logos: { url: string; name: string }[] }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (logos.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % logos.length);
        setVisible(true);
      }, 350);
    }, 2000);
    return () => clearInterval(id);
  }, [logos.length]);

  if (!logos.length) return null;
  const current = logos[idx];

  return (
    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
      <div
        className="flex items-center justify-end transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, minWidth: 140 }}
      >
        <img
          key={current.url}
          src={current.url}
          alt={current.name || "Sponsor"}
          className="h-16 max-w-[220px] object-contain"
          style={{ filter: "brightness(1.15) drop-shadow(0 0 8px rgba(255,255,255,0.15))" }}
          onError={e => (e.currentTarget.style.display = "none")}
        />
      </div>
      {current.name && (
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80 text-right">
          {current.name}
        </p>
      )}
      {logos.length > 1 && (
        <div className="flex gap-1 justify-end">
          {logos.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{ backgroundColor: i === idx ? "#eab308" : "#ffffff30" }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function playSoldAudio() {
  try {
    const ctx = new AudioContext();
    // Gavel crack — short noise burst
    const crackBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.06), ctx.sampleRate);
    const crackData = crackBuf.getChannelData(0);
    for (let i = 0; i < crackData.length; i++) {
      crackData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / crackData.length, 1.5);
    }
    const crack = ctx.createBufferSource();
    crack.buffer = crackBuf;
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.0, ctx.currentTime);
    crackGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
    crack.connect(crackGain);
    crackGain.connect(ctx.destination);
    crack.start(ctx.currentTime);

    // Bell ring — two oscillators for richness
    [[880, 0.5], [660, 0.3]].forEach(([freq, vol]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.setValueAtTime(freq as number, ctx.currentTime + 0.04);
      osc.frequency.exponentialRampToValueAtTime((freq as number) * 0.5, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0, ctx.currentTime + 0.04);
      gain.gain.linearRampToValueAtTime(vol as number, ctx.currentTime + 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + 0.04);
      osc.stop(ctx.currentTime + 2.2);
    });
  } catch { /* AudioContext may be blocked — ignore */ }
}

type SoldRecord = {
  playerName: string;
  photoUrl: string | null | undefined;
  amount: number;
  teamName: string;
  teamColor: string;
  teamShortCode?: string;
};

function drawWheelCanvas(canvas: HTMLCanvasElement, items: WheelItem[], rotation: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx || !items.length) return;
  const { width, height } = canvas;
  const cx = width / 2, cy = height / 2;
  const r = Math.min(cx, cy) - 12;
  const arc = (2 * Math.PI) / items.length;
  ctx.clearRect(0, 0, width, height);
  items.forEach((item, i) => {
    const start = rotation + i * arc, end = start + arc;
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
    const label = item.label.length > maxLen ? item.label.slice(0, maxLen) + "…" : item.label;
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

function FortuneWheelOverlay({ items, winner, wheelSpinning }: {
  items: WheelItem[];
  winner: string | null | undefined;
  wheelSpinning?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const rotRef = useRef(0);
  const speedRef = useRef(0.003); // current rotation speed per frame
  const [localWinner, setLocalWinner] = useState<{ label: string; color: string } | null>(null);
  const [phase, setPhase] = useState<"idle" | "spinning" | "landing">("idle");
  const prevWinnerRef = useRef<string | null | undefined>(undefined);
  const prevSpinningRef = useRef<boolean | undefined>(undefined);

  // Phase 1 — idle slow drift OR fast spinning (no winner yet)
  useEffect(() => {
    if (phase === "landing") return;
    let running = true;
    const targetSpeed = wheelSpinning ? 0.05 : 0.003;
    function animate() {
      if (!running) return;
      // Smoothly accelerate/decelerate to target speed
      speedRef.current += (targetSpeed - speedRef.current) * 0.04;
      rotRef.current += speedRef.current;
      if (canvasRef.current && items.length) drawWheelCanvas(canvasRef.current, items, rotRef.current);
      animRef.current = requestAnimationFrame(animate);
    }
    animRef.current = requestAnimationFrame(animate);
    return () => { running = false; cancelAnimationFrame(animRef.current); };
  }, [items, phase, wheelSpinning]);

  // Track when spinning starts — switch to spinning phase, clear local winner
  useEffect(() => {
    if (prevSpinningRef.current === wheelSpinning) return;
    prevSpinningRef.current = wheelSpinning;
    if (wheelSpinning) {
      setPhase("spinning");
      setLocalWinner(null);
    }
  }, [wheelSpinning]);

  // Phase 2 — winner arrives: decelerate and land on winning slice
  useEffect(() => {
    if (winner === prevWinnerRef.current) return;
    prevWinnerRef.current = winner;
    if (!winner || !items.length) { setLocalWinner(null); return; }
    const winnerItem = items.find(i => i.label === winner) || { label: winner, color: "#EAB308" };
    const winnerIdx = items.findIndex(i => i.label === winner);
    if (winnerIdx < 0) { setLocalWinner(winnerItem); return; }

    // Cancel the free-spin loop and start landing animation
    cancelAnimationFrame(animRef.current);
    setPhase("landing");
    setLocalWinner(null);

    const arc = (2 * Math.PI) / items.length;
    // Target: winning slice center is at the pointer (right side = 0 rad)
    const sliceCenter = winnerIdx * arc + arc / 2;
    const currentNorm = ((rotRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const distToTarget = (((2 * Math.PI - sliceCenter) - currentNorm) + 2 * Math.PI) % (2 * Math.PI);
    // Add 3 extra full rotations so it doesn't snap instantly
    const target = rotRef.current + 3 * 2 * Math.PI + distToTarget;
    const duration = 3000;
    const startTime = performance.now();
    const startRot = rotRef.current;

    function animate(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      rotRef.current = startRot + (target - startRot) * ease;
      if (canvasRef.current) drawWheelCanvas(canvasRef.current, items, rotRef.current);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setPhase("idle");
        setLocalWinner(winnerItem);
      }
    }
    animRef.current = requestAnimationFrame(animate);
  }, [winner, items]);

  useEffect(() => {
    if (canvasRef.current && items.length) drawWheelCanvas(canvasRef.current, items, rotRef.current);
  }, [items]);

  // Responsive canvas size — fill 70vh, cap at 700
  const size = typeof window !== "undefined" ? Math.min(window.innerHeight * 0.68, 700) : 600;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #09090b 100%)" }}>
      <motion.div initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="flex items-center gap-3 mb-4 flex-shrink-0">
        <Dices className="w-8 h-8 md:w-10 md:h-10 text-primary" />
        <h1 className="font-display font-black text-3xl md:text-5xl tracking-tight text-white" style={{ textShadow: "0 0 40px rgba(234,179,8,0.5)" }}>FORTUNE WHEEL</h1>
        <Dices className="w-8 h-8 md:w-10 md:h-10 text-primary" />
      </motion.div>

      {/* Spinning indicator */}
      <AnimatePresence>
        {phase === "spinning" && !localWinner && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: [0.5, 1, 0.5], y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 0.8, repeat: Infinity }, y: { duration: 0.3 } }}
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
        <canvas ref={canvasRef} width={size} height={size} className="rounded-full" style={{ filter: "drop-shadow(0 0 60px rgba(234,179,8,0.4))" }} />
      </div>
      <AnimatePresence>
        {localWinner && (
          <motion.div initial={{ scale: 0, opacity: 0, y: 40 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.5, duration: 0.7 }}
            className="mt-6 text-center px-8 md:px-12 py-4 md:py-6 rounded-3xl border-4 flex-shrink-0"
            style={{ borderColor: localWinner.color, background: `${localWinner.color}22`, boxShadow: `0 0 80px ${localWinner.color}55` }}
          >
            <p className="text-base md:text-lg font-bold text-muted-foreground uppercase tracking-widest mb-2">Winner</p>
            <p className="font-display font-black text-5xl md:text-7xl" style={{ color: localWinner.color, textShadow: `0 0 60px ${localWinner.color}` }}>{localWinner.label}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Full-screen overlay showing all team purse statuses */
function TeamPurseOverlay({ purses, currentBidTeamId }: {
  purses: Array<{ teamId: number; teamName: string; shortCode: string; color: string | null | undefined; logoUrl?: string | null; purse: number; purseUsed: number; purseRemaining: number; playersBought: number }>;
  currentBidTeamId?: number | null;
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col select-none"
      style={{ background: "radial-gradient(ellipse at center, #0f172a 0%, #09090b 100%)" }}>
      <div className="flex items-center justify-center gap-4 pt-8 pb-6">
        <Wallet className="w-8 h-8 text-primary" />
        <h1 className="font-display font-black text-4xl tracking-tight text-white" style={{ textShadow: "0 0 40px rgba(234,179,8,0.4)" }}>
          TEAM PURSE STATUS
        </h1>
        <Wallet className="w-8 h-8 text-primary" />
      </div>
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-6 pb-8 overflow-y-auto">
        {purses.map(team => {
          const pctUsed = Math.min(100, team.purse > 0 ? (team.purseUsed / team.purse) * 100 : 0);
          const isLeading = currentBidTeamId === team.teamId;
          const color = team.color || "#F59E0B";
          return (
            <motion.div
              key={team.teamId}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: isLeading ? 1.03 : 1 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="flex flex-col rounded-3xl border-2 p-5 gap-3 relative overflow-hidden"
              style={{
                borderColor: isLeading ? color : `${color}44`,
                backgroundColor: `${color}10`,
                boxShadow: isLeading ? `0 0 40px ${color}55, inset 0 0 30px ${color}15` : `0 0 10px ${color}18`,
              }}
            >
              {isLeading && (
                <div className="absolute inset-0 animate-pulse" style={{ background: `radial-gradient(ellipse at 50% 0%, ${color}20 0%, transparent 70%)` }} />
              )}
              <div className="flex items-center gap-3 relative">
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.teamName} className="w-12 h-12 rounded-xl object-contain" style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.5))" }} />
                ) : (
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center font-display font-black text-lg"
                    style={{ backgroundColor: `${color}30`, color, border: `2px solid ${color}55` }}>
                    {team.shortCode}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-black text-base leading-tight truncate" style={{ color: isLeading ? color : "#fff" }}>
                    {team.teamName}
                  </p>
                  <p className="text-xs font-bold" style={{ color: `${color}99` }}>{team.shortCode}</p>
                </div>
                {isLeading && (
                  <div className="w-3 h-3 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: color }} />
                )}
              </div>
              <div className="relative">
                <p className="text-2xl font-display font-black tabular-nums" style={{ color, textShadow: `0 0 20px ${color}66` }}>
                  {formatShortIndianRupee(team.purseRemaining)}
                </p>
                <p className="text-xs text-muted-foreground">Remaining</p>
              </div>
              <div className="space-y-1.5 relative">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{team.playersBought} players</span>
                  <span>{Math.round(pctUsed)}% used</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: `${color}22` }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pctUsed}%` }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function SponsorTicker({ logos }: { logos: { url: string; name: string }[] }) {
  if (!logos.length) return null;
  const doubled = [...logos, ...logos];
  return (
    <div className="overflow-hidden flex items-center gap-0 h-12 bg-black/40 border-t border-border/20">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 whitespace-nowrap flex-shrink-0">POWERED BY</span>
      <div className="flex items-center gap-8 animate-[marquee_20s_linear_infinite] whitespace-nowrap">
        {doubled.map((logo, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            {logo.url ? (
              <img src={logo.url} alt={logo.name} className="h-7 w-auto object-contain opacity-80" />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">{logo.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 1-second SOLD stamp */
function SoldStamp() {
  return (
    <motion.div
      initial={{ scale: 3, opacity: 0, rotate: -15 }}
      animate={{ scale: 1, opacity: 1, rotate: -12 }}
      exit={{ scale: 0.5, opacity: 0 }}
      transition={{ duration: 0.45, type: "spring", bounce: 0.4 }}
      className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none"
    >
      <div className="text-8xl font-display font-black text-red-500 border-[8px] border-red-500 px-8 py-4 rounded-2xl"
        style={{ textShadow: "0 0 40px rgba(239,68,68,0.8)", boxShadow: "0 0 60px rgba(239,68,68,0.6)", transform: "rotate(-12deg)" }}>
        SOLD!
      </div>
    </motion.div>
  );
}

/** Full-screen sold card shown after the stamp, until next player starts */
function SoldCard({ record }: { record: SoldRecord }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center"
      style={{ background: `radial-gradient(ellipse at 40% 30%, ${record.teamColor}22 0%, transparent 60%), radial-gradient(ellipse at 60% 70%, ${record.teamColor}15 0%, transparent 60%), #09090b` }}
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0.35, duration: 0.6 }}
        className="flex flex-col items-center gap-6 max-w-2xl text-center px-8"
      >
        {/* Sold badge */}
        <div className="inline-flex items-center gap-3 px-8 py-3 rounded-full border-2 border-red-500 bg-red-500/15"
          style={{ boxShadow: "0 0 40px rgba(239,68,68,0.5)" }}>
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="font-display font-black text-2xl tracking-widest text-red-400">SOLD</span>
        </div>

        {/* Player photo */}
        <div className="relative">
          <div
            className="w-52 h-60 rounded-3xl border-4 overflow-hidden flex items-center justify-center"
            style={{
              borderColor: record.teamColor,
              boxShadow: `0 0 80px ${record.teamColor}66, 0 0 160px ${record.teamColor}22`,
            }}
          >
            {record.photoUrl ? (
              <img src={record.photoUrl} alt={record.playerName} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-card flex items-center justify-center">
                <User className="w-24 h-24 text-muted-foreground opacity-20" />
              </div>
            )}
          </div>
        </div>

        {/* Player name */}
        <div>
          <h1 className="font-display font-black text-6xl md:text-7xl tracking-tight text-white leading-none mb-2"
            style={{ textShadow: "0 0 40px rgba(255,255,255,0.15)" }}>
            {record.playerName}
          </h1>
        </div>

        {/* Amount */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
        >
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Sold For</p>
          <p className="font-display font-black text-7xl leading-none" style={{ color: record.teamColor, textShadow: `0 0 60px ${record.teamColor}99` }}>
            {formatIndianRupee(record.amount)}
          </p>
        </motion.div>

        {/* Sold to team */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex items-center gap-4 px-10 py-5 rounded-2xl border-2"
          style={{ borderColor: record.teamColor, backgroundColor: `${record.teamColor}18`, boxShadow: `0 0 40px ${record.teamColor}44` }}
        >
          <div className="w-4 h-4 rounded-full animate-pulse" style={{ backgroundColor: record.teamColor }} />
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest mb-0.5">Sold To</p>
            <p className="font-display font-black text-3xl leading-none" style={{ color: record.teamColor }}>
              {record.teamName}
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Waiting hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-24 text-xs text-muted-foreground/50 uppercase tracking-widest animate-pulse"
      >
        Waiting for next player...
      </motion.p>
    </motion.div>
  );
}

/** Redesigned full-width bottom team purse strip */
function TeamPurseStrip({ purses, currentBidTeamId }: {
  purses: Array<{ teamId: number; teamName: string; shortCode: string; color: string | null | undefined; logoUrl?: string | null; purse: number; purseUsed: number; purseRemaining: number; playersBought: number }>;
  currentBidTeamId?: number | null;
}) {
  if (!purses.length) return null;
  return (
    <div className="border-t border-border/30 bg-black/50 backdrop-blur-sm">
      <div className="flex items-stretch divide-x divide-border/20">
        {purses.map(team => {
          const isLeading = currentBidTeamId === team.teamId;
          const color = team.color || "#F59E0B";
          const pctUsed = Math.min(100, team.purse > 0 ? (team.purseUsed / team.purse) * 100 : 0);
          return (
            <motion.div
              key={team.teamId}
              animate={isLeading ? { scale: 1.02 } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex-1 flex flex-col gap-1 px-4 py-3 relative min-w-0 overflow-hidden"
              style={{
                backgroundColor: isLeading ? `${color}18` : "transparent",
                boxShadow: isLeading ? `inset 0 0 0 2px ${color}55, 0 0 30px ${color}33` : undefined,
              }}
            >
              {/* Glow pulse when leading */}
              {isLeading && (
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  animate={{ opacity: [0.3, 0.7, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  style={{ background: `radial-gradient(ellipse at 50% 100%, ${color}30 0%, transparent 70%)` }}
                />
              )}

              {/* Color accent bar */}
              <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: color, boxShadow: isLeading ? `0 0 8px ${color}` : undefined }} />

              {/* Team identity */}
              <div className="flex items-center gap-2 relative">
                {team.logoUrl ? (
                  <img src={team.logoUrl} alt={team.teamName} className="w-7 h-7 object-contain rounded flex-shrink-0" />
                ) : (
                  <div className="w-7 h-7 rounded flex items-center justify-center text-[10px] font-display font-black flex-shrink-0"
                    style={{ backgroundColor: `${color}25`, color }}>
                    {team.shortCode}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold leading-tight truncate" style={{ color: isLeading ? color : "#e5e7eb" }}>
                    {team.shortCode}
                  </p>
                  <p className="text-[9px] text-muted-foreground leading-tight truncate">{team.teamName}</p>
                </div>
                {isLeading && (
                  <motion.div className="w-2 h-2 rounded-full flex-shrink-0" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ backgroundColor: color }} />
                )}
              </div>

              {/* Purse remaining */}
              <p className="text-base font-display font-black leading-none tabular-nums relative" style={{ color, textShadow: isLeading ? `0 0 15px ${color}` : undefined }}>
                {formatShortIndianRupee(team.purseRemaining)}
              </p>

              {/* Progress bar + count */}
              <div className="relative space-y-1">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${color}22` }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pctUsed}%`, backgroundColor: color, boxShadow: isLeading ? `0 0 6px ${color}` : undefined }} />
                </div>
                <p className="text-[9px] text-muted-foreground">{team.playersBought}P · {Math.round(pctUsed)}% used</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default function DisplayView() {
  const [, params] = useRoute("/tournament/:id/display");
  const tournamentId = parseInt(params?.id || "0");

  // Sold animation state machine
  const [soldPhase, setSoldPhase] = useState<"stamp" | "card" | null>(null);
  const [soldRecord, setSoldRecord] = useState<SoldRecord | null>(null);
  const [lastSoldAction, setLastSoldAction] = useState<string | null>(null);
  const prevPlayerIdRef = useRef<number | null>(null);
  const soldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the last known player + bid info so we can show sold card even after
  // the API clears currentPlayer=null in the same update as lastAction="SOLD:..."
  const lastKnownPlayerRef = useRef<{
    name: string; photoUrl?: string | null;
    bid: number; teamName: string; teamColor: string;
  } | null>(null);

  useAuctionSocket(tournamentId);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const { data: state } = useGetAuctionState(tournamentId, {
    query: {
      queryKey: getGetAuctionStateQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 5000,
    },
  });

  const { data: teamPurses } = useGetTeamPurses(tournamentId, {
    query: {
      queryKey: getGetTeamPursesQueryKey(tournamentId),
      enabled: !!tournamentId,
      refetchInterval: 8000,
    },
  });

  // Keep lastKnownPlayerRef up to date whenever a player is live in auction
  useEffect(() => {
    if (state?.currentPlayer && state.currentBidTeamId) {
      lastKnownPlayerRef.current = {
        name: state.currentPlayer.name,
        photoUrl: state.currentPlayer.photoUrl,
        bid: state.currentBid ?? 0,
        teamName: state.currentBidTeamName ?? "Unknown Team",
        teamColor: state.currentBidTeamColor ?? "#F59E0B",
      };
    }
  }, [state?.currentPlayer?.id, state?.currentBidTeamId, state?.currentBid]);

  // Show SOLD stamp (1s) → then sold card (until next player)
  useEffect(() => {
    if (state?.lastAction && state.lastAction.startsWith("SOLD:") && state.lastAction !== lastSoldAction) {
      setLastSoldAction(state.lastAction);
      // After sell the API sets currentPlayer=null in the same payload, so use cached ref
      const src = state.currentPlayer
        ? {
            playerName: state.currentPlayer.name,
            photoUrl: state.currentPlayer.photoUrl,
            amount: state.currentBid || 0,
            teamName: state.currentBidTeamName || "Unknown Team",
            teamColor: state.currentBidTeamColor || "#F59E0B",
          }
        : lastKnownPlayerRef.current
        ? {
            playerName: lastKnownPlayerRef.current.name,
            photoUrl: lastKnownPlayerRef.current.photoUrl,
            amount: lastKnownPlayerRef.current.bid,
            teamName: lastKnownPlayerRef.current.teamName,
            teamColor: lastKnownPlayerRef.current.teamColor,
          }
        : null;
      if (src) setSoldRecord(src);
      setSoldPhase("stamp");
      playSoldAudio();
      if (soldTimerRef.current) clearTimeout(soldTimerRef.current);
      // After 1s, switch stamp → card
      soldTimerRef.current = setTimeout(() => {
        setSoldPhase("card");
      }, 1000);
    }
    return undefined;
  }, [state?.lastAction, lastSoldAction]);

  // Clear sold card when next player appears
  useEffect(() => {
    const currentId = state?.currentPlayer?.id ?? null;
    if (currentId && currentId !== prevPlayerIdRef.current) {
      setSoldPhase(null);
      setSoldRecord(null);
      prevPlayerIdRef.current = currentId;
    } else if (!currentId) {
      prevPlayerIdRef.current = null;
    }
  }, [state?.currentPlayer?.id]);

  // Countdown timer — derives from server timerEndsAt so all clients agree.
  // timerTotalRef captures the full duration at the moment timerEndsAt arrives so
  // the progress bar always starts at 100% regardless of the tournament default setting.
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const timerTotalRef = useRef<number>(30);
  useEffect(() => {
    if (!state?.timerEndsAt) { setTimeLeft(null); return; }
    const fullMs = new Date(state.timerEndsAt).getTime() - Date.now();
    timerTotalRef.current = Math.max(1, Math.ceil(fullMs / 1000));
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
  const teamColor = state?.currentBidTeamColor || "#F59E0B";

  let sponsorLogos: { url: string; name: string }[] = [];
  if (tournament?.sponsorLogos) {
    try { sponsorLogos = JSON.parse(tournament.sponsorLogos); } catch { /* ignore */ }
  }

  const playerSpecs = state?.currentPlayer
    ? [
        state.currentPlayer.role,
        state.currentPlayer.battingStyle,
        state.currentPlayer.bowlingStyle,
        state.currentPlayer.specialization,
        state.currentPlayer.city,
        state.currentPlayer.age ? `Age ${state.currentPlayer.age}` : null,
      ].filter(Boolean)
    : [];

  // Merge purse data for strip (include teamName/shortCode from state if available)
  const stripPurses = (teamPurses || []).map(t => ({
    teamId: t.teamId,
    teamName: t.teamName,
    shortCode: t.shortCode || t.teamName.slice(0, 4).toUpperCase(),
    color: t.color,
    logoUrl: t.logoUrl,
    purse: t.purse,
    purseUsed: t.purseUsed,
    purseRemaining: t.purseRemaining,
    playersBought: t.playersBought,
  }));

  return (
    <FullscreenLayout>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
      <div
        className="min-h-screen flex flex-col select-none relative"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, ${teamColor}18 0%, transparent 55%), radial-gradient(ellipse at 70% 80%, ${teamColor}12 0%, transparent 55%), #09090b`,
          transition: "background 0.8s ease",
        }}
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 md:px-8 py-3 md:py-4 border-b border-border/40 bg-black/30 backdrop-blur-sm flex-shrink-0 gap-3 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {tournament?.logoUrl ? (
              <img src={tournament.logoUrl} alt={tournament.name} className="h-8 w-8 md:h-12 md:w-12 object-contain rounded-lg flex-shrink-0" />
            ) : (
              <Trophy className="w-6 h-6 md:w-8 md:h-8 text-primary flex-shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-display font-black text-base md:text-2xl tracking-tight text-white leading-none truncate">
                {tournament?.name || "BIDWAR"}
              </div>
              {tournament?.organizerName && (
                <div className="text-[10px] md:text-xs text-muted-foreground tracking-widest uppercase truncate hidden sm:block">{tournament.organizerName}</div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-6 flex-shrink-0">
            {tournament?.auctionDate && (
              <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{tournament.auctionDate}</span>
              </div>
            )}
            <div className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-1 md:py-1.5 rounded-full border ${
              isActive ? "bg-green-500/20 border-green-500/40 text-green-400" :
              isPaused ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400" :
              "bg-border/30 border-border text-muted-foreground"
            }`}>
              {isActive && <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse" />}
              <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest">{state?.status || "IDLE"}</span>
            </div>
            <div className="text-xs text-muted-foreground font-mono tabular-nums hidden sm:block">
              <span className="text-green-400 font-bold">{state?.soldPlayersCount || 0}</span> Sold
              {" · "}
              <span className="text-muted-foreground">{state?.remainingPlayersCount || 0}</span> Left
            </div>
            {sponsorLogos.length > 0 && (
              <div className="border-l border-border/40 pl-3 md:pl-6 hidden md:block">
                <SponsorCarousel logos={sponsorLogos} />
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-8 py-6 relative overflow-hidden min-h-0">
          {/* SOLD animations — stamp then card */}
          <AnimatePresence>
            {soldPhase === "stamp" && <SoldStamp key="stamp" />}
          </AnimatePresence>
          <AnimatePresence>
            {soldPhase === "card" && soldRecord && <SoldCard key="card" record={soldRecord} />}
          </AnimatePresence>

          {state?.currentPlayer ? (
            <div className="w-full max-w-6xl">
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 lg:gap-16">
                {/* Player Photo */}
                <motion.div
                  key={state.currentPlayer.id}
                  initial={{ opacity: 0, scale: 0.8, x: -60 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ duration: 0.5, type: "spring" }}
                  className="flex-shrink-0"
                >
                  <div
                    className="w-40 h-52 sm:w-52 sm:h-64 md:w-64 md:h-[21rem] lg:w-72 lg:h-80 xl:w-80 xl:h-[26rem] rounded-3xl border-4 overflow-hidden flex items-center justify-center relative"
                    style={{
                      borderColor: teamColor,
                      boxShadow: `0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22`,
                    }}
                  >
                    {state.currentPlayer.photoUrl ? (
                      <img src={state.currentPlayer.photoUrl} alt={state.currentPlayer.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-card flex flex-col items-center justify-center gap-3">
                        <User className="w-24 h-24 text-muted-foreground opacity-20" />
                        {state.currentPlayer.jerseyNumber && (
                          <span className="font-display font-black text-5xl text-muted-foreground opacity-30">
                            #{state.currentPlayer.jerseyNumber}
                          </span>
                        )}
                      </div>
                    )}
                    {state.currentPlayer.jerseyNumber && state.currentPlayer.photoUrl && (
                      <div
                        className="absolute bottom-3 right-3 w-10 h-10 rounded-full flex items-center justify-center font-display font-black text-sm"
                        style={{ backgroundColor: teamColor, color: "#000" }}
                      >
                        #{state.currentPlayer.jerseyNumber}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Player Info + Bid */}
                <motion.div
                  key={`info-${state.currentPlayer.id}`}
                  initial={{ opacity: 0, x: 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, type: "spring" }}
                  className="flex-1 text-center md:text-left space-y-4"
                >
                  <div>
                    {playerSpecs.length > 0 && (
                      <p className="text-xs md:text-sm font-mono text-muted-foreground uppercase tracking-widest mb-2">
                        {playerSpecs.join(" · ")}
                      </p>
                    )}
                    <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-display font-black tracking-tight leading-none text-white">
                      {state.currentPlayer.name}
                    </h1>
                    {state.currentPlayer.availabilityDates && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Available: {state.currentPlayer.availabilityDates}
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground uppercase tracking-widest mb-1">Current Bid</p>
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={state.currentBid}
                        initial={{ scale: 0.6, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 1.2, opacity: 0 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-black leading-none"
                        style={{ color: teamColor, textShadow: `0 0 80px ${teamColor}99` }}
                      >
                        {formatIndianRupee(state.currentBid || 0)}
                      </motion.p>
                    </AnimatePresence>
                  </div>

                  {state.currentBidTeamName ? (
                    <motion.div
                      key={state.currentBidTeamId}
                      initial={{ opacity: 0, y: 20, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2"
                      style={{
                        borderColor: teamColor,
                        backgroundColor: `${teamColor}18`,
                        boxShadow: `0 0 40px ${teamColor}44`,
                      }}
                    >
                      {(state as any).currentBidTeamLogoUrl ? (
                        <img
                          src={(state as any).currentBidTeamLogoUrl}
                          alt={state.currentBidTeamName}
                          className="w-12 h-12 object-contain rounded-lg flex-shrink-0"
                          style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.4))" }}
                          onError={e => (e.currentTarget.style.display = "none")}
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: teamColor }} />
                      )}
                      <span className="text-xl md:text-3xl font-display font-black" style={{ color: teamColor }}>
                        {state.currentBidTeamName}
                      </span>
                    </motion.div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border/50 text-muted-foreground">
                      <span className="text-lg font-semibold">Waiting for first bid...</span>
                    </div>
                  )}

                  {timeLeft !== null && (
                    <div className="space-y-2">
                      <div className={`flex items-center gap-3 ${timeLeft <= 5 ? "text-red-400" : timeLeft <= 10 ? "text-orange-400" : "text-muted-foreground"}`}>
                        <Timer className={`w-6 h-6 ${timeLeft <= 5 ? "animate-pulse" : ""}`} />
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={timeLeft}
                            initial={{ scale: 1.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`text-5xl md:text-6xl lg:text-7xl font-display font-black tabular-nums leading-none ${timeLeft <= 5 ? "animate-pulse" : ""}`}
                          >
                            {timeLeft}
                          </motion.span>
                        </AnimatePresence>
                        <div className="flex flex-col justify-center">
                          <span className="text-xl font-bold uppercase tracking-widest">sec</span>
                          <span className={`text-xs font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border mt-1 ${
                            state.timerType === "bid"
                              ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
                              : "bg-green-500/20 text-green-400 border-green-500/30"
                          }`}>
                            {state.timerType === "bid" ? "BID TIMER" : "START TIMER"}
                          </span>
                        </div>
                      </div>
                      {/* Progress bar — uses timerTotalRef so it starts at 100% regardless
                          of tournament default. Same full-duration tracking as the OBS ring. */}
                      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${timeLeft <= 5 ? "bg-red-400" : timeLeft <= 10 ? "bg-orange-400" : "bg-green-400"}`}
                          style={{ width: `${Math.min(100, (timeLeft / timerTotalRef.current) * 100)}%` }}
                          transition={{ duration: 0.25, ease: "linear" }}
                        />
                      </div>
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">
                    Base Price: <span className="font-semibold text-foreground">{formatIndianRupee(state.currentPlayer.basePrice)}</span>
                    {state.bidIncrement && (
                      <span className="ml-3">· Increment: <span className="font-semibold text-foreground">{formatIndianRupee(state.bidIncrement)}</span></span>
                    )}
                    {state.currentPlayer.achievements && (
                      <span className="ml-3 text-yellow-400">· {state.currentPlayer.achievements}</span>
                    )}
                  </p>
                </motion.div>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-6">
              {tournament?.logoUrl ? (
                <motion.img
                  src={tournament.logoUrl}
                  alt={tournament.name}
                  className="w-32 h-32 object-contain mx-auto"
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity }}
                />
              ) : (
                <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 3, repeat: Infinity }}>
                  <Trophy className="w-20 h-20 text-primary/40 mx-auto" />
                </motion.div>
              )}
              <h2 className="text-5xl font-display font-bold text-muted-foreground">
                {state?.status === "completed" ? "Auction Complete" : isPaused ? "Auction Paused" : tournament?.name || "Live Auction"}
              </h2>
              {state?.lastAction && (
                <p className="text-muted-foreground text-xl max-w-lg mx-auto">{state.lastAction}</p>
              )}
              {!isActive && !isPaused && (
                <p className="text-muted-foreground text-base">Waiting for operator to start...</p>
              )}
            </div>
          )}
        </div>

        {/* Full-width Bottom Team Strip */}
        <TeamPurseStrip purses={stripPurses} currentBidTeamId={state?.currentBidTeamId} />

        {/* Sponsor Logos Ticker */}
        <SponsorTicker logos={sponsorLogos} />

        {/* Team Purse View Overlay */}
        <AnimatePresence>
          {state?.teamPurseViewActive && stripPurses.length > 0 && (
            <motion.div
              key="purse-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <TeamPurseOverlay purses={stripPurses} currentBidTeamId={state?.currentBidTeamId} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fortune Wheel Overlay */}
        <AnimatePresence>
          {state?.fortuneWheelActive && (
            <motion.div
              key="fortune-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <FortuneWheelOverlay items={state.wheelItems ?? []} winner={state.wheelWinner} wheelSpinning={state.wheelSpinning} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </FullscreenLayout>
  );
}
