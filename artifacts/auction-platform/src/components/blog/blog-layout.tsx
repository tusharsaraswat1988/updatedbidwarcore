import { PublicWebsiteLayout } from "@/components/public-website-layout";

interface BlogLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared nav + footer wrapper for all blog pages. Uses the same public
 * website shell as the homepage (header, footer, colors, typography) so
 * the blog feels like part of the same product, not a separate site.
 * Article body copy stays readable (no forced uppercase display font).
 */
export function BlogLayout({ children }: BlogLayoutProps) {
  return (
    <PublicWebsiteLayout readableContent>
      {children}
    </PublicWebsiteLayout>
  );
}
