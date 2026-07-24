import { useState } from "react";
import { MessageCircle, ArrowRight, Calendar, User, Smartphone, ChevronDown } from "lucide-react";

const SPORTS = [
  "Cricket",
  "Football",
  "Kabaddi",
  "Basketball",
  "Volleyball",
  "Esports / Gaming",
  "Business / Corporate League",
  "Other",
];

export function DemoRequest() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [sport, setSport] = useState("");
  const [date, setDate] = useState("");
  const [teams, setTeams] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const lines = [
      `Hi, I want to run a sports auction on BidWar.`,
      ``,
      `Name: ${name}`,
      `Mobile: +91 ${mobile}`,
      `Sport: ${sport || "Not specified"}`,
      `Approx. Tournament Date: ${date || "Not decided yet"}`,
      `Number of Teams: ${teams || "Not decided yet"}`,
      ``,
      `Please help me set up!`,
    ];

    const msg = encodeURIComponent(lines.join("\n"));
    window.open(`https://wa.me/918707488250?text=${msg}`, "_blank", "noopener,noreferrer");
  };

  const isValid = name.trim().length > 1 && mobile.replace(/\D/g, "").length === 10;

  return (
    <section id="contact" className="py-24 px-6 border-t border-border/40">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

          {/* Left: copy */}
          <div className="space-y-6">
            <div>
              <div className="text-primary text-xs font-bold uppercase tracking-widest mb-3">Free Setup Help</div>
              <h2 className="text-4xl md:text-5xl font-display font-black leading-tight">
                We'll set up your first auction — for free
              </h2>
            </div>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Tell us about your tournament and we'll walk you through the whole setup on WhatsApp.
              Most organizers go live in under 15 minutes.
            </p>

            <div className="space-y-4">
              {[
                { icon: MessageCircle, title: "Response within 1 hour", desc: "Our team replies on WhatsApp — usually within the hour during business hours." },
                { icon: Calendar, title: "We schedule around you", desc: "Weekend, evening, morning — pick a time that works for your event prep." },
                { icon: Smartphone, title: "No technical knowledge needed", desc: "If you can use WhatsApp, you can run BidWar. We guide you through every step." },
              ].map((p) => (
                <div key={p.title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <p.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div>
            <form
              onSubmit={handleSubmit}
              className="rounded-2xl border border-border bg-card/30 p-6 space-y-4"
            >
              <div className="space-y-1">
                <h3 className="font-display font-black text-xl text-white">Request a free demo</h3>
                <p className="text-xs text-muted-foreground">We'll reply on WhatsApp within 1 hour.</p>
              </div>

              <div className="space-y-3">
                {/* Name */}
                <div className="space-y-1.5">
                  <label htmlFor="contact-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
                    <input
                      id="contact-name"
                      type="text"
                      required
                      name="name"
                      autoComplete="name"
                      placeholder="e.g. Rahul Sharma"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Mobile */}
                <div className="space-y-1.5">
                  <label htmlFor="contact-mobile" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Mobile Number</label>
                  <div className="relative flex">
                    <div className="flex items-center px-3 rounded-l-xl border border-r-0 border-border bg-muted text-xs text-muted-foreground font-mono flex-shrink-0">
                      +91
                    </div>
                    <input
                      id="contact-mobile"
                      type="tel"
                      required
                      name="mobile"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={10}
                      placeholder="10-digit mobile"
                      value={mobile}
                      onChange={e => setMobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      className="flex-1 px-3 py-2.5 rounded-r-xl border border-border bg-card text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                    />
                  </div>
                </div>

                {/* Sport */}
                <div className="space-y-1.5">
                  <label htmlFor="contact-sport" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sport / Event Type</label>
                  <div className="relative">
                    <select
                      id="contact-sport"
                      name="sport"
                      value={sport}
                      onChange={e => setSport(e.target.value)}
                      className="w-full appearance-none pl-4 pr-9 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors cursor-pointer"
                    >
                      <option value="" disabled>Select sport</option>
                      {SPORTS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden />
                  </div>
                </div>

                {/* Teams + Date in grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label htmlFor="contact-teams" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">No. of Teams</label>
                    <div className="relative">
                      <select
                        id="contact-teams"
                        name="teams"
                        value={teams}
                        onChange={e => setTeams(e.target.value)}
                        className="w-full appearance-none pl-4 pr-9 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors cursor-pointer"
                      >
                        <option value="" disabled>Teams</option>
                        {["2", "4", "6", "8", "10", "12", "14", "16", "16+"].map(n => (
                          <option key={n} value={n}>{n} teams</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="contact-date" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Approx. Date</label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden />
                      <input
                        id="contact-date"
                        type="date"
                        name="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={!isValid}
                data-analytics="contact_demo"
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-display font-black text-base transition-opacity disabled:opacity-40 disabled:cursor-not-allowed bg-green-500 text-white hover:bg-green-600 disabled:bg-muted disabled:text-muted-foreground"
              >
                <MessageCircle className="w-5 h-5" aria-hidden />
                Send on WhatsApp
                <ArrowRight className="w-4 h-4" aria-hidden />
              </button>

              <p className="text-center text-[11px] text-muted-foreground/60">
                Opens WhatsApp with your details pre-filled. No spam, ever.
              </p>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
