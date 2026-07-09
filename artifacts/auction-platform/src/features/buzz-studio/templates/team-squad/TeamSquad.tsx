/**
 * Buzz Studio — Team Squad Template
 *
 * Per-team roster creative showing sold + retained players.
 * Tournament name at top, BidWar logo in footer, all four export ratios.
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
  PosterTitle,
  PosterMicroLabel,
  TournamentHeader,
  posterSizes,
  POSTER_TOKENS,
} from "../../rendering/poster-primitives";
import {
  formatSquadPlayerPrice,
  rosterGridColumns,
  squadCounts,
} from "./TeamSquad.utils";
import type { TeamSquadContract, TeamSquadPlayerEntry } from "./TeamSquad.types";

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
}: {
  ctx: BuzzRenderContext;
  displayName: string;
  teamLogoUrl?: string | null;
  tournamentName?: string | null;
  tournamentLogoUrl?: string | null;
  players: TeamSquadPlayerEntry[];
  accent: string;
  currency?: string;
}) {
  const layout = getTemplateLayout(BuzzTemplateType.TEAM_SQUAD, ctx.aspectRatio);
  const zones = layout?.zones ?? {};
  const spacing = posterSpacing(ctx);
  const sizes = posterSizes(ctx);
  const bodySize = bodyLabelSize(ctx);
  const landscape = isLandscapePoster(ctx);
  const counts = squadCounts({ players } as TeamSquadContract);
  const columns = rosterGridColumns(ctx.aspectRatio, players.length);
  const rowGap = Math.round(spacing.sectionGap * 0.45);
  const avatarSize = landscape
    ? Math.max(28, Math.round(ctx.renderHeight * 0.09))
    : Math.max(32, Math.round(ctx.renderHeight * (ctx.aspectRatio === "9:16" ? 0.042 : 0.048)));

  const headerEl = (
    <TournamentHeader
      logoUrl={tournamentLogoUrl}
      name={tournamentName}
      logoSize={sizes.tournLogoSize}
      nameSize={sizes.tournNameSize}
      microSize={sizes.microSize}
    />
  );

  const teamHeaderEl = (
    <TeamSquadHeader
      displayName={displayName}
      teamLogoUrl={teamLogoUrl}
      accent={accent}
      counts={counts}
      logoSize={landscape ? Math.round(sizes.teamLogoSize * 0.55) : Math.round(sizes.teamLogoSize * 0.42)}
      titleSize={landscape ? Math.round(sizes.titleSize * 0.42) : Math.round(sizes.titleSize * 0.38)}
      microSize={sizes.microSize}
      bodySize={bodySize}
      landscape={landscape}
    />
  );

  const rosterEl = (
    <SquadRosterGrid
      players={players}
      columns={columns}
      avatarSize={avatarSize}
      accent={accent}
      currency={currency}
      microSize={sizes.microSize}
      bodySize={bodySize}
      rowGap={rowGap}
      landscape={landscape}
    />
  );

  if (landscape) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
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
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
      <PosterZoneStack spec={zones.tournamentLogo} ctx={ctx}>
        {headerEl}
      </PosterZoneStack>
      <PosterZoneStack spec={{ ...zones.teamLogo, flex: 0 }} ctx={ctx}>
        {teamHeaderEl}
      </PosterZoneStack>
      <PosterZoneStack spec={{ ...zones.roster, flex: 1, align: "stretch", justify: "flex-start" }} ctx={ctx}>
        {rosterEl}
      </PosterZoneStack>
    </div>
  );
}

function TeamSquadHeader({
  displayName,
  teamLogoUrl,
  accent,
  counts,
  logoSize,
  titleSize,
  microSize,
  bodySize,
  landscape,
}: {
  displayName: string;
  teamLogoUrl?: string | null;
  accent: string;
  counts: { sold: number; retained: number; total: number };
  logoSize: number;
  titleSize: number;
  microSize: number;
  bodySize: number;
  landscape: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: landscape ? "column" : "row",
        alignItems: landscape ? "center" : "center",
        gap: Math.round(microSize * 1.2),
        width: "100%",
        padding: `${Math.round(microSize * 0.5)}px 0`,
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
          alignItems: landscape ? "center" : "flex-start",
          gap: Math.round(microSize * 0.5),
          minWidth: 0,
          flex: landscape ? undefined : 1,
        }}
      >
        <PosterMicroLabel size={microSize} gold>
          FULL SQUAD
        </PosterMicroLabel>
        <PosterTitle size={titleSize} align={landscape ? "center" : "left"}>
          {displayName}
        </PosterTitle>
        <div style={{ display: "flex", gap: Math.round(microSize * 0.8), flexWrap: "wrap", justifyContent: landscape ? "center" : "flex-start" }}>
          <SquadCountPill label="TOTAL" value={counts.total} accent={accent} size={bodySize} />
          {counts.sold > 0 ? (
            <SquadCountPill label="SOLD" value={counts.sold} accent={PT.gold} size={bodySize} />
          ) : null}
          {counts.retained > 0 ? (
            <SquadCountPill label="RETAINED" value={counts.retained} accent="#22C55E" size={bodySize} />
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

function SquadRosterGrid({
  players,
  columns,
  avatarSize,
  accent,
  currency,
  microSize,
  bodySize,
  rowGap,
  landscape,
}: {
  players: TeamSquadPlayerEntry[];
  columns: number;
  avatarSize: number;
  accent: string;
  currency?: string;
  microSize: number;
  bodySize: number;
  rowGap: number;
  landscape: boolean;
}) {
  if (players.length === 0) {
    return (
      <div style={{ width: "100%", textAlign: "center", padding: rowGap * 2 }}>
        <PosterMicroLabel size={microSize}>NO PLAYERS IN SQUAD YET</PosterMicroLabel>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap: rowGap,
        width: "100%",
        alignContent: "start",
      }}
    >
      {players.map((player, index) => (
        <SquadPlayerRow
          key={player.playerId ?? `${player.playerName}-${index}`}
          player={player}
          avatarSize={avatarSize}
          accent={accent}
          currency={currency}
          microSize={microSize}
          bodySize={bodySize}
          compact={landscape || columns > 1}
        />
      ))}
    </div>
  );
}

function SquadPlayerRow({
  player,
  avatarSize,
  accent,
  currency,
  microSize,
  bodySize,
  compact,
}: {
  player: TeamSquadPlayerEntry;
  avatarSize: number;
  accent: string;
  currency?: string;
  microSize: number;
  bodySize: number;
  compact: boolean;
}) {
  const price = formatSquadPlayerPrice(player, currency);
  const isRetained = player.status === "retained";
  const statusColor = isRetained ? "#22C55E" : PT.gold;
  const statusLabel = isRetained ? "RETAINED" : "SOLD";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: Math.round(microSize * 0.9),
        padding: `${Math.round(microSize * 0.45)}px ${Math.round(microSize * 0.55)}px`,
        borderRadius: Math.round(microSize * 0.7),
        background: "linear-gradient(90deg, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.28) 100%)",
        border: `1px solid ${player.isCaptain ? `${accent}88` : "rgba(255,255,255,0.1)"}`,
        boxShadow: player.isCaptain ? `0 0 12px ${accent}33` : undefined,
        minWidth: 0,
      }}
    >
      <PosterImage
        name={player.playerName}
        url={player.playerImageUrl}
        size={avatarSize}
        kind="player"
      />
      <div style={{ display: "flex", flexDirection: "column", gap: Math.round(microSize * 0.25), minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(microSize * 0.4), minWidth: 0 }}>
          <span
            style={{
              fontFamily: PT.font,
              fontSize: compact ? Math.max(11, bodySize - 2) : bodySize,
              fontWeight: 800,
              color: PT.white,
              letterSpacing: "0.03em",
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
            }}
          >
            {player.playerName}
          </span>
          {player.isCaptain ? (
            <span
              style={{
                fontFamily: PT.font,
                fontSize: Math.max(7, microSize - 1),
                fontWeight: 800,
                color: accent,
                letterSpacing: "0.12em",
                flexShrink: 0,
              }}
            >
              (C)
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(microSize * 0.45), flexWrap: "wrap" }}>
          <StatusPill label={statusLabel} color={statusColor} size={microSize} />
          {player.designation ? (
            <span
              style={{
                fontFamily: PT.font,
                fontSize: Math.max(8, microSize - 1),
                fontWeight: 600,
                color: PT.ghost,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
              }}
            >
              {player.designation}
            </span>
          ) : null}
          {price ? (
            <span
              style={{
                fontFamily: PT.font,
                fontSize: Math.max(9, microSize),
                fontWeight: 700,
                color: isRetained ? "#86EFAC" : PT.gold,
                marginLeft: "auto",
                letterSpacing: "0.04em",
              }}
            >
              {price}
            </span>
          ) : null}
        </div>
      </div>
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
        letterSpacing: "0.14em",
        padding: `${Math.round(size * 0.15)}px ${Math.round(size * 0.4)}px`,
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

function TeamSquadLegacy({
  displayName,
  teamLogoUrl,
  tournamentName,
  tournamentLogoUrl,
  players,
  accent,
}: {
  displayName: string;
  teamLogoUrl?: string | null;
  tournamentName?: string | null;
  tournamentLogoUrl?: string | null;
  players: TeamSquadPlayerEntry[];
  accent: string;
}) {
  const counts = squadCounts({ players } as TeamSquadContract);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: 16, padding: "8px 0" }}>
      <TournamentHeader logoUrl={tournamentLogoUrl} name={tournamentName} logoSize={56} nameSize={14} microSize={9} />
      <TeamSquadHeader
        displayName={displayName}
        teamLogoUrl={teamLogoUrl}
        accent={accent}
        counts={counts}
        logoSize={72}
        titleSize={26}
        microSize={9}
        bodySize={13}
        landscape={false}
      />
      <SquadRosterGrid
        players={players}
        columns={players.length > 8 ? 2 : 1}
        avatarSize={36}
        accent={accent}
        microSize={9}
        bodySize={13}
        rowGap={8}
        landscape={false}
      />
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
        <img src={BIDWAR_REVERSE_LOGO_URL} alt="BidWar" style={{ height: 18, width: "auto" }} />
      </div>
    </div>
  );
}
