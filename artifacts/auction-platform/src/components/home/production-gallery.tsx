import {
  PRODUCTION_GALLERY_ITEMS,
  GALLERY_CATEGORY_LABEL,
  type ProductionGalleryItem,
  type GalleryCategory,
} from "@/data/homepage-content";
import { HomepageMedia } from "@/components/home/homepage-media";

const SIZE_WRAPPER: Record<ProductionGalleryItem["size"], string> = {
  hero: "md:col-span-2 md:row-span-2 aspect-[16/10]",
  medium: "aspect-[4/3]",
  small: "aspect-square",
};

function GalleryTile({ item }: { item: ProductionGalleryItem }) {
  return (
    <article className={`group relative overflow-hidden rounded-2xl border border-border ${SIZE_WRAPPER[item.size]}`}>
      <HomepageMedia
        media={item.media}
        aspectClassName="absolute inset-0 !aspect-auto h-full w-full rounded-none border-0"
        hoverZoom
        showPlayButton={Boolean(item.media.videoUrl)}
        decorativePlay={Boolean(item.media.videoUrl)}
        analyticsId={`gallery_item_${item.id}`}
        className="absolute inset-0 h-full w-full rounded-none border-0"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-background/10 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-3">
        <p className="font-display font-bold text-sm text-foreground leading-tight">{item.title}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{item.description}</p>
      </div>
      <span className="absolute right-2 top-2 rounded-sm bg-background/70 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-primary">
        {GALLERY_CATEGORY_LABEL[item.category]}
      </span>
    </article>
  );
}

/**
 * Production Gallery — data-driven masonry grid.
 * Categories are typed (`GalleryCategory`) so filter chips can be added later
 * without changing tile logic — filter by `item.category` only.
 */
export function ProductionGallery({
  items = PRODUCTION_GALLERY_ITEMS,
  /** Reserved for Phase 2 filter chips — unused until chips ship. */
  activeCategory,
}: {
  items?: readonly ProductionGalleryItem[];
  activeCategory?: GalleryCategory | "all";
}) {
  const visible =
    !activeCategory || activeCategory === "all"
      ? items
      : items.filter((item) => item.category === activeCategory);

  return (
    <section id="production-gallery" aria-labelledby="production-gallery-heading" className="py-24 px-6 border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-primary text-xs font-bold uppercase tracking-widest">Production Gallery</div>
            <h2 id="production-gallery-heading" className="text-3xl md:text-4xl font-display font-black mt-2">
              On the floor. Season 3.
            </h2>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {visible.map((item) => (
            <GalleryTile key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
