import { Suspense, lazy, useEffect, useState, useRef, type FormEvent, type MouseEvent, type WheelEvent } from "react";
import { useLocation } from "wouter";
import {
  Play,
  Maximize2,
  Tv,
  Smartphone,
  Laptop,
  BarChart3,
  CheckCircle2,
  GraduationCap,
  Radio,
  MessageSquare,
  FileSpreadsheet,
  Globe,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { HomeSchemaMarkup } from "@/components/schema-markup";
import type { PaymentPlan } from "@/components/payment-modal";
import { BrandLogoImage } from "@/components/brand-logo-image";
import { PublicAuthCta } from "@/components/public-auth-cta";
import { getBrandLogoAlt, getBrandWordmarkSrc, getPublicBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import {
  MORE_NAV_LINKS,
  SITE_CONTACT,
  SITE_SOCIAL,
  SITE_SOCIAL_PLACEHOLDERS,
  SOLUTION_PLATFORM_LINKS,
  SOLUTION_SPORT_LINKS,
  waMeUrl,
} from "@/lib/public-site-links";
import { BplPromoModal } from "@/components/bpl-promo-modal";
import { VideoModal, type VideoModalProps } from "@/components/home/video-modal";
import { PhotoLightbox, type LightboxItem } from "@/components/home/photo-lightbox";
import { TournamentCalculator } from "@/components/home/tournament-calculator";
import {
  OrganizerVideoReviews,
  type OrganizerReview,
} from "@/components/home/organizer-video-reviews";

import { PricingSection } from "@/components/home/pricing-section";

const PaymentModal = lazy(() =>
  import("@/components/payment-modal").then((m) => ({ default: m.PaymentModal })),
);

const landingHeaderPreset = getBrandSurfacePreset("landing-header");
const landingFooterPreset = getBrandSurfacePreset("landing-footer");
const BRAND_NAME = "BidWar";
const DEMO_WA_MESSAGE =
  "Hi, I want to book a live BidWar demo for my sports auction. Can you help me set up?";

function scrollToSection(sectionId: string, event?: MouseEvent<HTMLAnchorElement>) {
  event?.preventDefault();
  const el = document.getElementById(sectionId);
  if (el) {
    const yOffset = -95; // Account for sticky header + breathing room
    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
}

const brandTextFallback = (className: string) => (
  <span className={className} role="img" aria-label={`${BRAND_NAME} logo`}>
    BidWar<span className="text-primary">.in</span>
  </span>
);

function BrandMark({ className }: { className?: string }) {
  const { logos, iconVersion, brandName } = usePublicBranding();
  const adminWordmark = getBrandWordmarkSrc(logos, landingHeaderPreset.logoOrder);
  const src =
    adminWordmark || getPublicBrandLogoSrc(landingHeaderPreset.logoOrder, iconVersion);

  return (
    <BrandLogoImage
      src={src}
      alt={getBrandLogoAlt(brandName || BRAND_NAME)}
      className={className ?? "h-10 w-auto max-w-[168px] object-contain object-left"}
      width={168}
      height={40}
      loading="eager"
      fallback={brandTextFallback("font-display text-xl tracking-wider font-bold")}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Reusable Micro-Components                                          */
/* ------------------------------------------------------------------ */

function LiveBadge({ label = "LIVE" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[color:var(--live)]/40 bg-[color:var(--live)]/10 px-3 py-1 text-[11px] font-bold tracking-[0.2em] text-[color:var(--live)]">
      <span className="live-dot" />
      {label}
    </span>
  );
}

function StatTile({ value, label, sub }: { value: string; label: string; sub?: string }) {
  const isCompact = value.length > 5;
  const isMini = value.length > 8;

  return (
    <div className="scoreboard-tile flex flex-col justify-between gap-1 px-3.5 py-3 sm:px-4 sm:py-3.5 rounded-xl bg-card/60 border border-white/10 transition-colors hover:border-primary/40 min-h-[84px]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground truncate" title={label}>
        {label}
      </span>
      <span
        className={`font-display font-bold leading-tight text-primary count-flicker truncate ${
          isMini ? "text-lg sm:text-xl" : isCompact ? "text-2xl sm:text-2xl" : "text-2xl sm:text-3xl"
        }`}
        title={value}
      >
        {value}
      </span>
      {sub ? (
        <span className="text-[11px] text-muted-foreground/80 truncate leading-tight" title={sub}>
          {sub}
        </span>
      ) : (
        <span className="h-1.5" />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive Live Bidding Simulation Card                           */
/* ------------------------------------------------------------------ */

function formatPtsShort(n: number): string {
  return `${n.toLocaleString("en-IN")}k Pts`;
}

function AuctionCard({
  player = "ROHIT KAMBLE",
  role = "All-Rounder · Right-Hand Bat · Off-Spin",
  base = 50,
  target = 340,
  team = "MUMBAI TITANS",
  sold = false,
  animate = true,
  purseLeft = "1.62 Cr Pts",
}: {
  player?: string;
  role?: string;
  base?: number;
  target?: number;
  team?: string;
  sold?: boolean;
  animate?: boolean;
  purseLeft?: string;
}) {
  const [bid, setBid] = useState(animate ? base : target);
  const [showStamp, setShowStamp] = useState(!animate && sold);

  useEffect(() => {
    if (!animate) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      setBid(target);
      if (sold) setShowStamp(true);
      return;
    }

    let current = base;
    const step = Math.max(5, Math.round((target - base) / 34));
    const id = window.setInterval(() => {
      current += step + Math.round(Math.random() * 8);
      if (current >= target) {
        current = target;
        setBid(current);
        window.clearInterval(id);
        if (sold) window.setTimeout(() => setShowStamp(true), 350);
      } else {
        setBid(current);
      }
    }, 70);
    return () => window.clearInterval(id);
  }, [animate, base, target, sold]);

  return (
    <div className="panel-rail relative overflow-hidden rounded-2xl border border-primary/30 bg-card/70 p-5 shadow-2xl backdrop-blur-md">
      {/* Broadcast lower-third top strip */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <LiveBadge label={sold || showStamp ? "SOLD" : "ON BLOCK"} />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">LOT · 047</span>
        </div>
        <span className="font-mono text-[10px] tracking-widest text-primary font-bold">POINTS PURSE · NOT MONEY</span>
      </div>

      {/* Player + role */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-2xl font-bold leading-none text-foreground tracking-wide">{player}</div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{role}</div>
        </div>
        <div className="scoreboard-tile flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/25">
          <span className="font-display text-xl font-bold text-primary">#47</span>
        </div>
      </div>

      {/* Bid ticker */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="scoreboard-tile px-3 py-2 rounded-lg bg-black/50 border border-white/5">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Base Points</div>
          <div className="font-mono text-base text-foreground font-bold">{formatPtsShort(base)}</div>
        </div>
        <div className="scoreboard-tile px-3 py-2 rounded-lg bg-black/50 border border-primary/30">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Current Bid</div>
            <span className="text-[10px] font-mono text-primary animate-pulse">▲ LIVE</span>
          </div>
          <div className="font-mono text-base text-primary font-bold count-flicker">{formatPtsShort(bid)}</div>
        </div>
      </div>

      {/* Team + purse */}
      <div className="mt-4 flex items-center justify-between rounded-lg bg-black/50 border border-white/10 px-3.5 py-2.5">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Leading Bidder</div>
          <div className="font-display text-sm font-bold text-primary tracking-wide">{team}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Purse Remaining</div>
          <div className="font-mono text-sm text-foreground font-bold">{purseLeft}</div>
        </div>
      </div>

      {/* Scan-line texture */}
      <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />

      {/* SOLD stamp overlay */}
      {showStamp && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="sold-stamp stamp-in font-display text-5xl font-black text-emerald-400 border-4 border-emerald-400 rounded-xl px-6 py-2 rotate-[-12deg] bg-black/80 shadow-2xl">
            SOLD
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page Main Component                                                */
/* ------------------------------------------------------------------ */

export default function LovableHome() {
  const [, navigate] = useLocation();
  const goSignup = () => navigate("/organizer?tab=signup");
  const goBlog = () => navigate("/blog");
  const goAcademy = () => navigate("/academy");
  const goContact = () => navigate("/contact");
  const openDemoWhatsApp = () => {
    window.open(waMeUrl(DEMO_WA_MESSAGE), "_blank", "noopener,noreferrer");
  };

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  // Video Modal State
  const [videoModalProps, setVideoModalProps] = useState<VideoModalProps | null>(null);

  // Photo Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxItems, setLightboxItems] = useState<LightboxItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (items: LightboxItem[], index: number = 0) => {
    setLightboxItems(items);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const handlePlayWalkthrough = () => {
    setVideoModalProps({
      isOpen: true,
      onClose: () => setVideoModalProps(null),
      title: "BidWar Live Sports Auction: 2-Minute Full Overview",
      subtitle: "See how operator console, team-owner mobile PWA and 1080p60 LED wall sync in real-time.",
      tournamentTag: "LIVE DEMO",
      organizerName: "BidWar Broadcast Team",
      videoUrl: "https://www.youtube.com/@bidwarofficial",
    });
  };

  const handlePlayReviewVideo = (review: OrganizerReview) => {
    setVideoModalProps({
      isOpen: true,
      onClose: () => setVideoModalProps(null),
      title: `${review.tournament}: Organizer Experience Story`,
      subtitle: `Feedback and auction walkthrough by ${review.name} (${review.role})`,
      organizerName: review.name,
      tournamentTag: review.sport,
      youtubeId: review.youtubeId,
      videoUrl: `https://www.youtube.com/@bidwarofficial`,
    });
  };

  const handlePlayTutorialVideo = (title: string, duration: string, tag: string) => {
    setVideoModalProps({
      isOpen: true,
      onClose: () => setVideoModalProps(null),
      title: `BidWar Academy: ${title}`,
      subtitle: `Official step-by-step masterclass tutorial (${duration}) · ${tag}`,
      tournamentTag: tag,
      organizerName: "BidWar Academy",
      videoUrl: "https://www.youtube.com/@bidwarofficial",
    });
  };

  return (
    <>
      <HomeSchemaMarkup />
      <div className="lovable-home min-h-screen text-foreground bg-stage overflow-x-hidden">
        <Header
          onOpenDrawer={() => setDrawerOpen(true)}
          goBlog={goBlog}
          goAcademy={goAcademy}
        />
        <BplPromoModal />
        {drawerOpen && (
          <MobileDrawer
            onClose={() => setDrawerOpen(false)}
            goBlog={goBlog}
            goAcademy={goAcademy}
            goContact={goContact}
          />
        )}

        <main>
          {/* 1. Hero Section with Live Bidding Simulation */}
          <Hero
            onContact={openDemoWhatsApp}
            goSignup={goSignup}
            onWatchDemo={handlePlayWalkthrough}
          />

          {/* 2. Trust Strip & Live Tournament Ticker */}
          <TrustBadges />
          <Ticker />

          {/* 3. The 7 Connected Surfaces (Auction Control, Bidding Web App, LED Screen, OBS, Live View, Communications, Reports) */}
          <ProductShowcase onOpenLightbox={openLightbox} />

          {/* 4. Real Tournaments & Photographic Evidence */}
          <RealTournaments onOpenLightbox={openLightbox} onPlayReel={handlePlayWalkthrough} />

          {/* 5. Verified Organizer Video Reviews */}
          <OrganizerVideoReviews onPlayVideo={handlePlayReviewVideo} />

          {/* 6. BidWar Academy Video Masterclass */}
          <AcademyPromo onPlayLesson={handlePlayTutorialVideo} />

          {/* 7. Interactive Tournament Setup & Duration Calculator */}
          <TournamentCalculator onStartTrial={goSignup} />

          {/* 8. Transparent Tournament Pricing */}
          <Pricing goSignup={goSignup} />

          {/* 9. FAQ Section */}
          <FAQ />

          {/* 10. Final Booking CTA & Contact Desk */}
          <FinalCTA onContact={openDemoWhatsApp} goSignup={goSignup} />
          <ContactSection onOpen={() => setContactOpen(true)} />
          <Footer />
        </main>

        {/* Video Player Modal */}
        {videoModalProps && (
          <VideoModal {...videoModalProps} onClose={() => setVideoModalProps(null)} />
        )}

        {/* Photo Lightbox Viewer */}
        <PhotoLightbox
          isOpen={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          items={lightboxItems}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
        />

        {/* Sticky Desktop & Mobile CTAs */}
        <button
          type="button"
          onClick={openDemoWhatsApp}
          className="gold-button gold-button-hover fixed bottom-6 right-6 z-40 hidden rounded-full px-6 py-3.5 text-xs font-bold uppercase tracking-wider shadow-2xl md:inline-flex items-center gap-2"
          aria-label="Book live demo"
        >
          <span>Book Live Demo</span>
          <span>→</span>
        </button>
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-stage/95 p-3 backdrop-blur-md md:hidden">
          <button
            type="button"
            onClick={goSignup}
            className="gold-button w-full rounded-md py-3 text-xs font-bold uppercase tracking-wider"
          >
            Start Free Trial (2 Teams)
          </button>
        </div>

        {contactOpen && <ContactDrawer onClose={() => setContactOpen(false)} />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Header Navigation                                                  */
/* ------------------------------------------------------------------ */

function Header({ onOpenDrawer, goBlog, goAcademy }: {
  onOpenDrawer: () => void;
  goBlog: () => void;
  goAcademy: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-stage/90 backdrop-blur-md">
      <div className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
        <a href="/" className="flex items-center gap-3 shrink-0" aria-label={`${BRAND_NAME} Home`}>
          <BrandMark />
        </a>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground lg:flex">
          <a
            href="#surfaces"
            onClick={(e) => scrollToSection("surfaces", e)}
            className="hover:text-foreground transition"
          >
            Surfaces
          </a>
          <a
            href="#tournaments"
            onClick={(e) => scrollToSection("tournaments", e)}
            className="hover:text-foreground transition"
          >
            Case Studies
          </a>
          <a
            href="#reviews"
            onClick={(e) => scrollToSection("reviews", e)}
            className="hover:text-foreground transition"
          >
            Reviews
          </a>
          <a
            href="#academy"
            onClick={(e) => {
              e.preventDefault();
              goAcademy();
            }}
            className="hover:text-foreground flex items-center gap-1.5 transition"
          >
            <span>Academy</span>
            <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] text-primary font-bold">
              VIDEOS
            </span>
          </a>
          <a
            href="#pricing"
            onClick={(e) => scrollToSection("pricing", e)}
            className="hover:text-foreground transition"
          >
            Pricing
          </a>
          <a
            href="/blog"
            onClick={(e) => {
              e.preventDefault();
              goBlog();
            }}
            className="hover:text-foreground transition"
          >
            Blog
          </a>
        </nav>

        <div className="flex items-center gap-2.5 sm:gap-3">
          <a
            href="https://bpl.bidwar.in/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-300 shadow-sm transition hover:border-amber-400 hover:bg-amber-400/25 hover:text-white"
          >
            <span>🏏</span>
            <span className="hidden sm:inline">BPL Portal</span>
            <span className="sm:hidden">BPL</span>
          </a>
          <PublicAuthCta variant="homepage" />
          <button
            type="button"
            onClick={onOpenDrawer}
            className="ghost-button rounded-md p-2 lg:hidden"
            aria-label="Open navigation menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="7" x2="21" y2="7" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="17" x2="21" y2="17" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Mobile Drawer Navigation                                           */
/* ------------------------------------------------------------------ */

function MobileDrawer({ onClose, goBlog, goAcademy, goContact }: {
  onClose: () => void;
  goBlog: () => void;
  goAcademy: () => void;
  goContact: () => void;
}) {
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-stage/98 backdrop-blur-lg lg:hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <span className="font-display text-lg font-bold tracking-wider">MENU</span>
        <button
          type="button"
          onClick={onClose}
          className="ghost-button rounded-md px-3 py-1.5 text-xs font-bold"
          aria-label="Close menu"
        >
          Close ✕
        </button>
      </div>
      <nav className="flex flex-col overflow-y-auto p-5 text-base font-display">
        <a
          href="https://bpl.bidwar.in/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-4 py-3 text-xs font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-400/30 hover:text-white"
        >
          <span>🏏</span>
          <span>BPL Team Registration</span>
        </a>
        {([
          { label: "Surfaces", href: "#surfaces", sectionId: "surfaces" },
          { label: "Case Studies", href: "#tournaments", sectionId: "tournaments" },
          { label: "Organizer Reviews", href: "#reviews", sectionId: "reviews" },
          { label: "Academy (Video Hub)", href: "/academy", action: goAcademy },
          { label: "Pricing", href: "#pricing", sectionId: "pricing" },
          { label: "Blog", href: "/blog", action: goBlog },
          { label: "Upcoming Auctions", href: "/upcoming-auctions" },
          { label: "Contact Us", href: "/contact", action: goContact },
          { label: "FAQ", href: "#faq", sectionId: "faq" },
        ] as const).map((item) => (
          <a
            key={item.label}
            href={item.href}
            onClick={(e) => {
              if ("action" in item && item.action) {
                e.preventDefault();
                item.action();
              } else if ("sectionId" in item && item.sectionId) {
                scrollToSection(item.sectionId, e);
              }
              onClose();
            }}
            className="border-b border-white/5 py-3.5 tracking-wider hover:text-primary transition"
          >
            {item.label}
          </a>
        ))}
        <button
          type="button"
          onClick={() => setSolutionsOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b border-white/5 py-3.5 text-left tracking-wider hover:text-primary transition"
          aria-expanded={solutionsOpen}
        >
          Solutions by Sport
          <span className="text-xs text-muted-foreground">{solutionsOpen ? "▲" : "▼"}</span>
        </button>
        {solutionsOpen ? (
          <div className="border-b border-white/5 pb-3 text-sm">
            {[...SOLUTION_SPORT_LINKS, ...SOLUTION_PLATFORM_LINKS].map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="block py-2 text-muted-foreground hover:text-primary transition"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
        <div className="mt-6">
          <PublicAuthCta variant="drawer" onBeforeNavigate={onClose} />
        </div>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero Section                                                       */
/* ------------------------------------------------------------------ */

function Hero({
  onContact,
  goSignup,
  onWatchDemo,
}: {
  onContact: () => void;
  goSignup: () => void;
  onWatchDemo: () => void;
}) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <BidPulseMotif className="pointer-events-none absolute -right-20 -top-16 h-[520px] w-[520px] opacity-25" />

      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="flex flex-col justify-center">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <LiveBadge label="⚡ 2026 SEASON READY" />
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              #1 Sports Auction Platform in India
            </span>
          </div>

          <h1 className="text-hero font-display tracking-tight">
            <span className="block">From Auction</span>
            <span className="block gold-text">to Champion.</span>
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            BidWar is India&rsquo;s <strong className="text-foreground">auction-first platform</strong> for
            live sports player auctions — IPL-style bidding rooms for cricket, badminton, football, kabaddi,
            and corporate leagues. Team owners bid in <strong className="text-foreground">virtual points</strong> from their phones,
            your LED wall displays real-time graphics, and your operator stays in complete control.
          </p>

          <div className="mt-4 max-w-xl rounded-lg border-l-2 border-primary/50 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            Players are allotted against a virtual points purse — not sold for money on BidWar.
            Organizers manage tournament fees or settlements independently outside the platform.
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={goSignup}
              className="gold-button gold-button-hover rounded-md px-6 py-3.5 text-xs font-bold uppercase tracking-wider"
            >
              Start Free Trial →
            </button>
            <button
              type="button"
              onClick={onWatchDemo}
              className="ghost-button ghost-button-hover rounded-md px-5 py-3.5 text-xs font-semibold flex items-center gap-2"
            >
              <Play className="h-3.5 w-3.5 fill-current text-primary" />
              <span>Watch 2-Min Demo Reel</span>
            </button>
            <button
              type="button"
              onClick={onContact}
              className="text-xs uppercase tracking-wider text-muted-foreground hover:text-primary py-2 px-1 transition"
            >
              WhatsApp Us →
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Free 2-Team Trial</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Points-Based Purses</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Any Phone Browser</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Zero Software Install</span>
          </div>

          {/* Clean 4-Stat Credibility Bar */}
          <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile value="1,240+" label="Auctions" sub="run on BidWar" />
            <StatTile value="86.4K" label="Players" sub="allotted live" />
            <StatTile value="47" label="Cities" sub="across India" />
            <StatTile value="100%" label="Points-Based" sub="safe & compliant" />
          </div>
        </div>

        {/* Live Interactive Auction Card Stack */}
        <div className="relative flex items-center justify-center">
          <div className="relative w-full max-w-md">
            <div className="absolute -inset-6 -z-10 rounded-2xl bg-[image:var(--gradient-gold)] opacity-15 blur-3xl" />
            <div className="mb-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5"><span className="live-dot" /> Live Auction Feed · 01</span>
              <span>1080p60 SYNCED</span>
            </div>
            <AuctionCard />
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-card/50 border border-white/10">
                <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Next in Queue</div>
                <div className="font-display text-sm font-bold text-foreground mt-0.5 tracking-wide">A. Sequeira</div>
                <div className="text-[10px] text-muted-foreground">Fast Bowler · Base 40k Pts</div>
              </div>
              <div className="p-3 rounded-xl bg-card/50 border border-white/10">
                <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-mono">Category Pool</div>
                <div className="font-display text-sm font-bold text-primary mt-0.5 tracking-wide">12 Players Left</div>
                <div className="text-[10px] text-muted-foreground">Marquee All-Rounders</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Trust Badges Strip                                                 */
/* ------------------------------------------------------------------ */

function TrustBadges() {
  const badges = [
    "Multi-Sport Engine",
    "1080p60 LED Ready",
    "OBS Livestream Overlay",
    "Mobile Phone Bidding",
    "Cloud-Native 99.98% Uptime",
    "Zero App Install",
    "Points Purse Compliant",
  ];
  return (
    <section aria-label="Trust badges" className="border-y border-white/5 bg-black/40">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-3.5">
        {badges.map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground font-mono"
          >
            <span className="text-primary font-bold">✓</span> {b}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live Tournament Ticker                                             */
/* ------------------------------------------------------------------ */

function Ticker() {
  const items = [
    "VNCL Premier League 2026 · Mumbai & Varanasi Live Bidding Complete",
    "VNBL 3.0 · Mumbai Titans bid 4.80L Pts for Rohit Kamble",
    "BPL 2026 · Badminton Premier League Player Draft Open",
    "Bangalore Corporate Cup · 12 Teams Allotted on BidWar",
    "UNSOLD · Round 2 Accelerated Recycle activated at base 25k Pts",
    "Pune Sports Guild · 4th Consecutive Season powered by BidWar",
    "LED FEED Live · 1080p60 OBS Overlay Stream Active",
  ];
  const track = [...items, ...items];
  return (
    <div className="border-b border-white/5 bg-black/60 py-2.5 overflow-hidden">
      <div className="flex overflow-hidden">
        <div className="ticker-track flex shrink-0 gap-8 whitespace-nowrap pr-8 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {track.map((t, i) => (
            <span key={i} className="flex items-center gap-2.5">
              <span className="live-dot" />
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Interactive 4-Surface Product Showcase                             */
/* ------------------------------------------------------------------ */

function ProductShowcase({
  onOpenLightbox,
}: {
  onOpenLightbox: (items: LightboxItem[], index: number) => void;
}) {
  const [activeTab, setActiveTab] = useState<number>(0);

  const surfaces = [
    {
      id: "operator",
      title: "Auction Control",
      tag: "CONTROL ROOM",
      icon: Laptop,
      desc: "Total auctioneer command: 1-click bid increments, timer countdown buzzer, category pool selector, RTM, retentions, and instant emergency undo.",
      img: "https://res.cloudinary.com/dja0upxxe/image/upload/v1786695659/Screenshot_2026-08-14_133632.png",
      alt: "BidWar Auction Control console interface showing player queue, timer, quick bid increments and team purses",
      features: [
        "1-Click Quick Bid Increments (₹10k, ₹25k, ₹50k, ₹1L pts)",
        "30s/45s/60s Countdown Timer with Buzzer Audio",
        "Category Pool Filtering (Marquee, Batsmen, Bowlers, All-Rounders)",
        "Instant 1-Click Undo Button for misclicks or disputed bids",
      ],
    },
    {
      id: "owner",
      title: "Team Bidding Screen (Web App)",
      tag: "WEB APP",
      icon: Smartphone,
      desc: "Team owners place real-time bids directly from their mobile phones without app installation. Built-in purse guard prevents overspending and enforces squad quotas.",
      img: "https://res.cloudinary.com/dja0upxxe/image/upload/v1789471841/Screenshot_2026-09-15_165941.png",
      alt: "BidWar Team Bidding Screen Web App on smartphone",
      features: [
        "Zero App Store Install — Opens instantly via secure tournament link & PIN",
        "Intelligent Purse Guard prevents bidding higher than available budget",
        "Live Squad Quota tracker with category slots remaining",
        "Tactile Bid Confirmation with real-time leading bidder feedback",
      ],
    },
    {
      id: "led",
      title: "Live LED Screen",
      tag: "STAGE DISPLAY",
      icon: Tv,
      desc: "Broadcast-grade graphics designed for giant venue LED walls and stage projectors. High-visibility player cards, dynamic purse bars, and sponsor branding.",
      img: "/assets/evidence/real-auction-laptop-vncl.jpg",
      alt: "BidWar real auction laptop display running Live LED Stage Screen",
      features: [
        "Crisp 1080p60 full-screen graphics optimized for giant stage screens",
        "Dramatic animated SOLD / UNSOLD reveal stamps",
        "Simultaneous Live Team Purse & squad balance display",
        "Rotating Sponsor Banners & tournament logo hoardings",
      ],
    },
    {
      id: "obs",
      title: "OBS Overlay (For Live Streaming)",
      tag: "LIVESTREAM",
      icon: Radio,
      desc: "Direct browser-source link for OBS Studio, vMix, and Streamlabs. Stream your live auction to YouTube, Facebook Live, or TV broadcast with professional lower-thirds.",
      img: "/assets/evidence/operator-console-broadcast.png",
      alt: "BidWar OBS Livestream broadcast overlay graphics running for live streaming",
      features: [
        "1-Click OBS Browser Source link with transparent alpha channel",
        "Real-time Lower-Third Chyron with current lot, bid ticker & leading team",
        "Animated Bid Alerts & Hammer Drops rendered seamlessly on stream",
        "Direct streaming support for YouTube Live, Facebook, Twitch & Local TV",
      ],
    },
    {
      id: "live-view",
      title: "Live Auction View",
      tag: "DISTANCE CONNECT",
      isPortrait: true,
      icon: Globe,
      desc: "Real-time spectator portal for team members, players, fans, and remote stakeholders who want to stay connected and follow the auction live from distance.",
      img: "https://res.cloudinary.com/dja0upxxe/image/upload/v1786695659/Screenshot_2026-08-14_133632.png",
      alt: "BidWar Live Auction Remote Spectator View for remote attendees and fans",
      features: [
        "Zero-delay live spectator room accessible from anywhere on any phone or PC",
        "Live Lot Tracking showing current player on hammer and live bids",
        "Real-time squad allotment updates & remaining team purse display",
        "Easily shareable link for WhatsApp groups, remote sponsors & players at home",
      ],
    },
    {
      id: "alerts",
      title: "Communications",
      tag: "EFFECTIVE REACH",
      isPortrait: true,
      icon: MessageSquare,
      desc: "Instant automated WhatsApp, SMS, and email notifications dispatched to players, franchise owners, and captains for maximum effective reach.",
      img: "https://res.cloudinary.com/dja0upxxe/image/upload/v1786695659/Screenshot_2026-08-14_133632.png",
      alt: "BidWar automated communications for effective reach",
      features: [
        "Instant WhatsApp & SMS sent to sold players with winning team & points",
        "Official Team Owner Confirmation Emails with signed allotment slips",
        "Unsold Player Alerts with instant invite to accelerated Round 2",
        "Automated Squad WhatsApp group invites & roster announcements",
      ],
    },
    {
      id: "reports",
      title: "Reports",
      tag: "REPORTS & SQUAD",
      icon: FileSpreadsheet,
      desc: "Comprehensive post-auction reporting and data export. Generate clean rosters, category expenditure breakdowns, and captain sheets in seconds.",
      img: "https://res.cloudinary.com/dja0upxxe/image/upload/v1786695659/Screenshot_2026-08-14_133632.png",
      alt: "BidWar Squad Analytics & CSV export dashboard",
      features: [
        "1-Click Excel / CSV Full Squad Export ready before the crowd leaves",
        "Purse Spend Analysis & category allocation breakdowns per franchise",
        "Printable High-Res PDF Player Allotment Cards for team managers",
        "Complete Immutable Audit Log of every bid transaction and timestamp",
      ],
    },
  ];

  const current = surfaces[activeTab] || surfaces[0];
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsScrollRef.current) {
      const scrollAmount = 260;
      tabsScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleTabsWheel = (e: WheelEvent<HTMLDivElement>) => {
    if (tabsScrollRef.current && e.deltaY !== 0) {
      tabsScrollRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleInspect = () => {
    onOpenLightbox(
      surfaces.map((s) => ({
        src: s.img,
        title: s.title,
        description: s.desc,
        tag: s.tag,
        alt: s.alt,
        isPortrait: s.isPortrait,
      })),
      activeTab
    );
  };

  return (
    <section id="surfaces" className="mx-auto max-w-7xl px-5 py-16 scroll-mt-24">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">The 7 Connected Surfaces</div>
          <h2 className="text-display-lg mt-2 max-w-2xl font-display">One Live Auction. Every Screen & Channel in Real Time.</h2>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Auctioneer control, team bidding web app, venue LED, OBS stream overlays, remote live auction viewer, automated communications, and post-auction reports stay perfectly synchronized in sub-50ms.
        </p>
      </div>

      {/* Surface Selector Tabs - with mouse wheel horizontal scroll and left/right arrows */}
      <div className="relative mb-6 flex items-center gap-2">
        <button
          type="button"
          onClick={() => scrollTabs("left")}
          aria-label="Scroll surfaces left"
          className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-card/70 text-foreground hover:border-primary/50 hover:bg-primary/10 transition shadow-md"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={tabsScrollRef}
          onWheel={handleTabsWheel}
          className="flex flex-1 gap-2.5 overflow-x-auto pb-2 scroll-smooth scrollbar-thin scrollbar-thumb-white/20 snap-x"
        >
          {surfaces.map((s, idx) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`panel flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left transition shrink-0 snap-start ${
                  activeTab === idx
                    ? "border-primary bg-primary/20 text-foreground shadow-lg shadow-primary/10 ring-1 ring-primary/40"
                    : "border-white/10 bg-card/50 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${activeTab === idx ? "bg-primary text-primary-foreground" : "bg-white/5 text-primary"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="whitespace-nowrap">
                  <div className="font-display text-xs font-bold tracking-wide">{s.title}</div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{s.tag}</div>
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollTabs("right")}
          aria-label="Scroll surfaces right"
          className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-card/70 text-foreground hover:border-primary/50 hover:bg-primary/10 transition shadow-md"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Surface Interactive Display Panel */}
      <div className="panel-rail relative overflow-hidden rounded-2xl border border-primary/30 bg-card/60 p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] items-center">
          {/* Media Preview: Conditional Portrait Smartphone Mockup or Landscape Monitor */}
          {current.isPortrait ? (
            <div className="relative group flex items-center justify-center p-4 sm:p-6 rounded-2xl border-2 border-primary/30 bg-black/70 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_35px_rgba(245,158,11,0.18)] ring-1 ring-white/10 min-h-[380px] sm:min-h-[440px] overflow-hidden">
              <div className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />

              {/* Smartphone Chassis */}
              <div className="relative w-[210px] sm:w-[235px] aspect-[9/18.5] rounded-[36px] border-[3px] border-neutral-700 bg-black shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.25)] ring-1 ring-primary/40 overflow-hidden flex flex-col z-10">
                {/* Dynamic Island / Notch */}
                <div className="absolute top-2.5 inset-x-0 z-20 flex justify-center pointer-events-none">
                  <div className="h-3.5 w-20 bg-black rounded-full border border-white/10 flex items-center justify-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 border border-neutral-700" />
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-900/60" />
                  </div>
                </div>

                {/* Portrait Image */}
                <div className="relative flex-1 overflow-hidden bg-neutral-950">
                  <img
                    src={current.img}
                    alt={current.alt}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none" />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
                </div>

                {/* Home Indicator Bar */}
                <div className="absolute bottom-1.5 inset-x-0 z-20 flex justify-center pointer-events-none">
                  <div className="h-1 w-20 bg-white/40 rounded-full" />
                </div>
              </div>

              <button
                type="button"
                onClick={handleInspect}
                className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-black/85 px-3 py-1.5 font-mono text-xs text-primary border border-primary/30 backdrop-blur-md hover:bg-black hover:border-primary transition shadow-lg z-20"
              >
                <Maximize2 className="h-3.5 w-3.5" /> Fullscreen View
              </button>
            </div>
          ) : (
            <div className="relative group overflow-hidden rounded-xl border-2 border-primary/40 bg-black/95 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(245,158,11,0.2)] ring-1 ring-white/20 aspect-video flex flex-col">
              {/* Monitor Header Bezel */}
              <div className="flex items-center justify-between border-b border-white/10 bg-black/80 px-3.5 py-1.5 backdrop-blur-sm z-10 shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-rose-500/80" />
                  <span className="h-2 w-2 rounded-full bg-amber-500/80" />
                  <span className="h-2 w-2 rounded-full bg-emerald-500/80" />
                </div>
                <span className="font-mono text-[10px] tracking-wider text-white/70 uppercase truncate px-2 font-medium">
                  {current.title} — Live Interface
                </span>
                <div className="w-8" />
              </div>

              {/* Image Preview */}
              <div className="relative flex-1 overflow-hidden bg-black">
                <img
                  src={current.img}
                  alt={current.alt}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-102"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none" />

                <button
                  type="button"
                  onClick={handleInspect}
                  className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-black/85 px-3 py-1.5 font-mono text-xs text-primary border border-primary/30 backdrop-blur-md hover:bg-black hover:border-primary transition shadow-lg"
                >
                  <Maximize2 className="h-3.5 w-3.5" /> Fullscreen View
                </button>
              </div>
            </div>
          )}

          {/* Details & Features List */}
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
                {current.tag}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">Surface 0{activeTab + 1} of 0{surfaces.length}</span>
            </div>

            <h3 className="font-display text-2xl lg:text-3xl font-bold text-foreground mt-2 tracking-wide">
              {current.title}
            </h3>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {current.desc}
            </p>

            <div className="mt-5 space-y-2.5">
              {current.features.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-foreground/90">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400 mt-0.5" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/organizer?tab=signup"
                className="gold-button gold-button-hover rounded-md px-6 py-2.5 text-xs font-bold uppercase tracking-wider shadow-lg"
              >
                Test in Free Trial →
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Real Tournaments & Featured Case Studies                           */
/* ------------------------------------------------------------------ */

type Tournament = {
  id: string;
  tabLabel: string;
  name: string;
  seasonTag: string;
  sportTag: string;
  location: string;
  blurb: string;
  stats: Array<{ v: string; l: string; sub?: string }>;
  image: string;
  reelLabel: string;
};

function RealTournaments({
  onOpenLightbox,
  onPlayReel,
}: {
  onOpenLightbox: (items: LightboxItem[], index: number) => void;
  onPlayReel: () => void;
}) {
  const tournaments: Tournament[] = [
    {
      id: "vnbl3-2026",
      tabLabel: "VNBL 3.0",
      name: "VNBL 3.0 (Vyapari Network Badminton League 2026)",
      seasonTag: "VERIFIED · 2026 LIVE LEAGUE",
      sportTag: "Badminton Auction",
      location: "Hotel Bliss, Banaras",
      blurb:
        "Vyapari Network Badminton League 3.0 conducted live at Hotel Bliss, Banaras. Over 78 players auctioned across 6 franchise teams with real-time stage LED projection, mobile purse guard, and instant squad exports.",
      stats: [
        { v: "6", l: "Teams", sub: "Franchises" },
        { v: "78", l: "Players", sub: "Auctioned" },
        { v: "100%", l: "Purse Accuracy", sub: "Zero Overspend" },
        { v: "0", l: "Disputed Bids", sub: "Stage LED Sync" },
      ],
      image: "https://res.cloudinary.com/dja0upxxe/image/upload/v1789471841/Screenshot_2026-09-15_165941.png",
      reelLabel: "VNBL 3.0 · Stage Highlight Reel",
    },
    {
      id: "apl2026",
      tabLabel: "Alumni Premier League",
      name: "Alumni Premier League 2026",
      seasonTag: "VERIFIED · ALUMNI TOURNAMENT",
      sportTag: "Cricket Auction",
      location: "Benaras Club, Varanasi",
      blurb:
        "St. John's Marhauli Alumni Association (SJMAA) Alumni Premier League 2026 hosted live at the prestigious Benaras Club. 5 franchise teams auctioning 65 alumni players with zero lag, instant squad exports, and big-screen auctioneer console.",
      stats: [
        { v: "5", l: "Teams", sub: "Franchises" },
        { v: "65", l: "Players", sub: "Auctioned" },
        { v: "100%", l: "Purse Accuracy", sub: "Zero Errors" },
        { v: "0", l: "Disputed Bids", sub: "Console Sync" },
      ],
      image: "/assets/evidence/real-auction-laptop-vncl.jpg",
      reelLabel: "APL 2026 · Benaras Club Auction Tape",
    },
    {
      id: "bpl2026",
      tabLabel: "BidWar Premier League",
      name: "BidWar Premier League 2026",
      seasonTag: "ACTIVE · 2026 LIVE TOURNAMENT",
      sportTag: "Box Cricket Scoring",
      location: "Pitch and Paddle, Sigra",
      blurb:
        "Official BidWar Premier League conducted at Pitch and Paddle, Sigra. Ball-by-ball box cricket live scoring, real-time LED screen match overlays, automated points table with NRR, and player performance analytics.",
      stats: [
        { v: "8", l: "Teams", sub: "Franchises" },
        { v: "96", l: "Players", sub: "Squad Pool" },
        { v: "100%", l: "Live Overlay", sub: "Stage LED Sync" },
        { v: "0s", l: "Scoring Delay", sub: "Ball-by-Ball" },
      ],
      image: "/assets/evidence/bpl-2026-poster.jpg?v=2",
      reelLabel: "BPL 2026 · Box Cricket Reel",
    },
  ];

  const [idx, setIdx] = useState(0);
  const t = tournaments[idx];

  const handleInspectPhoto = () => {
    onOpenLightbox(
      tournaments.map((tour) => ({
        src: tour.image,
        title: tour.name,
        description: tour.blurb,
        tag: tour.sportTag,
        location: tour.location,
      })),
      idx
    );
  };

  return (
    <section id="tournaments" className="mx-auto max-w-7xl px-5 py-16 scroll-mt-28">
      <div className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">Case Studies · Proven Evidence</div>
        <h2 className="text-display-lg mt-2 max-w-2xl font-display">Real Tournaments. Real Evidence. Zero Bidding Chaos.</h2>
        <p className="mt-3 max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Live leagues run end-to-end on BidWar — venue LED reveal, team-owner mobile bidding, livestream overlays, and exported squad lists before the crowd leaves.
        </p>
      </div>

      <div className="panel-rail relative overflow-hidden p-6 md:p-8 rounded-2xl border border-primary/30 bg-card/60">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />

        {/* Carousel tab bar */}
        <div className="relative mb-6 flex flex-wrap items-center gap-2">
          {tournaments.map((tour, i) => (
            <button
              key={tour.id}
              type="button"
              onClick={() => setIdx(i)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider transition ${
                i === idx
                  ? "border-primary bg-primary/20 text-primary shadow-sm"
                  : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
              }`}
            >
              {tour.tabLabel || tour.name}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {idx + 1} of {tournaments.length}
          </span>
        </div>

        <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color:var(--live)]/40 bg-[color:var(--live)]/10 px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-[color:var(--live)]">
                <span className="live-dot mr-1.5 align-middle" />{t.seasonTag}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                {t.sportTag}
              </span>
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
                {t.location}
              </span>
            </div>
            <h3 className="text-display-md mt-3 font-display font-bold text-foreground tracking-wide">{t.name}</h3>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">{t.blurb}</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {t.stats.map((s) => (
                <StatTile key={s.l} value={s.v} label={s.l} sub={s.sub} />
              ))}
            </div>
          </div>

          {/* Photo & Video Reel Frame */}
          <div className="panel relative overflow-hidden p-3 rounded-xl border border-white/15 bg-black/60 shadow-xl">
            <div className="group relative aspect-video overflow-hidden rounded-lg bg-black">
              <img
                src={t.image}
                alt={t.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              <div className="absolute inset-0 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={onPlayReel}
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[image:var(--gradient-gold)] text-lg text-[color:var(--primary-foreground)] shadow-[var(--shadow-broadcast)] transition hover:scale-110"
                  aria-label="Play highlight video"
                >
                  ▶
                </button>
              </div>

              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/90 font-mono">
                <span>{t.reelLabel}</span>
                <button
                  type="button"
                  onClick={handleInspectPhoto}
                  className="text-primary hover:underline flex items-center gap-1"
                >
                  <Maximize2 className="h-3 w-3" /> Zoom Photo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Academy Video Masterclass Promo                                    */
/* ------------------------------------------------------------------ */

function AcademyPromo({
  onPlayLesson,
}: {
  onPlayLesson: (title: string, duration: string, tag: string) => void;
}) {
  const [, navigate] = useLocation();

  const coreLessons = [
    {
      id: "ep1-setup",
      title: "Set Up Teams, Purses & Player Pools in 5 Minutes",
      duration: "12:04",
      tag: "Beginner",
      ep: "EPISODE 01",
      desc: "Configure team slots, virtual points purse limits, category pools (A/B/C) and QR player registration.",
    },
    {
      id: "ep2-operator",
      title: "Operator Masterclass: Running Bids, Timers & Undos",
      duration: "24:31",
      tag: "Operator",
      ep: "EPISODE 02",
      desc: "Auctioneer control techniques: quick increments, countdown buzzer management, unsold recycling, and emergency undo.",
    },
    {
      id: "ep3-owners",
      title: "Team-Owner Mobile Guide: Bidding & Purse Guard",
      duration: "06:18",
      tag: "Team Owners",
      ep: "EPISODE 03",
      desc: "How team owners log in on any phone browser, track remaining budget, and place real-time bids with purse protection.",
    },
    {
      id: "ep4-broadcast",
      title: "LED Wall & OBS Livestream Setup for YouTube/Facebook",
      duration: "18:47",
      tag: "Broadcast",
      ep: "EPISODE 04",
      desc: "Wiring your laptop to 1080p60 LED stage walls, lower-thirds overlays in OBS Studio, and rotating sponsor banners.",
    },
  ];

  return (
    <section id="academy" className="mx-auto max-w-7xl px-5 py-16">
      <div className="panel-rail relative overflow-hidden rounded-2xl border border-primary/30 bg-card/50 p-6 md:p-10">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1.9fr] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">
              <GraduationCap className="h-4 w-4" /> BidWar Academy
            </div>
            <h2 className="text-display-lg mt-2 font-display">Video Tutorials for Organizers & Operators.</h2>
            <p className="mt-3 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              Step-by-step masterclass videos for organizers, auctioneers, operators and team owners — set purses, run RTM, handle unsold rounds, wire your LED, and go live.
            </p>

            <button
              type="button"
              onClick={() => navigate("/academy")}
              className="gold-button gold-button-hover mt-6 inline-flex items-center gap-2 rounded-md px-5 py-3 text-xs font-bold uppercase tracking-wider"
            >
              <span>Explore All Academy Lessons</span>
              <span>→</span>
            </button>
          </div>

          {/* 4 Video Cards Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {coreLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="panel group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 bg-black/40 p-4 transition hover:border-primary/40 hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-[9px] uppercase tracking-widest text-primary font-bold">
                      {lesson.ep}
                    </span>
                    <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[9px] text-foreground">
                      {lesson.duration}
                    </span>
                  </div>

                  <h3 className="font-display text-sm font-bold text-foreground leading-snug line-clamp-2 tracking-wide">
                    {lesson.title}
                  </h3>
                  <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {lesson.desc}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                    {lesson.tag}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPlayLesson(lesson.title, lesson.duration, lesson.tag)}
                    className="inline-flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider hover:underline"
                  >
                    <Play className="h-3 w-3 fill-current" /> Watch Video
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Transparent Pricing Section                                        */
/* ------------------------------------------------------------------ */

function Pricing({ goSignup }: { goSignup: () => void }) {
  const [payingPlan, setPayingPlan] = useState<PaymentPlan | null>(null);

  return (
    <>
      <PricingSection
        onSelectPlan={(plan) => {
          if (!plan.discountedPrice) {
            goSignup();
            return;
          }
          setPayingPlan(plan);
        }}
      />

      {payingPlan ? (
        <Suspense fallback={null}>
          <PaymentModal plan={payingPlan} onClose={() => setPayingPlan(null)} />
        </Suspense>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Crisp FAQ Section                                                  */
/* ------------------------------------------------------------------ */

function FAQ() {
  const qas = [
    {
      q: "What is sports auction software?",
      a: "It is the technology that runs an IPL-style live player auction — team owners bid virtual points in real time for players from a pool, with categories, points purses, retentions and RTM. BidWar packages the operator console, team-owner mobile panel, and 1080p60 LED display into one live-synced platform.",
    },
    {
      q: "Are players sold for money on BidWar?",
      a: "No. On BidWar, players are allotted against a virtual points purse only. The software does not process player purchase payments or cash transfers between teams, owners, or organizers. Any registration fees or internal settlements outside BidWar are arranged independently by the organizer.",
    },
    {
      q: "Do team owners need to install an app from App Store or Play Store?",
      a: "No. Team owners simply open a direct web link on any phone browser (Safari, Chrome) and log in. It works seamlessly across Android, iOS, tablets, and laptops with zero downloads.",
    },
    {
      q: "How does the big-screen LED display work at the venue?",
      a: "The operator opens the LED Display URL on any laptop connected to the venue LED wall or HDMI projector. It outputs crisp 1080p60 broadcast graphics with lower-thirds, SOLD/UNSOLD stamps, live purse counters, and rotating sponsor banners.",
    },
    {
      q: "How much does a BidWar tournament license cost?",
      a: "BidWar uses transparent one-time per-tournament software licensing with zero recurring charges. Free Trial is available (2 teams). Paid tiers: Starter ₹4,500 (4 teams), Pro ₹5,400 (8 teams), Advanced ₹7,200 (12 teams), Elite ₹8,100 (16 teams), Premium ₹9,900 (22 teams), Champion ₹10,800 (30 teams).",
    },
    {
      q: "What if the operator makes a mistake during live bidding?",
      a: "The operator console has an instant 'Undo Last Action' button and 'Re-Auction' control that immediately resets the player lot and restores the previous team purses on all screens simultaneously.",
    },
  ];

  return (
    <section id="faq" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">FAQ</div>
        <h2 className="text-display-lg mt-2 font-display">Frequently Asked Questions.</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {qas.map((f) => (
          <details key={f.q} className="panel group p-5 rounded-xl border border-white/10 bg-card/40 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-start justify-between gap-4">
              <h3 className="font-display text-base font-bold leading-tight text-foreground tracking-wide">{f.q}</h3>
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 font-mono text-xs text-primary transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-xs sm:text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Contact Section & Consultation Form                                */
/* ------------------------------------------------------------------ */

function ContactSection({ onOpen }: { onOpen: () => void }) {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-5 py-16">
      <div className="panel-rail relative overflow-hidden p-8 md:p-12 rounded-2xl border border-white/10 bg-card/50">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">Book Your Auction</div>
            <h2 className="text-display-lg mt-2 font-display">Talk to an Auction Specialist.</h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground leading-relaxed">
              Share your tournament details — we will walk you through the platform, set up your free trial, and get your auction room ready within minutes.
            </p>
            <div className="mt-8 space-y-3 text-sm">
              <a href={waMeUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition">
                <span className="font-mono text-primary font-bold">CALL / WA</span> {SITE_CONTACT.phoneDisplay}
              </a>
              <a href={`mailto:${SITE_CONTACT.email}`} className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition">
                <span className="font-mono text-primary font-bold">EMAIL&nbsp;&nbsp;&nbsp;</span> {SITE_CONTACT.email}
              </a>
              <div className="flex items-center gap-3 text-muted-foreground">
                <span className="font-mono text-primary font-bold">HQ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> {SITE_CONTACT.addressLine}
              </div>
            </div>
          </div>
          <ContactForm />
        </div>
      </div>
      <div className="mt-6 text-center">
        <button onClick={onOpen} className="text-xs uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition font-mono">
          Prefer a quick popup? Open contact drawer →
        </button>
      </div>
    </section>
  );
}

function ContactForm({ compact = false }: { compact?: boolean }) {
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") || "").trim();
    const mobile = String(fd.get("mobile") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const city = String(fd.get("city") || "").trim();
    const sport = String(fd.get("sport") || "").trim();
    const teams = String(fd.get("teams") || "").trim();
    const contact = String(fd.get("contact") || "").trim();
    const message = String(fd.get("message") || "").trim();
    const text = [
      "Hi, I want a live BidWar demo for my sports auction.",
      name && `Name: ${name}`,
      mobile && `Mobile: ${mobile}`,
      email && `Email: ${email}`,
      city && `City: ${city}`,
      sport && `Sport: ${sport}`,
      teams && `Teams: ${teams}`,
      contact && `Preferred contact: ${contact}`,
      message && `Details: ${message}`,
    ].filter(Boolean).join("\n");
    window.open(waMeUrl(text), "_blank", "noopener,noreferrer");
  };

  return (
    <form onSubmit={onSubmit} className={`panel space-y-3 p-6 rounded-xl border border-white/10 bg-black/40 ${compact ? "text-sm" : ""}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Your Name" name="name" required />
        <Field label="Mobile" name="mobile" type="tel" required />
      </div>
      <Field label="Email" name="email" type="email" required />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City" name="city" />
        <Select label="Primary Sport" name="sport" options={["Cricket", "Football", "Kabaddi", "Badminton", "Basketball", "Volleyball", "Esports", "Corporate League"]} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Number of Teams" name="teams" type="number" placeholder="e.g. 8" />
        <Select label="Preferred Contact" name="contact" options={["WhatsApp", "Phone Call", "Email"]} />
      </div>
      <Field label="Tournament Details" name="message" as="textarea" />
      <button type="submit" className="gold-button gold-button-hover w-full rounded-md py-3 text-xs font-bold uppercase tracking-wider">
        Request Live Consultation →
      </button>
      <p className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
        We respond within 24 hours · Verified sports auction support
      </p>
    </form>
  );
}

function Field({ label, name, type = "text", as, required, placeholder }: {
  label: string; name: string; type?: string; as?: "textarea"; required?: boolean; placeholder?: string;
}) {
  const cls = "w-full rounded-md border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none";
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground font-mono">{label}{required && " *"}</span>
      {as === "textarea"
        ? <textarea name={name} rows={3} className={cls} placeholder={placeholder} />
        : <input name={name} type={type} required={required} placeholder={placeholder} className={cls} />}
    </label>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground font-mono">{label}</span>
      <select name={name} className="w-full rounded-md border border-white/10 bg-black/50 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none">
        <option value="">Select…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function ContactDrawer({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-white/10 bg-stage p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">Live Line</div>
            <h3 className="font-display text-2xl font-bold tracking-wide">Book a Demo</h3>
          </div>
          <button onClick={onClose} className="ghost-button rounded-md px-3 py-2 text-xs font-bold" aria-label="Close">Close ✕</button>
        </div>
        <ContactForm compact />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Final High-Conversion CTA Banner                                   */
/* ------------------------------------------------------------------ */

function FinalCTA({ onContact, goSignup }: { onContact: () => void; goSignup: () => void }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <div className="panel-rail relative overflow-hidden p-10 md:p-14 rounded-2xl border border-primary/30 bg-card/60">
        <BidPulseMotif className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 opacity-35" />
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">Ready to Go Live?</div>
          <h2 className="text-hero mt-3 font-display">
            <span className="block">Your League.</span>
            <span className="block gold-text">Broadcast-Grade.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
            Free 2-team trial · No setup fee · Any device · Ready in five minutes. Start your trial or talk to an auction specialist.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={goSignup}
              className="gold-button gold-button-hover rounded-md px-7 py-3.5 text-xs font-bold uppercase tracking-wider"
            >
              Start Free Trial →
            </button>
            <button
              type="button"
              onClick={onContact}
              className="ghost-button ghost-button-hover rounded-md px-7 py-3.5 text-xs font-semibold"
            >
              ▶ Book Live Consultation
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                             */
/* ------------------------------------------------------------------ */

function FooterBrandMark() {
  const { logos, iconVersion, brandName } = usePublicBranding();
  const adminWordmark = getBrandWordmarkSrc(logos, landingFooterPreset.logoOrder);
  const src =
    adminWordmark || getPublicBrandLogoSrc(landingFooterPreset.logoOrder, iconVersion);

  return (
    <BrandLogoImage
      src={src}
      alt={getBrandLogoAlt(brandName || BRAND_NAME)}
      className="h-10 w-auto max-w-[168px] object-contain object-left"
      width={168}
      height={40}
      loading="lazy"
      fallback={brandTextFallback("font-display text-2xl tracking-wider font-bold")}
    />
  );
}

function Footer() {
  type FooterItem = { label: string; href?: string };
  const cols: Array<{ h: string; items: FooterItem[] }> = [
    {
      h: "Surfaces & Product",
      items: [
        { label: "Operator Console", href: "#product" },
        { label: "Team Owner Phone PWA", href: "#product" },
        { label: "1080p60 LED Wall", href: "#product" },
        { label: "Squad Analytics Hub", href: "#product" },
      ],
    },
    {
      h: "Sports Solutions",
      items: [
        { label: "Cricket Auctions", href: "/cricket-auction-software" },
        { label: "Football Draft", href: "/football-player-auction" },
        { label: "Badminton Draft", href: "/badminton-auction-platform" },
        { label: "Kabaddi Platform", href: "/kabaddi-auction-platform" },
        { label: "Corporate T20", href: "/business-league-auction" },
      ],
    },
    {
      h: "Resources & Media",
      items: [
        { label: "BidWar Academy", href: "/academy" },
        { label: "Blog & Guides", href: "/blog" },
        { label: "Case Studies", href: "#tournaments" },
        { label: "Organizer Reviews", href: "#feedback" },
        { label: "Upcoming Auctions", href: "/upcoming-auctions" },
      ],
    },
    {
      h: "Company & Trust",
      items: [
        { label: "Pricing & Plans", href: "#pricing" },
        { label: "Contact & HQ", href: "/contact" },
        { label: "Auction Tips", href: "/auction-tips" },
        { label: "auth-cta" },
      ],
    },
  ];

  const socialLabels = ["IN", "FB", "YT", "TW"] as const;
  const socialByLabel = Object.fromEntries(SITE_SOCIAL.map((s) => [s.label, s]));
  const placeholderSocial = new Set<string>(SITE_SOCIAL_PLACEHOLDERS);

  return (
    <footer className="border-t border-white/10 bg-black/60 pt-16">
      <div className="mx-auto max-w-7xl px-5 pb-10">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <a href="/" className="flex items-center gap-2" aria-label={`${BRAND_NAME} Home`}>
              <FooterBrandMark />
            </a>
            <p className="mt-4 max-w-sm text-xs sm:text-sm text-muted-foreground leading-relaxed">
              India&rsquo;s auction-first platform for live sports player auctions. Team owners bid in
              virtual points — not money. From local leagues to state championship finals — from auction to champion.
            </p>
            <div className="mt-6 flex gap-2">
              {socialLabels.map((label) => {
                const social = socialByLabel[label];
                if (social) {
                  return (
                    <a
                      key={label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`BidWar on ${social.name}`}
                      className="ghost-button ghost-button-hover flex h-9 w-9 items-center justify-center rounded-md text-[10px] font-bold tracking-widest"
                    >
                      {label}
                    </a>
                  );
                }
                return (
                  <span
                    key={label}
                    title={placeholderSocial.has(label) ? "Coming soon" : undefined}
                    className="ghost-button flex h-9 w-9 cursor-default items-center justify-center rounded-md text-[10px] font-bold tracking-widest opacity-40"
                    aria-disabled="true"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
            <div className="mt-6 space-y-1 text-xs text-muted-foreground">
              <a href={`mailto:${SITE_CONTACT.email}`} className="block hover:text-foreground transition">{SITE_CONTACT.email}</a>
              <a href={waMeUrl()} target="_blank" rel="noopener noreferrer" className="block hover:text-foreground transition">{SITE_CONTACT.phoneDisplay}</a>
              <p>{SITE_CONTACT.addressLine}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {cols.map((c) => (
              <div key={c.h}>
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary font-mono">{c.h}</div>
                <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                  {c.items.map((i) => (
                    <li key={i.label}>
                      {i.label === "auth-cta" ? (
                        <PublicAuthCta variant="footer-link" />
                      ) : i.href ? (
                        <a
                          href={i.href}
                          onClick={(e) => {
                            if (i.href?.startsWith("#")) {
                              scrollToSection(i.href.slice(1), e);
                            }
                          }}
                          className="hover:text-foreground transition"
                        >
                          {i.label}
                        </a>
                      ) : (
                        <span className="cursor-default opacity-60" title="Coming soon">{i.label}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/5">
        <div className="mx-auto max-w-7xl px-5 py-4 text-xs leading-relaxed text-muted-foreground">
          Bidding on BidWar uses a virtual <strong className="text-foreground/80">points purse</strong> only.
          Players are not bought or sold for money through the platform. BidWar provides sports auction software
          and is not responsible for how organizers run tournament fees or internal arrangements outside BidWar.
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-4 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-mono">
          <div>© {new Date().getFullYear()} BidWar Technologies · Made in India · Operated by {SITE_CONTACT.billingEntity}</div>
          <div className="flex gap-4">
            <a href="/legal/privacy" className="hover:text-foreground transition">Privacy Policy</a>
            <a href="/legal/terms" className="hover:text-foreground transition">Terms & Conditions</a>
            <a href="/legal/refund" className="hover:text-foreground transition">Refund Policy</a>
            <a href="/legal" className="hover:text-foreground transition" title={`GSTIN ${SITE_CONTACT.gstin}`}>GST Info</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Geometric Bid-Pulse Network Motif                                  */
/* ------------------------------------------------------------------ */

function BidPulseMotif({ className }: { className?: string }) {
  const nodes = [
    { x: 200, y: 60 }, { x: 320, y: 130 }, { x: 320, y: 270 },
    { x: 200, y: 340 }, { x: 80, y: 270 }, { x: 80, y: 130 },
    { x: 260, y: 200 }, { x: 140, y: 200 },
  ];
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="bp-core2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.90 0.17 88)" stopOpacity="0.45" />
          <stop offset="70%" stopColor="oklch(0.75 0.19 65)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="bp-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.90 0.17 88)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="oklch(0.60 0.15 265)" stopOpacity="0" />
        </linearGradient>
      </defs>

      <circle cx="200" cy="200" r="150" fill="url(#bp-core2)" />

      <g fill="none" stroke="oklch(0.85 0.17 88)" strokeOpacity="0.2">
        {[70, 110, 150, 190].map((r, i) => (
          <polygon
            key={r}
            points={Array.from({ length: 6 }).map((_, k) => {
              const a = (Math.PI / 3) * k - Math.PI / 2;
              return `${200 + Math.cos(a) * r},${200 + Math.sin(a) * r}`;
            }).join(" ")}
            strokeWidth={i === 0 ? 1.2 : 0.8}
            strokeDasharray={i % 2 ? "2 5" : "0"}
            opacity={1 - i * 0.18}
          />
        ))}
      </g>

      <g stroke="url(#bp-line)" strokeWidth="0.7">
        {nodes.map((n, i) =>
          nodes.slice(i + 1).map((m, j) => {
            const d = Math.hypot(n.x - m.x, n.y - m.y);
            if (d > 200) return null;
            return <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} opacity="0.4" />;
          })
        )}
      </g>

      <g fill="none" stroke="oklch(0.85 0.17 88)" strokeWidth="0.6" opacity="0.3">
        <circle cx="200" cy="200" r="50" />
        <circle cx="200" cy="200" r="90" strokeDasharray="1 4" />
      </g>

      <g>
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={i < 6 ? 3 : 2} fill="oklch(0.90 0.17 88)" opacity="0.8" />
            <circle cx={n.x} cy={n.y} r="8" fill="none" stroke="oklch(0.85 0.17 88)" strokeOpacity="0.3" />
          </g>
        ))}
      </g>

      <circle cx="200" cy="200" r="4" fill="oklch(0.90 0.17 88)" />
      <circle cx="200" cy="200" r="12" fill="none" stroke="oklch(0.85 0.17 88)" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
