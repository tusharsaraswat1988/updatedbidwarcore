import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { BookOpen, GraduationCap, Search } from "lucide-react";
import { AcademyLayout } from "@/components/academy/academy-layout";
import {
  AcademyGridSkeleton,
  FeaturedHeroSkeleton,
} from "@/components/academy/academy-skeletons";
import { FeaturedEpisodeHero } from "@/components/academy/featured-episode-hero";
import { LessonCard } from "@/components/academy/lesson-card";
import { CategoryChips } from "@/components/academy/category-chips";
import { CurriculumRoadmap } from "@/components/academy/curriculum-roadmap";
import { OrganiserToolkit } from "@/components/academy/organiser-toolkit";
import { AcademyFaq } from "@/components/academy/academy-faq";
import { DeferredMount, LazySectionFallback } from "@/components/academy/academy-perf";
import { Breadcrumbs } from "@/components/blog/breadcrumbs";
import { SeoHead } from "@/components/seo-head";
import { readAcademyProgress } from "@/lib/academy-progress";
import {
  fetchAcademyIndex,
  fetchAcademyLessons,
  filterLessonsClientSide,
  deriveCategoriesFromLessons,
  readWindowAcademyData,
  formatAcademyDate,
  type PublicAcademyIndexData,
  type PublicAcademyLessonSummary,
} from "@/lib/academy-public";

const AcademySearch = lazy(() =>
  import("@/components/academy/academy-search").then((m) => ({ default: m.AcademySearch })),
);

const CANONICAL = "https://bidwar.in/academy";
const META_TITLE = "BidWar Academy — Sports Auction Tutorials & Platform Guides";
const META_DESC =
  "Free video tutorials and step-by-step guides for running franchise league player auctions with BidWar. Learn auction setup, live bidding, and organiser workflows.";

function readCategoryFromSearch(): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("category");
}

export default function AcademyIndexPage() {
  const [location] = useLocation();
  const [data, setData] = useState<PublicAcademyIndexData | null>(() => {
    const ssr = readWindowAcademyData();
    return ssr?.page === "index" ? ssr : null;
  });
  const [lessons, setLessons] = useState<PublicAcademyLessonSummary[]>(() => data?.lessons ?? []);
  const [loading, setLoading] = useState(!data);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(() => readCategoryFromSearch());
  const [continueLesson, setContinueLesson] = useState(() => readAcademyProgress());

  const load = useCallback(async () => {
    setLoading(true);
    const index = await fetchAcademyIndex();
    if (index) {
      setData(index);
      setLessons(index.lessons);
    } else {
      const list = await fetchAcademyLessons();
      setLessons(list);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!data) load();
  }, [data, load]);

  useEffect(() => {
    setCategoryFilter(readCategoryFromSearch());
  }, [location]);

  useEffect(() => {
    setContinueLesson(readAcademyProgress());
  }, [location]);

  const handleSearchChange = useCallback((value: string) => setSearch(value), []);

  const filtered = useMemo(
    () => filterLessonsClientSide(lessons, search, categoryFilter),
    [lessons, search, categoryFilter],
  );

  const isLowVideoCount = lessons.length < 4;

  const featuredEpisode = data?.featuredLessons[0] ?? [...lessons]
    .sort((a, b) => a.displayOrder - b.displayOrder || a.episodeNumber - b.episodeNumber)[0];

  // Only compute moreFeatured and latest if there are 4 or more lessons
  const moreFeatured = !isLowVideoCount
    ? (data?.featuredLessons ?? lessons)
        .filter((lesson) => lesson.slug !== featuredEpisode?.slug)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.episodeNumber - b.episodeNumber)
        .slice(0, 2)
    : [];

  const latest = !isLowVideoCount
    ? (data?.latestLessons ?? [...lessons])
        .filter((lesson) => lesson.slug !== featuredEpisode?.slug)
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
        .slice(0, 6)
    : [];

  const categories = useMemo(
    () =>
      data?.categories?.length
        ? data.categories
        : deriveCategoriesFromLessons(lessons),
    [data?.categories, lessons],
  );
  const isFiltering = Boolean(search.trim() || categoryFilter);
  const continueTarget = continueLesson
    ? lessons.find((l) => l.slug === continueLesson.slug)
    : null;

  // Course Structured Data for SEO
  const courseSchema = {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": "BidWar Sports Auction Masterclass & Organiser Playbook",
    "description": META_DESC,
    "provider": {
      "@type": "Organization",
      "name": "BidWar",
      "sameAs": "https://bidwar.in"
    }
  };

  return (
    <AcademyLayout>
      <SeoHead title={META_TITLE} description={META_DESC} canonical={CANONICAL} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(courseSchema) }}
      />

      <section className="relative py-16 px-6 border-b border-border/30 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/8 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 right-0 w-[300px] h-[200px] bg-primary/5 rounded-full blur-[80px]" />
        </div>
        <div className="relative max-w-3xl mx-auto text-center space-y-4">
          <Breadcrumbs crumbs={[{ label: "Academy" }]} />
          <div className="flex items-center justify-center gap-2 mb-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="text-xs font-bold uppercase tracking-widest text-primary">BidWar Academy</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight">
            Your Learning Hub for Live <span className="text-primary">Sports Auctions</span>
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed">
            Video walkthroughs, auctioneer guides, and organiser playbooks — from tournament setup to stage projector execution.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-16">
        <DeferredMount minHeight="2.75rem" fallback={<LazySectionFallback className="h-11 max-w-xl" />}>
          <Suspense fallback={<LazySectionFallback className="h-11 max-w-xl" />}>
            <AcademySearch value={search} onChange={handleSearchChange} />
          </Suspense>
        </DeferredMount>

        <DeferredMount minHeight="8rem">
          {!loading && continueTarget && !isFiltering && (
            <section className="rounded-2xl border border-border bg-card/30 p-6 md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-primary mb-2">Continue Learning</p>
                  <h2 className="text-lg font-bold text-foreground">{continueTarget.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Episode {continueTarget.episodeNumber}
                    {continueLesson?.updatedAt ? ` · Last opened ${formatAcademyDate(continueLesson.updatedAt)}` : ""}
                  </p>
                </div>
                <Link
                  href={`/academy/${continueTarget.slug}`}
                  className="inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
                >
                  <BookOpen className="h-4 w-4" />
                  Resume Lesson
                </Link>
              </div>
            </section>
          )}
        </DeferredMount>

        {/* Filtered Search Results View */}
        {isFiltering ? (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground">
                Search Results ({filtered.length})
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategoryFilter(null);
                  window.history.replaceState({}, "", "/academy");
                }}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Clear all filters
              </button>
            </div>

            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/20 px-6 py-16 text-center space-y-3">
                <Search className="mx-auto h-10 w-10 text-muted-foreground/50" />
                <h3 className="text-base font-bold text-foreground">No lessons found</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  No tutorials match your search query. Try another keyword or explore the full curriculum below.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategoryFilter(null);
                    window.history.replaceState({}, "", "/academy");
                  }}
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"
                >
                  Reset Search
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((lesson) => (
                  <LessonCard key={lesson.id} lesson={lesson} />
                ))}
              </div>
            )}
          </section>
        ) : (
          /* Normal View (Not Filtering) */
          <>
            {/* Spotlight Masterclass */}
            {loading ? (
              <FeaturedHeroSkeleton />
            ) : featuredEpisode ? (
              <section className="space-y-6">
                <FeaturedEpisodeHero lesson={featuredEpisode} />
                {moreFeatured.length > 0 && (
                  <div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                      More Featured Tutorials
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {moreFeatured.map((lesson) => (
                        <LessonCard key={`featured-${lesson.id}`} lesson={lesson} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            ) : null}

            {/* Case: 2 or 3 lessons — Show a single unified "All Academy Episodes" track without duplicate Latest vs All */}
            {!loading && lessons.length >= 2 && lessons.length < 4 && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    All Academy Episodes ({lessons.length})
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[...lessons]
                    .sort((a, b) => a.episodeNumber - b.episodeNumber)
                    .map((lesson) => (
                      <LessonCard key={`series-${lesson.id}`} lesson={lesson} />
                    ))}
                </div>
              </section>
            )}

            {/* Case: 4 or more lessons — Full directory with Latest and All */}
            {!loading && lessons.length >= 4 && (
              <>
                <DeferredMount minHeight="4rem">
                  <CategoryChips categories={categories} activeSlug={categoryFilter} />
                </DeferredMount>

                {latest.length > 0 && (
                  <DeferredMount minHeight="12rem">
                    <section>
                      <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                        Latest Releases
                      </h2>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {latest.map((lesson) => (
                          <LessonCard key={`latest-${lesson.id}`} lesson={lesson} />
                        ))}
                      </div>
                    </section>
                  </DeferredMount>
                )}

                <DeferredMount minHeight="16rem">
                  <section>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
                      All Tutorials ({lessons.length})
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {lessons.map((lesson) => (
                        <LessonCard key={`all-${lesson.id}`} lesson={lesson} />
                      ))}
                    </div>
                  </section>
                </DeferredMount>
              </>
            )}

            {/* Curriculum Roadmap — Always displayed, fills the gap when < 4 videos exist! */}
            <DeferredMount minHeight="16rem">
              <CurriculumRoadmap />
            </DeferredMount>

            {/* Tournament Organiser Toolkit — Practical Value for Organisers */}
            <DeferredMount minHeight="16rem">
              <OrganiserToolkit />
            </DeferredMount>

            {/* Organiser FAQs — SEO and Conversion Trust */}
            <DeferredMount minHeight="16rem">
              <AcademyFaq />
            </DeferredMount>
          </>
        )}
      </div>
    </AcademyLayout>
  );
}
