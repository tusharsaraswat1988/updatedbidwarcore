const PLATFORM_CAPABILITIES = [
  "Conduct live player auctions",
  "Manage teams and tournaments",
  "Display live bidding screens",
  "Operate organizer and owner panels",
  "Manage auction data securely",
] as const;

/**
 * About Section — company/operator info block.
 */
export function AboutSection() {
  return (
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
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">The platform allows organizers to</p>
              <ul className="space-y-2">
                {PLATFORM_CAPABILITIES.map(item => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-white/70">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-border/50 bg-white/[0.02] px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Google Sign-In</p>
              <p className="text-sm text-white/60 leading-relaxed">
                Google Sign-In is used only for secure authentication and organizer account access.
                BidWar does not sell or share Google user data with third parties.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
