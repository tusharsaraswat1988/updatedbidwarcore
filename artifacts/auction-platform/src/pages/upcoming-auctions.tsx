import { useLocation } from "wouter";
import { useBranding } from "@/hooks/use-branding";
import { MapPin, Users, Calendar, IndianRupee, ArrowLeft, Trophy } from "lucide-react";

// ─── Data ─────────────────────────────────────────────────────────────────────

type Sport = "cricket" | "football" | "kabaddi";

interface UpcomingTournament {
  id: number;
  name: string;
  code: string;
  sport: Sport;
  city: string;
  date: string;
  time: string;
  purse: number;
  playersPerTeam: number;
  teams: number;
  primary: string;
  accent: string;
}

const UPCOMING: UpcomingTournament[] = [
  {
    id: 1,
    name: "Lucknow Premier League Season 4",
    code: "LPL",
    sport: "cricket",
    city: "Lucknow",
    date: "2026-06-05",
    time: "18:00",
    purse: 3000000,
    playersPerTeam: 14,
    teams: 12,
    primary: "#1a3a6b",
    accent: "#f5c842",
  },
  {
    id: 2,
    name: "Kashi Cricket Cup 2026",
    code: "KCC",
    sport: "cricket",
    city: "Varanasi",
    date: "2026-06-12",
    time: "17:30",
    purse: 2000000,
    playersPerTeam: 11,
    teams: 10,
    primary: "#7b1a1a",
    accent: "#f97316",
  },
  {
    id: 3,
    name: "Agra Kings Premier League",
    code: "AKPL",
    sport: "cricket",
    city: "Agra",
    date: "2026-06-15",
    time: "19:00",
    purse: 2500000,
    playersPerTeam: 13,
    teams: 8,
    primary: "#1a4d2e",
    accent: "#22c55e",
  },
  {
    id: 4,
    name: "Prayagraj Champions Trophy",
    code: "PCT",
    sport: "cricket",
    city: "Prayagraj",
    date: "2026-06-20",
    time: "15:00",
    purse: 1500000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#2d1a6b",
    accent: "#a78bfa",
  },
  {
    id: 5,
    name: "Mathura Warriors Super League",
    code: "MWSL",
    sport: "football",
    city: "Mathura",
    date: "2026-06-22",
    time: "20:00",
    purse: 1800000,
    playersPerTeam: 16,
    teams: 10,
    primary: "#1a3a3a",
    accent: "#06b6d4",
  },
  {
    id: 6,
    name: "Meerut Premier Cricket League",
    code: "MPCL",
    sport: "cricket",
    city: "Meerut",
    date: "2026-06-28",
    time: "16:00",
    purse: 1200000,
    playersPerTeam: 12,
    teams: 8,
    primary: "#4a1a1a",
    accent: "#fb7185",
  },
  {
    id: 7,
    name: "Noida Super League Season 2",
    code: "NSL",
    sport: "cricket",
    city: "Noida",
    date: "2026-07-05",
    time: "18:30",
    purse: 3500000,
    playersPerTeam: 14,
    teams: 14,
    primary: "#1a2a4a",
    accent: "#38bdf8",
  },
  {
    id: 8,
    name: "Ghaziabad Cricket Federation Cup",
    code: "GCFC",
    sport: "cricket",
    city: "Ghaziabad",
    date: "2026-07-10",
    time: "17:00",
    purse: 1000000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#1a3a1a",
    accent: "#84cc16",
  },
  {
    id: 9,
    name: "Bareilly Premier League",
    code: "BPL",
    sport: "cricket",
    city: "Bareilly",
    date: "2026-07-15",
    time: "19:30",
    purse: 2000000,
    playersPerTeam: 12,
    teams: 10,
    primary: "#3a1a4a",
    accent: "#e879f9",
  },
  {
    id: 10,
    name: "Gorakhpur T20 Super Series",
    code: "GTSS",
    sport: "cricket",
    city: "Gorakhpur",
    date: "2026-07-18",
    time: "16:30",
    purse: 1500000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#2a1a0a",
    accent: "#fb923c",
  },
  {
    id: 11,
    name: "Aligarh Kabaddi Mahotsav 2026",
    code: "AKM",
    sport: "kabaddi",
    city: "Aligarh",
    date: "2026-07-22",
    time: "14:00",
    purse: 800000,
    playersPerTeam: 12,
    teams: 8,
    primary: "#0a2a3a",
    accent: "#14b8a6",
  },
  {
    id: 12,
    name: "Jhansi Warriors Cricket League",
    code: "JWCL",
    sport: "cricket",
    city: "Jhansi",
    date: "2026-07-26",
    time: "18:00",
    purse: 1200000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#1a0a2a",
    accent: "#c084fc",
  },
  {
    id: 13,
    name: "Kanpur Premier League Season 5",
    code: "KPL",
    sport: "cricket",
    city: "Kanpur",
    date: "2026-08-02",
    time: "19:00",
    purse: 4000000,
    playersPerTeam: 15,
    teams: 14,
    primary: "#1a1a0a",
    accent: "#eab308",
  },
  {
    id: 14,
    name: "Moradabad Box Cricket League",
    code: "MBCL",
    sport: "cricket",
    city: "Moradabad",
    date: "2026-08-08",
    time: "17:00",
    purse: 800000,
    playersPerTeam: 10,
    teams: 8,
    primary: "#0a1a2a",
    accent: "#60a5fa",
  },
  {
    id: 15,
    name: "Firozabad Cricket Cup Season 2",
    code: "FCC",
    sport: "cricket",
    city: "Firozabad",
    date: "2026-08-14",
    time: "16:00",
    purse: 1000000,
    playersPerTeam: 11,
    teams: 8,
    primary: "#1a2a1a",
    accent: "#4ade80",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatPurse(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(0)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(0)} Lakh`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

// ─── SVG Logo Badge ───────────────────────────────────────────────────────────

function LogoBadge({ t }: { t: UpcomingTournament }) {
  const letters = t.code.slice(0, 2);
  const extra = t.code.length > 2 ? t.code[2] : "";

  const sportPath: Record<Sport, string> = {
    cricket:
      "M28 14 C28 14 20 20 18 28 C16 36 20 40 20 40 L24 36 C24 36 22 32 24 26 C26 20 30 18 30 18 Z M30 18 L34 22 L22 38 L18 34 Z",
    football:
      "M24 14 C18 14 13 19 13 25 C13 31 18 36 24 36 C30 36 35 31 35 25 C35 19 30 14 24 14 Z M24 17 L28 20 L27 25 L24 27 L21 25 L20 20 Z",
    kabaddi:
      "M24 13 C21 13 19 15 19 18 C19 21 21 23 24 23 C27 23 29 21 29 18 C29 15 27 13 24 13 Z M17 27 C17 24 19 22 22 22 L24 24 L26 22 C29 22 31 24 31 27 L31 36 L26 36 L26 30 L24 32 L22 30 L22 36 L17 36 Z",
  };

  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" role="img" aria-label={`${t.name} logo`}>
      {/* Shield shape */}
      <defs>
        <linearGradient id={`grad-${t.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={t.primary} />
          <stop offset="100%" stopColor={t.primary} stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id={`stroke-${t.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={t.accent} />
          <stop offset="100%" stopColor={t.accent} stopOpacity="0.6" />
        </linearGradient>
      </defs>

      {/* Outer shield */}
      <path
        d="M24 2 L44 10 L44 28 C44 38 34 45 24 47 C14 45 4 38 4 28 L4 10 Z"
        fill={`url(#grad-${t.id})`}
        stroke={t.accent}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* Inner border ring */}
      <path
        d="M24 5 L41 12 L41 28 C41 37 32 43 24 45 C16 43 7 37 7 28 L7 12 Z"
        fill="none"
        stroke={t.accent}
        strokeWidth="0.6"
        strokeOpacity="0.4"
        strokeLinejoin="round"
      />

      {/* Accent top bar */}
      <rect x="4" y="8.5" width="40" height="3" rx="1" fill={t.accent} opacity="0.25" />

      {/* Main initials */}
      {extra ? (
        <>
          <text
            x="24"
            y="26"
            textAnchor="middle"
            fontFamily="Arial Black, Arial, sans-serif"
            fontWeight="900"
            fontSize="12"
            fill="white"
            letterSpacing="0"
          >
            {letters}
          </text>
          <text
            x="24"
            y="36"
            textAnchor="middle"
            fontFamily="Arial Black, Arial, sans-serif"
            fontWeight="900"
            fontSize="7"
            fill={t.accent}
            letterSpacing="1"
          >
            {extra}
          </text>
        </>
      ) : (
        <text
          x="24"
          y="31"
          textAnchor="middle"
          fontFamily="Arial Black, Arial, sans-serif"
          fontWeight="900"
          fontSize="14"
          fill="white"
          letterSpacing="1"
        >
          {letters}
        </text>
      )}

      {/* Small sport icon hint at bottom */}
      <path
        d={sportPath[t.sport]}
        fill={t.accent}
        opacity="0.18"
        transform="translate(0, 0) scale(0.55) translate(20, 22)"
      />

      {/* Stars accent top */}
      <circle cx="12" cy="14" r="1.2" fill={t.accent} opacity="0.6" />
      <circle cx="36" cy="14" r="1.2" fill={t.accent} opacity="0.6" />
    </svg>
  );
}

// ─── Tournament Card ──────────────────────────────────────────────────────────

function TournamentCard({ t }: { t: UpcomingTournament }) {
  const sportLabel: Record<Sport, string> = {
    cricket: "Cricket",
    football: "Football",
    kabaddi: "Kabaddi",
  };

  return (
    <div
      className="relative bg-[#111113] border border-white/8 rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-[0_0_30px_rgba(0,0,0,0.6)] flex flex-col"
      style={{ borderColor: `${t.accent}18` }}
    >
      {/* Logo area */}
      <div
        className="relative flex items-center justify-center"
        style={{
          background: `radial-gradient(ellipse at 50% 30%, ${t.primary}cc 0%, ${t.primary}55 60%, #0d0d10 100%)`,
          height: "160px",
        }}
      >
        {/* Subtle texture lines */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, ${t.accent} 0px, ${t.accent} 1px, transparent 1px, transparent 12px)`,
          }}
        />

        {/* Logo badge */}
        <div className="relative z-10" style={{ width: 88, height: 88 }}>
          <LogoBadge t={t} />
        </div>

        {/* Tournament code chip */}
        <div
          className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest"
          style={{ background: `${t.accent}22`, color: t.accent, border: `1px solid ${t.accent}40` }}
        >
          {t.code}
        </div>

        {/* Sport tag */}
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-semibold bg-white/8 text-white/50 border border-white/10">
          {sportLabel[t.sport]}
        </div>

        {/* Upcoming badge */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Upcoming</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        {/* Name */}
        <h3 className="font-bold text-sm leading-snug text-white line-clamp-2" style={{ minHeight: "2.5rem" }}>
          {t.name}
        </h3>

        {/* Divider */}
        <div className="border-t border-white/5" />

        {/* Metadata rows */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} />
            <span className="font-medium text-white/70">{t.city}, Uttar Pradesh</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/50">
            <IndianRupee className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} />
            <span>
              <span className="font-bold text-white/80">{formatPurse(t.purse)}</span>
              <span className="ml-1">per team purse</span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} />
              <span>
                <span className="font-bold text-white/80">{t.playersPerTeam}</span>
                <span className="ml-1">Players / Team</span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <span className="w-1 h-1 rounded-full bg-white/20 inline-block" />
              <span>{t.teams} Teams</span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-white/50 pt-1 border-t border-white/5">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} />
            <span>
              <span className="font-bold text-white/80">{formatDate(t.date)}</span>
              <span className="ml-2 text-white/40">{t.time} IST</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function UpcomingAuctions() {
  const [, navigate] = useLocation();
  const { logos, brandName } = useBranding();

  return (
    <div className="min-h-screen bg-[#09090b] text-white">
      {/* SEO */}
      <title>Upcoming Auctions | {brandName}</title>

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#09090b]/90 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2.5">
              <img src={logos.mini || "/bidwar-logo-transparent.png"} alt={brandName} className="h-8 w-auto" />
              <span className="font-display font-black text-lg tracking-tight text-white hidden sm:block">
                {brandName.toUpperCase()}
              </span>
            </div>
          </div>
          <button
            onClick={() => navigate("/organizer")}
            className="px-4 py-2 rounded-lg bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* Header */}
      <section className="relative py-14 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[200px] bg-primary/8 rounded-full blur-[80px]" />
        </div>
        <div className="relative max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-5 h-5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-widest">BidWar Platform</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight">
                Upcoming{" "}
                <span className="text-primary" style={{ textShadow: "0 0 40px rgba(234,179,8,0.3)" }}>
                  Auctions
                </span>
              </h1>
              <p className="text-white/50 mt-2 text-sm max-w-md">
                Live franchise auctions happening across Uttar Pradesh. Powered by BidWar's real-time auction platform.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                <span className="text-xs font-semibold text-white/70">
                  {UPCOMING.length} Auctions Scheduled
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {UPCOMING.map(t => (
              <TournamentCard key={t.id} t={t} />
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-8 md:p-10 text-center">
            <h2 className="text-2xl md:text-3xl font-display font-black text-white mb-2">
              Want to run your own auction?
            </h2>
            <p className="text-white/50 text-sm mb-6 max-w-sm mx-auto">
              Set up a professional franchise auction in under 15 minutes. Free trial available.
            </p>
            <button
              onClick={() => navigate("/organizer")}
              className="px-8 py-3.5 rounded-xl bg-primary text-black font-display font-black text-base hover:bg-primary/90 transition-all hover:shadow-[0_0_30px_rgba(234,179,8,0.35)]"
            >
              Start Free on BidWar
            </button>
          </div>
        </div>
      </section>

      {/* Footer note */}
      <div className="pb-10 text-center">
        <p className="text-xs text-white/20">
          Tournament dates and details are subject to change. Contact respective organizers for confirmation.
        </p>
      </div>
    </div>
  );
}
