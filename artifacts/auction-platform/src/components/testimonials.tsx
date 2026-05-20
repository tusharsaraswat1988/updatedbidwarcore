import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";

const TESTIMONIALS = [
  {
    name: "Suresh Kumar",
    role: "Cricket League Organizer",
    city: "Lucknow, UP",
    text: "We ran our first T20 franchise league auction for 8 teams, 80 players — all done in 90 minutes flat. The LED display had the entire room on their feet. Nothing else comes close.",
    stars: 5,
    sport: "Cricket",
    event: "Lucknow Premier League 2024",
  },
  {
    name: "Priya Singh",
    role: "Corporate Events Head",
    city: "Pune, Maharashtra",
    text: "Our annual corporate football league auction was a complete hit. Team owners were bidding from their phones while the big screen showed every move live. The setup took less than 15 minutes.",
    stars: 5,
    sport: "Football",
    event: "PuneFC Corporate League",
  },
  {
    name: "Rakesh Verma",
    role: "Kabaddi Tournament Director",
    city: "Jaipur, Rajasthan",
    text: "Exactly like the PKL format. We had 6 franchises, 60 players and the whole thing felt like a broadcast event. Players were thrilled to see their names on the big screen with bid amounts.",
    stars: 5,
    sport: "Kabaddi",
    event: "Rajasthan Kabaddi Mahotsav",
  },
  {
    name: "Ankit Gupta",
    role: "School Sports Coordinator",
    city: "Delhi, NCR",
    text: "Used BidWar for our inter-school cricket auction. Even the teachers were glued to the screen. Super easy to set up — no technical knowledge needed at all. Highly recommend.",
    stars: 5,
    sport: "Cricket",
    event: "DPS Sports Festival 2024",
  },
  {
    name: "Mohammed Rafi",
    role: "League Commissioner",
    city: "Hyderabad, Telangana",
    text: "Ran 3 auctions this season — cricket, football and kabaddi. Same platform, different sports, zero issues. The reports section alone saves hours of manual work. Worth every rupee.",
    stars: 5,
    sport: "Multi-Sport",
    event: "Hyderabad City Sports League",
  },
  {
    name: "Deepa Nair",
    role: "Club Organizer",
    city: "Kochi, Kerala",
    text: "WhatsApp support is very fast. We had a last-minute question 20 minutes before our auction started and got an answer immediately. Great product, even better support.",
    stars: 5,
    sport: "Cricket",
    event: "Kerala Blasters Club Cup",
  },
];

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: count }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 text-primary fill-primary" />
      ))}
    </div>
  );
}

export function Testimonials() {
  return (
    <section className="py-24 px-6 border-t border-border/40 overflow-hidden">
      <div className="max-w-6xl mx-auto space-y-16">
        <div className="text-center space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">Organizer Stories</div>
          <h2 className="text-4xl md:text-5xl font-display font-black">
            Trusted by organizers across India
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From local cricket clubs to city-level franchise leagues — organizers love what BidWar does for their events.
          </p>
        </div>

        {/* Aggregate stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { stat: "500+", label: "Auctions Completed" },
            { stat: "10,000+", label: "Players Auctioned" },
            { stat: "25+", label: "Cities Across India" },
            { stat: "₹50 Cr+", label: "Total Bid Value" },
          ].map((s) => (
            <motion.div
              key={s.stat}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center p-5 rounded-2xl border border-border bg-card/20"
            >
              <p className="font-display font-black text-3xl text-primary">{s.stat}</p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Review cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="relative p-6 rounded-2xl border border-border bg-card/20 hover:border-primary/20 hover:bg-card/40 transition-all flex flex-col gap-4"
            >
              <Quote className="w-6 h-6 text-primary/30 absolute top-5 right-5" />
              <div className="space-y-3">
                <StarRow count={t.stars} />
                <p className="text-sm text-foreground leading-relaxed">{t.text}</p>
              </div>
              <div className="mt-auto pt-4 border-t border-border/50 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">{t.city}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="px-2 py-0.5 rounded-full border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase">{t.sport}</div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1 max-w-[120px] text-right leading-tight">{t.event}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
