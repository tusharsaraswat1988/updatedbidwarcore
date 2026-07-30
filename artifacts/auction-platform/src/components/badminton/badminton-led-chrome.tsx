import { memo } from "react";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { useBadmintonBidWarTheme } from "@/components/badminton/bidwar-badminton-branding";
import {
  BIDWAR_BROADCAST_YELLOW,
  BIDWAR_BROADCAST_YELLOW_ON,
  BIDWAR_SCOREBOARD_SHELL,
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

/** Only LIVE / TIMEOUT / FINAL — skip SCHEDULED boxes that steal header height. */
function UrgentStatusDot({
  matchStatus,
  isTimeout,
  isLive,
}: {
  matchStatus: BadmintonMatchState["matchStatus"];
  isTimeout: boolean;
  isLive: boolean;
}) {
  if (isTimeout) {
    return (
      <span className="inline-flex items-center gap-1 bw-label text-[9px] md:text-[10px] text-amber-200 tracking-[0.14em]">
        <span className="size-1.5 rounded-full bg-amber-400 animate-pulse" />
        TIMEOUT
      </span>
    );
  }
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1 bw-label text-[9px] md:text-[10px] text-red-200 tracking-[0.18em]">
        <span className="size-1.5 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
        LIVE
      </span>
    );
  }
  if (matchStatus === "completed") {
    return (
      <span className="bw-label text-[9px] md:text-[10px] text-emerald-200/90 tracking-[0.16em]">
        FINAL
      </span>
    );
  }
  return null;
}

/**
 * LED header — BidWar top-center; tournament logo left + name center;
 * scoreboard sponsor locked to a prominent right rail.
 * `density="slim"` — BWF-style play bug: logo + LIVE only (OBS during rallies).
 */
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
  density = "full",
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
  /** full = venue/break identity; slim = live OBS play bug */
  density?: "full" | "slim";
}) {
  const { logoSrc, logoAlt } = useBadmintonBidWarTheme();
  const showScoreBoardSponsor =
    density === "full" && hasScoreBoardSponsor(scoreBoardSponsor) && scoreBoardSponsor;
  const isLive = matchStatus === "live" && !isTimeout;
  const slim = density === "slim";

  const metaParts = [
    courtNumber?.trim()
      ? courtNumber.toLowerCase().startsWith("court")
        ? courtNumber.trim()
        : `Court ${courtNumber.trim()}`
      : null,
    matchNumber?.trim() ? `Match ${matchNumber.trim()}` : null,
    roundName?.trim() || null,
  ].filter(Boolean) as string[];

  if (slim) {
    return (
      <div
        className="relative z-20 pointer-events-none shrink-0 border-b border-white/15"
        style={{ backgroundColor: BIDWAR_SCOREBOARD_SHELL }}
      >
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-[2%] py-1.5 md:py-2 min-h-[44px]">
          {/* Left — tournament identity only */}
          <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
            {tournamentLogoUrl ? (
              <img
                src={tournamentLogoUrl}
                alt=""
                className="h-8 md:h-9 w-auto max-w-[80px] object-contain shrink-0"
                loading="eager"
                decoding="async"
              />
            ) : null}
            <span className="text-[11px] md:text-xs font-bold text-white uppercase tracking-wide truncate">
              {tournamentName}
            </span>
          </div>

          {/* Center — BidWar wordmark (true midpoint) */}
          <div className="flex flex-col items-center justify-center shrink-0 px-2">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={logoAlt}
                width={200}
                height={48}
                className="block h-8 md:h-9 w-auto max-w-[min(200px,28vw)] object-contain object-center"
                loading="eager"
                decoding="sync"
                fetchPriority="high"
              />
            ) : null}
            {isTimeout ? (
              <span className="bw-caption text-[9px] text-amber-200/85 mt-0.5 text-center">
                TIMEOUT · {timeoutSide === "left" ? leftLabel : rightLabel}
              </span>
            ) : null}
          </div>

          {/* Right — keep empty for balance (no court / LIVE here) */}
          <div className="justify-self-end" aria-hidden />
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-20 pointer-events-none shrink-0 bg-black/45 border-b border-white/10">
      {/* Tournament logo — vertical mid of full header */}
      {tournamentLogoUrl ? (
        <div className="absolute left-[2%] md:left-[2.5%] top-0 bottom-0 z-10 flex items-center">
          <div className="rounded-xl border border-white/12 bg-white/[0.05] p-1.5 md:p-2">
            <img
              src={tournamentLogoUrl}
              alt=""
              className="h-14 md:h-[4.75rem] w-auto max-w-[min(160px,17vw)] object-contain"
            />
          </div>
        </div>
      ) : null}

      {/* Scoreboard sponsor — vertical mid, right rail */}
      {showScoreBoardSponsor ? (
        <div className="absolute right-[2%] md:right-[2.5%] top-0 bottom-0 z-10 flex items-center">
          <ScoreBoardSponsorPanel
            sponsor={scoreBoardSponsor}
            variant="bar"
            className="max-w-[min(300px,26vw)]"
          />
        </div>
      ) : null}

      {/* Center stack — BidWar + tournament name (true screen center) */}
      <div className="flex flex-col items-center pt-3 pb-2 md:pt-4 md:pb-2.5 px-[min(180px,20vw)]">
        {logoSrc ? (
          <img
            src={logoSrc}
            alt={logoAlt}
            className="block h-10 md:h-12 w-auto max-w-[min(260px,36vw)] object-contain shrink-0 mb-1.5 md:mb-2"
            style={{ filter: "drop-shadow(0 2px 14px rgba(0,0,0,0.65))" }}
            loading="eager"
            decoding="async"
          />
        ) : null}
        <span className="bw-tournament-title text-white text-center">
          {tournamentName}
        </span>
        <div className="flex items-center justify-center gap-x-2 gap-y-0.5 flex-wrap max-w-full mt-1">
          {metaParts.length > 0 ? (
            <span className="bw-caption text-[10px] md:text-xs text-white/50 text-center bw-name-full">
              {metaParts.join(" · ")}
            </span>
          ) : null}
          <UrgentStatusDot
            matchStatus={matchStatus}
            isTimeout={isTimeout}
            isLive={isLive}
          />
        </div>
        {isTimeout ? (
          <span className="bw-caption text-[10px] text-amber-200/85 text-center bw-name-full mt-0.5">
            {timeoutSide === "left" ? leftLabel : rightLabel}
          </span>
        ) : null}
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
  density = "full",
  urgencyKind = null,
  tickerPxPerSec,
}: {
  sponsors: SponsorLogo[];
  tournamentName: string;
  className?: string;
  /** OBS overlays use fixed BidWar yellow — display pages follow stage theme. */
  accentMode?: "theme" | "bidwar";
  /** slim = shorter ticker during live play (~7vh vs ~10vh) */
  density?: "full" | "slim";
  /** Replace sponsor scroll with GAME/MATCH POINT strip (venue crowd parity). */
  urgencyKind?: "game" | "match" | null;
  /** OBS CEF throttle — slower px/s */
  tickerPxPerSec?: number;
}) {
  const { brandName, poweredByText, miniSrc, logoAlt } = useBadmintonBidWarTheme();
  const chyronPreset = getBrandSurfacePreset("led-chyron");
  const accentBg = accentMode === "bidwar" ? BIDWAR_BROADCAST_YELLOW : "var(--accent)";
  const accentOn = accentMode === "bidwar" ? BIDWAR_BROADCAST_YELLOW_ON : "var(--accent-on)";
  const slim = density === "slim";
  const crowdMode = urgencyKind === "match" || urgencyKind === "game";

  if (crowdMode) {
    return (
      <div
        className={cn(
          "border-t border-red-500/40 bg-red-600/25 flex items-center justify-center",
          slim
            ? "h-[7vh] min-h-[52px] max-h-[72px]"
            : "h-[10vh] min-h-[72px] max-h-[104px]",
          urgencyKind === "game" && "border-orange-400/45 bg-orange-600/22",
          className,
        )}
      >
        <span
          className={cn(
            "bw-heading tracking-[0.35em]",
            urgencyKind === "match" ? "text-red-100" : "text-orange-100",
            slim ? "text-xl md:text-2xl" : "text-2xl md:text-3xl",
          )}
        >
          {urgencyKind === "match" ? "MATCH POINT" : "GAME POINT"}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-t border-white/10 grid grid-cols-[auto_1fr_auto] items-center gap-4 pr-[3%]",
        slim
          ? "h-[7vh] min-h-[52px] max-h-[72px]"
          : "h-[10vh] min-h-[72px] max-h-[104px]",
        className,
      )}
      style={{ backgroundColor: BIDWAR_SCOREBOARD_SHELL }}
    >
      <div
        className="relative h-full shrink-0 flex items-center px-5 md:px-6"
        style={{
          backgroundColor: accentBg,
          color: accentOn,
          clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)",
        }}
      >
        <div className="flex flex-col leading-none gap-0.5" aria-label="Our Sponsors">
          <span
            className={cn(
              "bw-caption opacity-70",
              slim ? "text-[10px] md:text-xs" : "text-sm md:text-base",
            )}
          >
            Our
          </span>
          <span
            className={cn(
              "bw-caption",
              slim ? "text-[10px] md:text-xs" : "text-sm md:text-base",
            )}
          >
            Sponsors
          </span>
        </div>
      </div>

      <div className="relative overflow-hidden h-full flex items-center min-w-0">
        {sponsors.length > 0 ? (
          <ChyronTickerScroller
            items={sponsors}
            pxPerSec={tickerPxPerSec}
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
