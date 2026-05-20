import { useState } from "react";

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  // Indian short format e.g. 2400000 → ₹24L, 100000 → ₹1L, 10000000 → ₹1Cr
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1).replace(/\.0$/, "")}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}
function fmtFull(n: number) {
  return "₹" + n.toLocaleString("en-IN");
}

const TEAMS = [
  { id: 1, name: "Mumbai Heroes",   short: "MH", color: "#3b82f6", purse: 4800000, used: 3200000, max: 8000000, players: 6,  maxSquad: 15, reserved: 200000, slotsNeeded: 1, topPlayer: "Virat K", topAmt: 2000000, leading: true  },
  { id: 2, name: "Chennai Kings",   short: "CK", color: "#f59e0b", purse: 3500000, used: 4500000, max: 8000000, players: 5,  maxSquad: 15, reserved: 0,      slotsNeeded: 0, topPlayer: "M Dhoni",  topAmt: 1800000, leading: false },
  { id: 3, name: "Bangalore Bulls", short: "BB", color: "#ef4444", purse: 5200000, used: 2800000, max: 8000000, players: 4,  maxSquad: 15, reserved: 400000, slotsNeeded: 2, topPlayer: "AB de V",  topAmt: 1600000, leading: false },
  { id: 4, name: "Delhi Dons",      short: "DD", color: "#8b5cf6", purse: 4100000, used: 3900000, max: 8000000, players: 6,  maxSquad: 15, reserved: 0,      slotsNeeded: 0, topPlayer: "R Sharma", topAmt: 2000000, leading: false },
  { id: 5, name: "Kolkata Knights", short: "KK", color: "#10b981", purse: 2900000, used: 5100000, max: 8000000, players: 7,  maxSquad: 15, reserved: 300000, slotsNeeded: 1, topPlayer: "S Narine",  topAmt: 1200000, leading: false },
  { id: 6, name: "Punjab Power",    short: "PP", color: "#f97316", purse: 6000000, used: 2000000, max: 8000000, players: 3,  maxSquad: 15, reserved: 0,      slotsNeeded: 0, topPlayer: "S Gill",    topAmt: 1200000, leading: false },
];
const QUEUE = [
  { id: 1, name: "Rohit Sharma",      role: "BAT",  cat: "Platinum", catColor: "#eab308", base: 2000000, jersey: "45", active: true  },
  { id: 2, name: "Jasprit Bumrah",    role: "BOWL", cat: "Platinum", catColor: "#eab308", base: 1800000, jersey: "93", active: false },
  { id: 3, name: "KL Rahul",          role: "WK",   cat: "Gold",     catColor: "#f59e0b", base: 1500000, jersey: "1",  active: false },
  { id: 4, name: "Hardik Pandya",     role: "AR",   cat: "Platinum", catColor: "#eab308", base: 1600000, jersey: "33", active: false },
  { id: 5, name: "Yuzvendra Chahal",  role: "BOWL", cat: "Gold",     catColor: "#f59e0b", base: 1000000, jersey: "3",  active: false },
  { id: 6, name: "Shubman Gill",      role: "BAT",  cat: "Gold",     catColor: "#f59e0b", base: 1200000, jersey: "77", active: false },
  { id: 7, name: "Sanju Samson",      role: "WK",   cat: "Gold",     catColor: "#f59e0b", base: 1400000, jersey: "8",  active: false },
  { id: 8, name: "R. Ashwin",         role: "BOWL", cat: "Silver",   catColor: "#94a3b8", base: 800000,  jersey: "99", active: false },
  { id: 9, name: "S. Iyer",           role: "BAT",  cat: "Gold",     catColor: "#f59e0b", base: 1100000, jersey: "41", active: false },
];
const BIDS = [
  { player: "Rohit Sharma",     team: "Mumbai Heroes",   color: "#3b82f6", amt: 2400000 },
  { player: "Rohit Sharma",     team: "Bangalore Bulls", color: "#ef4444", amt: 2200000 },
  { player: "Rohit Sharma",     team: "Mumbai Heroes",   color: "#3b82f6", amt: 2000000 },
  { player: "J. Bumrah (prev)", team: "Chennai Kings",   color: "#f59e0b", amt: 2100000 },
  { player: "J. Bumrah (prev)", team: "Mumbai Heroes",   color: "#3b82f6", amt: 1900000 },
];

export function BeginnerFriendly() {
  const [queueTab, setQueueTab] = useState<"queue"|"sold"|"unsold">("queue");
  const [roleFilter, setRoleFilter] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [timerSecs, setTimerSecs] = useState("30");
  const [breakActive, setBreakActive] = useState(false);
  const [showBreakRow, setShowBreakRow] = useState(false);
  const [ledMode, setLedMode] = useState<"off"|"team"|"player"|"top5">("off");
  const [displayTheme, setDisplayTheme] = useState(0);

  const themes = [
    { dot: "#eab308" }, { dot: "#3b82f6" }, { dot: "#ef4444" }, { dot: "#8b5cf6" }, { dot: "#10b981" },
  ];

  const filteredQueue = QUEUE.filter(p => {
    const matchRole =
      roleFilter === "all" ? true :
      roleFilter === "bat"  ? p.role === "BAT"  :
      roleFilter === "bowl" ? p.role === "BOWL" :
      roleFilter === "ar"   ? p.role === "AR"   :
      roleFilter === "wk"   ? p.role === "WK"   : true;
    const matchSearch = p.name.toLowerCase().includes(playerSearch.toLowerCase());
    return matchRole && matchSearch;
  });

  const roleCounts = {
    bat: QUEUE.filter(p => p.role === "BAT").length,
    bowl: QUEUE.filter(p => p.role === "BOWL").length,
    ar: QUEUE.filter(p => p.role === "AR").length,
    wk: QUEUE.filter(p => p.role === "WK").length,
  };

  const currentPlayer = QUEUE[0];
  const currentBid = 2400000;
  const leadingTeam = TEAMS[0];
  const increment = 200000;
  const timerSec = 18;
  const isActive = true;
  const timerRunning = true;

  return (
    <div className="h-screen bg-[#0f1117] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ══════════ TOP STATUS BAR ══════════════════════════════════════════ */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#141720] border-b border-white/8 flex-wrap min-h-[44px] z-10">

        {/* Status badge */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border bg-green-500/15 border-green-500/40 text-green-400 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          ACTIVE
        </span>

        {/* Stats pills */}
        <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
          <span className="text-white/40">SOLD <span className="text-green-400 font-bold">12</span></span>
          <span className="text-white/40">UNSOLD <span className="text-red-400 font-bold">3</span></span>
          <span className="text-white/40">LEFT <span className="text-white font-bold">18</span></span>
          <span className="text-white/40">RET <span className="text-purple-400 font-bold">2</span></span>
        </div>

        {/* Auction code */}
        <span className="font-mono text-[10px] tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded px-1.5 py-0.5 flex-shrink-0">
          IPL2025
        </span>

        <div className="w-px h-4 bg-white/12 flex-shrink-0" />

        {/* Category filter */}
        <button className="flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-white/15 text-[11px] font-semibold text-white/50 hover:text-white hover:bg-white/8 transition-all flex-shrink-0">
          <span className="text-[10px]">⬡</span> All Categories
        </button>

        {/* Start/Pause auction */}
        <button className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-bold rounded-md bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 hover:bg-yellow-400/25 transition-all flex-shrink-0">
          ⏸ Pause Session
        </button>

        {/* Undo */}
        <button title="Undo Last Action [Z]" className="h-7 w-7 flex items-center justify-center text-white/35 hover:text-white hover:bg-white/8 rounded-md transition-all flex-shrink-0">
          ↺
        </button>

        <div className="flex-1 min-w-0" />

        {/* Trial badge */}
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
          Trial Mode
        </span>

        {/* LED overlay controls */}
        <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-white/10 bg-white/4 flex-shrink-0">
          <span className="text-[9px] font-bold uppercase tracking-wider text-white/30 pr-1.5 border-r border-white/10 mr-0.5 leading-tight">LED<br/>SCREEN</span>
          {(["team","player","top5"] as const).map(m => (
            <button key={m} onClick={() => setLedMode(ledMode === m ? "off" : m)}
              className={`flex items-center gap-1 h-7 px-2.5 rounded text-[10px] font-bold transition-all ${ledMode === m ? (m === "team" ? "bg-yellow-400 text-black" : m === "player" ? "bg-blue-500 text-white" : "bg-purple-600 text-white") : "text-white/35 hover:text-white hover:bg-white/8"}`}>
              {m === "team" ? "🏆" : m === "player" ? "👤" : "★"} <span className="capitalize">{m === "top5" ? "Top 5" : m}</span>
            </button>
          ))}
          <div className="w-px h-5 bg-white/10 mx-0.5" />
          <button className="flex items-center gap-1 h-7 px-2 rounded text-[10px] font-bold text-green-400 hover:bg-green-500/15 transition-all">
            📺 <span>{ledMode === "off" ? "Live" : "→ Live"}</span>
          </button>
        </div>

        {/* Display theme dots */}
        <div className="hidden sm:flex items-center gap-0.5 border border-white/10 rounded-md px-1.5 py-1.5 flex-shrink-0">
          {themes.map((t, i) => (
            <button key={i} onClick={() => setDisplayTheme(i)}
              className={`w-3 h-3 rounded-full transition-all ${displayTheme === i ? "ring-1 ring-white ring-offset-1 ring-offset-[#141720] scale-110" : "opacity-40 hover:opacity-80"}`}
              style={{ backgroundColor: t.dot }} />
          ))}
        </div>

        {/* Open Display button */}
        <button className="h-7 px-2.5 flex items-center gap-1.5 text-[11px] font-semibold rounded-md border border-white/12 text-white/45 hover:text-white hover:border-white/25 transition-all flex-shrink-0">
          📺 Open Display ↗
        </button>

        {/* Connection status */}
        <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-green-500/40 bg-green-500/10 text-green-400 text-[11px] font-semibold flex-shrink-0">
          <span>⚡</span> <span className="hidden sm:inline">Live</span>
        </div>

        {/* Break timer badge — when active */}
        {breakActive && (
          <div className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-300 text-[10px] font-semibold flex-shrink-0">
            ☕ Break <span className="font-mono font-black">03:24</span>
          </div>
        )}
      </div>

      {/* ══════════ MAIN 3-COLUMN LAYOUT ════════════════════════════════════ */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── LEFT: PLAYER QUEUE ──────────────────────────────────────────── */}
        <div className="w-56 flex-shrink-0 bg-[#141720] border-r border-white/8 flex flex-col min-h-0">

          {/* Queue header + sort button */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0">
            <span className="text-[10px] font-black uppercase tracking-[0.12em] text-white/35">Player Queue</span>
            <div className="flex items-center gap-1">
              <button className="w-5 h-5 flex items-center justify-center text-white/25 hover:text-white/60 text-xs rounded transition-colors" title="Random player">🔀</button>
            </div>
          </div>

          {/* Tab strip: Queue / Sold / Unsold */}
          <div className="flex border-b border-white/6 flex-shrink-0">
            {(["queue","sold","unsold"] as const).map(t => (
              <button key={t} onClick={() => setQueueTab(t)}
                className={`flex-1 text-[10px] py-1.5 font-bold capitalize transition-all ${queueTab === t ? "text-yellow-300 border-b-2 border-yellow-400 bg-yellow-400/5" : "text-white/25 hover:text-white/45"}`}>
                {t === "queue" ? `Queue (${QUEUE.length})` : t === "sold" ? "Sold (12)" : "Unsold (3)"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 flex-shrink-0 border-b border-white/5">
            <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
              placeholder="Search player…"
              className="w-full h-6 px-2 text-[10px] bg-white/5 border border-white/8 rounded text-white/60 placeholder:text-white/20 outline-none focus:border-yellow-400/30" />
          </div>

          {/* Role filter tabs */}
          {queueTab === "queue" && (
            <div className="flex gap-1 px-2 py-1.5 flex-shrink-0 flex-wrap border-b border-white/5">
              {([
                { k: "all", l: "ALL", c: QUEUE.length },
                { k: "bat", l: "BAT", c: roleCounts.bat },
                { k: "bowl",l: "BOWL",c: roleCounts.bowl },
                { k: "ar",  l: "AR",  c: roleCounts.ar },
                { k: "wk",  l: "WK",  c: roleCounts.wk },
              ]).map(({ k, l, c }) => (
                <button key={k} onClick={() => setRoleFilter(k)}
                  className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wide transition-all ${roleFilter === k ? "bg-yellow-400 text-black" : "text-white/30 bg-white/5 hover:bg-white/8 hover:text-white/60"}`}>
                  {l} <span className="opacity-70 font-mono">{c}</span>
                </button>
              ))}
            </div>
          )}

          {/* Player list */}
          <div className="flex-1 overflow-y-auto">
            {queueTab === "unsold" && (
              <div className="px-2 py-2 border-b border-white/6">
                <button className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[10px] font-semibold hover:bg-orange-500/20 transition-all">
                  ↻ Re-auction all 3 unsold
                </button>
              </div>
            )}
            <div className="space-y-0">
              {filteredQueue.map((p, idx) => (
                <div key={p.id} className={`flex items-center gap-2 px-2 py-2 border-b border-white/4 transition-all cursor-pointer group ${p.active ? "bg-yellow-400/8 border-yellow-400/15" : "hover:bg-white/4"}`}>
                  <span className="text-[9px] text-white/20 w-4 text-right flex-shrink-0 font-mono">{idx + 1}</span>
                  <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: p.catColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      {p.jersey && <span className="text-[8px] text-white/20 font-mono">#{p.jersey}</span>}
                      <p className={`text-[10px] font-semibold truncate ${p.active ? "text-yellow-200" : "text-white/60 group-hover:text-white/80"}`}>{p.name}</p>
                    </div>
                    <p className="text-[9px] text-white/25">{p.role} · {fmt(p.base)}</p>
                  </div>
                  {p.active
                    ? <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                    : <button className="text-[9px] text-white/15 hover:text-white/50 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">▶</button>
                  }
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CENTER: AUCTION CORE ─────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* Bid timer bar */}
          <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2.5 border-b border-white/8 bg-[#0f1117]">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/30">Bid Timer</span>

              {/* Timer duration input */}
              <div className="flex items-center gap-1">
                <input value={timerSecs} onChange={e => setTimerSecs(e.target.value)}
                  className="w-10 h-6 text-center text-[11px] font-mono font-bold bg-white/6 border border-white/12 rounded text-white/70 outline-none focus:border-yellow-400/40" />
                <span className="text-[9px] text-white/25">sec</span>
              </div>

              {timerRunning ? (
                <button className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-bold rounded-lg bg-red-500/15 border border-red-500/35 text-red-400 hover:bg-red-500/25 transition-all">
                  ⏹ Stop Bidding
                </button>
              ) : (
                <button className="h-7 px-3 flex items-center gap-1.5 text-[11px] font-bold rounded-lg bg-emerald-500/15 border border-emerald-500/35 text-emerald-400 hover:bg-emerald-500/25 transition-all">
                  ▶ Start Bidding
                </button>
              )}

              <button className="h-7 px-2.5 text-[10px] font-semibold bg-white/5 border border-white/10 rounded-md text-white/35 hover:text-white/60 transition-all">
                +30s
              </button>
            </div>

            <div className="flex-1" />

            {/* LED countdown controls inline */}
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/25">LED Countdown</span>
              <button onClick={() => setShowBreakRow(!showBreakRow)}
                className="h-6 px-2.5 flex items-center gap-1 text-[10px] font-semibold rounded border border-amber-500/35 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">
                ☕ Break
              </button>
              <button className="h-6 px-2.5 flex items-center gap-1 text-[10px] font-semibold rounded border border-white/15 bg-white/5 text-white/40 hover:text-white/60 transition-all">
                ⏰ Pre-Auction
              </button>
            </div>
          </div>

          {/* Break timer config row (collapsible) */}
          {showBreakRow && (
            <div className="flex-shrink-0 flex items-center gap-3 px-5 py-2 bg-amber-500/5 border-b border-amber-500/15">
              <span className="text-[10px] text-amber-300 font-semibold">☕ Break Timer</span>
              <input defaultValue="5" className="w-10 h-6 text-center text-[11px] font-mono bg-white/6 border border-amber-500/25 rounded text-white/70 outline-none" />
              <span className="text-[9px] text-white/30">min</span>
              <input defaultValue="Lunch Break" placeholder="Label (optional)" className="h-6 px-2 text-[10px] bg-white/6 border border-amber-500/25 rounded text-white/60 outline-none w-36" />
              <button onClick={() => { setBreakActive(true); setShowBreakRow(false); }}
                className="h-6 px-3 text-[10px] font-bold rounded bg-amber-500 text-black hover:bg-amber-400 transition-all">
                Start
              </button>
              {breakActive && (
                <>
                  <span className="font-mono text-amber-300 font-black text-sm">03:24</span>
                  <button className="h-6 px-2 text-[9px] font-semibold rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all">+5min</button>
                  <button onClick={() => setBreakActive(false)} className="h-6 px-2 text-[9px] text-red-400 hover:text-red-300 transition-colors">Cancel</button>
                </>
              )}
            </div>
          )}

          {/* Step indicator */}
          <div className="flex-shrink-0 flex items-center gap-2 px-5 py-2 border-b border-white/5">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/20 text-yellow-300 text-[11px] font-semibold">
              <span className="w-4 h-4 rounded-full bg-yellow-400 text-black flex items-center justify-center text-[9px] font-black">2</span>
              Bidding in progress
            </div>
            <span className="text-white/25 text-xs">·</span>
            <span className="text-white/35 text-xs">Stop bidding, then click SOLD or UNSOLD to conclude</span>
          </div>

          {/* Scrollable core */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-5 py-4 space-y-4 max-w-2xl mx-auto">

              {/* ── CURRENT PLAYER CARD ── */}
              <div className="rounded-2xl border border-white/10 overflow-hidden" style={{ background: "linear-gradient(135deg, #1a1f2e, #141820)" }}>
                <div className="flex items-stretch gap-0">
                  {/* Photo placeholder */}
                  <div className="w-20 h-24 flex-shrink-0 bg-white/6 flex items-center justify-center">
                    <span className="text-4xl">👤</span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 px-5 py-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{ color: currentPlayer.catColor }}>
                          {currentPlayer.role} · {currentPlayer.cat}
                        </p>
                        <h2 className="text-2xl font-black leading-tight truncate text-white">
                          {currentPlayer.name}
                        </h2>
                      </div>
                      <span className="text-3xl font-black text-white/10 flex-shrink-0">#{currentPlayer.jersey}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-[10px] text-white/40">Age <span className="text-white/70 font-semibold">36</span></span>
                      <span className="text-[10px] text-white/40">Mumbai</span>
                      <span className="text-[10px] text-white/40">Right-hand Bat</span>
                      <span className="text-[10px] text-white/40">Off-break</span>
                      <span className="text-[10px] text-white/40">Base <span className="text-white/70 font-semibold">{fmt(currentPlayer.base)}</span></span>
                    </div>
                    <p className="text-[10px] text-white/30 mt-1 line-clamp-1">Captain · 3x IPL winner · T20 World Cup squad</p>
                  </div>
                </div>
              </div>

              {/* ── TIMER + BID SIDE BY SIDE ── */}
              <div className="grid grid-cols-2 gap-4">

                {/* Timer */}
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
                    <div className={`w-1.5 h-1.5 rounded-full ${timerRunning ? "bg-yellow-400 animate-pulse" : "bg-white/20"}`} />
                    <span className={`text-xs font-semibold ${timerRunning ? "text-yellow-300" : "text-white/30"}`}>
                      {timerRunning ? "Timer running" : "Timer stopped"}
                    </span>
                  </div>
                  <p className="text-[9px] text-white/20 mt-0.5">of {timerSecs}s bid window</p>
                </div>

                {/* Current bid */}
                <div className="flex flex-col items-center justify-center py-3 rounded-2xl border border-white/8 bg-[#141820] text-center">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/30 mb-1">Current Bid</p>
                  <div className="text-5xl font-black text-yellow-400 leading-none mb-2"
                    style={{ textShadow: "0 0 30px rgba(250,204,21,0.35)" }}>
                    {fmt(currentBid)}
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: leadingTeam.color }} />
                    <span className="text-sm font-bold" style={{ color: leadingTeam.color }}>{leadingTeam.name}</span>
                  </div>
                  <p className="text-[9px] text-white/25 mt-1.5">Base {fmtFull(currentPlayer.base)} · +{fmt(increment)}/raise</p>
                </div>
              </div>

              {/* ── SOLD / UNSOLD / DEFER / MANUAL ── */}
              <div className="grid grid-cols-4 gap-2">
                <button className="col-span-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl border-2 font-bold text-sm transition-all bg-green-600/15 border-green-600/60 text-green-400 hover:bg-green-600/25 hover:scale-[1.02] shadow-[0_0_16px_rgba(34,197,94,0.2)]">
                  <span className="text-xl">✔</span>
                  <span>SOLD</span>
                  <span className="text-[9px] font-normal opacity-60">Assign [S]</span>
                </button>
                <button className="col-span-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl border-2 font-bold text-sm transition-all bg-red-600/10 border-red-600/50 text-red-400 hover:bg-red-600/20 hover:scale-[1.02]">
                  <span className="text-xl">✘</span>
                  <span>UNSOLD</span>
                  <span className="text-[9px] font-normal opacity-60">No bids [U]</span>
                </button>
                <button className="col-span-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl border-2 font-bold text-sm transition-all bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/15 hover:scale-[1.02]">
                  <span className="text-xl">⏳</span>
                  <span>DEFER</span>
                  <span className="text-[9px] font-normal opacity-60">Back of queue [D]</span>
                </button>
                <button className="col-span-1 flex flex-col items-center justify-center gap-1 py-3.5 rounded-xl border-2 font-bold text-sm transition-all bg-blue-500/10 border-blue-500/40 text-blue-400 hover:bg-blue-500/15 hover:scale-[1.02]">
                  <span className="text-xl">⚙</span>
                  <span>MANUAL</span>
                  <span className="text-[9px] font-normal opacity-60">Set amount [M]</span>
                </button>
              </div>

              {/* ── NEXT PLAYER + START/STOP BIDDING ── */}
              <div className="grid grid-cols-5 gap-2">
                <button className="col-span-3 flex items-center justify-center gap-3 py-4 rounded-xl font-black text-xl transition-all bg-gradient-to-r from-yellow-500/90 to-yellow-400 text-black hover:from-yellow-400 hover:to-yellow-300 shadow-[0_0_28px_rgba(234,179,8,0.4)] hover:scale-[1.01]">
                  ⏭ NEXT PLAYER
                  <span className="text-sm font-normal opacity-60 font-mono">N</span>
                </button>
                <button className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-lg transition-all bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.01]">
                  ▶ START BIDDING
                </button>
              </div>

              {/* ── QUICK BID SECTION ── */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-2">
                  Quick Bid — Next raise: <span className="text-yellow-400 font-mono">{fmtFull((currentBid) + increment)}</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TEAMS.map(t => {
                    const spendable = t.purse;
                    const reserved = t.reserved;
                    const canBid = !t.leading && spendable >= currentBid + increment;
                    return (
                      <button key={t.id} disabled={!canBid}
                        className={`relative p-3 rounded-xl border-2 text-left transition-all ${t.leading ? "scale-[1.01]" : ""} ${!canBid ? "opacity-35 cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"}`}
                        style={{
                          borderColor: t.leading ? t.color : `${t.color}30`,
                          boxShadow: t.leading ? `0 0 16px ${t.color}44` : undefined,
                          background: `${t.color}0d`,
                        }}>
                        {t.leading && (
                          <div className="absolute top-1.5 right-2 flex items-center gap-0.5">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: t.color }} />
                            <span className="text-[9px] font-black" style={{ color: t.color }}>LEAD</span>
                          </div>
                        )}
                        {t.players >= t.maxSquad && !t.leading && (
                          <div className="absolute top-1.5 right-2">
                            <span className="text-[8px] font-black text-red-400">Full</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-5 h-5 rounded flex items-center justify-center text-[9px] font-black flex-shrink-0"
                            style={{ background: `${t.color}33`, color: t.color }}>
                            {t.short}
                          </div>
                          <span className="text-xs font-bold truncate text-white/80">{t.short}</span>
                        </div>
                        <p className="text-[10px] text-white/40">{fmt(spendable)} spendable</p>
                        {reserved > 0 && (
                          <p className="text-[9px] text-amber-400/60">⚠ {fmt(reserved)} reserved · {t.slotsNeeded}slot</p>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* ── RIGHT: TEAMS + BID HISTORY ─────────────────────────────────── */}
        <div className="w-60 flex-shrink-0 border-l border-white/8 bg-[#141720] flex flex-col min-h-0">

          {/* Teams & Purse */}
          <div className="flex flex-col flex-shrink-0" style={{ maxHeight: "52%" }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">🏆</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-white/45">Teams &amp; Purse</span>
              </div>
              <button className="text-[9px] text-white/25 hover:text-white/50 transition-colors flex items-center gap-0.5">
                All ↗
              </button>
            </div>

            <div className="overflow-y-auto flex-1">
              <div className="p-2 grid grid-cols-2 gap-1.5">
                {TEAMS.map(t => {
                  const usedPct = Math.min(100, Math.round((t.used / t.max) * 100));
                  const maxReached = t.players >= t.maxSquad;
                  return (
                    <div key={t.id} className={`rounded-lg p-2 border transition-all ${t.leading ? "border-2 scale-[1.02]" : "border-white/8"}`}
                      style={{
                        borderColor: t.leading ? t.color : undefined,
                        boxShadow: t.leading ? `0 0 12px ${t.color}33` : undefined,
                        background: `${t.color}08`,
                      }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className="w-5 h-5 rounded text-[8px] font-black flex items-center justify-center flex-shrink-0"
                          style={{ background: `${t.color}25`, color: t.color }}>
                          {t.short.slice(0, 3)}
                        </div>
                        <span className="text-[10px] font-bold truncate text-white/75">{t.short}</span>
                        {t.leading && <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ backgroundColor: t.color }} />}
                        {t.reserved > 0 && <span className="text-amber-400/60 text-[9px] ml-auto">⚠</span>}
                      </div>
                      <p className={`text-xs font-mono font-bold ${maxReached ? "text-red-400" : "text-emerald-400"}`}>
                        {maxReached ? "FULL" : fmt(t.purse)}
                      </p>
                      <p className="text-[8px] text-white/30 leading-none">max bid</p>
                      {t.reserved > 0 && (
                        <p className="text-[9px] text-amber-400/55 font-mono mt-0.5">+{fmt(t.reserved)} rsv · {t.slotsNeeded}slot</p>
                      )}
                      <div className="mt-1.5 h-1 bg-white/8 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, backgroundColor: t.color }} />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className={`text-[9px] font-medium ${maxReached ? "text-red-400" : t.slotsNeeded > 0 ? "text-amber-400" : "text-green-400/70"}`}>
                          {t.players}/{t.maxSquad}p
                        </span>
                        {maxReached && <span className="text-[8px] text-red-400 font-bold">FULL</span>}
                        {t.slotsNeeded > 0 && !maxReached && <span className="text-[8px] text-amber-400/60">need {t.slotsNeeded}</span>}
                      </div>
                      <div className="flex items-center gap-0.5 mt-0.5 min-w-0">
                        <span className="text-[8px] text-amber-400/40">★</span>
                        <span className="text-[8px] text-white/30 truncate">{t.topPlayer}</span>
                        <span className="text-[8px] font-mono text-amber-400/50 ml-auto flex-shrink-0">{fmt(t.topAmt)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Last Actions / Bid History */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-white/8 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px]">📋</span>
                <span className="text-[10px] font-black uppercase tracking-wider text-white/45">Last Actions</span>
              </div>
            </div>

            {/* Latest action highlight */}
            <div className="px-3 py-1.5 bg-yellow-400/5 border-b border-yellow-400/10 flex-shrink-0">
              <p className="text-[10px] text-yellow-300/70 font-medium truncate">Bid raised by Mumbai Heroes → {fmt(currentBid)}</p>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="space-y-0">
                {BIDS.map((b, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 px-3 border-b border-white/5 last:border-0 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                      <div className="min-w-0">
                        <p className="text-[10px] text-white/40 truncate">{b.player}</p>
                        <p className="text-[9px] text-white/25 truncate">{b.team}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-yellow-400/80 flex-shrink-0">{fmt(b.amt)}</span>
                  </div>
                ))}
                {BIDS.length === 0 && (
                  <p className="text-center text-[11px] text-white/25 py-6">No bids yet</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ══════════ KEYBOARD SHORTCUT STRIP ═════════════════════════════════ */}
      <div className="flex-shrink-0 h-7 bg-[#0d0f14] border-t border-white/5 flex items-center justify-center gap-6">
        {["[S] Sold", "[U] Unsold", "[D] Defer", "[M] Manual", "[Space] Start/Stop Bidding", "[N] Next Player", "[Z] Undo"].map((s, i) => (
          <span key={i} className="text-[9px] text-white/20 font-medium">{s}</span>
        ))}
      </div>

    </div>
  );
}
