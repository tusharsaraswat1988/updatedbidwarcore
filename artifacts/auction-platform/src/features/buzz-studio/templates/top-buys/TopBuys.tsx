/**
 * Buzz Studio — Top Buys Template (Phase 18)
 *
 * Pure HTML + CSS poster for the featured #1 top buy.
 * Every visual element is an independent component — no background image.
 *
 * Pipeline: CSS Background → Decorative Elements → Dynamic Images → Dynamic Text → Footer
 */

import React from "react";
import { BidwarCanvas } from "../../canvas/BidwarCanvas";
import type { TopBuysListContract } from "./TopBuys.types";
import {
  pickRenderContext,
  type BuzzAspectRatio,
  type BuzzTemplateRenderProps,
} from "../../rendering/buzz-render-context";
import { TopBuyPoster } from "./TopBuyPoster";

type TopBuysProps = TopBuysListContract &
  BuzzTemplateRenderProps & {
    backgroundImageUrl?: string;
  };

export function TopBuys(props: TopBuysProps) {
  const renderCtx = pickRenderContext(props);
  const { entries, renderMode, aspectRatio, renderWidth, renderHeight } = props;

  if (entries.length === 0) return null;

  const featuredEntry = entries[0];

  const canvasProps = {
    branding: props.branding,
    showFooterBranding: false,
    showCornerBrand: false,
  } as const;

  if (renderCtx) {
    return (
      <BidwarCanvas
        {...canvasProps}
        fullBleedContent
        renderMode={renderMode ?? renderCtx.renderMode}
        aspectRatio={aspectRatio ?? renderCtx.aspectRatio}
        renderWidth={renderWidth ?? renderCtx.renderWidth}
        renderHeight={renderHeight ?? renderCtx.renderHeight}
      >
        <TopBuyPoster
          entry={featuredEntry}
          branding={props.branding}
          ctx={renderCtx}
        />
      </BidwarCanvas>
    );
  }

  const legacyCtx = {
    renderMode: "preview" as const,
    aspectRatio: (aspectRatio ?? "4:5") as BuzzAspectRatio,
    renderWidth: renderWidth ?? 1080,
    renderHeight: renderHeight ?? 1350,
    featuredFrameLayout: false,
  };

  return (
    <BidwarCanvas {...canvasProps} fullBleedContent>
      <TopBuyPoster
        entry={featuredEntry}
        branding={props.branding}
        ctx={legacyCtx}
      />
    </BidwarCanvas>
  );
}
