import { useState, useEffect, useRef, useMemo, memo } from "react";
import {
  Gavel,
  Trophy,
  Volume2,
  VolumeX,
  RotateCcw,
  Tv,
  Smartphone,
  Video,
  Eye,
  LayoutGrid,
  CheckCircle,
  XCircle,
  Hourglass,
  Settings2,
  Clock,
  User,
  Zap,
  ArrowRight,
  Shield,
  Radio,
  Flame,
  ThumbsUp,
  Coins,
  ChevronRight,
  Sparkles,
} from "lucide-react";

// ─── TYPES & DATA ────────────────────────────────────────────────────────────

// ─── TYPES & DATA (Mirrored directly from user's live LED screenshot) ─────────

export interface DemoTeam {
  id: string;
  code: string;
  name: string;
  shortName: string;
  color: string;
  purse: number; // in Points
  initialPurse: number;
  maxBid: number;
  playersCount: number;
}

export interface DemoPlayer {
  id: string;
  serialNo: number;
  name: string;
  role: string;
  city: string;
  age: string;
  batStyle: string;
  category: string;
  basePrice: number; // in Points
  avatarEmoji: string;
}

export interface SoldRecord {
  id: string;
  playerName: string;
  role: string;
  teamCode: string;
  teamName: string;
  teamColor: string;
  price: number; // in Points
  timestamp: string;
  isManual?: boolean;
}

const TEAMS_DATA: DemoTeam[] = [
  {
    id: "t2",
    code: "T2",
    name: "DELHI DEVILS",
    shortName: "DEL",
    color: "#ef4444",
    purse: 1000000,
    initialPurse: 1000000,
    maxBid: 950000,
    playersCount: 4,
  },
  {
    id: "t1",
    code: "T1",
    name: "LUCKNOW CHA...",
    shortName: "LUC",
    color: "#2563eb",
    purse: 955000,
    initialPurse: 955000,
    maxBid: 915000,
    playersCount: 3,
  },
  {
    id: "t3",
    code: "T3",
    name: "MUMBAI TITANS",
    shortName: "MUM",
    color: "#0284c7",
    purse: 1200000,
    initialPurse: 1200000,
    maxBid: 1100000,
    playersCount: 5,
  },
  {
    id: "t4",
    code: "T4",
    name: "BANGALORE ROYALS",
    shortName: "BLR",
    color: "#dc2626",
    purse: 1050000,
    initialPurse: 1050000,
    maxBid: 980000,
    playersCount: 4,
  },
];

const PLAYERS_QUEUE: DemoPlayer[] = [
  {
    id: "p1",
    serialNo: 1,
    name: "TUSHAR SARASWAT",
    role: "BATSMAN",
    city: "VARANASI",
    age: "—",
    batStyle: "Right-hand",
    category: "GRADE A+",
    basePrice: 10000,
    avatarEmoji: "🏏",
  },
  {
    id: "p2",
    serialNo: 2,
    name: "VIRAT KOHLI",
    role: "BATSMAN",
    city: "DELHI",
    age: "35",
    batStyle: "Right-hand",
    category: "MARQUEE",
    basePrice: 20000,
    avatarEmoji: "🔥",
  },
  {
    id: "p3",
    serialNo: 3,
    name: "ROHIT SHARMA",
    role: "BATSMAN",
    city: "MUMBAI",
    age: "36",
    batStyle: "Right-hand",
    category: "MARQUEE",
    basePrice: 20000,
    avatarEmoji: "🏏",
  },
  {
    id: "p4",
    serialNo: 4,
    name: "JASPRIT BUMRAH",
    role: "BOWLER",
    city: "AHMEDABAD",
    age: "30",
    batStyle: "Right-arm Fast",
    category: "MARQUEE",
    basePrice: 20000,
    avatarEmoji: "⚡",
  },
];

const INITIAL_TOP_5: SoldRecord[] = [
  {
    id: "top-1",
    playerName: "HARDIK PANDYA",
    role: "ALL-ROUNDER",
    teamCode: "T2",
    teamName: "DELHI DEVILS",
    teamColor: "#ef4444",
    price: 45000,
    timestamp: "Lot 01",
  },
  {
    id: "top-2",
    playerName: "RASHID KHAN",
    role: "SPINNER",
    teamCode: "T1",
    teamName: "LUCKNOW CHA...",
    teamColor: "#2563eb",
    price: 35000,
    timestamp: "Lot 02",
  },
  {
    id: "top-3",
    playerName: "SURYAKUMAR YADAV",
    role: "BATSMAN",
    teamCode: "T3",
    teamName: "MUMBAI TITANS",
    teamColor: "#0284c7",
    price: 30000,
    timestamp: "Lot 03",
  },
];

// ─── WEB AUDIO SYNTHESIZER ───────────────────────────────────────────────────

class WebAudioSounds {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private getCtx(): AudioContext | null {
    if (!this.enabled) return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  playBid() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.12);
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.12);
    } catch {
      // ignore
    }
  }

  playSold() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      // Gavel strike thump
      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.connect(thumpGain);
      thumpGain.connect(ctx.destination);
      thump.type = "triangle";
      thump.frequency.setValueAtTime(180, t);
      thump.frequency.exponentialRampToValueAtTime(40, t + 0.22);
      thumpGain.gain.setValueAtTime(0.5, t);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      thump.start(t);
      thump.stop(t + 0.22);

      // Fanfare chord [C5, E5, G5, C6]
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const chordOsc = ctx.createOscillator();
        const chordGain = ctx.createGain();
        chordOsc.connect(chordGain);
        chordGain.connect(ctx.destination);
        chordOsc.type = "triangle";
        chordOsc.frequency.setValueAtTime(f, t + 0.06 + i * 0.04);
        chordGain.gain.setValueAtTime(0.25, t + 0.06 + i * 0.04);
        chordGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        chordOsc.start(t + 0.06 + i * 0.04);
        chordOsc.stop(t + 0.75);
      });
    } catch {
      // ignore
    }
  }

  playUnsold() {
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(320, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 0.4);
      gain.gain.setValueAtTime(0.22, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.start(t);
      osc.stop(t + 0.4);
    } catch {
      // ignore
    }
  }
}

const sfx = new WebAudioSounds();

// ─── MAIN SIMULATOR COMPONENT ────────────────────────────────────────────────

export function AuctionExperienceSimulator({ onStartTrial }: { onStartTrial?: () => void }) {
  const [activeScreen, setActiveScreen] = useState<"director" | "led" | "team" | "obs" | "viewer" | "quad">("director");
  const [teams, setTeams] = useState<DemoTeam[]>(TEAMS_DATA);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [currentBid, setCurrentBid] = useState<number>(15000);
  const [leadingTeamId, setLeadingTeamId] = useState<string>("t2");
  const [status, setStatus] = useState<"active" | "sold" | "unsold">("active");
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [topSold, setTopSold] = useState<SoldRecord[]>(INITIAL_TOP_5);
  const [showTopModal, setShowTopModal] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTeam, setManualTeam] = useState("t2");
  const [manualPrice, setManualPrice] = useState("15000");
  const [muted, setMuted] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const reactionId = useRef(0);

  const currentPlayer = PLAYERS_QUEUE[playerIdx % PLAYERS_QUEUE.length];
  const leadingTeam = teams.find((t) => t.id === leadingTeamId) || teams[0];
  const userTeam = teams[0]; // T2 Delhi Devils

  // Sync mute
  useEffect(() => {
    sfx.enabled = !muted;
  }, [muted]);

  // Live timer tick
  useEffect(() => {
    if (status !== "active") return;
    const interval = setInterval(() => {
      setTimerSeconds((s) => (s > 0 ? s - 1 : 15));
    }, 1000);
    return () => clearInterval(interval);
  }, [status]);

  // Raise Bid (+5,000 PT. or +10,000 PT.)
  const handleRaiseBid = (increment = 5000) => {
    if (status !== "active") return;
    const nextAmount = currentBid + increment;
    const nextTeam = leadingTeamId === "t2" ? teams[1] : teams[0]; // Alternates between T2 (Delhi Devils) and T1 (Lucknow)
    setCurrentBid(nextAmount);
    setLeadingTeamId(nextTeam.id);
    setTimerSeconds(15);
    sfx.playBid();
  };

  // SOLD (Hammer)
  const handleSold = () => {
    if (status !== "active") return;
    setStatus("sold");
    sfx.playSold();

    // Deduct purse
    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === leadingTeamId) {
          return {
            ...t,
            purse: Math.max(0, t.purse - currentBid),
            playersCount: t.playersCount + 1,
          };
        }
        return t;
      })
    );

    // Add to Top Sold
    const rec: SoldRecord = {
      id: `sold-${Date.now()}`,
      playerName: currentPlayer.name,
      role: currentPlayer.role,
      teamCode: leadingTeam.code,
      teamName: leadingTeam.name,
      teamColor: leadingTeam.color,
      price: currentBid,
      timestamp: `Lot 0${currentPlayer.serialNo}`,
    };

    setTopSold((prev) => {
      const filtered = prev.filter((p) => p.playerName !== currentPlayer.name);
      return [rec, ...filtered].sort((a, b) => b.price - a.price);
    });
  };

  // UNSOLD
  const handleUnsold = () => {
    if (status !== "active") return;
    setStatus("unsold");
    sfx.playUnsold();
  };

  // MANUAL SELL
  const handleConfirmManualSell = () => {
    const target = teams.find((t) => t.id === manualTeam) || teams[0];
    const finalP = parseInt(manualPrice, 10) || currentBid;
    setStatus("sold");
    setCurrentBid(finalP);
    setLeadingTeamId(target.id);
    sfx.playSold();

    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === target.id) {
          return {
            ...t,
            purse: Math.max(0, t.purse - finalP),
            playersCount: t.playersCount + 1,
          };
        }
        return t;
      })
    );

    const rec: SoldRecord = {
      id: `manual-${Date.now()}`,
      playerName: currentPlayer.name,
      role: currentPlayer.role,
      teamCode: target.code,
      teamName: target.name,
      teamColor: target.color,
      price: finalP,
      timestamp: `Manual Allocation`,
      isManual: true,
    };

    setTopSold((prev) => {
      const filtered = prev.filter((p) => p.playerName !== currentPlayer.name);
      return [rec, ...filtered].sort((a, b) => b.price - a.price);
    });

    setShowManualModal(false);
  };

  // NEXT PLAYER
  const handleNextPlayer = () => {
    const nextIdx = (playerIdx + 1) % PLAYERS_QUEUE.length;
    const nextP = PLAYERS_QUEUE[nextIdx];
    setPlayerIdx(nextIdx);
    setStatus("active");
    setCurrentBid(nextP.basePrice);
    setLeadingTeamId("t2");
    setTimerSeconds(15);
  };

  // RESET
  const handleReset = () => {
    setTeams(TEAMS_DATA);
    setPlayerIdx(0);
    setCurrentBid(15000);
    setLeadingTeamId("t2");
    setStatus("active");
    setTopSold(INITIAL_TOP_5);
    setTimerSeconds(0);
  };

  // FAN REACTIONS
  const sendReaction = (emoji: string) => {
    const id = reactionId.current++;
    const left = Math.floor(Math.random() * 60) + 20;
    setReactions((prev) => [...prev, { id, emoji, left }]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* ─── 1. TOP HEADER & SCREEN SELECTOR TABS ─────────────────────────── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-bold">
              Live Auction Ecosystem Preview
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-display font-black text-foreground mt-0.5 tracking-tight">
            See Exactly What Every Screen Shows
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
            Real production layouts. Hit <strong className="text-emerald-400 font-mono">SOLD</strong> or <strong className="text-red-400 font-mono">UNSOLD</strong> on the operator desk below to see all screens synchronize in real time.
          </p>
        </div>

        {/* Screen Tabs without horizontal scrollbar */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/60 border border-white/15">
          {[
            { key: "director", label: "⊞ Director View (LED + Feeds)", icon: LayoutGrid },
            { key: "led", label: "1. Stage LED (Full)", icon: Tv },
            { key: "team", label: "2. Team Owner App", icon: Smartphone },
            { key: "obs", label: "3. OBS Broadcast", icon: Video },
            { key: "viewer", label: "4. Fan Room", icon: Eye },
            { key: "quad", label: "2x2 Quad Grid", icon: LayoutGrid },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeScreen === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveScreen(item.key as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 2. OPERATOR CONTROL CONSOLE (AT THE TOP — ALWAYS VISIBLE!) ────── */}
      <div className="rounded-2xl border-2 border-primary/40 bg-card/95 p-4 sm:p-5 shadow-2xl space-y-3.5">
        {/* Console Header Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
              <Gavel className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-display font-black text-base sm:text-lg text-foreground tracking-wide">
                  Auction Operator Console
                </h4>
                <span className="px-2 py-0.5 rounded bg-primary/20 border border-primary/30 text-[11px] font-mono font-bold text-primary">
                  Active Lot: #{currentPlayer.serialNo} {currentPlayer.name}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                IPL-grade auctioneer desk. Tap any action to update all connected screens instantly.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Top 5 Sold */}
            <button
              type="button"
              onClick={() => setShowTopModal(true)}
              className="px-3 py-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <Trophy className="h-3.5 w-3.5 text-amber-400" />
              <span>Top 5 Sold</span>
              <span className="rounded-full bg-amber-400/20 px-1.5 py-0.2 text-[10px] font-mono">
                {topSold.length}
              </span>
            </button>

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setMuted(!muted)}
              title={muted ? "Unmute sound effects" : "Mute sound effects"}
              className={`p-2 rounded-lg border text-xs transition ${
                muted
                  ? "border-white/10 bg-white/5 text-muted-foreground"
                  : "border-primary/40 bg-primary/20 text-primary"
              }`}
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>

            {/* Reset */}
            <button
              type="button"
              onClick={handleReset}
              title="Reset auction state"
              className="p-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Console Action Buttons Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Action 1: SOLD */}
          <button
            type="button"
            disabled={status !== "active"}
            onClick={handleSold}
            className="flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border-2 border-emerald-500/70 bg-gradient-to-b from-emerald-600/30 to-emerald-700/20 hover:from-emerald-600/40 hover:to-emerald-700/30 active:scale-98 transition disabled:opacity-40 disabled:pointer-events-none group shadow-lg shadow-emerald-500/15"
          >
            <div className="flex items-center gap-1.5 text-emerald-300 font-display font-black text-base sm:text-lg uppercase">
              <CheckCircle className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span>SOLD!</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-200/80 mt-0.5">
              Hammer down to {leadingTeam.shortName} [S]
            </span>
          </button>

          {/* Action 2: UNSOLD */}
          <button
            type="button"
            disabled={status !== "active"}
            onClick={handleUnsold}
            className="flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border-2 border-rose-500/60 bg-gradient-to-b from-rose-600/25 to-rose-700/15 hover:from-rose-600/35 hover:to-rose-700/25 active:scale-98 transition disabled:opacity-40 disabled:pointer-events-none group shadow-lg shadow-rose-500/15"
          >
            <div className="flex items-center gap-1.5 text-rose-300 font-display font-black text-base sm:text-lg uppercase">
              <XCircle className="h-4 w-4 group-hover:scale-110 transition-transform" />
              <span>UNSOLD</span>
            </div>
            <span className="text-[10px] font-mono text-rose-200/80 mt-0.5">
              Pass to next pool [U]
            </span>
          </button>

          {/* Action 3: MANUAL SELL */}
          <button
            type="button"
            disabled={status !== "active"}
            onClick={() => {
              setManualPrice(String(currentBid));
              setShowManualModal(true);
            }}
            className="flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20 active:scale-98 transition disabled:opacity-40 disabled:pointer-events-none group"
          >
            <div className="flex items-center gap-1.5 text-amber-300 font-display font-bold text-sm sm:text-base uppercase">
              <Settings2 className="h-4 w-4 group-hover:rotate-45 transition-transform" />
              <span>Manual Sell</span>
            </div>
            <span className="text-[10px] font-mono text-amber-200/80 mt-0.5">
              Assign team & custom price [M]
            </span>
          </button>

          {/* Action 4: NEXT PLAYER */}
          <button
            type="button"
            onClick={handleNextPlayer}
            className="flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 active:scale-98 transition group"
          >
            <div className="flex items-center gap-1.5 text-primary font-display font-black text-sm sm:text-base uppercase">
              <span>Next Player</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground mt-0.5">
              Load next lot from queue
            </span>
          </button>
        </div>

        {/* Quick Bids & Teams Purse Strip */}
        <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-bold">
              Raise Bid:
            </span>
            <button
              type="button"
              disabled={status !== "active"}
              onClick={() => handleRaiseBid(5000)}
              className="px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 active:scale-95 text-sky-200 text-xs font-bold font-mono transition disabled:opacity-30"
            >
              +5,000 PT. ({(currentBid + 5000).toLocaleString("en-IN")})
            </button>
            <button
              type="button"
              disabled={status !== "active"}
              onClick={() => handleRaiseBid(10000)}
              className="px-3 py-1.5 rounded-lg border border-sky-500/40 bg-sky-500/15 hover:bg-sky-500/25 active:scale-95 text-sky-200 text-xs font-bold font-mono transition disabled:opacity-30"
            >
              +10,000 PT. ({(currentBid + 10000).toLocaleString("en-IN")})
            </button>
          </div>

          {/* Teams Purse Tracker */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {teams.map((t) => (
              <div
                key={t.id}
                className={`px-2.5 py-1 rounded-lg border text-xs flex items-center gap-1.5 ${
                  t.id === leadingTeamId && status === "active"
                    ? "border-primary bg-primary/20 text-primary font-bold shadow-sm"
                    : "border-white/10 bg-black/40 text-muted-foreground"
                }`}
              >
                <span className="font-bold">{t.shortName}</span>
                <span className="font-mono text-foreground font-semibold">
                  {t.purse.toLocaleString("en-IN")} PT.
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── 3. SCREENS DISPLAY CANVAS (DIRECTLY UNDER OPERATOR CONSOLE) ──── */}
      <div className="relative rounded-2xl border-2 border-primary/30 bg-black/90 p-3 sm:p-5 shadow-2xl overflow-hidden">
        {/* Subtle grid background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px]" />

        {/* A. DIRECTOR VIEW (DEFAULT): Hero Stage LED on Left (62%) + 3 Live Feeds on Right (38%) */}
        {activeScreen === "director" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 relative z-10 items-start">
            {/* Left: Hero Stage LED Wall */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col rounded-xl border border-white/15 bg-card/60 overflow-hidden shadow-xl">
              <div className="bg-slate-950 px-3.5 py-2 border-b border-white/10 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  <Tv className="h-4 w-4" /> Screen 1: Stage LED Wall (1080p Main Auditorium)
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20 uppercase font-bold">
                  HERO DISPLAY
                </span>
              </div>
              <div className="p-2 sm:p-3 flex-1 flex flex-col justify-center bg-black">
                <ActualLedStageView
                  player={currentPlayer}
                  bid={currentBid}
                  leadingTeam={leadingTeam}
                  status={status}
                  timer={timerSeconds}
                  remainingPurse={leadingTeam.purse - (status === "sold" ? currentBid : 0)}
                  large
                />
              </div>
            </div>

            {/* Right: 3 Synchronized Ecosystem Feeds */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-3.5 flex flex-col">
              {/* Screen 2: Team Owner Bidding App */}
              <div className="rounded-xl border border-white/15 bg-card/60 overflow-hidden shadow-xl flex flex-col">
                <div className="bg-slate-950 px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-cyan-400 uppercase tracking-wider">
                    <Smartphone className="h-3.5 w-3.5" /> Screen 2: Team Owner PWA
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">Mobile / Tablet</span>
                </div>
                <div className="p-2">
                  <ActualTeamBidderView
                    player={currentPlayer}
                    bid={currentBid}
                    leadingTeam={leadingTeam}
                    userTeam={userTeam}
                    status={status}
                    onQuickBid={() => handleRaiseBid(5000)}
                  />
                </div>
              </div>

              {/* Screen 3: OBS Broadcast Lower Third */}
              <div className="rounded-xl border border-white/15 bg-card/60 overflow-hidden shadow-xl flex flex-col">
                <div className="bg-slate-950 px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-rose-400 uppercase tracking-wider">
                    <Video className="h-3.5 w-3.5" /> Screen 3: OBS Broadcast Stream
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">YouTube Overlay</span>
                </div>
                <div className="p-2">
                  <ActualObsStreamView
                    player={currentPlayer}
                    bid={currentBid}
                    leadingTeam={leadingTeam}
                    status={status}
                  />
                </div>
              </div>

              {/* Screen 4: Public Fan Viewer Room */}
              <div className="rounded-xl border border-white/15 bg-card/60 overflow-hidden shadow-xl flex flex-col">
                <div className="bg-slate-950 px-3 py-1.5 border-b border-white/10 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-emerald-400 uppercase tracking-wider">
                    <Eye className="h-3.5 w-3.5" /> Screen 4: Public Fan Room
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">Live Fan Stream</span>
                </div>
                <div className="p-2">
                  <ActualFanViewerView
                    player={currentPlayer}
                    bid={currentBid}
                    leadingTeam={leadingTeam}
                    status={status}
                    reactions={reactions}
                    onSendReaction={sendReaction}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* B. 2x2 QUAD GRID VIEW */}
        {activeScreen === "quad" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
            {/* Screen 1: Stage LED Wall */}
            <div className="rounded-xl border border-white/15 bg-card/60 overflow-hidden shadow-xl flex flex-col">
              <div className="bg-slate-950 px-4 py-2 border-b border-white/10 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  <Tv className="h-4 w-4" /> Screen 1: Stage LED Display
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Auditorium Main</span>
              </div>
              <div className="p-2.5 flex-1 bg-black flex flex-col justify-center">
                <ActualLedStageView
                  player={currentPlayer}
                  bid={currentBid}
                  leadingTeam={leadingTeam}
                  status={status}
                  timer={timerSeconds}
                  remainingPurse={leadingTeam.purse - (status === "sold" ? currentBid : 0)}
                  large
                />
              </div>
            </div>

            {/* Screen 2: Team Bidder Screen */}
            <div className="rounded-xl border border-white/15 bg-card/60 overflow-hidden shadow-xl flex flex-col">
              <div className="bg-slate-950 px-4 py-2 border-b border-white/10 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  <Smartphone className="h-4 w-4" /> Screen 2: Team Owner Bidding App
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Tablet / Phone PWA</span>
              </div>
              <div className="p-2.5 flex-1">
                <ActualTeamBidderView
                  player={currentPlayer}
                  bid={currentBid}
                  leadingTeam={leadingTeam}
                  userTeam={userTeam}
                  status={status}
                  onQuickBid={() => handleRaiseBid(5000)}
                />
              </div>
            </div>

            {/* Screen 3: OBS Broadcast Stream */}
            <div className="rounded-xl border border-white/15 bg-card/60 overflow-hidden shadow-xl flex flex-col">
              <div className="bg-slate-950 px-4 py-2 border-b border-white/10 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-mono font-bold text-rose-400 uppercase tracking-wider">
                  <Video className="h-4 w-4" /> Screen 3: OBS Live Broadcast Overlay
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">YouTube Stream</span>
              </div>
              <div className="p-2.5 flex-1">
                <ActualObsStreamView
                  player={currentPlayer}
                  bid={currentBid}
                  leadingTeam={leadingTeam}
                  status={status}
                />
              </div>
            </div>

            {/* Screen 4: Live Fan Viewer */}
            <div className="rounded-xl border border-white/15 bg-card/60 overflow-hidden shadow-xl flex flex-col">
              <div className="bg-slate-950 px-4 py-2 border-b border-white/10 flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  <Eye className="h-4 w-4" /> Screen 4: Public Fan Viewer Screen
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">Live Fan Stream</span>
              </div>
              <div className="p-2.5 flex-1">
                <ActualFanViewerView
                  player={currentPlayer}
                  bid={currentBid}
                  leadingTeam={leadingTeam}
                  status={status}
                  reactions={reactions}
                  onSendReaction={sendReaction}
                />
              </div>
            </div>
          </div>
        )}

        {/* C. SINGLE SCREEN EXPANDED VIEWS */}
        {activeScreen === "led" && (
          <div className="max-w-5xl mx-auto py-2">
            <ActualLedStageView
              player={currentPlayer}
              bid={currentBid}
              leadingTeam={leadingTeam}
              status={status}
              timer={timerSeconds}
              remainingPurse={leadingTeam.purse - (status === "sold" ? currentBid : 0)}
              large
            />
          </div>
        )}

        {activeScreen === "team" && (
          <div className="max-w-md mx-auto py-2">
            <ActualTeamBidderView
              player={currentPlayer}
              bid={currentBid}
              leadingTeam={leadingTeam}
              userTeam={userTeam}
              status={status}
              onQuickBid={() => handleRaiseBid(5000)}
              large
            />
          </div>
        )}

        {activeScreen === "obs" && (
          <div className="max-w-3xl mx-auto py-2">
            <ActualObsStreamView
              player={currentPlayer}
              bid={currentBid}
              leadingTeam={leadingTeam}
              status={status}
              large
            />
          </div>
        )}

        {activeScreen === "viewer" && (
          <div className="max-w-md mx-auto py-2">
            <ActualFanViewerView
              player={currentPlayer}
              bid={currentBid}
              leadingTeam={leadingTeam}
              status={status}
              reactions={reactions}
              onSendReaction={sendReaction}
              large
            />
          </div>
        )}
      </div>

      {/* ─── MODAL 1: TOP 5 SOLD PLAYERS LEADERBOARD ───────────────────────── */}
      {showTopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-lg rounded-2xl border-2 border-amber-500/40 bg-card/95 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-xl text-foreground">Top 5 Highest Buys</h3>
                  <p className="text-xs text-muted-foreground">Live leaderboard updated from the auction gavel</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTopModal(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {topSold.slice(0, 5).map((record, index) => {
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`;
                return (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-3.5 rounded-xl border transition ${
                      index === 0
                        ? "border-amber-500/50 bg-amber-500/10 text-foreground shadow-md"
                        : "border-white/10 bg-black/40 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-display font-black text-xl w-8 text-center">{medal}</span>
                      <div>
                        <div className="font-display font-bold text-base text-foreground flex items-center gap-2">
                          {record.playerName}
                          {record.isManual && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold">
                              Direct
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{record.role}</span>
                          <span>·</span>
                          <span className="font-semibold text-primary">{record.teamName}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-mono text-muted-foreground block">Sold Price</span>
                      <span className="font-mono text-lg font-black text-amber-300">
                        {record.price.toLocaleString("en-IN")} PT.
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowTopModal(false)}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold"
              >
                Close Leaderboard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: MANUAL SELL / DIRECT ALLOTMENT ────────────────────────── */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="relative w-full max-w-md rounded-2xl border-2 border-primary/40 bg-card/95 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-black text-xl text-foreground">Manual Direct Allotment</h3>
                  <p className="text-xs text-muted-foreground">
                    Assign {currentPlayer.name} directly to a team with a custom price
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  Select Franchise
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setManualTeam(t.id)}
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 transition ${
                        manualTeam === t.id
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-white/10 bg-black/40 text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      <span className="h-7 w-7 rounded-lg bg-black/50 border border-white/15 flex items-center justify-center font-black">
                        {t.shortName}
                      </span>
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2">
                  Agreed Amount (In Points PT.)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={manualPrice}
                    onChange={(e) => setManualPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-white/15 bg-black/60 font-mono text-lg font-black text-foreground focus:outline-none focus:border-primary"
                    placeholder="e.g. 20000"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground font-bold">
                    PT.
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowManualModal(false)}
                className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-muted-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmManualSell}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
              >
                <CheckCircle className="h-4 w-4" />
                Confirm Direct Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// SCREEN 1: ACTUAL STAGE LED DISPLAY (1080p WALL) — 100% REPLICA OF USER SCREENSHOTS
// =============================================================================
function ActualLedStageView({
  player,
  bid,
  leadingTeam,
  status,
  timer,
  remainingPurse,
  large = false,
}: {
  player: DemoPlayer;
  bid: number;
  leadingTeam: DemoTeam;
  status: "active" | "sold" | "unsold";
  timer: number;
  remainingPurse: number;
  large?: boolean;
}) {
  const isSold = status === "sold";
  const isUnsold = status === "unsold";

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-black border-2 border-primary/40 shadow-2xl flex flex-col justify-between select-none aspect-[16/9] w-full min-h-[380px] max-h-[580px]"
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
    >
      {/* ── 1. TOP HEADER BAR (Directly from media_1789806468280.png) ──────── */}
      <div className="bg-black px-3.5 py-2 flex items-center justify-between border-b border-white/10 shrink-0">
        {/* Left: Tournament Name */}
        <div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/50 block leading-none">
            TOURNAMENT
          </span>
          <span className="font-display font-black text-xs sm:text-sm xl:text-base text-white tracking-wide uppercase leading-tight mt-0.5 block">
            BIDWAR PREMIER LEAGUE
          </span>
        </div>

        {/* Center: bidWAR Brand + Status Pill */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center">
            <div className="text-xs sm:text-sm xl:text-base font-display font-black leading-none tracking-tight">
              <span className="text-yellow-400">bid</span>
              <span className="text-white">WAR</span>
            </div>
            <span className="text-[6px] tracking-widest text-white/40 uppercase font-mono">
              FROM AUCTION TO CHAMPION
            </span>
          </div>

          <span className="text-[8px] sm:text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border border-yellow-500/40 text-yellow-400 bg-yellow-500/10 uppercase">
            TRIAL
          </span>

          {isSold || isUnsold ? (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 border border-white/20 text-white font-mono text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">
              <span>STANDBY</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-950/80 border border-red-500/40 text-white font-mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>LIVE · BIDDING OPEN</span>
            </div>
          )}
        </div>

        {/* Right: Players Remaining */}
        <div className="text-right flex items-center gap-2">
          <div>
            <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-white/50 block leading-none">
              PLAYERS REMAINING
            </span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className="font-display font-black text-sm sm:text-base text-white">
                {isSold ? "2/4" : "3/4"}
              </span>
              <span className="h-2 w-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]" />
            </div>
          </div>
          {isSold && (
            <span className="text-[9px] font-mono font-bold text-white/70 pl-2 border-l border-white/10 hidden sm:inline">
              👀 AWAITING
            </span>
          )}
        </div>
      </div>

      {/* ── 2. MAIN 3-COLUMN LAYOUT (Directly from media_1789806468280.png) ──── */}
      <div className="grid grid-cols-[27%_1fr_29%] gap-2 sm:gap-3 p-2.5 sm:p-3.5 items-stretch flex-1 min-h-0 relative overflow-hidden">
        {/* LEFT COLUMN: Player Portrait Frame */}
        <div className="relative rounded-lg border-2 border-white/10 bg-black/80 flex flex-col justify-between overflow-hidden shadow-xl min-w-0">
          {/* Top Yellow Bar Accent */}
          <div className="absolute top-0 left-0 w-8 sm:w-10 h-1 bg-yellow-400 z-10" />

          {/* Top Right Lot # Badge */}
          <div className="absolute top-0 right-0 z-10 w-7 h-7 sm:w-8 sm:h-8 bg-yellow-400 text-black font-display font-black text-xs sm:text-sm flex items-center justify-center">
            #{player.serialNo}
          </div>

          {/* Center Silhouette Avatar */}
          <div className="flex-1 flex items-center justify-center py-3 sm:py-5">
            <User className="h-14 w-14 sm:h-20 sm:w-20 text-white/20 stroke-[1.2]" />
          </div>

          {/* Bottom Player Metadata */}
          <div className="p-2 sm:p-2.5 bg-gradient-to-t from-black via-black/90 to-transparent border-t border-white/5 min-w-0">
            <div className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider mb-0.5 truncate">
              <span className="text-yellow-400">{player.role}</span>
              <span className="text-white/40">·</span>
              <span className="text-white/70">{player.city}</span>
            </div>

            <h3 className="font-display font-black text-xs sm:text-base xl:text-lg text-white tracking-wide uppercase leading-tight truncate" title={player.name}>
              {player.name}
            </h3>

            <div className="mt-1.5 pt-1 border-t border-white/10 text-[8px] sm:text-[9px] font-mono flex items-center justify-between text-white/60">
              <span>AGE: {player.age}</span>
              <span>
                BAT: <strong className="text-yellow-400 font-bold">{player.batStyle}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: Current Bid + Leading Team Card */}
        <div className="flex flex-col items-center justify-center text-center p-2 min-w-0">
          <span className="font-mono text-[9px] sm:text-xs font-black uppercase tracking-[0.2em] text-yellow-400 mb-0.5">
            CURRENT BID
          </span>

          {/* Glowing white bid number */}
          <div className="my-0.5 sm:my-1 font-display font-black text-3xl sm:text-5xl xl:text-6xl text-white tracking-tight drop-shadow-[0_0_25px_rgba(255,255,255,0.4)] leading-none">
            {bid.toLocaleString("en-IN")} PT.
          </div>

          {/* Leading Franchise Card: White box with red left border */}
          <div className="mt-2 sm:mt-3 w-full max-w-[260px] sm:max-w-xs">
            <div className="bg-white text-black flex items-center justify-center gap-2 sm:gap-3 py-1.5 sm:py-2 px-3 shadow-xl relative">
              <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-600" />
              <span className="font-display font-black text-lg sm:text-2xl text-black">
                {leadingTeam.code}
              </span>
              <div className="h-5 sm:h-6 w-px bg-black/25" />
              <span className="font-display font-black text-xs sm:text-sm text-black uppercase tracking-wider truncate">
                {leadingTeam.name}
              </span>
            </div>

            <div className="mt-1.5 sm:mt-2 flex flex-col items-center gap-0.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-600 text-white font-mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-md">
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span>HIGHEST BIDDER</span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-white/60 mt-0.5">
                ● 1 ACTIVE BIDDER
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Hammer Time + Teams Purse + Next Minimum */}
        <div className="flex flex-col justify-between gap-1.5 sm:gap-2 min-w-0">
          {/* Hammer Time Digital Clock */}
          <div className="text-right">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-white/60 block">
              HAMMER TIME
            </span>
            <div className="font-mono font-black text-2xl sm:text-3xl xl:text-4xl text-yellow-400 tracking-wider leading-none mt-0.5 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]">
              {isSold ? "00:00" : `00:${timer < 10 ? `0${timer}` : timer}`}
            </div>
          </div>

          {/* Teams Purse & Max Bid Board */}
          <div className="rounded-lg border border-white/10 bg-black/80 p-2 space-y-1">
            <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-mono font-black uppercase tracking-wider pb-1 border-b border-white/10">
              <span className="text-white flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                TEAMS PURSE & MAX BID
              </span>
              <span className="text-white/40">2 TEAMS</span>
            </div>

            {/* Team T2 (Delhi Devils - Leading) */}
            <div className="p-1 rounded border-l-2 border-red-500 bg-red-950/40 flex items-center justify-between text-[8px] sm:text-[9px] font-mono min-w-0">
              <div className="flex items-center gap-1 truncate">
                <span className="font-bold text-red-400">T2</span>
                <span className="text-white truncate font-bold text-[10px]">DEL</span>
                <span className="text-[8px] font-bold px-1 rounded bg-red-600 text-white">
                  HIGHEST
                </span>
              </div>
              <div className="text-right text-[8px] sm:text-[9px]">
                <div className="text-white font-bold">
                  PURSE <span className="text-red-300">10,00,000 PT.</span>
                </div>
                <div className="text-emerald-400 font-bold">
                  MAX 9,50,000 PT.
                </div>
              </div>
            </div>

            {/* Team T1 (Lucknow Challengers) */}
            <div className="p-1 rounded border-l-2 border-blue-500 bg-blue-950/40 flex items-center justify-between text-[8px] sm:text-[9px] font-mono min-w-0">
              <div className="flex items-center gap-1 truncate">
                <span className="font-bold text-blue-400">T1</span>
                <span className="text-white truncate font-bold text-[10px]">LUC</span>
              </div>
              <div className="text-right text-[8px] sm:text-[9px]">
                <div className="text-white font-bold">
                  PURSE <span className="text-blue-300">9,55,000 PT.</span>
                </div>
                <div className="text-emerald-400 font-bold">
                  MAX 9,15,000 PT.
                </div>
              </div>
            </div>
          </div>

          {/* Next Minimum Box */}
          <div className="rounded-lg border border-white/10 bg-black/90 p-2">
            <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-white/50 block font-bold">
              NEXT MINIMUM
            </span>
            <div className="font-display font-black text-base sm:text-lg xl:text-xl text-yellow-400 tracking-tight leading-none mt-0.5">
              {(bid + 5000).toLocaleString("en-IN")} PT.
            </div>
            <span className="text-[8px] sm:text-[9px] font-mono text-white/70 block mt-0.5">
              INCREMENT +5,000 PT.
            </span>
          </div>
        </div>

        {/* ── 3. SOLD CARD OVERLAY (100% Pixel Match to media_1789806493839.png) ── */}
        {isSold && (
          <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in zoom-in-95 duration-150">
            <div
              className="relative w-full max-w-lg bg-zinc-950 border-4 border-[#ff4d4f] shadow-[0_0_60px_rgba(255,77,79,0.35)] p-4 sm:p-5 select-none"
              style={{ transform: "rotate(-3.5deg)" }}
            >
              {/* Giant Red SOLD Header */}
              <div className="font-display font-black text-5xl sm:text-7xl xl:text-8xl text-[#ff4d4f] text-center leading-[0.85] tracking-tighter drop-shadow-[0_0_20px_rgba(255,77,79,0.5)]">
                SOLD
              </div>

              {/* Middle Section: Photo + Sold details + Team Code Box */}
              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5 mt-2.5">
                {/* Photo cutout box */}
                <div className="w-12 h-16 sm:w-16 sm:h-20 border-2 border-[#ff4d4f] bg-black/60 flex items-center justify-center shrink-0">
                  <User className="h-8 w-8 sm:h-10 sm:w-10 text-white/20" />
                </div>

                {/* Amount, Player Name & Remaining Purse */}
                <div className="flex flex-col items-center text-center min-w-0">
                  <div className="font-display font-black text-xl sm:text-2xl xl:text-3xl text-white tracking-tight leading-tight">
                    {bid.toLocaleString("en-IN")} PT. <span className="text-[#ff4d4f]">➔</span> {leadingTeam.shortName}
                  </div>

                  <div className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider mt-0.5 truncate max-w-full">
                    {player.name} - {leadingTeam.name}
                  </div>

                  <div className="mt-1.5 px-3 py-0.5 rounded-full border border-[#ff4d4f]/60 bg-black/80 flex items-center gap-1.5">
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold text-white/70 uppercase tracking-wider">
                      REMAINING PURSE:
                    </span>
                    <span className="font-mono font-black text-[11px] sm:text-xs text-[#ff4d4f]">
                      {remainingPurse.toLocaleString("en-IN")} PT.
                    </span>
                  </div>
                </div>

                {/* Team Code Red Square Box */}
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#ff4d4f] text-black font-display font-black text-xl sm:text-2xl flex items-center justify-center shrink-0 shadow-lg">
                  {leadingTeam.shortName}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* UNSOLD STAMP OVERLAY */}
        {isUnsold && (
          <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95 duration-150">
            <div
              className="relative w-full max-w-md bg-zinc-950 border-4 border-rose-600 shadow-[0_0_50px_rgba(225,29,72,0.4)] p-5 text-center select-none"
              style={{ transform: "rotate(-3deg)" }}
            >
              <div className="font-display font-black text-5xl sm:text-6xl text-rose-500 leading-none uppercase">
                UNSOLD
              </div>
              <p className="font-display font-black text-base sm:text-lg text-white mt-1.5 uppercase">
                {player.name}
              </p>
              <p className="text-[11px] font-mono text-rose-300 mt-1 uppercase">
                PASSED TO ACCELERATED RECALL POOL
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. BID LADDER STRIP (Directly from media_1789806468280.png) ──────── */}
      <div className="bg-zinc-950 px-3.5 py-1.5 border-t border-white/10 flex items-center gap-3 text-[10px] sm:text-xs font-mono shrink-0">
        <span className="font-bold text-white/60 tracking-wider">BID LADDER</span>
        <div className="flex-1 flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 px-2.5 py-0.5 rounded bg-black/70 border-l-4 border-red-500 text-white font-bold">
            <span className="text-red-400">{leadingTeam.code}</span>
            <span>{leadingTeam.name}</span>
            <span className="text-yellow-400 ml-1.5">{bid.toLocaleString("en-IN")} PT.</span>
          </div>
          <span className="text-white/20">—</span>
          <span className="text-white/20">—</span>
        </div>
      </div>

      {/* ── 5. FOOTER SPONSORS STRIP (Directly from media_1789806468280.png) ─── */}
      <div className="bg-black px-3.5 py-1 border-t border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="bg-yellow-400 text-black font-display font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 uppercase tracking-wider skew-x-[-12deg]">
            OUR SPONSORS
          </div>
          <span className="text-[10px] sm:text-[11px] font-mono text-white/40 tracking-wider uppercase">
            BIDWAR PREMIER LEAGUE
          </span>
        </div>

        <div className="flex items-center gap-1 font-display font-black text-xs">
          <span className="text-yellow-400">bid</span>
          <span className="text-white">WAR</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SCREEN 2: ACTUAL TEAM BIDDER SCREEN (MOBILE/TABLET OWNER PWA)
// =============================================================================
function ActualTeamBidderView({
  player,
  bid,
  leadingTeam,
  userTeam,
  status,
  onQuickBid,
  large = false,
}: {
  player: DemoPlayer;
  bid: number;
  leadingTeam: DemoTeam;
  userTeam: DemoTeam;
  status: "active" | "sold" | "unsold";
  onQuickBid: () => void;
  large?: boolean;
}) {
  const isWinning = leadingTeam.id === userTeam.id;

  return (
    <div
      className={`rounded-xl overflow-hidden bg-slate-900 border-2 border-cyan-500/40 p-4 flex flex-col justify-between shadow-2xl ${
        large ? "min-h-[420px]" : "min-h-[250px]"
      }`}
    >
      {/* 1. Header with Team Name & Connected Badge */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-600 font-display font-black text-white flex items-center justify-center text-xs">
            {userTeam.shortName}
          </div>
          <div>
            <span className="font-display font-black text-sm text-white uppercase block leading-tight">
              {userTeam.name}
            </span>
            <span className="text-[10px] font-mono text-cyan-400 font-bold">FRANCHISE CONSOLE</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono font-bold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>CONNECTED</span>
        </div>
      </div>

      {/* 2. Team Purse & Stats Summary Strip */}
      <div className="my-2 p-2.5 rounded-xl bg-black/50 border border-white/10 grid grid-cols-3 text-center">
        <div>
          <span className="text-[10px] uppercase font-mono text-muted-foreground block">Purse Left</span>
          <span className="font-display font-black text-sm sm:text-base text-emerald-400">
            {userTeam.purse.toLocaleString("en-IN")} PT.
          </span>
        </div>
        <div className="border-x border-white/10">
          <span className="text-[10px] uppercase font-mono text-muted-foreground block">Max Bid</span>
          <span className="font-display font-black text-sm sm:text-base text-amber-400">
            {userTeam.maxBid.toLocaleString("en-IN")} PT.
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-mono text-muted-foreground block">Squad</span>
          <span className="font-display font-black text-sm sm:text-base text-white">
            {userTeam.playersCount}/15
          </span>
        </div>
      </div>

      {/* 3. Real-time Bidding Alert Banner */}
      <div className="my-1">
        {status === "sold" ? (
          <div
            className={`p-2.5 rounded-xl text-center font-bold text-xs ${
              isWinning
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                : "bg-black/60 text-muted-foreground border border-white/10"
            }`}
          >
            {isWinning
              ? `🎉 CONGRATULATIONS! ${player.name} WON FOR ${bid.toLocaleString("en-IN")} PT.`
              : `Lot sold to ${leadingTeam.name} for ${bid.toLocaleString("en-IN")} PT.`}
          </div>
        ) : status === "unsold" ? (
          <div className="p-2.5 rounded-xl text-center font-bold text-xs bg-rose-500/20 text-rose-300 border border-rose-500/40">
            Player Unsold (Passed)
          </div>
        ) : isWinning ? (
          <div className="p-2.5 rounded-xl bg-emerald-500/20 border-2 border-emerald-500/60 text-emerald-300 flex items-center justify-center gap-2 text-xs font-bold animate-pulse">
            <CheckCircle className="h-4 w-4" />
            <span>YOU HOLD HIGHEST BID ({bid.toLocaleString("en-IN")} PT.)</span>
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-amber-500/20 border-2 border-amber-500/60 text-amber-300 flex items-center justify-center gap-2 text-xs font-bold">
            <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
            <span>OUTBID BY {leadingTeam.name.toUpperCase()} ({bid.toLocaleString("en-IN")} PT.)</span>
          </div>
        )}
      </div>

      {/* 4. Active Player Info & Big Bid Button */}
      <div className="pt-2">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">Active Lot: <strong className="text-white font-bold">{player.name}</strong></span>
          <span className="font-mono text-cyan-400 font-bold">Next: {(bid + 5000).toLocaleString("en-IN")} PT.</span>
        </div>

        <button
          type="button"
          disabled={status !== "active" || isWinning}
          onClick={onQuickBid}
          className={`w-full py-3 rounded-xl font-display font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition ${
            isWinning
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-not-allowed"
              : status !== "active"
              ? "bg-white/5 text-muted-foreground border border-white/10 cursor-not-allowed"
              : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-xl shadow-cyan-500/25 active:scale-98"
          }`}
        >
          {isWinning ? (
            <>
              <CheckCircle className="h-4 w-4" /> Leading at {bid.toLocaleString("en-IN")} PT.
            </>
          ) : (
            <>
              <Zap className="h-4 w-4" /> Tap to Bid {(bid + 5000).toLocaleString("en-IN")} PT.
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SCREEN 3: ACTUAL OBS BROADCAST STREAM OVERLAY
// =============================================================================
function ActualObsStreamView({
  player,
  bid,
  leadingTeam,
  status,
  large = false,
}: {
  player: DemoPlayer;
  bid: number;
  leadingTeam: DemoTeam;
  status: "active" | "sold" | "unsold";
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden bg-zinc-950 border-2 border-rose-500/40 relative flex flex-col justify-between shadow-2xl ${
        large ? "aspect-[16/9] min-h-[420px] p-5" : "min-h-[250px] p-3.5"
      }`}
    >
      {/* 1. Simulated Live Broadcast Camera Feed Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-zinc-900 to-slate-950 opacity-95" />

      {/* Top Bar with Live Bug & Tournament Brand */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-red-600 text-white font-mono text-[10px] font-black px-2 py-0.5 rounded shadow">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            <span>LIVE 1080p60</span>
          </div>
          <span className="text-xs font-mono text-white/80 font-bold uppercase">
            BIDWAR OFFICIAL BROADCAST
          </span>
        </div>
        <span className="text-[11px] font-mono text-amber-400 font-bold">
          OFFICIAL STREAM OVERLAY
        </span>
      </div>

      {/* Middle Arena Watermark */}
      <div className="relative z-10 my-auto text-center opacity-30 pointer-events-none">
        <span className="text-4xl">🎙️</span>
        <div className="text-[10px] uppercase font-mono tracking-widest text-white mt-1">
          Live Studio Broadcast
        </div>
      </div>

      {/* 2. ACTUAL TV BROADCAST LOWER-THIRD (Matches ObsLowerThirdScene.tsx) */}
      <div className="relative z-10 space-y-2">
        {status === "sold" ? (
          <div className="rounded-xl border-2 border-emerald-400/60 bg-gradient-to-r from-black/95 via-emerald-950/80 to-emerald-900/60 p-3 text-white shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-emerald-300 font-bold block">
                  BREAKING NEWS · LOT SOLD
                </span>
                <span className="font-display font-black text-base sm:text-lg text-white">
                  {player.name} to {leadingTeam.name}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-muted-foreground block">Sold Price</span>
              <span className="font-display font-black text-xl sm:text-2xl text-emerald-300">
                {bid.toLocaleString("en-IN")} PT.
              </span>
            </div>
          </div>
        ) : status === "unsold" ? (
          <div className="rounded-xl border-2 border-rose-500/60 bg-rose-950/80 p-2.5 text-white shadow-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-rose-400" />
              <span className="font-display font-black text-sm uppercase">PLAYER UNSOLD — {player.name}</span>
            </div>
            <span className="text-xs font-mono font-bold bg-black/40 px-2 py-0.5 rounded">ROUND 1</span>
          </div>
        ) : (
          /* Regular Live Bid Lower-Third */
          <div className="rounded-xl border border-white/20 bg-black/90 backdrop-blur-md p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-xl">
                {player.avatarEmoji}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-display font-black text-base text-white">{player.name}</span>
                  <span className="text-[10px] text-muted-foreground">({player.role})</span>
                </div>
                <div className="text-xs font-mono text-muted-foreground">
                  Leading: <strong className="text-primary font-bold">{leadingTeam.name}</strong>
                </div>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] uppercase font-mono text-muted-foreground block">Current Bid</span>
              <span className="font-display font-black text-xl sm:text-2xl text-yellow-400">
                {bid.toLocaleString("en-IN")} PT.
              </span>
            </div>
          </div>
        )}

        {/* Running Team Ticker Bar */}
        <div className="bg-primary px-3 py-1 rounded-lg text-primary-foreground text-[10px] font-mono flex items-center gap-2 truncate">
          <span className="font-black uppercase bg-black/30 px-1.5 py-0.2 rounded">TICKER:</span>
          <span className="truncate font-semibold">
            {leadingTeam.code} {leadingTeam.name} LEADS WITH {bid.toLocaleString("en-IN")} PT. · T1: 9,55,000 PT. · T3: 12,00,000 PT. · T4: 10,50,000 PT.
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SCREEN 4: ACTUAL PUBLIC FAN VIEWER SCREEN
// =============================================================================
function ActualFanViewerView({
  player,
  bid,
  leadingTeam,
  status,
  reactions,
  onSendReaction,
  large = false,
}: {
  player: DemoPlayer;
  bid: number;
  leadingTeam: DemoTeam;
  status: "active" | "sold" | "unsold";
  reactions: { id: number; emoji: string; left: number }[];
  onSendReaction: (emoji: string) => void;
  large?: boolean;
}) {
  return (
    <div
      className={`rounded-xl overflow-hidden bg-zinc-950 border-2 border-emerald-500/40 p-4 flex flex-col justify-between relative shadow-2xl ${
        large ? "min-h-[420px]" : "min-h-[250px]"
      }`}
    >
      {/* Floating Emojis Overlay */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-20">
        {reactions.map((r) => (
          <span
            key={r.id}
            style={{ left: `${r.left}%` }}
            className="absolute bottom-12 text-3xl animate-in slide-in-from-bottom-6 fade-out duration-1000"
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Fan Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-display font-black text-xs text-white uppercase tracking-wider">
            Public Fan Room
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-emerald-400 font-bold">
          <User className="h-3.5 w-3.5" />
          <span>1,842 Viewing</span>
        </div>
      </div>

      {/* Fan Main View: Shows OutcomeResultPanel when SOLD or live bid log */}
      <div className="my-2 flex-1 flex flex-col justify-center">
        {status === "sold" ? (
          <div className="p-3 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center gap-3">
            <div className="relative h-14 w-14 rounded-lg bg-black/60 border border-emerald-400/50 flex items-center justify-center text-2xl flex-shrink-0">
              {player.avatarEmoji}
              <div
                className="absolute inset-0 flex items-center justify-center font-display font-black text-xs bg-emerald-600 text-white rounded px-1"
                style={{ transform: "rotate(-12deg)" }}
              >
                SOLD
              </div>
            </div>
            <div className="min-w-0">
              <h4 className="font-display font-black text-base text-white truncate">{player.name}</h4>
              <p className="text-xs text-emerald-300 font-semibold truncate">Sold to {leadingTeam.name}</p>
              <p className="font-display font-black text-lg text-amber-400">{bid.toLocaleString("en-IN")} PT.</p>
            </div>
          </div>
        ) : status === "unsold" ? (
          <div className="p-3 rounded-xl bg-rose-500/10 border-2 border-rose-500/40 flex items-center gap-3">
            <div className="relative h-14 w-14 rounded-lg bg-black/60 border border-rose-400/50 flex items-center justify-center text-2xl flex-shrink-0">
              {player.avatarEmoji}
              <div
                className="absolute inset-0 flex items-center justify-center font-display font-black text-[10px] bg-rose-700 text-white rounded px-1"
                style={{ transform: "rotate(-12deg)" }}
              >
                UNSOLD
              </div>
            </div>
            <div className="min-w-0">
              <h4 className="font-display font-black text-base text-white truncate">{player.name}</h4>
              <p className="text-xs text-rose-300">Passed by franchises</p>
            </div>
          </div>
        ) : (
          /* Live Bid Activity Feed */
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-mono text-muted-foreground font-bold">
              Live Bid Feed:
            </span>
            <div className="p-2.5 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold">⚡</span>
                <span className="font-bold text-white">{leadingTeam.name}</span>
              </div>
              <span className="font-mono font-black text-primary text-sm">{bid.toLocaleString("en-IN")} PT.</span>
            </div>
            <div className="p-2 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs text-muted-foreground">
              <span>LUCKNOW CHALLENGERS</span>
              <span className="font-mono">{(bid - 5000 > 0 ? bid - 5000 : 10000).toLocaleString("en-IN")} PT.</span>
            </div>
          </div>
        )}
      </div>

      {/* Fan Cheer Emoji Reactions Bar */}
      <div className="pt-2 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs font-mono text-muted-foreground font-bold">Cheer Live:</span>
        <div className="flex items-center gap-2">
          {["🔥", "🏏", "👏", "💰", "❤️"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onSendReaction(emoji)}
              className="h-8 w-8 rounded-full bg-white/5 hover:bg-white/15 active:scale-125 transition flex items-center justify-center text-base"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
