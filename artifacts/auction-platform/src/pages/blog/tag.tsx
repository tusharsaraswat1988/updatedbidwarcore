import { useLocation, Link } from "wouter";
import { BlogLayout } from "../../components/blog/blog-layout.tsx";
import { ArticleCard } from "../../components/blog/article-card.tsx";
import { Breadcrumbs } from "../../components/blog/breadcrumbs.tsx";
import { BlogListingSchema } from "../../components/blog/blog-schema.tsx";
import {
  BLOG_TAGS,
  getTagBySlug,
  getPostsByTag,
  BLOG_POSTS,
} from "../../data/blog-content.ts";

interface TagPageProps {
  slug: string;
}

export default function TagPage({ slug }: TagPageProps) {
  const [, navigate] = useLocation();
  const tag = getTagBySlug(slug);

  if (!tag) {
    navigate("/blog");
    return null;
  }

  const posts = getPostsByTag(slug);
  const canonicalUrl = `https://www.bidwar.in/blog/tag/${slug}`;

  return (
    <BlogLayout>
      <BlogListingSchema
        name={`${tag.name} Articles — BidWar Blog`}
        description={`Sports auction articles tagged with "${tag.name}" on the BidWar Blog.`}
        url={canonicalUrl}
        posts={posts}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="relative py-14 px-6 border-b border-border/30">
        <div className="relative max-w-3xl mx-auto space-y-4">
          <Breadcrumbs
            crumbs={[
              { label: "Blog", href: "/blog" },
              { label: `#${tag.name}` },
            ]}
          />
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Tag</span>
          </div>
          <h1 className="text-2xl md:text-4xl font-black text-foreground">
            #{tag.name}
          </h1>
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
              <ArticleCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            No articles with this tag yet.
          </div>
        )}

        {/* ── All tags cloud ────────────────────────────────────────────────── */}
        <div className="mt-16 pt-10 border-t border-border/30">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Browse All Tags</p>
          <div className="flex flex-wrap gap-2">
            {BLOG_TAGS.map((t) => {
              const count = BLOG_POSTS.filter((p) => p.tags.includes(t.slug)).length;
              if (count === 0) return null;
              return (
                <Link
                  key={t.slug}
                  href={`/blog/tag/${t.slug}`}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                    t.slug === slug
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  }`}
                >
                  #{t.name} <span className="opacity-60">({count})</span>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    </BlogLayout>
  );
}
