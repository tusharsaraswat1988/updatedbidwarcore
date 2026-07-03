import { memo } from "react";
import { Link } from "wouter";
import type { PublicAcademyLessonNav } from "@/lib/academy-public";

interface RelatedLessonsProps {
  lessons: PublicAcademyLessonNav[];
}

export const RelatedLessons = memo(function RelatedLessons({ lessons }: RelatedLessonsProps) {
  if (lessons.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
        Related Lessons
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lessons.map((nav) => (
          <Link
            key={nav.slug}
            href={`/academy/${nav.slug}`}
            className="rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
          >
            <p className="text-xs text-primary font-semibold">Episode {nav.episodeNumber}</p>
            <p className="mt-1 font-semibold text-foreground">{nav.title}</p>
          </Link>
        ))}
      </div>
    </section>
  );
});
