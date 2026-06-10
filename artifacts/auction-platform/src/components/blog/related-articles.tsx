import { Link } from "wouter";
import { Clock, ArrowRight } from "lucide-react";
import { type BlogPost, getCategoryBySlug } from "../../data/blog-content.ts";

interface RelatedArticlesProps {
  posts: BlogPost[];
}

export function RelatedArticles({ posts }: RelatedArticlesProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-12 pt-10 border-t border-border">
      <h2 className="text-xl font-bold text-foreground mb-6">Related Articles</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => {
          const category = getCategoryBySlug(post.category);
          return (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col gap-3 p-4 rounded-xl border border-border bg-card/20 hover:bg-card/40 hover:border-primary/30 transition-all duration-300"
            >
              {category && (
                <span className={`text-xs font-semibold self-start px-2 py-0.5 rounded-full ${category.color} ${category.bgColor}`}>
                  {category.name}
                </span>
              )}
              <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">
                {post.title}
              </h3>
              <div className="flex items-center justify-between mt-auto text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {post.readingTimeMinutes} min read
                </span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
