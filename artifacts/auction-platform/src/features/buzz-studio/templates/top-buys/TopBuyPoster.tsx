/**
 * Top Buy — full CSS poster layout.
 * Composes independent chrome components into a single dynamic poster.
 */

import React from "react";
import type { TopBuyContract } from "./TopBuys.types";
import type { BuzzBranding } from "../../contracts/branding";
import type { BuzzRenderContext } from "../../rendering/buzz-render-context";
import { isLandscapePoster } from "../../rendering/poster-layout";
import { formatTopBuyPrice } from "./TopBuys.utils";
import { formatFeaturedTopBuyPrice } from "./top-buys-featured-style";
import {
  TopBuyBackground,
  TopBuyDecorativeElements,
  TopBuyTournamentHeader,
  TopBuyTitle,
  TopBuyPlayerImage,
  TopBuyPlayerName,
  TopBuyTeamName,
  TopBuyPriceCard,
  TopBuyFooter,
  topBuyPosterClass,
  topBuyScale,
} from "./top-buy-chrome";

export type TopBuyPosterProps = {
  entry: TopBuyContract;
  branding?: BuzzBranding;
  ctx: BuzzRenderContext;
};

export function TopBuyPoster({ entry, branding, ctx }: TopBuyPosterProps) {
  const scale = topBuyScale(ctx);
  const landscape = isLandscapePoster(ctx);
  const tournamentName = branding?.tagline;
  const tournamentLogoUrl = branding?.tournamentLogoUrl;
  const priceDisplay = formatFeaturedTopBuyPrice(formatTopBuyPrice(entry));
  const playerName = entry.playerName.toUpperCase();
  const teamName = entry.teamName?.toUpperCase();

  const photoBlock = (
    <TopBuyPlayerImage name={entry.playerName} imageUrl={entry.playerImageUrl} />
  );

  const lowerBlock = (
    <div className="top-buy-lower-block">
      <TopBuyPlayerName>{playerName}</TopBuyPlayerName>
      {teamName ? (
        <TopBuyTeamName teamName={teamName} teamLogoUrl={entry.teamLogoUrl} />
      ) : null}
      <TopBuyPriceCard price={priceDisplay} />
    </div>
  );

  return (
    <article
      className={topBuyPosterClass(ctx)}
      style={{ "--tb-scale": scale } as React.CSSProperties}
    >
      <TopBuyBackground />
      <TopBuyDecorativeElements />

      <div className="top-buy-content">
        <div className="top-buy-content-main">
          <div className="top-buy-hero-block">
            <TopBuyTournamentHeader
              tournamentName={tournamentName}
              tournamentLogoUrl={tournamentLogoUrl}
            />
            <TopBuyTitle />
          </div>
          <div className="top-buy-body-block">
            {photoBlock}
            {lowerBlock}
          </div>
        </div>
      </div>

      <TopBuyFooter poweredByText={branding?.poweredByText?.trim() || "Powered by"} />
    </article>
  );
}
