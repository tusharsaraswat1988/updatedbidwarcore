export function CurrentEnhanced() {
  const teamColor = "#f59e0b";
  const playerName = "Virat Kohli";
  const currentBid = "₹14,00,00,000";
  const teamName = "Mumbai Warriors";
  const specs = ["BATSMAN", "RHB", "AGE 35"];
  const basePrice = "₹2,00,00,000";

  return (
    <div
      className="w-full h-screen flex flex-col overflow-hidden relative"
      style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #0d0d1a 50%, #0a0f0a 100%)" }}
    >
      {/* Subtle animated background glow */}
      <div
        className="absolute inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 60% at 50% 50%, ${teamColor}33 0%, transparent 70%)`,
        }}
      />

      {/* Header bar */}
      <div className="relative z-10 flex items-center justify-between px-8 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-yellow-400 flex items-center justify-center">
            <span className="text-black font-black text-xs">BW</span>
          </div>
          <span className="text-white/60 font-mono text-xs tracking-widest uppercase">IPL Mega Auction 2025</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 font-mono text-xs tracking-widest">LIVE</span>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-1 items-center gap-10 px-12 py-6">
        {/* Player photo card */}
        <div className="flex-shrink-0">
          <div
            className="w-56 h-72 rounded-3xl border-4 overflow-hidden flex items-center justify-center relative"
            style={{
              borderColor: teamColor,
              boxShadow: `0 0 60px ${teamColor}55, 0 0 120px ${teamColor}22`,
            }}
          >
            <div className="w-full h-full bg-zinc-800 flex flex-col items-center justify-center gap-4">
              <div className="w-20 h-20 rounded-full bg-zinc-700 flex items-center justify-center">
                <span className="text-4xl font-black text-zinc-500">VK</span>
              </div>
              <div
                className="absolute bottom-3 right-3 w-9 h-9 rounded-full flex items-center justify-center font-black text-xs"
                style={{ backgroundColor: teamColor, color: "#000" }}
              >
                #18
              </div>
            </div>
          </div>
        </div>

        {/* Info section */}
        <div className="flex-1 space-y-5">
          <div>
            <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-1">{specs.join(" · ")}</p>
            <h1 className="text-7xl font-black tracking-tight leading-none text-white">{playerName}</h1>
          </div>

          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Current Bid</p>
            <p
              className="text-7xl font-black leading-none"
              style={{ color: teamColor, textShadow: `0 0 80px ${teamColor}99` }}
            >
              {currentBid}
            </p>
          </div>

          <div
            className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl border-2"
            style={{
              borderColor: teamColor,
              backgroundColor: `${teamColor}18`,
              boxShadow: `0 0 40px ${teamColor}44`,
            }}
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: teamColor }} />
            <span className="text-2xl font-black" style={{ color: teamColor }}>{teamName}</span>
          </div>

          <p className="text-sm text-zinc-500">
            Base Price: <span className="font-semibold text-white">{basePrice}</span>
            <span className="ml-3">· Increment: <span className="font-semibold text-white">₹10,00,000</span></span>
          </p>
        </div>
      </div>

      {/* Footer team strip */}
      <div className="relative z-10 flex gap-0 h-12 border-t border-white/10">
        {["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4"].map((c, i) => (
          <div key={i} className="flex-1 opacity-60" style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  );
}
