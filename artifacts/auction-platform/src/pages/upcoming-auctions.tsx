import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useBranding } from "@/hooks/use-branding";
import { MapPin, Users, Calendar, IndianRupee, Trophy } from "lucide-react";
import {
  formatDate,
  formatPurse,
  SPORT_LABEL,
  type Sport,
  type UpcomingTournament,
} from "@/data/upcoming-auctions";
import type { DisplayAuction } from "@/lib/auth";
import { PublicNavbar } from "@/components/public-navbar";

// ─── Adapter ──────────────────────────────────────────────────────────────────

function toUpcoming(d: DisplayAuction): UpcomingTournament {
  return {
    id: d.id,
    name: d.name,
    code: d.code || d.name.split(" ").map(w => w[0]).join("").slice(0, 4).toUpperCase(),
    sport: d.sport as Sport,
    city: d.city + (d.state ? `, ${d.state}` : ""),
    date: d.scheduledDate,
    time: d.scheduledTime,
    purse: d.purse,
    playersPerTeam: d.playersPerTeam,
    teams: d.teamsCount,
    primary: d.primaryColor,
    accent: d.accentColor,
  };
}

// ─── SVG Logo Badge ───────────────────────────────────────────────────────────

function LogoBadge({ t }: { t: UpcomingTournament }) {
  const letters = t.code.slice(0, 2);
  const extra = t.code.length > 2 ? t.code[2] : "";

  const sportPath: Record<string, string> = {
    cricket:
      "M28 14 C28 14 20 20 18 28 C16 36 20 40 20 40 L24 36 C24 36 22 32 24 26 C26 20 30 18 30 18 Z M30 18 L34 22 L22 38 L18 34 Z",
    football:
      "M24 14 C18 14 13 19 13 25 C13 31 18 36 24 36 C30 36 35 31 35 25 C35 19 30 14 24 14 Z M24 17 L28 20 L27 25 L24 27 L21 25 L20 20 Z",
    kabaddi:
      "M24 13 C21 13 19 15 19 18 C19 21 21 23 24 23 C27 23 29 21 29 18 C29 15 27 13 24 13 Z M17 27 C17 24 19 22 22 22 L24 24 L26 22 C29 22 31 24 31 27 L31 36 L26 36 L26 30 L24 32 L22 30 L22 36 L17 36 Z",
  };

  const path = sportPath[t.sport] || sportPath.cricket;

  return (
    <svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" role="img" aria-label={`${t.name} logo`}>
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

      <path
        d="M24 2 L44 10 L44 28 C44 38 34 45 24 47 C14 45 4 38 4 28 L4 10 Z"
        fill={`url(#grad-${t.id})`}
        stroke={t.accent}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M24 5 L41 12 L41 28 C41 37 32 43 24 45 C16 43 7 37 7 28 L7 12 Z"
        fill="none"
        stroke={t.accent}
        strokeWidth="0.6"
        strokeOpacity="0.4"
        strokeLinejoin="round"
      />
      <rect x="4" y="8.5" width="40" height="3" rx="1" fill={t.accent} opacity="0.25" />

      {extra ? (
        <>
          <text x="24" y="26" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="12" fill="white" letterSpacing="0">{letters}</text>
          <text x="24" y="36" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="7" fill={t.accent} letterSpacing="1">{extra}</text>
        </>
      ) : (
        <text x="24" y="31" textAnchor="middle" fontFamily="Arial Black, Arial, sans-serif" fontWeight="900" fontSize="14" fill="white" letterSpacing="1">{letters}</text>
      )}

      <path d={path} fill={t.accent} opacity="0.18" transform="translate(0, 0) scale(0.55) translate(20, 22)" />
      <circle cx="12" cy="14" r="1.2" fill={t.accent} opacity="0.6" />
      <circle cx="36" cy="14" r="1.2" fill={t.accent} opacity="0.6" />
    </svg>
  );
}

// ─── Tournament Card ──────────────────────────────────────────────────────────

function TournamentCard({ t }: { t: UpcomingTournament }) {
  return (
    <div
      className="relative bg-[#111113] border rounded-2xl overflow-hidden transition-all duration-200 hover:border-white/20 hover:shadow-[0_0_30px_rgba(0,0,0,0.6)] flex flex-col"
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
        <div
          className="absolute inset-0 opacity-10"
          style={{ backgroundImage: `repeating-linear-gradient(45deg, ${t.accent} 0px, ${t.accent} 1px, transparent 1px, transparent 12px)` }}
        />
        <div className="relative z-10" style={{ width: 88, height: 88 }}>
          <LogoBadge t={t} />
        </div>
        <div
          className="absolute bottom-3 left-3 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-widest"
          style={{ background: `${t.accent}22`, color: t.accent, border: `1px solid ${t.accent}40` }}
        >
          {t.code}
        </div>
        <div className="absolute bottom-3 right-3 px-2 py-0.5 rounded text-[10px] font-semibold bg-white/5 text-white/50 border border-white/10">
          {SPORT_LABEL[t.sport as Sport] ?? t.sport}
        </div>
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Upcoming</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-3 p-4 flex-1">
        <h3 className="font-bold text-sm leading-snug text-white line-clamp-2" style={{ minHeight: "2.5rem" }}>
          {t.name}
        </h3>
        <div className="border-t border-white/5" />
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-white/50">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} />
            <span className="font-medium text-white/70">{t.city}</span>
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
              <span>+ {t.teams} Teams</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-white/50 pt-1 border-t border-white/5">
            <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: t.accent, opacity: 0.8 }} />
            <span>
              <span className="font-bold text-white/80">{t.date ? formatDate(t.date) : "TBD"}</span>
              {t.time && <span className="ml-2 text-white/40">{t.time} IST</span>}
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
  const { brandName } = useBranding();
  const [items, setItems] = useState<UpcomingTournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/display-auctions")
      .then(r => r.json())
      .then((data: DisplayAuction[]) => {
        setItems(data.map(toUpcoming));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-white pt-16">
      <title>Upcoming Auctions | {brandName}</title>

      {/* Nav */}
      <PublicNavbar />

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
                Live franchise auctions happening across India. Powered by BidWar's real-time auction platform.
              </p>
            </div>
            {!loading && items.length > 0 && (
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/8">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
                  <span className="text-xs font-semibold text-white/70">
                    {items.length} Auction{items.length !== 1 ? "s" : ""} Scheduled
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="px-6 pb-20">
        <div className="max-w-6xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="h-72 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
              <Trophy className="w-12 h-12 text-white/10" />
              <p className="text-white/40 text-sm">No upcoming auctions at the moment. Check back soon.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(t => (
                <TournamentCard key={t.id} t={t} />
              ))}
            </div>
          )}
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
              onClick={() => navigate("/organizer?tab=signup")}
              className="px-8 py-3.5 rounded-xl bg-primary text-black font-display font-black text-base hover:bg-primary/90 transition-all hover:shadow-[0_0_30px_rgba(234,179,8,0.35)]"
            >
              Start Free on BidWar
            </button>
          </div>
        </div>
      </section>

      <div className="pb-10 text-center">
        <p className="text-xs text-white/20">
          Tournament dates and details are subject to change. Contact respective organizers for confirmation.
        </p>
      </div>
    </div>
  );
}
