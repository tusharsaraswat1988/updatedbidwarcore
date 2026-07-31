import type { ReactNode } from "react";
import { PublicNavbar } from "@/components/public-navbar";
import { PublicFooter } from "@/components/public-footer";
import { SeoHead } from "@/components/seo-head";

interface PublicWebsiteLayoutProps {
  children: ReactNode;
  /** Meta title/description/canonical for this page. Omit for pages that manage their own <head> (e.g. SEO solution pages). */
  seo?: {
    title: string;
    description: string;
    canonical: string;
    ogImage?: string;
  };
  /**
   * Long-form content (blog articles, legal policy text) should read like
   * normal prose, not shell-style uppercase display headings. Set true to
   * opt the content area out of the forced Anton/uppercase heading style.
   */
  readableContent?: boolean;
  /** Extra classes for the <main> content wrapper. */
  mainClassName?: string;
}

/**
 * Single shared shell for every public marketing page — home, blog,
 * academy, pricing, solutions, contact, and legal. Wraps children in the
 * Lovable design scope (`.lovable-home`: header, footer, background,
 * typography, colors, buttons, spacing) so navigating between pages feels
 * like one product instead of two different applications.
 *
 * The homepage itself (`lovable-home.tsx`) keeps its own inline
 * Header/Footer per the UI-freeze rule — every OTHER public page should
 * use this layout instead of duplicating chrome.
 */
export function PublicWebsiteLayout({
  children,
  seo,
  readableContent = false,
  mainClassName = "",
}: PublicWebsiteLayoutProps) {
  return (
    <>
      {seo ? <SeoHead {...seo} /> : null}
      <div className="lovable-home min-h-screen text-foreground overflow-x-hidden">
        <PublicNavbar />
        <main className={`pt-16 ${readableContent ? "content-readable" : ""} ${mainClassName}`}>
          {children}
        </main>
        <PublicFooter />
      </div>
    </>
  );
}
