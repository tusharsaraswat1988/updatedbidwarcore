import { useRef } from "react";
import { Play, Star, ShieldCheck, Quote, ChevronLeft, ChevronRight } from "lucide-react";

export type OrganizerReview = {
  id: string;
  name: string;
  role: string;
  tournament: string;
  location: string;
  sport: string;
  quote: string;
  rating: number;
  teamsCount: number;
  playersCount: number;
  duration: string;
  youtubeId?: string;
  avatarText: string;
  avatarGradient: string;
  verifiedYear: string;
};

export const ORGANIZER_REVIEWS: OrganizerReview[] = [
  {
    id: "vnbl3-apurv",
    name: "Apurv Mittal",
    role: "Founder, Vyapari Network",
    tournament: "VNBL 3.0 (Vyapari Network Badminton League)",
    location: "Varanasi, UP",
    sport: "Badminton Auction",
    quote:
      "BidWar transformed VNBL 3.0 into a stadium-grade broadcast event. Over 78 players auctioned seamlessly with live LED stage projection, and team owners loved the real-time purse calculation on mobile with zero bidding disputes.",
    rating: 5,
    teamsCount: 6,
    playersCount: 78,
    duration: "02:45",
    avatarText: "AM",
    avatarGradient: "from-amber-500 to-orange-600",
    verifiedYear: "Verified Season 3",
  },
  {
    id: "vnbl-women-swati",
    name: "Swati Mittal",
    role: "Co-Founder, Vyapari Network",
    tournament: "Vyapari Network Badminton League (Women Edition)",
    location: "Varanasi, UP",
    sport: "Badminton · Women's Edition",
    quote:
      "Managing the Women's Edition on BidWar was effortless. The automatic purse guard prevented overspending, all 6 teams stayed fully engaged through their phones, and our committee saved hours of paperwork with instant squad roster exports.",
    rating: 5,
    teamsCount: 6,
    playersCount: 78,
    duration: "02:15",
    avatarText: "SM",
    avatarGradient: "from-pink-500 to-rose-600",
    verifiedYear: "Verified 2026",
  },
  {
    id: "bpl-manish",
    name: "Manish Saraogi",
    role: "Real Estate Builder & Convener",
    tournament: "BPL 2026",
    location: "Kanpur, UP",
    sport: "Box Cricket League",
    quote:
      "Switching from manual spreadsheets to BidWar gave BPL 2026 an authentic IPL-style auction rush. 96 players auctioned across 8 franchise teams smoothly with instant countdown buzzers and total budget transparency.",
    rating: 5,
    teamsCount: 8,
    playersCount: 96,
    duration: "03:10",
    avatarText: "MS",
    avatarGradient: "from-blue-600 to-cyan-500",
    verifiedYear: "Verified 2026",
  },
  {
    id: "accl-vishal",
    name: "Vishal Mehta",
    role: "Founder, Awadh Group",
    tournament: "Awadh Corporate Cricket League - Season 2",
    location: "Lucknow, UP",
    sport: "Corporate Cricket · T20",
    quote:
      "Auctioning 350 players for 15 corporate franchises in a single day was massive. We specially invited the BidWar team from Varanasi to Lucknow to manage operations on-ground, and they executed it incredibly well. Managing complex age-wise and city-wise player categories on the live stage with real-time purse tracking was completely seamless.",
    rating: 5,
    teamsCount: 15,
    playersCount: 350,
    duration: "03:40",
    avatarText: "VM",
    avatarGradient: "from-purple-600 to-indigo-500",
    verifiedYear: "Verified Season 2",
  },
  {
    id: "apl-punit",
    name: "Mr. Punit",
    role: "President, SJMAA (St. John's Marhauli Alumni Association)",
    tournament: "Alumni Premier League (APL)",
    location: "Varanasi, UP",
    sport: "Cricket Auction",
    quote:
      "Bringing alumni batches together for the Alumni Premier League was made incredibly exciting with BidWar. 65 players auctioned across 5 teams with zero disputes, transparent purse tracking, and an authentic IPL auction feel that everyone praised.",
    rating: 5,
    teamsCount: 5,
    playersCount: 65,
    duration: "02:30",
    avatarText: "P",
    avatarGradient: "from-emerald-600 to-teal-500",
    verifiedYear: "Verified 2026",
  },
];

export function OrganizerVideoReviews({
  onPlayVideo,
}: {
  onPlayVideo: (review: OrganizerReview) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = Math.min(scrollRef.current.clientWidth * 0.8, 400);
      scrollRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <section id="reviews" className="mx-auto max-w-7xl px-5 py-16 scroll-mt-24">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-primary">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Verified Organizer Evidence & Video Feedback</span>
          </div>
          <h2 className="text-display-lg mt-2 max-w-3xl">
            Real Organizers. Real Auction Nights. Zero Hiccups.
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Previous review"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-card/60 text-foreground hover:border-primary/50 hover:bg-primary/10 transition"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Next review"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-card/60 text-foreground hover:border-primary/50 hover:bg-primary/10 transition"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-5 overflow-x-auto pb-6 pt-2 scrollbar-none snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {ORGANIZER_REVIEWS.map((r) => (
          <div
            key={r.id}
            className="panel group relative flex flex-col justify-between overflow-hidden rounded-xl border border-white/10 p-5 bg-card/40 transition hover:border-primary/40 hover:-translate-y-1 shadow-lg flex-shrink-0 w-[300px] sm:w-[350px] md:w-[380px] snap-start"
          >
            <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-full bg-primary/10 opacity-30 blur-2xl group-hover:opacity-60 transition" />

            <div>
              {/* Header: Avatar, Name, Location and Ratings */}
              <div className="border-b border-white/10 pb-3.5">
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${r.avatarGradient} font-display text-sm font-bold text-white shadow-md`}
                    >
                      {r.avatarText}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-display text-sm font-bold text-foreground truncate">{r.name}</h3>
                      <p className="font-mono text-[10px] text-primary">{r.location}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end shrink-0">
                    <div className="flex items-center text-amber-400">
                      {Array.from({ length: r.rating }).map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-current" />
                      ))}
                    </div>
                    <span className="mt-1 inline-flex items-center rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-emerald-400 border border-emerald-500/20">
                      {r.verifiedYear}
                    </span>
                  </div>
                </div>

                {/* Role full line */}
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground line-clamp-2">
                  {r.role}
                </p>
              </div>

              {/* Tournament tag & Sport */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center rounded-md bg-white/[0.06] px-2 py-1 font-mono text-[10px] font-medium text-amber-300/90 border border-white/10">
                  {r.tournament}
                </span>
                <span className="inline-flex items-center rounded-md bg-white/[0.03] px-2 py-1 font-mono text-[10px] text-muted-foreground border border-white/5">
                  {r.sport}
                </span>
              </div>

              {/* Quote without double collision */}
              <div className="mt-3.5 flex items-start gap-2">
                <Quote className="h-4 w-4 shrink-0 text-primary/40 mt-0.5" />
                <p className="text-xs leading-relaxed text-foreground/85 font-normal italic">
                  {r.quote}
                </p>
              </div>

              {/* Stats pill */}
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg bg-black/40 p-2.5 text-center border border-white/5">
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Teams</div>
                  <div className="font-mono text-sm text-foreground font-bold">{r.teamsCount}</div>
                </div>
                <div className="border-l border-white/10">
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Allotted</div>
                  <div className="font-mono text-sm text-primary font-bold">{r.playersCount} Players</div>
                </div>
              </div>
            </div>

            {/* Video Action Button */}
            <div className="mt-5 border-t border-white/10 pt-3">
              <button
                type="button"
                onClick={() => onPlayVideo(r)}
                className="gold-button gold-button-hover flex w-full items-center justify-center gap-2 rounded-md py-2.5 text-xs font-bold uppercase tracking-wider"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Watch Story ({r.duration})</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
