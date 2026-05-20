import { useState } from "react";

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}
function fmtFull(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

const TEAMS = [
  { id: 1, name: "Mumbai Heroes",   color: "#3b82f6", purse: 4800000, used: 3200000, max: 8000000, players: 6,  maxSquad: 15, leading: true  },
  { id: 2, name: "Chennai Kings",   color: "#f59e0b", purse: 3500000, used: 4500000, max: 8000000, players: 5,  maxSquad: 15, leading: false },
  { id: 3, name: "Bangalore Bulls", color: "#ef4444", purse: 5200000, used: 2800000, max: 8000000, players: 4,  maxSquad: 15, leading: false },
  { id: 4, name: "Delhi Dons",      color: "#8b5cf6", purse: 4100000, used: 3900000, max: 8000000, players: 6,  maxSquad: 15, leading: false },
  { id: 5, name: "Kolkata Knights", color: "#10b981", purse: 2900000, used: 5100000, max: 8000000, players: 7,  maxSquad: 15, leading: false },
  { id: 6, name: "Punjab Power",    color: "#f97316", purse: 6000000, used: 2000000, max: 8000000, players: 3,  maxSquad: 15, leading: false },
];
const QUEUE = [
  { id: 1, name: "Rohit Sharma",     role: "BAT",  cat: "Platinum", catColor: "#eab308", base: 2000000, jersey: "45", active: true  },
  { id: 2, name: "Jasprit Bumrah",   role: "BOWL", cat: "Platinum", catColor: "#eab308", base: 1800000, jersey: "93", active: false },
  { id: 3, name: "KL Rahul",         role: "WK",   cat: "Gold",     catColor: "#f59e0b", base: 1500000, jersey: "1",  active: false },
  { id: 4, name: "Hardik Pandya",    role: "AR",   cat: "Platinum", catColor: "#eab308", base: 1600000, jersey: "33", active: false },
  { id: 5, name: "Y. Chahal",        role: "BOWL", cat: "Gold",     catColor: "#f59e0b", base: 1000000, jersey: "3",  active: false },
  { id: 6, name: "Shubman Gill",     role: "BAT",  cat: "Gold",     catColor: "#f59e0b", base: 1200000, jersey: "77", active: false },
  { id: 7, name: "Sanju Samson",     role: "WK",   cat: "Gold",     catColor: "#f59e0b", base: 1400000, jersey: "8",  active: false },
  { id: 8, name: "R. Ashwin",        role: "BOWL", cat: "Silver",   catColor: "#94a3b8", base: 800000,  jersey: "99", active: false },
  { id: 9, name: "S. Iyer",          role: "BAT",  cat: "Gold",     catColor: "#f59e0b", base: 1100000, jersey: "41", active: false },
];
const BIDS = [
  { player: "Rohit Sharma",     team: "Mumbai Heroes",   color: "#3b82f6", amt: 2400000 },
  { player: "Rohit Sharma",     team: "Bangalore Bulls", color: "#ef4444", amt: 2200000 },
  { player: "Rohit Sharma",     team: "Mumbai Heroes",   color: "#3b82f6", amt: 2000000 },
  { player: "J. Bumrah (prev)", team: "Chennai Kings",   color: "#f59e0b", amt: 2100000 },
  { player: "J. Bumrah (prev)", team: "Mumbai Heroes",   color: "#3b82f6", amt: 1900000 },
];

export function BeginnerFriendly() {
  const [queueTab, setQueueTab]     = useState<"queue"|"sold"|"unsold">("queue");
  const [roleFilter, setRoleFilter] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [timerSecs, setTimerSecs]   = useState("30");
  const [breakActive, setBreakActive] = useState(false);
  const [showBreakRow, setShowBreakRow] = useState(false);
  const [ledMode, setLedMode]       = useState<"off"|"team"|"player"|"top5">("off");
  const [displayTheme, setDisplayTheme] = useState(0);

  const themes = [
    { dot: "#eab308" }, { dot: "#3b82f6" }, { dot: "#ef4444" }, { dot: "#8b5cf6" }, { dot: "#10b981" },
  ];

  const filteredQueue = QUEUE.filter(p => {
    const matchRole =
      roleFilter === "all"  ? true :
      roleFilter === "bat"  ? p.role === "BAT"  :
      roleFilter === "bowl" ? p.role === "BOWL" :
      roleFilter === "ar"   ? p.role === "AR"   :
      roleFilter === "wk"   ? p.role === "WK"   : true;
    return matchRole && p.name.toLowerCase().includes(playerSearch.toLowerCase());
  });

  const roleCounts = {
    bat:  QUEUE.filter(p => p.role === "BAT").length,
    bowl: QUEUE.filter(p => p.role === "BOWL").length,
    ar:   QUEUE.filter(p => p.role === "AR").length,
    wk:   QUEUE.filter(p => p.role === "WK").length,
  };

  const currentPlayer = QUEUE[0];
  const currentBid    = 2400000;
  const leadingTeam   = TEAMS[0];
  const increment     = 200000;
  const timerSec      = 18;
  const timerRunning  = true;

  return (
    <div className="h-screen bg-[#0f1117] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ══════════ TOP STATUS BAR ══════════════════════════════════════════ */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#141720] border-b border-white/8 flex-wrap min-h-[44px] z-10">

        {/* Status badge */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border bg-green-500/15 border-green-500/40 text-green-400 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          ACTIVE
        </span>

        {/* Stats pills */}
        <div className="flex items-center gap-2 text-xs font-medium flex-shrink-0">
          <span className="text-white/40">SOLD <span className="text-green-400 font-bold">12</span></span>
          <span className="text-white/40">UNSOLD <span className="text-red-400 font-bold">3</span></span>
          <span className="text-white/40">LEFT <span className="text-white font-bold">18</span></span>
          <span className="text-white/40">RET <span className="text-purple-400 font-bold">2</span></span>
        </div>

        {/* Auction code */}
        <span className="font-mono text-xs tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 flex-shrink-0">
          IPL2025
        </span>

        <div className="w-px h-4 bg-white/12 flex-shrink-0" />

        {/* Category filter */}
        <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-white/15 text-xs font-semibold text-white/50 hover:text-white hover:bg-white/8 transition-all flex-shrink-0">
          ⬡ All Categories
        </button>

        {/* Pause Session */}
        <button className="h-7 px-3 flex items-center gap-1.5 text-xs font-bold rounded-md bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 hover:bg-yellow-400/25 transition-all flex-shrink-0">
          ⏸ Pause Session
        </button>

        {/* Re-auction last player — replaces undo */}
        <button
          title="Re-auction last sold/unsold player"
          className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded-md border border-white/12 text-white/40 hover:text-white/80 hover:border-white/25 hover:bg-white/6 transition-all flex-shrink-0"
        >
          ↻ Re-auction last
        </button>

        {/* Settings gear */}
        <button
          title="Auction Settings"
          className="h-7 w-7 flex items-center justify-center text-white/35 hover:text-white hover:bg-white/8 rounded-md transition-all flex-shrink-0 text-base"
        >
          ⚙
        </button>

        <div className="flex-1 min-w-0" />

        {/* Trial badge */}
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
          Trial Mode
        </span>

        {/* ── LED overlay controls — MAIN VIEW first, then Team / Player / Top 5 ── */}
        <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-white/10 bg-white/4 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 pr-1.5 border-r border-white/10 mr-0.5 leading-tight">LED<br/>SCREEN</span>

          {/* MAIN View (Live) — always first */}
          <button
            onClick={() => setLedMode("off")}
            className={`flex items-center gap-1.5 h-7 px-3 rounded text-xs font-black transition-all ${
              ledMode === "off"
                ? "bg-green-600 text-white shadow-md ring-1 ring-white/20"
                : "text-white/40 hover:text-white hover:bg-white/8"
            }`}
          >
            📺 MAIN View
          </button>

          <div className="w-px h-5 bg-white/10 mx-0.5" />

          {/* Team / Player / Top 5 */}
          {([
            { mode: "team"   as const, label: "Team",  icon: "🏆", activeClass: "bg-yellow-400 text-black" },
            { mode: "player" as const, label: "Player", icon: "👤", activeClass: "bg-blue-500 text-white"  },
            { mode: "top5"   as const, label: "Top 5",  icon: "★",  activeClass: "bg-purple-600 text-white"},
          ]).map(({ mode, label, icon, activeClass }) => (
            <button
              key={mode}
              onClick={() => setLedMode(ledMode === mode ? "off" : mode)}
              className={`flex items-center gap-1 h-7 px-2.5 rounded text-xs font-bold transition-all ${
                ledMode === mode ? `${activeClass} shadow-md ring-1 ring-white/20` : "text-white/35 hover:text-white hover:bg-white/8"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Display theme dots */}
        <div className="hidden sm:flex items-center gap-0.5 border border-white/10 rounded-md px-1.5 py-1.5 flex-shrink-0">
          {themes.map((t, i) => (
            <button key={i} onClick={() => setDisplayTheme(i)}
              className={`w-3.5 h-3.5 rounded-full transition-all ${displayTheme === i ? "ring-1 ring-white ring-offset-1 ring-offset-[#141720] scale-110" : "opacity-40 hover:opacity-80"}`}
              style={{ backgroundColor: t.dot }} />
          ))}
        </div>

        {/* Open Display */}
        <button className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded-md border border-white/12 text-white/45 hover:text-white hover:border-white/25 transition-all flex-shrink-0">
          📺 Open Display ↗
        </button>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-green-500/40 bg-green-500/10 text-green-400 text-xs font-semibold flex-shrink-0">
          ⚡ Live
        </div>

        {breakActive && (
          <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs font-semibold flex-shrink-0">
            ☕ Break <span className="font-mono font-black">03:24</span>
          </div>
        )}
      </div>

      {/* ══════════ MAIN 3-COLUMN LAYOUT ════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT: PLAYER QUEUE ──────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 bg-[#141720] border-r border-white/8 flex flex-col min-h-0">

          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0">
            <span className="text-xs font-black uppercase tracking-widest text-white/40">Player Queue</span>
            <button className="text-sm text-white/30 hover:text-white/60 transition-colors" title="Random next player">🔀</button>
          </div>

          {/* Queue / Sold / Unsold tabs */}
          <div className="flex border-b border-white/6 flex-shrink-0">
            {(["queue","sold","unsold"] as const).map(t => (
              <button key={t} onClick={() => setQueueTab(t)}
                className={`flex-1 text-[11px] py-1.5 font-bold capitalize transition-all ${queueTab === t ? "text-yellow-300 border-b-2 border-yellow-400 bg-yellow-400/5" : "text-white/30 hover:text-white/50"}`}>
                {t === "queue" ? `Queue (${QUEUE.length})` : t === "sold" ? "Sold (12)" : "Unsold (3)"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 flex-shrink-0 border-b border-white/5">
            <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
              placeholder="Search player…"
              className="w-full h-7 px-2 text-xs bg-white/5 border border-white/8 rounded text-white/60 placeholder:text-white/25 outline-none focus:border-yellow-400/30" />
          </div>

          {/* Role filter */}
          {queueTab === "queue" && (
            <div className="flex gap-1 px-2 py-1.5 flex-shrink-0 flex-wrap border-b border-white/5">
              {([
                { k: "all",  l: "ALL",  c: QUEUE.length  },
                { k: "bat",  l: "BAT",  c: roleCounts.bat  },
                { k: "bowl", l: "BOWL", c: roleCounts.bowl },
                { k: "ar",   l: "AR",   c: roleCounts.ar   },
                { k: "wk",   l: "WK",   c: roleCounts.wk   },
              ]).map(({ k, l, c }) => (
                <button key={k} onClick={() => setRoleFilter(k)}
                  className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-black uppercase tracking-wide transition-all ${roleFilter === k ? "bg-yellow-400 text-black" : "text-white/35 bg-white/5 hover:bg-white/8 hover:text-white/65"}`}>
                  {l} <span className="opacity-60 font-mono">{c}</span>
                </button>
              ))}
            </div>
          )}

          {/* Player list */}
          <div className="flex-1 overflow-y-auto">
            {queueTab === "unsold" && (
              <div className="px-2 py-2 border-b border-white/6">
                <button className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-all">
                  ↻ Re-auction all 3 unsold
                </button>
              </div>
            )}
            {filteredQueue.map((p, idx) => (
              <div key={p.id}
                className={`flex items-center gap-2 px-2 py-2.5 border-b border-white/4 transition-all cursor-pointer group ${p.active ? "bg-yellow-400/8 border-yellow-400/15" : "hover:bg-white/4"}`}>
                <span className="text-[10px] text-white/20 w-4 text-right flex-shrink-0 font-mono">{idx + 1}</span>
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: p.catColor }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    {p.jersey && <span className="text-[10px] text-white/25 font-mono">#{p.jersey}</span>}
                    <p className={`text-xs font-semibold truncate ${p.active ? "text-yellow-200" : "text-white/65 group-hover:text-white/85"}`}>{p.name}</p>
                  </div>
                  <p className="text-[10px] text-white/30">{p.role} · {fmt(p.base)}</p>
                </div>
                {p.active
                  ? <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                  : <span className="text-white/15 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">▶</span>
                }
              </div>
            ))}
          </div>
        </div>

        {/* ── CENTER: AUCTION CORE ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Bid timer bar */}
          <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-white/8 bg-[#0f1117]">
            <span className="text-xs font-black uppercase tracking-widest text-white/30">Bid Timer</span>
            <div className="flex items-center gap-1">
              <input value={timerSecs} onChange={e => setTimerSecs(e.target.value)}
                className="w-10 h-7 text-center text-sm font-mono font-bold bg-white/6 border border-white/12 rounded text-white/70 outline-none focus:border-yellow-400/40" />
              <span className="text-xs text-white/30">sec</span>
            </div>
            {timerRunning ? (
              <button className="h-7 px-3 flex items-center gap-1.5 text-xs font-bold rounded-lg bg-red-500/15 border border-red-500/35 text-red-400 hover:bg-red-500/25 transition-all">
                ⏹ Stop Bidding
              </button>
            ) : (
              <button className="h-7 px-3 flex items-center gap-1.5 text-xs font-bold rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/25 transition-all">
                ▶ Start Bidding
              </button>
            )}
            <button className="h-7 px-2.5 text-xs font-semibold bg-white/5 border border-white/10 rounded-md text-white/40 hover:text-white/65 transition-all">
              +30s
            </button>

            <div className="flex-1" />

            <span className="text-[10px] font-bold uppercase tracking-widest text-white/25">LED Countdown</span>
            <button onClick={() => setShowBreakRow(!showBreakRow)}
              className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded border border-amber-500/35 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
              ☕ Break
            </button>
            <button className="h-7 px-2.5 flex items-center gap-1.5 text-xs font-semibold rounded border border-white/15 bg-white/5 text-white/40 hover:text-white/65 transition-all">
              ⏰ Pre-Auction
            </button>
          </div>

          {/* Break config row */}
          {showBreakRow && (
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2 bg-amber-500/5 border-b border-amber-500/15">
              <span className="text-sm text-amber-300 font-semibold">☕ Break Timer</span>
              <input defaultValue="5" className="w-10 h-7 text-center text-sm font-mono bg-white/6 border border-amber-500/25 rounded text-white/70 outline-none" />
              <span className="text-xs text-white/30">min</span>
              <input defaultValue="Lunch Break" placeholder="Label (optional)" className="h-7 px-2 text-xs bg-white/6 border border-amber-500/25 rounded text-white/60 outline-none w-36" />
              <button onClick={() => { setBreakActive(true); setShowBreakRow(false); }}
                className="h-7 px-4 text-xs font-bold rounded bg-amber-500 text-black hover:bg-amber-400 transition-all">
                Start
              </button>
              {breakActive && (
                <>
                  <span className="font-mono text-amber-300 font-black text-base">03:24</span>
                  <button className="h-7 px-2.5 text-xs font-semibold rounded border border-amber-500/30 bg-amber-500/10 text-amber-400">+5 min</button>
                  <button onClick={() => setBreakActive(false)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Cancel</button>
                </>
              )}
            </div>
          )}

          {/* Step indicator */}
          <div className="flex-shrink-0 flex items-center gap-2 px-5 py-2 border-b border-white/5">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-300 text-xs font-semibold">
              <span className="w-5 h-5 rounded-full bg-yellow-400 text-black flex items-center justify-center text-[10px] font-black">2</span>
              Bidding in progress
            </div>
            <span className="text-white/25 text-xs">·</span>
            <span className="text-white/35 text-sm">Stop bidding first, then click SOLD or UNSOLD to conclude</span>
          </div>

          {/* Scrollable core */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 space-y-4 max-w-2xl mx-auto">

              {/* Current player card */}
              <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1f2e, #141820)" }}>
                <div className="flex items-stretch">
                  <div className="w-20 h-24 flex-shrink-0 bg-white/5 flex items-center justify-center text-5xl">👤</div>
                  <div className="flex-1 px-5 py-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: currentPlayer.catColor }}>
                          {currentPlayer.role} · {currentPlayer.cat}
                        </p>
                        <h2 className="text-2xl font-black leading-tight truncate text-white">{currentPlayer.name}</h2>
                      </div>
                      <span className="text-3xl font-black text-white/10 flex-shrink-0">#{currentPlayer.jersey}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm">
                      <span className="text-white/40">Age <span className="text-white/70 font-semibold">36</span></span>
                      <span className="text-white/40">Mumbai</span>
                      <span className="text-white/40">Right-hand Bat</span>
                      <span className="text-white/40">Off-break</span>
                      <span className="text-white/40">Base <span className="text-white/70 font-semibold">{fmt(currentPlayer.base)}</span></span>
                    </div>
                    <p className="text-xs text-white/30 mt-1">Captain · 3x IPL winner · T20 World Cup squad</p>
                  </div>
                </div>
              </div>

              {/* Timer + Bid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center py-3 rounded-2xl border border-white/8 bg-[#141820]">
                  <div className="relative w-28 h-28">
                    <svg className="w-28 h-28 -rotate-90" viewBox="0 0 112 112">
                      <circle cx="56" cy="56" r="46" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="7" />
                      <circle cx="56" cy="56" r="46" fill="none" stroke="#facc15" strokeWidth="7"
                        strokeLinecap="round"
                        strokeDasharray={`${(timerSec / 30) * 2 * Math.PI * 46} ${2 * Math.PI * 46}`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black tabular-nums text-white leading-none">{timerSec}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-sm font-semibold text-yellow-300">Timer running</span>
                  </div>
                  <p className="text-xs text-white/25 mt-0.5">of {timerSecs}s bid window</p>
                </div>

                <div className="flex flex-col items-center justify-center py-3 rounded-2xl border border-white/8 bg-[#141820] text-center">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/30 mb-1">Current Bid</p>
                  <div className="text-5xl font-black text-yellow-400 leading-none mb-2"
                    style={{ textShadow: "0 0 30px rgba(250,204,21,0.35)" }}>
                    {fmt(currentBid)}
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: leadingTeam.color }} />
                    <span className="text-sm font-bold" style={{ color: leadingTeam.color }}>{leadingTeam.name}</span>
                  </div>
                  <p className="text-xs text-white/25 mt-1.5">Base {fmtFull(currentPlayer.base)} · +{fmt(increment)}/raise</p>
                </div>
              </div>

              {/* SOLD / UNSOLD / DEFER / MANUAL */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "SOLD",   icon: "✔", sub: "Assign [S]",        bg: "bg-green-600/15", border: "border-green-600/60", text: "text-green-400",  shadow: "0 0 16px rgba(34,197,94,0.2)"  },
                  { label: "UNSOLD", icon: "✘", sub: "No bids [U]",       bg: "bg-red-600/10",   border: "border-red-600/50",   text: "text-red-400",    shadow: ""                               },
                  { label: "DEFER",  icon: "⏳", sub: "Back of queue [D]", bg: "bg-amber-500/10", border: "border-amber-500/40", text: "text-amber-400",  shadow: ""                               },
                  { label: "MANUAL", icon: "⚙", sub: "Set amount [M]",    bg: "bg-blue-500/10",  border: "border-blue-500/40",  text: "text-blue-400",   shadow: ""                               },
                ].map(b => (
                  <button key={b.label}
                    className={`col-span-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl border-2 font-bold text-sm transition-all ${b.bg} ${b.border} ${b.text} hover:scale-[1.02]`}
                    style={{ boxShadow: b.shadow || undefined }}>
                    <span className="text-xl">{b.icon}</span>
                    <span>{b.label}</span>
                    <span className="text-[10px] font-normal opacity-55">{b.sub}</span>
                  </button>
                ))}
              </div>

              {/* NEXT PLAYER + START/STOP BIDDING */}
              <div className="grid grid-cols-5 gap-2">
                <button className="col-span-3 flex items-center justify-center gap-3 py-4 rounded-xl font-black text-xl transition-all bg-gradient-to-r from-yellow-500/90 to-yellow-400 text-black hover:from-yellow-400 hover:to-yellow-300 shadow-[0_0_28px_rgba(234,179,8,0.4)] hover:scale-[1.01]">
                  ⏭ NEXT PLAYER
                  <span className="text-sm font-normal opacity-60 font-mono">N</span>
                </button>
                <button className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-lg transition-all bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.01]">
                  ▶ START BIDDING
                </button>
              </div>

              {/* Quick Bid */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-white/30 mb-2">
                  Quick Bid — Next raise: <span className="text-yellow-400 font-mono">{fmtFull(currentBid + increment)}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEAMS.map(t => {
                    const canBid = !t.leading && t.purse >= currentBid + increment;
                    return (
                      <button key={t.id} disabled={!canBid}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${t.leading ? "scale-[1.01]" : ""} ${!canBid ? "opacity-35 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"}`}
                        style={{ borderColor: t.leading ? t.color : `${t.color}30`, boxShadow: t.leading ? `0 0 16px ${t.color}44` : undefined, background: `${t.color}0d` }}>
                        {t.leading && (
                          <div className="absolute top-1.5 right-2 flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: t.color }} />
                            <span className="text-xs font-black" style={{ color: t.color }}>LEAD</span>
                          </div>
                        )}
                        {t.players >= t.maxSquad && !t.leading && (
                          <div className="absolute top-1.5 right-2">
                            <span className="text-[10px] font-black text-red-400">Full</span>
                          </div>
                        )}
                        <p className="text-sm font-bold text-white/80 mb-1">{t.name}</p>
                        <p className="text-xs text-white/40">{fmt(t.purse)} spendable</p>
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── RIGHT: TEAMS + BID HISTORY ──────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 border-l border-white/8 bg-[#141720] flex flex-col min-h-0">

          {/* ── Teams & Purse ── */}
          <div className="flex flex-col flex-shrink-0" style={{ maxHeight: "52%" }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0">
              <span className="text-xs font-black uppercase tracking-wider text-white/50">Teams &amp; Purse</span>
              <button className="text-xs text-white/30 hover:text-white/55 transition-colors">All ↗</button>
            </div>

            <div className="overflow-y-auto flex-1">
              {TEAMS.map(t => {
                const usedPct = Math.min(100, Math.round((t.used / t.max) * 100));
                const maxReached = t.players >= t.maxSquad;
                return (
                  <div key={t.id}
                    className={`mx-2 my-1.5 rounded-xl p-2.5 border transition-all ${t.leading ? "border-2" : "border-white/8"}`}
                    style={{
                      borderColor: t.leading ? t.color : undefined,
                      boxShadow: t.leading ? `0 0 12px ${t.color}33` : undefined,
                      background: `${t.color}0c`,
                    }}>

                    {/* Team name row */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="text-sm font-bold text-white/85 truncate leading-tight">{t.name}</span>
                      {t.leading && <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0 ml-auto" style={{ backgroundColor: t.color }} />}
                    </div>

                    {/* Max bid + squad */}
                    <div className="flex items-baseline justify-between gap-2">
                      <div>
                        <p className={`text-lg font-black font-mono leading-none ${maxReached ? "text-red-400" : "text-emerald-400"}`}>
                          {maxReached ? "FULL" : fmt(t.purse)}
                        </p>
                        <p className="text-[10px] text-white/35 leading-tight mt-0.5">max bid</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-black leading-none ${maxReached ? "text-red-400" : "text-white/60"}`}>
                          {t.players}/{t.maxSquad}
                        </p>
                        <p className="text-[10px] text-white/35 leading-tight mt-0.5">players</p>
                      </div>
                    </div>

                    {/* Purse bar */}
                    <div className="mt-2 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: `${usedPct}%`, backgroundColor: t.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Last Actions / Bid History ── */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-white/8 overflow-hidden">
            <div className="flex items-center px-3 py-2 border-b border-white/8 flex-shrink-0">
              <span className="text-xs font-black uppercase tracking-wider text-white/50">Last Actions</span>
            </div>

            {/* Latest action highlight */}
            <div className="px-3 py-1.5 bg-yellow-400/5 border-b border-yellow-400/10 flex-shrink-0">
              <p className="text-xs text-yellow-300/70 font-medium truncate">Bid raised → Mumbai Heroes · {fmt(currentBid)}</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              {BIDS.map((b, i) => (
                <div key={i} className="flex items-center justify-between py-2 px-3 border-b border-white/5 last:border-0 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                    <div className="min-w-0">
                      <p className="text-xs text-white/55 truncate font-medium">{b.player}</p>
                      <p className="text-[11px] text-white/30 truncate">{b.team}</p>
                    </div>
                  </div>
                  <span className="text-sm font-mono font-semibold text-yellow-400/80 flex-shrink-0">{fmt(b.amt)}</span>
                </div>
              ))}
              {BIDS.length === 0 && (
                <p className="text-center text-sm text-white/25 py-6">No bids yet</p>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ══════════ KEYBOARD SHORTCUT STRIP ═════════════════════════════════ */}
      <div className="flex-shrink-0 h-7 bg-[#0d0f14] border-t border-white/5 flex items-center justify-center gap-6">
        {["[S] Sold","[U] Unsold","[D] Defer","[M] Manual","[Space] Start/Stop Bidding","[N] Next Player","[Z] Undo"].map((s, i) => (
          <span key={i} className="text-[10px] text-white/22 font-medium">{s}</span>
        ))}
      </div>

    </div>
  );
}
