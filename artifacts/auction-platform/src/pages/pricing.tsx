import { Suspense, lazy, useState } from "react";
import { useLocation } from "wouter";
import { PublicWebsiteLayout } from "@/components/public-website-layout";
import { PricingSection } from "@/components/home/pricing-section";
import type { PaymentPlan } from "@/components/payment-modal";

const PaymentModal = lazy(() =>
  import("@/components/payment-modal").then((m) => ({ default: m.PaymentModal })),
);

/**
 * Dedicated Pricing page — reuses the real pricing logic (tiers, discount
 * banner, plan selection, payment modal / bank transfer) from
 * `components/home/pricing-section.tsx`, presented inside the shared
 * PublicWebsiteLayout so it matches the homepage's header, footer,
 * typography, colors and spacing.
 */
export default function PricingPage() {
  const [, navigate] = useLocation();
  const [payingPlan, setPayingPlan] = useState<PaymentPlan | null>(null);

  return (
    <PublicWebsiteLayout
      seo={{
        title: "Pricing | BidWar — One-Time Per-Tournament Auction License",
        description:
          "BidWar pricing: one-time per-tournament Auction License, starting free for 2 teams. No monthly fees, no auto-renewals. Compare Starter, Pro, Advanced, Elite and Champion plans.",
        canonical: "https://bidwar.in/pricing",
      }}
    >
      <section className="mx-auto max-w-7xl px-5 pt-10 text-center">
        <div className="text-[11px] uppercase tracking-[0.24em] text-primary">Auction License</div>
        <h1 className="text-display-lg mt-2">One tournament. One license. No monthly fees.</h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-muted-foreground md:text-base">
          Buy for the event, run the night, keep your final squads and analytics. Pick the plan
          that matches your team count — upgrade any time for your next tournament.
        </p>
      </section>

      <PricingSection
        onSelectPlan={(plan) => (plan.discountedPrice ? setPayingPlan(plan) : navigate("/organizer?tab=signup"))}
      />

      {payingPlan ? (
        <Suspense fallback={null}>
          <PaymentModal plan={payingPlan} onClose={() => setPayingPlan(null)} />
        </Suspense>
      ) : null}
    </PublicWebsiteLayout>
  );
}
