import { useState, useRef, useEffect } from "react";

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
  { id:  1, name: "Rohit Sharma",    role: "BAT",  cat: "Platinum", catColor: "#eab308", base: 2000000, jersey: "45", status: "active",    soldAmt: null,    soldTeam: null,           retainedAmt: null    },
  { id:  2, name: "Jasprit Bumrah",  role: "BOWL", cat: "Platinum", catColor: "#eab308", base: 1800000, jersey: "93", status: "available", soldAmt: null,    soldTeam: null,           retainedAmt: null    },
  { id:  3, name: "KL Rahul",        role: "WK",   cat: "Gold",     catColor: "#f59e0b", base: 1500000, jersey: "1",  status: "available", soldAmt: null,    soldTeam: null,           retainedAmt: null    },
  { id:  4, name: "Hardik Pandya",   role: "AR",   cat: "Platinum", catColor: "#eab308", base: 1600000, jersey: "33", status: "sold",      soldAmt: 2100000, soldTeam: "Mumbai Heroes", retainedAmt: null   },
  { id:  5, name: "Y. Chahal",       role: "BOWL", cat: "Gold",     catColor: "#f59e0b", base: 1000000, jersey: "3",  status: "unsold",    soldAmt: null,    soldTeam: null,           retainedAmt: null    },
  { id:  6, name: "Shubman Gill",    role: "BAT",  cat: "Gold",     catColor: "#f59e0b", base: 1200000, jersey: "77", status: "sold",      soldAmt: 1400000, soldTeam: "Punjab Power",  retainedAmt: null   },
  { id:  7, name: "Sanju Samson",    role: "WK",   cat: "Gold",     catColor: "#f59e0b", base: 1400000, jersey: "8",  status: "retained",  soldAmt: null,    soldTeam: "Delhi Dons",    retainedAmt: 1800000},
  { id:  8, name: "R. Ashwin",       role: "BOWL", cat: "Silver",   catColor: "#94a3b8", base: 800000,  jersey: "99", status: "available", soldAmt: null,    soldTeam: null,           retainedAmt: null    },
  { id:  9, name: "S. Iyer",         role: "BAT",  cat: "Gold",     catColor: "#f59e0b", base: 1100000, jersey: "41", status: "sold",      soldAmt: 1600000, soldTeam: "Chennai Kings", retainedAmt: null   },
  { id: 10, name: "V. Kohli",        role: "BAT",  cat: "Platinum", catColor: "#eab308", base: 2000000, jersey: "18", status: "retained",  soldAmt: null,    soldTeam: "Bangalore Bulls",retainedAmt:2000000},
  { id: 11, name: "M. Shami",        role: "BOWL", cat: "Gold",     catColor: "#f59e0b", base: 1200000, jersey: "11", status: "unsold",    soldAmt: null,    soldTeam: null,           retainedAmt: null    },
  { id: 12, name: "R. Pant",         role: "WK",   cat: "Gold",     catColor: "#f59e0b", base: 1500000, jersey: "17", status: "available", soldAmt: null,    soldTeam: null,           retainedAmt: null    },
];
const BIDS = [
  { player: "Rohit Sharma",     team: "Mumbai Heroes",   color: "#3b82f6", amt: 2400000 },
  { player: "Rohit Sharma",     team: "Bangalore Bulls", color: "#ef4444", amt: 2200000 },
  { player: "Rohit Sharma",     team: "Mumbai Heroes",   color: "#3b82f6", amt: 2000000 },
  { player: "J. Bumrah (prev)", team: "Chennai Kings",   color: "#f59e0b", amt: 2100000 },
  { player: "J. Bumrah (prev)", team: "Mumbai Heroes",   color: "#3b82f6", amt: 1900000 },
];

export function BeginnerFriendly() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [timerSecs, setTimerSecs]       = useState("30");
  const [biddingRunning, setBiddingRunning] = useState(true);   // true = bidding is live
  const [breakActive, setBreakActive]   = useState(false);
  const [showBreakRow, setShowBreakRow] = useState(false);
  const [ledMode, setLedMode]           = useState<"off"|"team"|"player"|"top5">("off");
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  // Close filter panel when clicking outside
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filterBtnRef.current && !filterBtnRef.current.closest("[data-filter-root]")?.contains(e.target as Node)) {
        setShowFilterPanel(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const statusCounts = {
    all:       QUEUE.length,
    available: QUEUE.filter(p => p.status === "available" || p.status === "active").length,
    sold:      QUEUE.filter(p => p.status === "sold").length,
    unsold:    QUEUE.filter(p => p.status === "unsold").length,
    retained:  QUEUE.filter(p => p.status === "retained").length,
  };

  const filteredQueue = QUEUE.filter(p => {
    const matchStatus =
      statusFilter === "all"       ? true :
      statusFilter === "available" ? (p.status === "available" || p.status === "active") :
      p.status === statusFilter;
    return matchStatus && p.name.toLowerCase().includes(playerSearch.toLowerCase());
  });

  const currentPlayer = QUEUE[0];
  const currentBid    = 2400000;
  const leadingTeam   = TEAMS[0];
  const increment     = 200000;
  const timerSec      = 18;

  const activeFilterLabel = statusFilter === "all" ? null : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1);

  return (
    <div className="h-screen bg-[#0f1117] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ══════════ TOP STATUS BAR ══════════════════════════════════════════ */}
      <div className="flex-shrink-0 flex items-center gap-2 px-3 py-2 bg-[#141720] border-b border-white/8 flex-wrap min-h-[44px] z-10">

        {/* Status badge */}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider border bg-green-500/15 border-green-500/40 text-green-400 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          ACTIVE
        </span>

        {/* Stats */}
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

        {/* Re-auction last player */}
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

        {/* ── BIDWAR branding — centred between Settings and Trial Mode ── */}
        <div className="flex-1 min-w-0 flex items-center justify-center">
          <div className="flex items-center gap-2 select-none">
            {/* Gavel icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
              <path d="M14 4L20 10L10 20L4 14L14 4Z" stroke="#eab308" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M20 10L22 12" stroke="#eab308" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 14L2 16" stroke="#eab308" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8 20H4V16" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {/* Wordmark */}
            <span className="text-lg font-black tracking-tight leading-none">
              <span className="text-yellow-400">BID</span><span className="text-white">WAR</span>
            </span>
          </div>
        </div>

        {/* Trial badge */}
        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex-shrink-0">
          Trial Mode
        </span>

        {/* LED overlay controls — MAIN VIEW first */}
        <div className="flex items-center gap-0.5 px-1.5 py-1 rounded-lg border border-white/10 bg-white/4 flex-shrink-0">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/30 pr-1.5 border-r border-white/10 mr-0.5 leading-tight">LED<br/>SCREEN</span>

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

          {([
            { mode: "team"   as const, label: "Team",   icon: "🏆", activeClass: "bg-yellow-400 text-black"  },
            { mode: "player" as const, label: "Player",  icon: "👤", activeClass: "bg-blue-500 text-white"   },
            { mode: "top5"   as const, label: "Top 5",   icon: "★",  activeClass: "bg-purple-600 text-white" },
          ]).map(({ mode, label, icon, activeClass }) => (
            <button key={mode}
              onClick={() => setLedMode(ledMode === mode ? "off" : mode)}
              className={`flex items-center gap-1 h-7 px-2.5 rounded text-xs font-bold transition-all ${
                ledMode === mode ? `${activeClass} shadow-md ring-1 ring-white/20` : "text-white/35 hover:text-white hover:bg-white/8"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

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
        <div className="w-60 flex-shrink-0 bg-[#141720] border-r border-white/8 flex flex-col min-h-0">

          {/* Header: title + filter toggle + shuffle */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8 flex-shrink-0">
            <span className="text-xs font-black uppercase tracking-widest text-white/40">
              Players
              <span className="ml-1.5 text-white/25 font-normal normal-case tracking-normal">({filteredQueue.length})</span>
            </span>
            <div className="flex items-center gap-1.5">
              {/* Filter toggle button */}
              <div className="relative" data-filter-root>
                <button
                  ref={filterBtnRef}
                  onClick={() => setShowFilterPanel(v => !v)}
                  className={`flex items-center gap-1 h-6 px-2 rounded text-[11px] font-bold transition-all border ${
                    showFilterPanel || statusFilter !== "all"
                      ? "bg-yellow-400/15 border-yellow-400/40 text-yellow-300"
                      : "border-white/12 text-white/35 hover:text-white/65 hover:border-white/25"
                  }`}
                >
                  🎛
                  <span>{activeFilterLabel ?? "Filter"}</span>
                  <span className="text-[9px] opacity-50">{showFilterPanel ? "▲" : "▼"}</span>
                </button>

                {/* Status filter flyout */}
                {showFilterPanel && (
                  <div className="absolute top-full left-0 mt-1 z-50 rounded-xl border border-white/12 bg-[#1a1f2e] shadow-2xl overflow-hidden" style={{ minWidth: "210px" }}>
                    <div className="px-3 py-2 border-b border-white/8 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-white/35">Filter by Status</span>
                      <button onClick={() => setShowFilterPanel(false)} className="text-white/25 hover:text-white/60 text-xs transition-colors">✕</button>
                    </div>
                    <div className="p-2 space-y-0.5">
                      {([
                        { k: "all",       l: "All Players", c: statusCounts.all,       dot: "#ffffff50", textCls: "text-white/60"   },
                        { k: "available", l: "Available",   c: statusCounts.available, dot: "#60a5fa",   textCls: "text-blue-300"   },
                        { k: "sold",      l: "Sold",        c: statusCounts.sold,      dot: "#4ade80",   textCls: "text-green-300"  },
                        { k: "unsold",    l: "Unsold",      c: statusCounts.unsold,    dot: "#f87171",   textCls: "text-red-300"    },
                        { k: "retained",  l: "Retained",    c: statusCounts.retained,  dot: "#c084fc",   textCls: "text-purple-300" },
                      ]).map(({ k, l, c, dot, textCls }) => (
                        <button key={k}
                          onClick={() => { setStatusFilter(k); setShowFilterPanel(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold transition-all text-left ${
                            statusFilter === k
                              ? "bg-yellow-400/15 border border-yellow-400/35 text-yellow-300"
                              : `${textCls} hover:bg-white/6 border border-transparent`
                          }`}
                        >
                          <span className="flex items-center gap-2.5">
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
                            {l}
                          </span>
                          <span className={`text-xs font-mono ${statusFilter === k ? "text-yellow-400" : "text-white/30"}`}>{c}</span>
                        </button>
                      ))}
                    </div>
                    {statusFilter !== "all" && (
                      <div className="px-2 pb-2">
                        <button onClick={() => { setStatusFilter("all"); setShowFilterPanel(false); }}
                          className="w-full py-1.5 text-[11px] text-white/30 hover:text-white/55 transition-colors border border-white/8 rounded-lg hover:bg-white/5">
                          Show all players
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <button className="text-sm text-white/30 hover:text-white/60 transition-colors" title="Random next player">🔀</button>
            </div>
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 flex-shrink-0 border-b border-white/5">
            <input value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
              placeholder="Search player…"
              className="w-full h-7 px-2 text-xs bg-white/5 border border-white/8 rounded text-white/60 placeholder:text-white/25 outline-none focus:border-yellow-400/30" />
          </div>

          {/* Active filter pill */}
          {statusFilter !== "all" && (
            <div className="px-2 py-1 flex-shrink-0 border-b border-white/5 flex items-center gap-1.5">
              <span className="text-[10px] text-white/30">Showing:</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-yellow-300 bg-yellow-400/12 border border-yellow-400/25 rounded-full px-2 py-0.5">
                {activeFilterLabel}
                <button onClick={() => setStatusFilter("all")} className="text-yellow-400/50 hover:text-yellow-400 ml-0.5 transition-colors">✕</button>
              </span>
            </div>
          )}

          {/* Re-auction all unsold — shown when filtered to unsold */}
          {statusFilter === "unsold" && statusCounts.unsold > 0 && (
            <div className="px-2 py-2 border-b border-white/6 flex-shrink-0">
              <button className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-orange-500/30 bg-orange-500/10 text-orange-400 text-xs font-semibold hover:bg-orange-500/20 transition-all">
                ↻ Re-auction all {statusCounts.unsold} unsold
              </button>
            </div>
          )}

          {/* Player list */}
          <div className="flex-1 overflow-y-auto">
            {filteredQueue.length === 0 && (
              <p className="text-center text-xs text-white/25 py-8">No players</p>
            )}
            {filteredQueue.map((p, idx) => {
              const isActive   = p.status === "active";
              const isSold     = p.status === "sold";
              const isUnsold   = p.status === "unsold";
              const isRetained = p.status === "retained";

              return (
                <div key={p.id}
                  className={`flex items-start gap-2 px-2 py-2.5 border-b border-white/4 transition-all cursor-pointer group ${isActive ? "bg-yellow-400/8 border-yellow-400/15" : "hover:bg-white/4"}`}>

                  {/* Row number */}
                  <span className="text-[10px] text-white/18 w-4 text-right flex-shrink-0 font-mono pt-0.5">{idx + 1}</span>

                  {/* Jersey number badge */}
                  <span className="text-[10px] font-mono font-bold text-white/30 w-7 text-right flex-shrink-0 pt-0.5">#{p.jersey}</span>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate leading-tight ${isActive ? "text-yellow-200" : isSold ? "text-white/70" : isUnsold ? "text-white/40" : isRetained ? "text-purple-200" : "text-white/65 group-hover:text-white/85"}`}>
                      {p.name}
                    </p>

                    {/* Contextual second line */}
                    {isSold && p.soldAmt && p.soldTeam && (
                      <p className="text-[10px] leading-tight mt-0.5">
                        <span className="text-green-400 font-mono font-bold">{fmt(p.soldAmt)}</span>
                        <span className="text-white/30 mx-1">→</span>
                        <span className="text-white/45 truncate">{p.soldTeam}</span>
                      </p>
                    )}
                    {isRetained && p.retainedAmt && p.soldTeam && (
                      <p className="text-[10px] leading-tight mt-0.5">
                        <span className="text-purple-400 font-mono font-bold">{fmt(p.retainedAmt)}</span>
                        <span className="text-white/30 mx-1">·</span>
                        <span className="text-white/40 truncate">{p.soldTeam}</span>
                      </p>
                    )}
                    {isUnsold && (
                      <p className="text-[10px] text-red-400/60 leading-tight mt-0.5">Unsold · base {fmt(p.base)}</p>
                    )}
                    {!isSold && !isRetained && !isUnsold && (
                      <p className="text-[10px] text-white/28 leading-tight mt-0.5">base {fmt(p.base)}</p>
                    )}
                  </div>

                  {/* Status indicator */}
                  <div className="flex-shrink-0 pt-1">
                    {isActive  && <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
                    {isSold    && <span className="text-[8px] font-black text-green-400 bg-green-400/12 px-1 py-0.5 rounded">SOLD</span>}
                    {isUnsold  && <span className="text-[8px] font-black text-red-400/70 bg-red-400/10 px-1 py-0.5 rounded">UNSOLD</span>}
                    {isRetained&& <span className="text-[8px] font-black text-purple-400 bg-purple-400/12 px-1 py-0.5 rounded">RET</span>}
                  </div>
                </div>
              );
            })}
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

            {/* Single Start / Pause toggle */}
            {!biddingRunning ? (
              <button
                onClick={() => setBiddingRunning(true)}
                className="h-8 px-4 flex items-center gap-2 text-sm font-black rounded-lg bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.4)] transition-all"
              >
                ▶ Start Bidding
              </button>
            ) : (
              <button
                onClick={() => setBiddingRunning(false)}
                className="h-8 px-4 flex items-center gap-2 text-sm font-black rounded-lg bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 hover:bg-amber-500/30 transition-all"
              >
                ⏸ Pause Bidding
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
              <span className="w-5 h-5 rounded-full bg-yellow-400 text-black flex items-center justify-center text-[10px] font-black">
                {biddingRunning ? "2" : "1"}
              </span>
              {biddingRunning ? "Bidding in progress" : "Ready — press Start Bidding"}
            </div>
            <span className="text-white/25 text-xs">·</span>
            <span className="text-white/35 text-sm">
              {biddingRunning
                ? "Pause bidding first, then click SOLD or UNSOLD to conclude"
                : "Click Start Bidding to open the bid window, or load the next player"
              }
            </span>
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
                      <circle cx="56" cy="56" r="46" fill="none"
                        stroke={biddingRunning ? "#facc15" : "#ffffff30"}
                        strokeWidth="7" strokeLinecap="round"
                        strokeDasharray={`${(timerSec / 30) * 2 * Math.PI * 46} ${2 * Math.PI * 46}`} />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-black tabular-nums text-white leading-none">{biddingRunning ? timerSec : timerSecs}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${biddingRunning ? "bg-yellow-400 animate-pulse" : "bg-white/20"}`} />
                    <span className={`text-sm font-semibold ${biddingRunning ? "text-yellow-300" : "text-white/30"}`}>
                      {biddingRunning ? "Bidding open" : "Timer paused"}
                    </span>
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

              {/* NEXT PLAYER + START/PAUSE BIDDING */}
              <div className="grid grid-cols-5 gap-2">
                <button className="col-span-3 flex items-center justify-center gap-3 py-4 rounded-xl font-black text-xl transition-all bg-gradient-to-r from-yellow-500/90 to-yellow-400 text-black hover:from-yellow-400 hover:to-yellow-300 shadow-[0_0_28px_rgba(234,179,8,0.4)] hover:scale-[1.01]">
                  ⏭ NEXT PLAYER
                  <span className="text-sm font-normal opacity-60 font-mono">N</span>
                </button>

                {!biddingRunning ? (
                  <button onClick={() => setBiddingRunning(true)}
                    className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-lg transition-all bg-emerald-600 text-white hover:bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:scale-[1.01]">
                    ▶ START BIDDING
                  </button>
                ) : (
                  <button onClick={() => setBiddingRunning(false)}
                    className="col-span-2 flex items-center justify-center gap-2 py-4 rounded-xl font-black text-lg transition-all bg-amber-500/20 border-2 border-amber-400/60 text-amber-300 hover:bg-amber-500/30 hover:scale-[1.01]">
                    ⏸ PAUSE BIDDING
                  </button>
                )}
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

          {/* Teams & Purse */}
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
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                      <span className="text-sm font-bold text-white/85 truncate leading-tight">{t.name}</span>
                      {t.leading && <span className="w-2 h-2 rounded-full animate-pulse flex-shrink-0 ml-auto" style={{ backgroundColor: t.color }} />}
                    </div>
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
                    <div className="mt-2 h-1.5 bg-white/8 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${usedPct}%`, backgroundColor: t.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Last Actions / Bid History */}
          <div className="flex-1 flex flex-col min-h-0 border-t border-white/8 overflow-hidden">
            <div className="flex items-center px-3 py-2 border-b border-white/8 flex-shrink-0">
              <span className="text-xs font-black uppercase tracking-wider text-white/50">Last Actions</span>
            </div>
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
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar — tournament name + keyboard shortcuts */}
      <div className="flex-shrink-0 h-7 bg-[#0d0f14] border-t border-white/5 flex items-center px-4 gap-0">
        {/* Tournament name — left */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Tournament</span>
          <span className="text-[10px] font-semibold text-white/55 truncate max-w-[200px]">IPL 2025 — Mumbai Edition</span>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/8 mx-4 flex-shrink-0" />

        {/* Keyboard shortcuts — centre */}
        <div className="flex items-center gap-5 flex-1 justify-center">
          {["[S] Sold","[U] Unsold","[D] Defer","[M] Manual","[Space] Start/Pause","[N] Next","[Z] Undo"].map((s, i) => (
            <span key={i} className="text-[10px] text-white/20 font-medium whitespace-nowrap">{s}</span>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-white/8 mx-4 flex-shrink-0" />

        {/* Powered by — right */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[10px] text-white/20">Operator Panel · Powered by</span>
          <span className="text-[10px] font-black tracking-tight">
            <span className="text-yellow-400/60">BID</span><span className="text-white/40">WAR</span>
          </span>
        </div>
      </div>

    </div>
  );
}
