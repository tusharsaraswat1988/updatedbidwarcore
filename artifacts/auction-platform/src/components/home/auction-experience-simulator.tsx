import { useState, useEffect, useRef } from "react";
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
  CheckCircle,
  XCircle,
  Hourglass,
  Settings2,
  ArrowRight,
  Flame,
  Maximize2,
  Minimize2,
  Sparkles,
  Shield,
} from "lucide-react";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import { getBrandWordmarkSrc, getPublicBrandLogoSrc, getBrandLogoAlt } from "@/lib/brand-assets";
import { BrandLogoImage } from "@/components/brand-logo-image";

// ─── OFFICIAL TOURNAMENT NAME ────────────────────────────────────────────────
export const TOURNAMENT_NAME = "Bidwar Premier League";

// ─── ACTUAL BIDWAR LOGO FROM ADMIN BRANDING ─────────────────────────────────
export function ActualBidwarLogo({ className = "h-6 w-auto object-contain" }: { className?: string }) {
  const { logos, iconVersion, brandName } = usePublicBranding();
  const adminWordmark = getBrandWordmarkSrc(logos, ["mainReverse", "main"]);
  const src =
    adminWordmark ||
    getPublicBrandLogoSrc(["mainReverse", "main"], iconVersion) ||
    "/assets/branding/bidwar-reverse-logo-official.png";

  return (
    <BrandLogoImage
      src={src}
      alt={getBrandLogoAlt(brandName || "BidWar")}
      className={className}
      width={120}
      height={32}
      loading="eager"
      fallback={
        <div className="font-display font-black text-sm text-yellow-400 flex items-center leading-none">
          bid<span className="text-white">WAR</span>
        </div>
      }
    />
  );
}

// ─── 3 REALISTIC FRANCHISE TEAM CREST LOGOS (VECTOR SVG) ────────────────────
const PW_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="pwg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <linearGradient id="pwgold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>
  </defs>
  <polygon points="50,4 94,18 84,76 50,96 16,76 6,18" fill="url(#pwg)" stroke="url(#pwgold)" stroke-width="3.5"/>
  <circle cx="50" cy="46" r="26" fill="#064e3b" stroke="#34d399" stroke-width="1.5"/>
  <path d="M37,35 L63,59 M63,35 L37,59" stroke="#fcd34d" stroke-width="3.5" stroke-linecap="round"/>
  <circle cx="50" cy="47" r="7.5" fill="#ef4444" stroke="#fff" stroke-width="1.5"/>
  <text x="50" y="81" text-anchor="middle" fill="#fbbf24" font-family="'Space Grotesk', system-ui, sans-serif" font-weight="900" font-size="16" letter-spacing="1">PW</text>
</svg>
`)}`;

const DEL_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="delg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ef4444"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </linearGradient>
    <linearGradient id="delfire" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#dc2626"/>
    </linearGradient>
  </defs>
  <polygon points="50,4 94,18 84,76 50,96 16,76 6,18" fill="url(#delg)" stroke="url(#delfire)" stroke-width="3.5"/>
  <circle cx="50" cy="46" r="26" fill="#450a0a" stroke="#f87171" stroke-width="1.5"/>
  <path d="M50,22 C42,32 40,40 45,48 C41,45 38,40 38,36 C32,44 32,56 40,64 C48,72 58,70 62,62 C66,54 62,44 54,38 C56,44 52,48 50,48 C48,46 48,34 50,22 Z" fill="#fbbf24"/>
  <text x="50" y="81" text-anchor="middle" fill="#ffffff" font-family="'Space Grotesk', system-ui, sans-serif" font-weight="900" font-size="15" letter-spacing="1">DEL</text>
</svg>
`)}`;

const LUC_LOGO_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <linearGradient id="lucg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
    <linearGradient id="lucstar" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="100%" stop-color="#fbbf24"/>
    </linearGradient>
  </defs>
  <polygon points="50,4 94,18 84,76 50,96 16,76 6,18" fill="url(#lucg)" stroke="url(#lucstar)" stroke-width="3.5"/>
  <circle cx="50" cy="46" r="26" fill="#0f172a" stroke="#60a5fa" stroke-width="1.5"/>
  <polygon points="50,25 54,38 66,38 56,46 60,58 50,50 40,58 44,46 34,38 46,38" fill="#fbbf24" stroke="#fff" stroke-width="0.8"/>
  <text x="50" y="81" text-anchor="middle" fill="#ffffff" font-family="'Space Grotesk', system-ui, sans-serif" font-weight="900" font-size="15" letter-spacing="1">LUC</text>
</svg>
`)}`;

// ─── TYPES & DATA ────────────────────────────────────────────────────────────

export interface DemoTeam {
  id: string;
  code: string;
  name: string;
  shortName: string;
  city: string;
  color: string;
  purse: number; // in Points
  initialPurse: number;
  maxBid: number;
  playersCount: number;
  logoSvg: string;
}

export interface PlayerSpecifications {
  matches: number;
  runs?: number;
  wickets?: number;
  strikeRate?: number;
  economy?: number;
  speciality: string;
}

export interface DemoPlayer {
  id: string;
  serialNo: number;
  name: string;
  role: string;
  city: string;
  age: string;
  batStyle: string;
  bowlStyle?: string;
  category: string;
  basePrice: number; // in Points
  avatarEmoji: string;
  photoUrl: string;
  specs: PlayerSpecifications;
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

// ─── 3 REALISTIC TEAMS ───────────────────────────────────────────────────────
const TEAMS_DATA: DemoTeam[] = [
  {
    id: "pw",
    code: "PW",
    name: "PITCH WARRIORS",
    shortName: "PW",
    city: "MUMBAI",
    color: "#10b981",
    purse: 1000000,
    initialPurse: 1000000,
    maxBid: 950000,
    playersCount: 0,
    logoSvg: PW_LOGO_SVG,
  },
  {
    id: "t2",
    code: "DEL",
    name: "DELHI DEVILS",
    shortName: "DEL",
    city: "DELHI",
    color: "#ef4444",
    purse: 1000000,
    initialPurse: 1000000,
    maxBid: 950000,
    playersCount: 0,
    logoSvg: DEL_LOGO_SVG,
  },
  {
    id: "t1",
    code: "LUC",
    name: "LUCKNOW CHALLENGERS",
    shortName: "LUC",
    city: "LUCKNOW",
    color: "#2563eb",
    purse: 955000,
    initialPurse: 955000,
    maxBid: 915000,
    playersCount: 1,
    logoSvg: LUC_LOGO_SVG,
  },
];

// ─── 4 DUMMY INDIAN PLAYERS WITH DUMMY PHOTOS & DETAILED SPECS ───────────────
const PLAYERS_QUEUE: DemoPlayer[] = [
  {
    id: "p1",
    serialNo: 1,
    name: "ANKIT SRIVASTAVA",
    role: "ALL-ROUNDER",
    city: "VARANASI",
    age: "26",
    batStyle: "Right-Hand Bat",
    bowlStyle: "Right-Arm Medium Fast",
    category: "GRADE A",
    basePrice: 15000,
    avatarEmoji: "🏏",
    photoUrl: "/assets/players/ankit-head.png",
    specs: {
      matches: 48,
      runs: 1240,
      wickets: 54,
      strikeRate: 142.5,
      speciality: "Middle-Order Finisher & Death Overs",
    },
  },
  {
    id: "p2",
    serialNo: 2,
    name: "MAYANK YADAV",
    role: "FAST BOWLER",
    city: "DELHI",
    age: "22",
    batStyle: "Right-Hand Bat",
    bowlStyle: "Right-Arm Fast (152 km/h)",
    category: "MARQUEE",
    basePrice: 20000,
    avatarEmoji: "⚡",
    photoUrl: "/assets/players/mayank-head.png",
    specs: {
      matches: 32,
      wickets: 49,
      economy: 6.8,
      speciality: "Express Pace & Deadly Yorkers",
    },
  },
  {
    id: "p3",
    serialNo: 3,
    name: "RAJ CHANGRANI",
    role: "OPENING BATSMAN",
    city: "JAIPUR",
    age: "25",
    batStyle: "Left-Hand Bat",
    bowlStyle: "Right-Arm Off Spin",
    category: "MARQUEE",
    basePrice: 25000,
    avatarEmoji: "🔥",
    photoUrl: "/assets/players/top-1.png",
    specs: {
      matches: 64,
      runs: 2180,
      strikeRate: 156.4,
      speciality: "Powerplay Hitter & 100+ Sixes",
    },
  },
  {
    id: "p4",
    serialNo: 4,
    name: "ANUBHAV CHAURASIA",
    role: "WICKET-KEEPER BATSMAN",
    city: "LUCKNOW",
    age: "24",
    batStyle: "Right-Hand Bat",
    bowlStyle: "Wicket-Keeper",
    category: "GRADE A",
    basePrice: 18000,
    avatarEmoji: "🧤",
    photoUrl: "/assets/players/top-2.png",
    specs: {
      matches: 42,
      runs: 1450,
      strikeRate: 138.2,
      speciality: "Clean Gloves & Quick Stumping",
    },
  },
];

const TOP_5_LEADERBOARD = [
  {
    rank: 1,
    name: "RAJ CHANGRANI",
    soldTo: "PITCH WARRIORS",
    price: 1295000,
    pct: 100,
    color: "#10b981",
    photoUrl: "/assets/players/top-1.png",
  },
  {
    rank: 2,
    name: "ANUBHAV CHAURASIA",
    soldTo: "DELHI DEVILS",
    price: 1000000,
    pct: 77,
    color: "#ef4444",
    photoUrl: "/assets/players/top-2.png",
  },
  {
    rank: 3,
    name: "JASPREET SINGH",
    soldTo: "LUCKNOW CHALLENGERS",
    price: 800000,
    pct: 62,
    color: "#3b82f6",
    photoUrl: "/assets/players/top-3.png",
  },
  {
    rank: 4,
    name: "ANKIT SRIVASTAVA",
    soldTo: "PITCH WARRIORS",
    price: 755000,
    pct: 58,
    color: "#10b981",
    photoUrl: "/assets/players/ankit-head.png",
  },
  {
    rank: 5,
    name: "MAYANK YADAV",
    soldTo: "DELHI DEVILS",
    price: 500000,
    pct: 39,
    color: "#ef4444",
    photoUrl: "/assets/players/mayank-head.png",
  },
];

const INITIAL_TOP_5: SoldRecord[] = [
  {
    id: "top-1",
    playerName: "RAJ CHANGRANI",
    role: "ALL-ROUNDER",
    teamCode: "PW",
    teamName: "PITCH WARRIORS",
    teamColor: "#10b981",
    price: 1295000,
    timestamp: "Lot 01",
  },
  {
    id: "top-2",
    playerName: "ANUBHAV CHAURASIA",
    role: "WICKET-KEEPER",
    teamCode: "DEL",
    teamName: "DELHI DEVILS",
    teamColor: "#ef4444",
    price: 1000000,
    timestamp: "Lot 02",
  },
  {
    id: "top-3",
    playerName: "JASPREET SINGH",
    role: "BOWLER",
    teamCode: "LUC",
    teamName: "LUCKNOW CHALLENGERS",
    teamColor: "#3b82f6",
    price: 800000,
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
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "triangle";
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(45, t + 0.25);
      gain.gain.setValueAtTime(0.7, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);

      const chime = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      chime.connect(chimeGain);
      chimeGain.connect(ctx.destination);
      chime.type = "sine";
      chime.frequency.setValueAtTime(587.33, t + 0.08);
      chime.frequency.setValueAtTime(880, t + 0.18);
      chimeGain.gain.setValueAtTime(0.25, t + 0.08);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
      chime.start(t + 0.08);
      chime.stop(t + 0.55);
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
  const [activeScreen, setActiveScreen] = useState<"led" | "viewer" | "obs" | "team">("led");
  const [ledSubView, setLedSubView] = useState<"main" | "top5">("main");
  const [teams, setTeams] = useState<DemoTeam[]>(TEAMS_DATA);
  const [playerIdx, setPlayerIdx] = useState(0);
  const [currentBid, setCurrentBid] = useState<number>(15000);
  const [leadingTeamId, setLeadingTeamId] = useState<string>("t2");
  const [status, setStatus] = useState<"active" | "sold" | "unsold">("active");
  const [timerSeconds, setTimerSeconds] = useState(9);
  const [topSold, setTopSold] = useState<SoldRecord[]>(INITIAL_TOP_5);
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualTeam, setManualTeam] = useState("t2");
  const [manualPrice, setManualPrice] = useState("15000");
  const [muted, setMuted] = useState(false);
  const [reactions, setReactions] = useState<{ id: number; emoji: string; left: number }[]>([]);
  const reactionId = useRef(0);

  const currentPlayer = PLAYERS_QUEUE[playerIdx % PLAYERS_QUEUE.length];
  const leadingTeam = teams.find((t) => t.id === leadingTeamId) || teams[0];
  const userTeam = teams.find((t) => t.id === "pw") || teams[0]; // PW Pitch Warriors

  // Fullscreen support (true hardware fullscreen + full viewport fallback)
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    if (!isFullscreen) {
      setIsFullscreen(true);
      try {
        if (containerRef.current && !document.fullscreenElement) {
          if (containerRef.current.requestFullscreen) {
            await containerRef.current.requestFullscreen();
          }
        }
      } catch {
        // Fallback CSS fixed overlay handles it reliably
      }
    } else {
      setIsFullscreen(false);
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        }
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFullscreen]);

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
  const handleRaiseBid = (increment = 5000, targetTeamId?: string) => {
    if (status !== "active") return;
    const nextAmount = currentBid + increment;
    let nextTeamId = targetTeamId;
    if (!nextTeamId) {
      nextTeamId = leadingTeamId === "t2" ? "t1" : (leadingTeamId === "t1" ? "pw" : "t2");
    }
    setCurrentBid(nextAmount);
    setLeadingTeamId(nextTeamId);
    setTimerSeconds(15);
    sfx.playBid();
  };

  // Dedicated bidder action for Team Bid Screen (Pitch Warriors bids)
  const handleTeamBid = () => {
    if (status !== "active") return;
    const nextAmount = currentBid + 5000;
    setCurrentBid(nextAmount);
    setLeadingTeamId("pw");
    setTimerSeconds(15);
    sfx.playBid();
  };

  // SOLD (Hammer)
  const handleSold = () => {
    if (status !== "active") return;
    setStatus("sold");
    sfx.playSold();

    setTeams((prev) =>
      prev.map((t) => {
        if (t.id === leadingTeamId) {
          return {
            ...t,
            purse: Math.max(0, t.purse - currentBid),
            playersCount: t.playersCount + 1,
            maxBid: Math.max(0, t.purse - currentBid - 10000),
          };
        }
        return t;
      })
    );

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

  // UNSOLD / DEFER
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
            maxBid: Math.max(0, t.purse - finalP - 10000),
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
    setTimerSeconds(9);
    setLedSubView("main");
  };

  // RESET
  const handleReset = () => {
    setTeams(TEAMS_DATA);
    setPlayerIdx(0);
    setCurrentBid(15000);
    setLeadingTeamId("t2");
    setStatus("active");
    setTopSold(INITIAL_TOP_5);
    setTimerSeconds(9);
    setLedSubView("main");
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

  const soldCount = topSold.length;
  const unsoldCount = status === "unsold" ? 1 : 0;
  const leftCount = Math.max(0, PLAYERS_QUEUE.length - playerIdx - (status === "sold" ? 1 : 0));

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? "fixed inset-0 z-[99999] w-screen h-screen bg-[#070913] p-2.5 sm:p-4 overflow-y-auto flex flex-col justify-between"
          : "space-y-2.5"
      }
    >
      {/* Fullscreen Official Tournament Branding Bar */}
      {isFullscreen && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-black/80 border border-white/15 shrink-0">
          <div className="flex items-center gap-3">
            <ActualBidwarLogo className="h-6 w-auto object-contain" />
            <div className="h-4 w-px bg-white/20" />
            <span className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wider">
              Bidwar Premier League
            </span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full hidden sm:inline-block">
              LIVE SIMULATION
            </span>
          </div>
          <div className="text-[10px] font-mono text-white/50">
            Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white font-bold">Esc</kbd> to exit fullscreen
          </div>
        </div>
      )}

      {/* ─── 1. CLEAN SCREEN SELECTOR TABS (NO COMBINATIONS) + FULLSCREEN ACTION ───────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-black/70 border border-white/10 rounded-xl p-1.5 sm:p-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          <span className="text-[10px] font-mono text-white/50 uppercase tracking-widest font-bold mr-1 hidden sm:inline shrink-0">
            SELECT SCREEN:
          </span>
          {[
            { key: "led", label: "Live LED Screen", icon: Tv },
            { key: "viewer", label: "Live Viewer Screen", icon: Smartphone },
            { key: "obs", label: "OBS Live Streaming", icon: Video },
            { key: "team", label: "Team Bid Screen", icon: Eye },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeScreen === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveScreen(item.key as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shrink-0 whitespace-nowrap ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-white/70 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
          {/* Audio Toggle */}
          <button
            type="button"
            onClick={() => setMuted(!muted)}
            title={muted ? "Unmute sound effects" : "Mute sound effects"}
            className={`p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border text-xs transition cursor-pointer flex items-center gap-1 ${
              muted ? "border-white/10 bg-white/5 text-muted-foreground" : "border-primary/40 bg-primary/20 text-primary"
            }`}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span className="hidden md:inline text-[10px] font-mono">{muted ? "MUTED" : "SOUND"}</span>
          </button>

          {/* Reset */}
          <button
            type="button"
            onClick={handleReset}
            title="Reset auction state"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs transition cursor-pointer flex items-center gap-1"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span className="hidden md:inline text-[10px] font-mono">RESET</span>
          </button>

          {/* FULLSCREEN TOGGLE (EXPANDS TO 100% MONITOR / SPLIT VIEWPORT SMOOTHLY) */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen (Esc)" : "Expand Simulator to Full Screen (F11)"}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition cursor-pointer ${
              isFullscreen
                ? "border-amber-400/60 bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                : "border-primary/40 bg-primary/10 hover:bg-primary/20 text-primary"
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span className="text-[10px] sm:text-[11px] font-mono font-black">EXIT FULLSCREEN</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="text-[10px] sm:text-[11px] font-mono font-black">FULLSCREEN</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ─── 2. TWO-COLUMN LAYOUT: SCREEN ON LEFT (68%) + OPERATOR DESK ON RIGHT (32%) ─── */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-stretch ${
          isFullscreen ? "flex-1 min-h-0 my-2" : ""
        }`}
      >
        {/* LEFT COLUMN: THE SELECTED LIVE SCREEN */}
        <div
          className={`lg:col-span-8 flex flex-col justify-center rounded-xl border border-white/15 bg-black overflow-hidden shadow-2xl ${
            isFullscreen
              ? "min-h-[460px] h-full"
              : "min-h-[340px] sm:min-h-[460px] max-h-none sm:max-h-[540px]"
          }`}
        >
          {activeScreen === "led" && (
            ledSubView === "main" ? (
              <ActualLedStageView
                player={currentPlayer}
                bid={currentBid}
                leadingTeam={leadingTeam}
                status={status}
                timer={timerSeconds}
                remainingPurse={leadingTeam.purse - (status === "sold" ? currentBid : 0)}
              />
            ) : (
              <ActualTop5LedView />
            )
          )}

          {activeScreen === "viewer" && (
            <div className="h-full flex items-center justify-center p-2 bg-[#060a14]">
              <div className="w-full max-w-sm h-full">
                <ActualFanViewerView
                  player={currentPlayer}
                  bid={currentBid}
                  leadingTeam={leadingTeam}
                  teams={teams}
                  status={status}
                  reactions={reactions}
                  onSendReaction={sendReaction}
                />
              </div>
            </div>
          )}

          {activeScreen === "obs" && (
            <ActualObsStreamView
              player={currentPlayer}
              bid={currentBid}
              leadingTeam={leadingTeam}
              status={status}
            />
          )}

          {activeScreen === "team" && (
            <div className="h-full flex items-center justify-center p-2 bg-[#080918]">
              <div className="w-full max-w-sm h-full">
                <ActualTeamBidderView
                  player={currentPlayer}
                  bid={currentBid}
                  leadingTeam={leadingTeam}
                  userTeam={userTeam}
                  status={status}
                  timer={timerSeconds}
                  onQuickBid={handleTeamBid}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: THE OPERATOR DESK (DIRECTLY RESEMBLING media_1789817701930.png) */}
        <div className={`lg:col-span-4 flex flex-col ${isFullscreen ? "h-full overflow-y-auto" : ""}`}>
          <OperatorDeskPanel
            player={currentPlayer}
            bid={currentBid}
            status={status}
            teams={teams}
            leadingTeam={leadingTeam}
            timer={timerSeconds}
            soldCount={soldCount}
            unsoldCount={unsoldCount}
            leftCount={leftCount}
            activeScreen={activeScreen}
            ledSubView={ledSubView}
            onSetLedSubView={setLedSubView}
            onSold={handleSold}
            onUnsold={handleUnsold}
            onDefer={handleUnsold}
            onManual={() => {
              setManualPrice(String(currentBid));
              setShowManualModal(true);
            }}
            onNext={handleNextPlayer}
            onRaiseBid={handleRaiseBid}
          />
        </div>
      </div>

      {/* ─── MODAL: MANUAL SELL / DIRECT ALLOTMENT ─────────────────────────── */}
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
                className="rounded-lg p-2 text-muted-foreground hover:bg-white/10 hover:text-foreground text-sm font-bold cursor-pointer"
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
                      className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2.5 transition cursor-pointer ${
                        manualTeam === t.id
                          ? "border-primary bg-primary/20 text-primary"
                          : "border-white/10 bg-black/40 text-muted-foreground hover:bg-white/5"
                      }`}
                    >
                      <span className="h-7 w-7 rounded-lg bg-black/50 border border-white/15 flex items-center justify-center p-1 shrink-0">
                        <img src={t.logoSvg} alt="" className="w-full h-full object-contain" />
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
                className="px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-semibold text-muted-foreground cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmManualSell}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
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
// RIGHT PANEL: OPERATOR CONTROL DESK (MATCHES media_1789817701930.png)
// =============================================================================
function OperatorDeskPanel({
  player,
  bid,
  status,
  teams,
  leadingTeam,
  timer,
  soldCount,
  unsoldCount,
  leftCount,
  activeScreen,
  ledSubView,
  onSetLedSubView,
  onSold,
  onUnsold,
  onDefer,
  onManual,
  onNext,
  onRaiseBid,
}: {
  player: DemoPlayer;
  bid: number;
  status: "active" | "sold" | "unsold";
  teams: DemoTeam[];
  leadingTeam: DemoTeam;
  timer: number;
  soldCount: number;
  unsoldCount: number;
  leftCount: number;
  activeScreen: string;
  ledSubView: "main" | "top5";
  onSetLedSubView: (v: "main" | "top5") => void;
  onSold: () => void;
  onUnsold: () => void;
  onDefer: () => void;
  onManual: () => void;
  onNext: () => void;
  onRaiseBid: (inc: number, targetTeamId?: string) => void;
}) {
  return (
    <div className="rounded-xl border-2 border-blue-500/40 bg-[#0b1329] p-2.5 sm:p-3 flex flex-col justify-between shadow-2xl h-full space-y-2 select-none">
      {/* 1. Top Header */}
      <div>
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-display font-black text-xs text-white uppercase tracking-wider">
              Operator Desk
            </span>
          </div>
          <div className="flex items-center gap-1 text-[9px] font-mono font-bold">
            <span className="text-emerald-400">SOLD {soldCount}</span>
            <span className="text-white/30">·</span>
            <span className="text-rose-400">UNSOLD {unsoldCount}</span>
            <span className="text-white/30">·</span>
            <span className="text-yellow-400">LEFT {leftCount}</span>
          </div>
        </div>

        {/* LED Screen View Switcher: MAIN View vs Top 5 Sold */}
        {activeScreen === "led" && (
          <div className="mt-1.5 flex items-center justify-between p-1 rounded-lg bg-black/60 border border-white/10 text-[10px] font-mono">
            <span className="text-white/50 font-bold uppercase tracking-wider pl-1">LED SCREEN:</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onSetLedSubView("main")}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                  ledSubView === "main" ? "bg-emerald-500 text-black shadow" : "text-white/60 hover:text-white"
                }`}
              >
                MAIN View
              </button>
              <button
                type="button"
                onClick={() => onSetLedSubView("top5")}
                className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                  ledSubView === "top5" ? "bg-amber-500 text-black shadow" : "text-white/60 hover:text-white"
                }`}
              >
                Top 5 Sold
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Active Lot Card (From media_1789817701930.png) */}
      <div className="p-2 rounded-lg bg-[#070c1c] border border-white/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-11 h-13 rounded overflow-hidden border border-white/15 bg-black shrink-0">
            <img
              src={player.photoUrl || "/assets/players/ankit-head.png"}
              alt={player.name}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[10px] font-mono text-yellow-400 font-bold">#{player.serialNo} {player.role}</div>
            <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase truncate">
              {player.name}
            </h4>
            <div className="text-[10px] font-mono text-emerald-400 font-bold mt-0.5">
              BID: {bid.toLocaleString("en-IN")} PT.
            </div>
            <div className="text-[9px] font-mono text-white/50 flex items-center gap-1 truncate">
              <span>Lead:</span>
              <img src={leadingTeam.logoSvg} alt="" className="w-3 h-3 object-contain" />
              <span className="text-white font-bold">{leadingTeam.shortName}</span>
            </div>
          </div>
        </div>

        {/* Countdown Timer Box */}
        <div className="text-right shrink-0 bg-black/60 border border-white/10 px-2 py-1 rounded">
          <span className="text-[8px] font-mono uppercase text-white/40 block">TIMER</span>
          <div className="font-mono font-black text-base text-yellow-400 leading-none">
            00:{timer < 10 ? `0${timer}` : timer}
          </div>
        </div>
      </div>

      {/* 3. Primary Gavel Action Buttons 2x2 Grid (Matches media_1789817701930.png) */}
      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-1.5">
          {/* SOLD Button */}
          <button
            type="button"
            disabled={status !== "active"}
            onClick={onSold}
            className="py-2.5 px-2 rounded-lg bg-[#063b2f] hover:bg-[#074b3c] border-2 border-emerald-500 text-emerald-300 font-display font-black text-xs uppercase tracking-wider flex flex-col items-center justify-center transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-lg"
          >
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" />
              <span>SOLD</span>
            </div>
            <span className="text-[8px] font-mono text-emerald-300/80">Bid first [S]</span>
          </button>

          {/* UNSOLD Button */}
          <button
            type="button"
            disabled={status !== "active"}
            onClick={onUnsold}
            className="py-2.5 px-2 rounded-lg bg-[#3b0b14] hover:bg-[#4b0e1a] border-2 border-rose-500 text-rose-300 font-display font-black text-xs uppercase tracking-wider flex flex-col items-center justify-center transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-lg"
          >
            <div className="flex items-center gap-1">
              <XCircle className="h-3.5 w-3.5" />
              <span>UNSOLD</span>
            </div>
            <span className="text-[8px] font-mono text-rose-300/80">No bid [U]</span>
          </button>

          {/* DEFER Button */}
          <button
            type="button"
            disabled={status !== "active"}
            onClick={onDefer}
            className="py-2.5 px-2 rounded-lg bg-[#3b2b06] hover:bg-[#4b3707] border-2 border-amber-500 text-amber-300 font-display font-black text-xs uppercase tracking-wider flex flex-col items-center justify-center transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-lg"
          >
            <div className="flex items-center gap-1">
              <Hourglass className="h-3.5 w-3.5" />
              <span>DEFER</span>
            </div>
            <span className="text-[8px] font-mono text-amber-300/80">Return pool [D]</span>
          </button>

          {/* SELL MANUALLY Button */}
          <button
            type="button"
            disabled={status !== "active"}
            onClick={onManual}
            className="py-2.5 px-2 rounded-lg bg-[#25103b] hover:bg-[#32164f] border-2 border-purple-500 text-purple-300 font-display font-black text-xs uppercase tracking-wider flex flex-col items-center justify-center transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-lg"
          >
            <div className="flex items-center gap-1">
              <Settings2 className="h-3.5 w-3.5" />
              <span>MANUAL</span>
            </div>
            <span className="text-[8px] font-mono text-purple-300/80">Set amount [M]</span>
          </button>
        </div>

        {/* NEXT PLAYER (Prominent Gold Button) */}
        <button
          type="button"
          onClick={onNext}
          className="w-full py-2 rounded-lg bg-[#634a06] hover:bg-[#785907] border-2 border-amber-400 text-amber-200 font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition active:scale-98 cursor-pointer shadow-md"
        >
          <span>NEXT PLAYER (Random)</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 4. Quick Bid Row */}
      <div className="p-1.5 rounded-lg bg-[#070c1c] border border-white/5 space-y-1">
        <div className="flex items-center justify-between text-[9px] font-mono text-white/50 font-bold uppercase">
          <span>QUICK BID</span>
          <span className="text-yellow-400">NEXT: {(bid + 5000).toLocaleString("en-IN")} PT.</span>
        </div>
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            disabled={status !== "active"}
            onClick={() => onRaiseBid(5000, "t2")}
            className="px-1.5 py-1.5 rounded bg-black/60 hover:bg-black/90 border border-red-500/40 text-red-200 text-[9px] sm:text-[10px] font-mono font-bold transition cursor-pointer disabled:opacity-30 truncate"
          >
            +5k (DEL)
          </button>
          <button
            type="button"
            disabled={status !== "active"}
            onClick={() => onRaiseBid(10000, "t1")}
            className="px-1.5 py-1.5 rounded bg-black/60 hover:bg-black/90 border border-blue-500/40 text-blue-200 text-[9px] sm:text-[10px] font-mono font-bold transition cursor-pointer disabled:opacity-30 truncate"
          >
            +10k (LUC)
          </button>
          <button
            type="button"
            disabled={status !== "active"}
            onClick={() => onRaiseBid(5000, "pw")}
            className="px-1.5 py-1.5 rounded bg-black/60 hover:bg-black/90 border border-emerald-500/40 text-emerald-200 text-[9px] sm:text-[10px] font-mono font-bold transition cursor-pointer disabled:opacity-30 truncate"
          >
            +5k (PW)
          </button>
        </div>
      </div>

      {/* 5. TEAMS & PURSE Tracker (From media_1789817701930.png right section) */}
      <div className="p-1.5 rounded-lg bg-[#070c1c] border border-white/5 space-y-1">
        <span className="text-[9px] font-mono uppercase tracking-wider text-white/50 block font-bold">
          TEAMS & PURSE (3 TEAMS)
        </span>
        <div className="space-y-1 text-[9px] font-mono">
          {teams.slice(0, 3).map((t) => (
            <div
              key={t.id}
              className={`px-2 py-1 rounded flex items-center justify-between ${
                t.id === leadingTeam.id && status === "active"
                  ? "bg-red-950/60 border border-red-500/40 text-white"
                  : "bg-black/40 border border-white/5 text-white/70"
              }`}
            >
              <span className="font-bold flex items-center gap-1.5 min-w-0">
                <img src={t.logoSvg} alt="" className="w-3.5 h-3.5 object-contain shrink-0" />
                <span className="truncate">{t.code} {t.shortName}</span>
              </span>
              <div className="text-right">
                <span className="text-white font-bold">{t.purse.toLocaleString("en-IN")} PT.</span>
                <span className="text-[8px] text-emerald-400 block">MAX {t.maxBid.toLocaleString("en-IN")}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SCREEN 1: ACTUAL STAGE LED DISPLAY (1080p WALL) — MATCHES media_1789816747528.png
// =============================================================================
function ActualLedStageView({
  player,
  bid,
  leadingTeam,
  status,
  timer,
  remainingPurse,
}: {
  player: DemoPlayer;
  bid: number;
  leadingTeam: DemoTeam;
  status: "active" | "sold" | "unsold";
  timer: number;
  remainingPurse: number;
}) {
  const isSold = status === "sold";
  const isUnsold = status === "unsold";

  return (
    <div
      className="relative rounded-xl overflow-hidden bg-black border-2 border-primary/40 shadow-2xl flex flex-col justify-between select-none aspect-[16/9] w-full min-h-[380px] max-h-[540px]"
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
    >
      {/* Top Header Bar */}
      <div className="bg-black px-3.5 py-2 flex items-center justify-between border-b border-white/10 shrink-0">
        <div>
          <span className="text-[9px] font-mono uppercase tracking-widest text-white/50 block leading-none">
            TOURNAMENT
          </span>
          <span className="font-display font-black text-xs sm:text-sm xl:text-base text-white tracking-wide uppercase leading-tight mt-0.5 block">
            BIDWAR PREMIER LEAGUE
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center">
            <ActualBidwarLogo className="h-5 sm:h-6 w-auto object-contain" />
            <span className="text-[6px] tracking-widest text-white/40 uppercase font-mono mt-0.5">
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

      {/* Main 3-Column Layout */}
      <div className="grid grid-cols-[27%_1fr_29%] gap-2 sm:gap-3 p-2.5 sm:p-3.5 items-stretch flex-1 min-h-0 relative overflow-hidden">
        {/* LEFT COLUMN: Player Portrait Frame */}
        <div className="relative rounded-lg border-2 border-white/10 bg-black/80 flex flex-col justify-between overflow-hidden shadow-xl min-w-0">
          <div className="absolute top-0 left-0 w-8 sm:w-10 h-1 bg-yellow-400 z-10" />
          <div className="absolute top-0 right-0 z-10 w-7 h-7 sm:w-8 sm:h-8 bg-yellow-400 text-black font-display font-black text-xs sm:text-sm flex items-center justify-center">
            #{player.serialNo}
          </div>

          <div className="flex-1 relative overflow-hidden bg-gradient-to-b from-black/40 via-black/20 to-black flex items-center justify-center min-h-[140px] max-h-[220px]">
            <img
              src={player.photoUrl || "/assets/players/ankit-head.png"}
              alt={player.name}
              className="w-full h-full object-cover object-top"
            />
          </div>

          <div className="p-2 sm:p-2.5 bg-gradient-to-t from-black via-black/95 to-transparent border-t border-white/10 min-w-0 z-10">
            <div className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider mb-0.5 truncate">
              <span className="text-yellow-400">{player.role}</span>
              <span className="text-white/40">·</span>
              <span className="text-white/80">{player.city}</span>
            </div>

            <h3 className="font-display font-black text-xs sm:text-base xl:text-lg text-white tracking-wide uppercase leading-tight truncate" title={player.name}>
              {player.name}
            </h3>

            <div className="mt-1 pt-1 border-t border-white/10 text-[8px] sm:text-[9px] font-mono flex items-center justify-between text-white/70">
              <span>AGE: {player.age}</span>
              <span>
                BOWL: <strong className="text-yellow-400 font-bold">{player.bowlStyle || "Medium"}</strong>
              </span>
              <span>
                BAT: <strong className="text-white font-bold">{player.batStyle}</strong>
              </span>
            </div>

            {player.specs && (
              <div className="mt-1 pt-0.5 border-t border-white/10 text-[7px] sm:text-[8px] font-mono text-cyan-300 flex items-center justify-between">
                <span>{player.specs.matches} M · {player.specs.runs ? `${player.specs.runs} R` : ""}{player.specs.wickets ? ` · ${player.specs.wickets} W` : ""}</span>
                <span>{player.specs.strikeRate ? `SR ${player.specs.strikeRate}` : player.specs.economy ? `Eco ${player.specs.economy}` : ""}</span>
              </div>
            )}
          </div>
        </div>

        {/* CENTER COLUMN: Current Bid + Leading Team Card */}
        <div className="flex flex-col items-center justify-center text-center p-2 min-w-0">
          <span className="font-mono text-[9px] sm:text-xs font-black uppercase tracking-[0.2em] text-yellow-400 mb-0.5">
            CURRENT BID
          </span>

          <div className="my-0.5 sm:my-1 font-display font-black text-3xl sm:text-5xl xl:text-6xl text-white tracking-tight drop-shadow-[0_0_25px_rgba(255,255,255,0.4)] leading-none">
            {bid.toLocaleString("en-IN")} PT.
          </div>

          <div className="mt-2 sm:mt-3 w-full max-w-[260px] sm:max-w-xs">
            <div className="bg-white text-black flex items-center justify-center gap-2 sm:gap-2.5 py-1.5 sm:py-2 px-3 shadow-xl relative rounded-sm">
              <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: leadingTeam.color }} />
              {leadingTeam.logoSvg && (
                <img src={leadingTeam.logoSvg} alt={leadingTeam.name} className="w-6 h-6 object-contain" />
              )}
              <span className="font-display font-black text-lg sm:text-2xl text-black">
                {leadingTeam.code}
              </span>
              <div className="h-5 sm:h-6 w-px bg-black/25" />
              <span className="font-display font-black text-xs sm:text-sm text-black uppercase tracking-wider truncate">
                {leadingTeam.name}
              </span>
            </div>

            <div className="mt-1.5 sm:mt-2 flex flex-col items-center gap-0.5">
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-white font-mono text-[9px] sm:text-[10px] font-black uppercase tracking-wider shadow-md" style={{ backgroundColor: leadingTeam.color }}>
                <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                <span>HIGHEST BIDDER</span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-white/60 mt-0.5">
                ● {leadingTeam.city} FRANCHISE
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Hammer Time + Teams Purse + Next Minimum */}
        <div className="flex flex-col justify-between gap-1.5 sm:gap-2 min-w-0">
          <div className="text-right">
            <span className="text-[9px] font-mono font-black uppercase tracking-widest text-white/60 block">
              HAMMER TIME
            </span>
            <div className="font-mono font-black text-2xl sm:text-3xl xl:text-4xl text-yellow-400 tracking-wider leading-none mt-0.5 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]">
              {isSold ? "00:00" : `00:${timer < 10 ? `0${timer}` : timer}`}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-black/80 p-2 space-y-1">
            <div className="flex items-center justify-between text-[8px] sm:text-[9px] font-mono font-black uppercase tracking-wider pb-1 border-b border-white/10">
              <span className="text-white flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                TEAMS PURSE & MAX BID
              </span>
              <span className="text-white/40">3 TEAMS</span>
            </div>

            {TEAMS_DATA.map((t) => {
              const isLead = t.id === leadingTeam.id;
              return (
                <div
                  key={t.id}
                  className={`p-1 rounded border-l-2 flex items-center justify-between text-[8px] sm:text-[9px] font-mono min-w-0 ${
                    isLead ? "bg-white/10 text-white" : "bg-black/40 text-white/70"
                  }`}
                  style={{ borderLeftColor: t.color }}
                >
                  <div className="flex items-center gap-1 truncate">
                    <img src={t.logoSvg} alt={t.name} className="w-3.5 h-3.5 object-contain" />
                    <span className="font-bold text-white text-[10px]">{t.shortName}</span>
                    {isLead && (
                      <span className="text-[7px] font-bold px-1 rounded bg-red-600 text-white">
                        HIGHEST
                      </span>
                    )}
                  </div>
                  <div className="text-right text-[8px] sm:text-[9px]">
                    <div className="text-white font-bold">
                      PURSE <span style={{ color: t.color }}>{(t.purse / 100000).toFixed(2)}L PT.</span>
                    </div>
                    <div className="text-emerald-400 font-bold">
                      MAX {(t.maxBid / 100000).toFixed(2)}L
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

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

        {/* SOLD CARD OVERLAY */}
        {isSold && (
          <div className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in zoom-in-95 duration-150">
            <div
              className="relative w-full max-w-lg bg-zinc-950 border-4 border-[#ff4d4f] shadow-[0_0_60px_rgba(255,77,79,0.35)] p-4 sm:p-5 select-none"
              style={{ transform: "rotate(-3.5deg)" }}
            >
              <div className="font-display font-black text-5xl sm:text-7xl xl:text-8xl text-[#ff4d4f] text-center leading-[0.85] tracking-tighter drop-shadow-[0_0_20px_rgba(255,77,79,0.5)]">
                SOLD
              </div>

              <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5 mt-2.5">
                <div className="w-12 h-16 sm:w-16 sm:h-20 border-2 border-[#ff4d4f] bg-black/60 overflow-hidden shrink-0">
                  <img
                    src={player.photoUrl || "/assets/players/ankit-head.png"}
                    alt={player.name}
                    className="w-full h-full object-cover object-top"
                  />
                </div>

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

      {/* Bid Ladder Strip */}
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

      {/* Footer Sponsors Strip */}
      <div className="bg-black px-3.5 py-1 border-t border-white/10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
          <div className="bg-yellow-400 text-black font-display font-black text-[9px] sm:text-[10px] px-2 py-0.5 uppercase tracking-wider skew-x-[-12deg] shrink-0">
            OUR SPONSORS
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-[9px] sm:text-[10px] font-mono text-white/70 tracking-wider uppercase shrink-0">
            <span className="font-bold text-white bg-white/10 px-1.5 py-0.2 rounded">I SCHOOL</span>
            <span className="font-bold text-white bg-white/10 px-1.5 py-0.2 rounded">DHAMMAWAT GEMS</span>
            <span className="font-bold text-white bg-white/10 px-1.5 py-0.2 rounded">KV TechMedia</span>
            <span className="font-bold text-amber-300 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.2 rounded">TITLE SPONSOR</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0 pl-2">
          <ActualBidwarLogo className="h-4 w-auto object-contain" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SUB-SCREEN 1B: TOP 5 PLAYERS SOLD ON LED WALL (MATCHES media_1789817965850.png)
// =============================================================================
function ActualTop5LedView() {
  return (
    <div
      className="relative rounded-xl overflow-hidden bg-black border-2 border-primary/40 shadow-2xl flex flex-col justify-between select-none aspect-[16/9] w-full min-h-[380px] max-h-[540px]"
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
    >
      {/* 1. Header */}
      <div className="bg-black px-3.5 py-2 flex items-center justify-between border-b border-white/10 shrink-0">
        <div>
          <span className="text-[8px] font-mono uppercase tracking-widest text-white/50 block leading-none">
            TOURNAMENT
          </span>
          <span className="font-display font-black text-xs sm:text-sm text-white tracking-wide uppercase leading-tight mt-0.5 block">
            BIDWAR PREMIER LEAGUE
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <ActualBidwarLogo className="h-5 sm:h-6 w-auto object-contain" />
        </div>

        <div className="text-right">
          <span className="text-[8px] font-mono uppercase tracking-widest text-white/50 block leading-none">
            HIGHEST BIDS
          </span>
          <span className="font-display font-black text-xs sm:text-sm text-yellow-400 tracking-wide uppercase leading-tight mt-0.5 block">
            TOP 5 PLAYERS SOLD
          </span>
        </div>
      </div>

      {/* 2. Top 5 List Rows */}
      <div className="flex-1 p-2 sm:p-3 flex flex-col justify-around gap-1 min-h-0 bg-gradient-to-b from-black via-zinc-950 to-black">
        {TOP_5_LEADERBOARD.map((item) => (
          <div
            key={item.rank}
            className="flex items-center justify-between gap-2.5 px-2.5 py-1 rounded bg-black/60 border border-white/5 relative overflow-hidden"
          >
            {/* Left: Rank Number + Photo + Player details */}
            <div className="flex items-center gap-2.5 min-w-0 z-10">
              <span
                className="font-display font-black text-xl sm:text-2xl w-6 text-center leading-none"
                style={{ color: item.color }}
              >
                {item.rank}
              </span>
              <div className="w-9 h-10 rounded overflow-hidden border border-white/15 bg-zinc-900 shrink-0">
                <img src={item.photoUrl} alt={item.name} className="w-full h-full object-cover object-top" />
              </div>
              <div className="min-w-0 leading-tight">
                <h4 className="font-display font-black text-xs sm:text-sm text-white uppercase tracking-wide truncate">
                  {item.name}
                </h4>
                <div className="text-[9px] font-mono text-white/60 uppercase truncate">
                  SOLD TO — <strong className="text-white font-bold">{item.soldTo}</strong>
                </div>
              </div>
            </div>

            {/* Right: Price */}
            <div className="text-right z-10 shrink-0">
              <div
                className="font-display font-black text-sm sm:text-base tracking-tight leading-none"
                style={{ color: item.color }}
              >
                {item.price.toLocaleString("en-IN")} PT.
              </div>
            </div>

            {/* Horizontal progress bar underline */}
            <div
              className="absolute bottom-0 left-0 h-[2.5px] opacity-80"
              style={{ width: `${item.pct}%`, backgroundColor: item.color }}
            />
          </div>
        ))}
      </div>

      {/* 3. Footer Sponsors */}
      <div className="bg-black px-3.5 py-1 border-t border-white/10 flex items-center justify-between shrink-0 text-[8px] sm:text-[9px] font-mono">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div className="bg-yellow-400 text-black font-display font-black px-2 py-0.2 uppercase tracking-wider skew-x-[-12deg] shrink-0">
            OUR SPONSORS
          </div>
          <span className="text-white/80 bg-white/10 px-1.5 py-0.2 rounded shrink-0">KUBER GLASS & PLYWOOD</span>
          <span className="text-white/80 bg-white/10 px-1.5 py-0.2 rounded shrink-0">AALISHAN ZAIKA</span>
          <span className="text-white/80 bg-white/10 px-1.5 py-0.2 rounded shrink-0">ADMAIRA PEST CONTROL</span>
        </div>
        <div className="flex items-center gap-1.5 pl-2 shrink-0">
          <span className="text-white/40 text-[8px] uppercase tracking-widest">POWERED BY</span>
          <ActualBidwarLogo className="h-3 w-auto object-contain opacity-70" />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SCREEN 2: ACTUAL OBS BROADCAST STREAM OVERLAY (MATCHES media_1789817126323.png)
// =============================================================================
function ActualObsStreamView({
  player,
  bid,
  leadingTeam,
  status,
}: {
  player: DemoPlayer;
  bid: number;
  leadingTeam: DemoTeam;
  status: "active" | "sold" | "unsold";
}) {
  return (
    <div
      className="relative rounded-xl overflow-hidden bg-black border-2 border-primary/40 shadow-2xl flex flex-col justify-between select-none aspect-[16/9] w-full min-h-[380px] max-h-[540px]"
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
    >
      {/* Top Bar: Center logo + Right jersey sponsor */}
      <div className="absolute top-2 left-0 right-0 z-20 px-4 flex items-center justify-between pointer-events-none">
        <div className="w-24" />

        <div className="flex flex-col items-center bg-black/85 backdrop-blur-xs px-4 py-1.5 rounded-md border border-white/15 shadow-lg">
          <ActualBidwarLogo className="h-5 w-auto object-contain" />
          <span className="text-[8px] font-mono tracking-widest text-yellow-400 font-bold uppercase mt-0.5">
            BIDWAR PREMIER LEAGUE
          </span>
        </div>

        <div className="bg-black/80 border border-white/15 px-2.5 py-1 rounded text-right shadow-lg">
          <span className="text-[8px] font-mono text-white font-bold block uppercase leading-none">
            DHAMMAWAT GEMS AND JEWELLERS
          </span>
          <span className="text-[7px] font-mono text-amber-400 block tracking-wider uppercase mt-0.5">
            JERSEY SPONSOR
          </span>
        </div>
      </div>

      {/* Middle: Simulated Broadcast Camera Feed (White space is camera feed!) */}
      <div className="relative flex-1 bg-slate-900 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-t from-black via-zinc-900/90 to-slate-950" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px]" />

        <div className="relative z-10 flex flex-col items-center justify-center opacity-40 select-none">
          <Video className="h-10 w-10 text-white/50 animate-pulse" />
          <span className="text-[10px] font-mono text-white/70 tracking-[0.25em] uppercase mt-2 font-bold">
            ● LIVE CAMERA FEED (OBS 1080p60)
          </span>
        </div>
      </div>

      {/* Bottom TV Broadcast Lower-Third (Directly from media_1789817126323.png) */}
      <div className="relative z-20 border-t-2 border-yellow-400 bg-black/95 shadow-2xl shrink-0">
        <div className="px-3 py-2 flex items-center justify-between gap-3">
          {/* Left: Yellow angled badge + Player details */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="relative w-12 h-14 sm:w-14 sm:h-16 border-2 border-yellow-400 bg-black/80 overflow-hidden shrink-0 shadow-lg"
              style={{ clipPath: "polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)" }}
            >
              <img
                src={player.photoUrl || "/assets/players/ankit-head.png"}
                alt={player.name}
                className="w-full h-full object-cover object-top"
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>LIVE AUCTION</span>
              </div>
              <h3 className="font-display font-black text-sm sm:text-base xl:text-lg text-white tracking-wide uppercase leading-tight truncate">
                {player.name}
              </h3>
              <div className="text-[9px] sm:text-[10px] font-mono text-white/60">
                {player.role} <span className="text-white/40">·</span> {player.city}
              </div>
              {player.specs && (
                <div className="text-[8px] sm:text-[9px] font-mono text-cyan-300 font-bold truncate mt-0.5">
                  {player.specs.matches} M · {player.specs.runs ? `${player.specs.runs} R · ` : ""}{player.specs.wickets ? `${player.specs.wickets} W · ` : ""}{player.specs.speciality}
                </div>
              )}
              <div className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-yellow-400/20 border border-yellow-400/40 text-[8px] sm:text-[9px] font-mono font-bold text-yellow-300 mt-0.5">
                ● BASE VALUE {player.basePrice.toLocaleString("en-IN")} Pt.
              </div>
            </div>
          </div>

          {/* Center: Team status pills */}
          <div className="hidden sm:flex flex-col items-center gap-1 shrink-0">
            <div className="flex items-center gap-2 text-[9px] font-mono">
              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                <img src={PW_LOGO_SVG} alt="PW" className="w-3 h-3 object-contain" />
                PITCH WARRIORS
              </span>
              <span className="text-blue-400 flex items-center gap-1 font-bold">
                <img src={LUC_LOGO_SVG} alt="LUC" className="w-3 h-3 object-contain" />
                LUCKNOW CH.
              </span>
              <span className="text-red-400 flex items-center gap-1 font-bold">
                <img src={DEL_LOGO_SVG} alt="DEL" className="w-3 h-3 object-contain" />
                DELHI DEVILS
              </span>
            </div>
            {status === "sold" && (
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-[9px] font-mono font-bold text-emerald-300 uppercase flex items-center gap-1">
                <img src={leadingTeam.logoSvg} alt="" className="w-3 h-3 object-contain" />
                <span>LOT SOLD TO {leadingTeam.name}</span>
              </span>
            )}
          </div>

          {/* Right: Opening/Current Bid */}
          <div className="text-right shrink-0">
            <span className="text-[8px] sm:text-[9px] font-mono text-white/50 uppercase tracking-wider block font-bold">
              {status === "sold" ? "FINAL SOLD PRICE" : "CURRENT BID"}
            </span>
            <div className="font-display font-black text-xl sm:text-3xl text-white tracking-tight leading-none drop-shadow-[0_0_15px_rgba(255,255,255,0.4)]">
              {bid.toLocaleString("en-IN")} PT.
            </div>
            <div className="flex items-center justify-end gap-1 text-[8px] sm:text-[9px] font-mono text-yellow-400 mt-0.5">
              <img src={leadingTeam.logoSvg} alt="" className="w-3.5 h-3.5 object-contain" />
              <span>{status === "sold" ? `Sold to ${leadingTeam.shortName}` : `Leading: ${leadingTeam.name}`}</span>
            </div>
          </div>
        </div>

        {/* Sponsor Ticker */}
        <div className="bg-zinc-950 px-3 py-1 border-t border-white/10 text-[8px] sm:text-[9px] font-mono text-white/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-white font-bold">JEWELLERS (JERSEY SPONSOR)</span>
          <span>•</span>
          <span className="text-white font-bold">I SCHOOL (CO SPONSOR)</span>
          <span>•</span>
          <div className="flex items-center gap-1 text-yellow-400 font-bold shrink-0">
            <span>Powered by</span>
            <ActualBidwarLogo className="h-3 w-auto object-contain" />
          </div>
          <span>•</span>
          <span className="text-white font-bold">KV TECH MEDIA (DIGITAL MEDIA SPONSOR)</span>
          <span>•</span>
          <span className="text-white font-bold">DHAMMAWAT GEMS AND JEWELLERS (JERSEY SPONSOR)</span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// SCREEN 3: ACTUAL PUBLIC FAN VIEWER SCREEN (MATCHES media_1789816565583.png)
// =============================================================================
function ActualFanViewerView({
  player,
  bid,
  leadingTeam,
  teams,
  status,
  reactions,
  onSendReaction,
}: {
  player: DemoPlayer;
  bid: number;
  leadingTeam: DemoTeam;
  teams: DemoTeam[];
  status: "active" | "sold" | "unsold";
  reactions: { id: number; emoji: string; left: number }[];
  onSendReaction: (emoji: string) => void;
}) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-[#070b14] border-2 border-blue-500/30 p-2.5 sm:p-3 flex flex-col justify-between select-none shadow-2xl h-full"
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
    >
      {/* Floating Reactions */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden z-30">
        {reactions.map((r) => (
          <span
            key={r.id}
            style={{ left: `${r.left}%` }}
            className="absolute bottom-14 text-3xl animate-in slide-in-from-bottom-6 fade-out duration-1000"
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Top Bar */}
      <div className="flex items-center justify-between pb-1.5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600 text-white font-mono text-[9px] font-black uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            LIVE
          </span>
          <Volume2 className="h-3.5 w-3.5 text-white/70" />
        </div>

        <div className="flex items-center gap-1.5">
          <ActualBidwarLogo className="h-4 sm:h-5 w-auto object-contain" />
          <span className="text-[9px] sm:text-[10px] font-mono text-yellow-400 font-bold uppercase tracking-wide">
            BIDWAR PREMIER LEAGUE
          </span>
        </div>
      </div>

      {/* Summary Chips */}
      <div className="flex items-center justify-between px-1 py-1 my-1 text-[9px] sm:text-[10px] font-mono font-bold shrink-0 bg-black/40 rounded border border-white/5">
        <span className="text-emerald-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          {status === "sold" ? "2" : "1"} SOLD
        </span>
        <span className="text-yellow-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
          {status === "sold" ? "2" : "3"} LEFT
        </span>
        <span className="text-rose-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          {status === "unsold" ? "1" : "0"} UNSOLD
        </span>
        <span className="text-purple-400 flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-purple-400" />
          0 RETAINED
        </span>
      </div>

      {/* Player Card */}
      <div className="relative rounded-xl bg-gradient-to-br from-[#0c2445] via-[#08182f] to-[#040c17] border border-blue-500/40 p-2.5 shadow-lg shrink-0">
        <div className="flex items-start gap-2.5">
          <div className="relative w-14 h-18 sm:w-16 sm:h-20 rounded-lg overflow-hidden border border-blue-400/40 bg-black/60 shrink-0">
            <div className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full bg-yellow-400 text-black font-display font-black text-[10px] flex items-center justify-center shadow-md">
              #{player.serialNo}
            </div>
            <img
              src={player.photoUrl || "/assets/players/ankit-head.png"}
              alt={player.name}
              className="w-full h-full object-cover object-top"
            />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="font-display font-black text-sm sm:text-base text-white tracking-wide truncate">
              {player.name}
            </h4>

            <div className="flex flex-wrap items-center gap-1 my-1">
              <span className="px-1.5 py-0.5 rounded bg-black/60 border border-blue-500/30 text-[9px] font-mono text-cyan-300 font-bold">
                {player.role === "BOWLER" ? "Bowler" : player.role}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-black/60 border border-blue-500/30 text-[9px] font-mono text-cyan-300 font-bold">
                {player.batStyle}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-black/60 border border-blue-500/30 text-[9px] font-mono text-cyan-300 font-bold">
                {player.city}
              </span>
            </div>

            {player.specs && (
              <div className="text-[8px] sm:text-[9px] font-mono text-cyan-300 font-bold truncate my-0.5">
                {player.specs.matches} M · {player.specs.runs ? `${player.specs.runs} R · ` : ""}{player.specs.wickets ? `${player.specs.wickets} W · ` : ""}{player.specs.speciality}
              </div>
            )}

            <div className="text-[10px] font-mono text-white/60">
              Base: <strong className="text-white font-bold">{player.basePrice.toLocaleString("en-IN")} Pt.</strong>
            </div>
          </div>
        </div>

        <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-mono uppercase tracking-wider text-white/50 block font-bold">
              CURRENT BID
            </span>
            <span className="font-display font-black text-lg sm:text-xl text-yellow-400 leading-none">
              {bid.toLocaleString("en-IN")} Pt.
            </span>
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-black/70 border border-red-500/40 text-[10px] font-mono font-bold text-white">
            <img src={leadingTeam.logoSvg} alt="" className="w-3.5 h-3.5 object-contain" />
            <span>{leadingTeam.code} {leadingTeam.name}</span>
          </div>
        </div>

        {status === "sold" && (
          <div className="absolute inset-0 z-20 rounded-xl bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 animate-in zoom-in-95">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-display font-black text-emerald-400 uppercase tracking-wider">
                🎉 SOLD!
              </div>
              <div className="text-[11px] font-mono text-white font-bold mt-0.5">
                {leadingTeam.name} won for {bid.toLocaleString("en-IN")} Pt.
              </div>
            </div>
          </div>
        )}

        {status === "unsold" && (
          <div className="absolute inset-0 z-20 rounded-xl bg-black/85 backdrop-blur-xs flex items-center justify-center p-2 animate-in zoom-in-95">
            <div className="text-center">
              <div className="text-lg sm:text-xl font-display font-black text-rose-500 uppercase tracking-wider">
                UNSOLD
              </div>
              <div className="text-[11px] font-mono text-white/70 font-bold mt-0.5">
                Passed to recall pool
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Teams Section */}
      <div className="my-1.5 shrink-0">
        <span className="text-[10px] font-mono font-black uppercase tracking-wider text-white block mb-1">
          TEAMS
        </span>
        <div className="grid grid-cols-3 gap-1">
          {teams.map((t) => (
            <div
              key={t.id}
              className="p-1 rounded-lg border-l-2 bg-[#0c182b] border border-white/5 text-[8px] sm:text-[9px] font-mono"
              style={{ borderLeftColor: t.color }}
            >
              <div className="flex items-center gap-1">
                <img src={t.logoSvg} alt={t.name} className="w-3 h-3 object-contain shrink-0" />
                <span className="font-bold text-white truncate text-[9px]">{t.shortName}</span>
              </div>
              <div className="text-white/60 mt-0.5 truncate text-[8px]">
                PURSE <strong className="text-blue-300 font-bold">{(t.purse / 100000).toFixed(2)}L</strong>
              </div>
              <div className="text-emerald-400 font-bold text-[8px]">MAX {(t.maxBid / 100000).toFixed(2)}L</div>
            </div>
          ))}
        </div>
      </div>

      {/* Full-width Cheer Button */}
      <div className="shrink-0 pt-1">
        <button
          type="button"
          onClick={() => {
            onSendReaction("🔥");
            onSendReaction("🏏");
            onSendReaction("👏");
          }}
          className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-400 hover:to-red-400 active:scale-98 text-white font-display font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition cursor-pointer"
        >
          <Flame className="h-4 w-4" />
          <span>CHEER LIVE</span>
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// SCREEN 4: ACTUAL TEAM BIDDER SCREEN (MATCHES media_1789817873758.png)
// =============================================================================
function ActualTeamBidderView({
  player,
  bid,
  leadingTeam,
  userTeam,
  status,
  timer,
  onQuickBid,
}: {
  player: DemoPlayer;
  bid: number;
  leadingTeam: DemoTeam;
  userTeam: DemoTeam;
  status: "active" | "sold" | "unsold";
  timer: number;
  onQuickBid: () => void;
}) {
  const isWinner = leadingTeam.code === "PW" || leadingTeam.id === userTeam.id;
  const purseLeft = status === "sold" && isWinner ? Math.max(0, 150000 - bid) : 140000;
  const maxBidVal = status === "sold" && isWinner ? Math.max(0, purseLeft - 10000) : 140000;

  return (
    <div
      className="relative rounded-2xl overflow-hidden bg-[#0e1026] border-2 border-blue-500/30 p-2.5 sm:p-3 flex flex-col justify-between select-none shadow-2xl h-full max-w-sm mx-auto"
      style={{ fontFamily: "'Space Grotesk', system-ui, sans-serif" }}
    >
      {/* 1. Header */}
      <div>
        <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
          <div className="flex items-center gap-1.5">
            <ActualBidwarLogo className="h-4 sm:h-5 w-auto object-contain" />
            <span className="text-[8px] sm:text-[9px] font-mono text-yellow-400 font-bold uppercase">
              BIDWAR PREMIER LEAGUE
            </span>
          </div>
          <span className="text-[7px] font-mono uppercase tracking-widest text-white/40">
            TEAM CONSOLE
          </span>
        </div>

        {/* Team bar: Pitch Warriors LIVE */}
        <div className="flex items-center justify-between pt-1.5 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-md bg-emerald-950 border border-emerald-500/40 p-0.5 flex items-center justify-center">
              <img src={userTeam.logoSvg || PW_LOGO_SVG} alt={userTeam.name} className="w-full h-full object-contain" />
            </div>
            <span className="font-bold text-white text-xs">{userTeam.name}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 text-[8px] font-mono font-bold uppercase">
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono text-white/60">
            <span className="text-emerald-400">SYNCED</span>
            <span>MY SQUAD</span>
            <span>RIVALS</span>
          </div>
        </div>

        {/* Live Countdown Timer Bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-black/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                status !== "active"
                  ? "bg-zinc-600 w-full"
                  : timer <= 3
                  ? "bg-red-500 animate-pulse"
                  : timer <= 6
                  ? "bg-amber-400"
                  : "bg-emerald-400"
              }`}
              style={{
                width: status === "active" ? `${Math.min(100, Math.max(0, (timer / 15) * 100))}%` : "100%",
              }}
            />
          </div>
          <span
            className={`font-mono font-black text-xs sm:text-sm ${
              status !== "active"
                ? "text-white/40"
                : timer <= 3
                ? "text-red-400 animate-pulse"
                : "text-emerald-400"
            }`}
          >
            {status === "active" ? `${timer}s` : "0s"}
          </span>
        </div>
      </div>

      {/* 2. Active Player Card */}
      <div className="relative my-2 p-2.5 rounded-xl bg-[#141738] border border-blue-500/30 overflow-hidden">
        {/* SOLD / UNSOLD OVERLAYS */}
        {status === "sold" && isWinner && (
          <div className="absolute inset-0 z-30 rounded-xl bg-gradient-to-b from-[#063b2f]/95 via-black/95 to-[#04241c]/95 border-2 border-emerald-400 p-2.5 flex flex-col items-center justify-center text-center animate-in zoom-in-95 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-xl shadow-[0_0_20px_rgba(16,185,129,0.7)] animate-bounce mb-0.5">
              🎉
            </div>
            <span className="px-2 py-0.2 rounded-full bg-emerald-400 text-black font-mono font-black text-[8px] tracking-wider uppercase">
              LOT WON!
            </span>
            <h3 className="font-display font-black text-base text-white mt-0.5 uppercase">
              CONGRATULATIONS!
            </h3>
            <p className="text-[10px] font-mono text-emerald-300 font-bold">
              {player.name} won for ₹{bid.toLocaleString("en-IN")}
            </p>
            <span className="text-[8px] font-mono text-white/70 bg-black/60 px-2 py-0.5 rounded border border-white/10 mt-1">
              Added to Pitch Warriors Squad · Purse adjusted
            </span>
          </div>
        )}

        {status === "sold" && !isWinner && (
          <div className="absolute inset-0 z-30 rounded-xl bg-gradient-to-b from-[#3b0b14]/95 via-black/95 to-[#240409]/95 border-2 border-red-500/60 p-2.5 flex flex-col items-center justify-center text-center animate-in zoom-in-95 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-red-500/20 border-2 border-red-500/60 flex items-center justify-center text-xl mb-0.5">
              🔨
            </div>
            <span className="px-2 py-0.2 rounded-full bg-red-500 text-white font-mono font-black text-[8px] tracking-wider uppercase">
              LOT SOLD
            </span>
            <h3 className="font-display font-black text-sm text-white mt-0.5 uppercase">
              SOLD TO {leadingTeam.name}
            </h3>
            <p className="text-[10px] font-mono text-white/80 font-bold">
              Final Price: ₹{bid.toLocaleString("en-IN")}
            </p>
            <span className="text-[8px] font-mono text-amber-300 bg-black/60 px-2 py-0.5 rounded border border-amber-500/30 mt-1">
              Outbid by {leadingTeam.shortName} · Awaiting next lot
            </span>
          </div>
        )}

        {status === "unsold" && (
          <div className="absolute inset-0 z-30 rounded-xl bg-gradient-to-b from-[#25103b]/95 via-black/95 to-[#160824]/95 border-2 border-purple-500/60 p-2.5 flex flex-col items-center justify-center text-center animate-in zoom-in-95 shadow-2xl">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 border-2 border-purple-500/60 flex items-center justify-center text-xl mb-0.5">
              ✕
            </div>
            <span className="px-2 py-0.2 rounded-full bg-purple-500 text-white font-mono font-black text-[8px] tracking-wider uppercase">
              UNSOLD
            </span>
            <h3 className="font-display font-black text-sm text-white mt-0.5 uppercase">
              {player.name}
            </h3>
            <span className="text-[8px] font-mono text-white/60 bg-black/60 px-2 py-0.5 rounded border border-white/10 mt-1">
              Returned to recall pool · Next lot soon
            </span>
          </div>
        )}

        <div className="flex items-start gap-2.5">
          <div className="relative w-14 h-18 rounded-lg overflow-hidden border border-blue-400/30 bg-black/60 shrink-0">
            <img
              src={player.photoUrl || "/assets/players/ankit-head.png"}
              alt={player.name}
              className="w-full h-full object-cover object-top"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-mono text-yellow-400 font-bold">#{player.serialNo}</div>
            <h4 className="font-display font-black text-sm sm:text-base text-white truncate leading-tight">
              {player.name}
            </h4>
            <div className="text-[10px] font-mono text-white/70 mt-0.5">
              ROLE <strong className="text-white font-bold">{player.role}</strong>
            </div>
            <div className="text-[10px] font-mono text-white/70">
              CITY <strong className="text-white font-bold">{player.city}</strong>
            </div>
            <div className="text-[10px] font-mono text-yellow-400 mt-0.5">
              Base <strong>₹{player.basePrice.toLocaleString("en-IN")}</strong>
            </div>
            {player.specs && (
              <div className="text-[8px] font-mono text-cyan-300 font-bold mt-1 bg-black/40 px-1.5 py-0.5 rounded border border-white/10 flex items-center justify-between">
                <span>{player.specs.matches} M · {player.specs.runs ? `${player.specs.runs} R` : ""}{player.specs.wickets ? ` · ${player.specs.wickets} W` : ""}</span>
                <span>{player.specs.strikeRate ? `SR ${player.specs.strikeRate}` : player.specs.economy ? `Eco ${player.specs.economy}` : ""}</span>
              </div>
            )}
          </div>
        </div>

        {/* Current Bid Display + Leader tag */}
        <div className="mt-2 pt-2 border-t border-white/10 text-center">
          <span className="text-[8px] sm:text-[9px] font-mono uppercase tracking-widest text-white/50 block font-bold">
            {status === "sold" ? "FINAL LOT AMOUNT" : "CURRENT BID"}
          </span>
          <div className="font-display font-black text-2xl sm:text-3xl text-white tracking-tight leading-none mt-0.5">
            ₹{bid.toLocaleString("en-IN")}
          </div>
          <div className="mt-1 text-[9px] font-mono flex items-center justify-center gap-1">
            <span className="text-white/40 uppercase">Leading: </span>
            <img src={leadingTeam.logoSvg} alt="" className="w-3.5 h-3.5 object-contain" />
            {isWinner ? (
              <span className="text-emerald-400 font-bold">★ Pitch Warriors (YOU)</span>
            ) : (
              <span className="text-amber-400 font-bold">{leadingTeam.shortName} ({leadingTeam.name})</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. Stats 3-box row */}
      <div className="grid grid-cols-3 gap-1.5 text-center text-[9px] font-mono bg-[#141738] p-1.5 rounded-lg border border-white/5">
        <div>
          <span className="font-bold text-amber-400 text-xs block">11</span>
          <span className="text-white/50 text-[8px] block">MIN SQUAD</span>
        </div>
        <div>
          <span className="font-bold text-blue-400 text-xs block">1</span>
          <span className="text-white/50 text-[8px] block">RETAINED</span>
        </div>
        <div>
          <span className="font-bold text-emerald-400 text-xs block">
            {status === "sold" && isWinner ? "1" : "0"}
          </span>
          <span className="text-white/50 text-[8px] block">BOUGHT</span>
        </div>
      </div>

      {/* 4. Purse chips */}
      <div className="grid grid-cols-3 gap-1 my-2 text-[8px] font-mono text-center">
        <div className="p-1 rounded bg-black/40 border border-white/5">
          <div className="text-emerald-400 font-bold">₹1.50L</div>
          <div className="text-white/40">PURSE</div>
        </div>
        <div className="p-1 rounded bg-black/40 border border-white/5">
          <div className="text-cyan-400 font-bold">₹{(purseLeft / 100000).toFixed(2)}L</div>
          <div className="text-white/40">PURSE LEFT</div>
        </div>
        <div className="p-1 rounded bg-black/40 border border-white/5">
          <div className="text-amber-400 font-bold">₹{(maxBidVal / 100000).toFixed(2)}L</div>
          <div className="text-white/40">MAX BID</div>
        </div>
      </div>

      {/* 5. DYNAMIC BID BUTTON / CELEBRATION BADGE */}
      <div>
        {status === "active" && (
          <button
            type="button"
            onClick={onQuickBid}
            className="w-full py-3 sm:py-3.5 rounded-xl bg-[#1fc76a] hover:bg-[#1bb35f] active:scale-98 text-black font-display font-black text-lg sm:text-xl uppercase tracking-wider flex flex-col items-center justify-center shadow-2xl cursor-pointer transition min-h-[44px]"
          >
            <span>BID</span>
            <span className="text-xs font-mono font-bold text-black/80">
              ₹{(bid + 5000).toLocaleString("en-IN")}
            </span>
          </button>
        )}

        {status === "sold" && isWinner && (
          <div className="w-full py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 text-black font-display font-black text-xs sm:text-sm uppercase tracking-wider flex flex-col items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)] border-2 border-emerald-300 animate-pulse min-h-[44px]">
            <div className="flex items-center gap-1.5">
              <Trophy className="h-4 w-4 text-black" />
              <span>WON BY PITCH WARRIORS!</span>
            </div>
            <span className="text-[10px] font-mono font-black text-black/80">
              ₹{bid.toLocaleString("en-IN")} PT.
            </span>
          </div>
        )}

        {status === "sold" && !isWinner && (
          <div className="w-full py-2.5 rounded-xl bg-black/60 border border-white/10 text-white/50 font-display font-black text-xs uppercase tracking-wider flex flex-col items-center justify-center min-h-[44px]">
            <span>LOT SOLD TO {leadingTeam.shortName}</span>
            <span className="text-[9px] font-mono text-white/40">
              ₹{bid.toLocaleString("en-IN")} PT.
            </span>
          </div>
        )}

        {status === "unsold" && (
          <div className="w-full py-2.5 rounded-xl bg-black/60 border border-white/10 text-rose-400 font-display font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 min-h-[44px]">
            <XCircle className="h-3.5 w-3.5" />
            <span>PLAYER UNSOLD</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 mt-1">
          <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest">POWERED BY</span>
          <ActualBidwarLogo className="h-3 w-auto object-contain opacity-60" />
        </div>
      </div>
    </div>
  );
}
