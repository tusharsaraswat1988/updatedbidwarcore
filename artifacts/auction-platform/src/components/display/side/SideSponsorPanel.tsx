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
  const logoPad = 16;
  const logoFrameWidth = L.sponsorLogoWidth;
  const logoFrameHeight = L.sponsorLogoMaxHeight;

  return (
    <>
      <SideBroadcastHeader tournamentName={tournament.name} />
      <SideDivider />

      {entries.length > 0 && current ? (
        <>
          <p
            className="broadcast-kicker broadcast-sponsor-kicker"
            style={{
              position: "absolute",
              left: BROADCAST_SAFE_LEFT,
              right: BROADCAST_SAFE_RIGHT,
              top: L.sponsorKickerTop + L.sponsorKickerOffset,
              margin: 0,
              textAlign: "center",
              fontSize: L.sponsorKickerSize,
              ...getSideLedKickerStyle(tier),
            }}
          >
            {getSideLedKickerText(tier)}
          </p>

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
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: L.sponsorLogoTop - L.sponsorKickerTop,
                transform: "translateX(-50%)",
                width: L.sponsorLogoWidth,
                height: L.sponsorLogoMaxHeight,
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
                borderRadius: 12,
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
                    width: L.sponsorLogoWidth - logoPad * 2,
                    maxWidth: L.sponsorLogoWidth - logoPad * 2,
                    height: L.sponsorLogoMaxHeight - logoPad * 2,
                    maxHeight: L.sponsorLogoMaxHeight - logoPad * 2,
                    objectFit: "contain",
                    filter: getSponsorLogoFilter(tier),
                  }}
                />
              ) : (
                <span
                  className="broadcast-sponsor-name"
                  style={{ color: "rgba(0,0,0,0.82)", fontSize: 60, padding: "0 8px" }}
                >
                  {current.name}
                </span>
              )}
            </div>
          </div>

          <p
            className="broadcast-sponsor-name"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: L.sponsorNameTop - L.sponsorKickerTop,
              margin: 0,
              fontSize: getSideLedNameSize(L.sponsorNameSize, tier),
              ...getSideLedNameStyle(tier),
            }}
          >
            {current.name.trim() || "\u00a0"}
          </p>
          <p
            className="broadcast-category broadcast-sponsor-category"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: L.sponsorCategoryTop - L.sponsorKickerTop,
              margin: 0,
              fontSize: L.sponsorCategorySize,
              ...getSideLedCategoryStyle(tier),
            }}
          >
            {current.type.trim() || "Partner"}
          </p>
          </div>
        </>
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
