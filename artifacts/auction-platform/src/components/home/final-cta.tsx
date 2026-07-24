import { ChevronRight, Phone } from "lucide-react";

/**
 * Final CTA — closing "Ready to run your auction?" banner.
 */
export function FinalCta({ onCreateAccount }: { onCreateAccount: () => void }) {
  return (
    <section id="final-cta" className="py-24 px-6">
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
                onClick={onCreateAccount}
                data-analytics="final_cta_create_account"
                className="px-8 py-4 rounded-xl bg-primary text-primary-foreground font-display font-black text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                Create Free Account <ChevronRight className="w-5 h-5" aria-hidden />
              </button>
              <a
                href="https://wa.me/918707488250"
                target="_blank"
                rel="noopener noreferrer"
                data-analytics="final_cta_whatsapp"
                className="px-8 py-4 rounded-xl border border-border text-foreground font-semibold text-lg hover:bg-card/50 transition-colors flex items-center justify-center gap-2"
              >
                <Phone className="w-5 h-5 text-green-400" aria-hidden /> WhatsApp Us
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
