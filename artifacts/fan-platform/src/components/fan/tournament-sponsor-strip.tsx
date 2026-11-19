import React, { useMemo } from "react";
import {
  parseSponsorLogos,
  getSponsorsByPriority,
  SponsorPriorityType,
  type PrioritizedSponsor,
} from "@workspace/api-base/sponsor-priority";
import { cldUrl } from "@/lib/cloudinary";
import {
  ExternalLink,
  ShieldCheck,
  Crown,
  Star,
  Tv,
  Gavel,
  Radio,
  Shirt,
  MapPin,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface TournamentSponsorStripProps {
  sponsorLogos?: string | null;
  tournamentName?: string;
  className?: string;
  variant?: "header" | "compact" | "card";
}

interface TierVisualMeta {
  tierLabel: string;
  badgeClass: string;
  icon: React.ElementType | null;
  isTitle: boolean;
  isCo: boolean;
}

function resolveTierVisualMeta(
  tier: SponsorPriorityType | string,
  typeLabel?: string
): TierVisualMeta {
  const normalizedType = (typeLabel || "").trim().toLowerCase();

  // 1. TITLE SPONSOR
  if (
    tier === SponsorPriorityType.TITLE ||
    normalizedType.includes("title") ||
    normalizedType.includes("presenting")
  ) {
    return {
      tierLabel: "TITLE SPONSOR",
      badgeClass: "",
      icon: Crown,
      isTitle: true,
      isCo: false,
    };
  }

  // 2. CO-SPONSOR
  if (
    tier === SponsorPriorityType.CO_SPONSOR ||
    normalizedType.includes("co-sponsor") ||
    normalizedType.includes("co sponsor") ||
    normalizedType.includes("powered by")
  ) {
    return {
      tierLabel: typeLabel?.trim() || "CO-SPONSOR",
      badgeClass: "",
      icon: Star,
      isTitle: false,
      isCo: true,
    };
  }

  // 3. LIVE STREAMING PARTNER
  if (
    tier === SponsorPriorityType.LIVE_STREAMING_PARTNER ||
    normalizedType.includes("stream") ||
    normalizedType.includes("broadcast")
  ) {
    return {
      tierLabel: "STREAMING PARTNER",
      badgeClass:
        "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
      icon: Tv,
      isTitle: false,
      isCo: false,
    };
  }

  // 4. AUCTION SPONSOR
  if (normalizedType.includes("auction")) {
    return {
      tierLabel: typeLabel?.trim() || "AUCTION SPONSOR",
      badgeClass:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
      icon: Gavel,
      isTitle: false,
      isCo: false,
    };
  }

  // 5. MEDIA / DIGITAL SPONSOR
  if (normalizedType.includes("media") || normalizedType.includes("digital")) {
    return {
      tierLabel: typeLabel?.trim() || "MEDIA SPONSOR",
      badgeClass:
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
      icon: Radio,
      isTitle: false,
      isCo: false,
    };
  }

  // 6. KIT / APPAREL SPONSOR
  if (normalizedType.includes("kit") || normalizedType.includes("apparel")) {
    return {
      tierLabel: typeLabel?.trim() || "KIT SPONSOR",
      badgeClass:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      icon: Shirt,
      isTitle: false,
      isCo: false,
    };
  }

  // 7. VENUE / GROUND / END SPONSOR
  if (normalizedType.includes("venue") || normalizedType.includes("end")) {
    return {
      tierLabel: typeLabel?.trim() || "VENUE SPONSOR",
      badgeClass:
        "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
      icon: MapPin,
      isTitle: false,
      isCo: false,
    };
  }

  // 8. GENERAL / DEFAULT SPONSOR
  return {
    tierLabel: typeLabel?.trim() || "OFFICIAL PARTNER",
    badgeClass:
      "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-400/30",
    icon: Sparkles,
    isTitle: false,
    isCo: false,
  };
}

export function TournamentSponsorStrip({
  sponsorLogos,
  tournamentName,
  className,
  variant = "header",
}: TournamentSponsorStripProps) {
  const sponsors = useMemo(() => {
    if (!sponsorLogos) return [];
    const parsed = parseSponsorLogos(sponsorLogos);
    return getSponsorsByPriority(parsed);
  }, [sponsorLogos]);

  // Construct infinite seamless marquee track:
  // Dual identical halves (`[...half, ...half]`) moving 0% to -50% ensures a 100% gapless loop.
  const marqueeTrack = useMemo(() => {
    if (sponsors.length === 0) return [];
    const minPerHalf = Math.max(4, Math.ceil(12 / sponsors.length));
    const half: PrioritizedSponsor[] = [];
    for (let i = 0; i < minPerHalf; i++) {
      half.push(...sponsors);
    }
    return [...half, ...half];
  }, [sponsors]);

  if (sponsors.length === 0) {
    return null;
  }

  const marqueeDurationSec = Math.max(28, Math.min(60, sponsors.length * 7));

  return (
    <section
      aria-label="Official Tournament Partners"
      className={cn(
        "group relative w-full h-[62px] sm:h-[66px] rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-xl shadow-xs transition-all duration-300 dark:border-white/[0.08] dark:bg-[#0c1220]/95 dark:shadow-xl dark:shadow-black/25 mb-3 sm:mb-4 overflow-hidden flex items-center",
        className
      )}
      data-testid="tournament-sponsor-strip"
    >
      {/* ── Left Fixed Broadcast Anchor (Non-Boxed, Integrated) ── */}
      <div className="relative z-20 flex items-center gap-2 sm:gap-2.5 shrink-0 px-3 sm:px-4 h-full border-r border-slate-200 dark:border-white/10 bg-slate-50/90 dark:bg-[#0c1220] select-none">
        <div className="relative flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/30 shadow-xs">
          <ShieldCheck className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-900 dark:text-white leading-tight">
            Official
          </span>
          <span className="text-[8px] sm:text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest leading-none mt-0.5">
            Partners
          </span>
        </div>
      </div>

      {/* ── Continuous Infinite Marquee with Soft Edge Fade Masks ── */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Official sponsors continuous ticker"
        className="relative z-10 flex-1 min-w-0 h-full overflow-hidden flex items-center focus:outline-none focus:ring-1 focus:ring-amber-500/40"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent 0%, black 44px, black calc(100% - 44px), transparent 100%)",
          maskImage:
            "linear-gradient(to right, transparent 0%, black 44px, black calc(100% - 44px), transparent 100%)",
        }}
      >
        <div
          className="flex animate-marquee group-hover:[animation-play-state:paused] focus-within:[animation-play-state:paused] motion-reduce:animate-none gap-4 sm:gap-6 items-center will-change-transform pl-4"
          style={{ animationDuration: `${marqueeDurationSec}s` }}
        >
          {marqueeTrack.map((sponsor, idx) => {
            const meta = resolveTierVisualMeta(
              sponsor.priorityType,
              sponsor.type
            );
            const TierIcon = meta.icon;
            const website = (sponsor as any).websiteUrl as string | undefined;
            const logoSrc = cldUrl(sponsor.url, "headerLogo") || sponsor.url;
            const hasWebsite = Boolean(
              website &&
                typeof website === "string" &&
                website.startsWith("http")
            );

            // ── Render Card per Tier (NO BOX-IN-BOX for standard, Glamour VIP for Title/Co) ──
            let contentNode: React.ReactNode;

            if (meta.isTitle) {
              // ── 1. TITLE SPONSOR: Radiant Gold Showstopper (Glamourous VIP) ──
              contentNode = (
                <div className="relative flex items-center gap-3 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 dark:from-amber-950/60 dark:via-yellow-950/40 dark:to-amber-950/60 border border-amber-400/80 shadow-[0_0_24px_rgba(245,158,11,0.32)] shrink-0 group/item transition-all duration-300 hover:shadow-[0_0_32px_rgba(245,158,11,0.5)] hover:border-amber-300 select-none">
                  {/* Subtle ambient light aura */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-400 to-yellow-500 rounded-2xl blur-xs opacity-25 group-hover/item:opacity-40 transition-opacity pointer-events-none" />

                  {/* Gold-Ringed Logo Tile */}
                  <div className="relative z-10 flex items-center justify-center h-9 w-13 sm:h-10 sm:w-15 rounded-xl bg-white p-1 shadow-md ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900/40 overflow-hidden shrink-0 transition-transform duration-200 group-hover/item:scale-105">
                    <img
                      src={logoSrc}
                      alt={sponsor.name ? `${sponsor.name} logo` : "Title Sponsor logo"}
                      className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                      loading="lazy"
                    />
                  </div>

                  {/* Typography & Golden VIP Badge */}
                  <div className="relative z-10 flex flex-col justify-center min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 shadow-md shadow-amber-500/30">
                        <Crown className="w-2.5 h-2.5 text-slate-950 fill-slate-950" />
                        <span>TITLE SPONSOR</span>
                      </span>
                      {hasWebsite && (
                        <ExternalLink className="w-2.5 h-2.5 text-amber-300 opacity-70 group-hover/item:opacity-100" />
                      )}
                    </div>

                    <span className="font-display font-black text-xs sm:text-[14px] text-amber-950 dark:text-amber-100 tracking-wide uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] mt-0.5 truncate max-w-[140px] sm:max-w-[190px]">
                      {sponsor.name || "Title Partner"}
                    </span>
                  </div>

                  <Sparkles className="relative z-10 w-3.5 h-3.5 text-amber-300 animate-pulse ml-0.5 shrink-0 hidden sm:block" />
                </div>
              );
            } else if (meta.isCo) {
              // ── 2. CO-SPONSOR: Sapphire / Cyan High Glamour ──
              contentNode = (
                <div className="relative flex items-center gap-2.5 px-3 sm:px-3.5 py-1.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-sky-500/15 via-blue-900/30 to-sky-500/15 dark:from-sky-950/50 dark:via-slate-900/80 dark:to-sky-950/40 border border-sky-400/60 shadow-[0_0_18px_rgba(14,165,233,0.2)] shrink-0 group/item transition-all duration-300 hover:shadow-[0_0_24px_rgba(14,165,233,0.32)] hover:border-sky-300 select-none">
                  {/* Cyan-Ringed Logo Tile */}
                  <div className="relative z-10 flex items-center justify-center h-8.5 w-12 sm:h-9 sm:w-13 rounded-lg sm:rounded-xl bg-white p-1 shadow-sm ring-1.5 ring-sky-400 overflow-hidden shrink-0 transition-transform duration-200 group-hover/item:scale-105">
                    <img
                      src={logoSrc}
                      alt={sponsor.name ? `${sponsor.name} logo` : "Co-Sponsor logo"}
                      className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                      loading="lazy"
                    />
                  </div>

                  {/* Typography & Sapphire Badge */}
                  <div className="relative z-10 flex flex-col justify-center min-w-0 pr-1">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-sky-500 text-white shadow-xs">
                        <Star className="w-2.5 h-2.5 fill-white text-white" />
                        <span>{meta.tierLabel}</span>
                      </span>
                      {hasWebsite && (
                        <ExternalLink className="w-2.5 h-2.5 text-sky-300 opacity-70 group-hover/item:opacity-100" />
                      )}
                    </div>

                    <span className="font-display font-bold text-xs sm:text-[13px] text-slate-900 dark:text-slate-100 uppercase tracking-wide mt-0.5 truncate max-w-[120px] sm:max-w-[160px]">
                      {sponsor.name || "Co-Sponsor"}
                    </span>
                  </div>
                </div>
              );
            } else {
              // ── 3. OTHER SPONSORS: Clean, Open, UNBOXED Broadcast Item (No Box-in-Box!) ──
              contentNode = (
                <div className="flex items-center gap-2.5 px-1 py-1 shrink-0 group/item transition-all duration-200 hover:opacity-100 opacity-90 select-none cursor-pointer">
                  {/* Single Clean Logo Tile on Glass Ribbon (NO dark outer box wrapping it!) */}
                  <div className="flex items-center justify-center h-8.5 w-12 sm:h-9 sm:w-13 rounded-xl bg-white p-1 shadow-xs border border-slate-200 dark:border-white/10 overflow-hidden shrink-0 transition-transform duration-200 group-hover/item:scale-105">
                    <img
                      src={logoSrc}
                      alt={sponsor.name ? `${sponsor.name} logo` : "Sponsor logo"}
                      className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                      loading="lazy"
                    />
                  </div>

                  {/* Micro-Typography */}
                  <div className="flex flex-col justify-center min-w-0 pr-1">
                    <div className="flex items-center gap-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[8.5px] font-bold uppercase tracking-wider border leading-none",
                          meta.badgeClass
                        )}
                      >
                        {TierIcon && (
                          <TierIcon className="w-2 h-2 shrink-0" />
                        )}
                        <span>{meta.tierLabel}</span>
                      </span>
                      {hasWebsite && (
                        <ExternalLink className="w-2 h-2 text-slate-400 opacity-60 group-hover/item:opacity-100" />
                      )}
                    </div>

                    <span className="font-sans font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[115px] sm:max-w-[145px] leading-tight mt-0.5">
                      {sponsor.name || "Partner"}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <React.Fragment key={`${sponsor.url}-${idx}`}>
                {hasWebsite ? (
                  <a
                    href={website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-2xl"
                    title={`Visit ${sponsor.name || "sponsor"} website`}
                  >
                    {contentNode}
                  </a>
                ) : (
                  contentNode
                )}

                {/* Elegant Diamond Divider between entries */}
                <div
                  className="flex items-center justify-center px-1 text-slate-300 dark:text-white/15 shrink-0 select-none"
                  aria-hidden="true"
                >
                  <span className="text-[10px] text-amber-500/40 font-serif">✦</span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default TournamentSponsorStrip;
