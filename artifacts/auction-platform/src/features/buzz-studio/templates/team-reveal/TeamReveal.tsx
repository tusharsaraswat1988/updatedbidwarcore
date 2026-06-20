/**
 * Buzz Studio — Team Reveal Template (Phase 17A)
 *
 * Visual hierarchy: Team Name → Logo → Captain → Spend → Branding
 *
 * Design language:
 *   - Glass circular logo badge (no glow rings, no gold frame)
 *   - Team name dominates as the largest element on canvas
 *   - Compact captain pill and inline stat chips below the name
 *   - Bottom-center BIDWAR watermark (opacity 0.05) replaces diagonal
 *   - BidwarCanvas footer carries tournament branding
 *   - Background is admin-uploaded full-bleed image — no overlays added
 *
 * POSTER_TOKENS defined here are designed to be portable to PlayerSpotlight,
 * SoldPlayer, and TopBuys in subsequent phases.
 */

import React from "react";
import { BIDWAR_WATERMARK } from "../../assets/watermark";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { defaultBuzzTheme as t } from "../../theme/buzz-theme";
import { SportBadge, CaptainBadge } from "../../design-system/badges";
import { AvatarSlot } from "../../design-system/logo-slots";
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
  secondaryLabelSize,
  bodyLabelSize,
} from "../../rendering/poster-layout";
import { formatTeamSpend } from "./TeamReveal.utils";
import type { TeamRevealContract } from "./TeamReveal.types";

// ─── Poster Design Tokens ─────────────────────────────────────────────────────
//
// Shared visual language for all Buzz Studio templates.
// These tokens are the single source of truth for colors, borders, and surfaces.
// Copy-portable to PlayerSpotlight, SoldPlayer, and TopBuys.

export const POSTER_TOKENS = {
  font:            "system-ui, sans-serif",
  white:           "#FFFFFF",
  gold:            t.primaryGold,
  ghostText:       "rgba(255,255,255,0.30)",
  mutedText:       "rgba(255,255,255,0.55)",
  glassDark:       "rgba(0,0,0,0.38)",
  glassLight:      "rgba(255,255,255,0.07)",
  borderSubtle:    "1px solid rgba(255,255,255,0.12)",
  borderMedium:    "1px solid rgba(255,255,255,0.18)",
  borderGlass:     "1.5px solid rgba(255,255,255,0.16)",
  borderGold:      `1px solid rgba(251,191,36,0.35)`,
  divider:         "linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent)",
  tagBg:           "rgba(251,191,36,0.09)",
  tagBorder:       "1px solid rgba(251,191,36,0.30)",
  watermark:       "rgba(255,255,255,0.05)",
} as const;

// ─── Component Types ──────────────────────────────────────────────────────────

type TeamRevealProps = TeamRevealContract &
  BuzzTemplateRenderProps & {
    /** Injected at render time from Creative Assets Manager. Never stored in contracts. */
    backgroundImageUrl?: string;
  };

type PosterCtx = NonNullable<ReturnType<typeof pickRenderContext>>;

// ─── Glass Logo Badge ─────────────────────────────────────────────────────────
//
// Team logo inside a circular glass container.
// No gold ring, no radial glow, no box-shadow.

function GlassLogoBadge({
  teamName,
  logoUrl,
  size,
}: {
  teamName: string;
  logoUrl?: string | null;
  size: number;
}) {
  const { initials } = monogramFor(teamName, "team");
  const fontSize = Math.round(size * 0.30);

  return (
    <div
      style={{
        width:        size,
        height:       size,
        borderRadius: "50%",
        background:   POSTER_TOKENS.glassLight,
        border:       POSTER_TOKENS.borderGlass,
        overflow:     "hidden",
        flexShrink:   0,
        display:      "flex",
        alignItems:   "center",
        justifyContent: "center",
      }}
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={teamName}
          draggable={false}
          style={{
            width:          "100%",
            height:         "100%",
            objectFit:      "cover",
            objectPosition: "center",
            display:        "block",
          }}
        />
      ) : (
        <span
          style={{
            fontFamily:   POSTER_TOKENS.font,
            fontSize:     `${fontSize}px`,
            fontWeight:   900,
            color:        "rgba(255,255,255,0.82)",
            letterSpacing: "0.05em",
            userSelect:   "none",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
}

// ─── Stat Pill ────────────────────────────────────────────────────────────────
//
// Compact inline stat: value over label. Replaces full StatCard boxes.
// Reduces DOM and padding for tighter composition.

function StatPill({
  label,
  value,
  gold = false,
  fontSize,
}: {
  label: string;
  value: string | number;
  gold?: boolean;
  fontSize: number;
}) {
  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        gap:            Math.round(fontSize * 0.28),
        padding:        `${Math.round(fontSize * 0.65)}px ${Math.round(fontSize * 1.15)}px`,
        borderRadius:   10,
        background:     POSTER_TOKENS.glassDark,
        border:         gold ? POSTER_TOKENS.borderGold : POSTER_TOKENS.borderSubtle,
        minWidth:       Math.round(fontSize * 5.5),
      }}
    >
      <span
        style={{
          fontFamily:    POSTER_TOKENS.font,
          fontSize:      `${Math.round(fontSize * 1.22)}px`,
          fontWeight:    900,
          color:         gold ? POSTER_TOKENS.gold : POSTER_TOKENS.white,
          letterSpacing: "0.04em",
          lineHeight:    1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily:    POSTER_TOKENS.font,
          fontSize:      `${Math.round(fontSize * 0.70)}px`,
          fontWeight:    600,
          color:         POSTER_TOKENS.ghostText,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          lineHeight:    1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Captain Row ──────────────────────────────────────────────────────────────

function CaptainRow({
  captainName,
  captainImageUrl,
  bodySize,
  microSize,
  align = "center",
}: {
  captainName: string;
  captainImageUrl?: string | null;
  bodySize: number;
  microSize: number;
  align?: "center" | "flex-start";
}) {
  return (
    <div
      style={{
        display:        "flex",
        flexDirection:  "column",
        alignItems:     align,
        gap:            Math.round(bodySize * 0.35),
      }}
    >
      <span
        style={{
          fontFamily:    POSTER_TOKENS.font,
          fontSize:      `${microSize}px`,
          fontWeight:    700,
          color:         POSTER_TOKENS.ghostText,
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          lineHeight:    1,
        }}
      >
        CAPTAIN
      </span>
      <div
        style={{
          display:     "flex",
          alignItems:  "center",
          gap:         Math.round(bodySize * 0.55),
          padding:     `${Math.round(bodySize * 0.45)}px ${Math.round(bodySize * 1.1)}px`,
          borderRadius: 10,
          background:  POSTER_TOKENS.glassDark,
          border:      POSTER_TOKENS.borderSubtle,
        }}
      >
        <AvatarSlot
          name={captainName}
          kind="player"
          imageUrl={captainImageUrl ?? undefined}
          size="sm"
        />
        <span
          style={{
            fontFamily:    POSTER_TOKENS.font,
            fontSize:      `${bodySize}px`,
            fontWeight:    700,
            color:         POSTER_TOKENS.white,
            letterSpacing: "0.05em",
            whiteSpace:    "nowrap",
            overflow:      "hidden",
            textOverflow:  "ellipsis",
            maxWidth:      "28ch",
          }}
        >
          {captainName}
        </span>
        <CaptainBadge />
      </div>
    </div>
  );
}

// ─── Reveal Tag ───────────────────────────────────────────────────────────────

function RevealTag({ fontSize }: { fontSize: number }) {
  return (
    <span
      style={{
        fontFamily:    POSTER_TOKENS.font,
        fontSize:      `${fontSize}px`,
        fontWeight:    800,
        color:         POSTER_TOKENS.gold,
        letterSpacing: "0.12em",
        background:    POSTER_TOKENS.tagBg,
        border:        POSTER_TOKENS.tagBorder,
        borderRadius:  999,
        padding:       `${Math.round(fontSize * 0.35)}px ${Math.round(fontSize * 1.0)}px`,
        textTransform: "uppercase",
        lineHeight:    1,
        userSelect:    "none",
      }}
    >
      ● TEAM REVEAL ●
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TeamReveal(props: TeamRevealProps) {
  const renderCtx = pickRenderContext(props);
  const {
    teamName,
    teamLogoUrl,
    sport,
    captainName,
    captainImageUrl,
    playerCount,
    backgroundImageUrl,
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  } = props;

  const spendDisplay = formatTeamSpend(props);
  const hasStats     = playerCount != null || spendDisplay != null;
  const hasCaptain   = !!captainName;
  const displayName  = teamName ?? "FRANCHISE";

  const canvasProps = {
    branding:          props.branding,
    backgroundImageUrl,
    showWatermark:     false,   // diagonal replaced by bottom-center watermark inside template
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
          sport={sport}
          captainName={captainName}
          captainImageUrl={captainImageUrl}
          playerCount={playerCount}
          spendDisplay={spendDisplay}
          hasStats={hasStats}
          hasCaptain={hasCaptain}
        />
      </BidwarCanvas>
    );
  }

  // Dev sandbox / legacy card mode (no render context)
  return (
    <BidwarCanvas {...canvasProps}>
      <TeamRevealLegacy
        displayName={displayName}
        teamLogoUrl={teamLogoUrl}
        sport={sport}
        captainName={captainName}
        captainImageUrl={captainImageUrl}
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
  sport,
  captainName,
  captainImageUrl,
  playerCount,
  spendDisplay,
  hasStats,
  hasCaptain,
}: {
  ctx: PosterCtx;
  displayName: string;
  teamLogoUrl?: string | null;
  sport: TeamRevealContract["sport"];
  captainName?: string | null;
  captainImageUrl?: string | null;
  playerCount?: number | null;
  spendDisplay: string | null;
  hasStats: boolean;
  hasCaptain: boolean;
}) {
  const spacing   = posterSpacing(ctx);
  const titleSize = heroTitleSize(ctx);
  const labelSize = secondaryLabelSize(ctx);
  const bodySize  = bodyLabelSize(ctx);
  const microSize = canvasH(ctx.renderHeight, 0.012, 10, 14);
  const landscape = isLandscapePoster(ctx);

  const gap      = spacing.sectionGap;
  const halfGap  = Math.round(gap * 0.55);
  const thirdGap = Math.round(gap * 0.35);

  // Logo badge: larger than heroLogoSize — it's the primary visual anchor
  const badgeSize = canvasH(ctx.renderHeight, 0.17, 152, 228);

  const teamNameEl = (
    <h1
      style={{
        margin:        0,
        fontFamily:    POSTER_TOKENS.font,
        fontSize:      `${titleSize}px`,
        fontWeight:    900,
        color:         POSTER_TOKENS.white,
        letterSpacing: "0.06em",
        lineHeight:    1.0,
        textTransform: "uppercase",
        textAlign:     landscape ? "left" : "center",
      }}
    >
      {displayName.toUpperCase()}
    </h1>
  );

  const franchiseLabel = (
    <span
      style={{
        fontFamily:    POSTER_TOKENS.font,
        fontSize:      `${microSize}px`,
        fontWeight:    700,
        color:         POSTER_TOKENS.ghostText,
        letterSpacing: "0.30em",
        textTransform: "uppercase",
        lineHeight:    1,
      }}
    >
      FRANCHISE
    </span>
  );

  const dividerEl = (
    <div
      aria-hidden="true"
      style={{
        width:      landscape ? "60%" : "70%",
        height:     1,
        background: POSTER_TOKENS.divider,
        flexShrink: 0,
        alignSelf:  landscape ? "flex-start" : "center",
      }}
    />
  );

  const statsEl = hasStats ? (
    <div
      style={{
        display:        "flex",
        gap:            halfGap,
        justifyContent: landscape ? "flex-start" : "center",
        flexWrap:       "wrap",
      }}
    >
      {spendDisplay != null && (
        <StatPill label="Total Spend" value={spendDisplay} gold fontSize={bodySize} />
      )}
      {playerCount != null && (
        <StatPill label="Squad Size" value={playerCount} fontSize={bodySize} />
      )}
    </div>
  ) : null;

  const captainEl = hasCaptain ? (
    <CaptainRow
      captainName={captainName!}
      captainImageUrl={captainImageUrl}
      bodySize={bodySize}
      microSize={microSize}
      align={landscape ? "flex-start" : "center"}
    />
  ) : null;

  // Bottom-center watermark (replaces diagonal BIDWAR watermark from BidwarCanvas)
  const watermarkEl = (
    <div
      aria-hidden="true"
      style={{
        display:        "flex",
        justifyContent: "center",
        width:          "100%",
        marginTop:      "auto",
        paddingTop:     thirdGap,
        flexShrink:     0,
      }}
    >
      <span
        style={{
          fontFamily:    POSTER_TOKENS.font,
          fontSize:      `${canvasH(ctx.renderHeight, 0.020, 13, 18)}px`,
          fontWeight:    900,
          color:         POSTER_TOKENS.watermark,
          letterSpacing: "0.40em",
          textTransform: "uppercase",
          userSelect:    "none",
        }}
      >
        {BIDWAR_WATERMARK}
      </span>
    </div>
  );

  // ── Landscape (16:9) ──
  if (landscape) {
    return (
      <div
        style={{
          display:     "flex",
          flexDirection: "row",
          alignItems:  "stretch",
          width:       "100%",
          height:      "100%",
          flex:        1,
          gap:         gap * 1.8,
          minHeight:   0,
        }}
      >
        {/* Left: name + info */}
        <div
          style={{
            flex:          1.1,
            display:       "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap:           halfGap,
            minWidth:      0,
          }}
        >
          {franchiseLabel}
          {teamNameEl}
          {dividerEl}
          {captainEl}
          {statsEl}
        </div>

        {/* Right: sport badge + logo */}
        <div
          style={{
            flex:          0.9,
            display:       "flex",
            flexDirection: "column",
            alignItems:    "center",
            justifyContent: "center",
            gap:           halfGap,
            minWidth:      0,
          }}
        >
          <div
            style={{
              display:        "flex",
              justifyContent: "space-between",
              alignItems:     "center",
              width:          "100%",
              marginBottom:   thirdGap,
            }}
          >
            <SportBadge sport={sport} />
            <RevealTag fontSize={labelSize} />
          </div>
          <GlassLogoBadge teamName={displayName} logoUrl={teamLogoUrl} size={badgeSize} />
        </div>
      </div>
    );
  }

  // ── Portrait (1:1, 4:5, 9:16) ──
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
      {/* Top strip */}
      <div
        style={{
          display:        "flex",
          justifyContent: "space-between",
          alignItems:     "center",
          width:          "100%",
          flexShrink:     0,
          paddingBottom:  halfGap,
        }}
      >
        <SportBadge sport={sport} />
        <RevealTag fontSize={labelSize} />
      </div>

      {/* Hero block — vertically centered */}
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
        <GlassLogoBadge teamName={displayName} logoUrl={teamLogoUrl} size={badgeSize} />

        {/* Name group — tight vertical stack */}
        <div
          style={{
            display:       "flex",
            flexDirection: "column",
            alignItems:    "center",
            gap:           thirdGap,
            marginTop:     Math.round(thirdGap * 0.5),
          }}
        >
          {franchiseLabel}
          {teamNameEl}
        </div>

        {dividerEl}

        {captainEl}

        {statsEl}
      </div>

      {/* Bottom watermark — opacity 0.05, never competes with content */}
      {watermarkEl}
    </div>
  );
}

// ─── Legacy Card (Dev Sandbox) ────────────────────────────────────────────────
//
// Shown in local dev without a render context (no aspectRatio/dimensions).
// Uses clamp-based sizes for responsive preview card.

function TeamRevealLegacy({
  displayName,
  teamLogoUrl,
  sport,
  captainName,
  captainImageUrl,
  playerCount,
  spendDisplay,
  hasStats,
  hasCaptain,
}: {
  displayName: string;
  teamLogoUrl?: string | null;
  sport: TeamRevealContract["sport"];
  captainName?: string | null;
  captainImageUrl?: string | null;
  playerCount?: number | null;
  spendDisplay: string | null;
  hasStats: boolean;
  hasCaptain: boolean;
}) {
  return (
    <div
      style={{
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        width:         "100%",
        gap:           14,
        padding:       "4px 0 8px",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
        <SportBadge sport={sport} />
        <span
          style={{
            fontFamily:    POSTER_TOKENS.font,
            fontSize:      "0.5rem",
            fontWeight:    800,
            color:         POSTER_TOKENS.gold,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            background:    POSTER_TOKENS.tagBg,
            border:        POSTER_TOKENS.tagBorder,
            borderRadius:  999,
            padding:       "3px 10px",
          }}
        >
          ● TEAM REVEAL ●
        </span>
      </div>

      <GlassLogoBadge teamName={displayName} logoUrl={teamLogoUrl} size={96} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, textAlign: "center" }}>
        <span
          style={{
            fontFamily:    POSTER_TOKENS.font,
            fontSize:      "0.45rem",
            fontWeight:    700,
            color:         POSTER_TOKENS.ghostText,
            letterSpacing: "0.26em",
            textTransform: "uppercase",
          }}
        >
          FRANCHISE
        </span>
        <h1
          style={{
            margin:        0,
            fontFamily:    POSTER_TOKENS.font,
            fontSize:      "clamp(1.5rem, 5.5vw, 2.75rem)",
            fontWeight:    900,
            color:         POSTER_TOKENS.white,
            letterSpacing: "0.06em",
            lineHeight:    1.05,
            textTransform: "uppercase",
          }}
        >
          {displayName.toUpperCase()}
        </h1>
      </div>

      <div
        aria-hidden="true"
        style={{ width: "55%", height: 1, background: POSTER_TOKENS.divider }}
      />

      {hasStats && (
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {spendDisplay != null && (
            <StatPill label="Total Spend" value={spendDisplay} gold fontSize={14} />
          )}
          {playerCount != null && (
            <StatPill label="Squad Size" value={playerCount} fontSize={14} />
          )}
        </div>
      )}

      {hasCaptain && (
        <CaptainRow
          captainName={captainName!}
          captainImageUrl={captainImageUrl}
          bodySize={14}
          microSize={10}
        />
      )}
    </div>
  );
}
