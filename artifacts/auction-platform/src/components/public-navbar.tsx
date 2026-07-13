import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { BookOpen, ChevronDown, GraduationCap, Menu, X } from "lucide-react";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import { getBrandLogoAlt, getPublicBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { BrandLogoImage } from "@/components/brand-logo-image";

const landingHeaderPreset = getBrandSurfacePreset("landing-header");

type NavBlogPost = { slug: string; title: string; publishedAt: string };

const SOLUTION_SPORT_LINKS = [
  { label: "Cricket Auction", href: "/cricket-auction-software" },
  { label: "Football Auction", href: "/football-player-auction" },
  { label: "Kabaddi Auction", href: "/kabaddi-auction-platform" },
  { label: "Basketball Auction", href: "/basketball-auction-software" },
  { label: "Badminton Auction", href: "/badminton-auction-platform" },
  { label: "Volleyball Auction", href: "/volleyball-player-auction" },
  { label: "Esports Auction", href: "/esports-auction-system" },
  { label: "Business League", href: "/business-league-auction" },
] as const;

const SOLUTION_PLATFORM_LINKS = [
  { label: "Sports Auction Software", href: "/sports-auction-software" },
  { label: "Franchise Auction", href: "/franchise-auction-software" },
  { label: "Player Auction", href: "/player-auction-software" },
  { label: "League Management", href: "/sports-league-management-software" },
  { label: "Badminton Scoring", href: "/badminton-scoring-software" },
  { label: "Live Player Bidding", href: "/live-player-bidding" },
  { label: "Tournament Platform", href: "/tournament-auction-platform" },
] as const;

const ALL_SOLUTION_HREFS = new Set<string>([
  ...SOLUTION_SPORT_LINKS.map((l) => l.href),
  ...SOLUTION_PLATFORM_LINKS.map((l) => l.href),
]);

export function PublicNavbar() {
  const [path, navigate] = useLocation();
  const { colors, brandName, iconVersion } = usePublicBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const headerLogoSrc = getPublicBrandLogoSrc(landingHeaderPreset.logoOrder, iconVersion);
  const logoAlt = getBrandLogoAlt(brandName);

  const isHome = useMemo(() => path === "/", [path]);
  const isBlogPath = useMemo(() => path === "/blog" || path.startsWith("/blog/"), [path]);
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
    (sectionId: string, event: MouseEvent<HTMLAnchorElement>) => {
      if (!isHome) {
        closeMobileMenu();
        return;
      }
      event.preventDefault();
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
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
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
        <div className="h-16 w-full px-3 sm:px-6 lg:px-8 flex items-center gap-3">
          <a href="/" className="h-full flex items-center flex-shrink-0 pr-1">
            <BrandLogoImage
              src={headerLogoSrc}
              alt={logoAlt}
              className={`block max-w-none translate-y-[2px] ${landingHeaderPreset.sizeClass}`}
              width={168}
              height={40}
              loading="eager"
            />
          </a>

          <div className="hidden lg:flex flex-1 items-center justify-center gap-6 text-sm text-slate-600">
            <a href="/#features" onClick={(e) => onSectionClick("features", e)} className="hover:text-slate-950 transition-colors">Features</a>
            <div className="relative group">
              <a
                href="/#solutions"
                onClick={(e) => onSectionClick("solutions", e)}
                className={`inline-flex items-center gap-1 transition-colors ${isSolutionsPath ? "text-slate-950" : "hover:text-slate-950"}`}
                aria-haspopup="true"
              >
                Solutions <ChevronDown className="w-3.5 h-3.5" />
              </a>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[520px] rounded-xl border border-slate-200 bg-white shadow-xl p-3 opacity-0 invisible translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-slate-500">By Sport</div>
                    <div className="space-y-0.5">
                      {SOLUTION_SPORT_LINKS.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                            path === link.href
                              ? "bg-slate-100 text-slate-950"
                              : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                          }`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-slate-500">Platform</div>
                    <div className="space-y-0.5">
                      {SOLUTION_PLATFORM_LINKS.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                            path === link.href
                              ? "bg-slate-100 text-slate-950"
                              : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                          }`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pt-2 mt-2 border-t border-slate-200">
                  <a
                    href="/#solutions"
                    onClick={(e) => onSectionClick("solutions", e)}
                    className="block rounded-md px-2 py-1.5 text-[13px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors"
                  >
                    View all solutions →
                  </a>
                </div>
              </div>
            </div>
            <a href="/#pricing" onClick={(e) => onSectionClick("pricing", e)} className="hover:text-slate-950 transition-colors">Pricing</a>
            <a
              href="/academy"
              className={`inline-flex items-center gap-1 transition-colors ${isAcademyPath ? "text-slate-950" : "hover:text-slate-950"}`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Academy
            </a>
            <div className="relative group">
              <a href="/blog" className={`inline-flex items-center gap-1 transition-colors ${isBlogPath ? "text-slate-950" : "hover:text-slate-950"}`}>
                <BookOpen className="w-3.5 h-3.5" /> Blog <ChevronDown className="w-3.5 h-3.5" />
              </a>
              {!isAcademyPath && navBlogPosts.length > 0 ? (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[360px] rounded-xl border border-slate-200 bg-white shadow-xl p-2 opacity-0 invisible translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0">
                <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-slate-500">Top Blog Pages</div>
                <div className="space-y-0.5">
                  {navBlogPosts.map((post) => (
                    <a
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="block rounded-md px-2 py-1.5 text-[13px] leading-snug text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors"
                    >
                      {post.title}
                    </a>
                  ))}
                </div>
                <div className="pt-1 mt-1 border-t border-slate-200">
                  <a href="/blog" className="block rounded-md px-2 py-1.5 text-[13px] text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors">
                    More Articles
                  </a>
                </div>
              </div>
              ) : null}
            </div>
            <div className="relative group">
              <button className={`inline-flex items-center gap-1 transition-colors ${isMorePath ? "text-slate-950" : "hover:text-slate-950"}`} type="button" aria-label="Open more navigation links">
                More <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-xl p-2 opacity-0 invisible translate-y-2 transition-all duration-200 group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:visible group-focus-within:translate-y-0">
                <a href="/#use-cases" onClick={(e) => onSectionClick("use-cases", e)} className="block rounded-md px-2 py-2 text-[13px] text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors">Use Cases</a>
                <a href="/#faq" onClick={(e) => onSectionClick("faq", e)} className="block rounded-md px-2 py-2 text-[13px] text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors">FAQs</a>
                <a href="/upcoming-auctions" className={`block rounded-md px-2 py-2 text-[13px] transition-colors ${isUpcomingPath ? "bg-slate-100 text-slate-950" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}>Upcoming Auctions</a>
                <a href="/contact" className={`block rounded-md px-2 py-2 text-[13px] transition-colors ${isContactPath ? "bg-slate-100 text-slate-950" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}>Contact Us</a>
                <a href="/auction-tips" className={`block rounded-md px-2 py-2 text-[13px] transition-colors ${isAuctionTipsPath ? "bg-slate-100 text-slate-950" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}>Auction Tips</a>
                <a href="/academy" className={`block rounded-md px-2 py-2 text-[13px] transition-colors ${isAcademyPath ? "bg-slate-100 text-slate-950" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}>Academy</a>
              </div>
            </div>
            <a href="/#pricing" onClick={(e) => onSectionClick("pricing", e)} className="text-slate-700 hover:text-slate-950 transition-colors">Pay</a>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto lg:pl-2">
            <button
              onClick={() => navigate("/organizer")}
              className="text-sm text-slate-600 hover:text-slate-950 transition-colors hidden lg:block"
            >
              Sign In
            </button>
            <button
              onClick={() => navigate("/organizer?tab=signup")}
              className="inline-flex px-3 py-2 sm:px-4 rounded-lg text-black text-sm font-medium transition-colors"
              style={{ backgroundColor: colors.primary }}
            >
              Get Started
            </button>
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg border border-slate-300 text-slate-700 hover:text-slate-950 hover:border-slate-400 transition-colors"
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
              className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] animate-in fade-in duration-200"
              aria-label="Close mobile navigation"
            />
            <div className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[86vw] max-w-sm bg-white shadow-2xl border-l border-slate-200 p-6 pt-20 overflow-y-auto animate-in slide-in-from-right duration-200">
              <div className="space-y-2">
                {[
                  { label: "Features", href: "/#features", action: () => { if (isHome) document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); } },
                  { label: "Use Cases", href: "/#use-cases", action: () => { if (isHome) document.getElementById("use-cases")?.scrollIntoView({ behavior: "smooth" }); } },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => {
                      item.action?.();
                      closeMobileMenu();
                    }}
                    className="block w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMobileSolutionsOpen((prev) => !prev)}
                    className={`flex w-full items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isSolutionsPath ? "bg-slate-100 text-slate-950" : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                    }`}
                    aria-expanded={mobileSolutionsOpen}
                  >
                    Solutions
                    <ChevronDown className={`w-4 h-4 transition-transform ${mobileSolutionsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileSolutionsOpen ? (
                    <div className="px-2 pb-2 space-y-3">
                      <div>
                        <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-slate-500">By Sport</p>
                        {SOLUTION_SPORT_LINKS.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            onClick={closeMobileMenu}
                            className={`block rounded-md px-2 py-2 text-sm transition-colors ${
                              path === link.href
                                ? "bg-slate-100 text-slate-950"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                            }`}
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                      <div>
                        <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-slate-500">Platform</p>
                        {SOLUTION_PLATFORM_LINKS.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            onClick={closeMobileMenu}
                            className={`block rounded-md px-2 py-2 text-sm transition-colors ${
                              path === link.href
                                ? "bg-slate-100 text-slate-950"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                            }`}
                          >
                            {link.label}
                          </a>
                        ))}
                      </div>
                      <a
                        href="/#solutions"
                        onClick={(e) => onSectionClick("solutions", e)}
                        className="block rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                      >
                        View all solutions →
                      </a>
                    </div>
                  ) : null}
                </div>

                {[
                  { label: "Pricing", href: "/#pricing", action: () => { if (isHome) document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }); } },
                  { label: "Pay", href: "/#pricing", action: () => { if (isHome) document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" }); } },
                  { label: "FAQ", href: "/#faq", action: () => { if (isHome) document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" }); } },
                  { label: "Academy", href: "/academy" },
                  { label: "Auction Tips", href: "/auction-tips" },
                  { label: "Blog", href: "/blog" },
                  { label: "Upcoming Auctions", href: "/upcoming-auctions" },
                  { label: "Contact Us", href: "/contact" },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => {
                      item.action?.();
                      closeMobileMenu();
                    }}
                    className={`block w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      (item.label === "Blog" && isBlogPath)
                      || (item.label === "Academy" && isAcademyPath)
                      || (item.label === "Upcoming Auctions" && isUpcomingPath)
                      || (item.label === "Contact Us" && isContactPath)
                      || (item.label === "Auction Tips" && isAuctionTipsPath)
                        ? "bg-slate-100 text-slate-950"
                        : "text-slate-700 hover:text-slate-950 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 gap-3">
                <button
                  onClick={() => { closeMobileMenu(); navigate("/organizer"); }}
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 text-slate-800 text-sm font-semibold hover:bg-slate-100 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { closeMobileMenu(); navigate("/organizer?tab=signup"); }}
                  className="w-full px-4 py-3 rounded-lg text-black text-sm font-semibold transition-colors"
                  style={{ backgroundColor: colors.primary }}
                >
                  Get Started
                </button>
              </div>
            </div>
          </>
      ) : null}
    </>
  );
}
