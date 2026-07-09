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
  squadCounts,
  computeSquadRosterLayout,
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
  ambientShadow:
    "0 0 5px 2px rgba(251,191,36,0.11), 0 0 10px 4px rgba(217,119,6,0.07), 0 0 14px 6px rgba(251,191,36,0.04)",
  imageRing:
    "0 0 0 1px rgba(253,224,71,0.5), 0 0 4px rgba(251,191,36,0.14), 0 0 9px rgba(217,119,6,0.07)",
} as const;

const SQUAD_ROW_BACKGROUND =
  "linear-gradient(90deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.78) 100%)";

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
  const rosterLayout = computeSquadRosterLayout(ctx, players, currency);
  const rowGap = rosterLayout.rowGap;

  const headerEl = (
    <TournamentHeader
      logoUrl={tournamentLogoUrl}
      name={tournamentName}
      logoSize={Math.round(sizes.tournLogoSize * (landscape ? 0.9 : 0.82))}
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
      logoSize={landscape ? Math.round(sizes.teamLogoSize * 0.48) : Math.round(sizes.teamLogoSize * 0.36)}
      titleSize={landscape ? Math.round(sizes.titleSize * 0.36) : Math.round(sizes.titleSize * 0.32)}
      microSize={sizes.microSize}
      bodySize={bodySize}
      landscape={landscape}
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
      <PosterZoneStack spec={{ ...zones.tournamentLogo, minHeightRatio: landscape ? 0.1 : 0.09, align: "center" }} ctx={ctx}>
        {headerEl}
      </PosterZoneStack>
      <PosterZoneStack spec={{ ...zones.teamLogo, flex: 0, minHeightRatio: landscape ? 0 : 0.11, align: "center" }} ctx={ctx}>
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
  compact = false,
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
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: landscape ? "column" : "row",
        alignItems: landscape ? "center" : "center",
        gap: Math.round(microSize * (compact ? 0.9 : 1.2)),
        width: "100%",
        padding: `${Math.round(microSize * 0.35)}px 0`,
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
}: {
  name: string;
  url?: string | null;
  size: number;
}) {
  const imgStyle: React.CSSProperties = {
    width: size,
    height: size,
    objectFit: "cover",
    objectPosition: "center",
    display: "block",
    flexShrink: 0,
    borderRadius: "50%",
    boxShadow: SQUAD_PLAYER_GLOW.imageRing,
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
          inset: "-10%",
          borderRadius: "50%",
          background: SQUAD_PLAYER_GLOW.radialBackground,
          filter: `blur(${Math.max(4, Math.round(size * 0.06 * SQUAD_GLOW_INTENSITY * 5))}px)`,
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

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: Math.round(rosterLayout.rowPaddingX * 0.8),
        padding: `${rosterLayout.rowPaddingY}px ${rosterLayout.rowPaddingX}px`,
        minHeight: rosterLayout.rowMinHeight,
        borderRadius: Math.round(rosterLayout.metaSize * 0.65),
        background: SQUAD_ROW_BACKGROUND,
        border: `1px solid ${player.isCaptain ? `${accent}66` : "rgba(255,255,255,0.08)"}`,
        boxShadow: player.isCaptain ? `0 0 8px ${accent}22` : undefined,
        minWidth: 0,
        width: "100%",
      }}
    >
      <SquadPlayerAvatar
        name={player.playerName}
        url={player.playerImageUrl}
        size={rosterLayout.avatarSize}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: Math.round(rosterLayout.metaSize * 0.2),
          minWidth: 0,
          flex: "1 1 0",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(rosterLayout.metaSize * 0.35), minWidth: 0 }}>
          <span
            style={{
              fontFamily: PT.font,
              fontSize: rosterLayout.nameSize,
              fontWeight: 800,
              color: PT.white,
              letterSpacing: "0.03em",
              lineHeight: 1.1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
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
                letterSpacing: "0.12em",
                flexShrink: 0,
              }}
            >
              (C)
            </span>
          ) : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: Math.round(rosterLayout.metaSize * 0.35), minWidth: 0 }}>
          <StatusPill label={statusLabel} color={statusColor} size={rosterLayout.metaSize} />
          {player.designation ? (
            <span
              style={{
                fontFamily: PT.font,
                fontSize: rosterLayout.metaSize,
                fontWeight: 600,
                color: PT.ghost,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
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
            minWidth: rosterLayout.priceAreaWidth,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingLeft: Math.round(rosterLayout.rowPaddingX * 0.5),
            overflow: "visible",
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
            paddingLeft: Math.round(rosterLayout.rowPaddingX * 0.5),
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
        rosterLayout={{
          columns: players.length > 8 ? 2 : 1,
          avatarSize: 36,
          rowGap: 8,
          rowPaddingY: 6,
          rowPaddingX: 8,
          nameSize: 16,
          priceSize: 30,
          metaSize: 9,
          rowMinHeight: 52,
          priceAreaWidth: 120,
        }}
        accent={accent}
      />
      <div style={{ display: "flex", justifyContent: "center", paddingTop: 8 }}>
        <img src={BIDWAR_REVERSE_LOGO_URL} alt="BidWar" style={{ height: 18, width: "auto" }} />
      </div>
    </div>
  );
}
