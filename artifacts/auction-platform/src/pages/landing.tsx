import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  Gavel, Monitor, Smartphone, Users, Cast, Dices, QrCode, Zap,
  ChevronRight, Check, Phone, ArrowRight, Trophy, Star, Shield,
  Globe, Cloud, Building2, GraduationCap, ChevronDown,
  Mail, Wifi, BarChart3, Clock, ShieldCheck, Tv, Plus, MessageCircle, Instagram, Facebook, Youtube,
  MapPin, Calendar, Target, CircleDot, Swords, Heart, Wallet, BookOpen,
} from "lucide-react";
import { BLOG_POSTS_META, BLOG_CATEGORIES } from "@workspace/blog-data";
import { formatDate, formatPurse, SPORT_LABEL, type Sport, type UpcomingTournament } from "@/data/upcoming-auctions";
import { HomeSchemaMarkup } from "@/components/schema-markup";
import type { PaymentPlan } from "@/components/payment-modal";
import { PublicNavbar } from "@/components/public-navbar";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import { useIsHydrated } from "@/lib/initial-data/use-is-hydrated";
import { displayAuctionKeys, showcaseKeys } from "@/lib/initial-data/query-keys";
import {
  fetchDisplayAuctions,
  mapDisplayAuctionsToUpcoming,
} from "@/lib/initial-data/homepage-queries";
import type { ShowcaseEventRecord } from "@/lib/initial-data/types";
import { ProductShowcase } from "@/components/product-showcase";
import { Testimonials } from "@/components/testimonials";
import { DemoRequest } from "@/components/demo-request";
import { PaymentModal } from "@/components/payment-modal";

const landingFooterPreset = getBrandSurfacePreset("landing-footer");

// ─── Solutions Hub Data ───────────────────────────────────────────────────────

const SOLUTIONS = [
  {
    icon: Gavel,
    title: "Sports Auction Software",
    href: "/sports-auction-software",
    description: "Run professional franchise auctions for cricket, football, kabaddi, badminton, basketball and more using one centralized platform.",
    cta: "Explore Sports Auction Software",
    accent: "text-yellow-400",
    border: "hover:border-yellow-400/30",
    glow: "hover:shadow-yellow-400/5",
    iconBg: "bg-yellow-400/10",
  },
  {
    icon: Trophy,
    title: "Cricket Auction Software",
    href: "/cricket-auction-software",
    description: "IPL-style cricket player auctions with purse tracking, player categories, owner bidding panels and live display screens.",
    cta: "Explore Cricket Auction Software",
    accent: "text-blue-400",
    border: "hover:border-blue-400/30",
    glow: "hover:shadow-blue-400/5",
    iconBg: "bg-blue-400/10",
  },
  {
    icon: CircleDot,
    title: "Badminton Scoring Software",
    href: "/badminton-scoring-software",
    description: "Live rally-by-rally badminton scoring, LED scoreboards, standings and tournament management in one platform.",
    cta: "Explore Badminton Scoring Software",
    accent: "text-green-400",
    border: "hover:border-green-400/30",
    glow: "hover:shadow-green-400/5",
    iconBg: "bg-green-400/10",
  },
  {
    icon: Building2,
    title: "Franchise Auction Software",
    href: "/franchise-auction-software",
    description: "Conduct professional franchise-based player auctions with automated bidding workflows and real-time updates.",
    cta: "Explore Franchise Auction Software",
    accent: "text-purple-400",
    border: "hover:border-purple-400/30",
    glow: "hover:shadow-purple-400/5",
    iconBg: "bg-purple-400/10",
  },
  {
    icon: Users,
    title: "Player Auction Software",
    href: "/player-auction-software",
    description: "Digitize player auctions for sports leagues with automated bidding, team budgets and live auction controls.",
    cta: "Explore Player Auction Software",
    accent: "text-orange-400",
    border: "hover:border-orange-400/30",
    glow: "hover:shadow-orange-400/5",
    iconBg: "bg-orange-400/10",
  },
  {
    icon: BarChart3,
    title: "Sports League Management Software",
    href: "/sports-league-management-software",
    description: "Manage registrations, auctions, scoring, standings and tournament operations from one platform.",
    cta: "Explore League Management Software",
    accent: "text-cyan-400",
    border: "hover:border-cyan-400/30",
    glow: "hover:shadow-cyan-400/5",
    iconBg: "bg-cyan-400/10",
  },
] as const;

const RESOURCE_SLUGS = [
  "how-to-run-franchise-player-auction",
  "what-is-live-auction-software-sports",
  "ipl-style-auction-format-local-cricket-leagues",
  "badminton-scoring-software-live-rally-guide",
  "sports-league-management-software-buyers-guide",
  "cloud-vs-local-auction-software-sports-events",
];

async function fetchShowcaseEvents(): Promise<ShowcaseEventRecord[]> {
  const response = await fetch("/api/showcase-events", { cache: "no-store" });
  if (!response.ok) return [];
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as ShowcaseEventRecord[]) : [];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Monitor,
    title: "Live Broadcast Display",
    desc: "Full-screen LED display mode with animated player cards, live bid counter, team purse strip, and SOLD stamp. Plug into any projector or TV — broadcast-ready out of the box.",
  },
  {
    icon: Wallet,
    title: "Team Owner Bidding Panel",
    desc: "Every team owner gets a mobile-optimized bidding panel. One-tap bid button, real-time purse tracker, squad overview — bid from any smartphone, no app needed.",
  },
  {
    icon: Gavel,
    title: "Operator Control Dashboard",
    desc: "Run the entire auction from a tablet. Nominate players, start bid timers, accept quick bids, mark SOLD or UNSOLD, and undo the last action — full control, zero cables.",
  },
  {
    icon: Cast,
    title: "Broadcast Overlay",
    desc: "Transparent browser-source overlay for YouTube, Facebook Live, and any broadcast software. Shows hexagon player photo, live bid bar, and team ticker at 1920×1080.",
  },
  {
    icon: BarChart3,
    title: "Auction Analytics & Reports",
    desc: "Post-auction reports with bar charts, purse utilization, top sold players, and team-wise spend breakdown. Export data and share results instantly.",
  },
  {
    icon: Dices,
    title: "Fortune Wheel & Tiebreakers",
    desc: "Animated full-screen spin wheel for lucky draws and tiebreakers. Crowd-pleasing, tournament-ready, and configurable with your team names.",
  },
  {
    icon: QrCode,
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
    discountedPrice: null as number | null,
    cta: "Signup for Free Demo",
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
    discountedPrice: 4500,
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
    discountedPrice: 5400,
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
    discountedPrice: 7200,
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
    discountedPrice: 8100,
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
    discountedPrice: 9900,
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
    discountedPrice: 10800,
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
    desc: "Press Start Auction. The LED display, owner mobile panels, and Broadcast Overlay all sync instantly in real time.",
  },
];

const useCases = [
  {
    icon: Target,
    title: "Cricket Leagues",
    desc: "T20, T10, and box cricket franchise auctions with IPL-style player categories, purse limits, and live bid counters.",
  },
  {
    icon: CircleDot,
    title: "Football Auctions",
    desc: "Franchise football league drafts with team budgets, player roles, and real-time bidding panels for each team owner.",
  },
  {
    icon: Swords,
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
    icon: Heart,
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
    a: "Yes. BidWar includes a browser-source Broadcast Overlay (OBS, vMix, Wirecast, and more) that shows the player photo, live bid amount, team ticker, and bid bar directly in your YouTube or Facebook Live broadcast — giving your event a professional production quality.",
  },
];

// ─── FAQ Item Component ────────────────────────────────────────────────────────

function GalleryCard({
  item,
  index,
  animate,
}: {
  item: { img: string; caption: string; tag: string; alt: string; description?: string | null };
  index: number;
  animate: boolean;
}) {
  const card = (
    <div className="relative rounded-2xl overflow-hidden border border-border group cursor-default">
      <img
        src={item.img}
        alt={item.alt}
        loading="lazy"
        width={600}
        height={380}
        className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="inline-block px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
          {item.tag}
        </div>
        <p className="font-display font-bold text-white text-sm leading-tight">{item.caption}</p>
        {item.description && (
          <p className="text-[11px] text-white/60 mt-0.5 leading-tight line-clamp-2">{item.description}</p>
        )}
      </div>
    </div>
  );
  if (!animate) return card;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
    >
      {card}
    </motion.div>
  );
}

function FaqItem({ q, a, index, animate }: { q: string; a: string; index: number; animate: boolean }) {
  const [open, setOpen] = useState(false);
  const item = (
    <div className="border border-border rounded-2xl overflow-hidden">
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
    </div>
  );

  if (!animate) return item;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
    >
      {item}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface ShowcaseItem {
  id: number;
  imageUrl: string;
  sportName: string;
  tournamentName: string;
  description?: string | null;
  altText?: string | null;
}

export default function Landing() {
  const [, navigate] = useLocation();
  const isHydrated = useIsHydrated();
  const { logos, brandName, loading: brandingLoading } = usePublicBranding();
  const logoAlt = getBrandLogoAlt(brandName);
  const [payingPlan, setPayingPlan] = useState<PaymentPlan | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: displayAuctions = [] } = useQuery({
    queryKey: displayAuctionKeys.landing,
    queryFn: fetchDisplayAuctions,
    select: mapDisplayAuctionsToUpcoming,
    staleTime: 20_000,
  });

  const { data: showcaseItems } = useQuery({
    queryKey: showcaseKeys.active,
    queryFn: fetchShowcaseEvents,
    staleTime: 20_000,
  });

  const activeGallery: Array<{ img: string; caption: string; tag: string; alt: string; description?: string | null }> =
    showcaseItems && showcaseItems.length > 0
      ? showcaseItems.map((s) => ({
          img: s.imageUrl,
          caption: s.tournamentName,
          tag: s.sportName,
          alt: s.altText ?? `${s.sportName} auction event — ${s.tournamentName}`,
          description: s.description,
        }))
      : galleryItems;

  const isCarousel = activeGallery.length > 6;
  const CARDS_PER_PAGE = 3;
  const totalPages = Math.ceil(activeGallery.length / CARDS_PER_PAGE);

  const advanceCarousel = useCallback(() => {
    setCarouselIndex((prev) => (prev + 1) % totalPages);
  }, [totalPages]);

  useEffect(() => {
    if (!isCarousel) return;
    carouselTimer.current = setInterval(advanceCarousel, 4000);
    return () => {
      if (carouselTimer.current) clearInterval(carouselTimer.current);
    };
  }, [isCarousel, advanceCarousel]);

  function goToPage(page: number) {
    setCarouselIndex(page);
    if (carouselTimer.current) clearInterval(carouselTimer.current);
    carouselTimer.current = setInterval(advanceCarousel, 4000);
  }

  return (
    <MotionConfig isStatic={!isHydrated}>
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">

      {/* ── Schema Markup ───────────────────────────────────────────── */}
      <HomeSchemaMarkup />

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <PublicNavbar />

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
              onClick={() => navigate("/organizer?tab=signup")}
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

      {/* ── Upcoming Auctions Strip ──────────────────────────────── */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-primary text-xs font-bold uppercase tracking-widest mb-1">Live on BidWar</div>
              <h2 className="text-2xl font-display font-black text-white">Upcoming Auctions</h2>
            </div>
            <button
              onClick={() => navigate("/upcoming-auctions")}
              className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline underline-offset-4 flex-shrink-0"
            >
              {displayAuctions.length > 0 ? `View all ${displayAuctions.length}` : "View all"} <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none -mx-2 px-2">
            {displayAuctions.slice(0, 4).map(t => (
              <div
                key={t.id}
                className="flex-shrink-0 w-64 rounded-xl border overflow-hidden bg-[#111113] hover:border-white/20 transition-all duration-200 hover:shadow-[0_0_24px_rgba(0,0,0,0.5)]"
                style={{ borderColor: `${t.accent}22` }}
              >
                {/* Accent header band */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    background: `linear-gradient(135deg, ${t.primary}cc 0%, ${t.primary}66 100%)`,
                    borderBottom: `1px solid ${t.accent}22`,
                  }}
                >
                  <span
                    className="text-xs font-mono font-bold tracking-widest px-2 py-0.5 rounded"
                    style={{ background: `${t.accent}22`, color: t.accent, border: `1px solid ${t.accent}44` }}
                  >
                    {t.code}
                  </span>
                  <span className="text-[10px] font-semibold text-white/40">{SPORT_LABEL[t.sport]}</span>
                </div>

                {/* Body */}
                <div className="p-4 flex flex-col gap-2.5">
                  <p className="font-bold text-sm text-white leading-snug line-clamp-2" style={{ minHeight: "2.5rem" }}>
                    {t.name}
                  </p>

                  <div className="flex flex-col gap-1.5 text-xs text-white/50">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} />
                      <span className="text-white/70 font-medium">{t.city}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} />
                      <span className="text-white/70 font-medium">{formatDate(t.date)}</span>
                      <span className="text-white/30">{t.time} IST</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                    <span className="text-white/40">{t.teams} Teams</span>
                    <span className="font-bold" style={{ color: t.accent }}>{formatPurse(t.purse)}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* "View all" ghost card */}
            <button
              onClick={() => navigate("/upcoming-auctions")}
              className="flex-shrink-0 w-44 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 group min-h-[180px]"
            >
              <div className="w-10 h-10 rounded-full border border-white/10 group-hover:border-primary/40 flex items-center justify-center group-hover:bg-primary/10 transition-all">
                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-xs font-semibold text-white/40 group-hover:text-primary transition-colors text-center leading-snug px-4">
                View all {displayAuctions.length > 0 ? displayAuctions.length : ""} upcoming auctions
              </span>
            </button>
          </div>
        </div>
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

      {/* ── Product Showcase ─────────────────────────────────────────── */}
      <Suspense fallback={<div className="h-96" />}>
        <ProductShowcase />
      </Suspense>

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
      <section id="gallery" className="py-24 px-6 border-t border-border/40" aria-label="Events Powered by BidWar">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Auction Highlights</div>
            <h2 className="text-4xl md:text-5xl font-display font-black">Events Powered by BidWar</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From school championships to professional franchise leagues — BidWar brings the auction experience to life.
            </p>
          </div>

          {isCarousel ? (
            /* ── Auto-sliding carousel (>6 items) ── */
            <div className="relative">
              <div className="overflow-hidden rounded-2xl">
                <motion.div
                  className="flex"
                  animate={{ x: `-${carouselIndex * 100}%` }}
                  transition={{ type: "tween", duration: 0.5, ease: "easeInOut" }}
                  style={{ width: `${totalPages * 100}%` }}
                >
                  {Array.from({ length: totalPages }).map((_, pageIdx) => (
                    <div
                      key={pageIdx}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-0.5"
                      style={{ width: `${100 / totalPages}%` }}
                    >
                      {activeGallery
                        .slice(pageIdx * CARDS_PER_PAGE, pageIdx * CARDS_PER_PAGE + CARDS_PER_PAGE)
                        .map((item, i) => (
                          <GalleryCard key={`${pageIdx}-${i}`} item={item} index={i} animate={false} />
                        ))}
                    </div>
                  ))}
                </motion.div>
              </div>

              {/* Dot navigation */}
              <div className="flex items-center justify-center gap-2 mt-8">
                {Array.from({ length: totalPages }).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => goToPage(idx)}
                    aria-label={`Go to page ${idx + 1}`}
                    className={`rounded-full transition-all duration-300 ${
                      idx === carouselIndex
                        ? "w-6 h-2 bg-primary"
                        : "w-2 h-2 bg-white/20 hover:bg-white/40"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* ── Static grid (≤6 items) ── */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {activeGallery.map((item, i) => (
                <GalleryCard key={i} item={item} index={i} animate />
              ))}
            </div>
          )}
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
          {/* ── 10% Discount Banner ──────────────────────────────── */}
          <div className="relative mb-8 rounded-2xl overflow-hidden border border-primary/25">
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.1) 0%, rgba(234,179,8,0.04) 50%, rgba(234,179,8,0.1) 100%)" }} />
            <motion.div
              animate={{ x: ["-100%", "200%"] }}
              transition={{ repeat: Infinity, duration: 3, ease: "linear", repeatDelay: 2 }}
              className="absolute inset-0 w-1/3 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent pointer-events-none"
            />
            <div className="relative flex flex-col sm:flex-row items-center justify-center gap-3 py-4 px-6 text-center">
              <motion.div
                animate={{ scale: [1, 1.07, 1] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="px-3 py-1 rounded-full bg-primary text-black text-sm font-black uppercase tracking-wide flex-shrink-0"
              >
                10% OFF
              </motion.div>
              <span className="text-white font-semibold text-sm">
                Limited-Time Offer — Save on all paid plans today
              </span>
              <div className="flex items-center gap-1 text-xs text-white/40 flex-shrink-0">
                <Clock className="w-3 h-3" />
                <span>Limited period only</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pricing.map((p, i) => {
              const handlePlanSelect = () =>
                p.discountedPrice
                  ? setPayingPlan({ label: p.label, price: p.price, discountedPrice: p.discountedPrice })
                  : navigate("/organizer?tab=signup");

              return (
              <motion.div
                key={p.label}
                role="button"
                tabIndex={0}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                onClick={handlePlanSelect}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePlanSelect();
                  }
                }}
                className={`group relative p-5 rounded-2xl border ${p.color} flex flex-col gap-4 cursor-pointer transition-all duration-200 hover:scale-[1.02] hover:border-primary/50 hover:bg-primary/[0.04] hover:shadow-[0_0_20px_rgba(234,179,8,0.08)] active:scale-[0.99] active:border-primary/60 active:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-black text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                    {p.badge}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{p.label}</p>
                  {p.discountedPrice ? (
                    <>
                      <p className="text-2xl font-display font-black">
                        ₹{p.discountedPrice.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-white/30 line-through leading-none mt-0.5">{p.price}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">per auction · all taxes included</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-display font-black">{p.price}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">free forever</p>
                    </>
                  )}
                </div>
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Trophy className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="font-semibold text-sm">{p.teams}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
                <div className="mt-auto w-full py-2 rounded-xl text-sm font-bold text-center transition-all duration-200 border border-border text-foreground group-hover:bg-primary group-hover:text-black group-hover:border-primary [.group:active_&]:bg-primary [.group:active_&]:text-black [.group:active_&]:border-primary">
                  {"cta" in p && p.cta ? p.cta : "Get started"}
                </div>
              </motion.div>
              );
            })}
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
              <FaqItem key={i} q={item.q} a={item.a} index={i} animate={isHydrated} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo Request ────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <DemoRequest />
      </Suspense>

      {/* ── Testimonials ────────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <Testimonials />
      </Suspense>

      {/* ── Solutions Hub ────────────────────────────────────────────── */}
      <section id="solutions" className="py-24 px-6 border-t border-border/30">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="text-center mb-14">
            <div className="text-primary text-xs font-bold uppercase tracking-widest mb-3">Solutions</div>
            <h2 className="text-3xl md:text-4xl font-display font-black mb-4">
              One Platform for Every Sports Event
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base">
              BidWar powers franchise player auctions, live bidding, digital scoring, and league management across all major sports. Choose your solution below.
            </p>
          </div>

          {/* Solution Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SOLUTIONS.map((sol) => {
              const Icon = sol.icon;
              return (
                <a
                  key={sol.href}
                  href={sol.href}
                  className={`group relative flex flex-col rounded-2xl border border-border/40 bg-card/30 p-7 transition-all duration-300 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl ${sol.border} ${sol.glow}`}
                >
                  {/* Icon */}
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 ${sol.iconBg}`}>
                    <Icon className={`w-6 h-6 ${sol.accent}`} />
                  </div>

                  {/* Title */}
                  <h3 className={`font-display font-bold text-lg mb-3 group-hover:${sol.accent.replace("text-", "text-")} transition-colors`}>
                    {sol.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                    {sol.description}
                  </p>

                  {/* CTA */}
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${sol.accent}`}>
                    {sol.cta} <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </a>
              );
            })}
          </div>

          {/* Explore BidWar Solutions prose block */}
          <div className="mt-16 rounded-2xl border border-border/30 bg-card/20 p-8 md:p-12">
            <h2 className="text-2xl md:text-3xl font-display font-black mb-6">
              Explore BidWar Solutions
            </h2>
            <div className="prose prose-invert prose-sm md:prose-base max-w-none text-muted-foreground space-y-4 leading-relaxed">
              <p>
                BidWar is India's most complete platform for sports event management — combining{" "}
                <a href="/sports-auction-software" className="text-primary hover:underline font-medium">sports auction software</a>,{" "}
                <a href="/franchise-auction-software" className="text-primary hover:underline font-medium">franchise league management</a>,{" "}
                <a href="/badminton-scoring-software" className="text-primary hover:underline font-medium">badminton scoring</a>,
                live LED displays, team owner bidding panels, and tournament operations in a single cloud-based platform.
              </p>
              <p>
                Whether you are organizing a 6-team{" "}
                <a href="/cricket-auction-software" className="text-primary hover:underline font-medium">cricket auction</a>{" "}
                with IPL-style purse rules, a multi-discipline{" "}
                <a href="/badminton-scoring-software" className="text-primary hover:underline font-medium">badminton tournament</a>{" "}
                with live scoreboards, or a corporate football franchise event — BidWar handles every layer of the operation.
                Team owners bid from their phones via QR-code access. Players are displayed on any TV or projector using BidWar's
                full-screen broadcast display. Purse deductions happen automatically with every sold bid.
              </p>
              <p>
                For league administrators, BidWar's{" "}
                <a href="/sports-league-management-software" className="text-primary hover:underline font-medium">sports league management software</a>{" "}
                manages registrations, match scheduling, live scoring, standings, and end-of-season reports in one dashboard.
                The same platform that runs your{" "}
                <a href="/player-auction-software" className="text-primary hover:underline font-medium">player auction</a>{" "}
                builds the squad rosters that feed directly into your league operations — no duplicate data entry, no spreadsheets.
              </p>
              <p>
                BidWar currently supports cricket, football, kabaddi, badminton, basketball, volleyball, throwball, futsal, and multi-sport combined events.
                Every sport uses the same core platform with sport-specific category structures, scoring rules, and display modes configured by the organizer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Popular Resources ─────────────────────────────────────────── */}
      <section id="resources" className="py-24 px-6 border-t border-border/30">
        <div className="max-w-6xl mx-auto">

          {/* Header */}
          <div className="flex items-end justify-between mb-12">
            <div>
              <div className="text-primary text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5" /> Popular Resources
              </div>
              <h2 className="text-3xl md:text-4xl font-display font-black">
                Guides, Strategies &amp; Tutorials
              </h2>
              <p className="text-muted-foreground mt-2 max-w-xl">
                Educational guides, auction strategies, scoring tutorials and league management resources for tournament organizers.
              </p>
            </div>
            <a
              href="/blog"
              className="hidden sm:flex items-center gap-2 text-sm text-primary font-semibold hover:underline"
            >
              View all articles <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Article Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {RESOURCE_SLUGS.map((slug) => {
              const post = BLOG_POSTS_META.find((p) => p.slug === slug);
              if (!post) return null;
              const cat = BLOG_CATEGORIES.find((c) => c.slug === post.category);
              return (
                <a
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="group flex flex-col rounded-2xl border border-border/40 bg-card/30 hover:bg-card/60 hover:border-border/70 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
                >
                  <div className="p-6 flex flex-col gap-3 flex-1">
                    {cat && (
                      <span className={`inline-block text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full w-fit ${cat.color} ${cat.bgColor}`}>
                        {cat.name}
                      </span>
                    )}
                    <h3 className="font-display font-bold text-base leading-snug group-hover:text-primary transition-colors">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground/60 pt-3 border-t border-border/30">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {post.readingTimeMinutes} min read
                      </span>
                      <span className="flex items-center gap-1 ml-auto text-primary font-medium">
                        Read article <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          <div className="mt-6 flex sm:hidden justify-center">
            <a href="/blog" className="flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
              View all articles <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Learn Sports Auction Management — SEO educational block */}
          <div className="mt-16 space-y-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-black mb-6">
                Learn Sports Auction Management
              </h2>
              <div className="grid md:grid-cols-2 gap-8 text-sm text-muted-foreground leading-relaxed">
                <div className="space-y-4">
                  <p>
                    <strong className="text-foreground">Sports auction software</strong> transforms the way franchise leagues build teams.
                    Instead of random draws or manual spreadsheets, organizers use a{" "}
                    <a href="/sports-auction-software" className="text-primary hover:underline">dedicated auction platform</a>{" "}
                    where team owners bid against each other in real time. Each bid is registered instantly,
                    team budgets (called purses) are deducted automatically, and the full session is displayed
                    on an LED screen for everyone to follow. The result is a live-event experience that raises
                    engagement, creates genuine strategic depth, and gives every franchise owner a reason
                    to show up on match day.
                  </p>
                  <p>
                    <a href="/cricket-auction-software" className="text-primary hover:underline font-medium">Cricket auction software</a>{" "}
                    is the most-used category in India — replicating the IPL's purse structure, player tiers,
                    retention rounds, and marquee bidding in a format any local league can afford. BidWar's{" "}
                    <a href="/franchise-auction-software" className="text-primary hover:underline font-medium">franchise auction software</a>{" "}
                    extends this to every sport: football position-based categories, kabaddi raider vs defender pools,
                    badminton discipline slots, and corporate multi-sport events. One platform; every format.
                  </p>
                  <p>
                    Organizers who have migrated from Excel sheets to BidWar report that auction-day disputes
                    drop significantly — because purse deductions, bid records, and player allocations are
                    tracked automatically with a permanent audit trail. No more post-auction arguments about
                    "who bid how much for which player."
                  </p>
                </div>
                <div className="space-y-4">
                  <p>
                    <a href="/badminton-scoring-software" className="text-primary hover:underline font-medium">Badminton scoring software</a>{" "}
                    is BidWar's second core capability. Rally-by-rally digital scoring replaces paper scorecards,
                    syncs live to any TV or projector via BidWar's scoreboard display mode, and automatically
                    handles service rotation, deuce detection, and game progression based on BWF rules.
                    Umpires score from any smartphone browser — no app installation required. Scores are
                    visible to spectators in real time, making club tournaments feel like broadcast events.
                  </p>
                  <p>
                    Beyond auctions and scoring,{" "}
                    <a href="/sports-league-management-software" className="text-primary hover:underline font-medium">sports league management software</a>{" "}
                    keeps the season running smoothly. BidWar manages player registrations, match scheduling,
                    live scoring, standings, and tournament reports from a single dashboard. The{" "}
                    <a href="/player-auction-software" className="text-primary hover:underline font-medium">player auction data</a>{" "}
                    flows directly into team rosters, which feed into scheduling — no manual data re-entry
                    at any stage.
                  </p>
                  <p>
                    For deeper reading, explore our guides on{" "}
                    <a href="/blog/category/auction-guides" className="text-primary hover:underline">auction how-to guides</a>,{" "}
                    <a href="/blog/category/sport-formats" className="text-primary hover:underline">cricket auction formats</a>,{" "}
                    <a href="/blog/category/platform-features" className="text-primary hover:underline">badminton scoring</a>, and{" "}
                    <a href="/blog/category/platform-features" className="text-primary hover:underline">platform features</a> — written by organizers
                    who have run hundreds of live auctions and tournaments across India.
                  </p>
                </div>
              </div>
            </div>

            {/* Conversion Layer */}
            <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-10 overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
              <div className="relative text-center space-y-4">
                <h2 className="text-2xl md:text-3xl font-display font-black">
                  Ready to Run Your Next Sports Auction?
                </h2>
                <p className="text-muted-foreground max-w-xl mx-auto">
                  Start with a free demo and see how BidWar manages auctions, scoring, league operations and live displays from one platform.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                  <a
                    href="/organizer"
                    className="px-7 py-3 rounded-xl bg-primary text-black font-display font-black text-sm hover:bg-primary/90 transition-all hover:shadow-[0_0_30px_rgba(234,179,8,0.35)] flex items-center justify-center gap-2"
                  >
                    Book Free Demo <ChevronRight className="w-4 h-4" />
                  </a>
                  <a
                    href="https://wa.me/918707488250"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-7 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-card/50 transition-all flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4 text-green-400" /> Contact Sales
                  </a>
                  <a
                    href="#solutions"
                    className="px-7 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-card/50 transition-all flex items-center justify-center gap-2"
                  >
                    Explore Solutions <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
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
                  onClick={() => navigate("/organizer?tab=signup")}
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

      {/* ── WhatsApp Float ──────────────────────────────────────────── */}
      <a
        href="https://wa.me/918707488250?text=Hi%2C%20I%20want%20to%20run%20a%20sports%20auction%20on%20BidWar.%20Can%20you%20help%20me%20set%20up%3F"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-3"
      >
        <motion.span
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 2, duration: 0.4 }}
          className="hidden sm:block bg-[#111113] border border-border text-xs font-semibold text-white px-3 py-1.5 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap"
        >
          Chat with us on WhatsApp
        </motion.span>
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.5, type: "spring", stiffness: 260, damping: 20 }}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-[0_4px_24px_rgba(37,211,102,0.4)] hover:shadow-[0_4px_32px_rgba(37,211,102,0.6)] transition-all hover:scale-110"
          style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
        >
          <MessageCircle className="w-6 h-6 text-white fill-white" />
        </motion.div>
      </a>

      {/* ── About BidWar ─────────────────────────────────────────── */}
      <section id="about" className="py-20 px-6 border-t border-border/30">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-start">
            <div>
              <div className="text-primary text-xs font-bold uppercase tracking-widest mb-3">About</div>
              <h2 className="font-display font-black text-3xl md:text-4xl text-white leading-tight mb-5">
                About BidWar
              </h2>
              <p className="text-white/60 text-sm leading-relaxed">
                BidWar is a cloud-based sports auction and tournament management platform
                designed for cricket, football, kabaddi, and franchise leagues.
              </p>
              <div className="mt-6 pt-6 border-t border-border/30 space-y-1 text-xs text-muted-foreground">
                <p>Operated by <span className="text-white/70 font-medium">CWP Detailers &amp; Motors</span></p>
                <p>Proprietor: Tushar Saraswat</p>
                <p>Varanasi, Uttar Pradesh, India</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70 mb-3">The platform allows organizers to</p>
                <ul className="space-y-2">
                  {[
                    "Conduct live player auctions",
                    "Manage teams and tournaments",
                    "Display live bidding screens",
                    "Operate organizer and owner panels",
                    "Manage auction data securely",
                  ].map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-border/50 bg-white/[0.02] px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-2">Google Sign-In</p>
                <p className="text-sm text-white/60 leading-relaxed">
                  Google Sign-In is used only for secure authentication and organizer account access.
                  BidWar does not sell or share Google user data with third parties.
                </p>
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
              <a href="/" aria-label={`${brandName} Home`} className="inline-flex items-center hover:opacity-90 transition-opacity">
                {brandingLoading ? (
                  <div className="h-10 w-40" aria-hidden />
                ) : (logos.mainReverse || logos.main) ? (
                  <img
                    src={getBrandLogoSrc(logos, landingFooterPreset.logoOrder)}
                    alt={logoAlt}
                    className={landingFooterPreset.sizeClass}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
              </a>
              <p className="text-xs text-muted-foreground leading-relaxed">
                India's live sports auction platform. IPL-grade infrastructure for cricket, football, kabaddi and franchise leagues.
              </p>
              <div className="flex items-center gap-3">
                <a href="https://www.instagram.com/bidwar.in" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                  <Instagram className="w-4 h-4" />
                </a>
                <a href="https://www.facebook.com/bidwar.in" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                  <Facebook className="w-4 h-4" />
                </a>
                <a href="https://www.youtube.com/@bidwarofficial" target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                  <Youtube className="w-4 h-4" />
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
                  { label: "Blog & Guides", href: "/blog" },
                  { label: "Contact Us", href: "/contact" },
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
                  { label: "Legal Hub", href: "/legal" },
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
                <a href="https://bidwar.in" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                  <Globe className="w-3.5 h-3.5 flex-shrink-0" />
                  bidwar.in
                </a>
              </div>
            </div>
          </div>

          {/* Bottom row */}
          <div className="border-t border-border/30 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} BidWar. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              BidWar is a product operated and billed by CWP DETAILER'S AND MOTORS.
            </p>
          </div>
        </div>
      </footer>

      <Suspense fallback={null}>
        <PaymentModal plan={payingPlan} onClose={() => setPayingPlan(null)} />
      </Suspense>
    </div>
    </MotionConfig>
  );
}
