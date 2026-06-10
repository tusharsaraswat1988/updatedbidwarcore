import { useLocation } from "wouter";
import { PenLine } from "lucide-react";

interface BlogLayoutProps {
  children: React.ReactNode;
}

/** Shared nav + footer wrapper for all blog pages, matching the site's dark theme. */
export function BlogLayout({ children }: BlogLayoutProps) {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">

      {/* ── Nav ────────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <img src="/bidwar-logo-transparent.png" alt="BidWar" className="h-8 w-auto" />
            <span className="font-black text-lg tracking-tight text-white">BIDWAR</span>
          </a>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/#features" className="hover:text-white transition-colors">Features</a>
            <a href="/#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="/blog" className="hover:text-white transition-colors flex items-center gap-1.5">
              <PenLine className="h-3.5 w-3.5" />
              Blog
            </a>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/organizer")}
              className="text-sm text-muted-foreground hover:text-white transition-colors hidden sm:block"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/organizer")}
              className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="pt-16">
        {children}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/30 bg-[#09090b] mt-20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <a href="/" className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity">
                <img src="/bidwar-logo-transparent.png" alt="BidWar" className="h-7 w-auto" />
                <span className="font-black text-base text-white">BIDWAR</span>
              </a>
              <p className="text-xs text-muted-foreground leading-relaxed">
                India's live sports auction platform for franchise leagues.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Sport Auctions</p>
              {[
                ["Cricket", "/cricket-auction-software"],
                ["Football", "/football-player-auction"],
                ["Kabaddi", "/kabaddi-auction-platform"],
                ["Badminton", "/badminton-auction-platform"],
                ["Basketball", "/basketball-auction-software"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Resources</p>
              {[
                ["Blog", "/blog"],
                ["Auction Guides", "/blog/category/auction-guides"],
                ["Platform Features", "/blog/category/platform-features"],
                ["Organizer Tips", "/blog/category/organizer-tips"],
                ["Contact", "/contact"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Legal</p>
              {[
                ["Terms of Service", "/legal/terms"],
                ["Privacy Policy", "/legal/privacy"],
                ["Acceptable Use", "/legal/acceptable-use"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div className="border-t border-border/30 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} BidWar. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">India's Live Sports Auction Platform</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
