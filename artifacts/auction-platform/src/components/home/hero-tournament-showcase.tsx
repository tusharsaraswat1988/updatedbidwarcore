import { useState, useEffect, useCallback } from "react";

const SLIDES = [
  {
    id: "vnbl-chhavi-gera",
    src: "/assets/evidence/vnbl-chhavi-gera-bidding.jpg",
    alt: "Chhavi Gera Live Player Bidding on Stage",
  },
  {
    id: "vnbl-team-group",
    src: "/assets/evidence/vnbl-stage-team-group.jpg",
    alt: "Tournament Committee & Franchise Owners Stage Group",
  },
  {
    id: "vnbl-top5-leaderboard",
    src: "/assets/evidence/vnbl-top5-leaderboard.jpg",
    alt: "Top 5 Sold Players Leaderboard LED Wall",
  },
  {
    id: "vnbl-womens-purse",
    src: "/assets/evidence/vnbl-womens-purse-auctioneer.jpg",
    alt: "Women's League Team Purse Wall & Live Auctioneer",
  },
];

const SLIDE_DURATION_MS = 3000;

export function HeroTournamentShowcase() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    if (SLIDES.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % SLIDES.length);
  }, []);

  useEffect(() => {
    if (SLIDES.length <= 1) return;
    const timer = setInterval(() => {
      nextSlide();
    }, SLIDE_DURATION_MS);

    return () => clearInterval(timer);
  }, [nextSlide]);

  return (
    <div className="relative w-full max-w-xl mx-auto flex items-center justify-center select-none pointer-events-none">
      {/* Subtle soft depth and ambient warmth behind the image */}
      <div className="absolute -inset-3 rounded-2xl bg-amber-500/10 blur-2xl opacity-60 -z-10" />

      {/* Clean borderless photo container with subtle soft floating shadow */}
      <div className="relative w-full aspect-[3/2] rounded-2xl overflow-hidden shadow-[0_20px_50px_-10px_rgba(0,0,0,0.65)]">
        {SLIDES.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <img
              key={slide.id}
              src={slide.src}
              alt={slide.alt}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ease-in-out ${
                isActive ? "opacity-100 z-10" : "opacity-0 z-0"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
