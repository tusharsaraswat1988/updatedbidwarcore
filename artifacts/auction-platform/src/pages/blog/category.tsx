import { useLocation } from "wouter";
import { BlogLayout } from "../../components/blog/blog-layout.tsx";
import { ArticleCard } from "../../components/blog/article-card.tsx";
import { Breadcrumbs } from "../../components/blog/breadcrumbs.tsx";
import { BlogListingSchema } from "../../components/blog/blog-schema.tsx";
import {
  BLOG_CATEGORIES,
  getCategoryBySlug,
  getPostsByCategory,
} from "../../data/blog-content.ts";
import { Link } from "wouter";

interface CategoryPageProps {
  slug: string;
}

export default function CategoryPage({ slug }: CategoryPageProps) {
  const [, navigate] = useLocation();
  const category = getCategoryBySlug(slug);

  if (!category) {
    navigate("/blog");
    return null;
  }

  const posts = getPostsByCategory(slug);
  const canonicalUrl = `https://www.bidwar.in/blog/category/${slug}`;

  return (
    <BlogLayout>
      <BlogListingSchema
        name={`${category.name} — BidWar Blog`}
        description={category.description}
        url={canonicalUrl}
        posts={posts}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="relative py-14 px-6 border-b border-border/30">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[250px] bg-primary/5 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto space-y-4">
          <Breadcrumbs
            crumbs={[
              { label: "Blog", href: "/blog" },
              { label: category.name },
            ]}
          />
          <span className={`inline-block text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full ${category.color} ${category.bgColor}`}>
            Category
          </span>
          <h1 className="text-2xl md:text-4xl font-black text-foreground">{category.name}</h1>
          <p className="text-muted-foreground text-base leading-relaxed max-w-xl">{category.description}</p>
          <p className="text-xs text-muted-foreground">
            {posts.length} {posts.length === 1 ? "article" : "articles"}
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Articles ─────────────────────────────────────────────────────── */}
        {posts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <ArticleCard key={post.slug} post={post} featured={!!post.featured} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            No articles in this category yet. Check back soon.
          </div>
        )}

        {/* ── Other categories ─────────────────────────────────────────────── */}
        <div className="mt-16 pt-10 border-t border-border/30">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Other Categories</p>
          <div className="flex flex-wrap gap-2">
            {BLOG_CATEGORIES.filter((c) => c.slug !== slug).map((cat) => (
              <Link
                key={cat.slug}
                href={`/blog/category/${cat.slug}`}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:border-primary/50 transition-colors ${cat.color} ${cat.bgColor}`}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>

      </div>
    </BlogLayout>
  );
}
