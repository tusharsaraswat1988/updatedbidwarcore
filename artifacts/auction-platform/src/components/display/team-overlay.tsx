import { memo } from "react";
import { motion } from "framer-motion";
import { Wallet, Gavel, Star } from "lucide-react";
import { formatShortIndianRupee } from "@/lib/format";
import { cldUrl } from "@/lib/cloudinary";
import type { PurseRow } from "./types";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoAlt, getObsBrandMarkSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";

const teamOverlayPreset = getBrandSurfacePreset("led-team-overlay");

/**
 * Overlay 1 — IPL-style TEAM PURSE STATUS table.
 *
 * Columns: Team | Total Purse | Spendable | Reserve | Max/Player | Squad
 * Scrollable when teams overflow the viewport.
 * BidWar brand mark fixed top-right.
 */
export const TeamOverlay = memo(function TeamOverlay({
  purses,
  currentBidTeamId,
  tournamentName,
}: {
  purses: PurseRow[];
  currentBidTeamId?: number | null;
  tournamentName?: string;
}) {
  const { logos, brandName, iconVersion } = useBranding();
  const logoAlt = getBrandLogoAlt(brandName);
  const brandLogoSrc = getObsBrandMarkSrc(logos, iconVersion);
  return (
    <div
      className="absolute inset-0 z-40 flex flex-col select-none overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at top, #1e1b4b 0%, #020617 60%, #000 100%)",
      }}
    >
      {/* dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle, #fff 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="relative flex-shrink-0 pt-5 pb-3 px-8 flex items-center justify-between">
        {/* Title — centred visually */}
        <div className="flex-1 flex items-center justify-center gap-4">
          <Wallet className="w-7 h-7 md:w-9 md:h-9 text-primary flex-shrink-0" />
          <div className="text-center">
            <h1
              className="font-display font-black text-3xl md:text-5xl lg:text-6xl tracking-tight text-primary leading-none"
              style={{ textShadow: "0 0 40px rgba(234,179,8,0.5)" }}
            >
              TEAM PURSE STATUS
            </h1>
            {tournamentName && (
              <p className="text-[11px] md:text-sm font-bold uppercase tracking-[0.3em] text-white/50 mt-1">
                {tournamentName}
              </p>
            )}
          </div>
          <Wallet className="w-7 h-7 md:w-9 md:h-9 text-primary flex-shrink-0" />
        </div>

        {/* BidWar brand mark — top right */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 flex items-center">
          <img
            src={brandLogoSrc}
            alt={logoAlt}
            className={teamOverlayPreset.sizeClass}
            loading="eager"
            decoding="async"
          />
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="relative flex-1 px-4 md:px-8 pb-6 overflow-hidden">
        <div className="h-full rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm flex flex-col">

          {/* Column headers */}
          <div
            className="flex-shrink-0 grid gap-x-3 px-4 md:px-6 py-3 border-b border-white/15
                        text-[10px] md:text-xs font-bold uppercase tracking-widest text-white/50"
            style={{ gridTemplateColumns: "3fr 1.6fr 1.6fr 1.4fr 1.6fr 1.3fr" }}
          >
            <div>Team</div>
            <div className="text-right">Total Purse</div>
            <div className="text-right">Current Spendable</div>
            <div className="text-right">Reserve</div>
            <div className="text-right">Max / Player</div>
            <div className="text-center">Squad</div>
          </div>

          {/* Scrollable rows */}
          <div className="flex-1 overflow-y-auto">
            {purses.map((team, i) => {
              const color = team.color || "#F59E0B";
              const isLeading = currentBidTeamId === team.teamId;

              const currentSpendable = team.spendablePurse ?? team.purseRemaining;
              const maxOnPlayer = Math.max(0, team.maxAllowedBid ?? team.purseRemaining);
              const reserve = team.futureReservePurse ?? team.reservePurse ?? 0;
              const slotsNeeded = team.futureSlotsRequired ?? team.slotsRequired ?? 0;
              const maxSquad = team.maximumSquadSize ?? 0;
              const squadFull = maxSquad > 0 && team.playersBought >= maxSquad;

              return (
                <motion.div
                  key={team.teamId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  className="grid gap-x-3 px-4 md:px-6 py-3 md:py-4 items-center border-b border-white/5 last:border-b-0"
                  style={{
                    gridTemplateColumns: "3fr 1.6fr 1.6fr 1.4fr 1.6fr 1.3fr",
                    backgroundColor: isLeading
                      ? `${color}22`
                      : i % 2 === 0
                        ? "rgba(255,255,255,0.015)"
                        : "transparent",
                    boxShadow: isLeading
                      ? `inset 4px 0 0 ${color}, inset 0 0 30px ${color}22`
                      : undefined,
                  }}
                >
                  {/* Team name + logo */}
                  <div className="flex items-center gap-2 md:gap-3 min-w-0">
                    {team.logoUrl ? (
                      <img
                        src={cldUrl(team.logoUrl, "teamLogo")}
                        alt={team.teamName}
                        className="w-9 h-9 md:w-12 md:h-12 rounded-lg object-contain flex-shrink-0"
                        style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))" }}
                        loading="eager"
                        decoding="async"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 md:w-12 md:h-12 rounded-lg flex items-center justify-center font-display font-black text-xs md:text-sm flex-shrink-0"
                        style={{
                          backgroundColor: `${color}30`,
                          color,
                          border: `2px solid ${color}66`,
                        }}
                      >
                        {team.shortCode}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-display font-black text-sm md:text-lg leading-tight truncate text-white">
                        {team.teamName}
                      </p>
                      <p
                        className="text-[10px] md:text-xs font-bold"
                        style={{ color: `${color}cc` }}
                      >
                        {team.shortCode}
                      </p>
                      {team.topPlayerName && (
                        <p className="text-[9px] md:text-[10px] text-white/40 leading-tight truncate flex items-center gap-0.5 mt-0.5">
                          <Star className="w-2 h-2 flex-shrink-0 text-amber-400/60" />
                          <span className="truncate">{team.topPlayerName}</span>
                          {team.topPlayerAmount != null && (
                            <span className="flex-shrink-0 text-amber-400/70 font-mono">
                              {" "}{formatShortIndianRupee(team.topPlayerAmount)}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    {isLeading && (
                      <div
                        className="w-2 h-2 rounded-full animate-pulse flex-shrink-0 ml-1"
                        style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
                      />
                    )}
                  </div>

                  {/* Total Purse */}
                  <div className="text-right">
                    <p className="text-sm md:text-lg font-display font-black tabular-nums text-white/60">
                      {formatShortIndianRupee(team.purse)}
                    </p>
                  </div>

                  {/* Spendable */}
                  <div className="text-right">
                    <p
                      className="text-base md:text-2xl font-display font-black tabular-nums"
                      style={{ color, textShadow: `0 0 18px ${color}66` }}
                    >
                      {formatShortIndianRupee(currentSpendable)}
                    </p>
                  </div>

                  {/* Reserve */}
                  <div className="text-right">
                    {reserve > 0 ? (
                      <p className="text-sm md:text-lg font-display font-black tabular-nums text-amber-400">
                        {formatShortIndianRupee(reserve)}
                      </p>
                    ) : (
                      <p className="text-sm md:text-base font-bold tabular-nums text-white/25">—</p>
                    )}
                  </div>

                  {/* Max / Player */}
                  <div className="text-right">
                    {squadFull ? (
                      <p className="text-sm font-bold text-red-400/70">FULL</p>
                    ) : (
                      <p
                        className="text-sm md:text-xl font-display font-black tabular-nums text-emerald-400"
                        style={{ textShadow: "0 0 14px rgba(52,211,153,0.5)" }}
                      >
                        {formatShortIndianRupee(maxOnPlayer)}
                      </p>
                    )}
                  </div>

                  {/* Squad */}
                  <div className="text-center">
                    {maxSquad > 0 ? (
                      <>
                        <p
                          className={`text-base md:text-xl font-display font-black tabular-nums leading-tight ${
                            squadFull
                              ? "text-red-400"
                              : slotsNeeded > 0
                                ? "text-amber-400"
                                : "text-white"
                          }`}
                        >
                          {team.playersBought}
                          <span className="text-[10px] md:text-xs opacity-50 font-bold">
                            {" / "}{maxSquad}
                          </span>
                        </p>
                        {slotsNeeded > 0 && !squadFull && (
                          <p className="text-[8px] md:text-[10px] text-amber-400/70 leading-none mt-0.5">
                            need {slotsNeeded}
                          </p>
                        )}
                        {squadFull && (
                          <p className="text-[8px] md:text-[10px] text-red-400 font-bold leading-none mt-0.5">
                            FULL
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-base md:text-xl font-display font-black tabular-nums text-white">
                        {team.playersBought}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});
