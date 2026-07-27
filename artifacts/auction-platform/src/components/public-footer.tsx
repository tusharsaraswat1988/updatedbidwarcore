import { Instagram, Facebook, Youtube, Mail, Phone, Globe } from "lucide-react";
import { getBrandLogoAlt, getPublicBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import { BrandLogoImage } from "@/components/brand-logo-image";
import { LEGAL_LINKS, SITE_CONTACT, SITE_SOCIAL, waMeUrl } from "@/lib/public-site-links";

const landingFooterPreset = getBrandSurfacePreset("landing-footer");

type FooterItem = { label: string; href?: string };

const FOOTER_COLUMNS: Array<{ h: string; items: FooterItem[] }> = [
  {
    h: "Product",
    items: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/pricing" },
      { label: "LED Mode", href: "/#features" },
      { label: "Team-Owner Panel", href: "/#features" },
    ],
  },
  {
    h: "Solutions",
    items: [
      { label: "Cricket Auctions", href: "/cricket-auction-software" },
      { label: "Football Draft", href: "/football-player-auction" },
      { label: "Kabaddi Leagues", href: "/kabaddi-auction-platform" },
      { label: "Corporate Leagues", href: "/business-league-auction" },
    ],
  },
  {
    h: "Resources",
    items: [
      { label: "Academy", href: "/academy" },
      { label: "Blog", href: "/blog" },
      { label: "Upcoming Auctions", href: "/upcoming-auctions" },
      { label: "Auction Tips", href: "/auction-tips" },
    ],
  },
  {
    h: "Company",
    items: [
      { label: "Contact", href: "/contact" },
      { label: "Sign In", href: "/organizer" },
      { label: "About" },
      { label: "Careers" },
    ],
  },
];

const SOCIAL_ICONS: Record<string, typeof Instagram> = {
  Instagram: Instagram,
  Facebook: Facebook,
  YouTube: Youtube,
};

/**
 * Single shared footer for every public page (home, blog, academy, pricing,
 * solutions, contact, legal). Renders inside the `.lovable-home` scope, so
 * it inherits the same gold/dark tokens as the homepage — no duplicate
 * footer implementations across the marketing site.
 */
export function PublicFooter() {
  const { brandName, iconVersion } = usePublicBranding();
  const logoAlt = getBrandLogoAlt(brandName);

  return (
    <footer className="border-t border-white/10 bg-black/40 pt-16">
      <div className="mx-auto max-w-7xl px-5 pb-10">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_2fr]">
          <div>
            <a href="/" className="flex items-center gap-2" aria-label={`${brandName} Home`}>
              <BrandLogoImage
                src={getPublicBrandLogoSrc(landingFooterPreset.logoOrder, iconVersion)}
                alt={logoAlt}
                className="h-9 w-auto max-w-[140px]"
                width={168}
                height={40}
                loading="lazy"
              />
              <span className="font-display text-2xl tracking-wider">BidWar<span className="text-primary">.in</span></span>
            </a>
            <p className="mt-4 max-w-sm text-sm text-muted-foreground">
              India&rsquo;s auction-first platform for live sports player auctions. From street leagues
              to state finals — from auction to champion.
            </p>
            <div className="mt-6 flex gap-2">
              {SITE_SOCIAL.map((social) => {
                const Icon = SOCIAL_ICONS[social.name];
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${brandName} on ${social.name}`}
                    className="ghost-button ghost-button-hover flex h-9 w-9 items-center justify-center rounded-md"
                  >
                    {Icon ? <Icon className="h-4 w-4" aria-hidden /> : social.label}
                  </a>
                );
              })}
            </div>
            <div className="mt-6 space-y-2 text-xs text-muted-foreground">
              <a href={`mailto:${SITE_CONTACT.email}`} className="flex items-center gap-2 hover:text-foreground">
                <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden /> {SITE_CONTACT.email}
              </a>
              <a href={waMeUrl()} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-foreground">
                <Phone className="h-3.5 w-3.5 shrink-0 text-[color:var(--live)]" aria-hidden /> {SITE_CONTACT.phoneDisplay}
              </a>
              <a href={SITE_CONTACT.website} className="flex items-center gap-2 hover:text-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden /> {SITE_CONTACT.websiteLabel}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {FOOTER_COLUMNS.map((c) => (
              <div key={c.h}>
                <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">{c.h}</div>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {c.items.map((i) => (
                    <li key={i.label}>
                      {i.href ? (
                        <a href={i.href} className="hover:text-foreground">{i.label}</a>
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
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <div>© {new Date().getFullYear()} {brandName} · Made in India · Operated by {SITE_CONTACT.billingEntity}</div>
          <div className="flex gap-5">
            {LEGAL_LINKS.slice(1).map((l) => (
              <a key={l.href} href={l.href} className="hover:text-foreground">{l.label.replace(" Policy", "").replace(" & Conditions", "")}</a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
