import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useLocation } from "wouter";
import { BookOpen, ChevronDown, GraduationCap, Menu, X } from "lucide-react";
import { usePublicBranding } from "@/lib/initial-data/use-public-branding";
import { getBrandLogoAlt, getPublicBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { BrandLogoImage } from "@/components/brand-logo-image";
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
  const { colors, brandName, iconVersion } = usePublicBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSolutionsOpen, setMobileSolutionsOpen] = useState(false);
  const headerLogoSrc = getPublicBrandLogoSrc(landingHeaderPreset.logoOrder, iconVersion);
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
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-stage/85 backdrop-blur-md">
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

          <div className="hidden lg:flex flex-1 items-center justify-center gap-6 text-sm text-muted-foreground">
            <a href="/#features" onClick={(e) => onSectionClick("features", e)} className="hover:text-foreground transition-colors">Features</a>
            <div className="relative group">
              <a
                href="/#solutions"
                onClick={(e) => onSectionClick("solutions", e)}
                className={`inline-flex items-center gap-1 transition-colors ${isSolutionsPath ? "text-foreground" : "hover:text-foreground"}`}
                aria-haspopup="true"
              >
                Solutions <ChevronDown className="w-3.5 h-3.5" />
              </a>
              <div className="invisible absolute left-1/2 top-full z-40 mt-2 w-[520px] -translate-x-1/2 translate-y-2 rounded-md border border-white/10 bg-stage p-3 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">By Sport</div>
                    <div className="space-y-0.5">
                      {SOLUTION_SPORT_LINKS.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                            path === link.href
                              ? "bg-white/5 text-foreground"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          }`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">Platform</div>
                    <div className="space-y-0.5">
                      {SOLUTION_PLATFORM_LINKS.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          className={`block rounded-md px-2 py-1.5 text-[13px] transition-colors ${
                            path === link.href
                              ? "bg-white/5 text-foreground"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          }`}
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="pt-2 mt-2 border-t border-white/10">
                  <a
                    href="/#solutions"
                    onClick={(e) => onSectionClick("solutions", e)}
                    className="block rounded-md px-2 py-1.5 text-[13px] font-medium text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                  >
                    View all solutions →
                  </a>
                </div>
              </div>
            </div>
            <a
              href="/pricing"
              onClick={(e) => { if (isHome) onSectionClick("pricing", e); }}
              className={`transition-colors ${isPricingPath ? "text-foreground" : "hover:text-foreground"}`}
            >
              Pricing
            </a>
            <a
              href="/academy"
              className={`inline-flex items-center gap-1 transition-colors ${isAcademyPath ? "text-foreground" : "hover:text-foreground"}`}
            >
              <GraduationCap className="w-3.5 h-3.5" /> Academy
            </a>
            <div className="relative group">
              <a href="/blog" className={`inline-flex items-center gap-1 transition-colors ${isBlogPath ? "text-foreground" : "hover:text-foreground"}`}>
                <BookOpen className="w-3.5 h-3.5" /> Blog <ChevronDown className="w-3.5 h-3.5" />
              </a>
              {!isAcademyPath && navBlogPosts.length > 0 ? (
              <div className="invisible absolute left-1/2 top-full z-40 mt-2 w-[360px] -translate-x-1/2 translate-y-2 rounded-md border border-white/10 bg-stage p-2 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">Top Blog Pages</div>
                <div className="space-y-0.5">
                  {navBlogPosts.map((post) => (
                    <a
                      key={post.slug}
                      href={`/blog/${post.slug}`}
                      className="block rounded-md px-2 py-1.5 text-[13px] leading-snug text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                    >
                      {post.title}
                    </a>
                  ))}
                </div>
                <div className="pt-1 mt-1 border-t border-white/10">
                  <a href="/blog" className="block rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors">
                    More Articles
                  </a>
                </div>
              </div>
              ) : null}
            </div>
            <div className="relative group">
              <button className={`inline-flex items-center gap-1 transition-colors ${isMorePath ? "text-foreground" : "hover:text-foreground"}`} type="button" aria-label="Open more navigation links">
                More <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <div className="invisible absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 translate-y-2 rounded-md border border-white/10 bg-stage p-2 opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100">
                {MORE_NAV_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={(e) => {
                      if ("sectionId" in link && link.sectionId) {
                        onSectionClick(link.sectionId, e);
                      }
                    }}
                    className="block rounded-md px-2 py-2 text-[13px] text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 ml-auto lg:pl-2">
            <button
              onClick={() => navigate("/organizer")}
              className="ghost-button ghost-button-hover hidden rounded-md px-4 py-2 text-xs lg:inline-block"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate("/organizer?tab=signup")}
              className="gold-button gold-button-hover rounded-md px-4 py-2 text-xs"
              style={colors.primary ? { background: colors.primary } : undefined}
            >
              Get Started
            </button>
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="ghost-button lg:hidden rounded-md p-2"
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
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-200"
              aria-label="Close mobile navigation"
            />
            <div className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[86vw] max-w-sm bg-stage shadow-2xl border-l border-white/10 p-6 pt-20 overflow-y-auto animate-in slide-in-from-right duration-200">
              <div className="space-y-2">
                {[
                  { label: "Features", href: "/#features", action: () => { if (isHome) document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }); } },
                  { label: "Use Cases", href: "/#solutions", action: () => { if (isHome) document.getElementById("solutions")?.scrollIntoView({ behavior: "smooth" }); } },
                ].map((item) => (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => {
                      item.action?.();
                      closeMobileMenu();
                    }}
                    className="block w-full text-left px-3 py-3 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-white/5"
                  >
                    {item.label}
                  </a>
                ))}

                <div className="rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setMobileSolutionsOpen((prev) => !prev)}
                    className={`flex w-full items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isSolutionsPath ? "bg-white/5 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                    aria-expanded={mobileSolutionsOpen}
                  >
                    Solutions
                    <ChevronDown className={`w-4 h-4 transition-transform ${mobileSolutionsOpen ? "rotate-180" : ""}`} />
                  </button>
                  {mobileSolutionsOpen ? (
                    <div className="px-2 pb-2 space-y-3">
                      <div>
                        <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">By Sport</p>
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
                        <p className="px-2 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">Platform</p>
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
                  { label: "Pricing", href: "/pricing" },
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
                      || (item.label === "Pricing" && isPricingPath)
                      || (item.label === "Academy" && isAcademyPath)
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
              <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 gap-3">
                <button
                  onClick={() => { closeMobileMenu(); navigate("/organizer"); }}
                  className="ghost-button w-full rounded-lg px-4 py-3 text-sm"
                >
                  Sign In
                </button>
                <button
                  onClick={() => { closeMobileMenu(); navigate("/organizer?tab=signup"); }}
                  className="gold-button w-full rounded-lg px-4 py-3 text-sm"
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
