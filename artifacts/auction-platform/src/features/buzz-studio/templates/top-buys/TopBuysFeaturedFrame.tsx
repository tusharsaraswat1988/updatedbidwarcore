/**
 * Top Buys — Featured Frame Layout (4:5)
 *
 * Injects content only inside template placeholder frames from metadata.
 * Pipeline: Background Asset → Framed Images → Framed Text
 */

import React from "react";
import type { TopBuyContract } from "./TopBuys.types";
import type { BuzzRenderContext } from "../../rendering/buzz-render-context";
import { BuzzTemplateType } from "../../registry/template-types";
import { getTemplatePlaceholderFrames } from "../../rendering/template-frame-registry";
import {
  FramePhoto,
  FrameLogo,
  FramePlayerName,
  FrameAmount,
  FrameRank,
} from "../../rendering/poster-content-frame";
import { formatTopBuyPrice, resolveRank } from "./TopBuys.utils";
import {
  TOP_BUYS_FEATURED_STYLE as S,
  FEATURED_AMOUNT_SHADOW,
  FEATURED_NAME_SHADOW,
  formatFeaturedTopBuyPrice,
} from "./top-buys-featured-style";

export function TopBuysFeaturedFrame({
  entry,
  rank,
  ctx,
}: {
  entry: TopBuyContract;
  rank: number;
  ctx: BuzzRenderContext;
}) {
  const frames = getTemplatePlaceholderFrames(BuzzTemplateType.TOP_BUYS, ctx.aspectRatio);
  if (!frames) return null;

  const priceDisplay = formatFeaturedTopBuyPrice(formatTopBuyPrice(entry));
  const teamName = entry.teamName ?? "Team";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      {frames.rankFrame ? (
        <FrameRank
          frame={frames.rankFrame}
          ctx={ctx}
          rank={rank}
          fontDisplay={S.fontDisplay}
          color={S.metallicGold}
          shadow={FEATURED_AMOUNT_SHADOW}
        />
      ) : null}

      <FramePhoto
        frame={frames.photoFrame}
        ctx={ctx}
        imageUrl={entry.playerImageUrl}
        name={entry.playerName}
      />

      <FrameLogo
        frame={frames.logoFrame}
        ctx={ctx}
        imageUrl={entry.teamLogoUrl}
        name={teamName}
      />

      <FramePlayerName
        frame={frames.nameFrame}
        ctx={ctx}
        name={entry.playerName}
        role={entry.designation}
        fontDisplay={S.fontDisplay}
        fontLabel={S.fontLabel}
        nameColor={S.white}
        roleColor={S.labelWhite}
        nameShadow={FEATURED_NAME_SHADOW}
      />

      <FrameAmount
        frame={frames.amountFrame}
        ctx={ctx}
        label="TOP BUY"
        price={priceDisplay}
        fontDisplay={S.fontDisplay}
        fontLabel={S.fontLabel}
        labelColor={S.labelWhite}
        valueColor={S.metallicGold}
        valueShadow={FEATURED_AMOUNT_SHADOW}
      />
    </div>
  );
}

export function TopBuysFeaturedFrameLegacy({
  entry,
  rank,
}: {
  entry: TopBuyContract;
  rank: number;
}) {
  const ctx: BuzzRenderContext = {
    renderMode: "preview",
    aspectRatio: "4:5",
    renderWidth: 1080,
    renderHeight: 1350,
  };
  return (
    <TopBuysFeaturedFrame
      entry={entry}
      rank={resolveRank(entry, rank)}
      ctx={ctx}
    />
  );
}
