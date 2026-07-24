# Homepage Content Guide

How to update BidWar marketing homepage copy and Phase 2 assets **without hunting through React components**.

Primary data file:

`artifacts/auction-platform/src/data/homepage-content.ts`

Page composition:

`artifacts/auction-platform/src/pages/landing.tsx`

Reusable media frame:

`artifacts/auction-platform/src/components/home/homepage-media.tsx`

---

## Section → data / component map

| Section ID | Component | Content source |
|---|---|---|
| `#hero` | `HeroSection` | Inline copy in component (CTAs wired from `landing.tsx`) |
| `#academy` | `AcademySection` | `ACADEMY_VIDEOS` |
| `#upcoming` | `UpcomingAuctionsStrip` | Live API via `displayAuctions` in `landing.tsx` |
| `#trust` | `TrustStrip` | `TRUST_STRIP_ITEMS` |
| `#numbers` | `NumbersSection` | `NUMBERS_STATS` |
| `#surfaces` | `ThreeSurfaces` → `ProductShowcase` | `PRODUCT_SHOWCASE_SURFACES` — set `media.thumbnail`/`fullImage` to replace mock UI |
| `#features` | `FeatureDeck` | `FEATURE_DECK_ITEMS` in `feature-deck.tsx` |
| `#ecosystem` | `BroadcastEcosystem` | `BROADCAST_ECOSYSTEM_SPOKES` |
| `#sports` | `SportsSection` | `SPORTS_SECTION_ITEMS` in `sports-section.tsx` |
| `#benefits` | `BenefitsSection` | `BENEFITS_ITEMS` in `benefits-section.tsx` |
| `#case-study` | `FeaturedTournament` | `FEATURED_TOURNAMENTS` (add new tournaments as array entries only) |
| `#gallery` | `EventsGallery` | Showcase API + `DEFAULT_GALLERY_ITEMS` in `homepage-content.ts` |
| `#production-gallery` | `ProductionGallery` | `PRODUCTION_GALLERY_ITEMS` |
| `#how-it-works` | `HowItWorks` | `HOW_IT_WORKS_STEPS` in `how-it-works.tsx` |
| `#timeline` | `Timeline` | `TIMELINE_STEPS` |
| `#pricing` | `PricingSection` | `PRICING_TIERS` in `pricing-section.tsx` |
| `#faq` | `FaqSection` | `HOMEPAGE_FAQS` in `faq-section.tsx` |
| `#contact` | `DemoRequest` | Form UI in `demo-request.tsx` |
| `#solutions` | `SolutionsHub` | `SOLUTIONS` in `solutions-hub.tsx` |
| `#resources` | `ResourcesSection` | Blog slugs in `resources-section.tsx` |
| `#final-cta` | `FinalCta` | Inline copy |
| `#about` | `AboutSection` | Inline copy |

---

## Media model (Phase 2 drop-in)

Every placeholder uses `HomepageMediaAsset`:

```ts
{
  aspectRatio: "video" | "square" | "4/3" | "16/10" | `${number}/${number}`;
  caption: string;
  alt: string;
  thumbnail: string | null;   // card / preview
  fullImage: string | null;   // lightbox / detail later
  videoUrl: string | null;    // Featured Tournament, Academy, Gallery
}
```

**Phase 2 rule:** fill `thumbnail` / `fullImage` / `videoUrl` only. Do not change layout classes.

### Featured Tournament

Edit `FEATURED_TOURNAMENTS[].media` and `.cta`.

### Production Gallery

Edit `PRODUCTION_GALLERY_ITEMS[]`.

Categories (for future filter chips — do not rename):

`led` · `operator` · `audience` · `owners` · `obs` · `stage` · `trophy` · `registration`

`ProductionGallery` already accepts `activeCategory` — chips can call it without changing tile logic.

### Academy

Edit `ACADEMY_VIDEOS[].media` (`thumbnail` + `videoUrl`).

---

## Analytics IDs (`data-analytics`)

Prepared on CTAs — **not wired to a vendor yet**.

| ID | Location |
|---|---|
| `hero_start_trial` | Hero primary CTA |
| `hero_operator_login` | Hero secondary CTA |
| `academy_enter` | Academy banner CTA |
| `academy_video_{id}` | Academy video cards |
| `case_study_tab_{id}` | Case study tabs |
| `case_study_play_{id}` | Case study play |
| `case_study_{id}_cta` | Case study CTA link |
| `gallery_item_{id}` | Production gallery tiles |
| `pricing_{plan}` | Pricing cards (`pricing_pro`, etc.) |
| `contact_demo` | Contact / demo WhatsApp submit |
| `final_cta_create_account` | Final CTA primary |
| `final_cta_whatsapp` | Final CTA WhatsApp |
| `whatsapp_float` | Floating WhatsApp button |

Reserved for a future hero demo video CTA: `hero_watch_demo`.

---

## CLS / performance notes

- All media frames reserve height via CSS `aspect-ratio` (or size wrappers on gallery tiles).
- Images use `OptimizedImage` with lazy loading, `decoding="async"`, Cloudinary `f_auto` (WebP/AVIF), and responsive `srcSet` when on Cloudinary.
- `fetchpriority="high"` is reserved for LCP / priority media only (`HomepageMedia` `priority` prop).
- Below-the-fold sections are `React.lazy` code-split from `landing.tsx`; above-the-fold stays eager (Hero, Trust, Numbers, Upcoming).
- Static sections no longer import `framer-motion` — interactive islands only (FAQ toggle, case-study tabs, product tabs, carousel, forms).

### Product Showcase Phase 2

Edit `PRODUCT_SHOWCASE_SURFACES[].media`. When `thumbnail` or `fullImage` is set, the mock UI for that tab is replaced automatically.

### Case studies (multi-tournament)

Add/remove entries in `FEATURED_TOURNAMENTS` only — VNBL, RICL, Corporate, Football, Kabaddi, etc. Tabs render from the array.

---

## Quick Phase 2 checklist (VNBL 3.0)

1. Upload assets to Cloudinary (or CDN).
2. Paste URLs into `homepage-content.ts` media fields.
3. Set `alt` / `caption` to real descriptions.
4. Optionally set `FEATURED_TOURNAMENTS[0].media.videoUrl`.
5. Smoke-test `#case-study`, `#production-gallery`, `#academy`, `#surfaces`.
6. No component rewrites required if aspect ratios match the reserved frames.
