import { Instagram, Facebook, Youtube, Mail, Phone, Globe } from "lucide-react";
import { getBrandLogoAlt, getBrandLogoSrc, type BrandLogos } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";

const landingFooterPreset = getBrandSurfacePreset("landing-footer");

const PLATFORM_LINKS = [
  { label: "Features", href: "#features" },
                  { label: "Use Cases", href: "#sports" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Auction Gallery", href: "#gallery" },
  { label: "BidWar Academy", href: "/academy" },
  { label: "Blog & Guides", href: "/blog" },
  { label: "Contact Us", href: "/contact" },
] as const;

const LEGAL_LINKS = [
  { label: "Legal Hub", href: "/legal" },
  { label: "Terms & Conditions", href: "/legal/terms" },
  { label: "Licensing Policy", href: "/legal/licensing" },
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Acceptable Use", href: "/legal/acceptable-use" },
  { label: "Disclaimer", href: "/legal/disclaimer" },
  { label: "Refund Policy", href: "/legal/refund" },
] as const;

/**
 * Site Footer — brand, sitemap links, legal links, support contacts.
 */
export function SiteFooter({
  brandName,
  logos,
  brandingLoading,
}: {
  brandName: string;
  logos: BrandLogos;
  brandingLoading: boolean;
}) {
  const logoAlt = getBrandLogoAlt(brandName);

  return (
    <footer className="border-t border-border/40 pt-14 pb-8 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          <div className="space-y-4 md:col-span-1">
            <a href="/" aria-label={`${brandName} Home`} className="inline-flex items-center hover:opacity-90 transition-opacity">
              {brandingLoading ? (
                <div className="h-10 w-40" aria-hidden />
              ) : (logos.mainReverse || logos.main) ? (
                <img
                  src={getBrandLogoSrc(logos, landingFooterPreset.logoOrder)}
                  alt={logoAlt}
                  className={landingFooterPreset.sizeClass}
                  loading="lazy"
                  decoding="async"
                />
              ) : null}
            </a>
            <p className="text-xs text-muted-foreground leading-relaxed">
              India&rsquo;s live sports auction platform. IPL-grade infrastructure for cricket, football, kabaddi and franchise leagues.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://www.instagram.com/bidwar.in" target="_blank" rel="noopener noreferrer" aria-label="BidWar on Instagram" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                <Instagram className="w-4 h-4" aria-hidden />
              </a>
              <a href="https://www.facebook.com/bidwar.in" target="_blank" rel="noopener noreferrer" aria-label="BidWar on Facebook" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                <Facebook className="w-4 h-4" aria-hidden />
              </a>
              <a href="https://www.youtube.com/@bidwarofficial" target="_blank" rel="noopener noreferrer" aria-label="BidWar on YouTube" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-white hover:border-white/30 transition-colors text-xs font-bold">
                <Youtube className="w-4 h-4" aria-hidden />
              </a>
            </div>
          </div>

          <nav className="space-y-3" aria-label="Platform">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Platform</p>
            <div className="space-y-2">
              {PLATFORM_LINKS.map(l => (
                <a key={l.label} href={l.href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{l.label}</a>
              ))}
            </div>
          </nav>

          <nav className="space-y-3" aria-label="Legal">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Legal</p>
            <div className="space-y-2">
              {LEGAL_LINKS.map(l => (
                <a key={l.label} href={l.href} className="block text-xs text-muted-foreground hover:text-white transition-colors">{l.label}</a>
              ))}
            </div>
          </nav>

          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Support</p>
            <div className="space-y-3">
              <a href="mailto:bidwarsupport@gmail.com" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                <Mail className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                bidwarsupport@gmail.com
              </a>
              <a href="https://wa.me/918707488250" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                <Phone className="w-3.5 h-3.5 flex-shrink-0 text-green-400" aria-hidden />
                +91 8707488250
              </a>
              <a href="https://bidwar.in" className="flex items-center gap-2 text-xs text-muted-foreground hover:text-white transition-colors">
                <Globe className="w-3.5 h-3.5 flex-shrink-0" aria-hidden />
                bidwar.in
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border/30 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} BidWar. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            BidWar is a product operated and billed by CWP DETAILER&rsquo;S AND MOTORS.
          </p>
        </div>
      </div>
    </footer>
  );
}
