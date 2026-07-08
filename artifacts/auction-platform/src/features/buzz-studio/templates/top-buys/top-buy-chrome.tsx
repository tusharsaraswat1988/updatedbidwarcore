/**
 * Top Buy — reusable HTML/CSS poster components.
 * Pure CSS recreation of the official Canva reference (no background image).
 */

import React from "react";
import { BIDWAR_REVERSE_LOGO_URL } from "../../assets/bidwar-brand";
import { monogramFor } from "../../asset-engine/monogram-generator";
import type { BuzzRenderContext } from "../../rendering/buzz-render-context";
import { isLandscapePoster } from "../../rendering/poster-layout";
import "./top-buy-chrome.css";

/* ── Premium gold particles — positioned in periphery, away from player ─ */

/** Soft broadcast dust / sparkle — kept off the centre hero zone */
const GOLD_PARTICLES = [
  { left: 6, top: 10, size: 4, opacity: 0.55, blur: 0.5 },
  { left: 92, top: 14, size: 5, opacity: 0.5, blur: 0.3 },
  { left: 10, top: 78, size: 3, opacity: 0.45, blur: 0.8 },
  { left: 88, top: 74, size: 4, opacity: 0.5, blur: 0.4 },
  { left: 4, top: 38, size: 3, opacity: 0.4, blur: 1 },
  { left: 96, top: 48, size: 3, opacity: 0.42, blur: 0.6 },
  { left: 18, top: 6, size: 2, opacity: 0.35, blur: 0.2 },
  { left: 82, top: 8, size: 2, opacity: 0.38, blur: 0.2 },
  { left: 14, top: 92, size: 3, opacity: 0.4, blur: 0.5 },
  { left: 86, top: 90, size: 3, opacity: 0.38, blur: 0.5 },
  { left: 24, top: 18, size: 2, opacity: 0.32, blur: 0.3 },
  { left: 76, top: 22, size: 2, opacity: 0.34, blur: 0.3 },
  { left: 8, top: 58, size: 2, opacity: 0.3, blur: 0.7 },
  { left: 94, top: 62, size: 2, opacity: 0.32, blur: 0.7 },
] as const;

/** Lens-flare bokeh — stadium light reflections at edges */
const LENS_FLARES = [
  { left: 20, top: 26, size: 6, opacity: 0.35, blur: 2 },
  { left: 80, top: 20, size: 7, opacity: 0.3, blur: 2.5 },
  { left: 16, top: 68, size: 5, opacity: 0.28, blur: 1.8 },
  { left: 84, top: 70, size: 6, opacity: 0.32, blur: 2 },
  { left: 30, top: 12, size: 4, opacity: 0.25, blur: 1.5 },
  { left: 70, top: 14, size: 4, opacity: 0.26, blur: 1.5 },
  { left: 12, top: 48, size: 3, opacity: 0.22, blur: 2 },
  { left: 90, top: 42, size: 3, opacity: 0.24, blur: 2 },
] as const;

/** Scale factor from render dimensions (1080px baseline). */
export function topBuyScale(ctx: BuzzRenderContext): number {
  const base = isLandscapePoster(ctx) ? ctx.renderWidth : ctx.renderHeight;
  const ref = isLandscapePoster(ctx) ? 1920 : 1080;
  return Math.max(0.55, Math.min(1.35, base / ref));
}

export function topBuyPosterClass(ctx: BuzzRenderContext): string {
  const classes = ["top-buy-poster"];
  if (isLandscapePoster(ctx)) classes.push("top-buy-poster--landscape");
  if (ctx.aspectRatio === "9:16") classes.push("top-buy-poster--tall");
  return classes.join(" ");
}

/* ── Background ─────────────────────────────────────────────────────────── */

export function TopBuyBackground() {
  return (
    <>
      <div className="top-buy-background" aria-hidden />
      <div className="top-buy-stadium-lights" aria-hidden />
      <div className="top-buy-sunburst" aria-hidden />
      <div className="top-buy-player-spotlight" aria-hidden />
      <div className="top-buy-vignette" aria-hidden />
    </>
  );
}

/* ── Decorative elements ────────────────────────────────────────────────── */

export function TopBuyDecorativeElements() {
  return (
    <div className="top-buy-decorative" aria-hidden>
      {GOLD_PARTICLES.map((particle, i) => (
        <span
          key={`particle-${i}`}
          className="top-buy-gold-particle"
          style={
            {
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              width: `calc(${particle.size}px * var(--tb-scale))`,
              height: `calc(${particle.size}px * var(--tb-scale))`,
              "--tb-particle-opacity": particle.opacity,
              "--tb-particle-blur": particle.blur,
            } as React.CSSProperties
          }
        />
      ))}
      {LENS_FLARES.map((flare, i) => (
        <span
          key={`flare-${i}`}
          className="top-buy-lens-flare"
          style={
            {
              left: `${flare.left}%`,
              top: `${flare.top}%`,
              width: `calc(${flare.size}px * var(--tb-scale))`,
              height: `calc(${flare.size}px * var(--tb-scale))`,
              "--tb-flare-opacity": flare.opacity,
              "--tb-flare-blur": flare.blur,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ── Tournament header ──────────────────────────────────────────────────── */

export function TopBuyTournamentHeader({
  tournamentName,
  tournamentLogoUrl,
}: {
  tournamentName?: string | null;
  tournamentLogoUrl?: string | null;
}) {
  const hasName = !!tournamentName?.trim();
  const hasLogo = !!tournamentLogoUrl;
  if (!hasName && !hasLogo) return null;

  return (
    <header className="top-buy-tournament-header">
      {hasLogo ? (
        <img
          className="top-buy-tournament-logo"
          src={tournamentLogoUrl}
          alt={tournamentName ?? "Tournament"}
          draggable={false}
        />
      ) : null}
      {hasName ? (
        <h2 className="top-buy-tournament-name">{tournamentName!.trim().toUpperCase()}</h2>
      ) : null}
    </header>
  );
}

/* ── Title ──────────────────────────────────────────────────────────────── */

export function TopBuyTitle({ children = "TOP BUY" }: { children?: React.ReactNode }) {
  return <h1 className="top-buy-title">{children}</h1>;
}

/* ── Player frame + image ───────────────────────────────────────────────── */

export function TopBuyPlayerImage({
  name,
  imageUrl,
}: {
  name: string;
  imageUrl?: string | null;
}) {
  const { initials } = monogramFor(name, "player");

  return (
    <div className="top-buy-player-stage">
      <div className="top-buy-player-frame">
        <div className="top-buy-player-frame-inner">
          {imageUrl ? (
            <img
              className="top-buy-player-image"
              src={imageUrl}
              alt={name}
              draggable={false}
            />
          ) : (
            <span className="top-buy-player-monogram">{initials}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** @deprecated Use TopBuyPlayerImage — frame is built into the image component. */
export function TopBuyPlayerFrame({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

/* ── Player name ────────────────────────────────────────────────────────── */

export function TopBuyPlayerName({ children }: { children: React.ReactNode }) {
  return <h3 className="top-buy-player-name">{children}</h3>;
}

/* ── Team name (+ optional logo) ──────────────────────────────────────── */

export function TopBuyTeamName({
  teamName,
  teamLogoUrl,
}: {
  teamName: string;
  teamLogoUrl?: string | null;
}) {
  return (
    <div className="top-buy-team-block">
      {teamLogoUrl ? (
        <img
          className="top-buy-team-logo"
          src={teamLogoUrl}
          alt={teamName}
          draggable={false}
        />
      ) : null}
      <p className="top-buy-team-name">{teamName}</p>
    </div>
  );
}

/* ── Price card ─────────────────────────────────────────────────────────── */

export function TopBuyPriceCard({ price }: { price: string }) {
  return (
    <div className="top-buy-price-card">
      <p className="top-buy-price-value">{price}</p>
    </div>
  );
}

/* ── Footer ─────────────────────────────────────────────────────────────── */

export function TopBuyFooter({
  poweredByText = "Powered by",
  logoUrl = BIDWAR_REVERSE_LOGO_URL,
}: {
  poweredByText?: string;
  logoUrl?: string;
}) {
  return (
    <footer className="top-buy-footer">
      <span className="top-buy-footer-text">{poweredByText}</span>
      <img
        className="top-buy-footer-logo"
        src={logoUrl}
        alt="BidWar"
        draggable={false}
      />
    </footer>
  );
}
