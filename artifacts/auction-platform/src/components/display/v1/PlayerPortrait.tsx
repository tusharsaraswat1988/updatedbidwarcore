import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { User, UserRound } from "lucide-react";
import type { LedView } from "@/lib/led-view/types";
import type { PlayerGender } from "@/lib/led-view/player-gender";
import { hasUsablePortrait } from "@/lib/led-view/player-gender";
import {
  buildPortraitInfoRows,
  portraitSpecGridClass,
} from "@/lib/led-view/portrait-footer-stats";
import { cldUrl } from "@/lib/cloudinary";
import {
  PortraitPlayerTagBadge,
  PortraitPlayerTagGlow,
  portraitTagFrameStyle,
  resolvePortraitPlayerTag,
} from "./portrait-player-tag";
import { usePlayerAuctionHistory } from "@/components/player-auction-history";
import { isLedHistoryEnabled } from "@workspace/platform-core";
import { formatIndianRupee, type AuctionUnit } from "@/lib/format";

function formatLedAmount(amount: number, unit?: AuctionUnit): string {
  if (unit === "points") {
    if (amount >= 100000) {
      const l = amount / 100000;
      return `${Number.isInteger(l) ? l : l.toFixed(2).replace(/\.?0+$/, "")} LAKH pts`;
    }
    return `${amount.toLocaleString("en-IN")} pts`;
  }
  if (amount >= 10000000) {
    return `₹${(amount / 10000000).toFixed(2).replace(/\.?0+$/, "")} CR`;
  }
  if (amount >= 100000) {
    const l = amount / 100000;
    return `₹${Number.isInteger(l) ? l : l.toFixed(2).replace(/\.?0+$/, "")} LAKH`;
  }
  return formatIndianRupee(amount, unit);
}

export function LedPlayerHistoryBanner({
  tournamentId,
  playerId,
  features,
  auctionUnit,
}: {
  tournamentId?: number;
  playerId?: string | number | null;
  features?: unknown;
  auctionUnit?: AuctionUnit;
}) {
  const numericPlayerId = typeof playerId === "string" ? parseInt(playerId, 10) : playerId;
  const isEnabled = Boolean(
    tournamentId &&
    numericPlayerId &&
    !isNaN(numericPlayerId) &&
    numericPlayerId > 0 &&
    isLedHistoryEnabled(features as any)
  );

  const { data: history } = usePlayerAuctionHistory({
    tournamentId: tournamentId ?? 0,
    playerId: numericPlayerId,
    enabled: isEnabled,
  });

  if (!isEnabled || !history?.bestSoldRecord) {
    return null;
  }

  const { bestSoldRecord, lastSoldRecord, hasTop5Badge, isBestTop5 } = history;
  const isTop5 = hasTop5Badge || isBestTop5 || bestSoldRecord.isTop5 || lastSoldRecord?.isTop5;
  const isSameEvent = Boolean(
    bestSoldRecord &&
    lastSoldRecord &&
    (
      (history.records && history.records.length <= 1) ||
      (history.totalSoldAppearances && history.totalSoldAppearances <= 1) ||
      String(bestSoldRecord.tournamentId) === String(lastSoldRecord.tournamentId) ||
      (bestSoldRecord.soldPrice === lastSoldRecord.soldPrice && bestSoldRecord.tournamentName === lastSoldRecord.tournamentName)
    )
  );

  return (
    <div
      data-led-player-history-banner
      className="mt-2 pt-2 border-t-2 border-[#d4af37]/40 flex flex-col gap-1 transition-opacity duration-300"
    >
      <p className="text-xs sm:text-sm font-black uppercase tracking-[0.16em] text-amber-400 font-['Space_Grotesk'] leading-none">
        HISTORICAL AUCTION PERFORMANCE
      </p>

      {isSameEvent ? (
        <div className="flex flex-col gap-1">
          <div className="text-amber-300 font-black text-sm sm:text-base lg:text-lg tracking-wide uppercase font-['Space_Grotesk'] leading-snug">
            PAST HIGHEST &amp; LAST AUCTION:{" "}
            <span className="font-mono text-emerald-400 font-black text-base sm:text-lg lg:text-xl">
              {formatLedAmount(bestSoldRecord.soldPrice, auctionUnit)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 leading-snug">
            {lastSoldRecord?.buyingTeamName ? (
              <span className="text-white font-extrabold text-xs sm:text-sm tracking-wide font-['Space_Grotesk'] uppercase break-words">
                BOUGHT BY: {lastSoldRecord.buyingTeamName}
              </span>
            ) : null}
            {bestSoldRecord.tournamentName ? (
              <span className="text-white/80 font-bold text-xs sm:text-sm tracking-wide font-['Space_Grotesk'] uppercase">
                ({bestSoldRecord.tournamentName})
              </span>
            ) : null}
            {isTop5 ? (
              <span className="inline-flex items-center gap-1 bg-[#d4af37] text-black font-black text-xs px-2.5 py-0.5 rounded shadow-sm tracking-wide uppercase">
                🏆 PAST TOURNAMENT TOP 5
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-amber-300 font-black text-sm sm:text-base lg:text-lg tracking-wide uppercase font-['Space_Grotesk'] leading-snug">
              HIGHEST PRICE IN PAST AUCTIONS:{" "}
              <span className="font-mono text-emerald-400 font-black text-base sm:text-lg lg:text-xl">
                {formatLedAmount(bestSoldRecord.soldPrice, auctionUnit)}
              </span>
            </span>
            {isTop5 ? (
              <span className="inline-flex items-center gap-1 bg-[#d4af37] text-black font-black text-xs px-2.5 py-0.5 rounded shadow-sm tracking-wide uppercase">
                🏆 PAST TOURNAMENT TOP 5
              </span>
            ) : null}
          </div>

          {lastSoldRecord ? (
            <div className="flex flex-col gap-0.5">
              <div className="text-white font-extrabold text-xs sm:text-sm tracking-wide font-['Space_Grotesk'] uppercase leading-snug">
                PRICE IN MOST RECENT AUCTION:{" "}
                <span className="font-mono text-amber-200 font-black">
                  {formatLedAmount(lastSoldRecord.soldPrice, auctionUnit)}
                </span>
              </div>
              {lastSoldRecord.buyingTeamName ? (
                <div className="text-white/85 font-bold text-xs sm:text-sm tracking-wide font-['Space_Grotesk'] uppercase leading-snug break-words">
                  BOUGHT BY: {lastSoldRecord.buyingTeamName}
                  {lastSoldRecord.tournamentName ? ` (${lastSoldRecord.tournamentName})` : ""}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/**
 * PLAYER PORTRAIT — unobstructed photo above with identity, spec grid, and history below.
 * Base price lives in BidCenter only.
 */
export const PlayerPortrait = memo(function PlayerPortrait({
  view,
}: {
  view: LedView;
}) {
  const { currentPlayer, roleLabel } = view;
  const [photoFailed, setPhotoFailed] = useState(false);

  const infoRows = useMemo(
    () =>
      currentPlayer
        ? buildPortraitInfoRows(currentPlayer.age, currentPlayer.specs)
        : [],
    [currentPlayer],
  );

  useEffect(() => {
    setPhotoFailed(false);
  }, [currentPlayer?.id, currentPlayer?.portrait]);

  if (!currentPlayer) return null;

  const tag = resolvePortraitPlayerTag(currentPlayer.playerTag);
  const frameStyle = portraitTagFrameStyle(tag);
  const showPhoto = hasUsablePortrait(currentPlayer.portrait) && !photoFailed;
  const specGridClass = portraitSpecGridClass(infoRows.length);

  return (
    <div
      className="@container/portrait flex flex-col h-full min-h-0 overflow-hidden bg-black/60 border-2"
      style={frameStyle}
    >
      {/* 1. Unobstructed photo section with top anchor to prevent head cut */}
      <div className="relative h-[52%] shrink-0 min-h-0 w-full overflow-hidden bg-black/40">
        {showPhoto ? (
          <img
            src={cldUrl(currentPlayer.portrait, "playerCard")}
            alt={currentPlayer.name}
            className="w-full h-full object-cover object-top"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-white/[0.06] via-black/20 to-black/70">
            <GenderPortraitIcon gender={currentPlayer.gender} />
          </div>
        )}

        {tag ? <PortraitPlayerTagGlow tag={tag} /> : null}

        <div className="absolute top-3 right-3 z-30">
          <div
            className="size-11 sm:size-13 grid place-items-center font-['Bebas_Neue'] text-lg sm:text-xl italic shadow-2xl"
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--accent-on)",
            }}
          >
            #{currentPlayer.serialNo}
          </div>
        </div>

        {tag ? (
          <div className="absolute top-3 left-3 z-20 max-w-[calc(100%-4rem)]">
            <PortraitPlayerTagBadge tag={tag} />
          </div>
        ) : null}

        <div
          className="absolute top-0 left-0 h-1 w-16 z-10"
          style={{ backgroundColor: "var(--accent)" }}
        />
      </div>

      {/* 2. Structured stadium-readable information area below photograph */}
      <div className="flex-1 min-h-0 flex flex-col justify-start gap-2.5 sm:gap-3 p-3 sm:p-4 bg-gradient-to-b from-black/95 via-black/90 to-black/85 border-t-2 border-amber-500/40 overflow-hidden">
        <div>
          <PortraitPlayerName name={currentPlayer.name} />
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-['Space_Grotesk'] text-base sm:text-lg font-extrabold uppercase tracking-[0.06em]">
            <span style={{ color: "var(--accent)" }}>{roleLabel}</span>
            {currentPlayer.city ? (
              <>
                <span className="text-white/40 font-normal">•</span>
                <span className="text-white/90 font-mono tracking-[0.06em]">
                  {currentPlayer.city}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {infoRows.length > 0 ? (
          <div className="pt-2 border-t border-white/15">
            <p className="text-xs sm:text-sm font-black uppercase tracking-[0.16em] text-amber-400/90 mb-1.5 font-['Space_Grotesk']">
              PLAYER SPECIFICATIONS
            </p>
            <div className={`grid ${specGridClass} gap-x-4 gap-y-1.5`}>
              {infoRows.map((row, index) => (
                <SpecRow
                  key={`${row.label}-${index}`}
                  shortLabel={row.shortLabel}
                  fullLabel={row.label}
                  value={row.value}
                  className={
                    infoRows.length > 2 &&
                    infoRows.length % 2 === 1 &&
                    index === infoRows.length - 1
                      ? "col-span-2"
                      : undefined
                  }
                />
              ))}
            </div>
          </div>
        ) : null}

        <LedPlayerHistoryBanner
          tournamentId={view.tournament?.id}
          playerId={currentPlayer.id}
          features={view.tournament?.featuresJson}
          auctionUnit={view.tournament?.auctionUnit}
        />
      </div>
    </div>
  );
});

function PortraitPlayerName({ name }: { name: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const fit = () => {
      text.style.fontSize = "";
      const maxPx = parseFloat(getComputedStyle(text).fontSize);
      const minPx = 20;
      let lo = minPx;
      let hi = maxPx;
      let best = minPx;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        text.style.fontSize = `${mid}px`;
        if (text.scrollWidth <= container.clientWidth) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      text.style.fontSize = `${best}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [name]);

  return (
    <div ref={containerRef} className="w-full">
      <h2
        ref={textRef}
        className="w-max max-w-full led-player font-['Bebas_Neue'] text-[clamp(2.2rem,3.8cqw,3.8rem)] leading-[0.88] uppercase text-white tracking-tight whitespace-nowrap font-bold"
      >
        {name}
      </h2>
    </div>
  );
}

function GenderPortraitIcon({ gender }: { gender: PlayerGender }) {
  const className =
    "w-[clamp(3rem,50cqw,7rem)] h-[clamp(3rem,50cqw,7rem)] text-white/20";
  if (gender === "female") {
    return <UserRound className={className} strokeWidth={1.15} aria-hidden />;
  }
  return <User className={className} strokeWidth={1.15} aria-hidden />;
}

function SpecRow({
  shortLabel,
  fullLabel,
  value,
  className,
}: {
  shortLabel: string;
  fullLabel: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`min-w-0 flex items-baseline gap-1.5 leading-snug ${className ?? ""}`}>
      <span
        className="led-label text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white/70 font-['Space_Grotesk'] shrink-0"
        title={fullLabel}
      >
        {shortLabel}:
      </span>
      <span
        className="led-value font-mono text-sm sm:text-base lg:text-lg font-black tabular-nums uppercase truncate"
        style={{ color: "var(--accent)" }}
      >
        {value}
      </span>
    </div>
  );
}
