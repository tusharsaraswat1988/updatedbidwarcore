import { ChevronRight, MapPin, Calendar } from "lucide-react";
import { formatDate, formatPurse, SPORT_LABEL, type UpcomingTournament } from "@/data/upcoming-auctions";

/**
 * Upcoming Auctions Strip — horizontally scrolling list of live/upcoming
 * tournaments. Data comes from the `displayAuctions` query owned by the
 * page; this component stays presentation-only.
 */
export function UpcomingAuctionsStrip({
  auctions,
  onViewAll,
}: {
  auctions: UpcomingTournament[];
  onViewAll: () => void;
}) {
  return (
    <section id="upcoming" className="py-12 px-6" aria-labelledby="upcoming-auctions-heading">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-primary text-xs font-bold uppercase tracking-widest mb-1">Live on BidWar</div>
            <h2 id="upcoming-auctions-heading" className="text-2xl font-display font-black text-foreground">Upcoming Auctions</h2>
          </div>
          <button
            onClick={onViewAll}
            className="flex items-center gap-1.5 text-sm text-primary font-semibold hover:underline underline-offset-4 flex-shrink-0"
          >
            {auctions.length > 0 ? `View all ${auctions.length}` : "View all"} <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-3 scrollbar-none -mx-2 px-2">
          {auctions.slice(0, 4).map(t => (
            <div
              key={t.id}
              className="flex-shrink-0 w-64 rounded-xl border overflow-hidden bg-card hover:border-border transition-colors duration-200"
              style={{ borderColor: `${t.accent}22` }}
            >
              <div
                className="px-4 py-3 flex items-center justify-between"
                style={{
                  background: `linear-gradient(135deg, ${t.primary}cc 0%, ${t.primary}66 100%)`,
                  borderBottom: `1px solid ${t.accent}22`,
                }}
              >
                <span
                  className="text-xs font-mono font-bold tracking-widest px-2 py-0.5 rounded"
                  style={{ background: `${t.accent}22`, color: t.accent, border: `1px solid ${t.accent}44` }}
                >
                  {t.code}
                </span>
                <span className="text-[10px] font-semibold text-white/40">{SPORT_LABEL[t.sport]}</span>
              </div>

              <div className="p-4 flex flex-col gap-2.5">
                <p className="font-bold text-sm text-foreground leading-snug line-clamp-2" style={{ minHeight: "2.5rem" }}>
                  {t.name}
                </p>

                <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} aria-hidden />
                    <span className="text-foreground/80 font-medium">{t.city}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} aria-hidden />
                    <span className="text-foreground/80 font-medium">{formatDate(t.date)}</span>
                    <span className="text-muted-foreground">{t.time} IST</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border text-xs">
                  <span className="text-muted-foreground">{t.teams} Teams</span>
                  <span className="font-bold" style={{ color: t.accent }}>{formatPurse(t.purse)}</span>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={onViewAll}
            className="flex-shrink-0 w-44 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center gap-3 hover:border-primary/40 hover:bg-primary/5 transition-all duration-200 group min-h-[180px]"
          >
            <div className="w-10 h-10 rounded-full border border-white/10 group-hover:border-primary/40 flex items-center justify-center group-hover:bg-primary/10 transition-all">
              <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-primary transition-colors" aria-hidden />
            </div>
            <span className="text-xs font-semibold text-white/40 group-hover:text-primary transition-colors text-center leading-snug px-4">
              View all {auctions.length > 0 ? auctions.length : ""} upcoming auctions
            </span>
          </button>
        </div>
      </div>
    </section>
  );
}
