import { Suspense, lazy, useEffect, useState, useRef, type FormEvent, type MouseEvent } from "react";
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
  ChevronDown,
  ArrowUp,
} from "lucide-react";
import { HomeSchemaMarkup } from "@/components/schema-markup";
import type { PaymentPlan } from "@/components/payment-modal";
import { BrandLogoImage } from "@/components/brand-logo-image";
import { PublicAuthCta } from "@/components/public-auth-cta";
import { ScrollToTopButton, scrollPageToTop, useScrolledPast } from "@/components/scroll-to-top-button";
import { centeredScrollLeft, stickyContentOffsetPx } from "@/lib/home-mobile-chrome";
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
import { VideoModal, type VideoModalProps } from "@/components/home/video-modal";
import { PhotoLightbox, type LightboxItem } from "@/components/home/photo-lightbox";
import { TournamentCalculator } from "@/components/home/tournament-calculator";
import {
  OrganizerVideoReviews,
  type OrganizerReview,
} from "@/components/home/organizer-video-reviews";
import { HeroTournamentShowcase } from "@/components/home/hero-tournament-showcase";
import { OurClientsSection } from "@/components/home/our-clients-section";

import { PricingSection } from "@/components/home/pricing-section";

const PaymentModal = lazy(() =>
  import("@/components/payment-modal").then((m) => ({ default: m.PaymentModal })),
);

const landingHeaderPreset = getBrandSurfacePreset("landing-header");
const landingFooterPreset = getBrandSurfacePreset("landing-footer");
const BRAND_NAME = "BidWar";
const DEMO_WA_MESSAGE =
  "Hi, I want to book a live BidWar demo for my sports auction. Can you help me set up?";

function scrollToSection(sectionId: string, event?: MouseEvent<HTMLAnchorElement>, surfaceIndex?: number) {
  event?.preventDefault();
  const targetId =
    sectionId === "surfaces" || sectionId === "features"
      ? "auction-screens"
      : sectionId === "tournaments" || sectionId === "cases"
        ? "tournament-galleries"
        : sectionId === "clients"
          ? "our-clients"
          : sectionId;
  const el = document.getElementById(targetId) || document.getElementById(sectionId);
  if (el) {
    const yOffset = -95; // Account for sticky header + breathing room
    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
    window.scrollTo({ top: y, behavior: "smooth" });
  }
  if (surfaceIndex !== undefined) {
    window.dispatchEvent(
      new CustomEvent("bidwar:select-surface", { detail: { index: surfaceIndex } })
    );
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
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground break-words leading-tight" title={label}>
        {label}
      </span>
      <span
        className={`font-display font-bold leading-tight text-primary count-flicker break-words ${
          isMini ? "text-lg sm:text-xl" : isCompact ? "text-2xl sm:text-2xl" : "text-2xl sm:text-3xl"
        }`}
        title={value}
      >
        {value}
      </span>
      {sub ? (
        <span className="text-[11px] text-muted-foreground/80 break-words leading-tight" title={sub}>
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
  const showScrollTop = useScrolledPast();
  const stickyCtaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = stickyCtaRef.current;
    const root = bar?.closest(".lovable-home");
    if (!bar || !(root instanceof HTMLElement)) return;

    const apply = () => {
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      const height = desktop ? 0 : bar.getBoundingClientRect().height;
      root.style.setProperty("--bw-sticky-cta-offset", `${stickyContentOffsetPx(height, desktop)}px`);
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(bar);
    const query = window.matchMedia("(min-width: 768px)");
    query.addEventListener("change", apply);
    return () => {
      observer.disconnect();
      query.removeEventListener("change", apply);
      root.style.removeProperty("--bw-sticky-cta-offset");
    };
  }, []);

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
      videoUrl: review.youtubeId
        ? `https://www.youtube.com/watch?v=${review.youtubeId}`
        : `https://www.youtube.com/@bidwarofficial`,
      comingSoon: !review.youtubeId,
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
      <div className="lovable-home has-mobile-sticky-cta min-h-screen min-w-0 max-w-full text-foreground bg-stage">
        <Header
          onOpenDrawer={() => setDrawerOpen(true)}
          goBlog={goBlog}
          goAcademy={goAcademy}
        />
        {drawerOpen && (
          <MobileDrawer
            onClose={() => setDrawerOpen(false)}
            goBlog={goBlog}
            goAcademy={goAcademy}
            goContact={goContact}
          />
        )}

        <main className="min-w-0 max-w-full">
          {/* 1. Hero Section with Live Tournament Showcase */}
          <Hero goSignup={goSignup} onDemo={openDemoWhatsApp} />

          {/* 2. Trust Strip & Live Tournament Ticker */}
          <TrustBadges />
          <Ticker />

          <ProductOfferings />

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

          {/* 10. Contact Desk */}
          <ContactSection onOpen={() => setContactOpen(true)} />

          {/* 11. Our Clients (Brands, Firms, and Auction Organisations) */}
          <OurClientsSection />

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
        <ScrollToTopButton placement="desktop-left" />
        <div
          ref={stickyCtaRef}
          data-home-sticky-cta=""
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-stage/95 px-3 pt-3 backdrop-blur-md md:hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goSignup}
              className="gold-button min-h-11 flex-1 rounded-md px-3 py-3 text-xs font-bold uppercase tracking-wider focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Start Free Trial (2 Teams)
            </button>
            {showScrollTop ? (
              <button
                type="button"
                onClick={scrollPageToTop}
                aria-label="Scroll back to top"
                className="bw-scroll-top flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary/50 bg-black/85 text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                <ArrowUp className="h-5 w-5" aria-hidden="true" />
              </button>
            ) : null}
          </div>
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
    <header className="sticky top-0 z-30 min-w-0 border-b border-white/10 bg-stage/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full min-w-0 max-w-[1440px] items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
        <a href="/" className="flex min-w-0 items-center mr-2 xl:mr-6 2xl:mr-8" aria-label={`${BRAND_NAME} Home`}>
          <BrandMark className="h-9 w-auto max-w-[7.25rem] object-contain object-left sm:h-10 sm:max-w-[168px]" />
        </a>

        <nav className="hidden xl:flex items-center gap-1 xl:gap-2 2xl:gap-3.5 text-[13px] font-medium text-muted-foreground">
          <a
            href="#auction-screens"
            onClick={(e) => scrollToSection("auction-screens", e)}
            className="px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            Auction Screens
          </a>
          <a
            href="#experience-bidding"
            onClick={(e) => scrollToSection("experience-bidding", e)}
            className="px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            Experience Bidding
          </a>
          <a
            href="#tournament-galleries"
            onClick={(e) => scrollToSection("tournament-galleries", e)}
            className="px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            Tournament Galleries
          </a>

          <a
            href="/academy"
            onClick={(e) => {
              e.preventDefault();
              goAcademy();
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            <span>Academy</span>
            <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] text-primary font-bold">
              VIDEOS
            </span>
          </a>

          <a
            href="#pricing"
            onClick={(e) => scrollToSection("pricing", e)}
            className="px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            Pricing
          </a>
          <a
            href="/bpl"
            className="px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
          >
            BPL
          </a>

          {/* More / Solutions Mega Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
              aria-label="Open more navigation links"
            >
              More <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
            </button>
            <div className="invisible absolute right-0 top-full z-40 mt-2 w-[620px] rounded-xl border border-white/10 bg-stage/95 backdrop-blur-xl p-4 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="grid grid-cols-3 gap-4">
                {/* Column 1: By Sport */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">By Sport</div>
                  <div className="space-y-0.5 mt-1">
                    {SOLUTION_SPORT_LINKS.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="block rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Column 2: Platform */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Platform</div>
                  <div className="space-y-0.5 mt-1">
                    {SOLUTION_PLATFORM_LINKS.map((link) => (
                      <a
                        key={link.href}
                        href={link.href}
                        className="block rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>

                {/* Column 3: Resources */}
                <div>
                  <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Resources</div>
                  <div className="space-y-0.5 mt-1">
                    {MORE_NAV_LINKS.map((link) => (
                      <a
                        key={link.label}
                        href={link.href}
                        onClick={(e) => {
                          if ("sectionId" in link && link.sectionId) {
                            scrollToSection(link.sectionId, e);
                          }
                        }}
                        className="block rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                      >
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-xs text-muted-foreground px-1">
                <a
                  href="#solutions"
                  onClick={(e) => scrollToSection("solutions", e)}
                  className="hover:text-primary transition font-medium"
                >
                  View all solutions →
                </a>
                <a href="/contact" className="hover:text-primary transition">
                  Custom tournament setup? Contact us →
                </a>
              </div>
            </div>
          </div>
        </nav>

        <div className="ml-auto flex min-w-0 shrink items-center gap-1.5 sm:gap-2.5 xl:ml-4">
          <PublicAuthCta variant="homepage" />
          <button
            type="button"
            onClick={onOpenDrawer}
            className="ghost-button rounded-md p-2 xl:hidden"
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
    <div className="fixed inset-0 z-50 bg-stage/98 backdrop-blur-lg xl:hidden flex flex-col">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 shrink-0">
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
      <nav className="flex-1 flex flex-col overflow-y-auto p-5 text-base font-display">
        {/* Prominent Auth CTAs at top of mobile menu */}
        <div className="mb-4">
          <PublicAuthCta variant="drawer" onBeforeNavigate={onClose} />
        </div>

        {([
          { label: "BidWar Premier League", href: "/bpl" },
          { label: "Auction Screens", href: "#auction-screens", sectionId: "auction-screens" },
          { label: "Experience Bidding", href: "#experience-bidding", sectionId: "experience-bidding" },
          { label: "Tournament Galleries", href: "#tournament-galleries", sectionId: "tournament-galleries" },
          { label: "Our Clients", href: "#our-clients", sectionId: "our-clients" },
          { label: "Academy (Video Hub)", href: "/academy", action: goAcademy },
          { label: "Pricing", href: "#pricing", sectionId: "pricing" },
          { label: "Blog", href: "/blog", action: goBlog },
          { label: "Organizer Reviews", href: "#reviews", sectionId: "reviews" },
          { label: "Tournament Calculator", href: "#calculator", sectionId: "calculator" },
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
          <div className="border-b border-white/5 pb-3 text-sm font-sans">
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
  goSignup,
  onDemo,
}: {
  goSignup: () => void;
  onDemo: () => void;
}) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <BidPulseMotif className="pointer-events-none absolute -right-20 -top-16 h-[520px] w-[520px] opacity-25" />

      <div className="mx-auto grid min-w-0 max-w-7xl gap-10 px-5 py-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div className="flex min-w-0 flex-col justify-center">
          <div className="mb-5 flex flex-wrap items-center gap-2.5">
            <LiveBadge label="⚡ 2026 SEASON READY" />
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-mono">
              Auctions, scoring, and sponsor screens
            </span>
          </div>

          <h1 className="text-hero font-display tracking-tight">
            <span className="block">From Auction</span>
            <span className="block gold-text">to Champions.</span>
          </h1>
          <p className="text-display-md mt-4 max-w-xl font-display text-foreground">
            One Platform. Every Stage of the Game.
          </p>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            From player auctions to live cricket, box cricket and badminton scoring, BidWar helps tournaments
            run the game and bring sponsors into the experience.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={goSignup}
              className="gold-button gold-button-hover min-h-11 rounded-md px-6 py-3.5 text-xs font-bold uppercase tracking-wider"
            >
              Start Free Trial →
            </button>
            <button
              type="button"
              onClick={onDemo}
              className="ghost-button ghost-button-hover min-h-11 rounded-md px-6 py-3.5 text-xs font-bold uppercase tracking-wider"
            >
              Book Live Demo
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Free 2-Team Trial</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Points-Based Purses</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Any Phone Browser</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Zero Software Install</span>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <StatTile value="Auctions" label="Player draft" sub="Virtual points purse" />
            <StatTile value="Cricket" label="Live scoring" sub="Including box cricket" />
            <StatTile value="Badminton" label="Live scoring" sub="Courts and standings" />
            <StatTile value="Sponsors" label="On screen" sub="LED and overlays" />
          </div>
        </div>

        {/* Seamless Borderless Tournament Slideshow */}
        <div className="relative flex items-center justify-center">
          <HeroTournamentShowcase />
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
    "Cloud-Hosted Rooms",
    "Zero App Install",
    "Virtual Points Purse",
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
    <div className="max-w-full border-b border-white/5 bg-black/60 py-2.5 overflow-hidden">
      <div className="flex max-w-full overflow-hidden">
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
/* Product discovery — auctions, scoring, sponsor screens             */
/* ------------------------------------------------------------------ */

const PRODUCT_OFFERINGS = [
  {
    title: "Player auctions",
    body: "Team owners bid a virtual points purse from any phone. The operator runs the room and the LED.",
    href: "#auction-screens",
    sectionId: "auction-screens",
  },
  {
    title: "Cricket scoring",
    body: "Ball-by-ball cricket scoring, including box-cricket rule profiles, live LED overlays, and a points table.",
    href: "#tournament-galleries",
    sectionId: "tournament-galleries",
  },
  {
    title: "Badminton scoring",
    body: "Live court scoring, standings, and match overlays for badminton tournaments.",
    href: "/badminton-scoring-software",
  },
  {
    title: "Sponsor screens",
    body: "Sponsor logos on the auction LED, the stream overlay, and the cricket and badminton scoreboard rails.",
    href: "#auction-screens",
    sectionId: "auction-screens",
    surfaceIndex: 2,
  },
] as const;

function ProductOfferings() {
  return (
    <section id="offerings" className="mx-auto min-w-0 max-w-7xl px-5 py-14">
      <div className="mb-6 max-w-2xl">
        <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">
          What BidWar runs
        </div>
        <h2 className="text-display-lg mt-2 font-display">Auctions, scoring, and the screens sponsors sit on.</h2>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRODUCT_OFFERINGS.map((item) => (
          <a
            key={item.title}
            href={item.href}
            onClick={(event) => {
              if ("sectionId" in item && item.sectionId) {
                scrollToSection(item.sectionId, event, "surfaceIndex" in item ? item.surfaceIndex : undefined);
              }
            }}
            className="flex min-h-11 min-w-0 flex-col rounded-xl border border-white/10 bg-card/60 p-4 transition hover:border-primary/40"
          >
            <span className="font-display text-lg tracking-wide text-foreground">{item.title}</span>
            <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</span>
          </a>
        ))}
      </div>
    </section>
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
      img: "/assets/evidence/auction-control-live-operator.png",
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
      img: "/assets/evidence/team-bidding-screen.png",
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
      img: "/assets/evidence/live-led-screen.png",
      alt: "BidWar Live LED Stage Screen interface showing tournament status, real-time player card, live bid amount, team purse limits, and sponsor branding",
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
      img: "/assets/evidence/obs-live-overlay.png",
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
      img: "/assets/evidence/live-auction-view.png",
      alt: "BidWar Live Auction Remote Spectator View showing live player card, real-time bid, team purse balances, and cheer button",
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
      img: "/assets/evidence/automated-communications-sms.png",
      alt: "BidWar instant player allotment SMS alert with congratulations message and winning team details",
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
      img: "/assets/evidence/reports-catalogue-dashboard.png",
      alt: "BidWar Report Catalogue dashboard showing Top 5 Sold Players poster showcase, PDF, Excel, and CSV export options",
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

  useEffect(() => {
    const handleSelect = (e: Event) => {
      const custom = e as CustomEvent<{ index?: number }>;
      if (typeof custom.detail?.index === "number" && custom.detail.index >= 0 && custom.detail.index < surfaces.length) {
        setActiveTab(custom.detail.index);
      }
    };
    window.addEventListener("bidwar:select-surface", handleSelect);
    return () => window.removeEventListener("bidwar:select-surface", handleSelect);
  }, [surfaces.length]);

  useEffect(() => {
    const container = tabsScrollRef.current;
    const tab = container?.querySelector<HTMLElement>(`[data-surface-index="${activeTab}"]`);
    if (!container || !tab) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tabLeft =
      tab.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
    container.scrollTo({
      left: centeredScrollLeft(container.clientWidth, tabLeft, tab.offsetWidth),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [activeTab]);

  const scrollTabs = (direction: "left" | "right") => {
    if (tabsScrollRef.current) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const scrollAmount = Math.max(180, tabsScrollRef.current.clientWidth * 0.7);
      tabsScrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: reduce ? "auto" : "smooth",
      });
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
    <section id="auction-screens" data-alias="surfaces" className="mx-auto max-w-7xl px-5 py-16 scroll-mt-24">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">The 7 Connected Auction Screens</div>
          <h2 className="text-display-lg mt-2 max-w-2xl font-display">One Live Auction. Every Screen & Channel in Real Time.</h2>
        </div>
        <p className="max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Auctioneer control, team bidding web app, venue LED, OBS stream overlays, remote live auction viewer, automated communications, and post-auction reports stay perfectly synchronized in sub-50ms.
        </p>
      </div>

      <div className="relative mb-6 flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={() => scrollTabs("left")}
          aria-label="Scroll surfaces left"
          className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-card/70 text-foreground hover:border-primary/50 hover:bg-primary/10 transition shadow-md sm:flex"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div
          ref={tabsScrollRef}
          role="tablist"
          aria-label="Connected auction screens"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
            event.preventDefault();
            const next = event.key === "ArrowRight"
              ? Math.min(surfaces.length - 1, activeTab + 1)
              : Math.max(0, activeTab - 1);
            setActiveTab(next);
          }}
          className="min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-2 snap-x snap-mandatory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <div className="flex w-max gap-2.5">
          {surfaces.map((s, idx) => {
            const Icon = s.icon;
            const selected = activeTab === idx;
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                data-surface-tab=""
                data-surface-index={idx}
                aria-selected={selected}
                onClick={() => setActiveTab(idx)}
                className={`panel flex min-h-11 max-w-[15rem] items-center gap-2.5 px-4 py-2.5 rounded-xl border text-left transition shrink-0 snap-start ${
                  selected
                    ? "border-primary bg-primary/20 text-foreground shadow-lg shadow-primary/10 ring-1 ring-primary/40"
                    : "border-white/10 bg-card/50 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-primary text-primary-foreground" : "bg-white/5 text-primary"}`}>
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0 whitespace-normal">
                  <div className="font-display text-xs font-bold tracking-wide">{s.title}</div>
                  <div className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">{s.tag}</div>
                </div>
              </button>
            );
          })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => scrollTabs("right")}
          aria-label="Scroll surfaces right"
          className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-card/70 text-foreground hover:border-primary/50 hover:bg-primary/10 transition shadow-md sm:flex"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Surface Interactive Display Panel */}
      <div className="panel-rail relative min-w-0 overflow-hidden rounded-2xl border border-primary/30 bg-card/60 p-4 sm:p-6 lg:p-8">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
        <div className="relative mb-5 flex flex-wrap items-center gap-2">
          <span className="rounded bg-primary/20 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
            {current.tag}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">Surface 0{activeTab + 1} of 0{surfaces.length}</span>
          <h3 className="w-full font-display text-2xl font-bold tracking-wide text-foreground lg:text-3xl">
            {current.title}
          </h3>
        </div>
        <div className="grid min-w-0 gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
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
                    className="h-full w-full object-contain object-top"
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
                aria-label={`Open fullscreen view of ${current.title}`}
                className="absolute right-3 bottom-3 flex min-h-11 items-center gap-1.5 rounded-lg bg-black/85 px-3 py-2 font-mono text-xs text-primary border border-primary/30 backdrop-blur-md hover:bg-black hover:border-primary transition shadow-lg z-20"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Fullscreen View
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
                  className="h-full w-full object-contain object-center"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none" />

                <button
                  type="button"
                  onClick={handleInspect}
                  aria-label={`Open fullscreen view of ${current.title}`}
                  className="absolute right-3 bottom-3 flex min-h-11 items-center gap-1.5 rounded-lg bg-black/85 px-3 py-2 font-mono text-xs text-primary border border-primary/30 backdrop-blur-md hover:bg-black hover:border-primary transition shadow-lg"
                >
                  <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" /> Fullscreen View
                </button>
              </div>
            </div>
          )}

          {/* Details & Features List */}
          <div className="min-w-0">
            <p className="text-sm leading-relaxed text-muted-foreground">
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
      image: "/assets/evidence/vnbl-chhavi-gera-bidding.jpg",
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
  const tournamentTabsRef = useRef<HTMLDivElement>(null);
  const t = tournaments[idx];

  useEffect(() => {
    const container = tournamentTabsRef.current;
    const tab = container?.querySelector<HTMLElement>(`[data-tournament-index="${idx}"]`);
    if (!container || !tab) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const tabLeft =
      tab.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
    container.scrollTo({
      left: centeredScrollLeft(container.clientWidth, tabLeft, tab.offsetWidth),
      behavior: reduce ? "auto" : "smooth",
    });
  }, [idx]);

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
    <section id="tournament-galleries" data-alias="tournaments" className="mx-auto max-w-7xl px-5 py-16 scroll-mt-28">
      <div className="mb-10">
        <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">Proven Evidence · Tournament Galleries</div>
        <h2 className="text-display-lg mt-2 max-w-2xl font-display">Real Tournaments. Real Evidence. Zero Bidding Chaos.</h2>
        <p className="mt-3 max-w-2xl text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Live leagues run end-to-end on BidWar — venue LED reveal, team-owner mobile bidding, livestream overlays, and exported squad lists before the crowd leaves.
        </p>
      </div>

      <div className="panel-rail relative min-w-0 overflow-hidden rounded-2xl border border-primary/30 bg-card/60 p-4 sm:p-6 md:p-8">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />

        <div className="relative mb-6 min-w-0">
          <div
            ref={tournamentTabsRef}
            role="tablist"
            aria-label="Tournament evidence"
            className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1"
          >
            {tournaments.map((tour, i) => (
              <button
                key={tour.id}
                type="button"
                role="tab"
                data-tournament-index={i}
                aria-selected={i === idx}
                onClick={() => setIdx(i)}
                className={`min-h-11 shrink-0 snap-start whitespace-nowrap rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  i === idx
                    ? "border-primary bg-primary/20 text-primary shadow-sm"
                    : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
                }`}
              >
                {tour.tabLabel || tour.name}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            {idx + 1} of {tournaments.length}
          </p>
        </div>

        <div className="relative grid min-w-0 gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="max-w-full break-words rounded-full border border-[color:var(--live)]/40 bg-[color:var(--live)]/10 px-3 py-1 text-[10px] font-bold tracking-[0.12em] text-[color:var(--live)] sm:tracking-[0.2em]">
                <span className="live-dot mr-1.5 align-middle" />{t.seasonTag}
              </span>
              <span className="max-w-full break-words rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono sm:tracking-[0.2em]">
                {t.sportTag}
              </span>
              <span className="max-w-full break-words rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-mono sm:tracking-[0.2em]">
                {t.location}
              </span>
            </div>
            <h3 className="text-display-md mt-4 max-w-full break-words font-display font-bold tracking-wide text-foreground">{t.name}</h3>
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
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-[image:var(--gradient-gold)] text-lg text-[color:var(--primary-foreground)] shadow-[var(--shadow-broadcast)]"
                  aria-label="Play highlight video"
                >
                  ▶
                </button>
              </div>

              <div className="absolute bottom-2.5 left-3 right-3 flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-[0.16em] text-white/90 font-mono">
                <span className="min-w-0 break-words">{t.reelLabel}</span>
                <button
                  type="button"
                  onClick={handleInspectPhoto}
                  className="inline-flex min-h-11 items-center gap-1 text-primary hover:underline"
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
                    className="inline-flex min-h-11 items-center gap-1 px-1 text-primary text-xs font-bold uppercase tracking-wider hover:underline"
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
/* Footer                                                             */
/* ------------------------------------------------------------------ */

function SocialMark({ label }: { label: "IN" | "FB" | "YT" | "TW" }) {
  const className = "h-[18px] w-[18px]";
  if (label === "IN") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
      </svg>
    );
  }
  if (label === "FB") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M14.2 8.4V6.9c0-.7.4-1 1.1-1H17V3.2h-2.2C12.1 3.2 11 4.5 11 6.7v1.7H9v2.6h2V21h3.2v-9.9h2.2l.4-2.7h-2.6z" />
      </svg>
    );
  }
  if (label === "YT") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
        <path fill="currentColor" d="M22.5 7.2a2.8 2.8 0 0 0-2-2C18.8 4.8 12 4.8 12 4.8s-6.8 0-8.5.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 1.1 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.7.4 8.5.4 8.5.4s6.8 0 8.5-.4a2.8 2.8 0 0 0 2-2 29 29 0 0 0 .4-4.8 29 29 0 0 0-.4-4.8zM9.8 15.5v-7l6.2 3.5-6.2 3.5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M14.7 10.3 22.2 2h-1.8l-6.5 7L8.5 2H2.2l8 10.8L2.2 22h1.8l7-7.6L15.4 22h6.3l-8.3-11.2.1-.5zm-2.5 2.7-.8-1.1L4.7 3.3h2.7l5.1 6.8.8 1.1 6.7 8.9h-2.7l-5.1-6.8-.1-.3z" />
    </svg>
  );
}

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
  type FooterItem = { label: string; href?: string; surfaceIndex?: number };
  const cols: Array<{ h: string; items: FooterItem[] }> = [
    {
      h: "Auction Screens & Platform",
      items: [
        { label: "Auction Control", href: "#auction-screens", surfaceIndex: 0 },
        { label: "Team Bidding Screen (Web App)", href: "#auction-screens", surfaceIndex: 1 },
        { label: "Live LED Screen", href: "#auction-screens", surfaceIndex: 2 },
        { label: "OBS Overlay (For Live Streaming)", href: "#auction-screens", surfaceIndex: 3 },
        { label: "Live Auction View", href: "#auction-screens", surfaceIndex: 4 },
        { label: "Communications", href: "#auction-screens", surfaceIndex: 5 },
        { label: "Reports", href: "#auction-screens", surfaceIndex: 6 },
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
        { label: "Our Clients", href: "#our-clients" },
        { label: "Tournament Galleries", href: "#tournament-galleries" },
        { label: "Organizer Reviews", href: "#reviews" },
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
              India&rsquo;s platform for player auctions, live scoring, and sponsor screens. Team owners bid in
              virtual points — not money. From local leagues to state championship finals — from auction to champions.
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
                      className="ghost-button ghost-button-hover flex h-9 w-9 items-center justify-center rounded-md"
                    >
                      <SocialMark label={label} />
                    </a>
                  );
                }
                return (
                  <span
                    key={label}
                    title={placeholderSocial.has(label) ? "Coming soon" : undefined}
                    className="ghost-button flex h-9 w-9 cursor-default items-center justify-center rounded-md opacity-40"
                    aria-disabled="true"
                    aria-label={label === "TW" ? "X, coming soon" : undefined}
                  >
                    <SocialMark label={label} />
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
                <div className="mb-3 break-words text-[10px] font-semibold uppercase leading-snug tracking-[0.14em] text-primary font-mono sm:tracking-[0.24em]">{c.h}</div>
                <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground break-words">
                  {c.items.map((i) => (
                    <li key={i.label}>
                      {i.label === "auth-cta" ? (
                        <PublicAuthCta variant="footer-link" />
                      ) : i.href ? (
                        <a
                          href={i.href}
                          onClick={(e) => {
                            if (i.href?.startsWith("#")) {
                              scrollToSection(i.href.slice(1), e, i.surfaceIndex);
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
