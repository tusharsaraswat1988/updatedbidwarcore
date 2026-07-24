import { GraduationCap, Play } from "lucide-react";
import { ACADEMY_VIDEOS, type AcademyVideo } from "@/data/homepage-content";
import { HomepageMedia } from "@/components/home/homepage-media";

function VideoCard({ video }: { video: AcademyVideo }) {
  const href = video.media.videoUrl ?? "/academy";
  return (
    <a
      href={href}
      data-analytics={`academy_video_${video.id}`}
      className="group block"
    >
      <HomepageMedia
        media={video.media}
        hoverZoom
        showPlayButton
        decorativePlay
        badge={video.tag}
        duration={video.duration}
        className="rounded-xl"
      />
      <p className="mt-1.5 font-display text-[11px] font-bold leading-tight text-foreground line-clamp-2 px-0.5">
        {video.title}
      </p>
    </a>
  );
}

/**
 * Academy — promo banner + tutorial video grid.
 * Cards support thumbnail + videoUrl via HomepageMediaAsset.
 */
export function AcademySection({ videos = ACADEMY_VIDEOS }: { videos?: readonly AcademyVideo[] }) {
  return (
    <section id="academy" aria-labelledby="academy-heading" className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card/30 to-card/10 p-6 md:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
                  <GraduationCap className="w-6 h-6 text-primary" aria-hidden />
                </div>
                <div className="text-primary text-xs font-bold uppercase tracking-widest">BidWar Academy</div>
              </div>
              <h2 id="academy-heading" className="text-2xl md:text-4xl font-display font-black leading-tight">
                Never run an auction before? We&rsquo;ve got the tape.
              </h2>
              <p className="mt-4 max-w-xl text-sm md:text-base text-muted-foreground leading-relaxed">
                Step-by-step video tutorials for organizers, operators and team owners — how to set purses, run
                RTM, handle unsold rounds, wire your LED, and go live on stream without breaking a sweat.
              </p>
              <a
                href="/academy"
                data-analytics="academy_enter"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-display font-black text-sm text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden />
                Explore BidWar Academy
              </a>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {videos.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
