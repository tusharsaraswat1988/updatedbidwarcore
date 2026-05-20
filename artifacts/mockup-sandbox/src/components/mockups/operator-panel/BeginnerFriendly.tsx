export function BeginnerFriendly() {
  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* TOP STATUS BAR */}
      <div className="flex items-center justify-between px-6 py-3 bg-[#141720] border-b border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-semibold text-green-400">Auction Live</span>
          <span className="text-xs text-white/40 ml-1">IPL 2025 — Round 3</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs bg-white/8 px-3 py-1.5 rounded-full text-white/60">Players left: <span className="text-white font-bold">18</span></span>
          <span className="text-xs bg-white/8 px-3 py-1.5 rounded-full text-white/60">Sold: <span className="text-green-400 font-bold">12</span></span>
          <button className="text-xs bg-white/8 px-3 py-1.5 rounded-full text-white/50 hover:text-white transition-colors">Settings</button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — PLAYER QUEUE (narrow) */}
        <div className="w-56 flex-shrink-0 bg-[#141720] border-r border-white/8 flex flex-col">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Up Next</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {[
              { name: "Rohit Sharma", role: "BAT", price: "₹20L", cat: "Platinum", active: true },
              { name: "Jasprit Bumrah", role: "BOWL", price: "₹18L", cat: "Platinum", active: false },
              { name: "KL Rahul", role: "WK", price: "₹15L", cat: "Gold", active: false },
              { name: "Hardik Pandya", role: "AR", price: "₹16L", cat: "Platinum", active: false },
              { name: "Yuzvendra Chahal", role: "BOWL", price: "₹10L", cat: "Gold", active: false },
              { name: "Shubman Gill", role: "BAT", price: "₹12L", cat: "Gold", active: false },
            ].map((p, i) => (
              <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-lg transition-all ${p.active ? "bg-yellow-400/12 border border-yellow-400/30" : "hover:bg-white/5"}`}>
                <span className="text-[10px] text-white/25 w-4 font-mono flex-shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <p className={`text-xs font-semibold truncate ${p.active ? "text-yellow-300" : "text-white/80"}`}>{p.name}</p>
                  <p className="text-[10px] text-white/35">{p.role} · {p.price}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-white/8">
            <button className="w-full py-2 text-xs font-semibold text-white/50 hover:text-white bg-white/5 hover:bg-white/8 rounded-lg transition-all">
              + Next Random Player
            </button>
          </div>
        </div>

        {/* CENTER — MAIN AUCTION AREA */}
        <div className="flex-1 flex flex-col items-center justify-start px-8 py-6 gap-6 overflow-y-auto">

          {/* STEP INDICATOR */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-yellow-400/12 border border-yellow-400/20 text-yellow-300 font-semibold">
              <span className="w-5 h-5 rounded-full bg-yellow-400 text-black flex items-center justify-center text-[10px] font-black">2</span>
              Bidding in progress
            </div>
            <span className="text-white/20">·</span>
            <span className="text-white/35">Click SOLD when bidding stops</span>
          </div>

          {/* CURRENT PLAYER */}
          <div className="w-full max-w-lg bg-[#1a1f2e] border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-5 p-5">
              <div className="w-16 h-16 rounded-xl bg-white/8 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">👤</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-yellow-400/70 mb-0.5">BAT · Platinum</p>
                <h2 className="text-3xl font-black leading-tight text-white">Rohit Sharma</h2>
                <p className="text-xs text-white/40 mt-1">Age 36 · Mumbai · Base ₹20,00,000</p>
              </div>
              <span className="text-5xl font-black text-white/10">#45</span>
            </div>
          </div>

          {/* TIMER — BIG & CLEAR */}
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-36 h-36">
              <svg className="w-36 h-36 -rotate-90" viewBox="0 0 144 144">
                <circle cx="72" cy="72" r="60" fill="none" stroke="white" strokeOpacity="0.06" strokeWidth="8" />
                <circle cx="72" cy="72" r="60" fill="none" stroke="#facc15" strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(18/30) * 2 * Math.PI * 60} ${2 * Math.PI * 60}`} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-black tabular-nums text-white leading-none">18</span>
                <span className="text-[10px] text-white/40 font-semibold uppercase tracking-widest mt-1">seconds</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
              <span className="text-sm text-yellow-300 font-semibold">Timer running</span>
            </div>
          </div>

          {/* CURRENT BID — DOMINANT */}
          <div className="w-full max-w-lg text-center py-6 bg-[#1a1f2e] border border-white/10 rounded-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-white/35 mb-2">Current Highest Bid</p>
            <div className="text-7xl font-black text-yellow-400 leading-none mb-3"
              style={{ textShadow: "0 0 40px rgba(250,204,21,0.35)" }}>
              ₹24,00,000
            </div>
            <div className="flex items-center justify-center gap-3">
              <div className="w-3 h-3 rounded-full bg-blue-400" />
              <span className="text-sm font-bold text-white">Mumbai Heroes</span>
              <span className="text-xs text-white/30">Base was ₹20,00,000</span>
            </div>
          </div>

          {/* PRIMARY ACTIONS — BIG, CLEAR */}
          <div className="w-full max-w-lg space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button className="h-16 rounded-xl font-black text-lg bg-green-500 hover:bg-green-400 text-white transition-all shadow-lg shadow-green-500/20 flex flex-col items-center justify-center gap-0.5">
                <span>SOLD</span>
                <span className="text-[10px] font-normal opacity-70">Assign to Mumbai Heroes [S]</span>
              </button>
              <button className="h-16 rounded-xl font-black text-lg bg-red-500/80 hover:bg-red-500 text-white transition-all shadow-lg shadow-red-500/20 flex flex-col items-center justify-center gap-0.5">
                <span>UNSOLD</span>
                <span className="text-[10px] font-normal opacity-70">No bids received [U]</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button className="h-12 rounded-xl font-bold text-sm bg-yellow-400/15 border border-yellow-400/30 text-yellow-300 hover:bg-yellow-400/25 transition-all flex items-center justify-center gap-2">
                <span>⏸</span> Pause Timer [Space]
              </button>
              <button className="h-12 rounded-xl font-bold text-sm bg-white/6 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2">
                <span>⏭</span> Next Player [N]
              </button>
            </div>
          </div>

          {/* QUICK BID BUTTONS */}
          <div className="w-full max-w-lg">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/30 mb-3">Quick Bid — Click to raise</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { team: "Mumbai Heroes", color: "#3b82f6", purse: "₹48L left", short: "MH" },
                { team: "Chennai Kings", color: "#f59e0b", purse: "₹35L left", short: "CK" },
                { team: "Bangalore Bulls", color: "#ef4444", purse: "₹52L left", short: "BB" },
                { team: "Delhi Dons", color: "#8b5cf6", purse: "₹41L left", short: "DD" },
                { team: "Kolkata Knights", color: "#10b981", purse: "₹29L left", short: "KK" },
                { team: "Punjab Power", color: "#f97316", purse: "₹60L left", short: "PP" },
              ].map((t, i) => (
                <button key={i} className="py-3 px-2 rounded-xl flex flex-col items-center gap-1.5 font-bold text-sm transition-all hover:scale-105"
                  style={{ background: `${t.color}15`, border: `1px solid ${t.color}35`, color: t.color }}>
                  <span className="text-lg font-black">{t.short}</span>
                  <span className="text-[9px] opacity-60 font-normal">{t.purse}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT — TEAMS PURSE (collapsible) */}
        <div className="w-60 flex-shrink-0 bg-[#141720] border-l border-white/8 flex flex-col">
          <div className="px-4 py-3 border-b border-white/8">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Team Budgets</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {[
              { team: "Mumbai Heroes", color: "#3b82f6", purse: 4800000, max: 8000000, players: 6, leading: true },
              { team: "Chennai Kings", color: "#f59e0b", purse: 3500000, max: 8000000, players: 5, leading: false },
              { team: "Bangalore Bulls", color: "#ef4444", purse: 5200000, max: 8000000, players: 4, leading: false },
              { team: "Delhi Dons", color: "#8b5cf6", purse: 4100000, max: 8000000, players: 6, leading: false },
              { team: "Kolkata Knights", color: "#10b981", purse: 2900000, max: 8000000, players: 7, leading: false },
            ].map((t, i) => (
              <div key={i} className={`p-3 rounded-xl transition-all ${t.leading ? "bg-blue-400/10 border border-blue-400/25" : "bg-white/4 border border-white/8"}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }} />
                    <span className="text-xs font-bold text-white/80 truncate">{t.team}</span>
                  </div>
                  {t.leading && <span className="text-[9px] font-black text-blue-400 bg-blue-400/15 px-1.5 py-0.5 rounded-full">LEADING</span>}
                </div>
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-sm font-black text-white">₹{(t.purse / 100000).toFixed(0)}L</span>
                  <span className="text-[10px] text-white/30">{t.players} players</span>
                </div>
                <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(t.purse / t.max) * 100}%`, background: t.color, opacity: 0.7 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-white/8 space-y-2">
            <button className="w-full py-2 text-xs font-semibold bg-white/5 hover:bg-white/8 text-white/40 hover:text-white/60 rounded-lg transition-all">
              Bid History
            </button>
            <button className="w-full py-2 text-xs font-semibold bg-white/5 hover:bg-white/8 text-white/40 hover:text-white/60 rounded-lg transition-all">
              Break Timer
            </button>
          </div>
        </div>

      </div>

      {/* BOTTOM LABEL STRIP */}
      <div className="h-8 bg-[#0d1018] border-t border-white/5 flex items-center justify-center gap-8 text-[10px] text-white/20">
        <span>[S] Sold</span>
        <span>[U] Unsold</span>
        <span>[Space] Pause/Resume</span>
        <span>[N] Next Player</span>
        <span>[Z] Undo</span>
      </div>
    </div>
  );
}
