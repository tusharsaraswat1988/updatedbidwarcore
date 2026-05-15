import { useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Gavel, Monitor, Smartphone, Users, Radio, Shuffle, Zap,
  ChevronRight, Check, Phone, ArrowRight, Trophy, Star, Shield,
  Globe, Cloud, Award, Building2, GraduationCap, ChevronDown,
  Mail, Wifi, BarChart3, Clock, ShieldCheck, Tv, Plus,
} from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Monitor,
    title: "Live Broadcast Display",
    desc: "Full-screen LED display mode with animated player cards, live bid counter, team purse strip, and SOLD stamp. Plug into any projector or TV — broadcast-ready out of the box.",
  },
  {
    icon: Users,
    title: "Team Owner Bidding Panel",
    desc: "Every team owner gets a mobile-optimized bidding panel. One-tap bid button, real-time purse tracker, squad overview — bid from any smartphone, no app needed.",
  },
  {
    icon: Gavel,
    title: "Operator Control Dashboard",
    desc: "Run the entire auction from a tablet. Nominate players, start bid timers, accept quick bids, mark SOLD or UNSOLD, and undo the last action — full control, zero cables.",
  },
  {
    icon: Radio,
    title: "OBS Streaming Overlay",
    desc: "Transparent overlay for YouTube and Facebook Live streams. Shows hexagon player photo, live bid bar, and team ticker — turn your auction into a broadcast event.",
  },
  {
    icon: BarChart3,
    title: "Auction Analytics & Reports",
    desc: "Post-auction reports with bar charts, purse utilization, top sold players, and team-wise spend breakdown. Export data and share results instantly.",
  },
  {
    icon: Shuffle,
    title: "Fortune Wheel & Tiebreakers",
    desc: "Animated full-screen spin wheel for lucky draws and tiebreakers. Crowd-pleasing, tournament-ready, and configurable with your team names.",
  },
  {
    icon: Zap,
    title: "Player Self-Registration",
    desc: "Players register via a public QR code link — name, photo, role, and stats. Auto-fills your auction roster. No manual data entry for the organizer.",
  },
  {
    icon: Tv,
    title: "Multi-Screen Support",
    desc: "Run the operator panel, LED display, and owner panels simultaneously on separate devices. Designed for projectors, smart TVs, laptops, and mobile — all synced in real time.",
  },
  {
    icon: Cloud,
    title: "Cloud-Based, Any Device",
    desc: "No software installation. No local server. Everything runs in a browser and syncs live across all connected devices — from any city, any venue.",
  },
];

const pricing = [
  {
    label: "Trial",
    price: "Free",
    gst: false,
    teams: "Up to 2 Teams",
    desc: "Run your first auction at zero cost. No credit card required.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
  {
    label: "Starter",
    price: "₹5,000",
    gst: true,
    teams: "Up to 4 Teams",
    desc: "Ideal for small club leagues and community tournaments.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
  {
    label: "Pro",
    price: "₹6,000",
    gst: true,
    teams: "Up to 8 Teams",
    desc: "Built for district and city-level franchise auctions.",
    highlight: true,
    color: "border-primary bg-primary/5",
    badge: "Most Popular",
  },
  {
    label: "Advanced",
    price: "₹8,000",
    gst: true,
    teams: "Up to 12 Teams",
    desc: "Growing franchise leagues with larger rosters.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
  {
    label: "Elite",
    price: "₹9,000",
    gst: true,
    teams: "Up to 16 Teams",
    desc: "State-level and professional franchise tournaments.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
  {
    label: "Premium",
    price: "₹11,000",
    gst: true,
    teams: "Up to 22 Teams",
    desc: "Large multi-city leagues and regional championships.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
  {
    label: "Champion",
    price: "₹12,000",
    gst: true,
    teams: "Up to 30 Teams",
    desc: "National-level and flagship franchise auctions.",
    highlight: false,
    color: "border-border bg-card/30",
    badge: null,
  },
];

const steps = [
  {
    n: "01",
    title: "Create Your Account",
    desc: "Sign up with your mobile number in under 30 seconds. Your first 2-team tournament is free — no credit card required.",
  },
  {
    n: "02",
    title: "Set Up Your Tournament",
    desc: "Add franchises, player categories, purse values, and squad rules. Import via CSV or let players self-register via QR code.",
  },
  {
    n: "03",
    title: "Go Live",
    desc: "Press Start Auction. The LED display, owner mobile panels, and OBS overlay all sync instantly in real time.",
  },
];

const useCases = [
  {
    icon: Trophy,
    title: "Cricket Leagues",
    desc: "T20, T10, and box cricket franchise auctions with IPL-style player categories, purse limits, and live bid counters.",
  },
  {
    icon: Globe,
    title: "Football Auctions",
    desc: "Franchise football league drafts with team budgets, player roles, and real-time bidding panels for each team owner.",
  },
  {
    icon: Award,
    title: "Kabaddi Tournaments",
    desc: "PKL-inspired kabaddi league auctions with full team management, category-based bidding, and LED display support.",
  },
  {
    icon: GraduationCap,
    title: "School Championships",
    desc: "Inter-school and inter-college sports leagues with multi-team auctions, budget controls, and operator-led bidding.",
  },
  {
    icon: Building2,
    title: "Business Sports Leagues",
    desc: "Corporate cricket and football leagues with franchise bidding, sponsor branding, and streaming overlay for events.",
  },
  {
    icon: Users,
    title: "Community Tournaments",
    desc: "Local club and residential society leagues with simple setup, mobile bidding, and projector display for live audiences.",
  },
];

const whyPoints = [
  {
    icon: Wifi,
    title: "Real-Time, Zero Lag",
    desc: "Bids, timers, and sold events sync across all screens within milliseconds. No refresh needed, no manual updates.",
  },
  {
    icon: ShieldCheck,
    title: "Secure & Reliable",
    desc: "Role-based access controls, session-level organizer authentication, and audit logs for every bid and operator action.",
  },
  {
    icon: Clock,
    title: "Setup in Minutes",
    desc: "From signup to live auction in under 15 minutes. No IT team, no installation, no configuration complexity.",
  },
  {
    icon: Globe,
    title: "Works Everywhere",
    desc: "Cloud-based and browser-native. Run your auction from any venue — stadium, hotel, school, or open ground.",
  },
];

const galleryItems = [
  {
    img: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=600&h=380&fit=crop&q=80",
    caption: "T20 League Franchise Auction",
    tag: "Cricket",
    alt: "Cricket stadium aerial view for T20 franchise auction",
  },
  {
    img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&h=380&fit=crop&q=80",
    caption: "Live Team Bidding Session",
    tag: "Football",
    alt: "Sports team huddle at franchise bidding event",
  },
  {
    img: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=600&h=380&fit=crop&q=80",
    caption: "Business League Draft Night",
    tag: "Business League",
    alt: "Indoor sports event live auction session",
  },
  {
    img: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=600&h=380&fit=crop&q=80",
    caption: "Franchise Auction Night",
    tag: "Football",
    alt: "Football league franchise auction event",
  },
  {
    img: "https://images.unsplash.com/photo-1531415074968-036ba1b575da?w=600&h=380&fit=crop&q=80",
    caption: "Multi-Team Player Draft",
    tag: "Kabaddi",
    alt: "Sports field during player draft event",
  },
  {
    img: "https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=600&h=380&fit=crop&q=80",
    caption: "Operator Command Center",
    tag: "Live Auction",
    alt: "Auction operator dashboard running live player auction",
  },
];

const faqs = [
  {
    q: "What is sports auction software?",
    a: "Sports auction software is a digital platform that enables tournament organizers to conduct live player auctions for franchise-based leagues. It manages team rosters, bidding rounds, purse limits, player categories, and real-time bid tracking — replacing manual auction boards with a fully automated, broadcast-ready system.",
  },
  {
    q: "How does cricket auction software work?",
    a: "The auction operator controls the session from a central dashboard — selecting players, starting bid timers, and accepting bids from team owners. Team owners bid from their phones via a dedicated panel. The LED display shows live action on a projector or TV for the audience. Everything syncs in real time.",
  },
  {
    q: "Can BidWar run IPL-style auctions?",
    a: "Yes. BidWar is purpose-built for IPL-style franchise auctions. It supports player categories (Platinum, Gold, Silver, Emerging), team purse tracking, reserve prices, configurable bid increments, and a broadcast-quality LED display — the same format used in professional leagues.",
  },
  {
    q: "Does BidWar support projector and LED screens?",
    a: "Yes. BidWar includes a dedicated full-screen LED Display Mode for large projectors and smart TVs. It features animated player cards, live bid counters, a SOLD stamp animation, team purse strips, and sponsor logo rotation — all in broadcast-quality resolution.",
  },
  {
    q: "Is BidWar cloud-based?",
    a: "Yes. BidWar is fully cloud-based. The operator dashboard, team owner panels, and LED display all run in a browser — no downloads or installations required. All bid data syncs in real time across all connected devices from any location.",
  },
  {
    q: "Is BidWar suitable for local tournaments?",
    a: "Absolutely. BidWar scales from 2-team club auctions to 16-team state-level franchise leagues. The free trial plan supports 2 teams at no cost, making it ideal for first-time organizers and small community tournaments.",
  },
  {
    q: "Can multiple team owners bid simultaneously?",
    a: "Yes. Each team owner gets their own dedicated mobile bidding panel accessible from any smartphone. Multiple owners can see and place bids simultaneously during a live session — the system handles all bids in real time with instant updates for everyone.",
  },
  {
    q: "Does BidWar support YouTube or Facebook Live streaming?",
    a: "Yes. BidWar includes an OBS-compatible transparent streaming overlay that shows the player photo, live bid amount, team ticker, and bid bar directly in your YouTube or Facebook Live broadcast — giving your event a professional production quality.",
  },
];

// ─── FAQ Item Component ────────────────────────────────────────────────────────

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="border border-border rounded-2xl overflow-hidden"
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-card/50 transition-colors"
      >
        <span className="font-display font-bold text-base text-white leading-snug">{q}</span>
        <span className="flex-shrink-0">
          {open
            ? <ChevronDown className="w-5 h-5 text-primary rotate-180 transition-transform duration-200" />
            : <Plus className="w-5 h-5 text-primary transition-transform duration-200" />
          }
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="answer"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-border/50 pt-4">
              {a}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Landing() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/bidwar-logo-transparent.png" alt="BidWar" className="h-9 w-auto" />
            <span className="font-display font-black text-xl tracking-tight text-white">BIDWAR</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#use-cases" className="hover:text-white transition-colors">Use Cases</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
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

      {/* ── Hero ────────────────────────────────────────────────────── */}
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
              Run Professional{" "}
              <span className="text-primary" style={{ textShadow: "0 0 60px rgba(234,179,8,0.4)" }}>
                Sports Auctions
              </span>{" "}
              Live
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              IPL-grade auction infrastructure for cricket, football, kabaddi and all franchise leagues.
              Real-time bidding, LED broadcast display, team owner mobile panels — one platform, every screen.
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
              onClick={() => navigate("/organizer")}
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
            className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground"
          >
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> Free trial — 2 teams</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> No setup fee</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> Works on any device</span>
            <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-green-400" /> No app install needed</span>
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
                  <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Live Auction — Round 3</span>
                </div>
                <div>
                  <p className="text-4xl font-display font-black text-primary" style={{ textShadow: "0 0 30px rgba(234,179,8,0.5)" }}>
                    ₹14,00,000
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">Current Bid — Mumbai Hawks</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {["MH ₹14L", "RB ₹12L", "CH ₹11L", "GT ₹10L"].map((t, i) => (
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

      {/* ── Trust Strip ─────────────────────────────────────────────── */}
      <section className="py-10 px-6 border-y border-border/40 bg-white/[0.015]">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-border/40">
            {[
              { icon: Tv, label: "Broadcast-Quality LED Display" },
              { icon: Smartphone, label: "Mobile Bidding for Team Owners" },
              { icon: Cloud, label: "100% Cloud-Based Platform" },
              { icon: Wifi, label: "Real-Time Bid Sync" },
              { icon: Shield, label: "Operator-Controlled Sessions" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-2 py-4 px-4 text-center">
                <item.icon className="w-5 h-5 text-primary opacity-80" />
                <p className="text-xs text-muted-foreground font-medium leading-tight">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Platform Features</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">Everything your auction needs</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From player registration to live broadcast overlays — BidWar handles every part of your auction day, start to finish.
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

      {/* ── Use Cases ───────────────────────────────────────────────── */}
      <section id="use-cases" className="py-24 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Use Cases</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">Built for every sport</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Whether it's a local cricket league or a multi-city franchise tournament — BidWar is designed to run it.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {useCases.map((u, i) => (
              <motion.div
                key={u.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="p-6 rounded-2xl border border-border bg-card/30 hover:border-primary/30 hover:bg-card/50 transition-all group"
              >
                <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <u.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-display font-bold text-lg mb-2">{u.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{u.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why BidWar ──────────────────────────────────────────────── */}
      <section className="py-24 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="text-primary text-xs font-bold uppercase tracking-widest">Why BidWar</div>
                <h2 className="text-4xl md:text-5xl font-display font-black leading-tight">
                  Auction infrastructure that performs under pressure
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  Real auctions are high-energy, high-stakes events. BidWar is engineered to deliver flawless performance when the room is packed and every second counts.
                </p>
              </div>
              <div className="space-y-5">
                {whyPoints.map((w, i) => (
                  <motion.div
                    key={w.title}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-4"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <w.icon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-display font-bold text-base text-white">{w.title}</p>
                      <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{w.desc}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
            {/* Reuse hero visual */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_60px_rgba(234,179,8,0.08)]"
            >
              <div className="bg-gradient-to-br from-[#0f0f12] to-[#09090b] p-6 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Auction Live — 8 Teams</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { team: "Mumbai Hawks", purse: "₹62L", status: "leading", color: "#F59E0B" },
                    { team: "Rajasthan Bulls", purse: "₹78L", status: "active", color: "#3B82F6" },
                    { team: "Chennai Kings", purse: "₹45L", status: "active", color: "#EF4444" },
                    { team: "Delhi Stallions", purse: "₹91L", status: "full", color: "#10B981" },
                  ].map((t, i) => (
                    <div key={i} className="p-3 rounded-xl border border-white/8 bg-white/[0.03]" style={{ borderLeftColor: `${t.color}60`, borderLeftWidth: 3 }}>
                      <p className="text-xs font-bold text-white truncate">{t.team}</p>
                      <p className="text-lg font-display font-black mt-0.5" style={{ color: t.color }}>{t.purse}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{t.status}</p>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Player</p>
                  <p className="font-display font-black text-white text-base">Rahul Sharma — All-Rounder</p>
                  <p className="text-primary font-bold text-lg mt-0.5">₹8,00,000 <span className="text-xs text-muted-foreground font-normal">base</span></p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Gallery / Past Auctions ──────────────────────────────────── */}
      <section id="gallery" className="py-24 px-6 border-t border-border/40">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Auction Highlights</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">Events Powered by BidWar</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From school championships to professional franchise leagues — BidWar brings the auction experience to life.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {galleryItems.map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.07 }}
                className="relative rounded-2xl overflow-hidden border border-border group cursor-default"
              >
                <img
                  src={item.img}
                  alt={item.alt}
                  loading="lazy"
                  className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="inline-block px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
                    {item.tag}
                  </div>
                  <p className="font-display font-bold text-white text-sm leading-tight">{item.caption}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6 border-y border-border/40">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Process</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">Live in three steps</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              No technical background needed. If you can run a WhatsApp group, you can run a BidWar auction.
            </p>
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

      {/* ── Pricing ─────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Pricing</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">One-time per-tournament pricing</h2>
            <p className="text-muted-foreground text-lg">Pay once per event. No monthly fees. No recurring charges.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pricing.map((p, i) => (
              <motion.div
                key={p.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className={`relative p-5 rounded-2xl border ${p.color} flex flex-col gap-4 transition-all hover:scale-[1.02]`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-black text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                    {p.badge}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{p.label}</p>
                  <p className="text-2xl font-display font-black">{p.price}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    per auction{p.gst && <span className="text-primary/80"> + GST</span>}
                  </p>
                </div>
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Trophy className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-semibold text-sm">{p.teams}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
                <button
                  onClick={() => navigate("/organizer")}
                  className={`mt-auto w-full py-2 rounded-xl text-sm font-bold transition-all ${
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

          {/* Notes row */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              License activated after payment. Contact us on WhatsApp for instant activation.
            </span>
            <span className="hidden sm:block text-border">|</span>
            <span className="flex items-center gap-1.5 text-primary/80">
              <Zap className="w-3.5 h-3.5" />
              AI features carry additional usage charges.
            </span>
          </div>

          {/* Billing Details */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-10 p-6 rounded-2xl border border-border bg-card/20"
          >
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-primary" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Bank Transfer Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Account Name</p>
                    <p className="text-sm font-bold text-white">CWPDETAILERS AND MOTORS</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Account Number</p>
                    <p className="text-sm font-bold text-white font-mono">42105505194</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">IFSC Code</p>
                    <p className="text-sm font-bold text-white font-mono">SBIN0001773</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Branch</p>
                    <p className="text-sm font-bold text-white">Bhelupura, Varanasi</p>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/40">
              After payment, share the transaction screenshot on WhatsApp at <a href="https://wa.me/918707488250" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">+91 8707488250</a> for instant license activation. GST invoice provided on request.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-6 border-t border-border/40">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">FAQ</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">Frequently asked questions</h2>
            <p className="text-muted-foreground text-lg">
              Everything you need to know about running a live sports auction with BidWar.
            </p>
          </div>
          <div className="space-y-3">
            {faqs.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          <div className="relative p-12 rounded-3xl border border-primary/20 bg-primary/5 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative space-y-6">
              <h2 className="text-4xl md:text-5xl font-display font-black">
                Ready to run your auction?
              </h2>
              <p className="text-muted-foreground text-lg">
                Join hundreds of organizers running professional live auctions with BidWar.
                Start free — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => navigate("/organizer")}
                  className="px-8 py-4 rounded-xl bg-primary text-black font-display font-black text-lg hover:bg-primary/90 transition-all hover:shadow-[0_0_40px_rgba(234,179,8,0.4)] flex items-center justify-center gap-2"
                >
                  Create Free Account <ChevronRight className="w-5 h-5" />
                </button>
                <a
                  href="https://wa.me/918707488250"
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

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer className="border-t border-border/40 pt-14 pb-8 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Top row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">

            {/* Brand */}
            <div className="space-y-4 md:col-span-1">
              <div className="flex items-center gap-2.5">
                <img src="/bidwar-logo-transparent.png" alt="BidWar" className="h-9 w-auto" />
                <span className="font-display font-black text-xl text-white">BIDWAR</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                India's live sports auction platform. IPL-grade infrastructure for cricket, football, kabaddi and franchise leagues.
              </p>
              <div className="flex items-center gap-3">
                <a href="https://www.instagram.com/bidwar.in" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                  IG
                </a>
                <a href="https://www.facebook.com/bidwar.in" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                  FB
                </a>
                <a href="https://www.youtube.com/@bidwarofficial" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                  YT
                </a>
              </div>
            </div>

            {/* Product */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Platform</p>
              <div className="space-y-2">
                {[
                  { label: "Features", href: "#features" },
                  { label: "Use Cases", href: "#use-cases" },
                  { label: "Pricing", href: "#pricing" },
                  { label: "FAQ", href: "#faq" },
                  { label: "Auction Gallery", href: "#gallery" },
                ].map(l => (
                  <a key={l.label} href={l.href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{l.label}</a>
                ))}
              </div>
            </div>

            {/* Legal */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Legal</p>
              <div className="space-y-2">
                {[
                  { label: "Terms & Conditions", href: "/legal/terms" },
                  { label: "Privacy Policy", href: "/legal/privacy" },
                  { label: "Acceptable Use", href: "/legal/acceptable-use" },
                  { label: "Disclaimer", href: "/legal/disclaimer" },
                  { label: "Refund Policy", href: "/legal/refund" },
                ].map(l => (
                  <a key={l.label} href={l.href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{l.label}</a>
                ))}
              </div>
            </div>

            {/* Support */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">Support</p>
              <div className="space-y-3">
                <a href="mailto:bidwarsupport@gmail.com" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  bidwarsupport@gmail.com
                </a>
                <a href="https://wa.me/918707488250" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0 text-green-400" />
                  +91 8707488250
                </a>
                <a href="https://www.bidwar.in" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                  <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                  www.bidwar.in
                </a>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="border-t border-border/30 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} BidWar. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              Sports Auction Software · India's Live Auction Platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
