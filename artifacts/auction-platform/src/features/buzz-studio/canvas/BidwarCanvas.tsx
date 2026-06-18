import React from "react";
import { BIDWAR_WATERMARK } from "../assets/watermark";

type BidwarCanvasProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  showWatermark?: boolean;
  showFooterBranding?: boolean;
  showQrPlaceholder?: boolean;
};

export function BidwarCanvas({
  children,
  title,
  subtitle,
  showWatermark = false,
  showFooterBranding = false,
  showQrPlaceholder = false,
}: BidwarCanvasProps) {
  return (
    <div style={styles.root}>
      {/* Premium gold glow ring */}
      <div style={styles.glowRing} aria-hidden="true" />

      {/* Watermark — rendered behind all content */}
      {showWatermark && (
        <span style={styles.watermark} aria-hidden="true">
          {BIDWAR_WATERMARK}
        </span>
      )}

      {/* Card surface */}
      <div style={styles.card}>
        {/* Optional header */}
        {(title || subtitle) && (
          <div style={styles.header}>
            {title && <h2 style={styles.title}>{title}</h2>}
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </div>
        )}

        {/* Arbitrary children */}
        <div style={styles.content}>{children}</div>

        {/* Footer row — branding + optional QR */}
        {(showFooterBranding || showQrPlaceholder) && (
          <div style={styles.footer}>
            {showFooterBranding && (
              <div style={styles.branding}>
                <span style={styles.brandingPrimary}>Powered by BidWar</span>
                <span style={styles.brandingSecondary}>
                  From Auction to Champion
                </span>
              </div>
            )}

            {showQrPlaceholder && (
              <div style={styles.qrBox} aria-label="QR code placeholder">
                <span style={styles.qrLabel}>QR</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Inline styles (no external deps, no theme provider import) ─────────── */

const styles: Record<string, React.CSSProperties> = {
  root: {
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "320px",
    background: "#050505",
    borderRadius: "16px",
    overflow: "hidden",
    padding: "2px",
    boxSizing: "border-box",
  },

  /* Subtle premium gold glow border */
  glowRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "16px",
    background:
      "linear-gradient(135deg, rgba(251,191,36,0.18) 0%, rgba(217,119,6,0.08) 50%, rgba(251,191,36,0.18) 100%)",
    pointerEvents: "none",
    zIndex: 0,
  },

  /* Watermark — absolute, behind children */
  watermark: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-30deg)",
    fontSize: "clamp(4rem, 18vw, 9rem)",
    fontWeight: 900,
    letterSpacing: "0.15em",
    color: "rgba(251,191,36,0.04)",
    userSelect: "none",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    zIndex: 1,
  },

  /* Card surface */
  card: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    background: "#0B0B0B",
    borderRadius: "14px",
    display: "flex",
    flexDirection: "column",
    gap: "0",
    overflow: "hidden",
    boxSizing: "border-box",
  },

  header: {
    padding: "20px 24px 0",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  title: {
    margin: 0,
    fontSize: "1.125rem",
    fontWeight: 700,
    color: "#FBBF24",
    letterSpacing: "0.02em",
  },

  subtitle: {
    margin: 0,
    fontSize: "0.8125rem",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.01em",
  },

  content: {
    padding: "20px 24px",
    flex: 1,
    color: "#FFFFFF",
  },

  /* Footer row */
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 24px 16px",
    borderTop: "1px solid rgba(251,191,36,0.10)",
    gap: "12px",
  },

  branding: {
    display: "flex",
    flexDirection: "column",
    gap: "1px",
  },

  brandingPrimary: {
    fontSize: "0.6875rem",
    fontWeight: 700,
    color: "#FBBF24",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },

  brandingSecondary: {
    fontSize: "0.625rem",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.04em",
  },

  /* QR placeholder */
  qrBox: {
    width: "52px",
    height: "52px",
    border: "1.5px solid rgba(251,191,36,0.35)",
    borderRadius: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  qrLabel: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "rgba(251,191,36,0.5)",
    letterSpacing: "0.08em",
  },
};
