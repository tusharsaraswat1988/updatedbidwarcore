import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";
import { cldUrl } from "@/lib/cloudinary";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { resolveSponsorPriorityType, SponsorPriorityType } from "@/lib/sponsor-logo";
import {
  getSponsorCaptionNameStyle,
  getSponsorCaptionTypeStyle,
  getSponsorLogoFilter,
  sponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";
import {
  getSponsorCarouselLogoScale,
  getSponsorCarouselRotateMs,
  sortSponsorsForObsTicker,
} from "@/components/broadcast/obs/sponsor-obs-display";

import {
  BROADCAST_OVERLAY_SPONSOR_CAPTION_MAX_WIDTH,
  BROADCAST_OVERLAY_SPONSOR_LOGO_HEIGHT,
  BROADCAST_OVERLAY_SPONSOR_LOGO_MAX_WIDTH,
} from "@/lib/broadcast-overlay";

/** Time each sponsor logo stays visible before rotating. */
export const SPONSOR_CAROUSEL_ROTATE_MS = 4000;
const SPONSOR_CAROUSEL_FADE_MS = 350;

const overlayLogoStyle = (
  height: number,
  tier: ReturnType<typeof sponsorBroadcastTier>,
  maxWidth = BROADCAST_OVERLAY_SPONSOR_LOGO_MAX_WIDTH,
  scale = 1,
): CSSProperties => ({
  display: "block",
  height: height * scale,
  maxWidth: maxWidth * scale,
  width: "auto",
  objectFit: "contain",
  objectPosition: "right center",
  borderRadius: 12,
  filter: getSponsorLogoFilter(tier),
});

/** Caption block under overlay sponsor logo — dark panel sized to text only. */
const overlayCaptionPanelStyle = (): CSSProperties => ({
  marginTop: 4,
  width: "fit-content",
  maxWidth: BROADCAST_OVERLAY_SPONSOR_CAPTION_MAX_WIDTH,
  marginLeft: "auto",
  textAlign: "right",
  pointerEvents: "none",
  backgroundColor: "rgba(0, 0, 0, 0.88)",
  padding: "4px 8px",
  borderRadius: 8,
  boxSizing: "border-box",
});

const overlayCaptionTextStyle = (): CSSProperties => ({
  margin: 0,
  textAlign: "right",
  lineHeight: 1.3,
  textShadow: "0 1px 6px rgba(0,0,0,0.65)",
});

/** Long sponsor names/types wrap on word boundaries — wide caption area, logo unchanged. */
const overlayCaptionWrapStyle = (maxWidth = BROADCAST_OVERLAY_SPONSOR_CAPTION_MAX_WIDTH): CSSProperties => ({
  margin: 0,
  maxWidth,
  width: "100%",
  textAlign: "right",
  whiteSpace: "normal",
  overflowWrap: "break-word",
  wordBreak: "normal",
  lineHeight: 1.3,
  textShadow: "0 1px 6px rgba(0,0,0,0.65)",
});

/**
 * Rotating sponsor logo carousel — top-right of LED / broadcast overlay.
 */
export const SponsorCarousel = memo(function SponsorCarousel({
  logos,
  compact = false,
  overlay = false,
  overlayLogoRow = false,
  rotateMs = SPONSOR_CAROUSEL_ROTATE_MS,
}: {
  logos: SponsorLogo[];
  /** Smaller variant for live viewer header / mobile. */
  compact?: boolean;
  /** Fixed-size bare logo treatment for 1920×1080 broadcast overlay. */
  overlay?: boolean;
  /** Logo-only row — aligns with tournament/BidWar; captions sit below. */
  overlayLogoRow?: boolean;
  rotateMs?: number;
}) {
  const displayLogos = useMemo(
    () => (overlay ? sortSponsorsForObsTicker(logos) : logos),
    [logos, overlay],
  );
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setIdx(0);
    setVisible(true);
  }, [displayLogos]);

  useEffect(() => {
    if (displayLogos.length <= 1) return;
    const current = displayLogos[idx];
    const duration = overlay ? getSponsorCarouselRotateMs(current) : rotateMs;
    const id = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIdx((i) => (i + 1) % displayLogos.length);
        setVisible(true);
      }, SPONSOR_CAROUSEL_FADE_MS);
    }, duration);
    return () => window.clearTimeout(id);
  }, [displayLogos, idx, overlay, rotateMs]);

  if (!displayLogos.length) return null;
  const current = displayLogos[idx];

  const priorityType = resolveSponsorPriorityType(current);
  const tier = sponsorBroadcastTier(priorityType);
  const typeLabel =
    priorityType === SponsorPriorityType.TITLE
      ? "Title Sponsor"
      : priorityType === SponsorPriorityType.CO_SPONSOR
        ? "Co Sponsor"
        : current.type?.trim() || "";

  const nameLabel = current.name?.trim() || "";
  const imgAlt = nameLabel || typeLabel || "Sponsor";
  const logoH = BROADCAST_OVERLAY_SPONSOR_LOGO_HEIGHT;
  const logoScale = overlay ? getSponsorCarouselLogoScale(current) : 1;

  if (overlay && overlayLogoRow) {
    const captionW = BROADCAST_OVERLAY_SPONSOR_CAPTION_MAX_WIDTH;

    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          width: captionW,
          maxWidth: "100%",
          flexShrink: 0,
        }}
      >
        <div
          className="flex items-center justify-end transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0, height: logoH, width: "100%" }}
        >
          <img
            key={current.url}
            src={cldUrl(current.url, "teamLogo")}
            alt={imgAlt}
            style={overlayLogoStyle(logoH, tier, BROADCAST_OVERLAY_SPONSOR_LOGO_MAX_WIDTH, logoScale)}
            loading="eager"
            decoding="async"
            onError={e => (e.currentTarget.style.display = "none")}
          />
        </div>
        {(nameLabel || typeLabel) ? (
          <div style={overlayCaptionPanelStyle()}>
            {nameLabel ? (
              <p
                style={{
                  ...overlayCaptionTextStyle(),
                  ...getSponsorCaptionNameStyle(tier, true),
                }}
              >
                {nameLabel}
              </p>
            ) : null}
            {typeLabel ? (
              <p
                style={{
                  ...overlayCaptionTextStyle(),
                  ...getSponsorCaptionTypeStyle(tier, true),
                  marginTop: nameLabel ? 2 : 0,
                }}
              >
                {typeLabel}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-end flex-shrink-0 ${compact ? "gap-0.5" : overlay ? "gap-1" : "gap-2"}`}>
      {compact ? (
        <div
          className="flex items-center justify-end transition-opacity duration-300"
          style={{ opacity: visible ? 1 : 0, minWidth: 72 }}
        >
          <img
            key={current.url}
            src={cldUrl(current.url, "teamLogo")}
            alt={imgAlt}
            className="h-9 max-w-[88px] object-contain"
            loading="eager"
            decoding="async"
            onError={e => (e.currentTarget.style.display = "none")}
          />
        </div>
      ) : (
        <div
          className={`flex flex-col items-end transition-opacity duration-300 ${overlay ? "" : "gap-2"}`}
          style={{
            opacity: visible ? 1 : 0,
            gap: overlay ? 4 : undefined,
            minWidth: overlay ? undefined : 220,
          }}
        >
          {nameLabel ? (
            overlay ? (
              <p
                style={{
                  ...overlayCaptionWrapStyle(),
                  ...getSponsorCaptionNameStyle(tier, true),
                }}
              >
                {nameLabel}
              </p>
            ) : (
              <p
                className="text-base md:text-lg lg:text-xl font-bold uppercase tracking-[0.12em] text-white text-right max-w-[min(28vw,420px)] break-words"
                style={getSponsorCaptionNameStyle(tier, false)}
              >
                {nameLabel}
              </p>
            )
          ) : null}
          <img
            key={current.url}
            src={cldUrl(current.url, "teamLogo")}
            alt={imgAlt}
            className={
              overlay
                ? undefined
                : "h-20 md:h-28 lg:h-32 max-w-[min(28vw,420px)] object-contain"
            }
            style={
              overlay
                ? overlayLogoStyle(BROADCAST_OVERLAY_SPONSOR_LOGO_HEIGHT, tier, BROADCAST_OVERLAY_SPONSOR_LOGO_MAX_WIDTH, logoScale)
                : { filter: getSponsorLogoFilter(tier) }
            }
            loading="eager"
            decoding="async"
            onError={e => (e.currentTarget.style.display = "none")}
          />
          {typeLabel ? (
            overlay ? (
              <p
                style={{
                  ...overlayCaptionWrapStyle(),
                  ...getSponsorCaptionTypeStyle(tier, true),
                }}
              >
                {typeLabel}
              </p>
            ) : (
              <p
                className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-white/75 text-right max-w-[min(28vw,420px)] break-words"
                style={getSponsorCaptionTypeStyle(tier, false)}
              >
                {typeLabel}
              </p>
            )
          ) : null}
        </div>
      )}
      {!compact && !overlayLogoRow && displayLogos.length > 1 && (
        <div className="flex gap-1.5 justify-end">
          {displayLogos.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{ backgroundColor: i === idx ? "#eab308" : "#ffffff35" }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
