import { memo, useEffect, useMemo, useState } from "react";
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
import { resolveSponsorPriorityType, SponsorPriorityType } from "@/lib/sponsor-logo";
import {
  getSponsorChyronItemStyle,
  getSponsorChyronNameStyle,
  getSponsorChyronTypeStyle,
  sponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";
import { ChyronTickerScroller } from "@/components/display/v1/ChyronTickerScroller";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { cn } from "@/lib/utils";

const HEADER_LOGO_ROTATE_MS = 4500;
const HEADER_LOGO_FADE_MS = 400;

type HeaderLogoSlide = {
  key: string;
  url: string;
  /** "Title Sponsor" / "Co Sponsor" / "Tournament" */
  typeLabel: string;
  /** Display name under the type */
  name: string;
  /** Tournament slide shows logo only — no type/name text underneath. */
  isTournament?: boolean;
};

/** Tournament → title sponsor → co-sponsor, fade loop in the left header slot. */
function buildHeaderLogoSlides(
  tournamentLogoUrl: string | undefined,
  tournamentName: string | undefined,
  sponsors: SponsorLogo[],
): HeaderLogoSlide[] {
  const slides: HeaderLogoSlide[] = [];
  const tournament = tournamentLogoUrl?.trim();
  if (tournament) {
    slides.push({
      key: `tournament:${tournament}`,
      url: tournament,
      typeLabel: "Tournament",
      name: tournamentName?.trim() || "Tournament",
      isTournament: true,
    });
  }

  const withUrl = sponsors.filter((s) => !!s.url?.trim());
  const titles = withUrl.filter(
    (s) => resolveSponsorPriorityType(s) === SponsorPriorityType.TITLE,
  );
  const coSponsors = withUrl.filter(
    (s) => resolveSponsorPriorityType(s) === SponsorPriorityType.CO_SPONSOR,
  );

  for (const s of titles) {
    slides.push({
      key: `title:${s.url}`,
      url: s.url,
      typeLabel: "Title Sponsor",
      name: s.name?.trim() || "Title Sponsor",
    });
  }
  for (const s of coSponsors) {
    slides.push({
      key: `co:${s.url}`,
      url: s.url,
      typeLabel: "Co Sponsor",
      name: s.name?.trim() || "Co Sponsor",
    });
  }

  // Deduplicate by URL while keeping order (tournament first).
  const seen = new Set<string>();
  return slides.filter((slide) => {
    if (seen.has(slide.url)) return false;
    seen.add(slide.url);
    return true;
  });
}

const HeaderLogoRotator = memo(function HeaderLogoRotator({
  tournamentLogoUrl,
  tournamentName,
  sponsorLogos,
  size = "full",
}: {
  tournamentLogoUrl?: string;
  tournamentName?: string;
  sponsorLogos: SponsorLogo[];
  size?: "full" | "slim";
}) {
  const slides = useMemo(
    () => buildHeaderLogoSlides(tournamentLogoUrl, tournamentName, sponsorLogos),
    [tournamentLogoUrl, tournamentName, sponsorLogos],
  );
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIdx(0);
    setVisible(true);
  }, [slides]);

  useEffect(() => {
    if (slides.length <= 1) return;
    let swapId = 0;
    const holdId = window.setTimeout(() => {
      setVisible(false);
      swapId = window.setTimeout(() => {
        setIdx((i) => (i + 1) % slides.length);
        setVisible(true);
      }, HEADER_LOGO_FADE_MS);
    }, HEADER_LOGO_ROTATE_MS);
    return () => {
      window.clearTimeout(holdId);
      window.clearTimeout(swapId);
    };
  }, [slides, idx]);

  if (slides.length === 0) return null;
  const current = slides[Math.min(idx, slides.length - 1)];
  const slim = size === "slim";
  const title = current.isTournament ? current.name : `${current.typeLabel}: ${current.name}`;

  return (
    <div
      className={cn(
        "rounded-xl border border-white/12 bg-white/[0.05] overflow-hidden max-h-full",
        slim ? "p-1" : "p-1 md:p-1.5",
      )}
      title={title}
    >
      {/* Logo on top, type/name stacked below — kept short (not just narrow) so the
          card fits inside the header's own height and never spills into the
          content below it. */}
      <div
        className={cn(
          "flex flex-col items-center text-center transition-opacity ease-in-out",
          slim ? "gap-0.5" : "gap-0.5 md:gap-1",
        )}
        style={{
          opacity: visible ? 1 : 0,
          transitionDuration: `${HEADER_LOGO_FADE_MS}ms`,
        }}
      >
        <img
          key={current.key}
          src={current.url}
          alt={title}
          className={
            // Tournament slide has no type/name text underneath — the freed-up
            // space goes straight to the logo instead of sitting empty.
            current.isTournament
              ? slim
                ? "h-9 md:h-10 w-auto max-w-[84px] object-contain shrink-0"
                : "h-12 md:h-14 w-auto max-w-[min(110px,11vw)] object-contain shrink-0"
              : slim
                ? "h-7 md:h-8 w-auto max-w-[64px] object-contain shrink-0"
                : "h-8 md:h-9 w-auto max-w-[min(88px,9vw)] object-contain shrink-0"
          }
          loading="eager"
          decoding="async"
        />
        {!current.isTournament ? (
          <div className="min-w-0 flex flex-col items-center leading-tight gap-0.5">
            <span
              className={cn(
                "bw-caption uppercase tracking-[0.16em] text-[#ffd700]/90 font-bold bw-name-full",
                slim ? "text-[8px]" : "text-[9px]",
              )}
            >
              {current.typeLabel}
            </span>
            <span
              className={cn(
                "font-bold text-white bw-name-full text-center",
                slim
                  ? "text-[10px] md:text-[11px] max-w-[80px] truncate"
                  : "text-[11px] md:text-xs max-w-[min(120px,11vw)] truncate",
              )}
            >
              {current.name}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
});

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
      <span className="inline-flex items-center gap-1.5 bw-label text-[11px] md:text-xs text-amber-200 tracking-[0.14em]">
        <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
        TIMEOUT
      </span>
    );
  }
  if (isLive) {
    return (
      <span className="inline-flex items-center gap-1.5 bw-label text-[11px] md:text-xs text-red-200 tracking-[0.18em]">
        <span className="size-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]" />
        LIVE
      </span>
    );
  }
  if (matchStatus === "completed") {
    return (
      <span className="bw-label text-[11px] md:text-xs text-emerald-200/90 tracking-[0.16em]">
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
  sponsorLogos = [],
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
  /** Title / co-sponsor logos — fade-loop with tournament logo on the left. */
  sponsorLogos?: SponsorLogo[];
  /** full = venue/break identity; slim = live OBS play bug */
  density?: "full" | "slim";
}) {
  const { logoSrc, logoAlt } = useBadmintonBidWarTheme();
  const showScoreBoardSponsor =
    density === "full" && hasScoreBoardSponsor(scoreBoardSponsor) && scoreBoardSponsor;
  const isLive = matchStatus === "live" && !isTimeout;
  const slim = density === "slim";
  const headerSlides = useMemo(
    () => buildHeaderLogoSlides(tournamentLogoUrl, tournamentName, sponsorLogos),
    [tournamentLogoUrl, tournamentName, sponsorLogos],
  );

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
          {/* Left — tournament / title / co-sponsor fade loop */}
          <div className="flex items-center gap-2.5 min-w-0 justify-self-start">
            {headerSlides.length > 0 ? (
              <HeaderLogoRotator
                tournamentLogoUrl={tournamentLogoUrl}
                tournamentName={tournamentName}
                sponsorLogos={sponsorLogos}
                size="slim"
              />
            ) : null}
            {headerSlides.length === 0 ? (
              <span className="text-[11px] md:text-xs font-bold text-white uppercase tracking-wide truncate">
                {tournamentName}
              </span>
            ) : null}
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
      {/* Left logo — tournament → title → co-sponsor fade loop */}
      {headerSlides.length > 0 ? (
        <div className="absolute left-[2%] md:left-[2.5%] top-0 bottom-0 z-10 flex items-center py-1.5 overflow-hidden">
          <HeaderLogoRotator
            tournamentLogoUrl={tournamentLogoUrl}
            tournamentName={tournamentName}
            sponsorLogos={sponsorLogos}
            size="full"
          />
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
            <span className="bw-caption text-xs md:text-sm text-white/65 text-center bw-name-full">
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
  accentMode = "bidwar",
  density = "full",
  urgencyKind = null,
  tickerPxPerSec,
}: {
  sponsors: SponsorLogo[];
  tournamentName: string;
  className?: string;
  /** Default BidWar yellow; pass `theme` only when a stage accent override is required. */
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
        // Softer top border + slightly shorter rail — match info stays the visual hero
        "border-t border-white/[0.06] grid grid-cols-[auto_1fr_auto] items-center gap-4 pr-[3%]",
        slim
          ? "h-[6.5vh] min-h-[48px] max-h-[66px]"
          : "h-[8.5vh] min-h-[64px] max-h-[92px]",
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

              const nameStyle = getSponsorChyronNameStyle(tier);
              const typeStyle = getSponsorChyronTypeStyle(tier);

              return (
                <div
                  key={`${s.url}-${index}`}
                  className="flex items-center gap-3.5 shrink-0 h-full py-1.5"
                  style={getSponsorChyronItemStyle(tier)}
                >
                  {/* Logos are unreadable on LED walls at distance — show name + title only. */}
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
