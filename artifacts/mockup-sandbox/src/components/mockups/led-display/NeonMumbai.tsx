export function NeonMumbai() {
  const accent = "#00f5ff";
  const accent2 = "#ff00aa";
  const playerName = "Virat Kohli";
  const currentBid = "₹14,00,00,000";
  const teamName = "Mumbai Warriors";

  return (
    <div
      className="w-full h-screen flex flex-col overflow-hidden relative font-sans"
      style={{ background: "#020010" }}
    >
      {/* Neon grid background */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `
            linear-gradient(${accent}33 1px, transparent 1px),
            linear-gradient(90deg, ${accent}33 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
        }}
      />

      {/* Top radial glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-64 opacity-30 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 70% 100% at 50% 0%, ${accent}66 0%, transparent 80%)`,
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-8 py-3">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-black tracking-[0.3em] uppercase"
            style={{ color: accent, textShadow: `0 0 20px ${accent}` }}
          >
            BidWar
          </span>
          <span className="text-white/30 text-xs">|</span>
          <span className="text-white/40 text-xs tracking-widest uppercase font-mono">IPL Mega Auction 2025</span>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-mono tracking-widest"
          style={{ borderColor: `${accent}66`, color: accent, textShadow: `0 0 10px ${accent}` }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: accent }} />
          LIVE AUCTION
        </div>
      </div>

      {/* Main */}
      <div className="relative z-10 flex flex-1 items-center px-10 gap-8">
        {/* Player card */}
        <div className="flex-shrink-0 relative">
          {/* Outer neon ring */}
          <div
            className="absolute -inset-2 rounded-3xl opacity-60"
            style={{
              background: `linear-gradient(135deg, ${accent}, ${accent2})`,
              filter: "blur(12px)",
            }}
          />
          <div
            className="relative w-52 h-68 rounded-2xl overflow-hidden border-2 flex items-center justify-center"
            style={{
              borderColor: accent,
              background: "linear-gradient(180deg, #0a0020 0%, #1a0030 100%)",
              boxShadow: `0 0 40px ${accent}88 inset`,
              height: "17rem",
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-black"
                style={{
                  background: `linear-gradient(135deg, ${accent}33, ${accent2}33)`,
                  border: `2px solid ${accent}66`,
                  color: accent,
                }}
              >
                VK
              </div>
              <span className="text-white/40 font-mono text-xs">#18</span>
            </div>

            {/* Bottom gradient */}
            <div
              className="absolute bottom-0 left-0 right-0 h-16"
              style={{ background: `linear-gradient(0deg, ${accent}22, transparent)` }}
            />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 space-y-4">
          <div>
            <p
              className="text-xs font-mono tracking-[0.25em] uppercase mb-2"
              style={{ color: `${accent}99` }}
            >
              BATSMAN · RHB · AGE 35
            </p>
            <h1
              className="text-6xl font-black tracking-tight leading-none"
              style={{
                background: `linear-gradient(90deg, #fff 0%, ${accent} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {playerName}
            </h1>
          </div>

          <div>
            <p className="text-xs font-mono tracking-widest uppercase mb-1" style={{ color: `${accent}66` }}>
              Current Bid
            </p>
            <p
              className="text-6xl font-black leading-none"
              style={{
                color: accent,
                textShadow: `0 0 40px ${accent}, 0 0 80px ${accent}66`,
              }}
            >
              {currentBid}
            </p>
          </div>

          <div
            className="inline-flex items-center gap-3 px-5 py-2.5 rounded-xl"
            style={{
              background: `linear-gradient(90deg, ${accent2}22, transparent)`,
              border: `1px solid ${accent2}66`,
              boxShadow: `0 0 30px ${accent2}33`,
            }}
          >
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: accent2, boxShadow: `0 0 10px ${accent2}` }}
            />
            <span
              className="text-xl font-black"
              style={{ color: accent2, textShadow: `0 0 20px ${accent2}` }}
            >
              {teamName}
            </span>
          </div>

          <p className="text-xs font-mono" style={{ color: `${accent}55` }}>
            BASE PRICE: <span style={{ color: accent }}>₹2,00,00,000</span>
            <span className="mx-2">|</span>
            INCREMENT: <span style={{ color: accent }}>₹10,00,000</span>
          </p>
        </div>
      </div>

      {/* Bottom ticker */}
      <div
        className="relative z-10 flex items-center px-8 py-2 border-t text-xs font-mono tracking-widest uppercase gap-6 overflow-hidden"
        style={{ borderColor: `${accent}33`, color: `${accent}77` }}
      >
        <span style={{ color: accent }}>NEXT:</span>
        <span>Rohit Sharma · Base ₹2Cr</span>
        <span>·</span>
        <span>Shubman Gill · Base ₹1Cr</span>
        <span>·</span>
        <span>Jasprit Bumrah · Base ₹2Cr</span>
      </div>
    </div>
  );
}
