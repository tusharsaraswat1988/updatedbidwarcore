const teamColor = "#f59e0b";

const sponsors = [
  { name: "Dream11", color: "#e63c2f" },
  { name: "Jio", color: "#0066ff" },
  { name: "TATA", color: "#0056a2" },
];

const teams = [
  { name: "Mumbai Warriors", short: "MUW", purse: "₹24 Cr", pct: 72, color: "#f59e0b", players: 8 },
  { name: "Delhi Capitals", short: "DEL", purse: "₹31 Cr", pct: 54, color: "#3b82f6", players: 6 },
  { name: "CSK", short: "CSK", purse: "₹18 Cr", pct: 85, color: "#fbbf24", players: 10 },
  { name: "RCB", short: "RCB", purse: "₹12 Cr", pct: 91, color: "#ef4444", players: 11 },
  { name: "KKR", short: "KKR", purse: "₹9 Cr", pct: 94, color: "#8b5cf6", players: 12 },
  { name: "PBKS", short: "PBK", purse: "₹28 Cr", pct: 61, color: "#ec4899", players: 7 },
];

function Header() {
  return (
    <div className="flex items-center justify-between px-6 py-2 border-b border-white/10 bg-black/50 backdrop-blur-sm flex-shrink-0 gap-3">
      {/* Left: Tournament identity */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-yellow-400/20 border border-yellow-400/30 flex items-center justify-center flex-shrink-0">
          <span className="text-yellow-400 font-black text-xs">IPL</span>
        </div>
        <div className="min-w-0">
          <div className="font-black text-base text-white leading-none truncate">IPL Mega Auction 2025</div>
          <div className="text-[10px] text-zinc-500 tracking-widest uppercase">BCCI · Mumbai</div>
        </div>
      </div>

      {/* Center: BidWar brand */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/30 pointer-events-none">
        <div className="w-6 h-6 rounded-md bg-yellow-400 flex items-center justify-center">
          <span className="text-black font-black text-[10px]">BW</span>
        </div>
        <span className="font-black text-sm tracking-widest text-white uppercase">BidWar</span>
      </div>

      {/* Right: Status + stats + sponsor */}
      <div className="flex items-center gap-4 flex-1 justify-end">
        <div className="text-xs text-zinc-500 font-mono tabular-nums">
          <span className="text-green-400 font-bold">42</span> Sold
          {" · "}
          <span className="text-zinc-500">18</span> Left
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border bg-green-500/20 border-green-500/40 text-green-400">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-widest">LIVE</span>
        </div>
        {/* Sponsor logo */}
        <div className="border-l border-white/10 pl-4 flex flex-col items-end gap-0.5">
          <div className="h-9 px-3 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <span className="text-sm font-black text-red-400 tracking-wider">Dream11</span>
          </div>
          <div className="flex gap-1">
            {sponsors.map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: i === 0 ? "#f59e0b" : "#ffffff20" }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PlayerPhotoPanel() {
  return (
    <div className="relative w-64 flex-shrink-0 flex flex-col">
      {/* Photo area */}
      <div className="flex-1 relative overflow-hidden" style={{ background: "linear-gradient(160deg, #1a1000 0%, #0a0800 100%)" }}>
        {/* Watermark initials */}
        <span className="absolute inset-0 flex items-center justify-center text-9xl font-black text-yellow-900/20 select-none">VK</span>

        {/* Diagonal fade to right */}
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 55%, #080808 100%)" }} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(0deg, #080808 0%, transparent 30%)" }} />

        {/* Team color glow overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 40% 40%, ${teamColor}15 0%, transparent 70%)` }} />

        {/* Jersey number */}
        <div className="absolute top-4 left-4 w-12 h-12 rounded-xl flex items-center justify-center font-black text-base text-black" style={{ backgroundColor: teamColor }}>
          #18
        </div>

        {/* Category ribbon */}
        <div className="absolute top-4 right-4 px-3 py-1 rounded-lg text-xs font-black tracking-widest text-black" style={{ backgroundColor: teamColor }}>
          PLATINUM
        </div>
      </div>

      {/* Bottom info bar */}
      <div className="px-4 py-3 bg-black/60 border-t border-white/10">
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest">India · Age 35</p>
        <div className="flex gap-1 mt-1.5">
          {["BAT", "RHB", "ODI: 284"].map(s => (
            <span key={s} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BidSection() {
  return (
    <div className="flex-1 flex flex-col justify-between py-5 px-6 min-w-0">
      {/* Player name */}
      <div>
        <p className="text-xs font-mono tracking-[0.25em] uppercase mb-1" style={{ color: `${teamColor}88` }}>
          BATSMAN · RIGHT HAND BATSMAN
        </p>
        <div className="leading-none mb-4">
          <p className="text-4xl font-black text-zinc-500">VIRAT</p>
          <p className="text-7xl font-black leading-none" style={{ color: teamColor, textShadow: `0 4px 40px ${teamColor}66` }}>
            KOHLI
          </p>
        </div>
        <p className="text-xs text-zinc-600 font-mono">Available: Mar 15 – Apr 30 · Achievements: 3x MVP</p>
      </div>

      {/* Current bid */}
      <div>
        <p className="text-xs text-zinc-500 uppercase tracking-widest font-mono mb-1">Current Bid</p>
        <div className="flex items-end gap-5 mb-4">
          <p className="text-6xl font-black leading-none text-white">₹14 Cr</p>
          <div className="mb-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">Base</p>
            <p className="text-xl font-bold text-zinc-400">₹2 Cr</p>
          </div>
          <div className="mb-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">+Step</p>
            <p className="text-xl font-bold text-zinc-400">₹10L</p>
          </div>
        </div>

        {/* Leading team chip */}
        <div
          className="inline-flex items-center gap-3 px-5 py-3 rounded-xl mb-4"
          style={{
            background: `linear-gradient(90deg, ${teamColor}22 0%, transparent 100%)`,
            borderLeft: `4px solid ${teamColor}`,
          }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-xs text-black" style={{ backgroundColor: teamColor }}>
            MW
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">Leading Bid</p>
            <p className="text-lg font-black text-white">MUMBAI WARRIORS</p>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5">
            <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-xs text-zinc-400 font-mono uppercase tracking-widest">Timer</span>
            <span className="text-2xl font-black tabular-nums" style={{ color: teamColor }}>0:28</span>
          </div>
          <div className="text-xs text-zinc-600 font-mono">· Countdown</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-2">
        {[["IPL Caps", "237"], ["Avg", "52.4"], ["SR", "131.2"], ["100s", "7"]].map(([label, val]) => (
          <div key={label} className="flex-1 py-2 px-2 rounded-lg bg-zinc-900 border border-zinc-800 text-center">
            <p className="text-zinc-500 text-[9px] font-mono uppercase tracking-widest">{label}</p>
            <p className="text-white text-sm font-black">{val}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PursePanel() {
  return (
    <div className="w-48 flex-shrink-0 flex flex-col border-l border-white/8">
      <div className="px-3 py-3 border-b border-white/8">
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-3">Team Purse</p>
        {teams.map(t => (
          <div key={t.name} className="mb-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                <p className="text-white text-[11px] font-semibold truncate" style={{ maxWidth: "75px" }}>{t.short}</p>
              </div>
              <p className="text-[11px] font-mono" style={{ color: t.color }}>{t.purse}</p>
            </div>
            <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${t.pct}%`, backgroundColor: t.color, opacity: 0.6 }} />
            </div>
          </div>
        ))}
      </div>

      {/* Next up */}
      <div className="px-3 py-3 border-b border-white/8 flex-1">
        <p className="text-zinc-500 text-[10px] font-mono uppercase tracking-widest mb-2">Next Up</p>
        {["Rohit Sharma", "Bumrah"].map(name => (
          <div key={name} className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center text-zinc-500 text-[9px] font-bold">{name[0]}{name.split(" ")[1]?.[0]}</div>
            <p className="text-zinc-400 text-[10px] font-medium">{name}</p>
          </div>
        ))}
      </div>

      {/* Sold count */}
      <div className="px-3 py-3 text-center">
        <p className="text-zinc-600 text-[9px] font-mono uppercase tracking-widest mb-1">Sold Today</p>
        <p className="text-3xl font-black" style={{ color: teamColor }}>42</p>
        <p className="text-zinc-600 text-[9px] font-mono">of 60 players</p>
      </div>
    </div>
  );
}

function SponsorTicker() {
  const names = ["Dream11", "Jio Cinema", "TATA", "PayTM", "MRF", "Pepsi", "Dream11", "Jio Cinema", "TATA", "PayTM", "MRF", "Pepsi"];
  return (
    <div className="flex items-center h-9 bg-black/60 border-t border-white/8 overflow-hidden flex-shrink-0">
      <div className="px-4 text-[10px] font-bold uppercase tracking-widest text-zinc-600 whitespace-nowrap flex-shrink-0">POWERED BY</div>
      <div className="flex items-center gap-10 flex-1 overflow-hidden">
        <div className="flex items-center gap-10 whitespace-nowrap animate-[marquee_18s_linear_infinite]">
          {names.map((n, i) => (
            <span key={i} className="text-xs font-bold text-zinc-500">{n}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function StadiumCard() {
  return (
    <div className="w-full h-screen flex flex-col overflow-hidden" style={{ background: "#080808", fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse 60% 50% at 40% 50%, ${teamColor}08 0%, transparent 70%)` }} />

      {/* 1. HEADER */}
      <Header />

      {/* 2. MAIN CONTENT */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Player photo panel (left) */}
        <PlayerPhotoPanel />

        {/* Bid info (center) */}
        <BidSection />

        {/* Team purse panel (right) */}
        <PursePanel />
      </div>

      {/* 3. FOOTER SPONSOR TICKER */}
      <SponsorTicker />
    </div>
  );
}
