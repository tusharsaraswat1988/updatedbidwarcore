import { useState } from "react";
import { useLocation } from "wouter";
import {
  Gavel,
  Trophy,
  Tv,
  Users,
  Smartphone,
  Laptop,
  Radio,
  CheckCircle2,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  Eye,
  Activity,
  Layers,
} from "lucide-react";

type ShowcasePillarId = "auctions" | "scoring" | "broadcast" | "fan-arena";

interface ShowcasePillar {
  id: ShowcasePillarId;
  tabLabel: string;
  tabSub: string;
  icon: typeof Gavel;
  badge: string;
  title: string;
  tagline: string;
  description: string;
  image: string;
  imageAlt: string;
  surfaceTag: string;
  features: Array<{
    title: string;
    description: string;
  }>;
  connectedSurfaces: string[];
  primaryCta: {
    label: string;
    href: string;
    isExternal?: boolean;
  };
  secondaryCta?: {
    label: string;
    href: string;
    isExternal?: boolean;
  };
}

const SHOWCASE_PILLARS: ShowcasePillar[] = [
  {
    id: "auctions",
    tabLabel: "Live Auctions",
    tabSub: "Operator & Phone Draft",
    icon: Gavel,
    badge: "IPL-STYLE DRAFT ENGINE",
    title: "Real-Time Player Auctions",
    tagline: "Total command for auctioneers, frictionless phone bidding for team owners.",
    description:
      "Run professional sports player drafts without spreadsheets or manual purse calculations. The operator room controls bid increments, lots, and countdown buzzers while franchise owners place live bids directly from mobile browsers.",
    image: "/assets/evidence/auction-control-live-operator.webp",
    imageAlt: "BidWar Live Auctioneer Operator Console showing player on block, bid increments, countdown buzzer and team purse balances",
    surfaceTag: "OPERATOR CONSOLE & PHONE BIDDING",
    features: [
      {
        title: "1-Click Quick Increments",
        description: "Pre-configured increment buttons (+₹10k, +₹25k, +₹50k, +₹1L pts) for rapid, mistake-free bidding.",
      },
      {
        title: "Intelligent Purse Guard",
        description: "Enforces virtual points caps and squad quotas in real time — team owners can never overspend.",
      },
      {
        title: "Instant 1-Click Undo",
        description: "Instantly reverse accidental bids or misclicks with automatic restoration of timers and team budgets.",
      },
      {
        title: "Accelerated Rounds & RTM",
        description: "Built-in Right-To-Match (RTM) options, retention locks, and automated unsold player recycling.",
      },
    ],
    connectedSurfaces: ["Stage LED Wall", "OBS Livestream", "Team Owner App", "SMS Allotments"],
    primaryCta: {
      label: "Start Free Trial",
      href: "/organizer?tab=signup",
    },
    secondaryCta: {
      label: "Auctioneer Login",
      href: "/organizer",
    },
  },
  {
    id: "scoring",
    tabLabel: "Sports Scoring",
    tabSub: "Cricket & Badminton",
    icon: Trophy,
    badge: "BALL-BY-BALL & MATCH ENGINE",
    title: "Live Cricket & Badminton Scoring",
    tagline: "Dedicated digital scoring pads built specifically for community sports tournaments.",
    description:
      "Transition seamlessly from player auctions to championship matches. BidWar features specialized live scoring pads for box cricket, standard T20 cricket, and multi-court badminton tournaments with automatic points table sync.",
    image: "/assets/evidence/bpl-2026-poster.webp",
    imageAlt: "BidWar Premier League Box Cricket live scoring and match overlay interface",
    surfaceTag: "SCORER PWA & LEAGUE HUB",
    features: [
      {
        title: "Ball-by-Ball Cricket Pad",
        description: "Striker rotation, extras (wides/no-balls), fall of wickets, super balls, and live net run rate (NRR) computation.",
      },
      {
        title: "Box Cricket Rule Profiles",
        description: "Customized rule sets for indoor & box arenas: wall runs, direct-hit bonus, wicket minus runs, and last-man standing.",
      },
      {
        title: "Multi-Court Badminton",
        description: "Real-time court scorecards for singles and doubles, interval tracking, deuce detection, and tournament brackets.",
      },
      {
        title: "Automated Standings & NRR",
        description: "Match results instantly update group standings, tiebreaker rules, and playoff qualification brackets.",
      },
    ],
    connectedSurfaces: ["Scoreboard Rails", "Fan Match Center", "Points Table", "Player Leaderboards"],
    primaryCta: {
      label: "Cricket Scoring Software",
      href: "/cricket-auction-software",
    },
    secondaryCta: {
      label: "Badminton Scoring Software",
      href: "/badminton-scoring-software",
    },
  },
  {
    id: "broadcast",
    tabLabel: "Stage LED & OBS",
    tabSub: "1080p60 Live Displays",
    icon: Tv,
    badge: "VENUE & LIVESTREAM GRAPHICS",
    title: "Stage LED Walls & OBS Overlays",
    tagline: "Broadcast-grade visual spectacle on giant venue screens and YouTube/Facebook live streams.",
    description:
      "Transform your community tournament into a televised sporting spectacle. BidWar outputs full-screen 1080p60 animated stage visuals for giant venue LED walls and transparent alpha-channel browser sources for OBS Studio and vMix.",
    image: "/assets/evidence/live-led-screen.webp",
    imageAlt: "BidWar giant venue LED stage screen graphics displaying live player card, current bid, team purse balance, and sponsor logos",
    surfaceTag: "VENUE STAGE LED & OBS BROWSER SOURCE",
    features: [
      {
        title: "Giant Stage LED Displays",
        description: "High-contrast 1080p60 graphics optimized for stage projectors, indoor walls, and outdoor stadium screens.",
      },
      {
        title: "OBS & vMix Transparent Overlays",
        description: "1-click browser-source URL with transparent background: lower-thirds, animated hammer drops, and bid chyrons.",
      },
      {
        title: "Dramatic SOLD Animations",
        description: "Eye-catching hammer drops and team allotment reveals that electrify venue audiences and stream viewers.",
      },
      {
        title: "Sponsor Brand Placement",
        description: "Rotating sponsor banners, stage lower-thirds, and branded scoreboard ribbons to maximize partner ROI.",
      },
    ],
    connectedSurfaces: ["OBS Studio", "vMix / Streamlabs", "Stage Projectors", "Venue Sound System"],
    primaryCta: {
      label: "View Broadcast Engine",
      href: "/sports-auction-software",
    },
    secondaryCta: {
      label: "Explore Academy Overlays",
      href: "/academy",
    },
  },
  {
    id: "fan-arena",
    tabLabel: "Fan Platform & Owners",
    tabSub: "fan.bidwar.in & Mobile",
    icon: Users,
    badge: "CONNECTED TOURNAMENT ECOSYSTEM",
    title: "Public Fan Arena & Team Portals",
    tagline: "Connecting organizers, franchise owners, players, and fans into one living ecosystem.",
    description:
      "Keep every stakeholder informed in real time. Fans track live auctions, ball-by-ball scorecards, and tournament brackets on the public Fan Arena, while team owners review squad rosters and budget balances from anywhere.",
    image: "/assets/evidence/team-bidding-screen.webp",
    imageAlt: "BidWar Team Owner Mobile Bidding Screen and Public Fan Platform Live Match Center",
    surfaceTag: "PUBLIC FAN ARENA & OWNER CONSOLE",
    features: [
      {
        title: "Public Fan Arena (fan.bidwar.in)",
        description: "Live tournament discovery, real-time activity tickers, ball-by-ball match updates, and squad rosters for supporters.",
      },
      {
        title: "Zero-Install Team Owner App",
        description: "Team owners participate from any phone browser via secure tournament link and PIN — zero app store download required.",
      },
      {
        title: "Automated SMS & WhatsApp Alerts",
        description: "Instant WhatsApp and SMS messages dispatched to sold players with congratulatory notices and winning team details.",
      },
      {
        title: "1-Click Squad PDF & Excel Exports",
        description: "Generate official tournament allotment sheets, team squad lists, and auction catalogs in seconds.",
      },
    ],
    connectedSurfaces: ["Public Fan Platform", "Team Owner PWA", "WhatsApp Alerts", "Official PDF Reports"],
    primaryCta: {
      label: "Explore Fan Arena Live ↗",
      href: "/fan/",
      isExternal: false,
    },
    secondaryCta: {
      label: "Book a Product Demo",
      href: "/contact",
    },
  },
];

export function ProductExperienceShowcase({
  onViewAllAuctions,
}: {
  onViewAllAuctions?: () => void;
}) {
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<ShowcasePillarId>("auctions");

  const current = SHOWCASE_PILLARS.find((p) => p.id === activeTab) || SHOWCASE_PILLARS[0];

  const handleCtaClick = (cta: { label: string; href: string; isExternal?: boolean }) => {
    if (cta.isExternal || cta.href.startsWith("http")) {
      window.open(cta.href, "_blank", "noopener,noreferrer");
    } else {
      navigate(cta.href);
    }
  };

  return (
    <section
      id="product-showcase"
      className="relative py-16 px-4 sm:px-6 lg:px-8 border-y border-border/60 bg-gradient-to-b from-card/30 via-background to-card/20 overflow-hidden"
      aria-labelledby="product-showcase-heading"
    >
      {/* Background ambient lighting accents */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-mono font-bold uppercase tracking-widest mb-3">
              <Layers className="w-3.5 h-3.5" aria-hidden />
              Real BidWar Ecosystem
            </div>
            <h2
              id="product-showcase-heading"
              className="text-3xl sm:text-4xl md:text-5xl font-display font-black text-foreground tracking-tight leading-tight"
            >
              Experience BidWar in Action
            </h2>
            <p className="mt-3 text-base sm:text-lg text-muted-foreground leading-relaxed">
              Explore the four core operational surfaces that power premier community tournaments — from high-stakes player
              auctions to ball-by-ball sports scoring, venue LED displays, and public fan engagement.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href="/fan/"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/40 bg-primary/10 text-primary font-bold text-sm hover:bg-primary/20 transition-colors shadow-xs"
            >
              <Eye className="w-4 h-4" aria-hidden />
              <span>Explore Fan Arena</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-70" aria-hidden />
            </a>
            {onViewAllAuctions && (
              <button
                type="button"
                onClick={onViewAllAuctions}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-border bg-card/60 text-muted-foreground hover:text-foreground hover:border-border/80 font-semibold text-sm transition-colors"
              >
                <span>Upcoming Calendar</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {/* 4-Pillar Tabs Navigation */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-8" role="tablist" aria-label="BidWar Product Surfaces">
          {SHOWCASE_PILLARS.map((pillar) => {
            const Icon = pillar.icon;
            const isActive = pillar.id === activeTab;
            return (
              <button
                key={pillar.id}
                role="tab"
                id={`tab-${pillar.id}`}
                aria-selected={isActive}
                aria-controls={`panel-${pillar.id}`}
                onClick={() => setActiveTab(pillar.id)}
                className={`relative p-3.5 sm:p-4 rounded-xl text-left transition-all duration-200 border flex flex-col justify-between cursor-pointer ${
                  isActive
                    ? "bg-card border-primary/60 shadow-lg ring-1 ring-primary/40"
                    : "bg-card/40 border-border/60 hover:bg-card/80 hover:border-border text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                      isActive ? "bg-primary text-primary-foreground font-bold" : "bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" aria-hidden />
                  </div>
                  {isActive && (
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                      Active
                    </span>
                  )}
                </div>
                <div>
                  <div className={`font-display font-black text-sm sm:text-base leading-snug ${isActive ? "text-foreground" : "text-foreground/80"}`}>
                    {pillar.tabLabel}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 font-medium truncate">
                    {pillar.tabSub}
                  </div>
                </div>
                {/* Active bottom accent bar */}
                {isActive && (
                  <div className="absolute bottom-0 left-3 right-3 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            );
          })}
        </div>

        {/* Active Pillar Showcase Stage Card */}
        <div
          id={`panel-${current.id}`}
          role="tabpanel"
          aria-labelledby={`tab-${current.id}`}
          className="rounded-2xl border border-border bg-card/70 backdrop-blur-md shadow-2xl p-6 sm:p-8 lg:p-10 transition-all duration-300"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Visual Media Showcase Frame (Left / 7 cols) */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              <div className="relative rounded-2xl overflow-hidden border border-border bg-slate-950 shadow-inner group">
                {/* Top browser/window header bar */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 text-xs text-muted-foreground select-none">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                    </div>
                    <span className="font-mono text-[11px] text-slate-400 font-semibold ml-2">
                      bidwar.in · {current.surfaceTag}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase text-primary font-bold bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                    <Activity className="w-3 h-3 animate-pulse" aria-hidden />
                    Live System
                  </div>
                </div>

                {/* Primary Genuine Product Asset */}
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-950 flex items-center justify-center">
                  <img
                    src={current.image}
                    alt={current.imageAlt}
                    width={800}
                    height={500}
                    loading="eager"
                    className="w-full h-full object-contain filter contrast-105"
                  />
                  {/* Subtle inner gradient shadow */}
                  <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]" />
                </div>
              </div>

              {/* Connected Surfaces Ribbon */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                <span className="font-mono font-semibold uppercase text-[10px] tracking-wider text-muted-foreground">
                  Synchronized with:
                </span>
                {current.connectedSurfaces.map((surface) => (
                  <span
                    key={surface}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-secondary/60 border border-border text-[11px] font-medium text-foreground"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden />
                    {surface}
                  </span>
                ))}
              </div>
            </div>

            {/* Feature Content & Action Bar (Right / 5 cols) */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-6">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-widest text-primary mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" aria-hidden />
                  {current.badge}
                </div>
                <h3 className="text-2xl sm:text-3xl font-display font-black text-foreground tracking-tight leading-snug">
                  {current.title}
                </h3>
                <p className="mt-1 font-semibold text-sm text-foreground/90 leading-normal">
                  {current.tagline}
                </p>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {current.description}
                </p>
              </div>

              {/* 4 Key Feature Bullets */}
              <div className="space-y-3 pt-2">
                {current.features.map((feature) => (
                  <div key={feature.title} className="flex items-start gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-primary" aria-hidden />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground leading-tight">
                        {feature.title}
                      </h4>
                      <p className="text-xs text-muted-foreground leading-normal mt-0.5">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-border flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleCtaClick(current.primaryCta)}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-black text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <span>{current.primaryCta.label}</span>
                  <ArrowRight className="w-4 h-4" aria-hidden />
                </button>
                {current.secondaryCta && (
                  <button
                    type="button"
                    onClick={() => handleCtaClick(current.secondaryCta!)}
                    className="w-full sm:w-auto px-5 py-3 rounded-xl border border-border text-foreground/90 font-semibold text-sm hover:bg-card hover:border-border/80 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>{current.secondaryCta.label}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Platform Guarantee Metric Strip */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-border/40">
          <div className="p-4 rounded-xl bg-card/30 border border-border/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Laptop className="w-5 h-5 text-primary" aria-hidden />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Zero App Install</div>
              <div className="text-xs text-muted-foreground">Runs in any browser</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card/30 border border-border/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
              <Radio className="w-5 h-5 text-amber-400" aria-hidden />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">1080p60 OBS Feed</div>
              <div className="text-xs text-muted-foreground">Direct broadcast URL</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card/30 border border-border/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-400" aria-hidden />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Virtual Points Purse</div>
              <div className="text-xs text-muted-foreground">Enforced budget caps</div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card/30 border border-border/40 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5 text-blue-400" aria-hidden />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Live Fan Arena</div>
              <div className="text-xs text-muted-foreground">Real-time match updates</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
