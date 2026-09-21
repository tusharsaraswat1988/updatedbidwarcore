import { useMemo } from "react";
import { Link } from "wouter";
import {
  CircleDot,
  Flame,
  Zap,
  Radio,
  Trophy,
  CalendarDays,
  Sparkles,
  Users,
  Target,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import {
  isBrandLogoPlaceholderSrc,
  getBrandLogoAlt,
  getBrandLogoSrc,
  getBrandWordmarkSrc,
} from "@/lib/brand-assets";
import type { PublicTournamentMeta, PublicMatch } from "@/lib/public-tournament-types";
import type { CricketScoreboardState } from "@workspace/scoring-core";
import { cn } from "@/lib/utils";

const BIDWAR_HOME_URL = "https://bidwar.in/";

export type TournamentSectionTab = "live" | "matches_stats" | "sponsors" | "fan_arena";

interface TournamentFanHeaderProps {
  tournament: PublicTournamentMeta;
  activeSection: TournamentSectionTab;
  onSelectSection: (section: TournamentSectionTab) => void;
  liveMatch?: PublicMatch | null;
  liveState?: CricketScoreboardState | null;
  teamMap?: Map<number, { name: string; shortCode: string; color: string | null }>;
  liveCount?: number;
  upcomingCount?: number;
  completedCount?: number;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

export function TournamentFanHeader({
  tournament,
  activeSection,
  onSelectSection,
  liveMatch,
  liveState,
  teamMap,
  liveCount = 0,
  upcomingCount = 0,
  completedCount = 0,
  soundEnabled = true,
  onToggleSound,
}: TournamentFanHeaderProps) {
  const { logos, brandName } = useBranding();
  const miniLogoSrc = getBrandLogoSrc(logos, ["mini", "appIcon"]);
  const mainWordmarkSrc = getBrandWordmarkSrc(logos, ["mainReverse", "main"]);
  const logoAlt = getBrandLogoAlt(brandName);

  // Reliable BidWar official logo resolution (never fallback to dev placeholder SVG)
  const brandLogoSrc = useMemo(() => {
    const candidates = [
      logos.mini,
      logos.mainReverse,
      logos.main,
      miniLogoSrc,
      mainWordmarkSrc,
    ];
    for (const c of candidates) {
      if (c && !isBrandLogoPlaceholderSrc(c)) return c;
    }
    return "/assets/branding/bidwar-reverse-logo-official.png";
  }, [logos, miniLogoSrc, mainWordmarkSrc]);

  // Parse sponsor logo for top-right slot
  const topSponsor = useMemo(() => {
    try {
      if (!tournament.sponsorLogos) return null;
      const parsed =
        typeof tournament.sponsorLogos === "string"
          ? JSON.parse(tournament.sponsorLogos)
          : tournament.sponsorLogos;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed[0];
      }
    } catch {}
    return null;
  }, [tournament.sponsorLogos]);

  // Detect special score / match event micro-animations from latest state
  const specialEvent = useMemo(() => {
    if (!liveState) return null;

    // 1. Free Hit active
    if (liveState.freeHitActive) {
      return {
        type: "free_hit",
        label: "⚡ FREE HIT DELIVERY!",
        sub: "No dismissal on this ball except run-out!",
        badgeBg: "bg-amber-500 text-black border-amber-400 animate-pulse",
      };
    }

    // 2. Latest delivery outcome from thisOver
    const deliveries = liveState.thisOver ?? [];
    if (deliveries.length > 0) {
      const last = deliveries[deliveries.length - 1];
      if (last.isWicket) {
        return {
          type: "wicket",
          label: "🚨 OUT! WICKET FALLEN!",
          sub: "Stumps shattered! Big breakthrough for the bowling side!",
          badgeBg: "bg-red-600 text-white border-red-400 animate-bounce",
        };
      }
      if (last.runsOffBat === 6) {
        return {
          type: "six",
          label: "🔥 MAXIMUM! HUGE 6️⃣ OVER THE ROPES!",
          sub: "Monster hit sailed into the crowd!",
          badgeBg: "bg-gradient-to-r from-amber-500 to-yellow-400 text-black border-yellow-300 animate-pulse",
        };
      }
      if (last.runsOffBat === 4) {
        return {
          type: "four",
          label: "💥 BOUNDARY 4️⃣! CRACKING SHOT!",
          sub: "Timed to perfection across the boundary carpet!",
          badgeBg: "bg-emerald-500 text-white border-emerald-300",
        };
      }
    }

    // 3. Toss update
    if (liveState.tossWinnerTeamId != null && liveState.electedTo) {
      const tossTeam = teamMap?.get(liveState.tossWinnerTeamId)?.name || "Team";
      return {
        type: "toss",
        label: `🪙 TOSS: ${tossTeam} won and elected to ${liveState.electedTo.toUpperCase()}`,
        sub: "Match underway with set gameplan!",
        badgeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-400/30",
      };
    }

    return null;
  }, [liveState, teamMap]);

  return (
    <header className="sticky top-0 z-30 -mx-4 px-4 sm:-mx-0 sm:px-0 mb-6 space-y-2">
      <div className="rounded-2xl border border-white/15 bg-black/90 backdrop-blur-xl shadow-2xl overflow-hidden">
        {/* ── ROW 1: TV Broadcast Top Bar (Left: Status/Sound, Center: Prominent BidWar Logo, Right: Sponsor) ─ */}
        <div className="flex items-center justify-between gap-3 px-3.5 py-3 sm:px-6 sm:py-3.5 border-b border-white/10">
          {/* Left: Status Badge + Sound */}
          <div className="flex items-center gap-2 flex-1 justify-start">
            {liveCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400 shadow-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white/60">
                SCHEDULED
              </span>
            )}

            {onToggleSound ? (
              <button
                type="button"
                onClick={onToggleSound}
                className="p-1.5 rounded-xl border border-white/10 bg-white/5 text-white/70 hover:text-white transition-colors"
                title={soundEnabled ? "Mute sounds" : "Enable sounds"}
              >
                {soundEnabled ? (
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-white/40" />
                )}
              </button>
            ) : null}
          </div>

          {/* Center: PROMINENT BIDWAR OFFICIAL GOLDEN GLOWING LOGO */}
          <div className="flex items-center justify-center flex-shrink-0 px-2">
            <a
              href={BIDWAR_HOME_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center group transition-transform hover:scale-105"
              aria-label="BidWar Official Platform"
            >
              <img
                src={brandLogoSrc}
                alt={logoAlt || "BidWar"}
                className="h-8 sm:h-9 md:h-10 w-auto object-contain select-none filter drop-shadow-[0_0_14px_rgba(234,179,8,0.5)] transition-transform hover:scale-105"
              />
            </a>
          </div>

          {/* Right: Sponsor Logo Box or Powered By Badge */}
          <div className="flex items-center justify-end flex-1">
            {topSponsor?.url ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md">
                <span className="text-[9px] uppercase tracking-widest font-black text-amber-400 hidden sm:inline-block">
                  Sponsor
                </span>
                <img
                  src={topSponsor.url}
                  alt={topSponsor.name || "Sponsor"}
                  className="h-5 sm:h-6 max-w-[80px] object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                SPORTS LIVE
              </div>
            )}
          </div>
        </div>

        {/* ── ROW 2: Tournament Name & Official Crest ───────────────── */}
        <div className="px-4 pt-3 pb-2 text-center">
          <div className="w-full max-w-[88%] mx-auto flex items-center justify-center gap-2.5 sm:gap-3">
            {tournament.logoUrl ? (
              <img
                src={tournament.logoUrl}
                alt=""
                className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl object-cover flex-shrink-0 bg-white/5 border border-white/15 shadow-md"
              />
            ) : (
              <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center font-display font-bold text-sm sm:text-base text-emerald-300 flex-shrink-0">
                {tournament.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <h1 className="font-display font-black text-xl sm:text-2xl md:text-3xl text-white tracking-tight line-clamp-2 drop-shadow-md uppercase">
              {tournament.name}
            </h1>
          </div>

          {/* ── ROW 3: Prominent TV-Broadcast Stat Badges ────────────── */}
          <div className="mt-2.5 flex items-center justify-center flex-wrap gap-2 sm:gap-3">
            {/* LIVE */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-sm backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
              <span className="font-display font-black text-xs sm:text-sm tabular-nums leading-none">
                {liveCount}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/85">
                Live
              </span>
            </div>

            {/* UPCOMING */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-sm backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
              <span className="font-display font-black text-xs sm:text-sm tabular-nums leading-none">
                {upcomingCount}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/85">
                Upcoming
              </span>
            </div>

            {/* COMPLETED */}
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-white/70 shadow-sm backdrop-blur-sm">
              <span className="font-display font-black text-xs sm:text-sm tabular-nums leading-none text-white">
                {completedCount}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                Completed
              </span>
            </div>

            {/* Stage */}
            <div className="hidden sm:flex items-center gap-1 px-3 py-1 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[10px] font-bold uppercase tracking-wider">
              <span>{tournament.status || "League Stage"}</span>
            </div>
          </div>
        </div>

        {/* ── ROW 4: Special Moment / Event Micro-Animation Alert ───── */}
        {specialEvent ? (
          <div
            className={cn(
              "flex items-center justify-between gap-2 px-4 py-2 border-t text-xs font-bold transition-all shadow-inner",
              specialEvent.badgeBg,
            )}
          >
            <div className="flex items-center gap-2 truncate">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className="tracking-wide uppercase font-black">{specialEvent.label}</span>
              <span className="hidden md:inline-block font-normal text-[11px] opacity-95">
                — {specialEvent.sub}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-widest font-black shrink-0">
              MOMENT
            </span>
          </div>
        ) : null}

        {/* ── ROW 5: The 4 Professional Top Sections ────────────────── */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 border-t border-white/10 scrollbar-none bg-black/40"
          role="tablist"
        >
          {/* 1. Live Match */}
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === "live"}
            onClick={() => onSelectSection("live")}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border",
              activeSection === "live"
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-400/60 shadow-md ring-1 ring-emerald-400/30"
                : "border-transparent text-white/70 hover:text-white hover:bg-white/5",
            )}
          >
            <CircleDot
              className={cn(
                "h-3.5 w-3.5",
                liveCount > 0 ? "text-red-400 animate-pulse" : "text-emerald-400",
              )}
            />
            <span>Live Match</span>
            {liveCount > 0 ? (
              <span className="ml-1 rounded-full bg-red-500 px-1.5 py-0.2 text-[9px] font-black text-white">
                {liveCount}
              </span>
            ) : null}
          </button>

          {/* 2. Upcoming Match & Stats */}
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === "matches_stats"}
            onClick={() => onSelectSection("matches_stats")}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border",
              activeSection === "matches_stats"
                ? "bg-primary/20 text-primary border-primary/60 shadow-md ring-1 ring-primary/30"
                : "border-transparent text-white/70 hover:text-white hover:bg-white/5",
            )}
          >
            <CalendarDays className="h-3.5 w-3.5 text-sky-400" />
            <span>Upcoming Match & Stats</span>
            {upcomingCount > 0 ? (
              <span className="ml-1 rounded-full bg-white/10 px-1.5 py-0.2 text-[9px] text-white/80">
                {upcomingCount}
              </span>
            ) : null}
          </button>

          {/* 3. Sponsors */}
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === "sponsors"}
            onClick={() => onSelectSection("sponsors")}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border",
              activeSection === "sponsors"
                ? "bg-amber-500/20 text-amber-300 border-amber-400/60 shadow-md ring-1 ring-amber-400/30"
                : "border-transparent text-white/70 hover:text-white hover:bg-white/5",
            )}
          >
            <Trophy className="h-3.5 w-3.5 text-amber-400" />
            <span>Sponsors</span>
          </button>

          {/* 4. Fan Arena */}
          <button
            type="button"
            role="tab"
            aria-selected={activeSection === "fan_arena"}
            onClick={() => onSelectSection("fan_arena")}
            className={cn(
              "flex items-center gap-1.5 shrink-0 rounded-xl px-4 py-2 text-xs font-bold whitespace-nowrap transition-all border",
              activeSection === "fan_arena"
                ? "bg-gradient-to-r from-amber-500/25 to-orange-500/25 text-amber-300 border-amber-400/60 shadow-md ring-1 ring-amber-400/30"
                : "border-transparent text-white/70 hover:text-white hover:bg-white/5",
            )}
          >
            <Flame className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
            <span>Fan Arena</span>
            <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[9px] text-amber-300 font-bold uppercase">
              Cheer
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
