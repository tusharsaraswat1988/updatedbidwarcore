/**
 * Buzz Studio — Team Reveal Template (Phase 17B)
 *
 * Design philosophy: background is the creative (70%), content is typography (30%).
 *
 * NO glass cards. NO pill containers. NO rounded component boxes. NO borders
 * around content. NO dashboard chrome. NO UI widgets.
 *
 * Think: IPL franchise reveal · auction announcement · sports Instagram creative
 * NOT: SaaS admin panel · analytics card · component library screenshot
 *
 * Visual weight:
 *   Team Logo  ≈ 20%   — clean image, no container
 *   Team Name  ≈ 50%   — dominant, weight 900
 *   Everything ≈ 30%   — pure label/value typography
 *
 * POSTER_TOKENS are portable to PlayerSpotlight, SoldPlayer, and TopBuys.
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { monogramFor } from "../../asset-engine/monogram-generator";
import {
  pickRenderContext,
  type BuzzTemplateRenderProps,
  canvasH,
} from "../../rendering/buzz-render-context";
import {
  isLandscapePoster,
  posterSpacing,
  heroTitleSize,
  bodyLabelSize,
} from "../../rendering/poster-layout";
import { formatTeamSpend } from "./TeamReveal.utils";
import type { TeamRevealContract } from "./TeamReveal.types";

// ─── Poster Design Tokens ─────────────────────────────────────────────────────
//
// Typography-first tokens. No card surfaces, no border tokens, no containers.
// Portable to PlayerSpotlight, SoldPlayer, and TopBuys.

export const POSTER_TOKENS = {
  font:     "system-ui, sans-serif",
  white:    "#FFFFFF",
  gold:     t.primaryGold,
  ghost:    "rgba(255,255,255,0.40)",
  hairline: "rgba(255,255,255,0.14)",
} as const;

const PT = POSTER_TOKENS;

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamRevealProps = TeamRevealContract &
  BuzzTemplateRenderProps & {
    /** Injected at render time from Creative Assets Manager. Never in contracts. */
    backgroundImageUrl?: string;
  };

type PosterCtx = NonNullable<ReturnType<typeof pickRenderContext>>;

// ─── Team Logo ────────────────────────────────────────────────────────────────
//
// Clean image directly on background. No circular container. No border. No glow.
// Falls back to bold initials text when no logo is uploaded.

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
        color:         "rgba(255,255,255,0.68)",
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

// ─── Stat Block ───────────────────────────────────────────────────────────────
//
// Label above value. Pure text — no container, no border, no card.
// Example: CAPTAIN / Rohit Sharma · SQUAD / 15 PLAYERS · SPEND / ₹42.5 Cr

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
        gap:           Math.round(labelSize * 0.5),
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
          maxWidth:      "22ch",
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
  const titleSize = heroTitleSize(ctx);
  const bodySize  = bodyLabelSize(ctx);
  const microSize = canvasH(ctx.renderHeight, 0.013, 11, 15);
  const landscape = isLandscapePoster(ctx);

  const gap      = spacing.sectionGap;
  const halfGap  = Math.round(gap * 0.55);
  const thirdGap = Math.round(gap * 0.33);

  // Logo scales differently for landscape (fills column height) vs portrait
  const logoSize = landscape
    ? canvasH(ctx.renderHeight, 0.38, 280, 400)
    : canvasH(ctx.renderHeight, 0.19, 160, 220);

  // ── Shared elements ──

  const teamNameEl = (
    <h1
      style={{
        margin:        0,
        fontFamily:    PT.font,
        fontSize:      `${titleSize}px`,
        fontWeight:    900,
        color:         PT.white,
        letterSpacing: "0.07em",
        lineHeight:    0.96,
        textTransform: "uppercase",
        textAlign:     landscape ? "left" : "center",
      }}
    >
      {displayName.toUpperCase()}
    </h1>
  );

  const revealLabelEl = (
    <span
      style={{
        fontFamily:    PT.font,
        fontSize:      `${Math.round(microSize * 1.2)}px`,
        fontWeight:    700,
        color:         PT.gold,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        lineHeight:    1,
        opacity:       0.90,
      }}
    >
      TEAM REVEAL
    </span>
  );

  const hairlineEl = (
    <div
      aria-hidden="true"
      style={{
        width:      landscape ? "55%" : "36%",
        height:     1,
        background: PT.hairline,
        flexShrink: 0,
        alignSelf:  landscape ? "flex-start" : "center",
      }}
    />
  );

  // ── Stats — pure text label/value pairs, no containers ──

  const captainEl = hasCaptain ? (
    <StatBlock
      label="CAPTAIN"
      value={captainName!}
      align={landscape ? "left" : "center"}
      labelSize={microSize}
      valueSize={bodySize}
    />
  ) : null;

  const squadEl = playerCount != null ? (
    <StatBlock
      label="SQUAD"
      value={`${playerCount} PLAYERS`}
      align={landscape ? "left" : "center"}
      labelSize={microSize}
      valueSize={bodySize}
    />
  ) : null;

  const spendEl = spendDisplay != null ? (
    <StatBlock
      label="SPEND"
      value={spendDisplay}
      gold
      align={landscape ? "left" : "center"}
      labelSize={microSize}
      valueSize={bodySize}
    />
  ) : null;

  // ── Landscape (16:9) ──
  // LEFT: large logo  |  RIGHT: name → reveal → hairline → stats row

  if (landscape) {
    return (
      <div
        style={{
          display:       "flex",
          flexDirection: "row",
          alignItems:    "center",
          width:         "100%",
          height:        "100%",
          flex:          1,
          gap:           gap * 2,
          minHeight:     0,
        }}
      >
        {/* Logo — left column, vertically centered */}
        <div
          style={{
            flex:           "0 0 auto",
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            height:         "100%",
          }}
        >
          <TeamLogo teamName={displayName} logoUrl={teamLogoUrl} size={logoSize} />
        </div>

        {/* Name + stats — right column */}
        <div
          style={{
            flex:           1,
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "center",
            gap:            halfGap,
            minWidth:       0,
          }}
        >
          {/* Name block */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: thirdGap }}>
            {teamNameEl}
            {revealLabelEl}
          </div>

          {hairlineEl}

          {/* Stats row — all 3 side by side for landscape */}
          {(hasCaptain || hasStats) && (
            <div
              style={{
                display: "flex",
                gap:     gap * 1.4,
                alignItems: "flex-start",
              }}
            >
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
  // Centered column: Logo → Name → TEAM REVEAL → hairline → stats stack

  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        width:          "100%",
        height:         "100%",
        flex:           1,
        gap:            gap,
        minHeight:      0,
      }}
    >
      {/* Logo — clean image, no container */}
      <TeamLogo teamName={displayName} logoUrl={teamLogoUrl} size={logoSize} />

      {/* Name block — team name dominates */}
      <div
        style={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          gap:            thirdGap,
        }}
      >
        {teamNameEl}
        {revealLabelEl}
      </div>

      {/* Hairline separator */}
      {hairlineEl}

      {/* Stats — label/value pairs, pure typography */}
      {(hasCaptain || hasStats) && (
        <div
          style={{
            display:        "flex",
            flexDirection:  "column",
            alignItems:     "center",
            gap:            halfGap,
          }}
        >
          {captainEl}
          {squadEl}
          {spendEl}
        </div>
      )}
    </div>
  );
}

// ─── Legacy Card (Dev Sandbox) ────────────────────────────────────────────────
//
// Shown in local dev without render context (no aspectRatio/dimensions).
// Uses clamp-based sizes for responsive preview card.

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
        justifyContent: "center",
        width:          "100%",
        gap:            "clamp(14px, 3.5vw, 24px)",
        padding:        "12px 0",
      }}
    >
      {/* Logo */}
      <TeamLogo teamName={displayName} logoUrl={teamLogoUrl} size={96} />

      {/* Name block */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
        <h1
          style={{
            margin:        0,
            fontFamily:    PT.font,
            fontSize:      "clamp(1.5rem, 5.5vw, 2.75rem)",
            fontWeight:    900,
            color:         PT.white,
            letterSpacing: "0.07em",
            lineHeight:    1.0,
            textTransform: "uppercase",
          }}
        >
          {displayName.toUpperCase()}
        </h1>
        <span
          style={{
            fontFamily:    PT.font,
            fontSize:      "0.5rem",
            fontWeight:    700,
            color:         PT.gold,
            letterSpacing: "0.30em",
            textTransform: "uppercase",
            opacity:       0.90,
          }}
        >
          TEAM REVEAL
        </span>
      </div>

      {/* Hairline */}
      <div aria-hidden="true" style={{ width: "36%", height: 1, background: PT.hairline }} />

      {/* Stats — pure text */}
      {(hasCaptain || hasStats) && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          {hasCaptain && (
            <StatBlock label="CAPTAIN" value={captainName!} labelSize={10} valueSize={14} />
          )}
          {playerCount != null && (
            <StatBlock label="SQUAD" value={`${playerCount} PLAYERS`} labelSize={10} valueSize={14} />
          )}
          {spendDisplay != null && (
            <StatBlock label="SPEND" value={spendDisplay} gold labelSize={10} valueSize={14} />
          )}
        </div>
      )}
    </div>
  );
}
