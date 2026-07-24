import { ProductShowcase } from "@/components/product-showcase";

/**
 * Three Surfaces — semantic wrapper around ProductShowcase.
 * Phase 2: set PRODUCT_SHOWCASE_SURFACES[].media.thumbnail / fullImage
 * to replace mock UI with real screenshots (no component edits).
 */
export function ThreeSurfaces() {
  return (
    <section id="surfaces" aria-label="Product surfaces">
      <ProductShowcase />
    </section>
  );
}
