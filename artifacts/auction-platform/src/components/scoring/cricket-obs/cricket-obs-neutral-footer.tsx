import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BROADCAST_FONTS } from "@/components/broadcast/tokens";
import {
  BIDWAR_BROADCAST_YELLOW,
} from "@/lib/bidwar-broadcast-colors";
import {
  type CricketObsViewModel,
  deriveCricketNeutralStatus,
} from "@/lib/cricket-obs-view-model";
import { getSponsorCategoryLabel } from "@/components/scoring/score-display-shell";
import { Trophy, Award, Radio, Sparkles, Shield } from "lucide-react";

interface Props {
  vm: CricketObsViewModel;
}

const SPONSORS_PER_PAGE = 6;
const SPONSOR_PAGE_ROTATION_MS = 3000;

export function CricketObsNeutralFooter({ vm }: Props) {
  // Normalize sponsors list with fallback
  const validSponsors = useMemo(() => {
    if (vm.sponsors && vm.sponsors.length > 0) {
      return vm.sponsors.filter((s) => Boolean(s.name || s.url));
    }
    return [];
  }, [vm.sponsors]);

  const totalPages = Math.max(1, Math.ceil(validSponsors.length / SPONSORS_PER_PAGE));
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (totalPages <= 1) return;
    const interval = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, SPONSOR_PAGE_ROTATION_MS);
    return () => clearInterval(interval);
  }, [totalPages]);

  useEffect(() => {
    setPageIndex(0);
  }, [validSponsors.length]);

  const visibleSponsors = useMemo(() => {
    if (validSponsors.length === 0) return [];
    if (validSponsors.length <= SPONSORS_PER_PAGE) return validSponsors;
    const start = pageIndex * SPONSORS_PER_PAGE;
    return validSponsors.slice(start, start + SPONSORS_PER_PAGE);
  }, [validSponsors, pageIndex]);

  const displayTournamentName = vm.tournamentName || "BIDWAR PREMIER LEAGUE";
  const displayStatus =
    vm.neutralStatusText || deriveCricketNeutralStatus(vm).statusText;

  return (
    <motion.div
      key="cricket-obs-neutral-footer-unified"
      initial={{ y: 180, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 180, opacity: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="w-full flex items-stretch border-t-2 shadow-2xl relative select-none overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0d0f17 0%, #06070b 100%)",
        borderColor: BIDWAR_BROADCAST_YELLOW,
        boxShadow: `0 -10px 40px rgba(0, 0, 0, 0.85), 0 -2px 14px rgba(255, 215, 0, 0.25)`,
        minHeight: "132px",
        fontFamily: BROADCAST_FONTS.body,
      }}
    >
      {/* Top ambient brand lighting */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-16"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(255, 215, 0, 0.15) 0%, transparent 75%)",
        }}
      />

      {/* ── LEFT COLUMN: Bada Tournament Logo (Dono Lines / Full Height) ── */}
      <div
        className="shrink-0 flex items-center justify-center relative z-10"
        style={{
          width: "128px",
          padding: "12px 16px",
          background: "linear-gradient(180deg, rgba(255, 215, 0, 0.08) 0%, rgba(0, 0, 0, 0.5) 100%)",
          borderRight: "1px solid rgba(255, 255, 255, 0.12)",
        }}
      >
        {vm.tournamentLogoUrl ? (
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src={vm.tournamentLogoUrl}
              alt={displayTournamentName}
              className="max-h-[88px] max-w-[96px] object-contain filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)]"
            />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-amber-500/20 to-black/80 border border-amber-400/40 p-1 flex flex-col items-center justify-center shrink-0 shadow-lg">
            <Trophy className="w-9 h-9 text-amber-400 drop-shadow" />
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-300 mt-1">
              BIDWAR
            </span>
          </div>
        )}
      </div>

      {/* ── RIGHT COLUMN: Content (Top Line: Tournament Name + Bottom Line: Sponsors ek seedh me) ── */}
      <div className="flex-1 flex flex-col justify-between py-2.5 px-6 min-w-0 relative z-10">
        {/* Top Row: Tournament Name & Live Status */}
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="flex items-center gap-3.5 min-w-0">
            <h1
              className="truncate text-2xl lg:text-3xl font-black uppercase tracking-wider text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none"
              style={{
                fontFamily: BROADCAST_FONTS.display,
                letterSpacing: "0.05em",
              }}
            >
              {displayTournamentName}
            </h1>

            {/* Status Pill with Pulsing Live Beacon */}
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 shadow-[0_0_12px_rgba(255,215,0,0.18)] shrink-0">
              <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse shrink-0" />
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-amber-300">
                {displayStatus}
              </span>
            </div>
          </div>

          {/* Pagination Dots (for multiple sponsors like 10, 15, 20) */}
          {totalPages > 1 && (
            <div className="hidden lg:flex items-center gap-1.5 shrink-0 pl-4">
              <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest mr-1">
                {pageIndex + 1}/{totalPages}
              </span>
              {Array.from({ length: totalPages }).map((_, idx) => (
                <div
                  key={`page-dot-${idx}`}
                  className="transition-all duration-300"
                  style={{
                    width: idx === pageIndex ? 16 : 5,
                    height: 5,
                    borderRadius: 3,
                    background:
                      idx === pageIndex
                        ? BIDWAR_BROADCAST_YELLOW
                        : "rgba(255, 255, 255, 0.2)",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Hairline Glowing Divider */}
        <div
          className="w-full my-1"
          style={{
            height: "1px",
            background: "linear-gradient(90deg, rgba(255, 215, 0, 0.4) 0%, rgba(255, 215, 0, 0.2) 40%, rgba(255, 255, 255, 0.08) 70%, transparent 100%)",
          }}
        />

        {/* Bottom Row: Sponsors Row (6 per batch, seamless layout, no clipped text) */}
        <div className="w-full flex items-center min-h-[50px] overflow-hidden">
          {validSponsors.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={`sponsors-page-${pageIndex}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="flex items-center justify-between gap-4 lg:gap-6 w-full"
              >
                {visibleSponsors.map((sponsor, idx) => {
                  const isTitle = Boolean(
                    sponsor.isTitleSponsor ||
                      sponsor.priorityType === "TITLE" ||
                      sponsor.type?.toLowerCase().includes("title"),
                  );
                  const sponsorTypeLabel = getSponsorCategoryLabel(sponsor);

                  return (
                    <div
                      key={`cricket-neutral-sp-${sponsor.name || idx}-${pageIndex}`}
                      className="flex items-center gap-2.5 py-1 min-w-0 shrink-0"
                    >
                      {/* Sponsor Logo Box (Frameless / Transparent) */}
                      {sponsor.url ? (
                        <div className="h-9 w-11 shrink-0 flex items-center justify-center overflow-hidden">
                          <img
                            src={sponsor.url}
                            alt={sponsor.name || "Sponsor"}
                            className="max-h-full max-w-full object-contain filter drop-shadow"
                          />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                          {isTitle ? (
                            <Award className="w-4 h-4 text-amber-400" />
                          ) : (
                            <Shield className="w-4 h-4 text-amber-300/80" />
                          )}
                        </div>
                      )}

                      {/* Sponsor Name & Type / Tier (Thinner, Refined Typography, No Cutoff) */}
                      <div className="flex flex-col justify-center min-w-0">
                        <span
                          className="text-[13px] lg:text-[14px] font-semibold uppercase text-white/95 whitespace-nowrap leading-tight tracking-wide"
                          style={{
                            fontFamily: BROADCAST_FONTS.body,
                            letterSpacing: "0.03em",
                          }}
                        >
                          {sponsor.name || "TOURNAMENT SPONSOR"}
                        </span>

                        <span
                          className="text-[10px] font-medium uppercase tracking-wider mt-0.5 whitespace-nowrap leading-none"
                          style={{
                            color: isTitle ? "#FFD700" : "rgba(255, 215, 0, 0.75)",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {sponsorTypeLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </motion.div>
            </AnimatePresence>
          ) : (
            /* No sponsor fallback */
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-xs font-medium uppercase tracking-widest text-white/70">
                OFFICIAL TOURNAMENT BROADCAST FEED
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
