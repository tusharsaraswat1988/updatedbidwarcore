import { Link } from "wouter";
import { PenLine, ArrowRight } from "lucide-react";
import { BlogLayout } from "../../components/blog/blog-layout.tsx";
import { ArticleCard } from "../../components/blog/article-card.tsx";
import { Breadcrumbs } from "../../components/blog/breadcrumbs.tsx";
import { BlogListingSchema } from "../../components/blog/blog-schema.tsx";
import {
  BLOG_POSTS,
  BLOG_CATEGORIES,
  getFeaturedPosts,
  getCategoryBySlug,
} from "../../data/blog-content.ts";

export default function BlogIndex() {
  const featured = getFeaturedPosts();
  const rest = BLOG_POSTS.filter((p) => !p.featured).slice(0, 12);

  return (
    <BlogLayout>
      <BlogListingSchema
        name="BidWar Blog — Sports Auction Guides & Tips"
        description="Practical guides, sport-specific auction formats, platform walkthroughs, and organizer tips for running franchise league player auctions with BidWar."
        url="https://www.bidwar.in/blog"
        posts={BLOG_POSTS}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative py-16 px-6 border-b border-border/30">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/6 rounded-full blur-[120px]" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center space-y-4">
          <Breadcrumbs crumbs={[{ label: "Blog" }]} />
          <div className="flex items-center justify-center gap-2 mb-2">
            <PenLine className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">BidWar Blog</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">
            Sports Auction <span className="text-primary">Guides & Tips</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Practical guides for franchise league organisers — how to run auctions, configure BidWar, stream live, and keep your players and owners engaged.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* ── Categories bar ──────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-12">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full border border-border text-muted-foreground">
            All Articles
          </span>
          {BLOG_CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/blog/category/${cat.slug}`}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:border-primary/50 transition-colors ${cat.color} ${cat.bgColor}`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* ── Featured posts ───────────────────────────────────────────────── */}
        {featured.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Featured</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {featured.map((post) => (
                <ArticleCard key={post.slug} post={post} featured />
              ))}
            </div>
          </div>
        )}

        {/* ── All articles grid ────────────────────────────────────────────── */}
        {rest.length > 0 && (
          <div>
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">All Articles</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <ArticleCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        )}

        {/* ── Categories section ───────────────────────────────────────────── */}
        <div className="mt-16 pt-12 border-t border-border/30">
          <h2 className="text-lg font-bold text-foreground mb-6">Browse by Category</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BLOG_CATEGORIES.map((cat) => {
              const count = BLOG_POSTS.filter((p) => p.category === cat.slug).length;
              return (
                <Link
                  key={cat.slug}
                  href={`/blog/category/${cat.slug}`}
                  className="group flex items-center justify-between p-4 rounded-xl border border-border bg-card/20 hover:bg-card/40 hover:border-primary/30 transition-all"
                >
                  <div>
                    <p className={`text-sm font-semibold mb-0.5 ${cat.color}`}>{cat.name}</p>
                    <p className="text-xs text-muted-foreground">{cat.description.slice(0, 60)}…</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cat.color} ${cat.bgColor}`}>
                      {count}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </BlogLayout>
  );
}
