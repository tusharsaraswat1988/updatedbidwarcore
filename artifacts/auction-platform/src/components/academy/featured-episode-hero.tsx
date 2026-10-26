import { memo, useState } from "react";
import { Link } from "wouter";
import { Calendar, Clock, Play, Sparkles, CheckCircle2 } from "lucide-react";
import {
  formatAcademyDate,
  formatDuration,
  type PublicAcademyLessonSummary,
} from "@/lib/academy-public";

interface FeaturedEpisodeHeroProps {
  lesson: PublicAcademyLessonSummary;
}

function resolveInitialThumbnail(lesson: PublicAcademyLessonSummary): string | null {
  if (lesson.thumbnailUrl?.trim()) return lesson.thumbnailUrl.trim();
  if (lesson.youtubeVideoId?.trim()) {
    return `https://img.youtube.com/vi/${lesson.youtubeVideoId.trim()}/maxresdefault.jpg`;
  }
  return null;
}

export const FeaturedEpisodeHero = memo(function FeaturedEpisodeHero({
  lesson,
}: FeaturedEpisodeHeroProps) {
  const [thumbSrc, setThumbSrc] = useState<string | null>(() => resolveInitialThumbnail(lesson));

  const fallbackThumb = lesson.youtubeVideoId
    ? `https://img.youtube.com/vi/${lesson.youtubeVideoId}/hqdefault.jpg`
    : null;

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card/50 to-card/20 shadow-xl">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.12),transparent_55%)]" />
      <div className="relative grid gap-6 p-4 sm:p-6 lg:p-8 lg:grid-cols-12 items-center">
        {/* 16:9 Video Thumbnail Frame — Strictly Preserved Ratio */}
        <div className="lg:col-span-7">
          <Link
            href={`/academy/${lesson.slug}`}
            className="group relative block aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-black/80 shadow-2xl transition-all hover:border-primary/50"
            aria-label={`Watch tutorial: ${lesson.title}`}
          >
            {thumbSrc ? (
              <img
                src={thumbSrc}
                alt={lesson.title}
                width={1280}
                height={720}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onError={() => {
                  if (fallbackThumb && thumbSrc !== fallbackThumb) {
                    setThumbSrc(fallbackThumb);
                  }
                }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-muted/20">
                <span className="text-5xl font-black text-primary/30">Ep {lesson.episodeNumber}</span>
              </div>
            )}

            {/* Ambient Dark Scrim & Hover Glow */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />

            {/* Episode Badge on Frame */}
            <div className="absolute top-3 left-3 rounded-full bg-black/75 backdrop-blur-md px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300 border border-amber-500/30">
              Episode {lesson.episodeNumber}
            </div>

            {/* Center Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl transition-transform duration-300 group-hover:scale-110 group-active:scale-95 animate-[pulse_3s_ease-in-out_infinite]">
                <Play className="ml-1 h-7 w-7" fill="currentColor" />
              </span>
            </div>
          </Link>
        </div>

        {/* Video Information Column */}
        <div className="lg:col-span-5 flex flex-col justify-center space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <Sparkles className="h-4 w-4" />
            Spotlight Masterclass
          </div>

          <h2 className="text-2xl sm:text-3xl font-black leading-tight text-foreground tracking-tight">
            {lesson.title}
          </h2>

          {lesson.shortDescription && (
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {lesson.shortDescription}
            </p>
          )}

          {/* Key Value Pill Tags */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            {lesson.categoryName && (
              <span className="rounded-full bg-primary/15 px-3 py-1 font-semibold text-primary border border-primary/20">
                {lesson.categoryName}
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-3 py-1 text-muted-foreground font-medium">
              <Clock className="h-3.5 w-3.5 text-primary" />
              {formatDuration(lesson.durationMinutes)}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-3 py-1 text-muted-foreground font-medium">
              <Calendar className="h-3.5 w-3.5" />
              {formatAcademyDate(lesson.publishedAt)}
            </span>
            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold px-2 py-0.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Step-by-Step
            </span>
          </div>

          {/* Watch CTA Button */}
          <div className="pt-2">
            <Link
              href={`/academy/${lesson.slug}`}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Play className="h-4 w-4" fill="currentColor" />
              Watch Tutorial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
});
