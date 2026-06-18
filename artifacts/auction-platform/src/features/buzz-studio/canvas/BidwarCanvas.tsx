import React from "react";
import { BIDWAR_WATERMARK } from "../assets/watermark";
import type { BuzzBranding } from "../contracts/branding";

type BidwarCanvasProps = {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Tournament branding from contract — controls watermark, footer, logos. */
  branding?: BuzzBranding;
  /** Legacy override; when omitted, derived from branding.watermarkEnabled (default true). */
  showWatermark?: boolean;
  showFooterBranding?: boolean;
  showQrPlaceholder?: boolean;
};

function resolveBranding(branding?: BuzzBranding, showWatermark?: boolean) {
  const watermarkEnabled = showWatermark ?? branding?.watermarkEnabled !== false;
  return {
    watermarkEnabled,
    footerPrimary: branding?.poweredByText?.trim() || "POWERED BY BIDWAR",
    footerSecondary: branding?.tagline?.trim()
      ? `◆ ${branding.tagline.trim()} ◆`
      : "◆ From Auction to Champion ◆",
    tournamentLogoUrl: branding?.tournamentLogoUrl,
    sponsorLogoUrl: branding?.sponsorLogoUrl,
    sponsorName: branding?.sponsorName,
  };
}

export function BidwarCanvas({
  children,
  title,
  subtitle,
  branding,
  showWatermark,
  showFooterBranding = false,
  showQrPlaceholder = false,
}: BidwarCanvasProps) {
  const resolved = resolveBranding(branding, showWatermark);

  return (
    <div style={styles.root}>
      {/* Premium luminous gold glow ring — provides the border */}
      <div style={styles.glowRing} aria-hidden="true" />

      {/* Level 1: BIDWAR watermark — large, ultra-low opacity, diagonal */}
      {resolved.watermarkEnabled ? (
        <span style={styles.watermark} aria-hidden="true">
          {BIDWAR_WATERMARK}
        </span>
      ) : null}

      {/* Card surface with 5-layer background system */}
      <div style={styles.card}>

        {/* Level 2: Corner brand mark — top-right, non-intrusive */}
        <div style={styles.cornerBrand} aria-hidden="true">
          {resolved.tournamentLogoUrl ? (
            <img
              src={resolved.tournamentLogoUrl}
              alt=""
              style={styles.cornerTournamentLogo}
            />
          ) : (
            <span style={styles.cornerBrandText}>BW</span>
          )}
        </div>

        {/* Optional title/subtitle header */}
        {(title || subtitle) && (
          <div style={styles.header}>
            {title && <h2 style={styles.title}>{title}</h2>}
            {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
          </div>
        )}

        {/* Template content */}
        <div style={styles.content}>{children}</div>

        {/* Level 3: Premium footer branding */}
        {(showFooterBranding || showQrPlaceholder) && (
          <div style={styles.footer}>
            {showFooterBranding && (
              <div style={styles.branding}>
                {resolved.sponsorLogoUrl ? (
                  <img
                    src={resolved.sponsorLogoUrl}
                    alt={resolved.sponsorName ?? "Sponsor"}
                    style={styles.sponsorLogo}
                  />
                ) : null}
                <span style={styles.brandingPrimary}>{resolved.footerPrimary}</span>
                <span style={styles.brandingSecondary}>{resolved.footerSecondary}</span>
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

/* ─── Inline styles ──────────────────────────────────────────────────────── */
//
// Color constants — avoids importing theme to keep canvas self-contained
// and renderer-safe (no circular imports).
//
const G  = "#FBBF24"; // primaryGold
const G2 = "#D97706"; // secondaryGold

const styles: Record<string, React.CSSProperties> = {

  // Outermost shell — deep black base, provides the 2px glow border gap
  root: {
    position: "relative",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: "320px",
    background: "#020202",
    borderRadius: "18px",
    overflow: "hidden",
    padding: "2px",
    boxSizing: "border-box",
  },

  // Premium gold glow ring — luminous border effect on root outer edge
  glowRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "18px",
    background: `linear-gradient(135deg, ${G}48 0%, ${G2}20 35%, rgba(0,0,0,0) 50%, ${G2}20 65%, ${G}48 100%)`,
    pointerEvents: "none",
    zIndex: 0,
  },

  // Level 1: BIDWAR behind-content watermark
  watermark: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%) rotate(-28deg)",
    fontSize: "clamp(5rem, 22vw, 11rem)",
    fontWeight: 900,
    letterSpacing: "0.18em",
    color: "rgba(251,191,36,0.07)",
    userSelect: "none",
    pointerEvents: "none",
    whiteSpace: "nowrap",
    zIndex: 1,
    fontFamily: "system-ui, sans-serif",
  },

  // Card surface with 5-layer background system:
  //   Layer 5 (top):    edge vignette — dark at corners
  //   Layer 3:          large gold center radial glow
  //   Layer 2:          subtle charcoal diagonal texture lines
  //   Layer 1 (bottom): deep charcoal surface gradient
  card: {
    position: "relative",
    zIndex: 2,
    width: "100%",
    background: [
      // Layer 5: edge vignette
      "radial-gradient(ellipse at center, transparent 38%, rgba(0,0,0,0.65) 100%)",
      // Layer 3: gold center radial glow
      `radial-gradient(ellipse at 50% 38%, rgba(251,191,36,0.09) 0%, transparent 60%)`,
      // Layer 2: charcoal diagonal texture (very subtle)
      "repeating-linear-gradient(-55deg, transparent 0px, transparent 60px, rgba(255,255,255,0.009) 60px, rgba(255,255,255,0.009) 62px)",
      // Layer 1: deep charcoal surface gradient
      "linear-gradient(180deg, #141414 0%, #0c0c0c 50%, #060606 100%)",
    ].join(", "),
    borderRadius: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "0",
    overflow: "hidden",
    boxSizing: "border-box",
  },

  // Level 2: Corner brand mark — barely-visible BW mark, top-right of card
  cornerBrand: {
    position: "absolute",
    top: "8px",
    right: "12px",
    zIndex: 10,
    pointerEvents: "none",
  },

  cornerBrandText: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "0.45rem",
    fontWeight: 900,
    color: "rgba(251,191,36,0.42)",
    letterSpacing: "0.25em",
    userSelect: "none",
    textTransform: "uppercase" as const,
  },

  cornerTournamentLogo: {
    maxWidth: "36px",
    maxHeight: "36px",
    objectFit: "contain" as const,
    display: "block",
  },

  sponsorLogo: {
    maxWidth: "72px",
    maxHeight: "28px",
    objectFit: "contain" as const,
    marginBottom: "4px",
    display: "block",
  },

  header: {
    padding: "20px 22px 0",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },

  title: {
    margin: 0,
    fontSize: "1.125rem",
    fontWeight: 700,
    color: G,
    letterSpacing: "0.02em",
    fontFamily: "system-ui, sans-serif",
  },

  subtitle: {
    margin: 0,
    fontSize: "0.8125rem",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.01em",
    fontFamily: "system-ui, sans-serif",
  },

  // Template content area — slightly tighter padding vs original
  content: {
    padding: "18px 22px",
    flex: 1,
    color: "#FFFFFF",
  },

  // Level 3: Footer with premium typography
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 22px 14px",
    borderTop: "1px solid rgba(251,191,36,0.20)",
    gap: "12px",
  },

  branding: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },

  brandingPrimary: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "0.6875rem",
    fontWeight: 800,
    color: G,
    letterSpacing: "0.14em",
    textTransform: "uppercase" as const,
  },

  brandingSecondary: {
    fontFamily: "system-ui, sans-serif",
    fontSize: "0.5625rem",
    color: "rgba(255,255,255,0.38)",
    letterSpacing: "0.10em",
  },

  qrBox: {
    width: "52px",
    height: "52px",
    border: `1.5px solid rgba(251,191,36,0.35)`,
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
    fontFamily: "system-ui, sans-serif",
  },
};
