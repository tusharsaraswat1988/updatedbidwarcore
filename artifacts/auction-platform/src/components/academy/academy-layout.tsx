import { PublicWebsiteLayout } from "@/components/public-website-layout";

interface AcademyLayoutProps {
  children: React.ReactNode;
}

/**
 * Shared nav + footer wrapper for all Academy pages. Uses the same public
 * website shell as the homepage (header, footer, colors, typography) so
 * the Academy feels like part of the same product, not a separate site.
 * Lesson body copy stays readable (no forced uppercase display font).
 */
export function AcademyLayout({ children }: AcademyLayoutProps) {
  return (
    <PublicWebsiteLayout readableContent>
      {children}
    </PublicWebsiteLayout>
  );
}
