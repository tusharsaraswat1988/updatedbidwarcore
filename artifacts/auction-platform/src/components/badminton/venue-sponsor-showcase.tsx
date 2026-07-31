/**
 * Venue Moments → Sponsor: looping showcase
 * Title (gold) → Co-sponsors (silver) → partners in sets of 4, with fade.
 * Header stays in VenueChromeShell — this fills only the stage body.
 */

import { useEffect, useMemo, useState } from "react";
import {
  resolveSponsorPriorityType,
  type SponsorLogo,
} from "@/lib/sponsor-logo";
import {
  getSponsorLogoFilter,
  sponsorBroadcastTier,
  type SponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";
import { cn } from "@/lib/utils";

const HOLD_MS = 5_500;
const FADE_MS = 700;
const PARTNER_CHUNK = 4;

type SponsorSlide = {
  id: string;
  tier: SponsorBroadcastTier;
  heading: string;
  sponsors: SponsorLogo[];
};

function chunkSponsors(list: SponsorLogo[], size: number): SponsorLogo[][] {
  if (list.length === 0) return [];
  const out: SponsorLogo[][] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

export function buildVenueSponsorSlides(logos: SponsorLogo[]): SponsorSlide[] {
  const title: SponsorLogo[] = [];
  const co: SponsorLogo[] = [];
  const normal: SponsorLogo[] = [];

  for (const s of logos) {
    if (!s.url && !s.name?.trim()) continue;
    const tier = sponsorBroadcastTier(resolveSponsorPriorityType(s));
    if (tier === "title") title.push(s);
    else if (tier === "co_sponsor") co.push(s);
    else normal.push(s);
  }

  const slides: SponsorSlide[] = [];

  title.forEach((s, i) => {
    slides.push({
      id: `title-${i}-${s.url ?? s.name}`,
      tier: "title",
      heading: "Title Sponsor",
      sponsors: [s],
    });
  });

  chunkSponsors(co, PARTNER_CHUNK).forEach((group, i) => {
    slides.push({
      id: `co-${i}`,
      tier: "co_sponsor",
      heading: group.length > 1 ? "Co Sponsors" : "Co Sponsor",
      sponsors: group,
    });
  });

  chunkSponsors(normal, PARTNER_CHUNK).forEach((group, i) => {
    slides.push({
      id: `partner-${i}`,
      tier: "normal",
      heading: "Our Partners",
      sponsors: group,
    });
  });

  return slides;
}

function typeLabel(s: SponsorLogo, tier: SponsorBroadcastTier): string {
  const raw = s.type?.trim();
  if (raw) return raw;
  if (tier === "title") return "Title Sponsor";
  if (tier === "co_sponsor") return "Co Sponsor";
  return "Partner";
}

function SponsorCard({
  sponsor,
  tier,
  featured,
}: {
  sponsor: SponsorLogo;
  tier: SponsorBroadcastTier;
  featured?: boolean;
}) {
  return (
    <div
      className={cn(
        "venue-sponsor-card flex flex-col items-center justify-center text-center",
        tier === "title" && "venue-sponsor-card--title",
        tier === "co_sponsor" && "venue-sponsor-card--co",
        tier === "normal" && "venue-sponsor-card--normal",
        featured && "venue-sponsor-card--featured",
      )}
    >
      {sponsor.url ? (
        <img
          src={sponsor.url}
          alt={sponsor.name ?? "Sponsor"}
          className={cn(
            "w-auto object-contain",
            featured
              ? "max-h-[min(28vh,220px)] max-w-[min(70vw,520px)]"
              : "max-h-[min(14vh,120px)] max-w-[min(36vw,280px)]",
          )}
          style={{ filter: getSponsorLogoFilter(tier) }}
        />
      ) : null}
      <p
        className={cn(
          "bw-heading mt-4 uppercase leading-tight",
          featured ? "text-3xl md:text-5xl" : "text-xl md:text-2xl",
          tier === "title" && "text-[#F7DF8A]",
          tier === "co_sponsor" && "text-[#e8eef8]",
          tier === "normal" && "text-white",
        )}
      >
        {sponsor.name?.trim() || "Partner"}
      </p>
      <p
        className={cn(
          "bw-caption mt-2 uppercase tracking-[0.18em]",
          featured ? "text-sm md:text-base" : "text-xs md:text-sm",
          tier === "title" && "text-[#F7DF8A]/75",
          tier === "co_sponsor" && "text-white/55",
          tier === "normal" && "text-white/45",
        )}
      >
        {typeLabel(sponsor, tier)}
      </p>
    </div>
  );
}

export function VenueSponsorShowcase({ sponsors }: { sponsors: SponsorLogo[] }) {
  const slides = useMemo(() => buildVenueSponsorSlides(sponsors), [sponsors]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIndex(0);
    setVisible(true);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const armHold = () => {
      holdTimer = setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        fadeTimer = setTimeout(() => {
          if (cancelled) return;
          setIndex((i) => (i + 1) % slides.length);
          // Next frame so opacity-0 paints before fade-in
          requestAnimationFrame(() => {
            if (cancelled) return;
            setVisible(true);
            armHold();
          });
        }, FADE_MS);
      }, HOLD_MS);
    };

    armHold();

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
    };
  }, [slides.length]);

  if (slides.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <p className="bw-meta text-white/50 text-xl">Sponsors coming soon</p>
      </div>
    );
  }

  const slide = slides[index] ?? slides[0];
  const count = slide.sponsors.length;
  const featured = slide.tier === "title" && count === 1;

  return (
    <div className="venue-sponsor-stage flex h-full w-full min-h-0 flex-col items-stretch justify-center py-2">
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col transition-opacity ease-in-out",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        <p
          className={cn(
            "bw-label shrink-0 text-center tracking-[0.35em] mb-3 md:mb-4",
            slide.tier === "title" && "text-[#F7DF8A]",
            slide.tier === "co_sponsor" && "text-[#c8d4e4]",
            slide.tier === "normal" && "text-white/55",
          )}
        >
          {slide.heading}
        </p>

        <div
          className={cn(
            "min-h-0 flex-1 grid place-items-stretch gap-3 md:gap-4 content-center",
            featured && "grid-cols-1 max-w-4xl mx-auto w-full",
            !featured && count === 1 && "grid-cols-1 max-w-2xl mx-auto w-full",
            !featured && count === 2 && "grid-cols-2 max-w-5xl mx-auto w-full",
            !featured && count >= 3 && "grid-cols-2 max-w-6xl mx-auto w-full",
          )}
        >
          {slide.sponsors.map((s, i) => (
            <SponsorCard
              key={`${slide.id}-${s.url ?? s.name}-${i}`}
              sponsor={s}
              tier={slide.tier}
              featured={featured}
            />
          ))}
        </div>
      </div>

      {slides.length > 1 ? (
        <div className="shrink-0 flex items-center justify-center gap-2 pt-3 pb-1">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === index
                  ? s.tier === "title"
                    ? "w-6 bg-[#F7DF8A]"
                    : s.tier === "co_sponsor"
                      ? "w-6 bg-[#c8d4e4]"
                      : "w-6 bg-white/70"
                  : "w-1.5 bg-white/25",
              )}
              aria-hidden
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
