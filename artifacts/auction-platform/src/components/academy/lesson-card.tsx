import { memo, useState } from "react";
import { Link } from "wouter";
import { Calendar, Clock, Play } from "lucide-react";
import {
  formatAcademyDate,
  formatDuration,
  type PublicAcademyLessonSummary,
} from "@/lib/academy-public";

interface LessonCardProps {
  lesson: PublicAcademyLessonSummary;
  featured?: boolean;
  priority?: boolean;
}

function resolveCardThumb(lesson: PublicAcademyLessonSummary): string | null {
  if (lesson.thumbnailUrl?.trim()) return lesson.thumbnailUrl.trim();
  if (lesson.youtubeVideoId?.trim()) {
    return `https://img.youtube.com/vi/${lesson.youtubeVideoId.trim()}/maxresdefault.jpg`;
  }
  return null;
}

export const LessonCard = memo(function LessonCard({
  lesson,
  featured = false,
  priority = false,
}: LessonCardProps) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(() => resolveCardThumb(lesson));

  const fallbackThumb = lesson.youtubeVideoId
    ? `https://img.youtube.com/vi/${lesson.youtubeVideoId}/hqdefault.jpg`
    : null;

  const shellClass = featured
    ? "group block rounded-2xl border border-border bg-card/30 hover:bg-card/50 hover:border-primary/40 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md"
    : "group block rounded-xl border border-border bg-card/20 hover:bg-card/40 hover:border-primary/30 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md";

  return (
    <Link href={`/academy/${lesson.slug}`} className={shellClass}>
      <div className="relative aspect-video bg-black/40 overflow-hidden">
        {thumbSrc ? (
          <img
            src={thumbSrc}
            alt={lesson.title}
            width={640}
            height={360}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            onError={() => {
              if (fallbackThumb && thumbSrc !== fallbackThumb) {
                setThumbSrc(fallbackThumb);
              }
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/10 to-transparent">
            <span className="text-4xl font-black text-primary/40">Ep {lesson.episodeNumber}</span>
          </div>
        )}
        <div className="absolute left-3 top-3 rounded-full bg-black/75 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 border border-amber-500/20 backdrop-blur-sm">
          Episode {lesson.episodeNumber}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform group-hover:scale-110">
            <Play className="h-4 w-4 ml-0.5" fill="currentColor" />
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col h-full">
        {lesson.categoryName && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full self-start mb-3 text-primary bg-primary/10">
            {lesson.categoryName}
          </span>
        )}

        <h3
          className={`font-bold text-foreground mb-2 group-hover:text-primary transition-colors leading-snug ${featured ? "text-xl" : "text-base line-clamp-2"}`}
        >
          {lesson.title}
        </h3>

        {lesson.shortDescription && (
          <p className="text-muted-foreground text-sm leading-relaxed mb-4 flex-1 line-clamp-2">
            {lesson.shortDescription}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatDuration(lesson.durationMinutes)}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatAcademyDate(lesson.publishedAt)}
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          <Play className="h-4 w-4" /> Watch Tutorial
        </span>
      </div>
    </Link>
  );
});
