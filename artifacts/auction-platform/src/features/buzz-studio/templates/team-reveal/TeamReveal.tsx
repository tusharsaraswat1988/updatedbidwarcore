/**
 * Buzz Studio — Team Reveal Template (Phase 17E)
 *
 * TOURNAMENT-FIRST hierarchy. Reads like "IPL Franchise Reveal, presented by <Tournament>".
 *
 * Reading order (must be respected by the eye):
 *   1. Tournament   — top-center logo + "<NAME> PRESENTS"
 *   2. Team Logo    — hero anchor, raised with a soft broadcast drop-shadow
 *   3. TEAM NAME    — largest element on the poster
 *   4. Supporting   — CAPTAIN · SQUAD · SPEND (pure typography row)
 *   5. BIDWAR       — single subtle centered footer mark
 *
 * Portrait (1:1 · 4:5 · 9:16):
 * ┌──────────────────────────────────┐
 * │        [ Tournament Logo ]        │  Zone 1 — tournament header
 * │      TOURNAMENT NAME PRESENTS     │
 * │                                  │
 * │           [ TEAM LOGO ]          │  Zone 2 — team hero (flex:1)
 * │           TEAM NAME              │
 * │                                  │
 * │   CAPTAIN     SQUAD     SPEND    │  Zone 3 — supporting data
 * │   Name        15        ₹8.1L    │
 * │             BIDWAR              │  Zone 4 — footer
 * └──────────────────────────────────┘
 *
 * Landscape (16:9): tournament header (top) · logo left / name+stats right · BIDWAR bottom.
 *
 * Rules: no cards, pills, borders, glass, glow, gradient panels, sponsor blocks.
 * Background is the creative (70%). Content is typography + logos (30%).
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { monogramFor } from "../../asset-engine/monogram-generator";
import {
  pickRenderContext,
  type BuzzTemplateRenderProps,
  canvasH,
  canvasW,
} from "../../rendering/buzz-render-context";
import {
  isLandscapePoster,
  posterSpacing,
  bodyLabelSize,
} from "../../rendering/poster-layout";
import { formatTeamSpend } from "./TeamReveal.utils";
import type { TeamRevealContract } from "./TeamReveal.types";

// ─── Poster Design Tokens ─────────────────────────────────────────────────────
// Typography-first. No card surfaces or border tokens.
// Portable to PlayerSpotlight, SoldPlayer, TopBuys.

export const POSTER_TOKENS = {
  font:     "system-ui, sans-serif",
  white:    "#FFFFFF",
  gold:     t.primaryGold,
  ghost:    "rgba(255,255,255,0.40)",
  hairline: "rgba(255,255,255,0.14)",
  goldRule: "rgba(251,191,36,0.30)",
  // Broadcast-style depth — soft, layered shadow. Not a glow.
  logoDepth:
    "drop-shadow(0 12px 24px rgba(0,0,0,0.35)) drop-shadow(0 4px 8px rgba(0,0,0,0.25))",
} as const;

const PT = POSTER_TOKENS;

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamRevealProps = TeamRevealContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

type PosterCtx = NonNullable<ReturnType<typeof pickRenderContext>>;

// ─── Logo (image on background, optional broadcast depth) ──────────────────────

function Logo({
  name,
  url,
  size,
  kind,
  depth = false,
}: {
  name: string;
  url?: string | null;
  size: number;
  kind: "team" | "tournament";
  depth?: boolean;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        draggable={false}
        style={{
          width:          size,
          height:         size,
          objectFit:      "contain",
          objectPosition: "center",
          display:        "block",
          flexShrink:     0,
          filter:         depth ? PT.logoDepth : undefined,
        }}
      />
    );
  }

  // No image → bold initials, only for team (tournament header hides if no logo+name).
  const { initials } = monogramFor(name, kind === "team" ? "team" : "tournament");
  return (
    <span
      style={{
        display:       "block",
        fontFamily:    PT.font,
        fontSize:      `${Math.round(size * 0.42)}px`,
        fontWeight:    900,
        color:         "rgba(255,255,255,0.70)",
        letterSpacing: "0.06em",
        lineHeight:    1,
        textAlign:     "center",
        width:         size,
        userSelect:    "none",
        flexShrink:    0,
        filter:        depth ? PT.logoDepth : undefined,
      }}
    >
      {initials}
    </span>
  );
}

// ─── Tournament Header ────────────────────────────────────────────────────────
// Top-center: logo + "<TOURNAMENT NAME> PRESENTS". Tournament-first anchor.

function TournamentHeader({
  logoUrl,
  name,
  logoSize,
  nameSize,
  microSize,
}: {
  logoUrl?: string | null;
  name?: string | null;
  logoSize: number;
  nameSize: number;
  microSize: number;
}) {
  const hasLogo = !!logoUrl;
  const hasName = !!name && name.trim().length > 0;
  if (!hasLogo && !hasName) return null;

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            Math.round(microSize * 0.7),
        width:          "100%",
      }}
    >
      {hasLogo ? (
        <Logo name={name ?? "Tournament"} url={logoUrl} size={logoSize} kind="tournament" />
      ) : null}

      {hasName ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(microSize * 0.35) }}>
          <span
            style={{
              fontFamily:    PT.font,
              fontSize:      `${nameSize}px`,
              fontWeight:    800,
              color:         PT.white,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              lineHeight:    1.1,
              textAlign:     "center",
              maxWidth:      "26ch",
              opacity:       0.92,
            }}
          >
            {name}
          </span>
          <span
            style={{
              fontFamily:    PT.font,
              fontSize:      `${microSize}px`,
              fontWeight:    700,
              color:         PT.gold,
              letterSpacing: "0.40em",
              textTransform: "uppercase",
              lineHeight:    1,
              opacity:       0.82,
            }}
          >
            PRESENTS
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ─── Stat Block (label over value, pure text) ─────────────────────────────────

function StatBlock({
  label,
  value,
  gold = false,
  align = "center",
  labelSize,
  valueSize,
}: {
  label: string;
  value: string | number;
  gold?: boolean;
  align?: "center" | "left";
  labelSize: number;
  valueSize: number;
}) {
  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    align === "left" ? "flex-start" : "center",
        gap:           Math.round(labelSize * 0.55),
      }}
    >
      <span
        style={{
          fontFamily:    PT.font,
          fontSize:      `${labelSize}px`,
          fontWeight:    700,
          color:         PT.ghost,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          lineHeight:    1,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily:    PT.font,
          fontSize:      `${valueSize}px`,
          fontWeight:    700,
          color:         gold ? PT.gold : PT.white,
          letterSpacing: "0.04em",
          lineHeight:    1.1,
          whiteSpace:    "nowrap",
          overflow:      "hidden",
          textOverflow:  "ellipsis",
          maxWidth:      "18ch",
        }}
      >
        {value}
      </span>
    </div>
  );
}

// ─── BIDWAR Footer (single subtle centered mark) ──────────────────────────────

function BidwarFooter({ size }: { size: number }) {
  return (
    <div
      style={{
        width:          "100%",
        display:        "flex",
        justifyContent: "center",
        alignItems:     "center",
      }}
    >
      <span
        style={{
          fontFamily:    PT.font,
          fontSize:      `${size}px`,
          fontWeight:    800,
          color:         PT.white,
          letterSpacing: "0.42em",
          textTransform: "uppercase",
          lineHeight:    1,
          opacity:       0.70,
          userSelect:    "none",
        }}
      >
        BIDWAR
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamReveal(props: TeamRevealProps) {
  const renderCtx = pickRenderContext(props);
  const {
    teamName,
    teamLogoUrl,
    captainName,
    playerCount,
    backgroundImageUrl,
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  } = props;

  const spendDisplay   = formatTeamSpend(props);
  const hasStats       = playerCount != null || spendDisplay != null;
  const hasCaptain     = !!captainName;
  const displayName    = teamName ?? "FRANCHISE";

  // Tournament identity comes from branding (provider maps tournament.name → tagline).
  const tournamentName    = props.branding?.tagline;
  const tournamentLogoUrl = props.branding?.tournamentLogoUrl;

  const canvasProps = {
    branding:           props.branding,
    backgroundImageUrl,
    showWatermark:      false,
    showFooterBranding: false, // TeamReveal renders its own BIDWAR footer
    showCornerBrand:    false, // suppress tiny corner logo — header is top-center
  } as const;

  if (renderCtx) {
    return (
      <BidwarCanvas
        {...canvasProps}
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        <TeamRevealPoster
          ctx={renderCtx}
          displayName={displayName}
          teamLogoUrl={teamLogoUrl}
          tournamentName={tournamentName}
          tournamentLogoUrl={tournamentLogoUrl}
          captainName={captainName}
          playerCount={playerCount}
          spendDisplay={spendDisplay}
          hasStats={hasStats}
          hasCaptain={hasCaptain}
        />
      </BidwarCanvas>
    );
  }

  return (
    <BidwarCanvas {...canvasProps}>
      <TeamRevealLegacy
        displayName={displayName}
        teamLogoUrl={teamLogoUrl}
        tournamentName={tournamentName}
        tournamentLogoUrl={tournamentLogoUrl}
        captainName={captainName}
        playerCount={playerCount}
        spendDisplay={spendDisplay}
        hasStats={hasStats}
        hasCaptain={hasCaptain}
      />
    </BidwarCanvas>
  );
}

// ─── Poster Composition ───────────────────────────────────────────────────────

function TeamRevealPoster({
  ctx,
  displayName,
  teamLogoUrl,
  tournamentName,
  tournamentLogoUrl,
  captainName,
  playerCount,
  spendDisplay,
  hasStats,
  hasCaptain,
}: {
  ctx: PosterCtx;
  displayName: string;
  teamLogoUrl?: string | null;
  tournamentName?: string | null;
  tournamentLogoUrl?: string | null;
  captainName?: string | null;
  playerCount?: number | null;
  spendDisplay: string | null;
  hasStats: boolean;
  hasCaptain: boolean;
}) {
  const spacing   = posterSpacing(ctx);
  const bodySize  = bodyLabelSize(ctx);
  const microSize = canvasH(ctx.renderHeight, 0.013, 11, 15);
  const landscape = isLandscapePoster(ctx);

  const gap     = spacing.sectionGap;
  const halfGap = Math.round(gap * 0.55);

  // ── Tournament header sizing (250–300% larger than old 36px corner) ──
  const tournLogoSize = canvasH(ctx.renderHeight, 0.085, 72, 112);
  const tournNameSize = canvasH(ctx.renderHeight, 0.018, 15, 22);

  // ── Team name: largest text. Always larger than tournament name. ──
  const titleSize = landscape
    ? canvasH(ctx.renderHeight, 0.105, 80, 128)
    : canvasH(ctx.renderHeight, 0.085, 78, 122);

  const teamNameStyle: React.CSSProperties = {
    margin:        0,
    fontFamily:    PT.font,
    fontSize:      `${titleSize}px`,
    fontWeight:    900,
    color:         PT.white,
    letterSpacing: "0.07em",
    lineHeight:    0.95,
    textTransform: "uppercase",
    textAlign:     landscape ? "left" : "center",
  };

  // ── Team logo: hero anchor, raised with broadcast depth ──
  const teamLogoSize = landscape
    ? canvasH(ctx.renderHeight, 0.46, 320, 480)
    : canvasH(ctx.renderHeight, 0.24, 205, 270);

  // ── BIDWAR footer ──
  const footerSize = canvasH(ctx.renderHeight, 0.016, 13, 19);

  const statsAlign = landscape ? "left" : "center";

  const captainEl = hasCaptain ? (
    <StatBlock label="CAPTAIN" value={captainName!} align={statsAlign} labelSize={microSize} valueSize={bodySize} />
  ) : null;
  const squadEl = playerCount != null ? (
    <StatBlock label="SQUAD" value={playerCount} align={statsAlign} labelSize={microSize} valueSize={bodySize} />
  ) : null;
  const spendEl = spendDisplay != null ? (
    <StatBlock label="SPEND" value={spendDisplay} gold align={statsAlign} labelSize={microSize} valueSize={bodySize} />
  ) : null;

  const anyStats = hasCaptain || hasStats;

  const headerEl = (
    <TournamentHeader
      logoUrl={tournamentLogoUrl}
      name={tournamentName}
      logoSize={tournLogoSize}
      nameSize={tournNameSize}
      microSize={microSize}
    />
  );

  // ── Landscape (16:9) ──
  if (landscape) {
    return (
      <div
        style={{
          display:       "flex",
          flexDirection: "column",
          width:         "100%",
          height:        "100%",
          flex:          1,
          minHeight:     0,
        }}
      >
        {/* Tournament header — top center */}
        <div style={{ flexShrink: 0, display: "flex", justifyContent: "center", paddingBottom: halfGap }}>
          {headerEl}
        </div>

        {/* Middle: logo left · name + stats right */}
        <div
          style={{
            flex:          1,
            display:       "flex",
            flexDirection: "row",
            alignItems:    "center",
            minHeight:     0,
          }}
        >
          <div
            style={{
              flex:           "0 0 42%",
              display:        "flex",
              alignItems:     "center",
              justifyContent: "center",
              height:         "100%",
            }}
          >
            <Logo name={displayName} url={teamLogoUrl} size={teamLogoSize} kind="team" depth />
          </div>

          <div
            style={{
              flex:           1,
              display:        "flex",
              flexDirection:  "column",
              justifyContent: "center",
              gap:            gap,
              minWidth:       0,
            }}
          >
            <h1 style={teamNameStyle}>{displayName.toUpperCase()}</h1>
            {anyStats && (
              <div style={{ display: "flex", gap: gap * 1.4, alignItems: "flex-start" }}>
                {captainEl}
                {squadEl}
                {spendEl}
              </div>
            )}
          </div>
        </div>

        {/* BIDWAR footer — bottom center, full width */}
        <div style={{ flexShrink: 0, paddingTop: halfGap }}>
          <BidwarFooter size={footerSize} />
        </div>
      </div>
    );
  }

  // ── Portrait (1:1, 4:5, 9:16) ──
  // Zone 1: tournament header  |  Zone 2: team hero (flex:1)
  // Zone 3: stats row          |  Zone 4: BIDWAR footer

  const statsZoneH = canvasH(ctx.renderHeight, 0.15, 96, 144);

  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        width:         "100%",
        height:        "100%",
        flex:          1,
        minHeight:     0,
      }}
    >
      {/* Zone 1 — Tournament header */}
      <div style={{ flexShrink: 0, width: "100%", display: "flex", justifyContent: "center" }}>
        {headerEl}
      </div>

      {/* Zone 2 — Team hero: logo + name, vertically centered */}
      <div
        style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            halfGap,
          minHeight:      0,
          width:          "100%",
        }}
      >
        <Logo name={displayName} url={teamLogoUrl} size={teamLogoSize} kind="team" depth />
        <h1 style={teamNameStyle}>{displayName.toUpperCase()}</h1>
      </div>

      {/* Zone 3 — Supporting data: 3-column typography row */}
      {anyStats ? (
        <div
          style={{
            height:         statsZoneH,
            flexShrink:     0,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            gap:            gap * 1.5,
            width:          "100%",
          }}
        >
          {captainEl}
          {squadEl}
          {spendEl}
        </div>
      ) : (
        <div style={{ height: statsZoneH, flexShrink: 0 }} />
      )}

      {/* Zone 4 — BIDWAR footer */}
      <div style={{ flexShrink: 0, width: "100%", paddingTop: halfGap }}>
        <BidwarFooter size={footerSize} />
      </div>
    </div>
  );
}

// ─── Legacy Card (Dev Sandbox) ────────────────────────────────────────────────

function TeamRevealLegacy({
  displayName,
  teamLogoUrl,
  tournamentName,
  tournamentLogoUrl,
  captainName,
  playerCount,
  spendDisplay,
  hasStats,
  hasCaptain,
}: {
  displayName: string;
  teamLogoUrl?: string | null;
  tournamentName?: string | null;
  tournamentLogoUrl?: string | null;
  captainName?: string | null;
  playerCount?: number | null;
  spendDisplay: string | null;
  hasStats: boolean;
  hasCaptain: boolean;
}) {
  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        width:          "100%",
        gap:            "clamp(12px, 3vw, 22px)",
        padding:        "10px 0",
      }}
    >
      {/* Tournament header */}
      <TournamentHeader
        logoUrl={tournamentLogoUrl}
        name={tournamentName}
        logoSize={64}
        nameSize={13}
        microSize={9}
      />

      {/* Team logo */}
      <Logo name={displayName} url={teamLogoUrl} size={108} kind="team" depth />

      {/* Team name */}
      <h1 style={{
        margin:        0,
        fontFamily:    PT.font,
        fontSize:      "clamp(1.6rem, 6vw, 3rem)",
        fontWeight:    900,
        color:         PT.white,
        letterSpacing: "0.07em",
        lineHeight:    0.95,
        textTransform: "uppercase",
        textAlign:     "center",
      }}>
        {displayName.toUpperCase()}
      </h1>

      {/* Stats */}
      {(hasCaptain || hasStats) && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", justifyContent: "center" }}>
          {hasCaptain && <StatBlock label="CAPTAIN" value={captainName!} labelSize={9} valueSize={13} />}
          {playerCount != null && <StatBlock label="SQUAD" value={playerCount} labelSize={9} valueSize={13} />}
          {spendDisplay != null && <StatBlock label="SPEND" value={spendDisplay} gold labelSize={9} valueSize={13} />}
        </div>
      )}

      {/* BIDWAR footer */}
      <BidwarFooter size={13} />
    </div>
  );
}
