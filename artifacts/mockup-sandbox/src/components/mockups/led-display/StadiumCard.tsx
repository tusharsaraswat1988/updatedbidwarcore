export function StadiumCard() {
  const teamColor = "#f59e0b";
  const playerName = "Virat Kohli";
  const firstName = "VIRAT";
  const lastName = "KOHLI";
  const currentBid = "₹14 Cr";
  const teamName = "MUMBAI WARRIORS";

  return (
    <div
      className="w-full h-screen flex overflow-hidden relative"
      style={{ background: "#080808" }}
    >
      {/* LEFT PANEL — player photo full bleed */}
      <div className="relative w-80 flex-shrink-0 overflow-hidden">
        {/* Photo placeholder */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            background: `linear-gradient(160deg, #1a1200 0%, #0d0800 100%)`,
          }}
        >
          <span className="text-7xl font-black text-yellow-900/30">VK</span>
        </div>

        {/* Diagonal cut overlay */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(90deg, transparent 60%, #080808 100%)`,
          }}
        />

        {/* Jersey number badge */}
        <div
          className="absolute top-6 left-6 w-14 h-14 rounded-xl flex items-center justify-center font-black text-xl text-black"
          style={{ backgroundColor: teamColor }}
        >
          #18
        </div>

        {/* Category ribbon */}
        <div
          className="absolute bottom-6 left-0 right-0 px-5 py-2"
          style={{ backgroundColor: teamColor }}
        >
          <p className="text-black font-black text-sm tracking-widest text-center">PLATINUM</p>
        </div>
      </div>

      {/* CENTER PANEL — player info */}
      <div className="flex-1 flex flex-col justify-between py-8 px-8 relative">
        {/* Top: Tournament */}
        <div>
          <p className="text-zinc-500 font-mono text-xs tracking-[0.3em] uppercase">IPL Mega Auction 2025</p>
        </div>

        {/* Player name — massive */}
        <div>
          <p
            className="text-sm font-mono tracking-[0.25em] uppercase mb-1"
            style={{ color: `${teamColor}99` }}
          >
            BATSMAN · RIGHT HAND
          </p>
          <div className="leading-none">
            <p className="text-5xl font-black text-zinc-400">{firstName}</p>
            <p
              className="text-8xl font-black leading-none"
              style={{ color: teamColor, textShadow: `0 4px 40px ${teamColor}66` }}
            >
              {lastName}
            </p>
          </div>
        </div>

        {/* Bid row */}
        <div className="space-y-3">
          <div className="flex items-end gap-4">
            <div>
              <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-0.5">Current Bid</p>
              <p
                className="text-5xl font-black leading-none"
                style={{ color: "#fff" }}
              >
                {currentBid}
              </p>
            </div>
            <div className="mb-1">
              <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-0.5">Base</p>
              <p className="text-2xl font-bold text-zinc-400">₹2 Cr</p>
            </div>
          </div>

          {/* Leading team */}
          <div
            className="flex items-center gap-3 py-3 px-5 rounded-xl"
            style={{
              background: `linear-gradient(90deg, ${teamColor}22 0%, transparent 100%)`,
              borderLeft: `4px solid ${teamColor}`,
            }}
          >
            <div className="w-6 h-6 rounded-md" style={{ backgroundColor: teamColor }} />
            <div>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Leading Bid</p>
              <p className="text-lg font-black text-white">{teamName}</p>
            </div>
          </div>
        </div>

        {/* Specs row */}
        <div className="flex gap-4">
          {["Age: 35", "IPL Caps: 237", "Avg: 52.4"].map(s => (
            <div key={s} className="flex-1 py-2 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
              <p className="text-white text-xs font-semibold">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT PANEL — purse strip */}
      <div
        className="w-52 flex-shrink-0 flex flex-col border-l"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div className="px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <p className="text-zinc-500 text-xs font-mono uppercase tracking-widest mb-3">Team Purse</p>
          {[
            { name: "Mumbai Warriors", purse: "₹24 Cr", color: "#f59e0b" },
            { name: "Delhi Capitals", purse: "₹31 Cr", color: "#3b82f6" },
            { name: "CSK", purse: "₹18 Cr", color: "#fbbf24" },
            { name: "RCB", purse: "₹12 Cr", color: "#ef4444" },
            { name: "KKR", purse: "₹9 Cr", color: "#8b5cf6" },
          ].map(t => (
            <div key={t.name} className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <p className="text-white text-xs font-medium truncate" style={{ maxWidth: "90px" }}>{t.name}</p>
              </div>
              <p className="text-xs font-mono" style={{ color: t.color }}>{t.purse}</p>
            </div>
          ))}
        </div>

        {/* Timer */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2">
          <p className="text-zinc-600 text-xs font-mono uppercase tracking-widest">Timer</p>
          <p
            className="text-5xl font-black tabular-nums"
            style={{ color: teamColor, textShadow: `0 0 30px ${teamColor}` }}
          >
            0:28
          </p>
        </div>
      </div>
    </div>
  );
}
