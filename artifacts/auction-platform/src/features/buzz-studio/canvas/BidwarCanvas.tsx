import React from "react";
import { BIDWAR_WATERMARK } from "../assets/watermark";
import type { BuzzBranding } from "../contracts/branding";
import {
  pickRenderContext,
  type BuzzTemplateRenderProps,
} from "../rendering/buzz-render-context";

type BidwarCanvasProps = BuzzTemplateRenderProps & {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Tournament branding from contract — controls watermark, footer, logos. */
  branding?: BuzzBranding;
  /**
   * Full-bleed background image URL.
   * Injected at render time by the render pipeline from Creative Assets Manager.
   * Never stored inside a creative job contract — resolved externally by aspectRatio.
   */
  backgroundImageUrl?: string;
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
  backgroundImageUrl,
  showWatermark,
  showFooterBranding = false,
  showQrPlaceholder = false,
  renderMode,
  aspectRatio,
  renderWidth,
  renderHeight,
}: BidwarCanvasProps) {
  const resolved = resolveBranding(branding, showWatermark);
  const renderCtx = pickRenderContext({
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  });
  const isPosterFrame = renderCtx != null;

  const rootStyle: React.CSSProperties = isPosterFrame
    ? {
        ...styles.rootPoster,
        width: renderCtx.renderWidth,
        height: renderCtx.renderHeight,
        minHeight: renderCtx.renderHeight,
      }
    : styles.rootLegacy;

  const contentStyle: React.CSSProperties = isPosterFrame
    ? {
        ...styles.contentPoster,
        padding: `${Math.round(renderCtx.renderHeight * 0.028)}px ${Math.round(renderCtx.renderWidth * 0.055)}px`,
      }
    : styles.contentLegacy;

  const footerStyle: React.CSSProperties = isPosterFrame
    ? {
        ...styles.footer,
        marginTop: "auto",
        flexShrink: 0,
        padding: `${Math.round(renderCtx.renderHeight * 0.018)}px ${Math.round(renderCtx.renderWidth * 0.055)}px ${Math.round(renderCtx.renderHeight * 0.028)}px`,
      }
    : styles.footer;

  return (
    <div style={rootStyle}>
      {/* Universal Background Image — full bleed, resolved at render time */}
      {backgroundImageUrl ? (
        <img
          src={backgroundImageUrl}
          alt=""
          aria-hidden="true"
          style={styles.backgroundImage}
        />
      ) : null}

      {resolved.watermarkEnabled ? (
        <span style={styles.watermark} aria-hidden="true">
          {BIDWAR_WATERMARK}
        </span>
      ) : null}

      {/* Branding: corner tournament logo */}
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

      {(title || subtitle) && (
        <div style={styles.header}>
          {title && <h2 style={styles.title}>{title}</h2>}
          {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
        </div>
      )}

      <div style={contentStyle}>{children}</div>

      {(showFooterBranding || showQrPlaceholder) && (
        <div style={footerStyle}>
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
  );
}

const G = "#FBBF24";

const styles: Record<string, React.CSSProperties> = {
  /** Full-bleed poster frame — fills export/preview canvas exactly. */
  rootPoster: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "stretch",
    justifyContent: "flex-start",
    background: "#020202",
    borderRadius: 0,
    overflow: "hidden",
    padding: 0,
    boxSizing: "border-box",
  },

  /** Legacy card shell for dev sandbox without render context. */
  rootLegacy: {
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

  /** Full-bleed background image — sits below all content layers. */
  backgroundImage: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
    zIndex: 0,
    pointerEvents: "none",
  },

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
    position: "relative",
    zIndex: 2,
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

  contentPoster: {
    position: "relative",
    zIndex: 2,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minHeight: 0,
    color: "#FFFFFF",
    boxSizing: "border-box",
  },

  contentLegacy: {
    position: "relative",
    zIndex: 2,
    padding: "18px 22px",
    flex: 1,
    color: "#FFFFFF",
  },

  footer: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 22px 14px",
    borderTop: "1px solid rgba(255,255,255,0.12)",
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
