import { useLocation } from "wouter";
import { Calendar, Clock, Tag } from "lucide-react";
import { Link } from "wouter";
import { BlogLayout } from "../../components/blog/blog-layout.tsx";
import { ArticleContent } from "../../components/blog/article-content.tsx";
import { ArticleCard } from "../../components/blog/article-card.tsx";
import { AuthorCard } from "../../components/blog/author-card.tsx";
import { Breadcrumbs } from "../../components/blog/breadcrumbs.tsx";
import { TableOfContents } from "../../components/blog/table-of-contents.tsx";
import { ArticleSchema } from "../../components/blog/blog-schema.tsx";
import {
  getPostBySlug,
  getRelatedPostsFull,
  getCategoryBySlug,
  getAuthorBySlug,
  getTagBySlug,
} from "../../data/blog-content.ts";

interface ArticlePageProps {
  slug: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function ArticlePage({ slug }: ArticlePageProps) {
  const [, navigate] = useLocation();
  const post = getPostBySlug(slug);

  if (!post) {
    navigate("/blog");
    return null;
  }

  const category = getCategoryBySlug(post.category);
  const author   = getAuthorBySlug(post.author);
  const related  = getRelatedPostsFull(slug, 3);

  return (
    <BlogLayout>
      <ArticleSchema post={post} />

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
        <Breadcrumbs
          crumbs={[
            { label: "Blog", href: "/blog" },
            ...(category ? [{ label: category.name, href: `/blog/category/${category.slug}` }] : []),
            { label: post.title },
          ]}
        />

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10 items-start">

          {/* ── Article body ──────────────────────────────────────────────── */}
          <article>
            {/* Category + meta */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {category && (
                <Link
                  href={`/blog/category/${category.slug}`}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-opacity hover:opacity-80 ${category.color} ${category.bgColor}`}
                >
                  {category.name}
                </Link>
              )}
              {post.featured && (
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-yellow-400 bg-yellow-400/10">
                  Featured
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-4xl font-black text-foreground leading-tight mb-5">
              {post.title}
            </h1>

            {/* Author + meta row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-8 pb-8 border-b border-border/30">
              {author && <AuthorCard author={author} compact />}
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(post.publishedAt)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {post.readingTimeMinutes} min read
              </span>
            </div>

            {/* Table of contents — mobile only */}
            <div className="lg:hidden mb-8">
              <TableOfContents items={post.tableOfContents} />
            </div>

            {/* Body */}
            <ArticleContent blocks={post.content} />

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="mt-10 pt-6 border-t border-border/30">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  {post.tags.map((tagSlug) => {
                    const tag = getTagBySlug(tagSlug);
                    return (
                      <Link
                        key={tagSlug}
                        href={`/blog/tag/${tagSlug}`}
                        className="text-xs font-medium px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
                      >
                        {tag?.name ?? tagSlug}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Author bio */}
            {author && (
              <div className="mt-8">
                <AuthorCard
                  author={author}
                  postCount={undefined}
                />
              </div>
            )}

            {/* CTA */}
            <div className="mt-10 rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">Ready to run your auction?</p>
              <p className="text-xs text-muted-foreground mb-4">
                Start free with 2 teams — no payment required.
              </p>
              <a
                href="/organizer?tab=signup"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-all"
              >
                Start Free Trial
              </a>
            </div>

            {/* Related articles */}
            {related.length > 0 && (
              <section className="mt-12 pt-10 border-t border-border">
                <h2 className="text-xl font-bold text-foreground mb-6">Related Articles</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {related.map((rel) => (
                    <ArticleCard key={rel.slug} post={rel} />
                  ))}
                </div>
              </section>
            )}
          </article>

          {/* ── Sidebar (desktop) ─────────────────────────────────────────── */}
          <aside className="hidden lg:block sticky top-24 space-y-6">
            <TableOfContents items={post.tableOfContents} />

            {/* CTA sidebar */}
            <div className="rounded-xl border border-border bg-card/20 p-4 text-center">
              <p className="text-sm font-bold text-foreground mb-1">Try BidWar Free</p>
              <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                Run your first auction with up to 2 teams at no cost.
              </p>
              <a
                href="/organizer?tab=signup"
                className="block w-full py-2 rounded-lg bg-primary text-black text-xs font-bold hover:bg-primary/90 transition-all"
              >
                Get Started
              </a>
            </div>

            {/* Tags */}
            {post.tags.length > 0 && (
              <div className="rounded-xl border border-border bg-card/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.map((tagSlug) => {
                    const tag = getTagBySlug(tagSlug);
                    return (
                      <Link
                        key={tagSlug}
                        href={`/blog/tag/${tagSlug}`}
                        className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                      >
                        {tag?.name ?? tagSlug}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

        </div>
      </div>
    </BlogLayout>
  );
}
