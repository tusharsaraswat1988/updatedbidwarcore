import { memo } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { useBadmintonBidWarTheme } from "@/components/badminton/bidwar-badminton-branding";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_ON,
} from "@/lib/bidwar-broadcast-colors";
import {
  ScoreBoardSponsorPanel,
  type ScoreBoardSponsor,
  hasScoreBoardSponsor,
} from "@/components/badminton/score-board-sponsor-panel";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { resolveSponsorPriorityType } from "@/lib/sponsor-logo";
import {
  getSponsorChyronItemStyle,
  getSponsorChyronLogoStyle,
  getSponsorChyronNameStyle,
  getSponsorChyronTypeStyle,
  sponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";
import { ChyronTickerScroller } from "@/components/display/v1/ChyronTickerScroller";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { cn } from "@/lib/utils";

/** Auction LED-style top strip — BidWar reverse logo + tournament + court/match + status. */
export const BadmintonLedTopStrip = memo(function BadmintonLedTopStrip({
  tournamentName,
  tournamentLogoUrl,
  courtNumber,
  matchNumber,
  roundName,
  matchStatus,
  isTimeout,
  timeoutSide,
  leftLabel,
  rightLabel,
  scoreBoardSponsor,
}: {
  tournamentName: string;
  tournamentLogoUrl?: string;
  courtNumber?: string;
  matchNumber?: string;
  roundName?: string;
  matchStatus: BadmintonMatchState["matchStatus"];
  isTimeout: boolean;
  timeoutSide?: string;
  leftLabel: string;
  rightLabel: string;
  scoreBoardSponsor?: ScoreBoardSponsor | null;
}) {
  const { logoSrc, logoAlt } = useBadmintonBidWarTheme();
  const showScoreBoardSponsor = hasScoreBoardSponsor(scoreBoardSponsor) && scoreBoardSponsor;
  const isLive = matchStatus === "live" && !isTimeout;

  return (
    <div className="relative z-20 pointer-events-none shrink-0 bg-black/40 border-b border-white/10">
      {/* Group 1 — BidWar: primary broadcast brand, top-center, generous breathing room */}
      <div className="flex justify-center pt-3 pb-2 md:pt-4 md:pb-2.5">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={logoAlt}
            className="block h-9 md:h-11 w-auto max-w-[min(240px,32vw)] object-contain shrink-0"
            style={{ filter: "drop-shadow(0 2px 12px rgba(0,0,0,0.6))" }}
            loading="eager"
            decoding="async"
          />
        ) : null}
      </div>

      {/* Group 2 — Tournament: secondary to brand, centered below logo */}
      <div className="flex items-center justify-center gap-2 pb-2 md:pb-2.5 px-[3%] min-w-0">
        {tournamentLogoUrl ? (
          <img
            src={tournamentLogoUrl}
            alt=""
            className="h-6 w-auto max-w-[44px] object-contain shrink-0"
          />
        ) : null}
        <div className="flex flex-col items-center leading-none min-w-0">
          <span className="bw-subheading text-white/85 truncate">
            {tournamentName}
          </span>
          {roundName ? (
            <span className="bw-caption text-[9px] text-white/40 mt-1 truncate">
              {roundName}
            </span>
          ) : null}
        </div>
      </div>

      {/* Group 3 — Court / Sponsor / Live: tertiary metadata row */}
      <div className="flex items-center justify-center gap-2 md:gap-3 flex-wrap pb-2 md:pb-2.5 px-[3%]">
        {courtNumber ? (
          <div className="bg-white/8 border border-white/10 rounded px-2 py-0.5 text-center">
            <p className="bw-caption text-[8px] text-white/40">Court</p>
            <p className="bw-meta-lg text-white/80">{courtNumber}</p>
          </div>
        ) : null}
        {matchNumber ? (
          <div className="bg-white/8 border border-white/10 rounded px-2 py-0.5 text-center">
            <p className="bw-caption text-[8px] text-white/40">Match</p>
            <p className="bw-meta-lg text-white/80">{matchNumber}</p>
          </div>
        ) : null}
        {isTimeout ? (
          <div className="bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-1 flex items-center gap-2">
            <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="bw-label text-[10px] md:text-xs text-amber-300">
              Timeout — {timeoutSide === "left" ? leftLabel : rightLabel}
            </span>
          </div>
        ) : null}

        {showScoreBoardSponsor ? (
          <ScoreBoardSponsorPanel
            sponsor={scoreBoardSponsor}
            variant="strip"
            className="max-w-[min(280px,26vw)] shrink-0"
          />
        ) : null}

        {isLive ? (
          <div className="flex items-center gap-2 px-3 py-1.5 border border-red-500/50 bg-red-500/10">
            <span className="size-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]" />
            <span className="bw-label text-[10px] text-red-300">
              Live
            </span>
          </div>
        ) : matchStatus === "completed" ? (
          <div className="border border-green-500/40 bg-green-500/10 px-3 py-1.5">
            <span className="bw-label text-[10px] text-green-300">
              Final
            </span>
          </div>
        ) : (
          <div className="border border-white/15 bg-white/5 px-3 py-1.5">
            <span className="bw-label text-[10px] text-white/55">
              {matchStatus === "scheduled" ? "Scheduled" : "Awaiting"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

/** Auction LED-style chyron — sponsor ticker + BidWar credit (matches ChyronStrip). */
export const BadmintonLedChyron = memo(function BadmintonLedChyron({
  sponsors,
  tournamentName,
  className,
  accentMode = "theme",
}: {
  sponsors: SponsorLogo[];
  tournamentName: string;
  className?: string;
  /** OBS overlays use fixed BidWar yellow — display pages follow stage theme. */
  accentMode?: "theme" | "bidwar";
}) {
  const { brandName, poweredByText, miniSrc, logoAlt } = useBadmintonBidWarTheme();
  const chyronPreset = getBrandSurfacePreset("led-chyron");
  const accentBg = accentMode === "bidwar" ? BIDWAR_BROADCAST_YELLOW : "var(--accent)";
  const accentOn = accentMode === "bidwar" ? BIDWAR_BROADCAST_YELLOW_ON : "var(--accent-on)";

  return (
    <div
      className={cn(
        "border-t border-white/10 bg-black/50 h-[10vh] min-h-[72px] max-h-[104px] grid grid-cols-[auto_1fr_auto] items-center gap-4 pr-[3%]",
        className,
      )}
    >
      <div
        className="relative h-full shrink-0 flex items-center px-5 md:px-6"
        style={{
          backgroundColor: accentBg,
          color: accentOn,
          clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)",
        }}
      >
        <div className="flex flex-col leading-none gap-1" aria-label="Our Sponsors">
          <span className="bw-caption text-sm md:text-base opacity-70">Our</span>
          <span className="bw-caption text-sm md:text-base">Sponsors</span>
        </div>
      </div>

      <div className="relative overflow-hidden h-full flex items-center min-w-0">
        {sponsors.length > 0 ? (
          <ChyronTickerScroller
            items={sponsors}
            renderItem={(s, index) => {
              const tier = sponsorBroadcastTier(resolveSponsorPriorityType(s));
              const typeLabel =
                tier === "title"
                  ? "Title Sponsor"
                  : tier === "co_sponsor"
                    ? "Co Sponsor"
                    : (s.type?.trim() || "Partner");

              const logoStyle = getSponsorChyronLogoStyle(tier);
              const nameStyle = getSponsorChyronNameStyle(tier);
              const typeStyle = getSponsorChyronTypeStyle(tier);

              return (
                <div
                  key={`${s.url}-${index}`}
                  className="flex items-center gap-3.5 shrink-0 h-full py-1.5"
                  style={getSponsorChyronItemStyle(tier)}
                >
                  {s.url ? (
                    <img
                      src={s.url}
                      alt={s.name ?? "Sponsor"}
                      style={{
                        ...logoStyle,
                        maxHeight: tier === "title" ? 58 : 52,
                      }}
                    />
                  ) : null}
                  <div className="flex flex-col leading-none gap-0.5">
                    <span
                      className="bw-label text-lg md:text-xl"
                      style={{
                        ...nameStyle,
                        fontSize:
                          tier === "title"
                            ? "clamp(1.15rem, 1.7vw, 1.45rem)"
                            : tier === "co_sponsor"
                              ? "clamp(1.05rem, 1.55vw, 1.3rem)"
                              : undefined,
                      }}
                    >
                      {s.name?.trim() || typeLabel}
                    </span>
                    {typeLabel ? (
                      <span
                        className="bw-caption text-sm"
                        style={{
                          ...typeStyle,
                          fontSize:
                            tier === "title" ? 13 : tier === "co_sponsor" ? 12 : undefined,
                        }}
                      >
                        {typeLabel}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-white/15 ml-2 text-lg">•</span>
                </div>
              );
            }}
          />
        ) : (
          <div className="bw-caption px-4 text-sm md:text-base text-white/40 truncate">
            {tournamentName}
          </div>
        )}
        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>

      <div className="flex items-center pl-4 border-l border-white/10 shrink-0">
        {miniSrc ? (
          <img
            src={miniSrc}
            alt={logoAlt}
            className={chyronPreset.sizeClass}
            style={{ minWidth: "3.25rem", minHeight: "3.25rem" }}
          />
        ) : (
          <div
            className={cn(chyronPreset.sizeClass, "grid place-items-center")}
            style={{
              backgroundColor: accentBg,
              color: accentOn,
              minWidth: "3.25rem",
              minHeight: "3.25rem",
            }}
          >
            <span className="bw-heading text-lg">BW</span>
          </div>
        )}
      </div>
    </div>
  );
});
