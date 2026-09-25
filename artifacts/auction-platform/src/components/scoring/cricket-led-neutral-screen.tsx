/**
 * Cricket Ground LED / Big-Screen Neutral Presentation Screen
 * Rendered on stadium LED boards (/tournament/:id/score-display) during intervals, breaks, or post-match.
 * 
 * Layout Hierarchy:
 * - Header: "POWERED BY" + BIDWAR Official Logo (Dominant Centered Platform Branding)
 * - Mid: Tournament Logo Crest + Grand Tournament Name (Huge High-Contrast Display)
 * - Footer: Tournament Sponsors (Sponsor Name, Logo, and Sponsor Type "thoda bada me" - Large & Prominent)
 */

import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import type { ScoreBoardSponsor } from "@/hooks/use-badminton-branding";
import { getSponsorCategoryLabel } from "@/components/scoring/score-display-shell";
import { Trophy, Award, Sparkles, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CricketLedNeutralScreenProps {
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
  tournamentName,
  tournamentLogoUrl,
  sponsors = [],
  scoreBoardSponsor,
  connectionStatus = "connected",
  logoSrc,
  logoAlt = "BidWar",
  displayShellStyle,
}: CricketLedNeutralScreenProps) {
  // Combine Scoreboard sponsor + tournament sponsors
  const activeSponsorsList = useMemo(() => {
    const list: SponsorLogo[] = [];
    if (
      scoreBoardSponsor &&
      (scoreBoardSponsor.logoUrl || scoreBoardSponsor.name || scoreBoardSponsor.title)
    ) {
      list.push({
        url: scoreBoardSponsor.logoUrl || "",
        name: scoreBoardSponsor.name || "",
        type: scoreBoardSponsor.title || "Scoreboard Sponsor",
        priorityType: scoreBoardSponsor.title || "Scoreboard Sponsor",
        isTitleSponsor: true,
      });
    }
    for (const s of sponsors) {
      if (
        !list.some(
          (existing) =>
            (existing.name && existing.name.toLowerCase() === (s.name || "").toLowerCase()) ||
            (existing.url && existing.url === s.url),
        )
      ) {
        list.push(s);
      }
    }
    return list;
  }, [scoreBoardSponsor, sponsors]);

  // Carousel page index for prominent footer sponsor display
  const [carouselIndex, setCarouselIndex] = useState(0);
  const itemsPerPage = 3;
  const totalPages = Math.max(1, Math.ceil(activeSponsorsList.length / itemsPerPage));

  useEffect(() => {
    if (totalPages <= 1) return;
    const timer = setInterval(() => {
      setCarouselIndex((prev) => (prev + 1) % totalPages);
    }, 5500);
    return () => clearInterval(timer);
  }, [totalPages]);

  const currentVisibleSponsors = useMemo(() => {
    if (activeSponsorsList.length === 0) return [];
    if (activeSponsorsList.length <= itemsPerPage) return activeSponsorsList;
    const start = carouselIndex * itemsPerPage;
    return activeSponsorsList.slice(start, start + itemsPerPage);
  }, [activeSponsorsList, carouselIndex]);

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
        <div className="w-48 sm:w-60 flex items-center justify-end gap-3 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            {connectionStatus === "connected" ? (
              <>
                <Wifi className="w-3.5 h-3.5" /> LIVE DISPLAY
              </>
            ) : connectionStatus === "disconnected" ? (
              <>
                <WifiOff className="w-3.5 h-3.5 text-red-400" /> OFFLINE
              </>
            ) : (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> SYNCING
              </>
            )}
          </span>
        </div>
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
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.2 }}
          className="mt-5 inline-flex items-center gap-2.5 px-6 py-2 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-300 text-sm sm:text-base font-black uppercase tracking-[0.25em] shadow-lg shadow-black/50"
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>OFFICIAL TOURNAMENT BROADCAST</span>
          <Sparkles className="w-4 h-4 text-amber-400" />
        </motion.div>
      </main>

      {/* 3. FOOTER: SPONSORS (Sponsor Name + Logo + Sponsor Type "thoda bada me" - Large & Prominent) */}
      <footer className="relative z-20 bg-[#05070a]/95 border-t-2 border-amber-400/40 backdrop-blur-md shadow-2xl shrink-0 w-full px-6 sm:px-12 py-5 sm:py-6 flex flex-col items-center justify-center">
        {/* Section Tagline */}
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <span className="text-amber-400 font-black text-sm sm:text-base">✦</span>
          <span className="text-xs sm:text-sm font-black uppercase tracking-[0.3em] text-white/70">
            OFFICIAL TOURNAMENT SPONSORS &amp; PARTNERS
          </span>
          <span className="text-amber-400 font-black text-sm sm:text-base">✦</span>
        </div>

        {/* Prominent Large Sponsor Cards Grid ("thoda bada me") */}
        {activeSponsorsList.length > 0 ? (
          <div className="w-full max-w-7xl">
            <AnimatePresence mode="wait">
              <motion.div
                key={`page-${carouselIndex}`}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
                className={cn(
                  "grid gap-4 sm:gap-6 w-full items-stretch justify-center",
                  currentVisibleSponsors.length === 1
                    ? "grid-cols-1 max-w-xl mx-auto"
                    : currentVisibleSponsors.length === 2
                    ? "grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto"
                    : "grid-cols-1 sm:grid-cols-2 md:grid-cols-3",
                )}
              >
                {currentVisibleSponsors.map((sp, idx) => {
                  const typeLabel = getSponsorCategoryLabel(sp);
                  return (
                    <div
                      key={`sponsor-card-${sp.name}-${idx}`}
                      className="flex items-center gap-4 sm:gap-5 p-3.5 sm:p-4 rounded-2xl bg-card/90 border-2 border-border/80 hover:border-amber-400/50 shadow-xl backdrop-blur-sm transition-all"
                    >
                      {/* Sponsor Logo (Large) */}
                      {sp.url ? (
                        <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-22 md:w-22 rounded-xl bg-black/60 border border-white/20 p-2 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                          <img
                            src={sp.url}
                            alt={sp.name || "Sponsor"}
                            className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
                          />
                        </div>
                      ) : (
                        <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-22 md:w-22 rounded-xl bg-amber-500/15 border-2 border-amber-400/40 flex items-center justify-center shrink-0">
                          <Award className="w-9 h-9 text-amber-400 drop-shadow" />
                        </div>
                      )}

                      {/* Sponsor Details (Name + Type in Big Text) */}
                      <div className="flex flex-col justify-center min-w-0 flex-1">
                        {/* Sponsor Name: thoda bada me */}
                        <h3 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider text-white truncate drop-shadow-md leading-tight">
                          {sp.name || "Tournament Partner"}
                        </h3>
                        {/* Sponsor Type: thoda bada me */}
                        <div className="mt-1.5 flex items-center">
                          <span className="inline-block px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-400/50 text-xs sm:text-sm md:text-base font-black uppercase tracking-wider text-amber-300 drop-shadow">
                            {typeLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>

            {/* Pagination dots if more than itemsPerPage sponsors */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCarouselIndex(i)}
                    className={cn(
                      "h-2 rounded-full transition-all duration-300",
                      i === carouselIndex ? "w-6 bg-amber-400" : "w-2 bg-white/30 hover:bg-white/50",
                    )}
                    aria-label={`Page ${i + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 text-center py-2">
            <span className="text-base sm:text-lg font-black uppercase tracking-wider text-white">
              {tournamentName}
            </span>
            <span className="text-amber-400 font-black">•</span>
            <span className="text-sm sm:text-base font-bold uppercase tracking-widest text-amber-400">
              POWERED BY BIDWAR
            </span>
          </div>
        )}
      </footer>
    </div>
  );
}
