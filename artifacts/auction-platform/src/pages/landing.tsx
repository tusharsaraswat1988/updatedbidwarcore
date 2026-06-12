import { useLocation } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Check,
  CircleDot,
  ClipboardList,
  Gavel,
  MessageCircle,
  Monitor,
  Router,
  Smartphone,
  Trophy,
  Users,
  Wifi,
} from "lucide-react";
import { motion } from "framer-motion";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { HomeSchemaMarkup } from "@/components/schema-markup";

const WHATSAPP_SETUP_URL =
  "https://wa.me/918707488250?text=Hi%20Tushar%2C%20I%20want%20free%20setup%20for%20my%20BidWar%20auction.";

const proofStats = [
  { value: "500+", label: "auctions completed across India" },
  { value: "₹50Cr+", label: "tracked in live bids" },
  { value: "0 internet", label: "local router mode for venues" },
] as const;

const sportFlows = [
  {
    icon: Trophy,
    eyebrow: "Cricket auction flow",
    title: "IPL-Style Cricket Auction Scoring",
    lead:
      "T20, T10, Box Cricket. Real player stats auto-imported. Live bidding. Auto-purse deduction.",
    event: "Jhansi Warriors Cricket League",
    bullets: [
      "Player roles, base price, category, batting and bowling stats on one card.",
      "Owner bids update the LED display and purse balance instantly.",
      "Cricket scoring model covers runs, wickets, strike rate, economy and standings.",
    ],
    mock: "cricket",
  },
  {
    icon: CircleDot,
    eyebrow: "Badminton tournament flow",
    title: "Rally-by-Rally Digital Scoring. No More Scorecards.",
    lead:
      "Live BWF scoring. Auto standings. Deuce detection. Tournament bracket management.",
    event: "Varanasi Open Badminton Setup",
    bullets: [
      "Singles and doubles matches with rally-by-rally scorer controls.",
      "Auto deuce, game point, match point and court-wise display states.",
      "Brackets, standings and public score display stay synced for organizers.",
    ],
    mock: "badminton",
  },
  {
    icon: Users,
    eyebrow: "Football / franchise leagues",
    title: "Position-Based Bidding for Franchise Teams",
    lead:
      "Draft goalkeepers, defenders, midfielders and forwards with team budgets and real-time overlays.",
    event: "Lucknow Franchise Football Draft",
    bullets: [
      "Position filters keep squads balanced during fast bidding.",
      "Team budget and squad strength visible to every owner.",
      "Broadcast overlays show current bid, team ticker and player role.",
    ],
    mock: "football",
  },
] as const;

const features = [
  { icon: Router, title: "Local WiFi Mode", line: "Run the full auction from a router when internet drops." },
  { icon: Monitor, title: "LED Display", line: "Project live bid, player card and purse on any TV." },
  { icon: Smartphone, title: "Owner App", line: "Team owners bid from mobile browser. No app install." },
  { icon: Gavel, title: "Operator Dashboard", line: "Nominate, bid, sell, undo and control the room." },
  { icon: ClipboardList, title: "Scoring Models", line: "Cricket and badminton scoring built into tournament ops." },
  { icon: BarChart3, title: "Auto Reports", line: "Export sold players, purse use and full bid history." },
] as const;

const testimonials = [
  {
    quote:
      "120 players auctioned in under 45 minutes. The venue internet was unstable, but BidWar kept running on local WiFi.",
    name: "Amit Verma",
    meta: "Cricket League Organizer | Lucknow",
    stat: "120 players / 45 min",
  },
  {
    quote:
      "For badminton, we stopped using paper scorecards. Deuce, standings and brackets were clear for everyone at the venue.",
    name: "Priya Nair",
    meta: "School Sports Coordinator | Jaipur",
    stat: "Rally scoring + brackets",
  },
  {
    quote:
      "Owners understood the bidding screen in minutes. Purse deduction and LED display stayed synced throughout.",
    name: "Rajasthan Kabaddi League Organizer",
    meta: "Kabaddi | Jodhpur",
    stat: "8 teams live",
  },
] as const;

const walkthrough = [
  { n: "01", title: "Share your tournament details", text: "Teams, sport, purse, player list and venue setup." },
  { n: "02", title: "We set up in 15 minutes", text: "Tushar's team prepares operator, display and owner links." },
  { n: "03", title: "Run it on local WiFi", text: "Connect devices to the router and start the live auction." },
] as const;

function HeroProductVisual() {
  return (
    <div className="relative mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-[#111114] p-3 shadow-[0_40px_120px_rgba(0,0,0,0.45)]">
      <div className="grid gap-3 lg:grid-cols-[1.35fr_0.75fr]">
        <div className="rounded-[1.5rem] border border-white/10 bg-black p-5">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-green-300">
              <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
              Operator live
            </div>
            <div className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              Local WiFi: Active
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-[0.85fr_1.15fr]">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-4 flex h-36 items-end justify-center rounded-xl bg-gradient-to-br from-primary/30 via-orange-500/10 to-transparent">
                <div className="mb-4 h-20 w-20 rounded-full border-4 border-black bg-primary/90 shadow-[0_0_40px_rgba(234,179,8,0.28)]" />
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">All-rounder</p>
              <h3 className="mt-1 font-display text-2xl font-black">Rohit Rajput</h3>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-white/[0.05] p-2"><b>142</b><span className="block text-muted-foreground">SR</span></div>
                <div className="rounded-lg bg-white/[0.05] p-2"><b>28</b><span className="block text-muted-foreground">Wkts</span></div>
                <div className="rounded-lg bg-white/[0.05] p-2"><b>7.1</b><span className="block text-muted-foreground">Eco</span></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-5">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Current bid</p>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div className="font-display text-5xl font-black text-primary">₹8,00,000</div>
                  <div className="rounded-xl bg-green-500 px-4 py-2 text-sm font-black text-black">SEND BID</div>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Leading: Kashi Kings · Purse left ₹14.2L</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {["Kashi Kings", "Ganga Riders", "Banaras Bulls", "Sarnath Strikers"].map((team, index) => (
                  <div key={team} className={`rounded-xl border p-3 ${index === 0 ? "border-primary/40 bg-primary/10" : "border-white/10 bg-white/[0.04]"}`}>
                    <p className="text-sm font-bold">{team}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Purse ₹{index === 0 ? "14.2" : "18." + index}L</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded-[1.5rem] border border-white/10 bg-[#060607] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">LED display</p>
            <div className="rounded-2xl bg-gradient-to-r from-primary to-orange-500 p-4 text-black">
              <p className="text-xs font-black uppercase">Live now</p>
              <p className="font-display text-4xl font-black">₹8L</p>
              <p className="text-sm font-bold">Kashi Kings bidding</p>
            </div>
          </div>
          <div className="rounded-[1.5rem] border border-white/10 bg-[#060607] p-4">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Owner app</p>
            <div className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] p-4">
              <p className="text-sm text-muted-foreground">Your purse</p>
              <p className="font-display text-3xl font-black">₹14.2L</p>
              <button className="mt-4 w-full rounded-xl bg-primary px-4 py-3 font-black text-black">Bid ₹8.5L</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SportMock({ type }: { type: (typeof sportFlows)[number]["mock"] }) {
  if (type === "badminton") {
    return (
      <div className="rounded-3xl border border-white/10 bg-black p-5">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-[0.18em] text-green-300">
          <span>Court 2 live</span>
          <span>Deuce</span>
        </div>
        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div>
            <p className="font-bold">Jaipur Falcons</p>
            <p className="text-sm text-muted-foreground">Server</p>
          </div>
          <div className="font-display text-5xl font-black text-primary">22-22</div>
          <div className="text-right">
            <p className="font-bold">Pink City Smashers</p>
            <p className="text-sm text-muted-foreground">Receiver</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
          {["Game 1: 21-18", "Game 2: 19-21", "Game 3: Live"].map(item => (
            <div key={item} className="rounded-xl bg-white/[0.05] p-3 font-bold">{item}</div>
          ))}
        </div>
      </div>
    );
  }

  if (type === "football") {
    return (
      <div className="rounded-3xl border border-white/10 bg-black p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {["GK", "DEF", "MID", "FWD"].map((role, index) => (
            <span key={role} className={`rounded-full px-3 py-1 text-xs font-black ${index === 2 ? "bg-primary text-black" : "bg-white/[0.06] text-muted-foreground"}`}>{role}</span>
          ))}
        </div>
        <div className="rounded-2xl border border-primary/30 bg-primary/10 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-primary">Current pick</p>
          <p className="mt-2 font-display text-3xl font-black">Midfielder · ₹3,20,000</p>
          <p className="mt-1 text-sm text-muted-foreground">Awadh FC leading · 6 slots left</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-black p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Cricket model</p>
        <p className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-bold text-green-300">Auto import</p>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        {[
          ["Role", "Batting AR"],
          ["Base", "₹1,00,000"],
          ["Strike rate", "148.7"],
          ["Economy", "6.9"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-white/[0.05] p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-display text-xl font-black">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const [, navigate] = useLocation();
  const { logos, brandName, loading: brandingLoading } = useBranding();
  const logoUrl = cldUrl(logos.mini, "headerLogo");

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#08080a] text-white">
      <HomeSchemaMarkup />

      <nav className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#08080a]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
            {brandingLoading ? (
              <div className="h-9 w-9" />
            ) : (
              <img
                src={logoUrl || "/bidwar-logo-transparent.webp"}
                alt={brandName}
                className="h-9 w-auto"
                width={112}
                height={112}
              />
            )}
            <span className="font-display text-xl font-black tracking-tight">{brandName.toUpperCase()}</span>
          </button>
          <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#sports" className="transition-colors hover:text-white">Sports</a>
            <a href="#features" className="transition-colors hover:text-white">Features</a>
            <a href="#proof" className="transition-colors hover:text-white">Proof</a>
            <a href="#setup" className="transition-colors hover:text-white">Setup</a>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-green-400/25 bg-green-400/10 px-3 py-1.5 text-xs font-black text-green-300 sm:flex">
              <Wifi className="h-3.5 w-3.5" />
              Works on Local WiFi
            </span>
            <button
              onClick={() => navigate("/organizer")}
              className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-black transition-colors hover:bg-primary/90"
            >
              Create Free Account
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative px-5 pb-16 pt-28">
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute left-1/2 top-0 h-[520px] w-[960px] -translate-x-1/2 rounded-full bg-primary/10 blur-[130px]" />
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          </div>

          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55 }}
              className="space-y-7"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-primary">
                <Router className="h-3.5 w-3.5" />
                Local router mode
              </div>
              <div className="space-y-5">
                <h1 className="font-display text-5xl font-black leading-[0.94] tracking-tight md:text-7xl">
                  Auction Platform That Works WITHOUT Internet
                </h1>
                <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground md:text-xl">
                  IPL-style live auctions. Local WiFi. ₹8,00,000+ live bids.
                  Real organizers trust BidWar for venue-ready tournament operations.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {proofStats.map(stat => (
                  <div key={stat.value} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <p className="font-display text-2xl font-black text-primary">{stat.value}</p>
                    <p className="mt-1 text-xs leading-snug text-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <a
                  href="#demo"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-4 font-display font-black text-black transition-all hover:bg-primary/90 hover:shadow-[0_0_40px_rgba(234,179,8,0.25)]"
                >
                  See It Live in 90 Seconds
                  <ArrowRight className="h-5 w-5" />
                </a>
                <button
                  onClick={() => navigate("/organizer")}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.03] px-6 py-4 font-semibold text-white transition-colors hover:bg-white/[0.07]"
                >
                  Create Free Account
                </button>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {["Free for first 2 teams", "₹0 setup", "Cancel anytime"].map(item => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <Check className="h-4 w-4 text-green-400" />
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
            >
              <HeroProductVisual />
            </motion.div>
          </div>
        </section>

        <section id="sports" className="border-t border-white/10 px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Separate flows, not one mixed sports page</p>
              <h2 className="mt-3 font-display text-4xl font-black md:text-5xl">Choose the sport. BidWar runs the ops.</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                Cricket auctions, badminton scoring and franchise drafts each get their own workflow, screens and event logic.
              </p>
            </div>

            <div className="grid gap-5">
              {sportFlows.map((flow, index) => {
                const Icon = flow.icon;
                return (
                  <motion.article
                    key={flow.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ delay: index * 0.06 }}
                    className="grid gap-6 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 md:grid-cols-[0.95fr_1.05fr] md:p-7"
                  >
                    <div className="space-y-5">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </span>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-primary">{flow.eyebrow}</p>
                      </div>
                      <div>
                        <h3 className="font-display text-3xl font-black">{flow.title}</h3>
                        <p className="mt-3 text-muted-foreground">{flow.lead}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Example setup</p>
                        <p className="mt-1 font-display text-xl font-black">{flow.event}</p>
                      </div>
                      <ul className="space-y-3 text-sm text-muted-foreground">
                        {flow.bullets.map(bullet => (
                          <li key={bullet} className="flex gap-2">
                            <Check className="mt-0.5 h-4 w-4 flex-none text-green-400" />
                            <span>{bullet}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <SportMock type={flow.mock} />
                  </motion.article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="features" className="border-t border-white/10 px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Condensed features</p>
                <h2 className="mt-3 font-display text-4xl font-black md:text-5xl">Everything needed on auction day.</h2>
                <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
                  Operator panel, LED display, owner app and reports stay synced on the same local network.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {features.map(item => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                      <Icon className="h-6 w-6 text-primary" />
                      <h3 className="mt-4 font-display text-xl font-black">{item.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.line}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section id="demo" className="border-t border-white/10 px-5 py-16">
          <div className="mx-auto grid max-w-6xl gap-8 rounded-[2rem] border border-primary/20 bg-primary/[0.07] p-6 md:grid-cols-[0.9fr_1.1fr] md:p-8">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">90-second live view</p>
              <h2 className="mt-3 font-display text-4xl font-black">Operator, LED display and owner app stay synced.</h2>
              <p className="mt-4 text-muted-foreground">
                This is what the organizer controls during a venue auction: one laptop or tablet, one projector screen,
                and every owner connected to the same local router.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["Operator", "Send ₹8,00,000 bid", Gavel],
                ["LED Display", "Live player + team purse", Monitor],
                ["Owner App", "Remaining budget + bid button", Smartphone],
                ["Badminton Scorer", "Deuce + bracket state", CircleDot],
              ].map(([label, text, Icon]) => (
                <div key={label as string} className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm font-semibold">
                  <div className="flex h-28 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035]">
                    <div className="text-center">
                      <Icon className="mx-auto h-7 w-7 text-primary" />
                      <p className="mt-3 font-display text-lg font-black text-white">{label}</p>
                    </div>
                  </div>
                  <p className="mt-3">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="proof" className="border-t border-white/10 px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Social proof</p>
                <h2 className="mt-3 font-display text-4xl font-black md:text-5xl">Organizers need confidence, not fake names.</h2>
              </div>
              <p className="max-w-lg text-muted-foreground">
                Swap these with verified organizer names when Tushar approves. Until then, city + sport keeps it honest.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {testimonials.map(item => (
                <article key={item.name} className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
                  <div className="mb-5 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-black text-primary">{item.stat}</div>
                  <p className="text-lg leading-relaxed">"{item.quote}"</p>
                  <div className="mt-6 border-t border-white/10 pt-4">
                    <p className="font-display text-lg font-black">{item.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{item.meta}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="setup" className="border-t border-white/10 px-5 py-16">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-primary">Request free setup</p>
                <h2 className="mt-3 font-display text-5xl font-black leading-tight">WhatsApp Tushar's team. Go live in 15 minutes.</h2>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                  No complex pricing table on the homepage. Start with two teams free, set up at ₹0, and move to pricing only when the organizer is ready.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <a
                    href={WHATSAPP_SETUP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-400 px-6 py-4 font-display font-black text-black transition-colors hover:bg-green-300"
                  >
                    <MessageCircle className="h-5 w-5" />
                    Request Free Setup on WhatsApp
                  </a>
                  <button
                    onClick={() => navigate("/organizer")}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-6 py-4 font-semibold text-white hover:bg-white/[0.06]"
                  >
                    Create Free Account
                  </button>
                </div>
              </div>
              <div className="space-y-3">
                {walkthrough.map(step => (
                  <div key={step.n} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                    <span className="font-display text-2xl font-black text-primary">{step.n}</span>
                    <div>
                      <h3 className="font-display text-xl font-black">{step.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{step.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-8">
        <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 text-sm text-muted-foreground md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} {brandName}. Tournament Operating System for Indian sports organizers.</p>
          <div className="flex flex-wrap gap-4">
            <a href="#setup" className="hover:text-white">Free setup</a>
            <a href="/contact" className="hover:text-white">Contact</a>
            <a href="/legal" className="hover:text-white">Legal</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
