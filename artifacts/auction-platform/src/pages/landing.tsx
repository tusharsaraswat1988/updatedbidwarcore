import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Gavel, Monitor, Smartphone, Users, Radio, Shuffle, Zap,
  ChevronRight, Check, Phone, ArrowRight, Trophy, Star, Shield,
} from "lucide-react";

const features = [
  {
    icon: Monitor,
    title: "Live Broadcast Display",
    desc: "Full-screen 1080p LED display with animated player cards, bid counter, and SOLD stamp — broadcast ready.",
  },
  {
    icon: Users,
    title: "Team Owner View",
    desc: "Team owners bid live from their phones. Simple one-tap bid button with real-time purse tracking.",
  },
  {
    icon: Smartphone,
    title: "Remotely Bid",
    desc: "Operators manage the entire auction from a tablet. No cables, no clickers — just a browser.",
  },
  {
    icon: Radio,
    title: "OBS Camera Overlay",
    desc: "Transparent overlay for YouTube / Facebook streaming. Hexagon player photo, live bid bar, team ticker.",
  },
  {
    icon: Shuffle,
    title: "Fortune Wheel",
    desc: "Animated spin wheel for lucky draw tiebreakers between teams. Full-screen, crowd-pleasing.",
  },
  {
    icon: Zap,
    title: "Player Registration",
    desc: "Players self-register via QR code with photo, stats, and role. Auto-fills your auction roster.",
  },
];

const pricing = [
  {
    label: "Trial",
    price: "Free",
    teams: "2 Teams",
    desc: "Try BidWar at no cost.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
  {
    label: "Starter",
    price: "₹999",
    teams: "Up to 4 Teams",
    desc: "Perfect for small club leagues.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
  {
    label: "Pro",
    price: "₹1,999",
    teams: "Up to 8 Teams",
    desc: "District and city-level tournaments.",
    highlight: true,
    color: "border-primary bg-primary/5",
    badge: "Most Popular",
  },
  {
    label: "Elite",
    price: "₹2,999",
    teams: "Up to 16 Teams",
    desc: "State-level and franchise leagues.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
];

const steps = [
  {
    n: "01",
    title: "Create Your Account",
    desc: "Register with your mobile number in 30 seconds. No credit card needed to start.",
  },
  {
    n: "02",
    title: "Set Up Your Tournament",
    desc: "Add teams, players, categories, and purse values. Import via CSV or let players self-register.",
  },
  {
    n: "03",
    title: "Go Live",
    desc: "Hit Start Auction. The LED display, owner phones, and OBS overlay all sync in real time.",
  },
];

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Gavel className="w-4 h-4 text-black" />
            </div>
            <span className="font-display font-black text-xl tracking-tight text-white">BidWar</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/organizer")}
              className="text-sm text-muted-foreground hover:text-white transition-colors hidden sm:block"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/organizer")}
              className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-4xl mx-auto text-center space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest">
              <Star className="w-3 h-3" />
              India's Live Sports Auction Platform
            </div>
            <h1 className="text-5xl md:text-7xl font-display font-black leading-none tracking-tight">
              Run Your Cricket{" "}
              <span className="text-primary" style={{ textShadow: "0 0 60px rgba(234,179,8,0.4)" }}>
                Auction Live
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Broadcast-quality live auction software for cricket, football, kabaddi and all franchise leagues.
              LED display, owner mobile bidding, OBS overlay — all in one platform.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <button
              onClick={() => navigate("/organizer")}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-black font-display font-black text-lg hover:bg-primary/90 transition-all hover:shadow-[0_0_40px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2"
            >
              Start Free <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate("/dashboard")}
              className="w-full sm:w-auto px-8 py-4 rounded-xl border border-border text-foreground font-semibold text-lg hover:bg-card/50 transition-all flex items-center justify-center gap-2"
            >
              <Gavel className="w-5 h-5 text-muted-foreground" />
              Operator Login
            </button>
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-6 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> Free trial — 2 teams</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> No setup fee</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> Works on any device</span>
          </motion.div>
        </div>

        {/* Hero visual */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="max-w-5xl mx-auto mt-16 rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_80px_rgba(234,179,8,0.1)]"
        >
          <div className="bg-gradient-to-br from-[#0f0f12] to-[#09090b] p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 bg-[#09090b] rounded-xl border border-border p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Live Auction</span>
                </div>
                <div>
                  <p className="text-4xl font-display font-black text-primary" style={{ textShadow: "0 0 30px rgba(234,179,8,0.5)" }}>
                    ₹14,00,000
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Current Bid — Mumbai Hawks</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {["MH ₹15L", "RB ₹14L", "CH ₹13L", "GT ₹12L"].map((t, i) => (
                    <div key={i} className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${i === 0 ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card/50 text-muted-foreground"}`}>{t}</div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "SOLD", color: "text-green-400 border-green-500/30 bg-green-500/10", count: "42" },
                  { label: "UNSOLD", color: "text-red-400 border-red-500/30 bg-red-500/10", count: "8" },
                  { label: "REMAINING", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", count: "28" },
                ].map(s => (
                  <div key={s.label} className={`p-4 rounded-xl border ${s.color} flex items-center justify-between`}>
                    <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
                    <span className="text-2xl font-display font-black">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Features</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">Everything you need</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From player registration to live streaming overlays — BidWar covers every part of your auction day.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-6 rounded-2xl border border-border bg-card/30 hover:border-primary/30 hover:bg-card/50 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-6 border-y border-border/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Process</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">How it works</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                  <span className="font-display font-black text-2xl text-primary">{s.n}</span>
                </div>
                <h3 className="font-display font-bold text-xl">{s.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Pricing</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">Simple, per-auction pricing</h2>
            <p className="text-muted-foreground text-lg">Pay once per tournament. No monthly subscription.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {pricing.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className={`relative p-6 rounded-2xl border ${p.color} flex flex-col gap-4 transition-all hover:scale-[1.02]`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-black text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                    {p.badge}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{p.label}</p>
                  <p className="text-3xl font-display font-black">{p.price}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">per auction</p>
                </div>
                <div className="border-t border-border/50 pt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Trophy className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-semibold">{p.teams}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
                <button
                  onClick={() => navigate("/organizer")}
                  className={`mt-auto w-full py-2.5 rounded-xl text-sm font-bold transition-all ${
                    p.highlight
                      ? "bg-primary text-black hover:bg-primary/90"
                      : "border border-border text-foreground hover:bg-card/80"
                  }`}
                >
                  Get started
                </button>
              </motion.div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-8 flex items-center justify-center gap-2">
            <Shield className="w-3.5 h-3.5" />
            License activated by admin after payment. Contact us via WhatsApp for instant activation.
          </p>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="relative p-12 rounded-3xl border border-primary/20 bg-primary/5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative space-y-6">
              <h2 className="text-4xl md:text-5xl font-display font-black">
                Ready to run your auction?
              </h2>
              <p className="text-muted-foreground text-lg">
                Create your free account in 30 seconds. First 2-team tournament is always free.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate("/organizer")}
                  className="px-8 py-4 rounded-xl bg-primary text-black font-display font-black text-lg hover:bg-primary/90 transition-all hover:shadow-[0_0_40px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2"
                >
                  Create Free Account <ChevronRight className="w-5 h-5" />
                </button>
                <a
                  href="https://wa.me/918388011123"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-8 py-4 rounded-xl border border-border text-foreground font-semibold text-lg hover:bg-card/50 transition-all flex items-center justify-center gap-2"
                >
                  <Phone className="w-5 h-5 text-green-400" /> WhatsApp Us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Gavel className="w-3.5 h-3.5 text-black" />
            </div>
            <span className="font-display font-black text-lg text-white">BidWar</span>
          </div>
          <p className="text-xs text-muted-foreground">
            India's Live Sports Auction Platform
          </p>
        </div>
      </footer>
    </div>
  );
}
