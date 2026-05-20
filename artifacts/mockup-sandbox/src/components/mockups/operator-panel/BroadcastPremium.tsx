export function BroadcastPremium() {
  return (
    <div className="min-h-screen bg-[#08090d] text-white flex flex-col overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif", background: "radial-gradient(ellipse 120% 60% at 50% 0%, #0f1a2e 0%, #08090d 60%)" }}>

      {/* TOP COMMAND BAR */}
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: "0 0 8px #34d399" }} />
            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">Live</span>
          </div>
          <div className="w-px h-4 bg-white/12" />
          <span className="text-xs text-white/40 font-medium">IPL 2025 Draft · Round 3 · Platinum Tier</span>
        </div>
        <div className="flex items-center gap-2">
          {["12 Sold", "3 Unsold", "18 Left"].map((s, i) => (
            <span key={i} className="text-[11px] px-3 py-1 rounded-full border border-white/10 text-white/50 font-medium">{s}</span>
          ))}
          <button className="ml-2 text-[11px] px-3 py-1.5 rounded-full bg-white/8 border border-white/10 text-white/50 hover:text-white/80 transition-colors font-medium">
            Open Display ↗
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* LEFT PANEL — QUEUE */}
        <div className="w-52 flex-shrink-0 border-r border-white/6 flex flex-col">
          <div className="px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/25">Queue</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 space-y-0.5">
            {[
              { n: "Rohit Sharma", r: "BAT", p: "20L", active: true, cat: "#eab308" },
              { n: "Jasprit Bumrah", r: "BOWL", p: "18L", active: false, cat: "#eab308" },
              { n: "KL Rahul", r: "WK", p: "15L", active: false, cat: "#f59e0b" },
              { n: "Hardik Pandya", r: "AR", p: "16L", active: false, cat: "#eab308" },
              { n: "Yuzvendra Chahal", r: "BOWL", p: "10L", active: false, cat: "#f59e0b" },
              { n: "Shubman Gill", r: "BAT", p: "12L", active: false, cat: "#f59e0b" },
              { n: "Sanju Samson", r: "WK", p: "14L", active: false, cat: "#f59e0b" },
            ].map((p, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all cursor-pointer group ${p.active ? "bg-yellow-400/8 border border-yellow-400/20" : "hover:bg-white/4"}`}>
                <div className="w-0.5 h-6 rounded-full flex-shrink-0 transition-all" style={{ background: p.active ? "#eab308" : "#ffffff10" }} />
                <div className="flex-1 min-w-0">
                  <p className={`text-[11px] font-semibold truncate transition-colors ${p.active ? "text-yellow-200" : "text-white/55 group-hover:text-white/75"}`}>{p.n}</p>
                  <p className="text-[9px] text-white/25">{p.r} · ₹{p.p}</p>
                </div>
                {p.active && (
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse flex-shrink-0" />
                )}
              </div>
            ))}
          </div>
          <div className="px-3 py-4 border-t border-white/6 space-y-2">
            <button className="w-full py-2.5 text-[11px] font-semibold rounded-lg bg-white/5 border border-white/8 text-white/40 hover:text-white/60 hover:bg-white/7 transition-all">
              Skip Player
            </button>
            <button className="w-full py-2.5 text-[11px] font-semibold rounded-lg bg-white/5 border border-white/8 text-white/40 hover:text-white/60 hover:bg-white/7 transition-all">
              Random Pick
            </button>
          </div>
        </div>

        {/* CENTER — CINEMATIC AUCTION CORE */}
        <div className="flex-1 flex flex-col items-center justify-center px-10 py-8 relative overflow-hidden">

          {/* Ambient glow behind bid area */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full opacity-10"
            style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }} />

          {/* PLAYER CARD */}
          <div className="w-full max-w-md mb-8 relative z-10">
            <div className="flex items-end gap-6 px-6 py-5 rounded-2xl border border-white/8"
              style={{ background: "linear-gradient(135deg, #0f1a2e 0%, #141820 100%)" }}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-yellow-400/60">Platinum · Batsman</span>
                </div>
                <h1 className="text-5xl font-black leading-none tracking-tight" style={{ textShadow: "0 2px 20px rgba(255,255,255,0.1)" }}>
                  Rohit<br />Sharma
                </h1>
                <p className="text-xs text-white/30 mt-2 font-medium">Age 36 · Mumbai · Base ₹20,00,000</p>
              </div>
              <div className="ml-auto flex-shrink-0 flex flex-col items-end gap-2">
                <div className="w-20 h-20 rounded-2xl bg-white/6 flex items-center justify-center border border-white/8">
                  <span className="text-4xl">👤</span>
                </div>
                <span className="text-2xl font-black text-white/12">#45</span>
              </div>
            </div>
          </div>

          {/* TIMER — PROMINENT */}
          <div className="flex items-center gap-6 mb-8 z-10 relative">
            <div className="flex flex-col items-center">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="40" fill="none" stroke="white" strokeOpacity="0.05" strokeWidth="5" />
                  <circle cx="48" cy="48" r="40" fill="none" stroke="#3b82f6" strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={`${(18/30) * 2 * Math.PI * 40} ${2 * Math.PI * 40}`} />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-black tabular-nums text-white">18</span>
                </div>
              </div>
              <span className="text-[9px] text-white/25 uppercase tracking-widest mt-2 font-bold">Timer</span>
            </div>

            <div className="w-px h-16 bg-white/8" />

            {/* CURRENT BID */}
            <div className="text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-1">Current Bid</p>
              <div className="text-6xl font-black text-white leading-none mb-1"
                style={{ textShadow: "0 0 40px rgba(59,130,246,0.5)" }}>
                ₹24L
              </div>
              <div className="flex items-center gap-2 justify-center">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-xs font-bold text-blue-300">Mumbai Heroes</span>
              </div>
            </div>

            <div className="w-px h-16 bg-white/8" />

            {/* START / PAUSE */}
            <button className="w-24 h-24 rounded-2xl flex flex-col items-center justify-center gap-1.5 font-black transition-all"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", boxShadow: "0 0 30px rgba(245,158,11,0.25)" }}>
              <span className="text-3xl">⏸</span>
              <span className="text-[9px] uppercase tracking-wider">Pause</span>
            </button>
          </div>

          {/* PRIMARY ACTIONS */}
          <div className="flex gap-4 z-10 relative mb-8">
            <button className="w-44 h-16 rounded-xl font-black text-xl flex flex-col items-center justify-center gap-0.5 transition-all"
              style={{ background: "linear-gradient(135deg, #22c55e, #16a34a)", boxShadow: "0 8px 32px rgba(34,197,94,0.3)" }}>
              <span>SOLD</span>
              <span className="text-[9px] font-normal opacity-60">Assign player [S]</span>
            </button>
            <button className="w-44 h-16 rounded-xl font-black text-xl flex flex-col items-center justify-center gap-0.5 bg-white/6 border border-white/12 hover:bg-white/10 transition-all">
              <span>UNSOLD</span>
              <span className="text-[9px] font-normal opacity-40">No bidder [U]</span>
            </button>
          </div>

          {/* QUICK BID */}
          <div className="w-full max-w-lg z-10 relative">
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/20 mb-3 text-center">Raise Bid For Team</p>
            <div className="grid grid-cols-6 gap-2">
              {[
                { s: "MH", c: "#3b82f6", active: true },
                { s: "CK", c: "#f59e0b", active: false },
                { s: "BB", c: "#ef4444", active: false },
                { s: "DD", c: "#8b5cf6", active: false },
                { s: "KK", c: "#10b981", active: false },
                { s: "PP", c: "#f97316", active: false },
              ].map((t, i) => (
                <button key={i} className="h-14 rounded-xl flex flex-col items-center justify-center gap-1 font-black text-sm transition-all hover:scale-105 relative"
                  style={{ background: t.active ? `${t.c}22` : `${t.c}0d`, border: `1px solid ${t.active ? t.c + "60" : t.c + "20"}`, color: t.c, boxShadow: t.active ? `0 0 20px ${t.c}25` : "none" }}>
                  {t.active && <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-400 border-2 border-[#08090d]" />}
                  <span className="text-base font-black">{t.s}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — TEAM PURSES */}
        <div className="w-56 flex-shrink-0 border-l border-white/6 flex flex-col">
          <div className="px-5 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/25">Purse</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 space-y-2">
            {[
              { t: "Mumbai Heroes", c: "#3b82f6", p: 48, players: 6, leading: true },
              { t: "Chennai Kings", c: "#f59e0b", p: 35, players: 5, leading: false },
              { t: "Bangalore Bulls", c: "#ef4444", p: 52, players: 4, leading: false },
              { t: "Delhi Dons", c: "#8b5cf6", p: 41, players: 6, leading: false },
              { t: "Kolkata Knights", c: "#10b981", p: 29, players: 7, leading: false },
            ].map((t, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/3 border border-white/6 hover:bg-white/5 transition-all">
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.c, boxShadow: t.leading ? `0 0 8px ${t.c}` : "none" }} />
                  <span className="text-[11px] font-semibold text-white/65 truncate flex-1">{t.t}</span>
                  {t.leading && <span className="text-[8px] font-black" style={{ color: t.c }}>★</span>}
                </div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-black text-white">₹{t.p}L</span>
                  <span className="text-[9px] text-white/25">{t.players}px</span>
                </div>
                <div className="w-full h-1 bg-white/6 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${(t.p / 80) * 100}%`, background: t.c, opacity: 0.5 }} />
                </div>
              </div>
            ))}
          </div>
          <div className="px-3 py-4 border-t border-white/6 space-y-1.5">
            <button className="w-full py-2 text-[10px] font-semibold rounded-lg bg-white/4 border border-white/8 text-white/30 hover:text-white/50 transition-all">Break Timer</button>
            <button className="w-full py-2 text-[10px] font-semibold rounded-lg bg-white/4 border border-white/8 text-white/30 hover:text-white/50 transition-all">Undo Last [Z]</button>
            <button className="w-full py-2 text-[10px] font-semibold rounded-lg bg-white/4 border border-white/8 text-white/30 hover:text-white/50 transition-all">Bid History</button>
          </div>
        </div>

      </div>

      {/* BOTTOM ACTIONS BAR */}
      <div className="flex items-center gap-3 px-8 py-3 border-t border-white/6 bg-[#0a0b10]">
        <span className="text-[10px] text-white/20 font-medium">Shortcuts:</span>
        {["[S] Sold", "[U] Unsold", "[Space] Pause", "[N] Next", "[Z] Undo", "[D] Defer"].map((s, i) => (
          <span key={i} className="text-[10px] text-white/20 bg-white/5 px-2 py-0.5 rounded border border-white/8">{s}</span>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-white/20">Last action:</span>
          <span className="text-[10px] text-white/40 font-medium">Bid raised by Mumbai Heroes → ₹24L</span>
        </div>
      </div>
    </div>
  );
}
