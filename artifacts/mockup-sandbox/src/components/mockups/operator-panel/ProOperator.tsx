export function ProOperator() {
  return (
    <div className="min-h-screen bg-[#0c0d10] text-white flex flex-col text-sm"
      style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* TOP — COMPACT STATUS RAIL */}
      <div className="flex items-center gap-0 border-b border-white/8 bg-[#0e0f14]">
        <div className="flex items-center gap-2 px-4 py-2 border-r border-white/8">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
          <span className="text-[11px] font-black text-green-400 uppercase tracking-wider">LIVE</span>
        </div>
        <div className="flex items-center gap-4 px-4 py-2 border-r border-white/8 flex-1">
          <span className="text-[11px] text-white/40">IPL 2025 R3</span>
          <span className="text-[11px] font-bold text-yellow-400">Platinum</span>
          <span className="text-[11px] text-white/25">·</span>
          <span className="text-[11px] text-white/40">Sold: <b className="text-green-400">12</b></span>
          <span className="text-[11px] text-white/40">Unsold: <b className="text-red-400">3</b></span>
          <span className="text-[11px] text-white/40">Left: <b className="text-white">18</b></span>
        </div>
        <div className="flex items-center gap-1 px-3 py-1.5">
          {["Break", "Display ↗", "Undo Z", "Settings"].map((s, i) => (
            <button key={i} className="text-[10px] px-2.5 py-1 rounded bg-white/5 border border-white/8 text-white/35 hover:text-white/60 hover:bg-white/8 transition-all font-medium">{s}</button>
          ))}
        </div>
      </div>

      {/* MAIN AREA — 3 COLUMN DENSITY */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — QUEUE — DENSE */}
        <div className="w-48 flex-shrink-0 border-r border-white/8 flex flex-col bg-[#0e0f14]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/6">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/25">Queue (18)</span>
            <button className="text-[9px] text-white/25 hover:text-white/50">Filter</button>
          </div>

          {/* Search */}
          <div className="px-2 py-1.5 border-b border-white/5">
            <input
              className="w-full h-6 px-2 text-[10px] bg-white/5 border border-white/8 rounded text-white/60 placeholder:text-white/20 outline-none focus:border-white/20"
              placeholder="Search..."
              readOnly
            />
          </div>

          {/* Tab strip */}
          <div className="flex border-b border-white/6">
            {["Queue", "Sold", "UNSD"].map((t, i) => (
              <button key={i} className={`flex-1 text-[9px] py-1.5 font-bold transition-all ${i === 0 ? "text-yellow-400 border-b-2 border-yellow-400 bg-yellow-400/5" : "text-white/20 hover:text-white/40"}`}>
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {[
              { n: "Rohit Sharma", r: "BAT", p: "20L", c: "#eab308", active: true },
              { n: "J. Bumrah", r: "BOWL", p: "18L", c: "#eab308", active: false },
              { n: "KL Rahul", r: "WK", p: "15L", c: "#f59e0b", active: false },
              { n: "H. Pandya", r: "AR", p: "16L", c: "#eab308", active: false },
              { n: "Y. Chahal", r: "BOWL", p: "10L", c: "#f59e0b", active: false },
              { n: "S. Gill", r: "BAT", p: "12L", c: "#f59e0b", active: false },
              { n: "S. Samson", r: "WK", p: "14L", c: "#f59e0b", active: false },
              { n: "R. Jadeja", r: "AR", p: "13L", c: "#f59e0b", active: false },
              { n: "M. Siraj", r: "BOWL", p: "8L", c: "#94a3b8", active: false },
            ].map((p, i) => (
              <div key={i} className={`flex items-center gap-1.5 px-2 py-1.5 border-b border-white/4 transition-all cursor-pointer ${p.active ? "bg-yellow-400/8" : "hover:bg-white/4"}`}>
                <span className="text-[9px] text-white/20 w-4 text-right flex-shrink-0 font-mono">{i + 1}</span>
                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: p.c }} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[10px] font-semibold truncate ${p.active ? "text-yellow-200" : "text-white/55"}`}>{p.n}</p>
                  <p className="text-[9px] text-white/20">{p.r} {p.p}</p>
                </div>
                {p.active ? (
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                ) : (
                  <button className="text-[8px] text-white/15 hover:text-white/40 flex-shrink-0">▶</button>
                )}
              </div>
            ))}
          </div>

          <div className="px-2 py-2 border-t border-white/6 flex gap-1">
            <button className="flex-1 h-7 text-[9px] font-bold bg-white/5 border border-white/8 rounded text-white/30 hover:text-white/60 transition-all">Next [N]</button>
            <button className="flex-1 h-7 text-[9px] font-bold bg-white/5 border border-white/8 rounded text-white/30 hover:text-white/60 transition-all">Rand [R]</button>
          </div>
        </div>

        {/* CENTER — DENSE CONTROL CORE */}
        <div className="flex-1 flex flex-col overflow-y-auto bg-[#0c0d10]">

          {/* TIMER BAR — TOP OF CENTER */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-white/8 bg-[#0d0f14]">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="relative w-10 h-10 flex-shrink-0">
                  <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="16" fill="none" stroke="white" strokeOpacity="0.07" strokeWidth="3" />
                    <circle cx="20" cy="20" r="16" fill="none" stroke="#facc15" strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray={`${(18/30) * 2 * Math.PI * 16} ${2 * Math.PI * 16}`} />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black tabular-nums text-white">18</span>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] text-white/25 uppercase tracking-widest">Bid Timer</p>
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                    <span className="text-xs font-bold text-yellow-300">Running</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="h-7 px-3 text-[10px] font-bold bg-yellow-400/12 border border-yellow-400/25 rounded text-yellow-300 hover:bg-yellow-400/20 transition-all">⏸ Pause [Space]</button>
                <button className="h-7 px-2 text-[10px] font-bold bg-white/5 border border-white/8 rounded text-white/35 hover:text-white/60 transition-all">+30s</button>
                <button className="h-7 px-2 text-[10px] font-bold bg-white/5 border border-white/8 rounded text-white/35 hover:text-white/60 transition-all">Set</button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="h-7 px-3 text-[10px] font-bold bg-white/5 border border-white/8 rounded text-white/30 hover:text-white/60 transition-all">Defer [D]</button>
              <button className="h-7 px-3 text-[10px] font-bold bg-white/5 border border-white/8 rounded text-white/30 hover:text-white/60 transition-all">Manual Sell [M]</button>
              <button className="h-7 px-3 text-[10px] font-bold bg-white/5 border border-white/8 rounded text-white/30 hover:text-white/60 transition-all">Undo [Z]</button>
            </div>
          </div>

          <div className="px-6 py-4 space-y-4 max-w-2xl mx-auto w-full">

            {/* PLAYER + BID — COMPACT COMBINED CARD */}
            <div className="rounded-xl border border-white/10 overflow-hidden" style={{ background: "linear-gradient(135deg, #111420 0%, #0f1219 100%)" }}>
              <div className="flex items-stretch gap-0">
                {/* Player info */}
                <div className="flex-1 px-5 py-4 border-r border-white/8">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-400/60 mb-1">Platinum · Batsman · On Block</p>
                  <h2 className="text-3xl font-black leading-tight text-white">Rohit Sharma</h2>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-[10px] text-white/30">36y · Mumbai</span>
                    <span className="text-[10px] text-white/30">Base ₹20,00,000</span>
                    <span className="text-[10px] text-white/30">#45</span>
                  </div>
                </div>
                {/* Current bid — compact but prominent */}
                <div className="px-5 py-4 flex flex-col items-end justify-between">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/25 text-right">Current Bid</p>
                  <div className="text-right">
                    <div className="text-4xl font-black text-yellow-400 leading-none"
                      style={{ textShadow: "0 0 20px rgba(250,204,21,0.3)" }}>
                      ₹24L
                    </div>
                    <div className="flex items-center gap-1.5 justify-end mt-1">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span className="text-[11px] font-bold text-blue-300">Mumbai Heroes</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-white/20 text-right">+₹2L / raise</p>
                </div>
              </div>
            </div>

            {/* PRIMARY ACTION ROW */}
            <div className="grid grid-cols-4 gap-2">
              <button className="h-14 rounded-xl font-black text-lg col-span-2 flex flex-col items-center justify-center gap-0.5 transition-all"
                style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 4px 20px rgba(34,197,94,0.25)" }}>
                <span>SOLD</span>
                <span className="text-[9px] font-normal opacity-60">Assign to highest bidder [S]</span>
              </button>
              <button className="h-14 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-0.5 bg-red-500/10 border border-red-500/25 text-red-400 hover:bg-red-500/20 transition-all">
                <span>UNSOLD</span>
                <span className="text-[9px] font-normal opacity-60">[U]</span>
              </button>
              <button className="h-14 rounded-xl font-bold text-sm flex flex-col items-center justify-center gap-0.5 bg-white/5 border border-white/10 text-white/40 hover:text-white/60 hover:bg-white/8 transition-all">
                <span>DEFER</span>
                <span className="text-[9px] font-normal opacity-60">[D]</span>
              </button>
            </div>

            {/* QUICK BID GRID — DENSE */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Raise Bid</p>
                <span className="text-[9px] text-white/20">Click team to add bid</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { s: "MH", name: "Mumbai Heroes", c: "#3b82f6", purse: "₹48L", players: 6, leading: true },
                  { s: "CK", name: "Chennai Kings", c: "#f59e0b", purse: "₹35L", players: 5, leading: false },
                  { s: "BB", name: "Bangalore Bulls", c: "#ef4444", purse: "₹52L", players: 4, leading: false },
                  { s: "DD", name: "Delhi Dons", c: "#8b5cf6", purse: "₹41L", players: 6, leading: false },
                  { s: "KK", name: "Kolkata Knights", c: "#10b981", purse: "₹29L", players: 7, leading: false },
                  { s: "PP", name: "Punjab Power", c: "#f97316", purse: "₹60L", players: 3, leading: false },
                ].map((t, i) => (
                  <button key={i} className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all hover:scale-[1.02] relative"
                    style={{ background: t.leading ? `${t.c}14` : `${t.c}0a`, border: `1px solid ${t.leading ? t.c + "50" : t.c + "18"}` }}>
                    {t.leading && (
                      <div className="absolute top-1 right-1.5 text-[8px] font-black" style={{ color: t.c }}>★</div>
                    )}
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs flex-shrink-0"
                      style={{ background: t.c + "20", color: t.c }}>
                      {t.s}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-[10px] font-bold truncate text-white/70">{t.name}</p>
                      <div className="flex gap-2">
                        <span className="text-[9px] font-bold" style={{ color: t.c }}>{t.purse}</span>
                        <span className="text-[9px] text-white/20">{t.players}px</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* LAST ACTIONS — COMPACT */}
            <div className="rounded-lg border border-white/6 bg-white/3">
              <div className="px-4 py-2 border-b border-white/6">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Last 3 Actions</p>
              </div>
              <div className="divide-y divide-white/5">
                {[
                  { t: "Bid raised by Mumbai Heroes", v: "₹24L", time: "2s ago", c: "#3b82f6" },
                  { t: "Bid raised by Bangalore Bulls", v: "₹22L", time: "8s ago", c: "#ef4444" },
                  { t: "Auction started for Rohit Sharma", v: "₹20L base", time: "42s ago", c: "#ffffff40" },
                ].map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: a.c }} />
                    <span className="text-[10px] text-white/40 flex-1 truncate">{a.t}</span>
                    <span className="text-[10px] font-bold text-white/60 flex-shrink-0">{a.v}</span>
                    <span className="text-[9px] text-white/20 flex-shrink-0 w-12 text-right">{a.time}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* RIGHT — TEAM PURSES — DENSE */}
        <div className="w-52 flex-shrink-0 border-l border-white/8 bg-[#0e0f14] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/6">
            <span className="text-[9px] font-black uppercase tracking-[0.15em] text-white/25">Purse</span>
            <span className="text-[9px] text-white/20">₹ remaining</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-white/5">
            {[
              { t: "Mumbai Heroes", c: "#3b82f6", p: 48, max: 80, players: 6, leading: true },
              { t: "Chennai Kings", c: "#f59e0b", p: 35, max: 80, players: 5, leading: false },
              { t: "Bangalore Bulls", c: "#ef4444", p: 52, max: 80, players: 4, leading: false },
              { t: "Delhi Dons", c: "#8b5cf6", p: 41, max: 80, players: 6, leading: false },
              { t: "Kolkata Knights", c: "#10b981", p: 29, max: 80, players: 7, leading: false },
              { t: "Punjab Power", c: "#f97316", p: 60, max: 80, players: 3, leading: false },
            ].map((t, i) => (
              <div key={i} className={`px-3 py-2.5 hover:bg-white/3 transition-all cursor-pointer ${t.leading ? "bg-blue-400/5" : ""}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.c, boxShadow: t.leading ? `0 0 6px ${t.c}` : "none" }} />
                    <span className="text-[10px] font-semibold text-white/60 truncate max-w-[90px]">{t.t}</span>
                  </div>
                  <span className="text-[9px] text-white/25">{t.players}px</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/6 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(t.p / t.max) * 100}%`, background: t.c, opacity: 0.5 }} />
                  </div>
                  <span className="text-[10px] font-black flex-shrink-0" style={{ color: t.leading ? t.c : undefined }}>₹{t.p}L</span>
                </div>
              </div>
            ))}
          </div>
          <div className="px-2 py-2 border-t border-white/6 space-y-1">
            <button className="w-full h-6 text-[9px] font-bold bg-white/4 border border-white/6 rounded text-white/25 hover:text-white/50 transition-all">Bid Log</button>
            <button className="w-full h-6 text-[9px] font-bold bg-white/4 border border-white/6 rounded text-white/25 hover:text-white/50 transition-all">Full Report</button>
          </div>
        </div>

      </div>
    </div>
  );
}
