import { memo } from "react";
import { Link } from "wouter";
import { Calendar, Clock, Play, Sparkles } from "lucide-react";
import {
  formatAcademyDate,
  formatDuration,
  type PublicAcademyLessonSummary,
} from "@/lib/academy-public";

interface FeaturedEpisodeHeroProps {
  lesson: PublicAcademyLessonSummary;
}

function heroThumbnail(lesson: PublicAcademyLessonSummary): string | null {
  if (lesson.thumbnailUrl) return lesson.thumbnailUrl;
  if (lesson.youtubeVideoId) {
    return `https://img.youtube.com/vi/${lesson.youtubeVideoId}/mqdefault.jpg`;
  }
  return null;
}

export const FeaturedEpisodeHero = memo(function FeaturedEpisodeHero({
  lesson,
}: FeaturedEpisodeHeroProps) {
  const thumb = heroThumbnail(lesson);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/40 to-card/20">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_55%)]" />
      <div className="relative grid md:grid-cols-2">
        <Link
          href={`/academy/${lesson.slug}`}
          className="group relative block aspect-video md:aspect-auto md:min-h-[300px] overflow-hidden"
        >
          {thumb ? (
            <img
              src={thumb}
              alt={lesson.title}
              width={1280}
              height={720}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              loading="eager"
              decoding="async"
              fetchPriority="high"
            />
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center bg-muted/20">
              <span className="text-5xl font-black text-primary/30">Ep {lesson.episodeNumber}</span>
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl">
              <Play className="ml-1 h-7 w-7" fill="currentColor" />
            </span>
          </div>
        </Link>

        <div className="flex flex-col justify-center p-8 md:p-10">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-4 w-4" />
            Featured Episode
          </div>
          <p className="text-xs font-semibold text-muted-foreground">Episode {lesson.episodeNumber}</p>
          <h2 className="mt-2 text-2xl md:text-3xl font-black leading-tight text-foreground">
            {lesson.title}
          </h2>
          {lesson.shortDescription && (
            <p className="mt-3 text-sm md:text-base text-muted-foreground leading-relaxed line-clamp-3">
              {lesson.shortDescription}
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            {lesson.categoryName && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 font-semibold text-primary">
                {lesson.categoryName}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(lesson.durationMinutes)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatAcademyDate(lesson.publishedAt)}
            </span>
          </div>
          <Link
            href={`/academy/${lesson.slug}`}
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Play className="h-4 w-4" fill="currentColor" />
            Watch Tutorial
          </Link>
        </div>
      </div>
    </section>
  );
});
