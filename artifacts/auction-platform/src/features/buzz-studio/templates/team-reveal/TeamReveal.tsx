/**
 * Buzz Studio — Team Reveal Template (Phase 18)
 *
 * Asset-driven content injector. Visual design lives in the background asset;
 * BidWar renders tournament header, team logo/name, stats row, and footer only.
 *
 * Pipeline: Background Asset → Dynamic Images → Dynamic Text → Footer Branding
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import {
  pickRenderContext,
  type BuzzTemplateRenderProps,
} from "../../rendering/buzz-render-context";
import { getTemplateLayout } from "../../rendering/template-layout-registry";
import { BuzzTemplateType } from "../../registry/template-types";
import {
  isLandscapePoster,
  posterSpacing,
  bodyLabelSize,
} from "../../rendering/poster-layout";
import { formatTeamSpend } from "./TeamReveal.utils";
import type { TeamRevealContract } from "./TeamReveal.types";
import {
  PosterZoneStack,
  PosterImage,
  PosterTitle,
  TournamentHeader,
  StatBlock,
  BidwarFooter,
  posterSizes,
  posterTextAlign,
  POSTER_TOKENS,
} from "../../rendering/poster-primitives";

/** @deprecated Use POSTER_TOKENS from poster-primitives */
export { POSTER_TOKENS };

type TeamRevealProps = TeamRevealContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

type PosterCtx = NonNullable<ReturnType<typeof pickRenderContext>>;

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
  const hasStats = playerCount != null || spendDisplay != null;
  const hasCaptain = !!captainName;
  const displayName = teamName ?? "FRANCHISE";
  const tournamentName = props.branding?.tagline;
  const tournamentLogoUrl = props.branding?.tournamentLogoUrl;

  const canvasProps = {
    branding: props.branding,
    backgroundImageUrl,
    showWatermark: false,
    showFooterBranding: false,
    showCornerBrand: false,
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
  const layout = getTemplateLayout(BuzzTemplateType.TEAM_REVEAL, ctx.aspectRatio);
  const zones = layout?.zones ?? {};
  const spacing = posterSpacing(ctx);
  const sizes = posterSizes(ctx);
  const bodySize = bodyLabelSize(ctx);
  const landscape = isLandscapePoster(ctx);
  const align = posterTextAlign(landscape);
  const halfGap = Math.round(spacing.sectionGap * 0.55);
  const statsAlign = landscape ? "left" : "center";
  const anyStats = hasCaptain || hasStats;

  const headerEl = (
    <TournamentHeader
      logoUrl={tournamentLogoUrl}
      name={tournamentName}
      logoSize={sizes.tournLogoSize}
      nameSize={sizes.tournNameSize}
      microSize={sizes.microSize}
    />
  );

  const captainEl = hasCaptain ? (
    <StatBlock label="CAPTAIN" value={captainName!} align={statsAlign} labelSize={sizes.microSize} valueSize={bodySize} />
  ) : null;
  const squadEl = playerCount != null ? (
    <StatBlock label="SQUAD" value={playerCount} align={statsAlign} labelSize={sizes.microSize} valueSize={bodySize} />
  ) : null;
  const spendEl = spendDisplay != null ? (
    <StatBlock label="SPEND" value={spendDisplay} gold align={statsAlign} labelSize={sizes.microSize} valueSize={bodySize} />
  ) : null;

  if (landscape) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
        <PosterZoneStack spec={{ ...zones.tournamentLogo, align: "center" }} ctx={ctx}>
          {headerEl}
        </PosterZoneStack>
        <div style={{ flex: 1, display: "flex", flexDirection: "row", alignItems: "center", minHeight: 0 }}>
          <PosterZoneStack spec={{ ...zones.teamLogo, flex: 1 }} ctx={ctx}>
            <PosterImage name={displayName} url={teamLogoUrl} size={sizes.teamLogoSize} kind="team" />
          </PosterZoneStack>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: spacing.sectionGap, minWidth: 0 }}>
            <PosterZoneStack spec={{ ...zones.teamName, align: "flex-start" }} ctx={ctx}>
              <PosterTitle size={sizes.titleSize} align={align}>{displayName}</PosterTitle>
            </PosterZoneStack>
            {anyStats && (
              <PosterZoneStack spec={{ ...zones.statsRow, align: "flex-start" }} ctx={ctx}>
                <div style={{ display: "flex", gap: spacing.sectionGap * 1.4, alignItems: "flex-start" }}>
                  {captainEl}
                  {squadEl}
                  {spendEl}
                </div>
              </PosterZoneStack>
            )}
          </div>
        </div>
        <PosterZoneStack spec={zones.footerBranding} ctx={ctx}>
          <BidwarFooter size={sizes.footerSize} />
        </PosterZoneStack>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
      <PosterZoneStack spec={zones.tournamentLogo} ctx={ctx}>
        {headerEl}
      </PosterZoneStack>
      <PosterZoneStack spec={{ ...zones.teamLogo, flex: 1 }} ctx={ctx}>
        <PosterImage name={displayName} url={teamLogoUrl} size={sizes.teamLogoSize} kind="team" />
        <div style={{ paddingTop: halfGap }}>
          <PosterTitle size={sizes.titleSize}>{displayName}</PosterTitle>
        </div>
      </PosterZoneStack>
      {anyStats ? (
        <PosterZoneStack spec={zones.statsRow} ctx={ctx}>
          <div style={{ display: "flex", gap: spacing.sectionGap * 1.5, alignItems: "center", justifyContent: "center", width: "100%" }}>
            {captainEl}
            {squadEl}
            {spendEl}
          </div>
        </PosterZoneStack>
      ) : (
        <PosterZoneStack spec={{ minHeightRatio: 0.15 }} ctx={ctx}>{null}</PosterZoneStack>
      )}
      <PosterZoneStack spec={zones.footerBranding} ctx={ctx}>
        <BidwarFooter size={sizes.footerSize} />
      </PosterZoneStack>
    </div>
  );
}

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
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: "clamp(12px, 3vw, 22px)", padding: "10px 0" }}>
      <TournamentHeader logoUrl={tournamentLogoUrl} name={tournamentName} logoSize={64} nameSize={13} microSize={9} />
      <PosterImage name={displayName} url={teamLogoUrl} size={108} kind="team" />
      <PosterTitle size={32}>{displayName}</PosterTitle>
      {(hasCaptain || hasStats) && (
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", justifyContent: "center" }}>
          {hasCaptain && <StatBlock label="CAPTAIN" value={captainName!} labelSize={9} valueSize={13} />}
          {playerCount != null && <StatBlock label="SQUAD" value={playerCount} labelSize={9} valueSize={13} />}
          {spendDisplay != null && <StatBlock label="SPEND" value={spendDisplay} gold labelSize={9} valueSize={13} />}
        </div>
      )}
      <BidwarFooter size={13} />
    </div>
  );
}
