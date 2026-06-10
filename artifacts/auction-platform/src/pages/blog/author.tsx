import { useLocation } from "wouter";
import { BlogLayout } from "../../components/blog/blog-layout.tsx";
import { ArticleCard } from "../../components/blog/article-card.tsx";
import { AuthorCard } from "../../components/blog/author-card.tsx";
import { Breadcrumbs } from "../../components/blog/breadcrumbs.tsx";
import { BlogListingSchema } from "../../components/blog/blog-schema.tsx";
import {
  BLOG_AUTHORS,
  getAuthorBySlug,
  getPostsByAuthor,
} from "../../data/blog-content.ts";
import { Link } from "wouter";

interface AuthorPageProps {
  slug: string;
}

export default function AuthorPage({ slug }: AuthorPageProps) {
  const [, navigate] = useLocation();
  const author = getAuthorBySlug(slug);

  if (!author) {
    navigate("/blog");
    return null;
  }

  const posts = getPostsByAuthor(slug);
  const canonicalUrl = `https://www.bidwar.in/blog/author/${slug}`;

  const authorSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: `${author.name} — BidWar Blog`,
    url: canonicalUrl,
    mainEntity: {
      "@type": "Person",
      name: author.name,
      description: author.bio,
      url: canonicalUrl,
      ...(author.twitterHandle
        ? { sameAs: [`https://twitter.com/${author.twitterHandle.replace("@", "")}`] }
        : {}),
    },
  };

  return (
    <BlogLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }}
      />
      <BlogListingSchema
        name={`Articles by ${author.name} — BidWar Blog`}
        description={author.bio}
        url={canonicalUrl}
        posts={posts}
      />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <section className="relative py-14 px-6 border-b border-border/30">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[200px] bg-primary/5 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto space-y-6">
          <Breadcrumbs
            crumbs={[
              { label: "Blog", href: "/blog" },
              { label: author.name },
            ]}
          />
          <AuthorCard author={author} postCount={posts.length} />
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* ── Articles ─────────────────────────────────────────────────────── */}
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">
          Articles by {author.name}
        </p>
        {posts.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <ArticleCard key={post.slug} post={post} featured={!!post.featured} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            No articles yet.
          </div>
        )}

        {/* ── Other authors ────────────────────────────────────────────────── */}
        {BLOG_AUTHORS.filter((a) => a.slug !== slug).length > 0 && (
          <div className="mt-16 pt-10 border-t border-border/30">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-6">Other Authors</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {BLOG_AUTHORS.filter((a) => a.slug !== slug).map((a) => (
                <Link key={a.slug} href={`/blog/author/${a.slug}`} className="block hover:opacity-90 transition-opacity">
                  <AuthorCard author={a} />
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </BlogLayout>
  );
}
