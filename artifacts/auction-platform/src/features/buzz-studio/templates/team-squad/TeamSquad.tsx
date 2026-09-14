/**
 * Buzz Studio — Team Squad Template
 *
 * Per-team roster creative showing sold + retained players.
 * Responsive across 1:1, 4:5, 9:16, 16:9 with preset player-count tiers:
 * - < 8 players, 8-11 players, 12-16+ players
 *
 * Data per player: Photo, Name, Sold At / Price.
 */

import React, { useState, useEffect } from "react";
import { BIDWAR_REVERSE_LOGO_URL } from "../../assets/bidwar-brand";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import {
  pickRenderContext,
  type BuzzRenderContext,
  type BuzzTemplateRenderProps,
} from "../../rendering/buzz-render-context";
import { getTemplateLayout } from "../../rendering/template-layout-registry";
import { BuzzTemplateType } from "../../registry/template-types";
import {
  isLandscapePoster,
  posterSpacing,
  bodyLabelSize,
} from "../../rendering/poster-layout";
import {
  PosterZoneStack,
  PosterImage,
  PosterMicroLabel,
  posterSizes,
  POSTER_TOKENS,
} from "../../rendering/poster-primitives";
import type { BuzzBranding, BuzzSponsorMark } from "../../contracts/branding";
import {
  formatSquadPlayerPrice,
  squadCounts,
  getSquadLayoutPreset,
  fitTournamentTitleSize,
  fitTeamTitleSize,
  type SquadLayoutPreset,
} from "./TeamSquad.utils";
import type { TeamSquadContract, TeamSquadPlayerEntry } from "./TeamSquad.types";
import { monogramFor } from "../../asset-engine/monogram-generator";

type TeamSquadProps = TeamSquadContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

const PT = POSTER_TOKENS;
const DEFAULT_ACCENT = "#FBBF24";

export function TeamSquad(props: TeamSquadProps) {
  const renderCtx = pickRenderContext(props);
  const {
    teamName,
    teamLogoUrl,
    teamColor,
    players,
    backgroundImageUrl,
    renderMode,
    aspectRatio,
    renderWidth,
    renderHeight,
  } = props;

  const displayName = teamName ?? "FRANCHISE";
  const tournamentName = props.branding?.tagline;
  const tournamentLogoUrl = props.branding?.tournamentLogoUrl;
  const accent = teamColor?.trim() || DEFAULT_ACCENT;

  const canvasProps = {
    branding: props.branding,
    backgroundImageUrl,
    showWatermark: false,
    showFooterBranding: false,
    showCornerBrand: false,
  };

  if (renderCtx) {
    return (
      <BidwarCanvas
        {...canvasProps}
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        <TeamSquadPoster
          ctx={renderCtx}
          displayName={displayName}
          teamLogoUrl={teamLogoUrl}
          tournamentName={tournamentName}
          tournamentLogoUrl={tournamentLogoUrl}
          players={players}
          accent={accent}
          currency={props.auctionUnit ?? props.currency}
          branding={props.branding}
        />
      </BidwarCanvas>
    );
  }

  return (
    <BidwarCanvas {...canvasProps}>
      <TeamSquadLegacy
        displayName={displayName}
        teamLogoUrl={teamLogoUrl}
        tournamentName={tournamentName}
        tournamentLogoUrl={tournamentLogoUrl}
        players={players}
        accent={accent}
        branding={props.branding}
      />
    </BidwarCanvas>
  );
}

function TeamSquadPoster({
  ctx,
  displayName,
  teamLogoUrl,
  tournamentName,
  tournamentLogoUrl,
  players,
  accent,
  currency,
  branding,
}: {
  ctx: BuzzRenderContext;
  displayName: string;
  teamLogoUrl?: string | null;
  tournamentName?: string | null;
  tournamentLogoUrl?: string | null;
  players: TeamSquadPlayerEntry[];
  accent: string;
  currency?: string;
  branding?: BuzzBranding;
}) {
  const layout = getTemplateLayout(BuzzTemplateType.TEAM_SQUAD, ctx.aspectRatio);
  const zones = layout?.zones ?? {};
  const spacing = posterSpacing(ctx);
  const sizes = posterSizes(ctx);
  const bodySize = bodyLabelSize(ctx);
  const landscape = isLandscapePoster(ctx);
  const counts = squadCounts({ players } as TeamSquadContract);

  const hasSponsors = Boolean(
    branding?.titleSponsor?.url || (branding?.coSponsors ?? []).some((s) => s.url),
  );
  const preset = getSquadLayoutPreset(ctx, players.length, hasSponsors);
  const contentWidth = Math.round(ctx.renderWidth * (1 - 0.055 * 2));

  const sponsorBarEl = (
    <SquadSponsorBar
      titleSponsor={branding?.titleSponsor}
      coSponsors={branding?.coSponsors}
      height={landscape ? Math.round(ctx.renderHeight * 0.055) : Math.round(ctx.renderHeight * 0.038)}
      width={ctx.renderWidth}
    />
  );

  const headerEl = (
    <SquadTournamentHeader
      logoUrl={tournamentLogoUrl}
      name={tournamentName}
      logoSize={Math.round(sizes.tournLogoSize * (landscape ? 0.72 : 0.65))}
      preferredNameSize={landscape ? sizes.tournNameSize : Math.round(sizes.tournNameSize * 0.95)}
      microSize={sizes.microSize}
      availableWidth={contentWidth}
    />
  );

  const teamHeaderEl = (
    <TeamSquadHeader
      displayName={displayName}
      teamLogoUrl={teamLogoUrl}
      accent={accent}
      counts={counts}
      logoSize={landscape ? Math.round(sizes.teamLogoSize * 0.45) : Math.round(sizes.teamLogoSize * 0.38)}
      preferredTitleSize={landscape ? Math.round(sizes.titleSize * 0.44) : Math.round(sizes.titleSize * 0.42)}
      microSize={sizes.microSize}
      bodySize={bodySize}
      landscape={landscape}
      availableWidth={landscape ? Math.round(ctx.renderWidth * 0.28) : contentWidth}
      compact={ctx.aspectRatio === "4:5" || (ctx.aspectRatio === "9:16" && players.length >= 8)}
    />
  );

  const rosterEl = (
    <SquadRosterGrid
      players={players}
      preset={preset}
      accent={accent}
      currency={currency}
    />
  );

  const footerEl = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        paddingTop: Math.max(6, Math.round(ctx.renderHeight * 0.008)),
        paddingBottom: Math.max(4, Math.round(ctx.renderHeight * 0.006)),
        flexShrink: 0,
      }}
    >
      <img
        src={BIDWAR_REVERSE_LOGO_URL}
        alt="BidWar"
        draggable={false}
        style={{
          height: Math.max(16, Math.round(ctx.renderHeight * 0.018)),
          width: "auto",
          opacity: 0.85,
        }}
      />
    </div>
  );

  if (landscape) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
        {sponsorBarEl}
        <PosterZoneStack spec={{ ...zones.tournamentLogo, align: "center" }} ctx={ctx}>
          {headerEl}
        </PosterZoneStack>
        <div style={{ flex: 1, display: "flex", flexDirection: "row", gap: spacing.sectionGap, minHeight: 0, paddingTop: preset.rowGap }}>
          <PosterZoneStack spec={{ ...zones.teamLogo, flex: 0, minHeightRatio: 0 }} ctx={ctx}>
            {teamHeaderEl}
          </PosterZoneStack>
          <PosterZoneStack spec={{ ...zones.roster, flex: 1, align: "stretch" }} ctx={ctx}>
            {rosterEl}
          </PosterZoneStack>
        </div>
        {footerEl}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        justifyContent: "space-between",
      }}
    >
      {sponsorBarEl}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", flexShrink: 0, gap: 4 }}>
        {headerEl}
        {teamHeaderEl}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", width: "100%", marginTop: preset.rowGap }}>
        {rosterEl}
      </div>

      {footerEl}
    </div>
  );
}

/* ─── Sponsors (Clean logo presentation without Title/Co text labels) ─────── */

function SquadSponsorBar({
  titleSponsor,
  coSponsors,
  height,
  width,
}: {
  titleSponsor?: BuzzSponsorMark;
  coSponsors?: BuzzSponsorMark[];
  height: number;
  width: number;
}) {
  const hasTitle = Boolean(titleSponsor?.url);
  const cos = (coSponsors ?? []).filter((s) => s.url).slice(0, 3);
  if (!hasTitle && cos.length === 0) return null;

  const logoH = Math.max(18, Math.round(height * 0.85));
  const padX = Math.round(width * 0.04);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        minHeight: height,
        padding: `${Math.round(height * 0.1)}px ${padX}px`,
        flexShrink: 0,
        gap: Math.round(height * 0.4),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", minWidth: 0, flex: 1 }}>
        {hasTitle && titleSponsor ? (
          <img
            src={titleSponsor.url}
            alt={titleSponsor.name ?? "Title Sponsor"}
            draggable={false}
            style={{
              height: logoH,
              width: "auto",
              maxWidth: Math.round(width * 0.25),
              objectFit: "contain",
              display: "block",
            }}
          />
        ) : (
          <span />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: Math.round(height * 0.35), minWidth: 0, flex: 1 }}>
        {cos.map((sponsor, i) => (
          <img
            key={`${sponsor.url}-${i}`}
            src={sponsor.url}
            alt={sponsor.name ?? `Co Sponsor ${i + 1}`}
            draggable={false}
            style={{
              height: Math.round(logoH * 0.9),
              width: "auto",
              maxWidth: Math.round(width * 0.15),
              objectFit: "contain",
              display: "block",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Tournament Header ──────────────────────────────────────────────────── */

function SquadTournamentHeader({
  logoUrl,
  name,
  logoSize,
  preferredNameSize,
  microSize,
  availableWidth,
}: {
  logoUrl?: string | null;
  name?: string | null;
  logoSize: number;
  preferredNameSize: number;
  microSize: number;
  availableWidth: number;
}) {
  const hasLogo = Boolean(logoUrl);
  const hasName = Boolean(name?.trim());
  if (!hasLogo && !hasName) return null;

  const nameSize = hasName
    ? fitTournamentTitleSize(name!, availableWidth * 0.94, preferredNameSize, 2)
    : preferredNameSize;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        width: "100%",
      }}
    >
      {hasLogo ? (
        <PosterImage name={name ?? "Tournament"} url={logoUrl} size={logoSize} kind="tournament" />
      ) : null}
      {hasName ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, width: "100%" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: PT.font,
              fontSize: `${nameSize}px`,
              fontWeight: 900,
              color: "#FFFFFF",
              letterSpacing: "0.08em",
              lineHeight: 1.15,
              textTransform: "uppercase",
              textAlign: "center",
              maxWidth: "100%",
            }}
          >
            {name}
          </h2>
          <PosterMicroLabel size={microSize} gold>
            PRESENTS
          </PosterMicroLabel>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Team Header ────────────────────────────────────────────────────────── */

function TeamSquadHeader({
  displayName,
  teamLogoUrl,
  accent,
  counts,
  logoSize,
  preferredTitleSize,
  microSize,
  bodySize,
  landscape,
  availableWidth,
  compact = false,
}: {
  displayName: string;
  teamLogoUrl?: string | null;
  accent: string;
  counts: { sold: number; retained: number; total: number };
  logoSize: number;
  preferredTitleSize: number;
  microSize: number;
  bodySize: number;
  landscape: boolean;
  availableWidth: number;
  compact?: boolean;
}) {
  const titleSize = fitTeamTitleSize(displayName, availableWidth * 0.95, preferredTitleSize, 2);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: compact ? 3 : 5,
        width: "100%",
        padding: "2px 0",
      }}
    >
      {/* Team Logo with Subtle Halo */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: "-14%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${accent}66 0%, transparent 70%)`,
            filter: "blur(10px)",
            pointerEvents: "none",
          }}
        />
        <PosterImage name={displayName} url={teamLogoUrl} size={logoSize} kind="team" />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          minWidth: 0,
          width: "100%",
        }}
      >
        <PosterMicroLabel size={microSize} gold>
          FULL SQUAD
        </PosterMicroLabel>

        {/* Team Name */}
        <h1
          style={{
            margin: 0,
            fontFamily: PT.font,
            fontSize: `${titleSize}px`,
            fontWeight: 900,
            color: "#FFFFFF",
            letterSpacing: "0.04em",
            lineHeight: 1.1,
            textTransform: "uppercase",
            textAlign: "center",
            maxWidth: "100%",
          }}
        >
          {displayName}
        </h1>

        {/* Squad Status Pills */}
        <div
          style={{
            display: "flex",
            gap: Math.max(6, Math.round(microSize * 0.8)),
            flexWrap: "wrap",
            justifyContent: "center",
            marginTop: 2,
          }}
        >
          {counts.sold > 0 ? (
            <SquadCountPill label="SOLD" value={counts.sold} accent={PT.gold} size={bodySize} />
          ) : null}
          {counts.retained > 0 ? (
            <SquadCountPill label="RETAINED" value={counts.retained} accent="#10B981" size={bodySize} />
          ) : null}
          {counts.sold === 0 && counts.retained === 0 ? (
            <SquadCountPill label="TOTAL" value={counts.total} accent={accent} size={bodySize} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SquadCountPill({
  label,
  value,
  accent,
  size,
}: {
  label: string;
  value: number;
  accent: string;
  size: number;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(size * 0.35),
        padding: `${Math.round(size * 0.18)}px ${Math.round(size * 0.55)}px`,
        borderRadius: 999,
        border: `1.5px solid ${accent}88`,
        background: `linear-gradient(135deg, ${accent}25 0%, rgba(0,0,0,0.65) 100%)`,
        boxShadow: `0 2px 8px rgba(0,0,0,0.4)`,
      }}
    >
      <span
        style={{
          fontFamily: PT.font,
          fontSize: Math.max(8, Math.round(size * 0.7)),
          fontWeight: 800,
          color: "rgba(255,255,255,0.75)",
          letterSpacing: "0.14em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: PT.font,
          fontSize: size,
          fontWeight: 900,
          color: accent,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─── Roster Grid ────────────────────────────────────────────────────────── */

function SquadRosterGrid({
  players,
  preset,
  accent,
  currency,
}: {
  players: TeamSquadPlayerEntry[];
  preset: SquadLayoutPreset;
  accent: string;
  currency?: string;
}) {
  if (players.length === 0) {
    return (
      <div style={{ width: "100%", textAlign: "center", padding: preset.rowGap * 2 }}>
        <PosterMicroLabel size={preset.nameSize}>NO PLAYERS IN SQUAD YET</PosterMicroLabel>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${preset.columns}, minmax(0, 1fr))`,
        gap: preset.rowGap,
        width: "100%",
        height: "100%",
        alignContent: "start",
        overflow: "hidden",
      }}
    >
      {players.map((player, index) => (
        <SquadPlayerRow
          key={player.playerId ?? `${player.playerName}-${index}`}
          player={player}
          preset={preset}
          accent={accent}
          currency={currency}
        />
      ))}
    </div>
  );
}

/* ─── Player Avatar with Stateful Loading & Branded Fallback ─────────────── */

function SquadPlayerAvatar({
  name,
  url,
  size,
  glowRing,
  accent,
}: {
  name: string;
  url?: string | null;
  size: number;
  glowRing?: string;
  accent?: string;
}) {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [url]);

  const showImage = Boolean(url && !imageError);
  const ring = glowRing ?? "0 0 0 1.5px rgba(255,255,255,0.18)";
  const borderRadius = Math.max(8, Math.round(size * 0.2));

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius,
          boxShadow: ring,
          flexShrink: 0,
          backgroundColor: "#1E293B",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {showImage ? (
          <img
            src={url!}
            alt={name}
            draggable={false}
            onError={() => setImageError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
              display: "block",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, #1E293B 0%, #0F172A 100%)`,
              border: `1px solid ${accent ? `${accent}44` : "rgba(255,255,255,0.12)"}`,
              borderRadius: "inherit",
              fontFamily: PT.font,
              fontSize: `${Math.max(10, Math.round(size * 0.36))}px`,
              fontWeight: 900,
              color: "#FFFFFF",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {monogramFor(name, "player").initials}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Squad Player Card Row (Photo, Name, Sold At / Price ONLY) ─────────── */

function SquadPlayerRow({
  player,
  preset,
  accent,
  currency,
}: {
  player: TeamSquadPlayerEntry;
  preset: SquadLayoutPreset;
  accent: string;
  currency?: string;
}) {
  const price = formatSquadPlayerPrice(player, currency);
  const isRetained = player.status === "retained";
  const isTopSold = player.isTopSold === true;

  let rowBorder = `1px solid rgba(255,255,255,0.12)`;
  let rowBg = `linear-gradient(135deg, rgba(15, 23, 42, 0.94) 0%, rgba(10, 15, 29, 0.96) 100%)`;
  let rowShadow = `0 4px 12px rgba(0,0,0,0.3)`;
  let avatarRing: string | undefined;

  if (player.isCaptain) {
    rowBorder = `1.5px solid ${accent}88`;
    rowBg = `linear-gradient(135deg, ${accent}15 0%, rgba(15, 23, 42, 0.95) 100%)`;
    rowShadow = `0 4px 14px ${accent}22`;
    avatarRing = `0 0 0 1.5px ${accent}`;
  } else if (isTopSold) {
    rowBorder = `1.5px solid rgba(245, 158, 11, 0.6)`;
    rowBg = `linear-gradient(135deg, rgba(245, 158, 11, 0.16) 0%, rgba(15, 23, 42, 0.95) 100%)`;
    rowShadow = `0 4px 16px rgba(245, 158, 11, 0.15)`;
    avatarRing = `0 0 0 1.5px #F59E0B, 0 0 8px rgba(245, 158, 11, 0.3)`;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: preset.gapInsideRow,
        padding: `${preset.rowPaddingY}px ${preset.rowPaddingX}px`,
        height: preset.rowHeight,
        minHeight: preset.rowHeight,
        maxHeight: preset.rowHeight,
        borderRadius: Math.max(8, Math.round(preset.rowHeight * 0.12)),
        background: rowBg,
        border: rowBorder,
        boxShadow: rowShadow,
        boxSizing: "border-box",
        minWidth: 0,
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* 1. Photo */}
      <SquadPlayerAvatar
        name={player.playerName}
        url={player.playerImageUrl}
        size={preset.avatarSize}
        glowRing={avatarRing}
        accent={accent}
      />

      {/* 2. Name (Uniform font size, no letter wrapping) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          minWidth: 0,
          flex: "1 1 0",
          overflow: "hidden",
        }}
      >
        <span
          style={{
            fontFamily: PT.font,
            fontSize: `${preset.nameSize}px`,
            fontWeight: 900,
            color: "#FFFFFF",
            letterSpacing: "0.02em",
            lineHeight: 1.15,
            whiteSpace: "normal",
            wordBreak: "normal",
            overflowWrap: "normal",
            textTransform: "uppercase",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {player.playerName}
        </span>
        {player.isCaptain ? (
          <span
            style={{
              fontFamily: PT.font,
              fontSize: `${Math.max(8, Math.round(preset.nameSize * 0.62))}px`,
              fontWeight: 900,
              color: accent || PT.gold,
              letterSpacing: "0.08em",
              flexShrink: 0,
              padding: "2px 4px",
              borderRadius: 4,
              background: "rgba(251, 191, 36, 0.15)",
              border: "1px solid rgba(251, 191, 36, 0.4)",
              lineHeight: 1,
            }}
          >
            (C)
          </span>
        ) : null}
      </div>

      {/* 3. Sold At / Price */}
      {price ? (
        <div
          style={{
            flex: "0 0 auto",
            flexShrink: 0,
            width: preset.priceAreaWidth,
            minWidth: preset.priceAreaWidth,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 2,
            paddingLeft: 6,
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <span
            style={{
              fontFamily: PT.font,
              fontSize: `${preset.statusSize}px`,
              fontWeight: 800,
              color: isRetained ? "#86EFAC" : "rgba(251, 191, 36, 0.85)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {isRetained ? "RETAINED" : "SOLD"}
          </span>
          <span
            style={{
              fontFamily: PT.font,
              fontSize: `${preset.priceSize}px`,
              fontWeight: 900,
              color: isRetained ? "#4ADE80" : "#FBBF24",
              letterSpacing: "0.01em",
              lineHeight: 1,
              whiteSpace: "nowrap",
              textAlign: "right",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {price}
          </span>
        </div>
      ) : isRetained ? (
        <div
          style={{
            flex: "0 0 auto",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingLeft: 6,
          }}
        >
          <span
            style={{
              fontFamily: PT.font,
              fontSize: `${preset.statusSize}px`,
              fontWeight: 800,
              color: "#86EFAC",
              letterSpacing: "0.1em",
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid rgba(74, 222, 128, 0.4)",
              background: "rgba(74, 222, 128, 0.12)",
            }}
          >
            RETAINED
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Legacy preview (no export frame) ───────────────────────────────────── */

function TeamSquadLegacy({
  displayName,
  teamLogoUrl,
  tournamentName,
  tournamentLogoUrl,
  players,
  accent,
  branding,
}: {
  displayName: string;
  teamLogoUrl?: string | null;
  tournamentName?: string | null;
  tournamentLogoUrl?: string | null;
  players: TeamSquadPlayerEntry[];
  accent: string;
  branding?: BuzzBranding;
}) {
  const counts = squadCounts({ players } as TeamSquadContract);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 16, padding: "8px 0" }}>
      <SquadSponsorBar
        titleSponsor={branding?.titleSponsor}
        coSponsors={branding?.coSponsors}
        height={36}
        width={480}
      />
      <SquadTournamentHeader
        logoUrl={tournamentLogoUrl}
        name={tournamentName}
        logoSize={56}
        preferredNameSize={14}
        microSize={9}
        availableWidth={440}
      />
      <TeamSquadHeader
        displayName={displayName}
        teamLogoUrl={teamLogoUrl}
        accent={accent}
        counts={counts}
        logoSize={72}
        preferredTitleSize={28}
        microSize={9}
        bodySize={13}
        landscape={false}
        availableWidth={440}
      />
      <SquadRosterGrid
        players={players}
        preset={{
          columns: players.length >= 5 ? 2 : 1,
          avatarSize: 42,
          rowGap: 8,
          rowPaddingY: 6,
          rowPaddingX: 8,
          gapInsideRow: 8,
          nameSize: 14,
          priceSize: 18,
          statusSize: 9,
          rowHeight: 64,
          priceAreaWidth: 90,
        }}
        accent={accent}
      />
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
        <img src={BIDWAR_REVERSE_LOGO_URL} alt="BidWar" style={{ height: 18, width: "auto" }} />
      </div>
    </div>
  );
}
