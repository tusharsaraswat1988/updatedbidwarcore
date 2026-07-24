export type OnboardingStep = { n: string; title: string; desc: string };

export const HOW_IT_WORKS_STEPS: readonly OnboardingStep[] = [
  { n: "01", title: "Create Your Account", desc: "Sign up with your mobile number in under 30 seconds. Your first 2-team tournament is free — no credit card required." },
  { n: "02", title: "Set Up Your Tournament", desc: "Add franchises, player categories, purse values, and squad rules. Import via CSV or let players self-register via QR code." },
  { n: "03", title: "Go Live", desc: "Press Start Auction. The LED display, owner mobile panels, and Broadcast Overlay all sync instantly in real time." },
] as const;

/**
 * How It Works — "Live in three steps" onboarding overview.
 */
export function HowItWorks({
  steps = HOW_IT_WORKS_STEPS,
}: {
  steps?: readonly OnboardingStep[];
}) {
  return (
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
          {steps.map((s) => (
            <div key={s.n} className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto">
                <span className="font-display font-black text-2xl text-primary">{s.n}</span>
              </div>
              <h3 className="font-display font-bold text-xl">{s.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
