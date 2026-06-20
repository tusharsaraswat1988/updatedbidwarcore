/**
 * Buzz Studio — Team Reveal Template (Phase 17C)
 *
 * COMPOSITION: Three-zone layout — every zone has a purpose.
 *
 * Portrait (1:1 · 4:5 · 9:16):
 * ┌─────────────────────────────────┐
 * │  ━━━━━ TEAM REVEAL ━━━━━        │  Zone 1 — 11% canvas height
 * │                                 │
 * │         [ LOGO ]                │  Zone 2 — flex:1 (hero)
 * │      TEAM NAME                  │     Logo: 26% canvas height
 * │                                 │     Name: 90–120px, weight 900
 * │                                 │
 * │  CAPTAIN    SQUAD     SPEND     │  Zone 3 — 16% canvas height
 * │  Name       15        ₹8.1L     │     3-col typography row
 * └─────────────────────────────────┘
 *         [BidwarCanvas Footer]
 *
 * Landscape (16:9):
 * ┌───────────────┬──────────────────────┐
 * │               │  ━━ TEAM REVEAL ━━   │
 * │  [ BIG LOGO ] │                      │
 * │               │  TEAM NAME           │
 * │               │  (120px, dominant)   │
 * │               │  CAPTAIN SQUAD SPEND │
 * └───────────────┴──────────────────────┘
 *              [Footer — full width]
 *
 * Design rules:
 *   - No glass cards. No pill containers. No borders around content.
 *   - Background = creative (70%). Content = typography (30%).
 *   - Eyes must reach LOGO then NAME before anything else.
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
  font:          "system-ui, sans-serif",
  white:         "#FFFFFF",
  gold:          t.primaryGold,
  ghost:         "rgba(255,255,255,0.40)",
  hairline:      "rgba(255,255,255,0.14)",
  goldRule:      "rgba(251,191,36,0.28)",
} as const;

const PT = POSTER_TOKENS;

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamRevealProps = TeamRevealContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

type PosterCtx = NonNullable<ReturnType<typeof pickRenderContext>>;

// ─── Team Logo ────────────────────────────────────────────────────────────────
// Plain image on background. No container. No border. No glow.

function TeamLogo({
  teamName,
  logoUrl,
  size,
}: {
  teamName: string;
  logoUrl?: string | null;
  size: number;
}) {
  const { initials } = monogramFor(teamName, "team");

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={teamName}
        draggable={false}
        style={{
          width:          size,
          height:         size,
          objectFit:      "contain",
          objectPosition: "center",
          display:        "block",
          flexShrink:     0,
        }}
      />
    );
  }

  return (
    <span
      style={{
        display:       "block",
        fontFamily:    PT.font,
        fontSize:      `${Math.round(size * 0.44)}px`,
        fontWeight:    900,
        color:         "rgba(255,255,255,0.70)",
        letterSpacing: "0.06em",
        lineHeight:    1,
        textAlign:     "center",
        width:         size,
        userSelect:    "none",
        flexShrink:    0,
      }}
    >
      {initials}
    </span>
  );
}

// ─── Reveal Header ────────────────────────────────────────────────────────────
// Editorial label above logo: ━━━ TEAM REVEAL ━━━

function RevealHeader({
  microSize,
  ruleWidth,
}: {
  microSize: number;
  ruleWidth: number;
}) {
  const ruleStyle: React.CSSProperties = {
    width:      ruleWidth,
    height:     1,
    background: PT.goldRule,
    flexShrink: 0,
  };

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            Math.round(microSize * 0.70),
      }}
    >
      <div style={ruleStyle} aria-hidden="true" />
      <span
        style={{
          fontFamily:    PT.font,
          fontSize:      `${microSize}px`,
          fontWeight:    700,
          color:         PT.gold,
          letterSpacing: "0.34em",
          textTransform: "uppercase",
          lineHeight:    1,
          opacity:       0.88,
          userSelect:    "none",
        }}
      >
        TEAM REVEAL
      </span>
      <div style={ruleStyle} aria-hidden="true" />
    </div>
  );
}

// ─── Stat Block ───────────────────────────────────────────────────────────────
// Label above value. Pure text. No container, no border, no card.

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

  const spendDisplay = formatTeamSpend(props);
  const hasStats    = playerCount != null || spendDisplay != null;
  const hasCaptain  = !!captainName;
  const displayName = teamName ?? "FRANCHISE";

  const canvasProps = {
    branding:           props.branding,
    backgroundImageUrl,
    showWatermark:      false,
    showFooterBranding: true,
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
  captainName,
  playerCount,
  spendDisplay,
  hasStats,
  hasCaptain,
}: {
  ctx: PosterCtx;
  displayName: string;
  teamLogoUrl?: string | null;
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

  // ── Typography ──
  // Portrait target: 90–120px. Landscape: slightly smaller (less height to scale from).
  const titleSize = landscape
    ? canvasH(ctx.renderHeight, 0.11, 82, 130)
    : canvasH(ctx.renderHeight, 0.09, 82, 130);

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

  // ── Logo sizes ──
  // Portrait: 35–50% larger than Phase 17B baseline.
  // Landscape: fills left column height proportionally.
  const logoSize = landscape
    ? canvasH(ctx.renderHeight, 0.50, 340, 500)
    : canvasH(ctx.renderHeight, 0.26, 220, 285);

  // ── Rule width for TEAM REVEAL header ──
  const ruleWidth = canvasW(ctx.renderWidth, 0.20, 120, 200);

  // ── Stat elements ──
  const statsAlign = landscape ? "left" : "center";

  const captainEl = hasCaptain ? (
    <StatBlock
      label="CAPTAIN"
      value={captainName!}
      align={statsAlign}
      labelSize={microSize}
      valueSize={bodySize}
    />
  ) : null;

  const squadEl = playerCount != null ? (
    <StatBlock
      label="SQUAD"
      value={playerCount}
      align={statsAlign}
      labelSize={microSize}
      valueSize={bodySize}
    />
  ) : null;

  const spendEl = spendDisplay != null ? (
    <StatBlock
      label="SPEND"
      value={spendDisplay}
      gold
      align={statsAlign}
      labelSize={microSize}
      valueSize={bodySize}
    />
  ) : null;

  const anyStats = hasCaptain || hasStats;

  // ── Landscape (16:9) ──
  // LEFT: large logo, vertically centered
  // RIGHT: flex column space-between → reveal (top) · name (center) · stats (bottom)

  if (landscape) {
    return (
      <div
        style={{
          display:       "flex",
          flexDirection: "row",
          alignItems:    "stretch",
          width:         "100%",
          height:        "100%",
          flex:          1,
          minHeight:     0,
        }}
      >
        {/* Left: logo */}
        <div
          style={{
            flex:           "0 0 42%",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
          }}
        >
          <TeamLogo teamName={displayName} logoUrl={teamLogoUrl} size={logoSize} />
        </div>

        {/* Right: reveal · name · stats */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "space-between",
            paddingTop:     halfGap,
            paddingBottom:  halfGap,
            minWidth:       0,
          }}
        >
          <RevealHeader microSize={microSize} ruleWidth={ruleWidth} />

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
    );
  }

  // ── Portrait (1:1, 4:5, 9:16) ──
  // Zone 1 (fixed height): TEAM REVEAL header
  // Zone 2 (flex:1):       Logo + Name — hero group, vertically centered
  // Zone 3 (fixed height): 3-column stats row

  const revealZoneH = canvasH(ctx.renderHeight, 0.11, 82, 120);
  const statsZoneH  = canvasH(ctx.renderHeight, 0.16, 100, 150);

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
      {/* Zone 1 — TEAM REVEAL editorial header */}
      <div
        style={{
          height:         revealZoneH,
          flexShrink:     0,
          display:        "flex",
          alignItems:     "center",
          justifyContent: "center",
          width:          "100%",
        }}
      >
        <RevealHeader microSize={microSize} ruleWidth={ruleWidth} />
      </div>

      {/* Zone 2 — Hero: Logo + Name, vertically centered in remaining space */}
      <div
        style={{
          flex:           1,
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          justifyContent: "center",
          gap:            halfGap,
          minHeight:      0,
        }}
      >
        <TeamLogo teamName={displayName} logoUrl={teamLogoUrl} size={logoSize} />
        <h1 style={teamNameStyle}>{displayName.toUpperCase()}</h1>
      </div>

      {/* Zone 3 — Stats: 3-column typography row */}
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
        // Keep zone height even with no stats so layout stays balanced
        <div style={{ height: statsZoneH, flexShrink: 0 }} />
      )}
    </div>
  );
}

// ─── Legacy Card (Dev Sandbox) ────────────────────────────────────────────────
// No render context — clamp-based sizes for responsive preview card.

function TeamRevealLegacy({
  displayName,
  teamLogoUrl,
  captainName,
  playerCount,
  spendDisplay,
  hasStats,
  hasCaptain,
}: {
  displayName: string;
  teamLogoUrl?: string | null;
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
      {/* Reveal header */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
        <div style={{ width: 80, height: 1, background: PT.goldRule }} aria-hidden="true" />
        <span style={{
          fontFamily:    PT.font, fontSize: "0.45rem", fontWeight: 700,
          color:         PT.gold, letterSpacing: "0.32em", textTransform: "uppercase",
          lineHeight:    1, opacity: 0.88,
        }}>
          TEAM REVEAL
        </span>
        <div style={{ width: 80, height: 1, background: PT.goldRule }} aria-hidden="true" />
      </div>

      {/* Logo */}
      <TeamLogo teamName={displayName} logoUrl={teamLogoUrl} size={108} />

      {/* Name */}
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
          {hasCaptain && (
            <StatBlock label="CAPTAIN" value={captainName!} labelSize={9} valueSize={13} />
          )}
          {playerCount != null && (
            <StatBlock label="SQUAD" value={playerCount} labelSize={9} valueSize={13} />
          )}
          {spendDisplay != null && (
            <StatBlock label="SPEND" value={spendDisplay} gold labelSize={9} valueSize={13} />
          )}
        </div>
      )}
    </div>
  );
}
