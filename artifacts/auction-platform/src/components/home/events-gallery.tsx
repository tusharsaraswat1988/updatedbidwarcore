import { OptimizedImage } from "@/components/ui/optimized-image";

export type GalleryItem = { img: string; caption: string; tag: string; alt: string; description?: string | null };

function GalleryCard({ item }: { item: GalleryItem }) {
  return (
    <div className="relative rounded-2xl overflow-hidden border border-border group cursor-default">
      <OptimizedImage
        src={item.img}
        alt={item.alt}
        lazy
        width={600}
        height={380}
        sizes="(max-width: 768px) 100vw, 33vw"
        className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-500"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" aria-hidden />
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <div className="inline-block px-2 py-0.5 rounded-full bg-primary/20 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-wider mb-1.5">
          {item.tag}
        </div>
        <p className="font-display font-bold text-white text-sm leading-tight">{item.caption}</p>
        {item.description ? (
          <p className="text-[11px] text-white/60 mt-0.5 leading-tight line-clamp-2">{item.description}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Events Gallery — static grid (≤6) or CSS-transform carousel (>6).
 * Carousel index is owned by the page.
 */
export function EventsGallery({
  items,
  carouselIndex,
  onGoToPage,
}: {
  items: readonly GalleryItem[];
  carouselIndex: number;
  onGoToPage: (page: number) => void;
}) {
  const isCarousel = items.length > 6;
  const CARDS_PER_PAGE = 3;
  const totalPages = Math.ceil(items.length / CARDS_PER_PAGE);

  return (
    <section id="gallery" className="py-24 px-6 border-t border-border/40" aria-labelledby="events-gallery-heading">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">Auction Highlights</div>
          <h2 id="events-gallery-heading" className="text-4xl md:text-5xl font-display font-black">Events Powered by BidWar</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From school championships to professional franchise leagues — BidWar brings the auction experience to life.
          </p>
        </div>

        {isCarousel ? (
          <div className="relative">
            <div className="overflow-hidden rounded-2xl">
              <div
                className="flex transition-transform duration-500 ease-in-out"
                style={{
                  width: `${totalPages * 100}%`,
                  transform: `translateX(-${(carouselIndex * 100) / totalPages}%)`,
                }}
              >
                {Array.from({ length: totalPages }).map((_, pageIdx) => (
                  <div
                    key={pageIdx}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 px-0.5"
                    style={{ width: `${100 / totalPages}%` }}
                  >
                    {items
                      .slice(pageIdx * CARDS_PER_PAGE, pageIdx * CARDS_PER_PAGE + CARDS_PER_PAGE)
                      .map((item, i) => (
                        <GalleryCard key={`${pageIdx}-${i}`} item={item} />
                      ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 mt-8">
              {Array.from({ length: totalPages }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onGoToPage(idx)}
                  aria-label={`Go to page ${idx + 1}`}
                  className={`rounded-full transition-all duration-300 ${
                    idx === carouselIndex ? "w-6 h-2 bg-primary" : "w-2 h-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                  }`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => (
              <GalleryCard key={item.caption} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
