/**
 * Cricket OBS Neutral Footer Slate
 * Broadcast footer plate displayed during intervals, breaks, or between matches.
 * Renders in place of the live cricket scorebug:
 * - Tournament Name & Branding
 * - Sponsor Ticker showing Sponsor Name and Sponsor Type (prominently displayed)
 * - Auto-rotating active sponsor spotlight with smooth transitions
 */

import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_SCOREBOARD_PANEL,
  BIDWAR_SCOREBOARD_SHELL,
  BIDWAR_SCOREBOARD_INSET,
} from "@/lib/bidwar-broadcast-colors";
import { BROADCAST_OVERLAY_SAFE_INSET_X } from "@/lib/broadcast-overlay";
import type { CricketObsViewModel } from "@/lib/cricket-obs-view-model";
import { getSponsorCategoryLabel } from "@/components/scoring/score-display-shell";
import { Trophy, Award, Radio } from "lucide-react";

interface Props {
  vm: CricketObsViewModel;
}

export function CricketObsNeutralFooter({ vm }: Props) {
  const [activeSponsorIdx, setActiveSponsorIdx] = useState(0);

  // Normalize sponsors list with fallback
  const sponsorsList = useMemo(() => {
    if (vm.sponsors && vm.sponsors.length > 0) {
      return vm.sponsors.filter((s) => Boolean(s.name || s.url));
    }
    return [];
  }, [vm.sponsors]);

  // Auto-rotate through sponsors every 4.5 seconds
  useEffect(() => {
    if (sponsorsList.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSponsorIdx((prev) => (prev + 1) % sponsorsList.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [sponsorsList.length]);

  const activeSponsor = sponsorsList[activeSponsorIdx] ?? null;
  const activeSponsorType = activeSponsor
    ? getSponsorCategoryLabel(activeSponsor)
    : "OFFICIAL PARTNER";

  return (
    <motion.div
      key="cricket-obs-neutral-footer"
      initial={{ y: 140, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 140, opacity: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex items-stretch border-t-2 shadow-2xl relative select-none"
      style={{
        background: BIDWAR_SCOREBOARD_SHELL,
        borderColor: BIDWAR_BROADCAST_YELLOW,
        height: "128px",
        fontFamily: BROADCAST_FONTS.body,
        paddingLeft: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
        paddingRight: `${BROADCAST_OVERLAY_SAFE_INSET_X}px`,
      }}
    >
      {/* LEFT SECTION: Tournament Identity & Interval Status */}
      <div className="flex items-center gap-4 py-3 min-w-[340px] max-w-[620px] shrink-0 border-r border-white/10 pr-6">
        {/* Tournament Crest / Logo Frame */}
        {vm.tournamentLogoUrl ? (
          <div className="h-16 w-16 rounded-xl bg-black/60 border border-white/20 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
            <img
              src={vm.tournamentLogoUrl}
              alt={vm.tournamentName}
              className="max-h-full max-w-full object-contain filter drop-shadow"
            />
          </div>
        ) : (
          <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-amber-500/20 to-black/80 border border-amber-400/40 p-1 flex flex-col items-center justify-center shrink-0 shadow-lg">
            <Trophy className="w-7 h-7 text-amber-400 drop-shadow" />
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-300 mt-0.5">
              LIVE
            </span>
          </div>
        )}

        {/* Tournament Name & Broadcaster Pill */}
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
              <Radio className="w-2.5 h-2.5 animate-pulse" />
              MATCH INTERVAL
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              OFFICIAL STREAM
            </span>
          </div>
          <h2
            className="text-2xl font-black uppercase tracking-wider text-white truncate leading-tight drop-shadow-md"
            style={{
              fontFamily: BROADCAST_FONTS.display,
              letterSpacing: "0.04em",
            }}
          >
            {vm.tournamentName || "BIDWAR PREMIER LEAGUE"}
          </h2>
        </div>
      </div>

      {/* RIGHT SECTION: Sponsor Ticker (Sponsor Name & Sponsor Type) */}
      <div className="flex-1 flex items-center justify-between pl-6 overflow-hidden">
        {activeSponsor ? (
          <div className="flex items-center justify-between w-full gap-4">
            {/* Active Spotlight Sponsor Plate */}
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="text-right shrink-0 hidden sm:block">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-400/90 block">
                  SPONSORED BY
                </span>
                <span className="text-xs font-bold uppercase tracking-wider text-white/60">
                  FEATURED PARTNER
                </span>
              </div>

              {/* Sponsor Logo */}
              {activeSponsor.url ? (
                <div className="h-14 w-14 rounded-lg bg-white/5 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
                  <img
                    src={activeSponsor.url}
                    alt={activeSponsor.name || "Sponsor"}
                    className="max-h-full max-w-full object-contain filter drop-shadow"
                  />
                </div>
              ) : (
                <div className="h-12 w-12 rounded-lg bg-amber-500/10 border border-amber-400/30 flex items-center justify-center shrink-0">
                  <Award className="w-6 h-6 text-amber-400" />
                </div>
              )}

              {/* Animated Sponsor Name & Sponsor Type */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={`sponsor-spotlight-${activeSponsor.name}-${activeSponsorIdx}`}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.28, ease: "easeInOut" }}
                  className="flex flex-col justify-center min-w-0"
                >
                  <span
                    className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white truncate drop-shadow leading-tight"
                    style={{ fontFamily: BROADCAST_FONTS.display }}
                  >
                    {activeSponsor.name || "TOURNAMENT SPONSOR"}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-block px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/40 text-xs font-black uppercase tracking-wider text-amber-300">
                      {activeSponsorType}
                    </span>
                    {sponsorsList.length > 1 && (
                      <span className="text-[10px] font-bold text-white/40 tracking-wider">
                        ({activeSponsorIdx + 1}/{sponsorsList.length})
                      </span>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Right Mini Marquee / All Sponsors Summary Badges */}
            <div className="hidden lg:flex items-center gap-3 shrink-0 pl-4 border-l border-white/10">
              {sponsorsList.slice(0, 3).map((sp, idx) => (
                <div
                  key={`mini-sp-${idx}`}
                  className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all ${
                    idx === activeSponsorIdx
                      ? "bg-amber-500/20 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                      : "bg-black/30 border-white/10 opacity-60"
                  }`}
                >
                  {sp.url && (
                    <img
                      src={sp.url}
                      alt={sp.name || ""}
                      className="h-6 w-6 object-contain"
                    />
                  )}
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase text-white truncate max-w-[120px]">
                      {sp.name}
                    </span>
                    <span className="text-[9px] font-semibold uppercase text-amber-400/90 truncate max-w-[120px]">
                      {getSponsorCategoryLabel(sp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold uppercase tracking-widest text-white/70">
                OFFICIAL TOURNAMENT BROADCAST
              </span>
              <span className="px-2.5 py-0.5 rounded bg-white/10 text-xs font-bold uppercase tracking-wider text-amber-400">
                LIVE FEED ACTIVE
              </span>
            </div>
            <span className="text-xs font-black uppercase tracking-[0.25em] text-white/40">
              POWERED BY BIDWAR
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
