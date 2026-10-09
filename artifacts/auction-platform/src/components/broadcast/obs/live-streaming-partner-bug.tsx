import type { CSSProperties } from "react";
import { LIVE_STREAMING_PARTNER_LABEL } from "@/lib/sponsor-logo";

export type LiveStreamingPartnerBugSponsor = {
  name?: string | null;
  logoUrl?: string | null;
};

/**
 * Permanent OBS bug for the Live Streaming Partner.
 * Stays on the broadcast with logo, brand name, and the fixed sponsor type.
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
  if (!name && !logoUrl) return null;

  return (
    <div
      className={className}
      data-obs-live-streaming-partner=""
      style={{
        position: "absolute",
        zIndex: 32,
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
