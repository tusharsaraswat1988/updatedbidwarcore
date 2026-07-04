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
import { LED_META_LABEL_CLASS } from "@/lib/led-display-typography";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { cn } from "@/lib/utils";

/** Auction LED-style top strip — BIDWAR LIVE + tournament + court/match + status. */
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
  const showScoreBoardSponsor = hasScoreBoardSponsor(scoreBoardSponsor) && scoreBoardSponsor;
  const isLive = matchStatus === "live" && !isTimeout;

  return (
    <div className="relative z-20 pointer-events-none shrink-0">
      <div
        className={cn(
          "grid items-center gap-3 md:gap-4 px-[3%] border-b border-white/10 bg-black/40",
          showScoreBoardSponsor
            ? "grid-cols-[auto_1fr_auto_auto] h-[9vh] min-h-[64px] max-h-[88px]"
            : "grid-cols-[auto_1fr_auto] h-[8vh] min-h-[56px] max-h-[80px]",
        )}
      >
        <div className="flex items-center gap-3 md:gap-4 min-w-0">
          <div
            className="flex items-center gap-2 px-3 py-1.5 shrink-0"
            style={{ backgroundColor: "var(--accent)" }}
          >
            <span
              className="font-['Bebas_Neue'] text-lg md:text-xl tracking-[0.2em] italic"
              style={{ color: "var(--accent-on)" }}
            >
              BIDWAR
            </span>
            <span
              className="font-['Bebas_Neue'] text-lg md:text-xl tracking-[0.2em] italic"
              style={{ color: "var(--accent-on)" }}
            >
              LIVE
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 border-l border-white/15 pl-4 min-w-0">
            {tournamentLogoUrl ? (
              <img
                src={tournamentLogoUrl}
                alt=""
                className="h-9 w-auto max-w-[72px] object-contain shrink-0"
              />
            ) : null}
            <div className="flex flex-col leading-none min-w-0">
              <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/45">
                Tournament
              </span>
              <span className="font-['Bebas_Neue'] text-sm md:text-base tracking-widest uppercase text-white/95 mt-1 truncate">
                {tournamentName}
              </span>
              {roundName ? (
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/40 mt-0.5 truncate">
                  {roundName}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
          {courtNumber ? (
            <div className="bg-white/8 border border-white/10 rounded px-2.5 py-1 text-center">
              <p className="text-white/40 text-[9px] uppercase tracking-widest">Court</p>
              <p className="text-white font-['Bebas_Neue'] text-lg leading-none">{courtNumber}</p>
            </div>
          ) : null}
          {matchNumber ? (
            <div className="bg-white/8 border border-white/10 rounded px-2.5 py-1 text-center">
              <p className="text-white/40 text-[9px] uppercase tracking-widest">Match</p>
              <p className="text-white font-['Bebas_Neue'] text-lg leading-none">{matchNumber}</p>
            </div>
          ) : null}
          {isTimeout ? (
            <div className="bg-amber-500/20 border border-amber-500/40 rounded-full px-3 py-1 flex items-center gap-2">
              <span className="size-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-amber-300 text-[10px] md:text-xs font-mono uppercase tracking-[0.2em]">
                Timeout — {timeoutSide === "left" ? leftLabel : rightLabel}
              </span>
            </div>
          ) : null}
        </div>

        {showScoreBoardSponsor ? (
          <ScoreBoardSponsorPanel
            sponsor={scoreBoardSponsor}
            variant="strip"
            className="max-w-[min(320px,28vw)] shrink-0 justify-self-end"
          />
        ) : null}

        <div className="flex items-center justify-end shrink-0">
          {isLive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 border border-red-500/50 bg-red-500/10">
              <span className="size-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.35em] text-red-300">
                Live
              </span>
            </div>
          ) : matchStatus === "completed" ? (
            <div className="border border-green-500/40 bg-green-500/10 px-3 py-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.35em] text-green-300">
                Final
              </span>
            </div>
          ) : (
            <div className="border border-white/15 bg-white/5 px-3 py-1.5">
              <span className="text-[10px] font-mono uppercase tracking-[0.35em] text-white/55">
                {matchStatus === "scheduled" ? "Scheduled" : "Awaiting"}
              </span>
            </div>
          )}
        </div>
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
        "border-t border-white/10 bg-black/50 h-[8vh] min-h-[56px] max-h-[80px] grid grid-cols-[auto_1fr_auto] items-center gap-4 pr-[3%]",
        className,
      )}
    >
      <div
        className="relative h-full shrink-0 flex items-center px-4 md:px-5"
        style={{
          backgroundColor: accentBg,
          color: accentOn,
          clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)",
        }}
      >
        <div className="flex flex-col leading-none gap-1" aria-label="Our Sponsors">
          <span className={`${LED_META_LABEL_CLASS} opacity-70`}>Our</span>
          <span className={`${LED_META_LABEL_CLASS} tracking-[0.22em]`}>Sponsors</span>
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

              return (
                <div
                  key={`${s.url}-${index}`}
                  className="flex items-center gap-3 shrink-0 h-full py-1"
                  style={getSponsorChyronItemStyle(tier)}
                >
                  {s.url ? (
                    <img
                      src={s.url}
                      alt={s.name ?? "Sponsor"}
                      style={getSponsorChyronLogoStyle(tier)}
                    />
                  ) : null}
                  <div className="flex flex-col leading-none">
                    <span
                      className="font-['Bebas_Neue'] text-sm tracking-[0.25em] uppercase"
                      style={getSponsorChyronNameStyle(tier)}
                    >
                      {s.name?.trim() || typeLabel}
                    </span>
                    {typeLabel ? (
                      <span
                        className="font-mono uppercase tracking-[0.3em]"
                        style={getSponsorChyronTypeStyle(tier)}
                      >
                        {typeLabel}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-white/15 ml-2">•</span>
                </div>
              );
            }}
          />
        ) : (
          <div className="px-4 text-[10px] font-mono uppercase tracking-[0.4em] text-white/40 truncate">
            {tournamentName}
          </div>
        )}
        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>

      <div className="flex items-center pl-4 border-l border-white/10 shrink-0">
        {miniSrc ? (
          <img src={miniSrc} alt={logoAlt} className={chyronPreset.sizeClass} />
        ) : (
          <div
            className={cn(chyronPreset.sizeClass, "grid place-items-center")}
            style={{ backgroundColor: accentBg, color: accentOn }}
          >
            <span className="font-['Bebas_Neue'] text-sm tracking-tighter italic">BW</span>
          </div>
        )}
      </div>
    </div>
  );
});
