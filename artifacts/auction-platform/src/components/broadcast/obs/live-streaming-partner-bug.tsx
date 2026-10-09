import { useEffect, useState, type CSSProperties } from "react";
import { LIVE_STREAMING_PARTNER_LABEL } from "@/lib/sponsor-logo";

export type LiveStreamingPartnerBugSponsor = {
  name?: string | null;
  logoUrl?: string | null;
};

const SHOW_EVERY_MS = 60_000;
const VISIBLE_MS = 5_000;
const FADE_MS = 600;

/** Hidden, then on screen for 5 seconds at the end of every minute. */
function useMinutePulse(active: boolean): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    let showTimer = 0;
    let hideTimer = 0;
    let cancelled = false;
    const arm = () => {
      showTimer = window.setTimeout(() => {
        if (cancelled) return;
        setVisible(true);
        hideTimer = window.setTimeout(() => {
          if (cancelled) return;
          setVisible(false);
          arm();
        }, VISIBLE_MS);
      }, SHOW_EVERY_MS);
    };
    arm();
    return () => {
      cancelled = true;
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [active]);

  return visible;
}

/**
 * OBS bug for the Live Streaming Partner.
 * Logo, brand name, and the fixed sponsor type fade in for 5 seconds after every minute.
 */
export function LiveStreamingPartnerBug({
  sponsor,
  className,
  style,
}: {
  sponsor?: LiveStreamingPartnerBugSponsor | null;
  className?: string;
  style?: CSSProperties;
}) {
  const name = sponsor?.name?.trim() || "";
  const logoUrl = sponsor?.logoUrl?.trim() || "";
  const active = Boolean(name || logoUrl);
  const visible = useMinutePulse(active);
  if (!active) return null;

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
