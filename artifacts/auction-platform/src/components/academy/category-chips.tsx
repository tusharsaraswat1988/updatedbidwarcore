import { memo } from "react";
import { Link } from "wouter";
import type { PublicAcademyCategory } from "@/lib/academy-public";

interface CategoryChipsProps {
  categories: PublicAcademyCategory[];
  activeSlug: string | null;
}

export const CategoryChips = memo(function CategoryChips({
  categories,
  activeSlug,
}: CategoryChipsProps) {
  if (categories.length === 0) return null;

  return (
    <section>
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
        Browse by Category
      </h2>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/academy"
          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
            !activeSlug
              ? "border-primary text-primary bg-primary/10"
              : "border-border text-muted-foreground hover:border-primary/50"
          }`}
        >
          All topics
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/academy?category=${cat.slug}`}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              activeSlug === cat.slug
                ? "border-primary text-primary bg-primary/10"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            {cat.name} ({cat.lessonCount})
          </Link>
        ))}
      </div>
    </section>
  );
});
