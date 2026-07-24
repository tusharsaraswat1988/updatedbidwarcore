import { useState, useEffect, useRef, useCallback, Suspense, lazy } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { HomeSchemaMarkup } from "@/components/schema-markup";
import type { PaymentPlan } from "@/components/payment-modal";
import { PublicNavbar } from "@/components/public-navbar";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import { useIsHydrated } from "@/lib/initial-data/use-is-hydrated";
import { displayAuctionKeys, showcaseKeys } from "@/lib/initial-data/query-keys";
import {
  fetchDisplayAuctions,
  mapDisplayAuctionsToUpcoming,
} from "@/lib/initial-data/homepage-queries";
import type { ShowcaseEventRecord } from "@/lib/initial-data/types";
import { DEFAULT_GALLERY_ITEMS } from "@/data/homepage-content";
import { LazyWhenVisible } from "@/components/home/lazy-when-visible";

import { HeroSection } from "@/components/home/hero-section";
import { UpcomingAuctionsStrip } from "@/components/home/upcoming-auctions-strip";
import { TrustStrip } from "@/components/home/trust-strip";
import { NumbersSection } from "@/components/home/numbers-section";
import type { GalleryItem } from "@/components/home/events-gallery";

/** Below-fold sections — code-split; mounted only when near viewport. */
const AcademySection = lazy(() =>
  import("@/components/home/academy-section").then((m) => ({ default: m.AcademySection })),
);
const ThreeSurfaces = lazy(() =>
  import("@/components/home/three-surfaces").then((m) => ({ default: m.ThreeSurfaces })),
);
const FeatureDeck = lazy(() =>
  import("@/components/home/feature-deck").then((m) => ({ default: m.FeatureDeck })),
);
const BroadcastEcosystem = lazy(() =>
  import("@/components/home/broadcast-ecosystem").then((m) => ({ default: m.BroadcastEcosystem })),
);
const SportsSection = lazy(() =>
  import("@/components/home/sports-section").then((m) => ({ default: m.SportsSection })),
);
const BenefitsSection = lazy(() =>
  import("@/components/home/benefits-section").then((m) => ({ default: m.BenefitsSection })),
);
const FeaturedTournament = lazy(() =>
  import("@/components/home/featured-tournament").then((m) => ({ default: m.FeaturedTournament })),
);
const EventsGallery = lazy(() =>
  import("@/components/home/events-gallery").then((m) => ({ default: m.EventsGallery })),
);
const ProductionGallery = lazy(() =>
  import("@/components/home/production-gallery").then((m) => ({ default: m.ProductionGallery })),
);
const HowItWorks = lazy(() =>
  import("@/components/home/how-it-works").then((m) => ({ default: m.HowItWorks })),
);
const Timeline = lazy(() =>
  import("@/components/home/timeline").then((m) => ({ default: m.Timeline })),
);
const PricingSection = lazy(() =>
  import("@/components/home/pricing-section").then((m) => ({ default: m.PricingSection })),
);
const FaqSection = lazy(() =>
  import("@/components/home/faq-section").then((m) => ({ default: m.FaqSection })),
);
const DemoRequest = lazy(() =>
  import("@/components/demo-request").then((m) => ({ default: m.DemoRequest })),
);
const Testimonials = lazy(() =>
  import("@/components/testimonials").then((m) => ({ default: m.Testimonials })),
);
const SolutionsHub = lazy(() =>
  import("@/components/home/solutions-hub").then((m) => ({ default: m.SolutionsHub })),
);
const ResourcesSection = lazy(() =>
  import("@/components/home/resources-section").then((m) => ({ default: m.ResourcesSection })),
);
const FinalCta = lazy(() =>
  import("@/components/home/final-cta").then((m) => ({ default: m.FinalCta })),
);
const WhatsAppFloat = lazy(() =>
  import("@/components/home/whatsapp-float").then((m) => ({ default: m.WhatsAppFloat })),
);
const AboutSection = lazy(() =>
  import("@/components/home/about-section").then((m) => ({ default: m.AboutSection })),
);
const SiteFooter = lazy(() =>
  import("@/components/home/site-footer").then((m) => ({ default: m.SiteFooter })),
);
const PaymentModal = lazy(() =>
  import("@/components/payment-modal").then((m) => ({ default: m.PaymentModal })),
);

async function fetchShowcaseEvents(): Promise<ShowcaseEventRecord[]> {
  const response = await fetch("/api/showcase-events", { cache: "no-store" });
  if (!response.ok) return [];
  const data: unknown = await response.json();
  return Array.isArray(data) ? (data as ShowcaseEventRecord[]) : [];
}

export default function Landing() {
  const [, navigate] = useLocation();
  const isHydrated = useIsHydrated();
  const { logos, brandName, loading: brandingLoading } = usePublicBranding();
  const [payingPlan, setPayingPlan] = useState<PaymentPlan | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [deferHeavyQueries, setDeferHeavyQueries] = useState(false);
  const carouselTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    const enable = () => {
      if (!cancelled) setDeferHeavyQueries(true);
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(enable, { timeout: 2500 });
      return () => {
        cancelled = true;
        w.cancelIdleCallback?.(id);
      };
    }
    const t = window.setTimeout(enable, 1200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

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
    enabled: deferHeavyQueries,
  });

  const activeGallery: readonly GalleryItem[] =
    showcaseItems && showcaseItems.length > 0
      ? showcaseItems.map((s) => ({
          img: s.imageUrl,
          caption: s.tournamentName,
          tag: s.sportName,
          alt: s.altText ?? `${s.sportName} auction event — ${s.tournamentName}`,
          description: s.description,
        }))
      : DEFAULT_GALLERY_ITEMS;

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
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <HomeSchemaMarkup />

      <PublicNavbar />

      <main id="main-content">
      {/* ── Above the fold (eager) ─────────────────────────────────────── */}
      <HeroSection
        onStartFree={() => navigate("/organizer?tab=signup")}
        onOperatorLogin={() => navigate("/organizer")}
      />

      <UpcomingAuctionsStrip auctions={displayAuctions} onViewAll={() => navigate("/upcoming-auctions")} />

      <TrustStrip />

      <NumbersSection />

      {/* ── Below the fold (viewport-gated + code-split) ──────────────── */}
      <LazyWhenVisible minHeight="28rem">
        <ThreeSurfaces />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="32rem">
        <FeatureDeck />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="28rem">
        <BroadcastEcosystem />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="24rem">
        <SportsSection />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="24rem">
        <BenefitsSection />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="36rem">
        <FeaturedTournament />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="28rem">
        <EventsGallery items={activeGallery} carouselIndex={carouselIndex} onGoToPage={goToPage} />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="40rem">
        <ProductionGallery />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="32rem">
        <AcademySection />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="28rem">
        <HowItWorks />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="20rem">
        <Timeline />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="40rem">
        <PricingSection
          onSelectPlan={(plan) => (plan.discountedPrice ? setPayingPlan(plan) : navigate("/organizer?tab=signup"))}
        />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="32rem">
        <FaqSection />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="28rem">
        <DemoRequest />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="24rem">
        <Testimonials />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="20rem">
        <SolutionsHub />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="20rem">
        <ResourcesSection onBookDemo={() => navigate("/organizer")} />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="16rem">
        <FinalCta onCreateAccount={() => navigate("/organizer?tab=signup")} />
      </LazyWhenVisible>

      <LazyWhenVisible minHeight="12rem">
        <AboutSection />
      </LazyWhenVisible>
      </main>

      <LazyWhenVisible minHeight="16rem">
        <SiteFooter brandName={brandName} logos={logos} brandingLoading={brandingLoading} />
      </LazyWhenVisible>

      {isHydrated ? (
        <Suspense fallback={null}>
          <WhatsAppFloat />
        </Suspense>
      ) : null}

      {payingPlan ? (
        <Suspense fallback={null}>
          <PaymentModal plan={payingPlan} onClose={() => setPayingPlan(null)} />
        </Suspense>
      ) : null}
    </div>
  );
}
