import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { BookOpen, ChevronDown, GraduationCap, Menu, X } from "lucide-react";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import { getBrandLogoAlt, getBrandWordmarkSrc, getPublicBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { BrandLogoImage } from "@/components/brand-logo-image";
import { PublicAuthCta } from "@/components/public-auth-cta";
import {
  MORE_NAV_LINKS,
  SOLUTION_PLATFORM_LINKS,
  SOLUTION_SPORT_LINKS,
} from "@/lib/public-site-links";

const landingHeaderPreset = getBrandSurfacePreset("landing-header");

type NavBlogPost = { slug: string; title: string; publishedAt: string };

const ALL_SOLUTION_HREFS = new Set<string>([
  ...SOLUTION_SPORT_LINKS.map((l) => l.href),
  ...SOLUTION_PLATFORM_LINKS.map((l) => l.href),
]);

/**
 * Shared public-site header. Renders inside the `.lovable-home` design
 * scope (see PublicWebsiteLayout) so it inherits the same dark/gold tokens
 * and utility classes (panel, gold-button, ghost-button) as the homepage.
 */
export function PublicNavbar() {
  const [path, navigate] = useLocation();
  const { colors, brandName, iconVersion, logos } = usePublicBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const headerLogoSrc = useMemo(() => {
    const adminWordmark = getBrandWordmarkSrc(logos, landingHeaderPreset.logoOrder);
    return adminWordmark || getPublicBrandLogoSrc(landingHeaderPreset.logoOrder, iconVersion);
  }, [logos, iconVersion]);
  const logoAlt = getBrandLogoAlt(brandName);

  const isHome = useMemo(() => path === "/", [path]);
  const isBlogPath = useMemo(() => path === "/blog" || path.startsWith("/blog/"), [path]);
  const isPricingPath = useMemo(() => path === "/pricing", [path]);
  const isUpcomingPath = useMemo(() => path === "/upcoming-auctions", [path]);
  const isContactPath = useMemo(() => path === "/contact", [path]);
  const isAuctionTipsPath = useMemo(() => path === "/auction-tips", [path]);
  const isAcademyPath = useMemo(() => path === "/academy" || path.startsWith("/academy/"), [path]);
  const isSolutionsPath = useMemo(() => ALL_SOLUTION_HREFS.has(path), [path]);
  const [navBlogPosts, setNavBlogPosts] = useState<NavBlogPost[]>([]);
  const isMorePath = useMemo(
    () => isUpcomingPath || isContactPath || isAuctionTipsPath || path.startsWith("/legal/"),
    [isUpcomingPath, isContactPath, isAuctionTipsPath, path],
  );

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
    setMobileSolutionsOpen(false);
  }, []);

  const onSectionClick = useCallback(
    (sectionId: string, event?: MouseEvent<HTMLAnchorElement>) => {
      const targetId =
        sectionId === "surfaces" || sectionId === "features"
          ? "auction-screens"
          : sectionId === "tournaments" || sectionId === "cases"
            ? "tournament-galleries"
            : sectionId;

      if (!isHome) {
        closeMobileMenu();
        return;
      }
      event?.preventDefault();
      const el = document.getElementById(targetId) || document.getElementById(sectionId);
      if (el) {
        const yOffset = -95;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: "smooth" });
      }
      closeMobileMenu();
    },
    [isHome, closeMobileMenu],
  );

  useEffect(() => {
    if (isAcademyPath || navBlogPosts.length > 0) return;
    let cancelled = false;
    void import("@workspace/blog-data").then((mod) => {
      if (cancelled) return;
      setNavBlogPosts(
        [...mod.BLOG_POSTS_META]
          .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
          .slice(0, 9),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [isAcademyPath, navBlogPosts.length]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-stage/90 backdrop-blur-md">
        <div className="h-16 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <a href="/" className="flex items-center shrink-0 mr-4 xl:mr-6 2xl:mr-8" aria-label="BidWar Home">
            <BrandLogoImage
              src={headerLogoSrc}
              alt={logoAlt}
              className={`block max-w-none translate-y-[2px] ${landingHeaderPreset.sizeClass}`}
              width={168}
              height={40}
              loading="eager"
            />
          </a>

          <div className="hidden xl:flex items-center gap-1 xl:gap-2 2xl:gap-3.5 text-[13px] font-medium text-muted-foreground">
            <a
              href="/#auction-screens"
              onClick={(e) => onSectionClick("auction-screens", e)}
              className="px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Auction Screens
            </a>
            <a
              href="/#experience-bidding"
              onClick={(e) => onSectionClick("experience-bidding", e)}
              className="px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Experience Bidding
            </a>
            <a
              href="/#tournament-galleries"
              onClick={(e) => onSectionClick("tournament-galleries", e)}
              className="px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              Tournament Galleries
            </a>

            <a
              href="/academy"
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap ${isAcademyPath ? "text-foreground bg-white/5" : ""}`}
            >
              <span>Academy</span>
              <span className="rounded bg-primary/20 px-1.5 py-0.5 font-mono text-[9px] text-primary font-bold">
                VIDEOS
              </span>
            </a>

            <a
              href="/pricing"
              onClick={(e) => { if (isHome) onSectionClick("pricing", e); }}
              className={`px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap ${isPricingPath ? "text-foreground bg-white/5" : ""}`}
            >
              Pricing
            </a>

            {/* More / Solutions Mega Dropdown */}
            <div className="relative group">
              <button
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:text-foreground hover:bg-white/5 transition-colors whitespace-nowrap ${
                  isMorePath || isSolutionsPath ? "text-foreground bg-white/5" : ""
                }`}
                type="button"
                aria-label="Open more and solutions navigation menu"
              >
                More <ChevronDown className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
              <div className="invisible absolute right-0 top-full z-40 mt-2 w-[620px] rounded-xl border border-white/10 bg-stage/95 backdrop-blur-xl p-4 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="grid grid-cols-3 gap-4">
                  {/* Column 1: By Sport */}
                  <div>
                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">By Sport</div>
                    <div className="space-y-0.5 mt-1">
                      {SOLUTION_SPORT_LINKS.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                            path === link.href
                              ? "bg-white/5 text-foreground font-medium"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          }`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Column 2: Platform */}
                  <div>
                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Platform</div>
                    <div className="space-y-0.5 mt-1">
                      {SOLUTION_PLATFORM_LINKS.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                            path === link.href
                              ? "bg-white/5 text-foreground font-medium"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          }`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Column 3: Resources */}
                  <div>
                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Resources</div>
                    <div className="space-y-0.5 mt-1">
                      {MORE_NAV_LINKS.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          onClick={(e) => {
                            if ("sectionId" in link && link.sectionId) {
                              onSectionClick(link.sectionId, e);
                            }
                          }}
                          className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                            path === link.href
                              ? "bg-white/5 text-foreground font-medium"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          }`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-xs text-muted-foreground px-1">
                  <a
                    href="/#solutions"
                    onClick={(e) => onSectionClick("solutions", e)}
                    className="hover:text-primary transition font-medium"
                  >
                    View all solutions →
                  </a>
                  <a href="/contact" className="hover:text-primary transition">
                    Custom tournament setup? Contact us →
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-auto xl:ml-4">
            <a
              href="https://bpl.bidwar.in/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 sm:gap-1.5 rounded-full border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/20 px-2 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-bold uppercase tracking-wider text-amber-300 shadow-sm transition hover:border-amber-400 hover:bg-amber-400/25 hover:text-white whitespace-nowrap"
            >
              <span className="text-amber-400">🏏</span>
              <span className="hidden 2xl:inline">BPL Team Registration</span>
              <span className="hidden sm:inline 2xl:hidden">BPL Registration</span>
              <span className="inline sm:hidden">BPL</span>
            </a>
            <PublicAuthCta
              variant="navbar"
              primaryColor={colors.primary || undefined}
            />
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="ghost-button xl:hidden rounded-md p-2"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {mobileMenuOpen ? (
          <>
            <button
              type="button"
              onClick={closeMobileMenu}
              className="xl:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200"
              aria-label="Close mobile navigation"
            />
            <div className="xl:hidden fixed top-0 right-0 bottom-0 z-50 w-[86vw] max-w-sm bg-stage shadow-2xl border-l border-white/10 p-6 pt-20 overflow-y-auto animate-in slide-in-from-right duration-200 flex flex-col justify-between">
              <div className="space-y-1.5">
                <div className="mb-4">
                  <PublicAuthCta
                    variant="drawer"
                    onBeforeNavigate={closeMobileMenu}
                    primaryColor={colors.primary || undefined}
                  />
                </div>

                <a
                  href="https://bpl.bidwar.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={closeMobileMenu}
                  className="mb-3 flex items-center justify-center gap-2 rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-yellow-500/20 px-4 py-3 text-sm font-bold uppercase tracking-wider text-amber-300 transition hover:bg-amber-400/30 hover:text-white"
                >
                  <span>🏏</span>
                  <span>BPL Team Registration</span>
                </a>

                {[
                  { label: "Auction Screens", href: "/#auction-screens", sectionId: "auction-screens" },
                  { label: "Experience Bidding", href: "/#experience-bidding", sectionId: "experience-bidding" },
                  { label: "Tournament Galleries", href: "/#tournament-galleries", sectionId: "tournament-galleries" },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => {
                      onSectionClick(item.sectionId, e);
                    }}
                    className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-white/5"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMobileSolutionsOpen((prev) => !prev)}
                    className={`flex w-full items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isSolutionsPath ? "bg-white/5 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    aria-expanded={mobileSolutionsOpen}
                  >
                    Solutions by Sport
                    <ChevronDown className={`w-4 h-4 transition-transform ${mobileSolutionsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileSolutionsOpen ? (
                    <div className="px-2 pb-2 space-y-3">
                      <div>
                        <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">By Sport</p>
                        {SOLUTION_SPORT_LINKS.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            onClick={closeMobileMenu}
                            className={`block rounded-md px-2 py-2 text-sm transition-colors ${
                              path === link.href
                                ? "bg-white/5 text-foreground"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            }`}
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                      <div>
                        <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground font-mono">Platform</p>
                        {SOLUTION_PLATFORM_LINKS.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            onClick={closeMobileMenu}
                            className={`block rounded-md px-2 py-2 text-sm transition-colors ${
                              path === link.href
                                ? "bg-white/5 text-foreground"
                                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                            }`}
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                      <a
                        href="/#solutions"
                        onClick={(e) => onSectionClick("solutions", e)}
                        className="block rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      >
                        View all solutions →
                      </a>
                    </div>
                  ) : null}
                </div>

                {[
                  { label: "Academy (Video Hub)", href: "/academy" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Blog", href: "/blog" },
                  { label: "Organizer Reviews", href: "/#reviews", sectionId: "reviews" },
                  { label: "Tournament Calculator", href: "/#calculator", sectionId: "calculator" },
                  { label: "Upcoming Auctions", href: "/upcoming-auctions" },
                  { label: "Auction Tips", href: "/auction-tips" },
                  { label: "Contact Us", href: "/contact" },
                  { label: "FAQs", href: "/#faq", sectionId: "faq" },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={(e) => {
                      if ("sectionId" in item && item.sectionId) {
                        onSectionClick(item.sectionId, e);
                      } else {
                        closeMobileMenu();
                      }
                    }}
                    className={`block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      (item.label === "Blog" && isBlogPath)
                      || (item.label === "Pricing" && isPricingPath)
                      || (item.label.startsWith("Academy") && isAcademyPath)
                      || (item.label === "Upcoming Auctions" && isUpcomingPath)
                      || (item.label === "Contact Us" && isContactPath)
                      || (item.label === "Auction Tips" && isAuctionTipsPath)
                        ? "bg-white/5 text-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-white/10">
                <PublicAuthCta
                  variant="drawer"
                  onBeforeNavigate={closeMobileMenu}
                  primaryColor={colors.primary || undefined}
                />
              </div>
            </div>
          </>
      ) : null}
    </>
  );
}
