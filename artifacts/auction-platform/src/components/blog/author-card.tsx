import { Link } from "wouter";
import { Twitter, Linkedin } from "lucide-react";
import { type BlogAuthor } from "@workspace/blog-data";

interface AuthorCardProps {
  author: BlogAuthor;
  postCount?: number;
  compact?: boolean;
}

export function AuthorCard({ author, postCount, compact = false }: AuthorCardProps) {
  if (compact) {
    return (
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0 ${author.avatarColor}`}>
          {author.avatarInitials}
        </div>
        <div>
          <Link
            href={`/blog/author/${author.slug}`}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            {author.name}
          </Link>
          <p className="text-xs text-muted-foreground">{author.role}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/30 p-6">
      <div className="flex items-start gap-4">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold text-black shrink-0 ${author.avatarColor}`}>
          {author.avatarInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <Link
                href={`/blog/author/${author.slug}`}
                className="text-base font-bold text-foreground hover:text-primary transition-colors"
              >
                {author.name}
              </Link>
              <p className="text-xs text-muted-foreground">{author.role}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {author.twitterHandle && (
                <span className="text-xs text-muted-foreground">{author.twitterHandle}</span>
              )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{author.bio}</p>

          {(author.twitterHandle || author.linkedinUrl || postCount !== undefined) && (
            <div className="flex items-center gap-4 mt-3">
              {postCount !== undefined && (
                <span className="text-xs text-muted-foreground">
                  {postCount} {postCount === 1 ? "article" : "articles"}
                </span>
              )}
              {author.twitterHandle && (
                <a
                  href={`https://twitter.com/${author.twitterHandle.replace("@", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Twitter className="h-3 w-3" />
                  Twitter
                </a>
              )}
              {author.linkedinUrl && (
                <a
                  href={author.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
