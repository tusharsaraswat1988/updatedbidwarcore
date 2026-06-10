import { Link } from "wouter";
import { Clock, Calendar } from "lucide-react";
import {
  type BlogPost,
  getCategoryBySlug,
  getAuthorBySlug,
} from "../../data/blog-content.ts";

interface ArticleCardProps {
  post: BlogPost;
  featured?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ArticleCard({ post, featured = false }: ArticleCardProps) {
  const category = getCategoryBySlug(post.category);
  const author   = getAuthorBySlug(post.author);

  if (featured) {
    return (
      <Link
        href={`/blog/${post.slug}`}
        className="group block rounded-2xl border border-border bg-card/30 hover:bg-card/50 hover:border-primary/40 transition-all duration-300 overflow-hidden"
      >
        <div className="p-6 md:p-8 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-4">
            {category && (
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${category.color} ${category.bgColor}`}>
                {category.name}
              </span>
            )}
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full text-yellow-400 bg-yellow-400/10">
              Featured
            </span>
          </div>

          <h2 className="text-xl md:text-2xl font-bold text-foreground mb-3 group-hover:text-primary transition-colors leading-tight">
            {post.title}
          </h2>

          <p className="text-muted-foreground text-sm leading-relaxed mb-5 flex-1">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {author && (
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0 ${author.avatarColor}`}>
                    {author.avatarInitials}
                  </div>
                  <span>{author.name}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {post.readingTimeMinutes} min read
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(post.publishedAt)}
              </span>
            </div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group block rounded-xl border border-border bg-card/20 hover:bg-card/40 hover:border-primary/30 transition-all duration-300 overflow-hidden"
    >
      <div className="p-5 flex flex-col h-full">
        {category && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full self-start mb-3 ${category.color} ${category.bgColor}`}>
            {category.name}
          </span>
        )}

        <h3 className="text-base font-semibold text-foreground mb-2 group-hover:text-primary transition-colors leading-snug line-clamp-2">
          {post.title}
        </h3>

        <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-1 line-clamp-2">
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {author && (
            <div className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0 ${author.avatarColor}`}>
                {author.avatarInitials[0]}
              </div>
              <span>{author.name}</span>
            </div>
          )}
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {post.readingTimeMinutes} min
          </span>
        </div>
      </div>
    </Link>
  );
}
