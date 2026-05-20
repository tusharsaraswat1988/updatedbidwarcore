import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Smartphone, BarChart3, Gavel, Check, ChevronRight } from "lucide-react";

const TABS = [
  { id: "operator", label: "Operator Panel", icon: Gavel, desc: "Control the live auction" },
  { id: "display", label: "LED Display", icon: Monitor, desc: "Broadcast screen" },
  { id: "owner", label: "Owner App", icon: Smartphone, desc: "Team bidding panel" },
  { id: "reports", label: "Reports", icon: BarChart3, desc: "Post-auction analytics" },
];

function OperatorScreen() {
  return (
    <div className="bg-[#09090b] rounded-xl border border-border overflow-hidden text-white font-sans select-none">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-[#0f0f12]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[11px] font-mono text-green-400 uppercase tracking-widest">Live · Round 3 of 8</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>Remaining: <span className="text-white font-bold">28</span></span>
          <div className="px-2 py-0.5 rounded-md bg-primary/20 border border-primary/30 text-primary font-mono font-bold text-xs">00:18</div>
        </div>
      </div>

      <div className="p-4 grid grid-cols-[1fr_1.2fr] gap-4">
        {/* Player card */}
        <div className="space-y-3">
          <div className="rounded-xl border border-border bg-[#111113] overflow-hidden">
            <div className="h-24 bg-gradient-to-br from-primary/20 to-transparent flex items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-primary/30 border-2 border-primary/50 flex items-center justify-center">
                <span className="text-primary font-black text-xl">AM</span>
              </div>
            </div>
            <div className="p-3 space-y-1.5">
              <p className="font-black text-base text-white leading-none">Arjun Mehta</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[10px] font-bold">All-Rounder</span>
                <span className="text-[10px] text-muted-foreground">Age 24 · Lucknow</span>
              </div>
              <div className="pt-1 border-t border-border/50">
                <p className="text-[10px] text-muted-foreground">Base Price</p>
                <p className="text-primary font-black text-sm">₹8,00,000</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[["Avg", "42.3"], ["SR", "138"], ["Wkts", "24"]].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-[#0f0f12] py-2">
                <p className="text-primary font-black text-sm">{v}</p>
                <p className="text-[9px] text-muted-foreground uppercase">{k}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div className="space-y-3">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Current Bid</p>
            <p className="text-2xl font-black text-primary" style={{ textShadow: "0 0 20px rgba(234,179,8,0.4)" }}>₹14,00,000</p>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <p className="text-xs font-bold text-white">Mumbai Hawks</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-[#0f0f12] p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Recent Bids</p>
            <div className="space-y-1.5">
              {[
                { team: "Mumbai Hawks", amt: "₹14L", color: "#F59E0B" },
                { team: "Delhi Stallions", amt: "₹13L", color: "#3B82F6" },
                { team: "Chennai Kings", amt: "₹12L", color: "#EF4444" },
              ].map((b, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
                    <span className={i === 0 ? "text-white font-semibold" : "text-muted-foreground"}>{b.team}</span>
                  </div>
                  <span className={i === 0 ? "font-black text-primary" : "text-muted-foreground"}>{b.amt}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Quick Bid</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { name: "Mumbai", color: "#F59E0B", leading: true },
                { name: "Delhi", color: "#3B82F6", leading: false },
                { name: "Chennai", color: "#EF4444", leading: false },
                { name: "Gujarat", color: "#10B981", leading: false },
              ].map((t) => (
                <div
                  key={t.name}
                  className="rounded-lg border py-2 px-2.5 text-[11px] font-bold cursor-pointer transition-colors"
                  style={{
                    borderColor: t.leading ? `${t.color}50` : "rgba(255,255,255,0.08)",
                    background: t.leading ? `${t.color}15` : "transparent",
                    color: t.leading ? t.color : "rgba(255,255,255,0.5)",
                  }}
                >
                  {t.name} +₹1L
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded-lg bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-black py-2 text-center cursor-pointer hover:bg-green-500/25 transition-colors">
              SOLD
            </div>
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold py-2 text-center cursor-pointer hover:bg-red-500/20 transition-colors">
              UNSOLD
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LedScreen() {
  return (
    <div
      className="rounded-xl overflow-hidden select-none"
      style={{ background: "linear-gradient(135deg, #0a0a0f 0%, #12100a 50%, #0a0a0f 100%)", minHeight: 320 }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <div className="text-[10px] font-mono text-primary/60 uppercase tracking-[0.2em]">BidWar Live</div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] text-red-400 font-bold uppercase tracking-widest">On Air</span>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">Round 3 · Player 12</div>
      </div>

      <div className="flex flex-col items-center px-5 pb-5 space-y-4">
        {/* Player card */}
        <div className="flex items-center gap-5 w-full max-w-md">
          <div
            className="w-20 h-20 rounded-full flex-shrink-0 flex items-center justify-center border-2"
            style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.3), rgba(234,179,8,0.05))", borderColor: "rgba(234,179,8,0.4)" }}
          >
            <span className="text-primary font-black text-2xl">AM</span>
          </div>
          <div>
            <div className="text-[10px] text-primary/70 font-bold uppercase tracking-[0.2em] mb-0.5">Currently Up For Bid</div>
            <h3
              className="text-2xl font-black text-white leading-none"
              style={{ textShadow: "0 0 30px rgba(255,255,255,0.2)" }}
            >
              ARJUN MEHTA
            </h3>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-muted-foreground">All-Rounder</span>
              <span className="text-[10px] text-border">|</span>
              <span className="text-xs text-muted-foreground">Age 24</span>
              <span className="text-[10px] text-border">|</span>
              <span className="text-xs text-muted-foreground">Lucknow</span>
            </div>
          </div>
        </div>

        {/* Bid amount */}
        <div className="text-center space-y-1 w-full">
          <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Current Bid</p>
          <p
            className="text-5xl font-black"
            style={{ color: "#F59E0B", textShadow: "0 0 60px rgba(234,179,8,0.6), 0 0 120px rgba(234,179,8,0.2)" }}
          >
            ₹14,00,000
          </p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-400" />
            <p className="text-sm font-bold text-white">MUMBAI HAWKS</p>
          </div>
        </div>

        {/* Bid bar */}
        <div className="w-full max-w-xs space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Base ₹8L</span>
            <span>Bid ₹14L</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: "60%", background: "linear-gradient(90deg, #F59E0B, #FBBF24)" }}
            />
          </div>
        </div>

        {/* Team strip */}
        <div className="w-full grid grid-cols-4 gap-2">
          {[
            { name: "Mumbai", purse: "₹62L", color: "#F59E0B", leading: true },
            { name: "Delhi", purse: "₹78L", color: "#3B82F6", leading: false },
            { name: "Chennai", purse: "₹45L", color: "#EF4444", leading: false },
            { name: "Gujarat", purse: "₹91L", color: "#10B981", leading: false },
          ].map((t) => (
            <div
              key={t.name}
              className="rounded-lg p-2 text-center border"
              style={{
                borderColor: t.leading ? `${t.color}50` : "rgba(255,255,255,0.06)",
                background: t.leading ? `${t.color}12` : "rgba(255,255,255,0.02)",
              }}
            >
              <p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: t.color }}>{t.name}</p>
              <p className="text-white font-black text-xs mt-0.5">{t.purse}</p>
              {t.leading && (
                <div className="mt-0.5 text-[8px] text-primary font-bold uppercase">Leading</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OwnerScreen() {
  return (
    <div className="max-w-xs mx-auto">
      <div
        className="rounded-2xl overflow-hidden border border-white/10 select-none"
        style={{ background: "linear-gradient(180deg, #0f0f12 0%, #09090b 100%)" }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/50" style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.1), transparent)" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-400 font-mono uppercase tracking-widest">Auction Live</span>
          </div>
          <p className="font-black text-lg text-white">MUMBAI HAWKS</p>
          <div className="flex items-center gap-3 mt-2">
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Purse Left</p>
              <p className="text-primary font-black text-sm">₹34,00,000</p>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Squad</p>
              <p className="font-black text-sm text-white">6 / 16</p>
            </div>
            <div className="w-px h-8 bg-border/50" />
            <div>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Position</p>
              <p className="font-black text-sm text-white">#1</p>
            </div>
          </div>
        </div>

        {/* Current player */}
        <div className="mx-4 my-4 p-4 rounded-xl border border-border bg-[#111113]">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Up for Bid</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
              <span className="text-primary font-black text-sm">AM</span>
            </div>
            <div>
              <p className="font-bold text-sm text-white">Arjun Mehta</p>
              <p className="text-[11px] text-muted-foreground">All-Rounder · Avg 42.3</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
            <div>
              <p className="text-[9px] text-muted-foreground">Base</p>
              <p className="text-sm font-bold text-muted-foreground">₹8,00,000</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Current</p>
              <p className="text-sm font-black text-primary">₹14,00,000</p>
            </div>
          </div>
        </div>

        {/* Leading status */}
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-between">
          <span className="text-xs font-bold text-amber-400">You are leading this bid</span>
          <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        </div>

        {/* Bid button */}
        <div className="px-4 pb-5">
          <div
            className="w-full rounded-2xl py-5 text-center cursor-pointer font-black text-xl border-2 transition-all"
            style={{
              background: "linear-gradient(135deg, #F59E0B, #FBBF24)",
              borderColor: "#F59E0B",
              color: "#000",
              boxShadow: "0 0 30px rgba(245,158,11,0.3)",
            }}
          >
            BID ₹15,00,000
          </div>
          <p className="text-center text-[10px] text-muted-foreground mt-2">Tap to place bid · +₹1,00,000</p>
        </div>
      </div>
    </div>
  );
}

function ReportsScreen() {
  const teams = [
    { name: "Mumbai Hawks", spent: 82, color: "#F59E0B", players: 12 },
    { name: "Delhi Stallions", spent: 68, color: "#3B82F6", players: 10 },
    { name: "Chennai Kings", spent: 74, color: "#EF4444", players: 11 },
    { name: "Gujarat Titans", spent: 91, color: "#10B981", players: 13 },
  ];
  const maxSpent = Math.max(...teams.map(t => t.spent));

  return (
    <div className="bg-[#09090b] rounded-xl border border-border overflow-hidden select-none">
      {/* Header stats */}
      <div className="grid grid-cols-4 divide-x divide-border/50 border-b border-border/50">
        {[
          { label: "Players Sold", val: "42", color: "text-green-400" },
          { label: "Unsold", val: "8", color: "text-red-400" },
          { label: "Total Bid Value", val: "₹3.15 Cr", color: "text-primary" },
          { label: "Avg Per Player", val: "₹7.5L", color: "text-blue-400" },
        ].map(s => (
          <div key={s.label} className="p-3 text-center">
            <p className={`font-black text-base ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="p-4 grid grid-cols-[1.2fr_1fr] gap-4">
        {/* Bar chart */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Team Spend (Lakhs)</p>
          <div className="space-y-2.5">
            {teams.map(t => (
              <div key={t.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white font-medium">{t.name}</span>
                  <span className="font-bold" style={{ color: t.color }}>₹{t.spent}L</span>
                </div>
                <div className="h-4 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    whileInView={{ width: `${(t.spent / maxSpent) * 100}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    style={{ background: t.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top sold */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Top Sold Players</p>
          <div className="space-y-2">
            {[
              { name: "Arjun Mehta", amt: "₹24L", team: "Mumbai", color: "#F59E0B" },
              { name: "Rohit Sinha", amt: "₹21L", team: "Gujarat", color: "#10B981" },
              { name: "Vikram Rao", amt: "₹18L", team: "Chennai", color: "#EF4444" },
              { name: "Dev Sharma", amt: "₹16L", team: "Delhi", color: "#3B82F6" },
            ].map((p, i) => (
              <div key={p.name} className="flex items-center gap-2.5 p-2 rounded-lg bg-white/[0.02] border border-border/40">
                <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{p.name}</p>
                  <p className="text-[9px]" style={{ color: p.color }}>{p.team}</p>
                </div>
                <p className="text-xs font-black text-primary flex-shrink-0">{p.amt}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProductShowcase() {
  const [active, setActive] = useState("operator");

  const screens: Record<string, React.ReactNode> = {
    operator: <OperatorScreen />,
    display: <LedScreen />,
    owner: <OwnerScreen />,
    reports: <ReportsScreen />,
  };

  return (
    <section id="product" className="py-24 px-6 border-t border-border/40">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">Live Preview</div>
          <h2 className="text-4xl md:text-5xl font-display font-black">
            See the platform in action
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Every screen your auction day needs — operator, broadcast, owner bidding, and analytics. All in one platform.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex flex-wrap justify-center gap-2">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all border ${
                active === tab.id
                  ? "bg-primary text-black border-primary shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                  : "border-border text-muted-foreground hover:border-white/20 hover:text-white bg-transparent"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Screen */}
        <div className="relative">
          {/* Browser chrome */}
          <div className="rounded-2xl border border-white/10 overflow-hidden shadow-[0_0_80px_rgba(234,179,8,0.07)]">
            <div className="flex items-center gap-2 px-4 py-3 bg-[#111113] border-b border-white/5">
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-white/5 border border-white/8 text-[11px] text-muted-foreground font-mono">
                  {active === "owner" ? "bidwar.in/tournament/12/owner/3" :
                   active === "display" ? "bidwar.in/tournament/12/display" :
                   active === "reports" ? "bidwar.in/tournament/12/reports" :
                   "bidwar.in/tournament/12/auction"}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-green-400 font-mono">LIVE</span>
              </div>
            </div>
            <div className="bg-[#09090b] p-4 md:p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.22 }}
                >
                  {screens[active]}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Feature callout below screen */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActive(tab.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  active === tab.id
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/50 hover:border-border"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <tab.icon className={`w-4 h-4 ${active === tab.id ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-xs font-bold ${active === tab.id ? "text-white" : "text-muted-foreground"}`}>{tab.label}</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">{tab.desc}</p>
                {active === tab.id && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Check className="w-3 h-3 text-primary" />
                    <span className="text-[10px] text-primary font-semibold">Viewing now</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
