import { Suspense, lazy, useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { HomeSchemaMarkup } from "@/components/schema-markup";
import type { PaymentPlan } from "@/components/payment-modal";
import { BrandLogoImage } from "@/components/brand-logo-image";
import { getBrandLogoAlt, getBrandWordmarkSrc, getPublicBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import {
  deriveCategoriesFromLessons,
  fetchAcademyIndex,
  fetchAcademyLessons,
  formatDuration,
  type PublicAcademyLessonSummary,
} from "@/lib/academy-public";
import {
  HOME_SPORT_SOLUTION_HREFS,
  MORE_NAV_LINKS,
  SITE_CONTACT,
  SITE_SOCIAL,
  SITE_SOCIAL_PLACEHOLDERS,
  SOLUTION_PLATFORM_LINKS,
  SOLUTION_SPORT_LINKS,
  waMeUrl,
} from "@/lib/public-site-links";

const PaymentModal = lazy(() =>
  import("@/components/payment-modal").then((m) => ({ default: m.PaymentModal })),
);
const PricingSection = lazy(() =>
  import("@/components/home/pricing-section").then((m) => ({ default: m.PricingSection })),
);

const landingHeaderPreset = getBrandSurfacePreset("landing-header");
const landingFooterPreset = getBrandSurfacePreset("landing-footer");
const BRAND_NAME = "BidWar";
const DEMO_WA_MESSAGE =
  "Hi, I want to book a live BidWar demo for my sports auction. Can you help me set up?";

function scrollToSection(sectionId: string, event?: MouseEvent<HTMLAnchorElement>) {
  event?.preventDefault();
  document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
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
      fallback={brandTextFallback("font-display text-xl tracking-wider")}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Small building blocks                                              */
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
  return (
    <div className="scoreboard-tile flex flex-col gap-1 px-5 py-4">
      <span className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{label}</span>
      <span className="font-display text-4xl leading-none text-primary count-flicker">{value}</span>
      {sub && <span className="text-[11px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Signature: Live Auction Card (reused across the page)              */
/* ------------------------------------------------------------------ */

/** Demo bid amounts are virtual auction points — never rupees. */
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
  compact = false,
  purseLeft = "1.62 Cr Pts",
}: {
  player?: string;
  role?: string;
  base?: number;
  target?: number;
  team?: string;
  sold?: boolean;
  animate?: boolean;
  compact?: boolean;
  purseLeft?: string;
}) {
  const [bid, setBid] = useState(animate ? base : target);
  const [showStamp, setShowStamp] = useState(!animate && sold);

  useEffect(() => {
    if (!animate) return;
    const prefersReduced = typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) { setBid(target); if (sold) setShowStamp(true); return; }

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
    <div className={`panel-rail relative overflow-hidden ${compact ? "p-4" : "p-5"}`}>
      {/* Broadcast lower-third top strip */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <LiveBadge label={sold ? "SOLD" : "ON BLOCK"} />
          <span className="font-mono text-[10px] tracking-widest text-muted-foreground">LOT · 047</span>
        </div>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground">POINTS · NOT MONEY</span>
      </div>

      {/* Player + role */}
      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <div className="font-display text-2xl leading-none text-foreground">{player}</div>
          <div className="mt-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{role}</div>
        </div>
        <div className="scoreboard-tile flex h-14 w-14 items-center justify-center">
          <span className="font-display text-2xl text-primary">#47</span>
        </div>
      </div>

      {/* Bid ticker */}
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="scoreboard-tile px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Base Points</div>
          <div className="font-mono text-lg text-foreground">{formatPtsShort(base)}</div>
        </div>
        <div className="scoreboard-tile px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[color:var(--ember)]">Current Bid</div>
            <span className="text-[10px] font-mono text-[color:var(--ember)]">▲</span>
          </div>
          <div className="font-mono text-lg text-[color:var(--ember)] count-flicker">{formatPtsShort(bid)}</div>
        </div>
      </div>

      {/* Team + purse */}
      <div className="mt-4 flex items-center justify-between rounded-md bg-black/25 px-3 py-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Leading Bidder</div>
          <div className="font-display text-sm text-primary">{team}</div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Purse Left</div>
          <div className="font-mono text-sm text-foreground">{purseLeft}</div>
        </div>
      </div>

      {/* Scan-line texture */}
      <div className="pointer-events-none absolute inset-0 scan-lines opacity-40" />

      {/* SOLD stamp overlay */}
      {showStamp && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="sold-stamp stamp-in font-display text-5xl">SOLD</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

function Home() {
  const [, navigate] = useLocation();
  const goOrganizer = () => navigate("/organizer");
  const goSignup = () => navigate("/organizer?tab=signup");
  const goBlog = () => navigate("/blog");
  const goAcademy = () => navigate("/academy");
  const goContact = () => navigate("/contact");
  const openDemoWhatsApp = () => {
    window.open(waMeUrl(DEMO_WA_MESSAGE), "_blank", "noopener,noreferrer");
  };
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <HomeSchemaMarkup />
      <div className="lovable-home min-h-screen text-foreground">
      <Header
        onOpenDrawer={() => setDrawerOpen(true)}
        goOrganizer={goOrganizer}
        goSignup={goSignup}
        goBlog={goBlog}
        goAcademy={goAcademy}
      />
      {drawerOpen && (
        <MobileDrawer
          onClose={() => setDrawerOpen(false)}
          goOrganizer={goOrganizer}
          goSignup={goSignup}
          goBlog={goBlog}
          goAcademy={goAcademy}
          goContact={goContact}
        />
      )}

      <main>
        <Hero onContact={openDemoWhatsApp} goSignup={goSignup} />
        <TrustBadges />
        <Ticker />
        <TrustStrip />
        <WhyChoose />
        <UseCases />
        <Features />
        <ProductShowcase />
        <HowItWorks />
        <BroadcastEcosystem />
        <RealTournaments />
        <LiveShowcase goSignup={goSignup} />
        <Testimonials />
        <SuccessMetrics />
        <AcademyPromo />
        <Pricing goSignup={goSignup} />
        <FAQ />
        <FinalCTA onContact={openDemoWhatsApp} goSignup={goSignup} />
        <ContactSection onOpen={() => setContactOpen(true)} />
        <Footer />
      </main>

      {/* Sticky CTA (desktop + mobile) */}
      <button
        type="button"
        onClick={openDemoWhatsApp}
        className="gold-button gold-button-hover fixed bottom-5 right-5 z-40 hidden rounded-full px-6 py-3 text-sm shadow-2xl md:inline-flex"
        aria-label="Get a demo"
      >
        Book Live Demo →
      </button>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-stage/95 p-3 backdrop-blur md:hidden">
        <button
          type="button"
          onClick={goSignup}
          className="gold-button w-full rounded-md py-3 text-sm"
        >
          Start Free Trial
        </button>
      </div>

      {contactOpen && <ContactDrawer onClose={() => setContactOpen(false)} />}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Header                                                              */
/* ------------------------------------------------------------------ */

function Header({ onOpenDrawer, goOrganizer, goSignup, goBlog, goAcademy }: {
  onOpenDrawer: () => void;
  goOrganizer: () => void;
  goSignup: () => void;
  goBlog: () => void;
  goAcademy: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-stage/85 backdrop-blur-md">
      {/* BidWar signal motif — concentric bid pulse */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden">
        <BidPulseMotif className="absolute -right-16 -top-10 h-40 w-40 opacity-60" />
        <BidPulseMotif className="absolute -left-16 -top-10 h-40 w-40 -scale-x-100 opacity-40" />
      </div>

      <div className="relative mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <a href="/" className="flex items-center gap-2" aria-label={`${BRAND_NAME} Home`}>
          <BrandMark />
        </a>

        <nav className="hidden items-center gap-7 text-sm text-muted-foreground lg:flex">
          <a href="#features" onClick={(e) => scrollToSection("features", e)} className="hover:text-foreground">Features</a>
          <div className="relative group">
            <a
              href="#solutions"
              onClick={(e) => scrollToSection("solutions", e)}
              className="inline-flex items-center gap-1 hover:text-foreground"
              aria-haspopup="true"
            >
              Solutions ▾
            </a>
            <div className="invisible absolute left-1/2 top-full z-40 mt-2 w-[520px] -translate-x-1/2 translate-y-2 rounded-md border border-white/10 bg-stage p-3 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">By Sport</div>
                  <div className="space-y-0.5">
                    {SOLUTION_SPORT_LINKS.map((link) => (
                      <a key={link.href} href={link.href} className="block rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground">
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">Platform</div>
                  <div className="space-y-0.5">
                    {SOLUTION_PLATFORM_LINKS.map((link) => (
                      <a key={link.href} href={link.href} className="block rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground">
                        {link.label}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-2 border-t border-white/10 pt-2">
                <a href="#solutions" onClick={(e) => scrollToSection("solutions", e)} className="block rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground">
                  View all solutions →
                </a>
              </div>
            </div>
          </div>
          <a href="#pricing" onClick={(e) => scrollToSection("pricing", e)} className="hover:text-foreground">Pricing</a>
          <a href="/academy" onClick={(e) => { e.preventDefault(); goAcademy(); }} className="hover:text-foreground">Academy</a>
          <a href="/blog" onClick={(e) => { e.preventDefault(); goBlog(); }} className="hover:text-foreground">Blog</a>
          <div className="relative group">
            <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" aria-haspopup="true" aria-label="Open more navigation links">
              More ▾
            </button>
            <div className="invisible absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 translate-y-2 rounded-md border border-white/10 bg-stage p-2 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
              {MORE_NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={(e) => {
                    if ("sectionId" in link && link.sectionId) {
                      scrollToSection(link.sectionId, e);
                    }
                  }}
                  className="block rounded-md px-2 py-2 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <button type="button" onClick={goOrganizer} className="ghost-button ghost-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Sign in</button>
          <button type="button" onClick={goSignup} className="gold-button gold-button-hover hidden rounded-md px-4 py-2 text-xs md:inline-block">Get Started</button>
          <button type="button" onClick={onOpenDrawer} className="ghost-button rounded-md p-2 lg:hidden" aria-label="Open menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/></svg>
          </button>
        </div>
      </div>
    </header>
  );
}


function MobileDrawer({ onClose, goOrganizer, goSignup, goBlog, goAcademy, goContact }: {
  onClose: () => void;
  goOrganizer: () => void;
  goSignup: () => void;
  goBlog: () => void;
  goAcademy: () => void;
  goContact: () => void;
}) {
  const [solutionsOpen, setSolutionsOpen] = useState(false);
  return (
    <div className="fixed inset-0 z-50 bg-stage/98 backdrop-blur-lg lg:hidden">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <span className="font-display text-xl">MENU</span>
        <button type="button" onClick={onClose} className="ghost-button rounded-md px-3 py-2 text-xs" aria-label="Close menu">Close ✕</button>
      </div>
      <nav className="flex flex-col overflow-y-auto p-5 text-xl font-display">
        {([
          { label: "Features", href: "#features", sectionId: "features" },
          { label: "Pricing", href: "#pricing", sectionId: "pricing" },
          { label: "Academy", href: "/academy", action: goAcademy },
          { label: "Blog", href: "/blog", action: goBlog },
          { label: "Upcoming Auctions", href: "/upcoming-auctions" },
          { label: "Contact Us", href: "/contact", action: goContact },
          { label: "Auction Tips", href: "/auction-tips" },
          { label: "FAQ", href: "#faq", sectionId: "faq" },
          { label: "Sign in", href: "/organizer", action: goOrganizer },
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
            className="border-b border-white/5 py-4 tracking-wider hover:text-primary"
          >
            {item.label}
          </a>
        ))}
        <button
          type="button"
          onClick={() => setSolutionsOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b border-white/5 py-4 text-left tracking-wider hover:text-primary"
          aria-expanded={solutionsOpen}
        >
          Solutions
          <span className="text-sm text-muted-foreground">{solutionsOpen ? "▴" : "▾"}</span>
        </button>
        {solutionsOpen ? (
          <div className="border-b border-white/5 pb-4 text-base">
            {[...SOLUTION_SPORT_LINKS, ...SOLUTION_PLATFORM_LINKS].map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="block py-2 text-muted-foreground hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}
        <button type="button" onClick={() => { goSignup(); onClose(); }} className="gold-button mt-6 rounded-md py-4 text-center text-base">Get Started Free</button>
      </nav>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero({ onContact, goSignup }: { onContact: () => void; goSignup: () => void }) {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" />
      <BidPulseMotif className="pointer-events-none absolute -right-20 -top-16 h-[560px] w-[560px] opacity-30" />
      <BidPulseMotif className="pointer-events-none absolute -left-40 top-40 h-[380px] w-[380px] opacity-15" />

      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div className="flex flex-col justify-center">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <LiveBadge label="LIVE · SEASON 3 OPEN" />
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Made in India · Broadcast Grade
            </span>
          </div>

          <h1 className="text-hero font-display">
            <span className="block">From Auction</span>
            <span className="block gold-text">to Champion.</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
            BidWar is India's <strong className="text-foreground">auction-first</strong> platform for
            live sports player auctions — IPL-style bidding rooms for cricket, football, kabaddi,
            badminton, basketball, volleyball, esports and corporate leagues. Team owners bid in{" "}
            <strong className="text-foreground">points</strong> from their phones. Your LED goes
            broadcast-grade. Your operator stays in control.
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground/90">
            Players are allotted against a virtual points purse — not sold for money on BidWar.
            How organizers run fees or settlements outside the platform is entirely their responsibility.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={goSignup} className="gold-button gold-button-hover rounded-md px-6 py-3 text-sm">Start Free Trial →</button>
            <button type="button" onClick={onContact} className="ghost-button ghost-button-hover rounded-md px-6 py-3 text-sm">▶ Ping for Live Demo</button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            <span>✓ Free trial</span>
            <span>✓ Points-based bidding</span>
            <span>✓ Any device</span>
            <span>✓ Zero installs</span>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile value="1,240+" label="Auctions" sub="run on BidWar" />
            <StatTile value="86K" label="Players" sub="allotted live" />
            <StatTile value="47" label="Cities" sub="across India" />
            <StatTile value="Pts" label="Bidding Unit" sub="not money" />
          </div>
        </div>

        {/* Signature: Auction card stack */}
        <div className="relative">
          <div className="relative mx-auto max-w-md">
            <div className="absolute -inset-6 -z-10 rounded-2xl bg-[image:var(--gradient-gold)] opacity-15 blur-3xl" />
            <div className="mb-4 flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              <span>Control Room · Feed 01</span>
              <span className="font-mono">14:22:07 IST</span>
            </div>
            <AuctionCard />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="panel p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Next Lot</div>
                <div className="font-display text-lg">A. Sequeira</div>
                <div className="text-[11px] text-muted-foreground">Fast Bowler · Base 40k Pts</div>
              </div>
              <div className="panel p-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Queue</div>
                <div className="font-display text-lg text-primary">12 <span className="text-muted-foreground text-xs">players</span></div>
                <div className="text-[11px] text-muted-foreground">Pool: All-Rounder A</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ticker                                                              */
/* ------------------------------------------------------------------ */

function Ticker() {
  const items = [
    "MUMBAI TITANS bid 3.40L Pts for R. Kamble",
    "SOLD · A. Sequeira → PUNE PANTHERS · 1.15L Pts",
    "Delhi Corporate League · Season 4 opens Nov 22",
    "UNSOLD · Round 2 recycles at base 25k Pts",
    "Kabaddi Kings XI activates purse 8.00L Pts",
    "LED FEED live · Rink Side · 1080p60",
  ];
  const track = [...items, ...items];
  return (
    <div className="border-y border-white/5 bg-black/30 py-3">
      <div className="flex overflow-hidden">
        <div className="ticker-track flex shrink-0 gap-10 whitespace-nowrap pr-10 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {track.map((t, i) => (
            <span key={i} className="flex items-center gap-3">
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
/* Trust strip                                                         */
/* ------------------------------------------------------------------ */

function TrustStrip() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-primary">The Scoreboard</div>
          <h2 className="text-display-md mt-2">Numbers from the field.</h2>
        </div>
        <div className="hidden max-w-md text-sm text-muted-foreground md:block">
          Verified across cricket, football and corporate leagues since 2022. Auctions run on points purses — not player cash sales.
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile value="1,240+" label="Auctions Completed" />
        <StatTile value="86,400" label="Players Allotted" />
        <StatTile value="47" label="Cities Served" />
        <StatTile value="Points" label="Bidding Unit" />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Why choose                                                          */
/* ------------------------------------------------------------------ */

function WhyChoose() {
  const items = [
    { t: "Save 40+ hours per auction", d: "Registrations, categories, points purses and bidding all in one control room. No spreadsheets, no chaos." },
    { t: "Run the night live — smoothly", d: "Real-time sync between operator, team-owner phones and the LED. No refresh, no lag, no awkward pauses." },
    { t: "Look broadcast-professional", d: "Lower-thirds, SOLD stamps, points purse counters, sponsor slots. Your auction night looks like it belongs on TV." },
    { t: "Team owners bid from their seats", d: "Mobile bidding panel with categories, points-purse guard and instant confirmation. No shouting across the room." },
    { t: "Sponsor visibility built in", d: "Rotating sponsor bands on LED, overlay lower-thirds, digital hoardings — turn eyeballs into deals." },
    { t: "One license, one tournament", d: "Buy the software license per event, not per month. No auto-renewals. Predictable cost for organizers." },
  ];
  return (
    <section id="why" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Why Organizers Choose BidWar</div>
        <h2 className="text-display-lg mt-2 max-w-3xl">Built by auction operators. For auction nights that can't afford a hiccup.</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {items.map((i, idx) => (
          <div key={i.t} className="panel group relative p-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Benefit · 0{idx + 1}</span>
              <span className="h-1.5 w-8 rounded-full bg-[image:var(--gradient-gold)] opacity-70 transition group-hover:opacity-100" />
            </div>
            <h3 className="font-display text-xl leading-none text-foreground">{i.t}</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{i.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Use cases                                                           */
/* ------------------------------------------------------------------ */

function UseCases() {
  const sports = [
    { k: "Cricket", d: "IPL-style franchise auctions · retention · RTM · categories A/B/C" },
    { k: "Football", d: "Player draft & bid rooms · positional points purses · academy scouts" },
    { k: "Kabaddi", d: "Raider/defender pools · league-format auctions" },
    { k: "Badminton", d: "Singles / doubles franchise draft with seed pools" },
    { k: "Basketball", d: "5v5 franchise leagues · position-based points purse" },
    { k: "Volleyball", d: "Beach & indoor leagues · rotating captaincy draft" },
    { k: "Esports", d: "Team draft · sub roster · roles bidding" },
    { k: "Corporate Leagues", d: "Departmental teams · office IPL · CSR events" },
  ];
  const modes = [
    { k: "Broadcast / LED", d: "Full-screen lower-thirds, SOLD/UNSOLD stamps, sponsor bands, live points purse — engineered for 1080p60 LED walls." },
    { k: "Team-Owner Panel", d: "Owners bid points from any phone. Purse guard, category tracker, instant confirmation." },
    { k: "Operator Control Room", d: "Queue, pool, retention, RTM, sold list, undo — one auctioneer, zero panic." },
  ];

  return (
    <section id="solutions" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Solutions</div>
        <h2 className="text-display-lg mt-2 max-w-3xl">Every league. Every format. One auction stage.</h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {sports.map((s) => (
          <a key={s.k} href={HOME_SPORT_SOLUTION_HREFS[s.k] ?? "#pricing"} className="panel group relative overflow-hidden p-5 transition hover:-translate-y-0.5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg tracking-wider">{s.k}</span>
              <span className="rounded-sm bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted-foreground">SPORT</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{s.d}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary opacity-0 transition group-hover:opacity-100">
              Configure →
            </span>
          </a>
        ))}
      </div>

      <div className="mt-10 grid gap-3 lg:grid-cols-3">
        {modes.map((m) => (
          <div key={m.k} className="panel-rail relative overflow-hidden p-6">
            <div className="pointer-events-none absolute inset-0 scan-lines opacity-30" />
            <div className="relative">
              <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[color:var(--ember)]">Mode</div>
              <h3 className="font-display text-2xl mt-1">{m.k}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{m.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

function Features() {
  const feats = [
    ["Real-Time Bidding Engine", "Sub-second sync across operator, owners and LED. No refresh."],
    ["Mobile Team-Owner Panel", "Bid points from any phone. Purse guard, category tracker, instant confirm."],
    ["LED / Big-Screen Mode", "1080p60 broadcast overlay with lower-thirds, SOLD stamps, points purse tickers."],
    ["Broadcast Overlay", "OBS-ready graphics for streaming, sponsor slots and lower-thirds."],
    ["Category & Points Purse", "Pools A/B/C, min/max bid points, retentions, RTM — all built in."],
    ["QR Player Registration", "Players scan, register and upload — organizers approve. Done."],
    ["Auction Analytics", "Per-team points spend, per-category spend, sold/unsold splits, export CSV."],
    ["License Management", "One tournament = one software license. Transparent. No monthly surprises."],
    ["Sponsor Branding", "Rotating hoardings, LED bands, overlay logos — monetize the room."],
    ["Multi-Device Sync", "Operator laptop + owner phones + LED wall — one live feed."],
    ["Zero Install", "Runs in a browser. Any OS. Any device. Ready in five minutes."],
    ["Cloud-Native & Secure", "Hosted in India · encrypted · role-based access · full audit log."],
  ];
  return (
    <section id="features" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Feature Deck</div>
          <h2 className="text-display-lg mt-2 max-w-2xl">Everything the auction night needs. Nothing it doesn't.</h2>
        </div>
        <div className="max-w-md text-sm text-muted-foreground">
          A feature list that reads like a broadcast rundown, not a spec sheet.
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {feats.map(([t, d], i) => (
          <div key={t} className="panel flex items-start gap-4 p-5">
            <div className="scoreboard-tile flex h-10 w-10 shrink-0 items-center justify-center">
              <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
            </div>
            <div>
              <h3 className="font-display text-base leading-none">{t}</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

function HowItWorks() {
  const steps = [
    { n: "01", t: "Set up your tournament", d: "Add teams, points purse limits, categories and player pools. Import a CSV or use QR registration." },
    { n: "02", t: "Invite team owners", d: "Owners join with a link on their phone. Points-purse guard and category tracker load automatically." },
    { n: "03", t: "Go live on auction night", d: "Operator runs the room. LED goes broadcast. Owners bid points from their seats. You just call the room." },
    { n: "04", t: "Export teams & analytics", d: "Final squads, per-category points spend, sponsor reports — one click, ready for print or share." },
  ];
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Rundown</div>
        <h2 className="text-display-lg mt-2 max-w-2xl">From setup to squad — four steps, one night.</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((s) => (
          <div key={s.n} className="panel-rail relative overflow-hidden p-6">
            <span className="pointer-events-none absolute -right-4 -top-6 font-display text-[6.5rem] leading-none text-white/[0.04]">{s.n}</span>
            <div className="relative">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">Step {s.n}</div>
              <h3 className="mt-2 font-display text-xl">{s.t}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{s.d}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Live showcase                                                       */
/* ------------------------------------------------------------------ */

function LiveShowcase({ goSignup }: { goSignup: () => void }) {
  const cards: Array<React.ComponentProps<typeof AuctionCard> & { city: string; sport: string; date: string; teams: number; purse: string; status: "LIVE" | "UPCOMING" | "COMPLETED" }> = [
    { city: "Mumbai", sport: "Cricket · T10", date: "Nov 22", teams: 8, purse: "40L Pts", status: "LIVE", player: "R. KAMBLE", role: "All-Rounder", base: 50, target: 340, team: "MUMBAI TITANS", sold: false },
    { city: "Pune", sport: "Football · 5-a-side", date: "Nov 25", teams: 6, purse: "22L Pts", status: "UPCOMING", player: "A. SEQUEIRA", role: "Striker · Left Foot", base: 30, target: 210, team: "PUNE PHOENIX", sold: false, animate: false },
    { city: "Bengaluru", sport: "Kabaddi", date: "Nov 18", teams: 10, purse: "55L Pts", status: "COMPLETED", player: "V. TAMBE", role: "Raider · Captain", base: 40, target: 480, team: "KING COBRAS", sold: true, animate: false },
    { city: "Delhi", sport: "Corporate T20", date: "Nov 30", teams: 12, purse: "28L Pts", status: "UPCOMING", player: "S. MEHTA", role: "Wicket-Keeper Batsman", base: 25, target: 175, team: "CAPITAL ACES", sold: false, animate: false },
  ];
  const statusColor = (s: string) =>
    s === "LIVE" ? "border-[color:var(--live)]/50 bg-[color:var(--live)]/10 text-[color:var(--live)]" :
    s === "COMPLETED" ? "border-[color:var(--sold)]/50 bg-[color:var(--sold)]/10 text-[color:var(--sold)]" :
    "border-primary/40 bg-primary/10 text-primary";

  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Live Showcase</div>
          <h2 className="text-display-lg mt-2 max-w-2xl">Tonight's auctions. And this week's.</h2>
        </div>
        <button type="button" onClick={goSignup} className="ghost-button ghost-button-hover rounded-md px-4 py-2 text-xs">Host Yours →</button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
        {cards.map((c, i) => (
          <div key={i} className="grid gap-4 md:grid-cols-[1fr_1fr]">
            <div className="panel p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{c.city} · {c.date}</div>
                  <div className="mt-1 font-display text-xl">{c.sport}</div>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-[0.2em] ${statusColor(c.status)}`}>
                  {c.status === "LIVE" && <span className="live-dot mr-2 align-middle" />}{c.status}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                <div className="scoreboard-tile px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Teams</div>
                  <div className="font-mono text-lg text-foreground">{c.teams}</div>
                </div>
                <div className="scoreboard-tile px-3 py-2">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Points Purse</div>
                  <div className="font-mono text-lg text-primary">{c.purse}</div>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                <span className="h-px flex-1 bg-white/10" /> Feed 01 <span className="h-px flex-1 bg-white/10" />
              </div>
            </div>
            <AuctionCard {...c} compact />
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Academy promo — real lessons from /api/academy                      */
/* ------------------------------------------------------------------ */

function academyLessonThumb(lesson: PublicAcademyLessonSummary): string | null {
  if (lesson.thumbnailUrl) return lesson.thumbnailUrl;
  if (lesson.youtubeVideoId) {
    return `https://img.youtube.com/vi/${lesson.youtubeVideoId}/mqdefault.jpg`;
  }
  return null;
}

function AcademyPromo() {
  const [, navigate] = useLocation();
  const [lessons, setLessons] = useState<PublicAcademyLessonSummary[]>([]);
  const [previewLessons, setPreviewLessons] = useState<PublicAcademyLessonSummary[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const index = await fetchAcademyIndex();
      if (cancelled) return;
      let all = index?.lessons ?? [];
      if (all.length === 0) {
        all = await fetchAcademyLessons();
      }
      if (cancelled) return;
      const previewSource =
        index?.latestLessons?.length
          ? index.latestLessons
          : index?.featuredLessons?.length
            ? index.featuredLessons
            : all;
      setLessons(all);
      setPreviewLessons(previewSource.slice(0, 4));
      const cats = (index?.categories ?? deriveCategoriesFromLessons(all))
        .map((c) => c.name)
        .filter(Boolean);
      setCategories(cats);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const videoLabel =
    lessons.length === 0
      ? "Tutorials coming soon"
      : lessons.length === 1
        ? "Tutorial Library · 1 video"
        : `Tutorial Library · ${lessons.length} videos`;

  return (
    <section id="academy" className="mx-auto max-w-7xl px-5 py-16">
      <div className="panel-rail relative overflow-hidden p-8 md:p-12">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-30" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[image:var(--gradient-gold)] opacity-15 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-primary">BidWar Academy</div>
            <h2 className="text-display-lg mt-2">Never run an auction before? We've got the tape.</h2>
            <p className="mt-4 max-w-xl text-sm text-muted-foreground md:text-base">
              Step-by-step video tutorials for organizers, operators and team owners — how to set
              purses, run RTM, handle unsold rounds, wire your LED, and go live on stream without
              breaking a sweat.
            </p>
            {categories.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {categories.slice(0, 5).map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => navigate("/academy")}
              className="gold-button gold-button-hover mt-8 inline-block rounded-md px-5 py-3 text-xs"
            >
              Enter the Academy →
            </button>
          </div>
          <div className="panel relative overflow-hidden p-4">
            {loading ? (
              <div className="grid grid-cols-2 gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="scoreboard-tile aspect-video animate-pulse bg-white/[0.04]" />
                ))}
              </div>
            ) : previewLessons.length === 0 ? (
              <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-md border border-dashed border-white/10 bg-white/[0.02] px-4 text-center">
                <p className="font-display text-sm text-foreground">New tutorials are on the way</p>
                <p className="text-xs text-muted-foreground">Check BidWar Academy for the latest published episodes.</p>
              </div>
            ) : (
              <div className={`grid gap-2 ${previewLessons.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {previewLessons.map((lesson) => {
                  const thumb = academyLessonThumb(lesson);
                  return (
                    <button
                      key={lesson.id}
                      type="button"
                      onClick={() => navigate(`/academy/${lesson.slug}`)}
                      className="scoreboard-tile group relative aspect-video overflow-hidden text-left"
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={lesson.title}
                          className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105"
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,oklch(0.42_0.15_265/0.7),transparent_60%)]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                      <div className="absolute left-2 top-2 rounded-sm bg-black/50 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                        {lesson.categoryName ?? `Ep ${lesson.episodeNumber}`}
                      </div>
                      <div className="absolute right-2 top-2 rounded-sm bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-foreground">
                        {formatDuration(lesson.durationMinutes)}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-90 transition group-hover:opacity-100">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[image:var(--gradient-gold)] text-[color:var(--primary-foreground)] shadow-lg transition group-hover:scale-110">
                          ▶
                        </span>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 p-2">
                        <div className="font-display text-[11px] leading-tight text-foreground line-clamp-2">
                          {lesson.title}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <span>{loading ? "Loading tutorials…" : videoLabel}</span>
              <span className="font-mono text-primary">HD ●</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Pricing — real Auction Module tiers from pricing-section.tsx         */
/* ------------------------------------------------------------------ */

function Pricing({ goSignup }: { goSignup: () => void }) {
  const [payingPlan, setPayingPlan] = useState<PaymentPlan | null>(null);

  return (
    <>
      <Suspense
        fallback={
          <section id="pricing" className="mx-auto max-w-7xl px-5 py-16">
            <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Auction License</div>
            <h2 className="text-display-lg mt-2">One tournament. One license. No monthly fees.</h2>
          </section>
        }
      >
        <PricingSection
          onSelectPlan={(plan) => {
            if (!plan.discountedPrice) {
              goSignup();
              return;
            }
            setPayingPlan(plan);
          }}
        />
      </Suspense>

      {payingPlan ? (
        <Suspense fallback={null}>
          <PaymentModal plan={payingPlan} onClose={() => setPayingPlan(null)} />
        </Suspense>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function FAQ() {
  const qas = [
    { q: "What is sports auction software?", a: "It's the technology that runs an IPL-style live player auction — team owners bid points in real time for players from a pool, with categories, points purses, retentions and RTM. BidWar packages the operator console, team-owner mobile panel and LED display into one live-synced platform." },
    { q: "Does BidWar run IPL-style auctions?", a: "Yes. Categories A/B/C, base points, purses, retentions, RTM, accelerated rounds and unsold recycling are all built in — the same mechanics used in franchise league auctions. Bidding is in points, not money." },
    { q: "Are players sold for money on BidWar?", a: "No. On BidWar, players are allotted against a virtual points purse. The software does not process player purchase payments or cash transfers between teams, owners, or organizers. Any registration fees, deposits, or settlements outside BidWar are arranged by the organizer — BidWar is not responsible for those." },
    { q: "Is BidWar responsible for how organizers run their tournament?", a: "No. BidWar provides auction and scoring software. Organizers decide their own tournament rules, fees, and internal processes. BidWar is not liable for how an organizer conducts payments, settlements, or other arrangements outside the platform." },
    { q: "Is BidWar cloud-based?", a: "Yes. BidWar runs in any modern browser. No installs, no downloads. Hosted in India with encrypted connections and role-based access." },
    { q: "Do you support LED / big-screen display?", a: "Yes — a dedicated LED mode outputs 1080p60 broadcast graphics with lower-thirds, SOLD/UNSOLD stamps, live points purse counters and rotating sponsor bands." },
    { q: "How much does BidWar cost?", a: "BidWar is a one-time per-tournament Auction License for the software. Trial is free (2 teams). Paid plans (10% off limited-time): Starter ₹4,500 (4 teams), Pro ₹5,400 (8), Advanced ₹7,200 (12), Elite ₹8,100 (16), Premium ₹9,900 (22), Champion ₹10,800 (30). All taxes included. License fees are for software access — not for buying players." },
    { q: "What's included in the license?", a: "An Auction License covers the BidWar Auction Module for one tournament — bidding engine, team-owner panel, categories & points purses, QR registration, analytics and CSV export up to your plan's team limit. Sports Scoring is licensed separately." },
    { q: "Which sports does BidWar support?", a: "Cricket, football, kabaddi, badminton, basketball, volleyball, esports and corporate leagues — plus any custom draft/auction format. Categories, positions and points-purse rules are fully configurable." },
    { q: "Do team owners need to install an app?", a: "No. Team owners open a link on their phone browser and log in. Any Android or iOS device works." },
  ];
  return (
    <section id="faq" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">FAQ</div>
        <h2 className="text-display-lg mt-2">Questions from the commentary box.</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {qas.map((f) => (
          <details key={f.q} className="panel group p-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer items-start justify-between gap-4">
              <h3 className="font-display text-base leading-tight">{f.q}</h3>
              <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/10 font-mono text-xs text-primary transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Contact                                                             */
/* ------------------------------------------------------------------ */

function ContactSection({ onOpen }: { onOpen: () => void }) {
  return (
    <section id="contact" className="mx-auto max-w-7xl px-5 py-16">
      <div className="panel-rail relative overflow-hidden p-8 md:p-12">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-30" />
        <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Book Your Auction</div>
            <h2 className="text-display-lg mt-2">Talk to a BidWar producer.</h2>
            <p className="mt-4 max-w-md text-sm text-muted-foreground md:text-base">
              Share your tournament — we'll walk you through the platform, set up a free trial and
              get you live within a week. No pressure, no monthly commitment.
            </p>
            <div className="mt-8 space-y-3 text-sm">
              <a href={waMeUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-muted-foreground hover:text-foreground"><span className="font-mono text-primary">CALL</span> {SITE_CONTACT.phoneDisplay}</a>
              <a href={`mailto:${SITE_CONTACT.email}`} className="flex items-center gap-3 text-muted-foreground hover:text-foreground"><span className="font-mono text-primary">MAIL</span> {SITE_CONTACT.email}</a>
              <div className="flex items-center gap-3 text-muted-foreground"><span className="font-mono text-primary">HQ&nbsp;&nbsp;</span> {SITE_CONTACT.addressLine}</div>
            </div>
          </div>
          <ContactForm />
        </div>
      </div>
      <div className="mt-6 text-center">
        <button onClick={onOpen} className="text-xs uppercase tracking-[0.22em] text-muted-foreground hover:text-primary">
          Prefer a quick message? Open the contact drawer →
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
    <form onSubmit={onSubmit}
      className={`panel space-y-3 p-6 ${compact ? "text-sm" : ""}`}>
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
      <Field label="Tell us about your tournament" name="message" as="textarea" />
      <button type="submit" className="gold-button gold-button-hover w-full rounded-md py-3 text-xs">
        Request Live Demo →
      </button>
      <p className="text-center text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        We respond within 24 hours · No spam
      </p>
    </form>
  );
}

function Field({ label, name, type = "text", as, required, placeholder }: {
  label: string; name: string; type?: string; as?: "textarea"; required?: boolean; placeholder?: string;
}) {
  const cls = "w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none";
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}{required && " *"}</span>
      {as === "textarea"
        ? <textarea name={name} rows={3} className={cls} placeholder={placeholder} />
        : <input name={name} type={type} required={required} placeholder={placeholder} className={cls} />}
    </label>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      <select name={name} className="w-full rounded-md border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none">
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
            <div className="text-[10px] uppercase tracking-[0.24em] text-primary">Live Line</div>
            <h3 className="font-display text-2xl">Book a Demo</h3>
          </div>
          <button onClick={onClose} className="ghost-button rounded-md px-3 py-2 text-xs" aria-label="Close">Close ✕</button>
        </div>
        <ContactForm compact />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
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
      fallback={brandTextFallback("font-display text-2xl tracking-wider")}
    />
  );
}

function Footer() {
  type FooterItem = { label: string; href?: string };
  const cols: Array<{ h: string; items: FooterItem[] }> = [
    {
      h: "Product",
      items: [
        { label: "Features", href: "#features" },
        { label: "Pricing", href: "#pricing" },
        { label: "LED Mode", href: "#product" },
        { label: "Team-Owner Panel", href: "#product" },
        { label: "Broadcast Overlay", href: "#ecosystem" },
      ],
    },
    {
      h: "Solutions",
      items: [
        { label: "Cricket Auctions", href: "/cricket-auction-software" },
        { label: "Football Draft", href: "/football-player-auction" },
        { label: "Kabaddi Leagues", href: "/kabaddi-auction-platform" },
        { label: "Corporate T20", href: "/business-league-auction" },
        { label: "Esports", href: "/esports-auction-system" },
      ],
    },
    {
      h: "Resources",
      items: [
        { label: "Academy", href: "/academy" },
        { label: "Blog", href: "/blog" },
        { label: "Case Studies" },
        { label: "Help Center" },
        { label: "System Status" },
      ],
    },
    {
      h: "Company",
      items: [
        { label: "About" },
        { label: "Careers" },
        { label: "Contact", href: "/contact" },
        { label: "Sign In", href: "/organizer" },
      ],
    },
  ];
  // Visual slots: Instagram, Facebook (replaces unused LinkedIn), YouTube, X placeholder
  const socialLabels = ["IN", "FB", "YT", "TW"] as const;
  const socialByLabel = Object.fromEntries(SITE_SOCIAL.map((s) => [s.label, s]));
  const placeholderSocial = new Set<string>(SITE_SOCIAL_PLACEHOLDERS);

  return (
    <footer className="border-t border-white/10 bg-black/40 pt-16">
      <div className="mx-auto max-w-7xl px-5 pb-10">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <a href="/" className="flex items-center gap-2" aria-label={`${BRAND_NAME} Home`}>
              <FooterBrandMark />
            </a>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              India's auction-first platform for live sports player auctions. Team owners bid in
              points — not money. From street leagues to state finals — from auction to champion.
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
              <a href={`mailto:${SITE_CONTACT.email}`} className="block hover:text-foreground">{SITE_CONTACT.email}</a>
              <a href={waMeUrl()} target="_blank" rel="noopener noreferrer" className="block hover:text-foreground">{SITE_CONTACT.phoneDisplay}</a>
              <p>{SITE_CONTACT.addressLine}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {cols.map((c) => (
              <div key={c.h}>
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">{c.h}</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {c.items.map((i) => (
                    <li key={i.label}>
                      {i.href ? (
                        <a
                          href={i.href}
                          onClick={(e) => {
                            if (i.href?.startsWith("#")) {
                              scrollToSection(i.href.slice(1), e);
                            }
                          }}
                          className="hover:text-foreground"
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
          Players are not bought or sold for money through the platform. BidWar provides auction software
          and is not responsible for how organizers run tournament fees, settlements, or other internal
          arrangements outside BidWar.
        </div>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/5 px-5 py-5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <div>© {new Date().getFullYear()} BidWar Technologies · Made in India · Operated by {SITE_CONTACT.billingEntity}</div>
          <div className="flex gap-5">
            <a href="/legal/privacy" className="hover:text-foreground">Privacy</a>
            <a href="/legal/terms" className="hover:text-foreground">Terms</a>
            <a href="/legal/refund" className="hover:text-foreground">Refund</a>
            <a href="/legal" className="hover:text-foreground" title={`GSTIN ${SITE_CONTACT.gstin}`}>GST</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* BidWar signal motif — original geometric bid-pulse network         */
/* ------------------------------------------------------------------ */

function BidPulseMotif({ className }: { className?: string }) {
  // Rotating hex grid + network nodes + soft bid-wave rings — no sunburst rays.
  const nodes = [
    { x: 200, y: 60 }, { x: 320, y: 130 }, { x: 320, y: 270 },
    { x: 200, y: 340 }, { x: 80, y: 270 }, { x: 80, y: 130 },
    { x: 260, y: 200 }, { x: 140, y: 200 },
  ];
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="bp-core2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="oklch(0.90 0.17 88)" stopOpacity="0.55" />
          <stop offset="70%" stopColor="oklch(0.75 0.19 65)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id="bp-line" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.90 0.17 88)" stopOpacity="0.55" />
          <stop offset="100%" stopColor="oklch(0.60 0.15 265)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Soft core glow (no rays) */}
      <circle cx="200" cy="200" r="150" fill="url(#bp-core2)" />

      {/* Concentric hexagons — bid pulse layers */}
      <g fill="none" stroke="oklch(0.85 0.17 88)" strokeOpacity="0.22">
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

      {/* Network mesh — subtle connecting lines between nodes */}
      <g stroke="url(#bp-line)" strokeWidth="0.7">
        {nodes.map((n, i) =>
          nodes.slice(i + 1).map((m, j) => {
            const d = Math.hypot(n.x - m.x, n.y - m.y);
            if (d > 200) return null;
            return <line key={`${i}-${j}`} x1={n.x} y1={n.y} x2={m.x} y2={m.y} opacity="0.45" />;
          })
        )}
      </g>

      {/* Bid-pulse rings (thin, network-style) */}
      <g fill="none" stroke="oklch(0.85 0.17 88)" strokeWidth="0.6" opacity="0.35">
        <circle cx="200" cy="200" r="50" />
        <circle cx="200" cy="200" r="90" strokeDasharray="1 4" />
      </g>

      {/* Network nodes */}
      <g>
        {nodes.map((n, i) => (
          <g key={i}>
            <circle cx={n.x} cy={n.y} r={i < 6 ? 3.2 : 2} fill="oklch(0.90 0.17 88)" opacity="0.9" />
            <circle cx={n.x} cy={n.y} r="8" fill="none" stroke="oklch(0.85 0.17 88)" strokeOpacity="0.35" />
          </g>
        ))}
      </g>

      {/* Center pulse */}
      <circle cx="200" cy="200" r="5" fill="oklch(0.90 0.17 88)" />
      <circle cx="200" cy="200" r="14" fill="none" stroke="oklch(0.85 0.17 88)" strokeWidth="1" opacity="0.55" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Trust badges — small horizontal strip below hero                   */
/* ------------------------------------------------------------------ */

function TrustBadges() {
  const badges = [
    "Multi Sport", "LED Ready", "OBS Ready", "Mobile Owners",
    "Cloud Native", "No Installation", "Made in India",
  ];
  return (
    <section aria-label="Trust badges" className="border-y border-white/5 bg-black/20">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 py-4">
        {badges.map((b) => (
          <span
            key={b}
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground"
          >
            <span className="text-primary">✓</span> {b}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Reusable Case Study — supports multiple tournaments via carousel   */
/* ------------------------------------------------------------------ */

type Tournament = {
  id: string;
  name: string;
  seasonTag: string;
  sportTag: string;
  location: string;
  blurb: string;
  stats: Array<{ v: string; l: string }>;
  reelLabel: string;
  reelDuration: string;
};

function CaseStudy({ tournaments }: { tournaments: Tournament[] }) {
  const [idx, setIdx] = useState(0);
  const t = tournaments[idx];
  return (
    <div className="panel-rail relative overflow-hidden p-6 md:p-8">
      <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
      <BidPulseMotif className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 opacity-25" />

      {/* Carousel tab bar — scales as tournaments are added */}
      <div className="relative mb-6 flex flex-wrap items-center gap-2">
        {tournaments.map((tour, i) => (
          <button
            key={tour.id}
            onClick={() => setIdx(i)}
            className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] transition ${
              i === idx
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-white/10 bg-white/[0.03] text-muted-foreground hover:text-foreground"
            }`}
          >
            {tour.name}
          </button>
        ))}
        <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {idx + 1}/{tournaments.length}
        </span>
      </div>

      <div className="relative grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[color:var(--live)]/40 bg-[color:var(--live)]/10 px-3 py-1 text-[10px] font-bold tracking-[0.22em] text-[color:var(--live)]">
              <span className="live-dot mr-1.5 align-middle" />{t.seasonTag}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {t.sportTag}
            </span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              {t.location}
            </span>
          </div>
          <h3 className="text-display-md mt-3 font-display">{t.name}</h3>
          <p className="mt-3 max-w-lg text-sm text-muted-foreground">{t.blurb}</p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {t.stats.map((s) => <StatTile key={s.l} value={s.v} label={s.l} />)}
          </div>
        </div>

        {/* Reel placeholder — 16:9, ready for real footage */}
        <div className="panel relative overflow-hidden p-4">
          <div className="aspect-video overflow-hidden rounded-md bg-black/60">
            <div className="relative h-full w-full bg-[radial-gradient(80%_80%_at_50%_20%,oklch(0.42_0.15_265/0.7),oklch(0.14_0.09_265))]">
              <div className="absolute inset-0 grid-bg opacity-30" />
              <div className="absolute inset-0 flex items-center justify-center">
                <button className="flex h-16 w-16 items-center justify-center rounded-full bg-[image:var(--gradient-gold)] text-2xl text-[color:var(--primary-foreground)] shadow-[var(--shadow-broadcast)]" aria-label="Play highlight">▶</button>
              </div>
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[10px] uppercase tracking-[0.22em] text-white/70">
                <span>{t.reelLabel}</span>
                <span className="font-mono">{t.reelDuration}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Real Tournaments — Featured (carousel) + Masonry Gallery + Journey */
/* ------------------------------------------------------------------ */

function RealTournaments() {
  const tournaments: Tournament[] = [
    {
      id: "vnbl3",
      name: "VNBL 3.0",
      seasonTag: "BROADCAST · SEASON 3",
      sportTag: "Cricket · T10",
      location: "Mumbai",
      blurb:
        "Vasai Nalasopara Box League Season 3 — ranked among Maharashtra's most-watched tape-ball leagues. Ran on BidWar with a live LED wall, six-camera stream and category-based bidding for 84 players.",
      stats: [
        { v: "8", l: "Teams" }, { v: "84", l: "Players" },
        { v: "40L Pts", l: "Purse" }, { v: "112", l: "Bids/Min" },
      ],
      reelLabel: "Season 3 · Highlight Reel",
      reelDuration: "02:47",
    },
    {
      id: "ricl",
      name: "RICL",
      seasonTag: "SEASON 2 · UPCOMING",
      sportTag: "Cricket · T20",
      location: "Bengaluru",
      blurb:
        "Regional Inter-City League — 10 franchise teams across Karnataka, retention + RTM enabled. Season 2 auction scheduled with BidWar operator console and OBS-driven livestream.",
      stats: [
        { v: "10", l: "Teams" }, { v: "120", l: "Players" },
        { v: "55L Pts", l: "Purse" }, { v: "3", l: "Categories" },
      ],
      reelLabel: "Season 1 · Recap",
      reelDuration: "03:12",
    },
    {
      id: "corp",
      name: "Corporate Cricket",
      seasonTag: "SEASON 4 · REPEAT CLIENT",
      sportTag: "Cricket · T20",
      location: "Delhi NCR",
      blurb:
        "Departmental office IPL running for its fourth year on BidWar. 12 teams, custom sponsor overlays and analytics dashboards exported for HR.",
      stats: [
        { v: "12", l: "Teams" }, { v: "96", l: "Players" },
        { v: "28L Pts", l: "Purse" }, { v: "4", l: "Seasons" },
      ],
      reelLabel: "Boardroom Cut",
      reelDuration: "01:58",
    },
  ];

  // Masonry gallery: 1 hero + 2 medium + 3 small, each with a distinct aspect for real assets.
  const galleryHero = { t: "Auction Stage", d: "VNBL 3.0 · Mumbai", tag: "HERO PHOTO", aspect: "aspect-[16/10]", tone: "from-amber-500/40 to-rose-500/20" };
  const galleryMed = [
    { t: "LED Reveal", d: "SOLD · 4.8L Pts", tag: "LED SCREEN", aspect: "aspect-[4/3]", tone: "from-emerald-500/40 to-cyan-500/10" },
    { t: "Team Owners", d: "Bidding Floor", tag: "PHOTO", aspect: "aspect-[4/3]", tone: "from-indigo-500/40 to-violet-500/10" },
  ];
  const gallerySm = [
    { t: "Trophy Handover", d: "Season Finale", tag: "CEREMONY", aspect: "aspect-square", tone: "from-amber-400/40 to-orange-500/10" },
    { t: "Broadcast Overlay", d: "Live on YouTube", tag: "OBS", aspect: "aspect-square", tone: "from-rose-500/40 to-amber-500/10" },
    { t: "Control Room", d: "Operator POV", tag: "SCREEN", aspect: "aspect-square", tone: "from-blue-500/40 to-teal-500/10" },
  ];

  const journey = [
    { t: "Registration", d: "QR + web signup" },
    { t: "Verification", d: "Docs + categories" },
    { t: "Auction Night", d: "Live bidding room" },
    { t: "LED Broadcast", d: "Lower-thirds · SOLD" },
    { t: "Final Squads", d: "CSV + player cards" },
    { t: "Fixtures", d: "Draw + schedule" },
    { t: "Champion", d: "Trophy handover" },
  ];

  return (
    <section id="tournaments" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Case Study · Featured Tournament</div>
        <h2 className="text-display-lg mt-2 max-w-3xl">Real tournaments. Real results.</h2>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
          Live leagues run end-to-end on BidWar — LED reveal, team-owner phones, broadcast overlay,
          exported squads before the crowd leaves.
        </p>
      </div>

      {/* Featured tournament — reusable carousel */}
      <div className="mb-10">
        <CaseStudy tournaments={tournaments} />
      </div>

      {/* Masonry gallery — 1 hero + 2 medium + 3 small */}
      <div className="mb-10">
        <div className="mb-4 flex items-end justify-between">
          <h3 className="font-display text-xl tracking-wider">Production Gallery</h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">On the floor · Season 3</span>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {/* Hero — spans 2 cols and 2 rows on desktop */}
          <GalleryTile item={galleryHero} className="md:col-span-2 md:row-span-2" />
          {/* Medium */}
          {galleryMed.map((g) => <GalleryTile key={g.t} item={g} />)}
          {/* Small trio — spans full width, 3 columns */}
          <div className="grid grid-cols-3 gap-3 md:col-span-3">
            {gallerySm.map((g) => <GalleryTile key={g.t} item={g} />)}
          </div>
        </div>
      </div>

      {/* Tournament Timeline — visual journey */}
      <div className="panel p-6 md:p-8">
        <div className="mb-6 flex items-end justify-between">
          <h3 className="font-display text-xl tracking-wider">Tournament Timeline</h3>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">The flow of a live tournament</span>
        </div>
        <ol className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
          {journey.map((s, i) => (
            <li key={s.t} className="relative">
              <div className="scoreboard-tile relative flex h-full flex-col items-start gap-2 px-4 py-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[image:var(--gradient-gold)] font-mono text-[10px] text-[color:var(--primary-foreground)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="font-display text-sm leading-tight">{s.t}</div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{s.d}</div>
              </div>
              {i < journey.length - 1 && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-[-10px] top-1/2 hidden -translate-y-1/2 font-mono text-primary/70 lg:block"
                >
                  ▸
                </span>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function GalleryTile({
  item,
  className = "",
}: {
  item: { t: string; d: string; tag: string; aspect: string; tone: string };
  className?: string;
}) {
  return (
    <div className={`panel group relative overflow-hidden ${item.aspect} ${className}`}>
      <div className={`absolute inset-0 bg-gradient-to-br ${item.tone}`} />
      <div className="absolute inset-0 grid-bg opacity-20" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3">
        <div className="font-display text-sm">{item.t}</div>
        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{item.d}</div>
      </div>
      <div className="absolute right-2 top-2 rounded-sm bg-black/50 px-1.5 py-0.5 font-mono text-[9px] text-primary">{item.tag}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product Showcase — 4 premium-labeled surfaces                       */
/* ------------------------------------------------------------------ */

function ProductShowcase() {
  const surfaces = [
    { k: "Operator Console", tag: "CONTROL ROOM", d: "Queue, pools, RTM, retentions, undo — one auctioneer runs the room.", kind: "console" },
    { k: "Team-Owner App", tag: "MOBILE EXPERIENCE", d: "Bid from any phone. Budget guard, category tracker, instant confirm.", kind: "mobile" },
    { k: "Live Auction Room", tag: "LIVE INTERFACE", d: "Real-time bid ticker, leading-bidder card, SOLD stamps — for the room to feel the moment.", kind: "live" },
    { k: "LED / Stream Feed", tag: "BROADCAST OUTPUT", d: "1080p60 lower-thirds, SOLD stamps, points purse counters, sponsor bands, OBS-ready.", kind: "broadcast" },
  ];
  return (
    <section id="product" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Three Surfaces</div>
        <h2 className="text-display-lg mt-2 max-w-3xl">One live auction. Every screen it needs to be on.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {surfaces.map((s, i) => (
          <div key={s.k} className="panel relative overflow-hidden p-5">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Surface · 0{i + 1}</span>
              <span className="rounded-sm bg-[image:var(--gradient-gold)] px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest text-[color:var(--primary-foreground)]">
                {s.tag}
              </span>
            </div>
            {/* Screenshot placeholder — sized for real 16:9 asset (mobile uses 9:16). */}
            <div className={`scoreboard-tile relative mb-4 overflow-hidden ${s.kind === "mobile" ? "aspect-[9/16] max-h-72" : "aspect-video"}`}>
              <div className="absolute inset-0 bg-[radial-gradient(80%_80%_at_50%_10%,oklch(0.42_0.15_265/0.6),oklch(0.14_0.09_265))]" />
              <div className="absolute inset-0 grid-bg opacity-25" />
              {s.kind === "console" && (
                <div className="absolute inset-3 grid grid-cols-4 gap-1">
                  <div className="col-span-3 rounded bg-white/5" />
                  <div className="rounded bg-primary/20" />
                  <div className="col-span-2 rounded bg-white/5" />
                  <div className="col-span-2 rounded bg-white/5" />
                  <div className="col-span-4 rounded bg-white/5" />
                </div>
              )}
              {s.kind === "mobile" && (
                <div className="absolute inset-x-6 inset-y-3 rounded-lg border border-white/10 bg-black/40 p-2">
                  <div className="h-3 w-1/2 rounded bg-primary/40" />
                  <div className="mt-2 h-24 rounded bg-white/5" />
                  <div className="mt-2 flex gap-1">
                    <div className="h-8 flex-1 rounded bg-primary/30" />
                    <div className="h-8 flex-1 rounded bg-white/10" />
                  </div>
                </div>
              )}
              {s.kind === "live" && (
                <div className="absolute inset-3 flex flex-col justify-between">
                  <div className="flex justify-between">
                    <div className="h-2 w-16 rounded bg-[color:var(--live)]/60" />
                    <div className="h-2 w-10 rounded bg-white/20" />
                  </div>
                  <div className="rounded bg-white/5 p-2">
                    <div className="h-3 w-24 rounded bg-primary/30" />
                    <div className="mt-1 h-2 w-16 rounded bg-white/20" />
                  </div>
                </div>
              )}
              {s.kind === "broadcast" && (
                <div className="absolute inset-x-3 bottom-3">
                  <div className="rounded bg-[image:var(--gradient-gold)]/40 p-2">
                    <div className="h-2 w-1/3 rounded bg-black/40" />
                    <div className="mt-1 h-3 w-1/2 rounded bg-black/60" />
                  </div>
                </div>
              )}
              <div className="absolute left-2 top-2 rounded-sm bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-widest text-primary">
                {s.tag}
              </div>
            </div>
            <h3 className="font-display text-lg">{s.k}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Broadcast Ecosystem — center hub + animated SVG connector lines    */
/* ------------------------------------------------------------------ */

function BroadcastEcosystem() {
  const spokes = [
    { t: "Operator Console", d: "Control room laptop", side: "left", i: 0 },
    { t: "Team Owner Phones", d: "Bidding from tables", side: "left", i: 1 },
    { t: "LED Screen", d: "1080p60 broadcast wall", side: "left", i: 2 },
    { t: "OBS Stream", d: "YouTube · Facebook Live", side: "right", i: 0 },
    { t: "Sponsor Branding", d: "Rotating LED bands", side: "right", i: 1 },
    { t: "Analytics", d: "CSV · dashboards", side: "right", i: 2 },
  ] as const;

  return (
    <section id="ecosystem" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Broadcast Ecosystem</div>
        <h2 className="text-display-lg mt-2 max-w-3xl">One live feed. Six connected surfaces.</h2>
      </div>
      <div className="panel-rail relative overflow-hidden p-6 md:p-10">
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />

        <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_1.3fr_1fr]">
          {/* LEFT column nodes */}
          <div className="relative z-10 space-y-3">
            {spokes.filter((s) => s.side === "left").map((s) => (
              <div key={s.t} className="panel flex items-center justify-between p-4">
                <div>
                  <div className="font-display text-base">{s.t}</div>
                  <div className="text-xs text-muted-foreground">{s.d}</div>
                </div>
                <span className="font-mono text-[10px] text-primary">→ HUB</span>
              </div>
            ))}
          </div>

          {/* CENTER hub with animated connector SVG behind it */}
          <div className="relative mx-auto aspect-square w-full max-w-sm">
            {/* SVG connector lines — from hub center to each side (drawn behind hub) */}
            <svg
              viewBox="0 0 400 400"
              className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="ec-line" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="oklch(0.90 0.17 88)" stopOpacity="0" />
                  <stop offset="50%" stopColor="oklch(0.90 0.17 88)" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="oklch(0.90 0.17 88)" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[
                { x2: -40, y2: 60 }, { x2: -40, y2: 200 }, { x2: -40, y2: 340 },
                { x2: 440, y2: 60 }, { x2: 440, y2: 200 }, { x2: 440, y2: 340 },
              ].map((p, i) => (
                <line
                  key={i}
                  x1="200" y1="200" x2={p.x2} y2={p.y2}
                  stroke="url(#ec-line)"
                  strokeWidth="1.2"
                  strokeDasharray="4 6"
                  className="ecosystem-line"
                  style={{ animationDelay: `${i * 0.25}s` }}
                />
              ))}
            </svg>

            <BidPulseMotif className="absolute inset-0 opacity-90" />

            {/* Hub badge with pulse */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-primary/25" />
                <div className="relative rounded-full bg-[image:var(--gradient-gold)] px-5 py-2 font-display text-sm text-[color:var(--primary-foreground)] shadow-[var(--shadow-broadcast)]">
                  BidWar Live Hub
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT column nodes */}
          <div className="relative z-10 space-y-3">
            {spokes.filter((s) => s.side === "right").map((s) => (
              <div key={s.t} className="panel flex items-center justify-between p-4">
                <span className="font-mono text-[10px] text-primary">HUB ←</span>
                <div className="text-right">
                  <div className="font-display text-base">{s.t}</div>
                  <div className="text-xs text-muted-foreground">{s.d}</div>
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
/* Testimonials                                                        */
/* ------------------------------------------------------------------ */

function Testimonials() {
  const quotes = [
    { q: "BidWar turned our auction night into a broadcast event. Owners bid from their seats, the LED looked like TV — and we exported final squads before the crowd left.", n: "Rohit Kadam", r: "Organizer · Vasai Nalasopara Box League", tag: "VNBL 3.0" },
    { q: "We tried running IPL-style auctions on spreadsheets for two seasons. BidWar took the chaos out. RTM, retentions, category caps — all handled without a hitch.", n: "Priya Sequeira", r: "Director · Pune Sports Guild", tag: "PSG Cricket" },
    { q: "The team-owner mobile panel is the killer feature. Budget guard alone saved three of my franchises from over-bidding on marquees.", n: "Karthik Menon", r: "Auctioneer · South India Kabaddi League", tag: "SIKL" },
  ];
  return (
    <section id="testimonials" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">From the Commentary Box</div>
        <h2 className="text-display-lg mt-2 max-w-3xl">Organizers who've walked out of an auction night, on time.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {quotes.map((t) => (
          <figure key={t.n} className="panel relative flex flex-col p-6">
            <span className="font-display text-6xl leading-none text-primary/40">“</span>
            <blockquote className="-mt-4 text-sm leading-relaxed text-foreground/90">{t.q}</blockquote>
            <figcaption className="mt-6 border-t border-white/10 pt-4">
              <div className="font-display text-base">{t.n}</div>
              <div className="text-xs text-muted-foreground">{t.r}</div>
              <div className="mt-2 inline-block rounded-sm bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] tracking-widest text-primary">{t.tag}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Success Metrics                                                     */
/* ------------------------------------------------------------------ */

function SuccessMetrics() {
  const metrics = [
    { v: "40+", l: "Hours saved", s: "per auction night" },
    { v: "112", l: "Bids per minute", s: "peak throughput" },
    { v: "0", l: "Refresh needed", s: "true real-time sync" },
    { v: "99.98%", l: "Uptime", s: "on auction nights" },
    { v: "5 min", l: "Setup to live", s: "browser-first" },
    { v: "24/7", l: "War-room support", s: "India timezone" },
  ];
  return (
    <section id="metrics" className="mx-auto max-w-7xl px-5 py-16">
      <div className="mb-10">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Success Metrics</div>
        <h2 className="text-display-lg mt-2 max-w-3xl">The numbers our operators quote in the green room.</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {metrics.map((m) => (
          <div key={m.l} className="scoreboard-tile p-4">
            <div className="font-display text-3xl text-primary">{m.v}</div>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">{m.l}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{m.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final CTA                                                           */
/* ------------------------------------------------------------------ */

function FinalCTA({ onContact, goSignup }: { onContact: () => void; goSignup: () => void }) {
  return (
    <section className="mx-auto max-w-7xl px-5 py-16">
      <div className="panel-rail relative overflow-hidden p-10 md:p-16">
        <BidPulseMotif className="pointer-events-none absolute -right-20 -top-20 h-96 w-96 opacity-40" />
        <BidPulseMotif className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 opacity-25" />
        <div className="pointer-events-none absolute inset-0 scan-lines opacity-20" />
        <div className="relative mx-auto max-w-3xl text-center">
          <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Auction Night · Locked In</div>
          <h2 className="text-hero mt-3 font-display">
            <span className="block">Your league.</span>
            <span className="block gold-text">Broadcast-grade.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm text-muted-foreground md:text-base">
            Free trial · No setup fee · Any device · Ready in five minutes. Book a live producer walkthrough and go live within a week.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={goSignup} className="gold-button gold-button-hover rounded-md px-7 py-3.5 text-sm">Start Free Trial →</button>
            <button type="button" onClick={onContact} className="ghost-button ghost-button-hover rounded-md px-7 py-3.5 text-sm">▶ Book a Producer Call</button>
          </div>
        </div>
      </div>
    </section>
  );
}



export default function LovableHome() {
  return <Home />;
}
