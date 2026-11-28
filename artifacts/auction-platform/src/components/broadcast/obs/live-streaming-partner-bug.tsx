import { useEffect, useState, type CSSProperties } from "react";
import { LIVE_STREAMING_PARTNER_LABEL } from "@/lib/sponsor-logo";

export type LiveStreamingPartnerBugSponsor = {
  name?: string | null;
  logoUrl?: string | null;
};

const SHOW_EVERY_MS = 60_000;
const VISIBLE_MS = 5_000;
const FADE_MS = 600;

/** Hidden, then on screen for 5 seconds periodically, alternating between sponsors. */
function useRotatingPulse(totalItems: number): { visible: boolean; index: number } {
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (totalItems <= 0) {
      setVisible(false);
      setIndex(0);
      return;
    }
    let showTimer = 0;
    let hideTimer = 0;
    let cancelled = false;
    // When there are 2 sponsors, interval is 30s so each sponsor gets shown once every minute.
    const intervalMs = Math.round(SHOW_EVERY_MS / Math.max(1, totalItems));

    const arm = () => {
      showTimer = window.setTimeout(() => {
        if (cancelled) return;
        setVisible(true);
        hideTimer = window.setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          // Wait for fade-out before updating index so the transition is seamless
          window.setTimeout(() => {
            if (!cancelled) {
              setIndex((prev) => (prev + 1) % totalItems);
            }
          }, FADE_MS);
          arm();
        }, VISIBLE_MS);
      }, intervalMs);
    };
    arm();
    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [totalItems]);

  return { visible, index: totalItems > 0 ? index % totalItems : 0 };
}

/**
 * OBS bug for the Live Streaming Partner(s).
 * Logo, brand name, and the fixed sponsor type fade in for 5 seconds periodically.
 * When two Live Streaming Partners are configured, they alternate one after the other.
 */
export function LiveStreamingPartnerBug({
  sponsor,
  sponsors,
  className,
  style,
}: {
  sponsor?: LiveStreamingPartnerBugSponsor | null;
  sponsors?: (LiveStreamingPartnerBugSponsor | null | undefined)[] | null;
  className?: string;
  style?: CSSProperties;
}) {
  const normalizedSponsors: LiveStreamingPartnerBugSponsor[] = (
    sponsors && sponsors.length > 0
      ? sponsors
      : sponsor
        ? [sponsor]
        : []
  ).filter((s): s is LiveStreamingPartnerBugSponsor => Boolean(s?.name?.trim() || s?.logoUrl?.trim()));

  const { visible, index } = useRotatingPulse(normalizedSponsors.length);
  if (normalizedSponsors.length === 0) return null;

  const currentSponsor = normalizedSponsors[index] ?? normalizedSponsors[0];
  const name = currentSponsor?.name?.trim() || "";
  const logoUrl = currentSponsor?.logoUrl?.trim() || "";

  return (
    <div
      className={className}
      data-obs-live-streaming-partner=""
      aria-hidden={visible ? undefined : true}
      style={{
        position: "absolute",
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        gap: 14,
        maxWidth: 520,
        padding: "10px 18px 10px 12px",
        background: "linear-gradient(90deg, rgba(6,8,14,0.96) 0%, rgba(8,10,16,0.9) 100%)",
        borderLeft: "3px solid #FFD700",
        borderTop: "1px solid rgba(255,215,0,0.4)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.62)",
        pointerEvents: "none",
        ...style,
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={name || LIVE_STREAMING_PARTNER_LABEL}
          style={{
            height: 64,
            width: "auto",
            maxWidth: 148,
            objectFit: "contain",
            display: "block",
            filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.75))",
          }}
        />
      ) : null}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#FFD700",
            lineHeight: 1.15,
            fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
            textShadow: "0 1px 3px rgba(0,0,0,0.85)",
          }}
        >
          {LIVE_STREAMING_PARTNER_LABEL}
        </span>
        {name ? (
          <span
            style={{
              marginTop: 3,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "0.02em",
              color: "#ffffff",
              lineHeight: 1.05,
              maxWidth: 320,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
              textShadow: "0 2px 8px rgba(0,0,0,0.9)",
            }}
          >
            {name}
          </span>
        ) : null}
      </div>
    </div>
  );
}
