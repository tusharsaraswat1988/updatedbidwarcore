import { memo, useEffect, useMemo, useState } from "react";
import type { LedView, LiveSponsorDTO } from "@/lib/led-view/types";
import {
  BROADCAST_CANVAS_HEIGHT,
  BROADCAST_SAFE_LEFT,
  BROADCAST_SAFE_RIGHT,
  SIDE_LED_LAYOUT,
  SPONSOR_CAROUSEL_FADE_MS,
  SPONSOR_CAROUSEL_HOLD_MS,
} from "@/lib/broadcast-canvas/constants";
import {
  getSideLedCategoryBadgeStyle,
  getSideLedCategoryStyle,
  getSideLedKickerStyle,
  getSideLedKickerText,
  getSideLedLogoFrameStyle,
  getSideLedNameSize,
  getSideLedNameStyle,
  getSponsorLogoFilter,
  type SponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";
import {
  preloadImageUrls,
  readSideSponsorCache,
  sponsorListSignature,
  writeSideSponsorCache,
} from "@/lib/side-sponsor-cache";
import { SideBroadcastHeader } from "../broadcast-canvas/SideBroadcastHeader";
import { SideDivider } from "../broadcast-canvas/SideDivider";
import { SideSponsorLogoGlow } from "../broadcast-canvas/SideSponsorLogoGlow";

function sponsorTier(sponsor: LiveSponsorDTO): SponsorBroadcastTier {
  return sponsor.tier ?? "normal";
}

function getDynamicSponsorNameSize(name: string, baseSize: number, tier: SponsorBroadcastTier): number {
  const len = name.trim().length;
  let size = getSideLedNameSize(baseSize, tier);
  if (len > 24) size = Math.round(size * 0.76);
  else if (len > 16) size = Math.round(size * 0.88);
  return size;
}

function useCachedSponsors(tournamentId: number, liveSponsors: LiveSponsorDTO[]) {
  const [sponsors, setSponsors] = useState<LiveSponsorDTO[]>(() => {
    const cached = readSideSponsorCache(tournamentId);
    if (cached?.length) return cached;
    return liveSponsors;
  });

  useEffect(() => {
    if (liveSponsors.length === 0) return;

    const cached = readSideSponsorCache(tournamentId);
    if (cached && sponsorListSignature(cached) === sponsorListSignature(liveSponsors)) {
      setSponsors(cached);
      return;
    }

    writeSideSponsorCache(tournamentId, liveSponsors);
    setSponsors(liveSponsors);
  }, [liveSponsors, tournamentId]);

  return sponsors;
}

function useSponsorCarousel(sponsors: LiveSponsorDTO[]) {
  const entries = useMemo(
    () => sponsors.filter((s) => s.logoUrl.trim() || s.name.trim()),
    [sponsors],
  );
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    setIndex(0);
    setPhase("enter");
  }, [entries.length]);

  useEffect(() => {
    if (entries.length <= 1) {
      setPhase("hold");
      return undefined;
    }

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let enterTimer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    const scheduleHold = () => {
      setPhase("hold");
      holdTimer = setTimeout(() => {
        if (cancelled) return;
        setPhase("exit");
        fadeTimer = setTimeout(() => {
          if (cancelled) return;
          setIndex((i) => (i + 1) % entries.length);
          setPhase("enter");
          enterTimer = setTimeout(() => {
            if (!cancelled) scheduleHold();
          }, SPONSOR_CAROUSEL_FADE_MS);
        }, SPONSOR_CAROUSEL_FADE_MS);
      }, SPONSOR_CAROUSEL_HOLD_MS);
    };

    enterTimer = setTimeout(() => {
      if (!cancelled) scheduleHold();
    }, SPONSOR_CAROUSEL_FADE_MS);

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      if (fadeTimer) clearTimeout(fadeTimer);
      if (enterTimer) clearTimeout(enterTimer);
    };
  }, [entries.length, index]);

  const animationClass =
    phase === "exit"
      ? "broadcast-slate-exit"
      : phase === "enter"
        ? "broadcast-slate-enter"
        : undefined;

  return { entries, index, animationClass };
}

/**
 * IPL-style sponsor slate — fixed canvas layout (1080x1920), no responsive reflow.
 */
export const SideSponsorPanel = memo(function SideSponsorPanel({
  view,
  tournamentId,
}: {
  view: LedView;
  tournamentId: number;
}) {
  const { tournament, branding } = view;
  const sponsors = useCachedSponsors(tournamentId, view.sponsors ?? []);
  const { entries, index, animationClass } = useSponsorCarousel(sponsors);
  const current = entries[index];
  const tier = current ? sponsorTier(current) : "normal";

  useEffect(() => {
    preloadImageUrls(entries.map((s) => s.logoUrl));
  }, [entries]);

  const L = SIDE_LED_LAYOUT;
  const logoPad = 28;
  const logoFrameWidth = L.sponsorLogoWidth;
  const logoFrameHeight = L.sponsorLogoMaxHeight;

  return (
    <>
      <SideBroadcastHeader tournamentName={tournament.name} isTrial={tournament.isTrial} />
      <SideDivider />

      {entries.length > 0 && current ? (
        <div
          key={`${current.name}-${index}`}
          className={animationClass}
          style={{
            position: "absolute",
            left: BROADCAST_SAFE_LEFT,
            right: BROADCAST_SAFE_RIGHT,
            top: L.sponsorKickerTop,
            bottom: BROADCAST_CANVAS_HEIGHT - L.sponsorFooterTop + 40,
            textAlign: "center",
          }}
        >
          {/* Kicker: PROUDLY SUPPORTED BY / TITLE SPONSOR */}
          <p
            className="broadcast-kicker broadcast-sponsor-kicker"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              margin: 0,
              textAlign: "center",
              fontSize: L.sponsorKickerSize,
              lineHeight: 1.1,
              ...getSideLedKickerStyle(tier),
            }}
          >
            {getSideLedKickerText(tier)}
          </p>

          {/* Large-scale Logo Card with Ambient Glow */}
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: L.sponsorLogoTop - L.sponsorKickerTop,
              transform: "translateX(-50%)",
              width: logoFrameWidth,
              height: logoFrameHeight,
            }}
          >
            <SideSponsorLogoGlow width={logoFrameWidth} height={logoFrameHeight} tier={tier} />
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: logoFrameWidth,
                height: logoFrameHeight,
                borderRadius: 24,
                padding: logoPad,
                boxSizing: "border-box",
                zIndex: 1,
                ...getSideLedLogoFrameStyle(tier),
              }}
            >
              {current.logoUrl ? (
                <img
                  src={current.logoUrl}
                  alt={current.name || "Sponsor"}
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: logoFrameWidth - logoPad * 2,
                    height: "100%",
                    maxHeight: logoFrameHeight - logoPad * 2,
                    objectFit: "contain",
                    filter: getSponsorLogoFilter(tier),
                  }}
                />
              ) : (
                <span
                  className="broadcast-sponsor-name"
                  style={{ color: "rgba(0,0,0,0.88)", fontSize: 80, padding: "0 16px", fontWeight: 800 }}
                >
                  {current.name}
                </span>
              )}
            </div>
          </div>

          {/* Sponsor Name: Extra Large, High-Contrast & Bold */}
          <h2
            className="broadcast-sponsor-name"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: L.sponsorNameTop - L.sponsorKickerTop,
              margin: 0,
              padding: "0 20px",
              fontSize: getDynamicSponsorNameSize(current.name, L.sponsorNameSize, tier),
              lineHeight: 1.06,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
              ...getSideLedNameStyle(tier),
            }}
          >
            {current.name.trim() || "\u00a0"}
          </h2>

          {/* Sponsor Category: High-Visibility Illuminated Broadcast Ribbon / Badge */}
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: L.sponsorCategoryTop - L.sponsorKickerTop,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "0 16px",
            }}
          >
            <span
              className="broadcast-category broadcast-sponsor-category-badge"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: L.sponsorCategorySize,
                fontWeight: 800,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                padding: "12px 38px",
                borderRadius: 9999,
                maxWidth: 900,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                ...getSideLedCategoryBadgeStyle(tier),
              }}
            >
              {current.type.trim() || "Partner"}
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            left: 60,
            right: 60,
            top: L.emptyStateTop,
            textAlign: "center",
          }}
        >
          <p
            className="broadcast-tournament-name"
            style={{ fontSize: 72, color: "rgba(255,255,255,0.2)", margin: 0 }}
          >
            SPONSORS
          </p>
          <p
            className="broadcast-kicker broadcast-sponsor-kicker"
            style={{ marginTop: 16, opacity: 0.45 }}
          >
            Partner logos will appear here
          </p>
        </div>
      )}

      <p
        className="broadcast-kicker broadcast-sponsor-footer"
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: L.sponsorFooterTop,
          margin: 0,
          textAlign: "center",
          fontSize: L.sponsorFooterSize,
        }}
      >
        {branding?.poweredByText ?? "Powered by BidWar"}
      </p>
    </>
  );
});
