/**
 * Buzz Studio — Top Buys Template (Phase 18)
 *
 * Asset-driven content injector. Visual design lives in the background asset;
 * BidWar renders featured #1 + compact leaderboard rows (photo, name, rank, price, team).
 *
 * Pipeline: Background Asset → Dynamic Images → Dynamic Text → Footer Branding
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import { formatTopBuyPrice, resolveRank } from "./TopBuys.utils";
import type { TopBuyContract, TopBuysListContract } from "./TopBuys.types";
import {
  pickRenderContext,
  type BuzzTemplateRenderProps,
  canvasH,
} from "../../rendering/buzz-render-context";
import { getTemplateLayout } from "../../rendering/template-layout-registry";
import { BuzzTemplateType } from "../../registry/template-types";
import { isLandscapePoster, posterSpacing } from "../../rendering/poster-layout";
import {
  PosterZoneStack,
  PosterImage,
  PosterTitle,
  PosterMicroLabel,
  PosterAmount,
  PosterRank,
  PosterMetaLine,
  TournamentHeader,
  TeamIdentityRow,
  posterSizes,
} from "../../rendering/poster-primitives";

import { TopBuysFeaturedFrame, TopBuysFeaturedFrameLegacy } from "./TopBuysFeaturedFrame";

type TopBuysProps = TopBuysListContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

function isFeaturedFrameLayoutActive(props: TopBuysProps, renderCtx: ReturnType<typeof pickRenderContext>): boolean {
  return Boolean(
    props.featuredFrameLayout &&
    renderCtx?.aspectRatio === "4:5",
  );
}

function LeaderboardRow({
  entry,
  rank,
  ctx,
}: {
  entry: TopBuyContract;
  rank: number;
  ctx: NonNullable<ReturnType<typeof pickRenderContext>>;
}) {
  const sizes = posterSizes(ctx);
  const rowPhoto = canvasH(ctx.renderHeight, 0.055, 40, 56);
  const rowName = canvasH(ctx.renderHeight, 0.016, 12, 16);
  const rowPrice = canvasH(ctx.renderHeight, 0.018, 13, 18);
  const priceDisplay = formatTopBuyPrice(entry);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: Math.round(sizes.labelSize * 0.8),
        width: "100%",
        minWidth: 0,
        padding: `${Math.round(sizes.microSize * 0.4)}px 0`,
      }}
    >
      <PosterRank rank={rank} size={sizes.microSize} />
      <PosterImage name={entry.playerName} url={entry.playerImageUrl} size={rowPhoto} kind="player" />
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <PosterTitle size={rowName} align="left">{entry.playerName}</PosterTitle>
        {entry.teamName && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <PosterImage name={entry.teamName} url={entry.teamLogoUrl} size={Math.round(rowName * 1.2)} kind="team" />
            <PosterMetaLine size={Math.round(rowName * 0.85)}>{entry.teamName}</PosterMetaLine>
          </div>
        )}
      </div>
      <PosterAmount value={priceDisplay} labelSize={sizes.microSize} valueSize={rowPrice} align="right" />
    </div>
  );
}

export function TopBuys(props: TopBuysProps) {
  const renderCtx = pickRenderContext(props);
  const { entries, title, backgroundImageUrl, renderMode, aspectRatio, renderWidth, renderHeight, featuredFrameLayout } = props;

  if (entries.length === 0) return null;

  const [featuredEntry, ...restEntries] = entries;
  const featuredRank = resolveRank(featuredEntry, 0);
  const featuredPrice = formatTopBuyPrice(featuredEntry);
  const tournamentName = props.branding?.tagline;
  const tournamentLogoUrl = props.branding?.tournamentLogoUrl;
  const isFeaturedFrame = isFeaturedFrameLayoutActive(props, renderCtx);

  const canvasProps = {
    branding: props.branding,
    backgroundImageUrl,
    showFooterBranding: !isFeaturedFrame,
    showCornerBrand: false,
  } as const;

  if (renderCtx && isFeaturedFrame) {
    return (
      <BidwarCanvas
        {...canvasProps}
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        <TopBuysFeaturedFrame entry={featuredEntry} rank={featuredRank} ctx={renderCtx} />
      </BidwarCanvas>
    );
  }

  if (renderCtx) {
    const layout = getTemplateLayout(BuzzTemplateType.TOP_BUYS, renderCtx.aspectRatio);
    const zones = layout?.zones ?? {};
    const sizes = posterSizes(renderCtx);
    const landscape = isLandscapePoster(renderCtx);
    const spacing = posterSpacing(renderCtx);
    const featuredPhotoSize = canvasH(renderCtx.renderHeight, landscape ? 0.28 : 0.2, 140, 220);

    const headerBlock = (
      <>
        <PosterZoneStack spec={zones.tournamentLogo} ctx={renderCtx}>
          <TournamentHeader
            logoUrl={tournamentLogoUrl}
            name={tournamentName}
            logoSize={sizes.tournLogoSize}
            nameSize={sizes.tournNameSize}
            microSize={sizes.microSize}
          />
        </PosterZoneStack>
        <PosterZoneStack spec={zones.title} ctx={renderCtx}>
          <PosterTitle size={sizes.titleSize}>{(title ?? "TOP BUYS").toUpperCase()}</PosterTitle>
        </PosterZoneStack>
        <PosterZoneStack spec={zones.subtitle} ctx={renderCtx}>
          <PosterMicroLabel size={sizes.labelSize}>AUCTION HIGHLIGHTS</PosterMicroLabel>
        </PosterZoneStack>
      </>
    );

    const featuredBlock = (
      <>
        <PosterZoneStack spec={zones.rank} ctx={renderCtx}>
          <PosterRank rank={featuredRank} size={sizes.labelSize} />
        </PosterZoneStack>
        <PosterZoneStack spec={zones.playerPhoto} ctx={renderCtx}>
          <PosterImage name={featuredEntry.playerName} url={featuredEntry.playerImageUrl} size={featuredPhotoSize} kind="player" />
        </PosterZoneStack>
        <PosterZoneStack spec={zones.playerName} ctx={renderCtx}>
          <PosterTitle size={Math.round(sizes.titleSize * 0.55)}>{featuredEntry.playerName}</PosterTitle>
          {featuredEntry.designation ? (
            <PosterMetaLine size={sizes.labelSize}>{featuredEntry.designation}</PosterMetaLine>
          ) : null}
        </PosterZoneStack>
        <PosterZoneStack spec={zones.amount} ctx={renderCtx}>
          <PosterAmount label="TOP BUY" value={featuredPrice} labelSize={sizes.labelSize} valueSize={sizes.amountSize} />
        </PosterZoneStack>
        {featuredEntry.teamName && (
          <PosterZoneStack spec={zones.teamLogo} ctx={renderCtx}>
            <TeamIdentityRow
              teamName={featuredEntry.teamName}
              teamLogoUrl={featuredEntry.teamLogoUrl}
              logoSize={Math.round(sizes.bodySize * 1.6)}
              nameSize={sizes.bodySize}
            />
          </PosterZoneStack>
        )}
      </>
    );

    const leaderboardBlock =
      restEntries.length > 0 ? (
        <PosterZoneStack spec={{ ...zones.leaderboard, flex: 1 }} ctx={renderCtx}>
          <div style={{ display: "flex", flexDirection: "column", width: "100%", gap: spacing.sectionGap * 0.35 }}>
            {restEntries.map((entry, idx) => (
              <LeaderboardRow
                key={entry.playerId ?? `entry-${idx}`}
                entry={entry}
                rank={resolveRank(entry, idx + 1)}
                ctx={renderCtx}
              />
            ))}
          </div>
        </PosterZoneStack>
      ) : null;

    const content = landscape ? (
      <div style={{ display: "flex", flexDirection: "row", width: "100%", height: "100%", flex: 1, minHeight: 0, gap: spacing.sectionGap }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, gap: spacing.sectionGap * 0.5 }}>
          {headerBlock}
          {featuredBlock}
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
          {leaderboardBlock}
        </div>
      </div>
    ) : (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", flex: 1, minHeight: 0 }}>
        {headerBlock}
        {featuredBlock}
        {leaderboardBlock}
      </div>
    );

    return (
      <BidwarCanvas
        {...canvasProps}
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        {content}
      </BidwarCanvas>
    );
  }

  if (featuredFrameLayout) {
    return (
      <BidwarCanvas {...canvasProps}>
        <TopBuysFeaturedFrameLegacy entry={featuredEntry} rank={0} />
      </BidwarCanvas>
    );
  }

  return (
    <BidwarCanvas {...canvasProps}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "100%", gap: 12 }}>
        <TournamentHeader logoUrl={tournamentLogoUrl} name={tournamentName} logoSize={56} nameSize={12} microSize={9} />
        <PosterTitle size={28}>{(title ?? "TOP BUYS").toUpperCase()}</PosterTitle>
        <PosterMicroLabel size={10}>AUCTION HIGHLIGHTS</PosterMicroLabel>
        <PosterRank rank={featuredRank} size={11} />
        <PosterImage name={featuredEntry.playerName} url={featuredEntry.playerImageUrl} size={100} kind="player" />
        <PosterTitle size={22}>{featuredEntry.playerName}</PosterTitle>
        <PosterAmount label="TOP BUY" value={featuredPrice} labelSize={10} valueSize={24} />
        {featuredEntry.teamName && (
          <TeamIdentityRow teamName={featuredEntry.teamName} teamLogoUrl={featuredEntry.teamLogoUrl} logoSize={30} nameSize={13} />
        )}
        {restEntries.map((entry, idx) => (
          <LeaderboardRow key={entry.playerId ?? `entry-${idx}`} entry={entry} rank={resolveRank(entry, idx + 1)} ctx={{
            renderMode: "preview",
            aspectRatio: "1:1",
            renderWidth: 1080,
            renderHeight: 1080,
          }} />
        ))}
      </div>
    </BidwarCanvas>
  );
}
