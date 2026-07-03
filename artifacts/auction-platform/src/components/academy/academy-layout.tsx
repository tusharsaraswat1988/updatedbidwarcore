import { PublicNavbar } from "@/components/public-navbar";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";

const landingFooterPreset = getBrandSurfacePreset("landing-footer");

interface AcademyLayoutProps {
  children: React.ReactNode;
}

export function AcademyLayout({ children }: AcademyLayoutProps) {
  const { logos, brandName } = useBranding();
  const footerLogoSrc = getBrandLogoSrc(logos, landingFooterPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">
      <PublicNavbar />
      <main className="pt-16">{children}</main>
      <footer className="border-t border-border/30 bg-[#09090b] mt-20">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <a href="/" className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity">
                <img src={footerLogoSrc} alt={logoAlt} className={landingFooterPreset.sizeClass} loading="lazy" decoding="async" />
              </a>
              <p className="text-xs text-muted-foreground leading-relaxed">
                India&apos;s live sports auction platform for franchise leagues.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Learn</p>
              {[
                ["Academy", "/academy"],
                ["Blog", "/blog"],
                ["Auction Tips", "/auction-tips"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Products</p>
              {[
                ["Sports Auction Software", "/sports-auction-software"],
                ["Cricket Auction", "/cricket-auction-software"],
                ["Franchise Auction", "/franchise-auction-software"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
              ))}
            </div>
            <div className="space-y-2">
              <p className="text-xs font-bold text-white uppercase tracking-wide mb-3">Company</p>
              {[
                ["Contact", "/contact"],
                ["Upcoming Auctions", "/upcoming-auctions"],
                ["Legal", "/legal"],
              ].map(([label, href]) => (
                <a key={href} href={href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{label}</a>
              ))}
            </div>
          </div>
          <div className="border-t border-border/30 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} BidWar. All rights reserved.</p>
            <p className="text-xs text-muted-foreground">BidWar Academy — Sports Auction Tutorials</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
