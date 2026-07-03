import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Calendar, Clock } from "lucide-react";
import { AcademyLayout } from "@/components/academy/academy-layout";
import { YoutubePlayer } from "@/components/academy/youtube-player";
import { RelatedLessons } from "@/components/academy/related-lessons";
import { DeferredMount, LazySectionFallback } from "@/components/academy/academy-perf";
import { Breadcrumbs } from "@/components/blog/breadcrumbs";
import { SeoHead } from "@/components/seo-head";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranding } from "@/hooks/use-branding";
import { useAcademyLessonJsonLd } from "@/hooks/use-academy-json-ld";
import { extractLessonHeadings } from "@/lib/academy-headings";
import { findContextualSiteLinks } from "@/lib/academy-internal-links";
import { saveAcademyProgress } from "@/lib/academy-progress";
import { getOrganizationLogoUrl } from "@/lib/brand-assets";
import {
  fetchAcademyLesson,
  formatAcademyDate,
  formatDuration,
  getLessonDescription,
  getLessonTitle,
  readWindowAcademyData,
  type PublicAcademyLessonDetail,
} from "@/lib/academy-public";

const LessonContent = lazy(() =>
  import("@/components/academy/lesson-content").then((m) => ({ default: m.LessonContent })),
);
const LessonTableOfContents = lazy(() =>
  import("@/components/academy/lesson-table-of-contents").then((m) => ({
    default: m.LessonTableOfContents,
  })),
);
const LessonShareBar = lazy(() =>
  import("@/components/academy/lesson-share-bar").then((m) => ({ default: m.LessonShareBar })),
);
const ReadingProgressBar = lazy(() =>
  import("@/components/academy/reading-progress-bar").then((m) => ({
    default: m.ReadingProgressBar,
  })),
);

interface AcademyLessonPageProps {
  slug: string;
}

function lessonOgImage(lesson: PublicAcademyLessonDetail): string | undefined {
  return (
    lesson.thumbnailUrl ??
    (lesson.youtubeVideoId
      ? `https://img.youtube.com/vi/${lesson.youtubeVideoId}/hqdefault.jpg`
      : undefined)
  );
}

export default function AcademyLessonPage({ slug }: AcademyLessonPageProps) {
  const [, navigate] = useLocation();
  const { iconVersion } = useBranding();
  const brandLogoUrl = getOrganizationLogoUrl(iconVersion);
  const [lesson, setLesson] = useState<PublicAcademyLessonDetail | null>(() => {
    const ssr = readWindowAcademyData();
    if (ssr?.page === "lesson" && ssr.lesson.slug === slug) return ssr.lesson;
    return null;
  });
  const [loading, setLoading] = useState(!lesson);

  useEffect(() => {
    if (lesson?.slug === slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      const row = await fetchAcademyLesson(slug);
      if (cancelled) return;
      if (!row) {
        navigate("/academy");
        return;
      }
      setLesson(row);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, navigate, lesson?.slug]);

  useEffect(() => {
    if (!lesson) return;
    saveAcademyProgress({
      slug: lesson.slug,
      title: lesson.title,
      episodeNumber: lesson.episodeNumber,
      thumbnailUrl: lesson.thumbnailUrl,
    });
  }, [lesson]);

  useAcademyLessonJsonLd(lesson, brandLogoUrl);

  const headings = useMemo(
    () => (lesson ? extractLessonHeadings(lesson.content, lesson.contentFormat) : []),
    [lesson],
  );

  if (loading && !lesson) {
    return (
      <AcademyLayout>
        <div className="max-w-4xl mx-auto px-6 py-16 space-y-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="aspect-video w-full rounded-xl" />
          <Skeleton className="h-32 w-full" />
        </div>
      </AcademyLayout>
    );
  }

  if (!lesson) return null;

  const canonical = `https://bidwar.in/academy/${lesson.slug}`;
  const metaTitle = `${getLessonTitle(lesson)} — BidWar Academy`;
  const metaDescription =
    getLessonDescription(lesson) ||
    lesson.shortDescription ||
    `Episode ${lesson.episodeNumber} tutorial from BidWar Academy.`;
  const ogImage = lessonOgImage(lesson);
  const contextualLinks = findContextualSiteLinks(lesson);

  return (
    <AcademyLayout>
      <Suspense fallback={null}>
        <ReadingProgressBar />
      </Suspense>
      <SeoHead
        title={metaTitle}
        description={metaDescription}
        canonical={canonical}
        ogTitle={lesson.title}
        ogDescription={metaDescription}
        ogImage={ogImage}
        ogType="article"
      />

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="max-w-4xl">
          <Breadcrumbs
            crumbs={[
              { label: "Academy", href: "/academy" },
              ...(lesson.categoryName && lesson.categorySlug
                ? [{ label: lesson.categoryName, href: `/academy?category=${lesson.categorySlug}` }]
                : []),
              { label: lesson.title },
            ]}
          />

          <p className="mt-6 text-xs font-bold uppercase tracking-widest text-primary">
            Episode {lesson.episodeNumber}
          </p>
          <h1 className="mt-2 text-2xl md:text-4xl font-black text-foreground leading-tight">{lesson.title}</h1>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {lesson.categoryName && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-primary font-semibold">
                {lesson.categoryName}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(lesson.durationMinutes)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatAcademyDate(lesson.publishedAt)}
            </span>
          </div>

          <div className="mt-6">
            <Suspense fallback={<LazySectionFallback className="h-10" />}>
              <LessonShareBar url={canonical} title={lesson.title} />
            </Suspense>
          </div>
        </div>

        {lesson.youtubeVideoId && (
          <div className="mt-8 max-w-4xl">
            <YoutubePlayer
              videoId={lesson.youtubeVideoId}
              title={lesson.title}
              thumbnailUrl={lesson.thumbnailUrl}
            />
          </div>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0 max-w-4xl">
            {lesson.shortDescription && (
              <p className="text-lg text-muted-foreground leading-relaxed">{lesson.shortDescription}</p>
            )}

            <section className="mt-10">
              <h2 className="text-xl font-bold text-foreground mb-4">Lesson Description</h2>
              <Suspense fallback={<LazySectionFallback className="h-40" />}>
                <LessonContent content={lesson.content} format={lesson.contentFormat} headings={headings} />
              </Suspense>
            </section>

            {lesson.topics.length > 0 && (
              <section className="mt-10">
                <h2 className="text-xl font-bold text-foreground mb-4">Topics Covered</h2>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {lesson.topics.map((topic) => (
                    <li key={topic} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      {topic}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <aside className="hidden lg:block">
            <DeferredMount minHeight="12rem">
              <Suspense fallback={<LazySectionFallback className="h-48" />}>
                <LessonTableOfContents headings={headings} />
              </Suspense>
            </DeferredMount>
          </aside>
        </div>

        <nav className="mt-12 max-w-4xl grid gap-4 sm:grid-cols-2">
          {lesson.previousLesson ? (
            <Link
              href={`/academy/${lesson.previousLesson.slug}`}
              className="group rounded-xl border border-border p-4 hover:border-primary/40 transition-colors"
            >
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Previous Lesson
              </span>
              <p className="mt-1 font-semibold group-hover:text-primary transition-colors">
                Ep {lesson.previousLesson.episodeNumber}: {lesson.previousLesson.title}
              </p>
            </Link>
          ) : (
            <div />
          )}
          {lesson.nextLesson && (
            <Link
              href={`/academy/${lesson.nextLesson.slug}`}
              className="group rounded-xl border border-border p-4 hover:border-primary/40 transition-colors sm:text-right"
            >
              <span className="text-xs text-muted-foreground flex items-center gap-1 sm:justify-end">
                Next Lesson <ArrowRight className="h-3 w-3" />
              </span>
              <p className="mt-1 font-semibold group-hover:text-primary transition-colors">
                Ep {lesson.nextLesson.episodeNumber}: {lesson.nextLesson.title}
              </p>
            </Link>
          )}
        </nav>

        <DeferredMount minHeight="10rem">
          <RelatedLessons lessons={lesson.relatedLessons} />
        </DeferredMount>

        <DeferredMount minHeight="8rem">
          {contextualLinks.length > 0 && (
            <section className="mt-14 max-w-4xl">
              <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                Keep Exploring
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {contextualLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="rounded-xl border border-border p-4 text-sm font-medium text-foreground hover:border-primary/40 hover:text-primary transition-colors"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                      {link.group === "blog" ? "Blog" : link.group === "product" ? "Product" : "BidWar"}
                    </span>
                    {link.label}
                  </a>
                ))}
              </div>
            </section>
          )}
        </DeferredMount>

        <DeferredMount minHeight="10rem">
          <section className="mt-14 max-w-4xl rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
            <h2 className="text-xl font-bold text-foreground">Create your free BidWar account</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-lg mx-auto">
              Start a tournament, invite teams, and run a live IPL-style player auction with real-time bidding and LED display.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button asChild>
                <Link href="/tournament/new">Create Free Tournament</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/academy">Browse More Lessons</Link>
              </Button>
            </div>
          </section>
        </DeferredMount>
      </div>
    </AcademyLayout>
  );
}
