/**
 * Buzz Studio — Team Squad Template
 *
 * Per-team roster creative showing sold + retained players.
 * Responsive across 1:1, 4:5, 9:16, 16:9 — no name/price clipping.
 */

import React from "react";
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
  computeSquadRosterLayout,
  fitTournamentTitleSize,
  fitTeamTitleSize,
  isMarqueePlayerTag,
  squadTagTheme,
} from "./TeamSquad.utils";
import type { SquadRosterLayout } from "./TeamSquad.utils";
import type { TeamSquadContract, TeamSquadPlayerEntry } from "./TeamSquad.types";
import { monogramFor } from "../../asset-engine/monogram-generator";

type TeamSquadProps = TeamSquadContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

const PT = POSTER_TOKENS;
const DEFAULT_ACCENT = "#FBBF24";
/** Player photo glow at 20% intensity (80% reduction from default). */
const SQUAD_GLOW_INTENSITY = 0.2;

const SQUAD_PLAYER_GLOW = {
  radialBackground:
    "radial-gradient(circle, rgba(251,191,36,0.16) 0%, rgba(253,224,71,0.10) 34%, rgba(217,119,6,0.06) 54%, transparent 76%)",
  imageRing:
    "0 0 0 1px rgba(253,224,71,0.5), 0 0 4px rgba(251,191,36,0.14), 0 0 9px rgba(217,119,6,0.07)",
} as const;

const SQUAD_ROW_BACKGROUND =
  "linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.78) 100%)";

const TOP_SOLD_ACCENT = "#F59E0B";

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
    showFooterBranding: true,
    showCornerBrand: false,
    footerVariant: "generated-by" as const,
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
          currency={props.currency}
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
  const rosterLayout = computeSquadRosterLayout(ctx, players, currency);
  const rowGap = rosterLayout.rowGap;
  const contentWidth = Math.round(ctx.renderWidth * 0.9);

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
      logoSize={Math.round(sizes.tournLogoSize * (landscape ? 0.75 : 0.7))}
      preferredNameSize={sizes.tournNameSize}
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
      logoSize={landscape ? Math.round(sizes.teamLogoSize * 0.42) : Math.round(sizes.teamLogoSize * 0.34)}
      preferredTitleSize={landscape ? Math.round(sizes.titleSize * 0.42) : Math.round(sizes.titleSize * 0.4)}
      microSize={sizes.microSize}
      bodySize={bodySize}
      landscape={landscape}
      availableWidth={landscape ? Math.round(ctx.renderWidth * 0.28) : contentWidth}
      compact={ctx.aspectRatio === "9:16" && players.length >= 8}
    />
  );

  const rosterEl = (
    <SquadRosterGrid
      players={players}
      rosterLayout={rosterLayout}
      accent={accent}
      currency={currency}
    />
  );

  if (landscape) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
        {sponsorBarEl}
        <PosterZoneStack spec={{ ...zones.tournamentLogo, align: "center" }} ctx={ctx}>
          {headerEl}
        </PosterZoneStack>
        <div style={{ flex: 1, display: "flex", flexDirection: "row", gap: spacing.sectionGap, minHeight: 0, paddingTop: rowGap }}>
          <PosterZoneStack spec={{ ...zones.teamLogo, flex: 0, minHeightRatio: 0 }} ctx={ctx}>
            {teamHeaderEl}
          </PosterZoneStack>
          <PosterZoneStack spec={{ ...zones.roster, flex: 1, align: "stretch" }} ctx={ctx}>
            {rosterEl}
          </PosterZoneStack>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {sponsorBarEl}
      <PosterZoneStack spec={{ ...zones.tournamentLogo, minHeightRatio: 0.08, align: "center" }} ctx={ctx}>
        {headerEl}
      </PosterZoneStack>
      <PosterZoneStack spec={{ ...zones.teamLogo, flex: 0, minHeightRatio: 0.12, align: "center" }} ctx={ctx}>
        {teamHeaderEl}
      </PosterZoneStack>
      <PosterZoneStack spec={{ ...zones.roster, flex: 1, align: "stretch", justify: "flex-start" }} ctx={ctx}>
        {rosterEl}
      </PosterZoneStack>
    </div>
  );
}

/* ─── Sponsors ───────────────────────────────────────────────────────────── */

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
        padding: `${Math.round(height * 0.15)}px ${padX}px`,
        flexShrink: 0,
        gap: Math.round(height * 0.4),
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: Math.round(height * 0.25), minWidth: 0, flex: 1 }}>
        {hasTitle && titleSponsor ? (
          <>
            <span
              style={{
                fontFamily: PT.font,
                fontSize: Math.max(7, Math.round(height * 0.28)),
                fontWeight: 700,
                color: PT.ghost,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              Title
            </span>
            <img
              src={titleSponsor.url}
              alt={titleSponsor.name ?? "Title Sponsor"}
              draggable={false}
              style={{
                height: logoH,
                width: "auto",
                maxWidth: Math.round(width * 0.22),
                objectFit: "contain",
                display: "block",
              }}
            />
          </>
        ) : (
          <span />
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: Math.round(height * 0.35), minWidth: 0, flex: 1 }}>
        {cos.length > 0 ? (
          <>
            <span
              style={{
                fontFamily: PT.font,
                fontSize: Math.max(7, Math.round(height * 0.28)),
                fontWeight: 700,
                color: PT.ghost,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                flexShrink: 0,
              }}
            >
              Co
            </span>
            {cos.map((sponsor, i) => (
              <img
                key={`${sponsor.url}-${i}`}
                src={sponsor.url}
                alt={sponsor.name ?? `Co Sponsor ${i + 1}`}
                draggable={false}
                style={{
                  height: Math.round(logoH * 0.9),
                  width: "auto",
                  maxWidth: Math.round(width * 0.12),
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ))}
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Tournament header (2-line, 80% size) ───────────────────────────────── */

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
    ? fitTournamentTitleSize(name!, availableWidth * 0.92, preferredNameSize, 2)
    : preferredNameSize;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: Math.round(microSize * 0.45),
        width: "100%",
      }}
    >
      {hasLogo ? (
        <PosterImage name={name ?? "Tournament"} url={logoUrl} size={logoSize} kind="tournament" />
      ) : null}
      {hasName ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: Math.round(microSize * 0.35), width: "100%" }}>
          <h2
            style={{
              margin: 0,
              fontFamily: PT.font,
              fontSize: `${nameSize}px`,
              fontWeight: 800,
              color: PT.white,
              letterSpacing: "0.06em",
              lineHeight: 1.15,
              textTransform: "uppercase",
              textAlign: "center",
              maxWidth: "100%",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
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

/* ─── Team header ────────────────────────────────────────────────────────── */

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
        flexDirection: landscape ? "column" : "column",
        alignItems: "center",
        gap: Math.round(microSize * (compact ? 0.7 : 1.0)),
        width: "100%",
        padding: `${Math.round(microSize * 0.25)}px 0`,
      }}
    >
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
            inset: "-12%",
            borderRadius: "50%",
            background: `radial-gradient(circle, ${accent}55 0%, transparent 70%)`,
            filter: "blur(8px)",
          }}
        />
        <PosterImage name={displayName} url={teamLogoUrl} size={logoSize} kind="team" />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: Math.round(microSize * 0.45),
          minWidth: 0,
          width: "100%",
        }}
      >
        <PosterMicroLabel size={microSize} gold>
          FULL SQUAD
        </PosterMicroLabel>
        <h1
          style={{
            margin: 0,
            fontFamily: PT.font,
            fontSize: `${titleSize}px`,
            fontWeight: 900,
            color: PT.white,
            letterSpacing: "0.05em",
            lineHeight: 1.1,
            textTransform: "uppercase",
            textAlign: "center",
            maxWidth: "100%",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {displayName}
        </h1>
        <div
          style={{
            display: "flex",
            gap: Math.round(microSize * 0.7),
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {counts.sold > 0 ? (
            <SquadCountPill label="SOLD" value={counts.sold} accent={PT.gold} size={bodySize} />
          ) : null}
          {counts.retained > 0 ? (
            <SquadCountPill label="RETAINED" value={counts.retained} accent="#22C55E" size={bodySize} />
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
        padding: `${Math.round(size * 0.2)}px ${Math.round(size * 0.55)}px`,
        borderRadius: 999,
        border: `1px solid ${accent}66`,
        background: `linear-gradient(135deg, ${accent}22 0%, rgba(0,0,0,0.35) 100%)`,
      }}
    >
      <span
        style={{
          fontFamily: PT.font,
          fontSize: Math.max(8, Math.round(size * 0.65)),
          fontWeight: 700,
          color: PT.ghost,
          letterSpacing: "0.14em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: PT.font,
          fontSize: size,
          fontWeight: 800,
          color: accent,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ─── Roster ─────────────────────────────────────────────────────────────── */

function SquadRosterGrid({
  players,
  rosterLayout,
  accent,
  currency,
}: {
  players: TeamSquadPlayerEntry[];
  rosterLayout: SquadRosterLayout;
  accent: string;
  currency?: string;
}) {
  if (players.length === 0) {
    return (
      <div style={{ width: "100%", textAlign: "center", padding: rosterLayout.rowGap * 2 }}>
        <PosterMicroLabel size={rosterLayout.metaSize}>NO PLAYERS IN SQUAD YET</PosterMicroLabel>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${rosterLayout.columns}, minmax(0, 1fr))`,
        gap: rosterLayout.rowGap,
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
          rosterLayout={rosterLayout}
          accent={accent}
          currency={currency}
        />
      ))}
    </div>
  );
}

function SquadPlayerAvatar({
  name,
  url,
  size,
  glowColor,
  glowRing,
}: {
  name: string;
  url?: string | null;
  size: number;
  glowColor?: string;
  glowRing?: string;
}) {
  const radial = glowColor
    ? `radial-gradient(circle, ${glowColor} 0%, transparent 72%)`
    : SQUAD_PLAYER_GLOW.radialBackground;
  const ring = glowRing ?? SQUAD_PLAYER_GLOW.imageRing;

  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
    flexShrink: 0,
    borderRadius: "50%",
    boxShadow: ring,
  };

  const content = url ? (
    <img src={url} alt={name} draggable={false} style={imgStyle} />
  ) : (
    <span
      style={{
        ...imgStyle,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: PT.font,
        fontSize: `${Math.round(size * 0.38)}px`,
        fontWeight: 900,
        color: "rgba(255,255,255,0.70)",
        letterSpacing: "0.06em",
      }}
    >
      {monogramFor(name, "player").initials}
    </span>
  );

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
        aria-hidden
        style={{
          position: "absolute",
          inset: "-14%",
          borderRadius: "50%",
          background: radial,
          filter: `blur(${Math.max(4, Math.round(size * 0.08 * (glowColor ? 1.4 : SQUAD_GLOW_INTENSITY * 5)))}px)`,
          pointerEvents: "none",
        }}
      />
      <div style={{ position: "relative", zIndex: 1 }}>{content}</div>
    </div>
  );
}

function SquadPlayerRow({
  player,
  rosterLayout,
  accent,
  currency,
}: {
  player: TeamSquadPlayerEntry;
  rosterLayout: SquadRosterLayout;
  accent: string;
  currency?: string;
}) {
  const price = formatSquadPlayerPrice(player, currency);
  const isRetained = player.status === "retained";
  const statusColor = isRetained ? "#22C55E" : PT.gold;
  const statusLabel = isRetained ? "RETAINED" : "SOLD";
  const tagTheme = squadTagTheme(player.playerTag);
  const isMarquee = isMarqueePlayerTag(player.playerTag);
  const isTopSold = player.isTopSold === true;

  let rowBorder = `1px solid rgba(255,255,255,0.08)`;
  let rowShadow: string | undefined;
  let avatarGlow: string | undefined;
  let avatarRing: string | undefined;

  if (isMarquee && tagTheme) {
    rowBorder = `1px solid ${tagTheme.border}`;
    rowShadow = `0 0 10px ${tagTheme.glow}`;
    avatarGlow = tagTheme.glow;
    avatarRing = `0 0 0 1.5px ${tagTheme.color}, 0 0 8px ${tagTheme.glow}`;
  } else if (player.isCaptain) {
    rowBorder = `1px solid ${accent}66`;
    rowShadow = `0 0 8px ${accent}22`;
  } else if (isTopSold) {
    rowBorder = `1px solid ${TOP_SOLD_ACCENT}55`;
    rowShadow = `0 0 6px ${TOP_SOLD_ACCENT}18`;
    avatarRing = `0 0 0 1px ${TOP_SOLD_ACCENT}88, 0 0 5px ${TOP_SOLD_ACCENT}33`;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: Math.round(rosterLayout.rowPaddingX * 0.7),
        padding: `${rosterLayout.rowPaddingY}px ${rosterLayout.rowPaddingX}px`,
        minHeight: rosterLayout.rowMinHeight,
        borderRadius: Math.round(rosterLayout.metaSize * 0.65),
        background: isTopSold && !isMarquee
          ? `linear-gradient(90deg, rgba(245,158,11,0.12) 0%, rgba(0,0,0,0.72) 55%)`
          : SQUAD_ROW_BACKGROUND,
        border: rowBorder,
        boxShadow: rowShadow,
        minWidth: 0,
        width: "100%",
        overflow: "hidden",
      }}
    >
      <SquadPlayerAvatar
        name={player.playerName}
        url={player.playerImageUrl}
        size={rosterLayout.avatarSize}
        glowColor={avatarGlow}
        glowRing={avatarRing}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: Math.round(rosterLayout.metaSize * 0.18),
          minWidth: 0,
          flex: "1 1 0",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(rosterLayout.metaSize * 0.3), minWidth: 0 }}>
          <span
            style={{
              fontFamily: PT.font,
              fontSize: rosterLayout.nameSize,
              fontWeight: 800,
              color: PT.white,
              letterSpacing: "0.02em",
              lineHeight: 1.15,
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              flex: 1,
              minWidth: 0,
            }}
          >
            {player.playerName}
          </span>
          {player.isCaptain ? (
            <span
              style={{
                fontFamily: PT.font,
                fontSize: Math.max(7, rosterLayout.metaSize - 1),
                fontWeight: 800,
                color: accent,
                letterSpacing: "0.1em",
                flexShrink: 0,
              }}
            >
              (C)
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(rosterLayout.metaSize * 0.3), minWidth: 0, flexWrap: "wrap" }}>
          <StatusPill label={statusLabel} color={statusColor} size={rosterLayout.metaSize} />
          {isMarquee && tagTheme ? (
            <StatusPill label={tagTheme.label.toUpperCase()} color={tagTheme.color} size={rosterLayout.metaSize} />
          ) : null}
          {isTopSold && player.topSoldRank ? (
            <StatusPill label={`TOP ${player.topSoldRank}`} color={TOP_SOLD_ACCENT} size={rosterLayout.metaSize} />
          ) : null}
          {player.designation && !isMarquee ? (
            <span
              style={{
                fontFamily: PT.font,
                fontSize: rosterLayout.metaSize,
                fontWeight: 600,
                color: PT.ghost,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "40%",
              }}
            >
              {player.designation}
            </span>
          ) : null}
        </div>
      </div>
      {price ? (
        <div
          style={{
            flex: "0 0 auto",
            flexShrink: 0,
            width: rosterLayout.priceAreaWidth,
            minWidth: rosterLayout.priceAreaWidth,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingLeft: Math.round(rosterLayout.rowPaddingX * 0.35),
          }}
        >
          <span
            style={{
              fontFamily: PT.font,
              fontSize: rosterLayout.priceSize,
              fontWeight: 800,
              color: isRetained ? "#86EFAC" : PT.gold,
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
            paddingLeft: Math.round(rosterLayout.rowPaddingX * 0.35),
          }}
        >
          <span
            style={{
              fontFamily: PT.font,
              fontSize: rosterLayout.metaSize,
              fontWeight: 700,
              color: "#86EFAC",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            RETAINED
          </span>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ label, color, size }: { label: string; color: string; size: number }) {
  return (
    <span
      style={{
        fontFamily: PT.font,
        fontSize: Math.max(7, size - 2),
        fontWeight: 800,
        color,
        letterSpacing: "0.12em",
        padding: `${Math.round(size * 0.12)}px ${Math.round(size * 0.35)}px`,
        borderRadius: 4,
        border: `1px solid ${color}55`,
        background: `${color}18`,
        lineHeight: 1,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
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
        rosterLayout={{
          columns: players.length >= 5 ? 2 : 1,
          avatarSize: 36,
          rowGap: 8,
          rowPaddingY: 6,
          rowPaddingX: 8,
          nameSize: 14,
          priceSize: 22,
          metaSize: 9,
          rowMinHeight: 52,
          priceAreaWidth: 100,
          nameAreaWidth: 140,
        }}
        accent={accent}
      />
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
        <img src={BIDWAR_REVERSE_LOGO_URL} alt="BidWar" style={{ height: 18, width: "auto" }} />
      </div>
    </div>
  );
}
