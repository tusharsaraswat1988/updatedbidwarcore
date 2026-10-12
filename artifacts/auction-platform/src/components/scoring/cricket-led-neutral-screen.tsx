/**
 * Cricket Ground LED / Big-Screen Neutral Presentation Screen
 * Rendered on stadium LED boards (/tournament/:id/score-display) during intervals, breaks, or post-match.
 * 
 * Layout Hierarchy:
 * - Header: "POWERED BY" + BIDWAR Official Logo (Dominant Centered Platform Branding)
 * - Mid: Tournament Logo Crest + Grand Tournament Name (Huge High-Contrast Display)
 * - Footer: Tournament Sponsors (Sponsor Name, Logo, and Sponsor Type "thoda bada me" - Large & Prominent)
 */

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { getCricketMasterTeams, listScoringMatches } from "@/lib/scoring-api";
import { isUpcomingCricketMatchStatus } from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { scoreboardSponsorLogo, sponsorsExceptLocked } from "@/lib/cricket-broadcast-plates";
import { motion } from "framer-motion";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { ScoreBoardSponsor } from "@/hooks/use-badminton-branding";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CricketLedNeutralScreenProps {
  tournamentId?: number;
  tournamentName: string;
  tournamentLogoUrl?: string | null;
  sponsors: SponsorLogo[];
  scoreBoardSponsor?: ScoreBoardSponsor | null;
  connectionStatus?: "connected" | "reconnecting" | "disconnected";
  logoSrc?: string;
  logoAlt?: string;
  displayShellStyle?: CSSProperties;
}

export function CricketLedNeutralScreen({
  tournamentId = 0,
  tournamentName,
  tournamentLogoUrl,
  sponsors = [],
  scoreBoardSponsor,
  logoSrc,
  logoAlt = "BidWar",
  displayShellStyle,
}: CricketLedNeutralScreenProps) {
  const locked = useMemo(() => scoreboardSponsorLogo(scoreBoardSponsor), [scoreBoardSponsor]);
  const rotating = useMemo(() => sponsorsExceptLocked(sponsors, locked), [sponsors, locked]);
  const [rotatingIndex, setRotatingIndex] = useState(0);
  useEffect(() => {
    if (rotating.length <= 1) return;
    const timer = setInterval(() => setRotatingIndex((index) => (index + 1) % rotating.length), 5500);
    return () => clearInterval(timer);
  }, [rotating.length]);
  const rotatingSponsor = rotating.length > 0 ? rotating[rotatingIndex % rotating.length] : null;

  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });
  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 60_000,
  });
  const nextMatchLine = useMemo(() => {
    const next = (matches ?? []).find((match) => isUpcomingCricketMatchStatus(match.status));
    if (!next) return null;
    const teams = (masterTeams ?? []).map(cricketMasterTeamToScorerTeam);
    const home = teams.find((team) => team.id === next.homeTeamId)?.name || "Home";
    const away = teams.find((team) => team.id === next.awayTeamId)?.name || "Away";
    return `Next: ${home} vs ${away}`;
  }, [matches, masterTeams]);

  // Title font sizing
  const titleFontSizeClass = useMemo(() => {
    const len = tournamentName.length;
    if (len > 50) return "text-3xl sm:text-5xl md:text-6xl lg:text-7xl";
    if (len > 35) return "text-4xl sm:text-6xl md:text-7xl lg:text-8xl";
    if (len > 20) return "text-5xl sm:text-7xl md:text-8xl lg:text-9xl";
    return "text-6xl sm:text-8xl md:text-9xl lg:text-[7.5rem]";
  }, [tournamentName]);

  return (
    <div
      className="min-h-screen w-full flex flex-col justify-between relative overflow-hidden bg-[#07090e] select-none text-foreground font-sans"
      style={displayShellStyle}
    >
      {/* Ambient Stadium Lighting Gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/12 via-[#07090e]/90 to-[#030406] pointer-events-none" />

      {/* Subtle Background Geometric Stadium Lines */}
      <div className="absolute inset-0 opacity-[0.035] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      {/* 1. TOP HEADER: "POWERED BY BIDWAR LOGO" (Centered & Prominent) */}
      <header className="relative z-20 h-24 sm:h-28 flex items-center justify-between px-6 sm:px-10 border-b border-border/70 bg-card/90 backdrop-blur-md shrink-0 shadow-lg">
        {/* Left balance spacer / Mini Tournament Icon */}
        <div className="w-48 sm:w-60 flex items-center gap-3 shrink-0">
          {tournamentLogoUrl ? (
            <div className="w-12 h-12 rounded-xl bg-black/60 border border-white/20 p-1 flex items-center justify-center overflow-hidden shadow">
              <img
                src={tournamentLogoUrl}
                alt={tournamentName}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
          )}
          <span className="text-xs font-black uppercase tracking-widest text-white/50 hidden sm:inline-block">
            STADIUM LED
          </span>
        </div>

        {/* Center: "POWERED BY - BIDWAR LOGO" */}
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <span className="text-[11px] sm:text-xs font-black uppercase tracking-[0.35em] text-amber-400 font-display mb-1 drop-shadow">
            POWERED BY
          </span>
          <div className="flex items-center justify-center">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={logoAlt || "BidWar"}
                className="h-9 sm:h-11 md:h-12 w-auto object-contain filter drop-shadow-[0_2px_14px_rgba(245,158,11,0.5)]"
              />
            ) : (
              <span className="text-2xl sm:text-3xl font-black uppercase tracking-[0.2em] text-white font-display">
                BID<span className="text-amber-400">WAR</span>
              </span>
            )}
          </div>
        </div>

        {/* Right balance spacer / Connection status */}
        <div className="w-48 sm:w-60 shrink-0" />
      </header>

      {/* 2. MID SECTION: TOURNAMENT NAME (Grand Centered Showcase) */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 sm:px-12 py-8 my-auto">
        {/* Tournament Crest Emblem */}
        {tournamentLogoUrl ? (
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 rounded-3xl bg-card/95 border-2 border-amber-400/50 p-3 shadow-[0_0_45px_rgba(245,158,11,0.3)] flex items-center justify-center overflow-hidden mb-5 shrink-0"
          >
            <img
              src={tournamentLogoUrl}
              alt={tournamentName}
              className="max-h-full max-w-full object-contain filter drop-shadow-md"
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-3xl bg-gradient-to-br from-card via-card/90 to-background border-2 border-amber-400/40 flex flex-col items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.25)] mb-5 shrink-0"
          >
            <Trophy className="w-14 h-14 sm:w-18 sm:h-18 text-amber-400 drop-shadow" />
          </motion.div>
        )}

        {/* Dynamic Auto-Fitting Tournament Name */}
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className={cn(
            "w-full max-w-7xl font-display font-black uppercase tracking-wider text-white text-center leading-[1.08] drop-shadow-[0_4px_35px_rgba(0,0,0,0.95)]",
            titleFontSizeClass,
          )}
        >
          {tournamentName || "BIDWAR PREMIER LEAGUE"}
        </motion.h1>

        {/* Decorative Badge Pill */}
        {nextMatchLine ? (
          <p className="mt-5 text-lg sm:text-2xl font-black uppercase tracking-wide text-amber-300">
            {nextMatchLine}
          </p>
        ) : null}
      </main>

      {(locked || rotatingSponsor) ? (
      <footer className="relative z-20 flex items-center justify-center gap-10 border-t border-white/10 px-8 py-4">
        {locked?.url ? <img src={locked.url} alt={locked.name || ""} className="h-16 w-auto max-w-[180px] object-contain" /> : null}
        {rotatingSponsor?.url ? <img src={rotatingSponsor.url} alt={rotatingSponsor.name || ""} className="h-16 w-auto max-w-[180px] object-contain" /> : null}
        {!locked?.url && locked?.name ? <span className="text-xl font-black uppercase text-white">{locked.name}</span> : null}
        {!rotatingSponsor?.url && rotatingSponsor?.name ? <span className="text-xl font-black uppercase text-white">{rotatingSponsor.name}</span> : null}
      </footer>
      ) : null}
    </div>
  );
}
