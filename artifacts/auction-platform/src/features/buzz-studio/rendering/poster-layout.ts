/**
 * Shared poster spacing + typography scales for export/preview frames.
 */

import type { BuzzAspectRatio, BuzzRenderContext } from "./buzz-render-context";
import { canvasH, canvasW } from "./buzz-render-context";

export interface PosterSpacing {
  sectionGap: number;
  contentPadX: number;
  contentPadY: number;
  footerPad: number;
}

export function posterSpacing(ctx: BuzzRenderContext): PosterSpacing {
  const { aspectRatio, renderHeight, renderWidth } = ctx;

  if (aspectRatio === "4:5") {
    return {
      sectionGap: canvasH(renderHeight, 0.028, 24, 40),
      contentPadX: canvasW(renderWidth, 0.06, 32, 56),
      contentPadY: canvasH(renderHeight, 0.04, 28, 48),
      footerPad: canvasH(renderHeight, 0.022, 14, 22),
    };
  }

  if (aspectRatio === "16:9") {
    return {
      sectionGap: canvasH(renderHeight, 0.035, 20, 36),
      contentPadX: canvasW(renderWidth, 0.05, 48, 96),
      contentPadY: canvasH(renderHeight, 0.06, 24, 40),
      footerPad: canvasH(renderHeight, 0.025, 12, 20),
    };
  }

  return {
    sectionGap: canvasH(renderHeight, 0.032, 20, 36),
    contentPadX: canvasW(renderWidth, 0.065, 32, 56),
    contentPadY: canvasH(renderHeight, 0.045, 28, 44),
    footerPad: canvasH(renderHeight, 0.022, 14, 22),
  };
}

export function isLandscapePoster(ctx: BuzzRenderContext): boolean {
  return ctx.aspectRatio === "16:9";
}

export function isTallPoster(ctx: BuzzRenderContext): boolean {
  return ctx.aspectRatio === "4:5";
}

export function heroTitleSize(ctx: BuzzRenderContext): number {
  if (ctx.aspectRatio === "16:9") return canvasH(ctx.renderHeight, 0.11, 72, 120);
  if (ctx.aspectRatio === "4:5") return canvasH(ctx.renderHeight, 0.075, 64, 100);
  return canvasH(ctx.renderHeight, 0.068, 56, 88);
}

export function heroLogoSize(ctx: BuzzRenderContext): number {
  return canvasH(ctx.renderHeight, 0.14, 140, 180);
}

export function secondaryLabelSize(ctx: BuzzRenderContext): number {
  return canvasH(ctx.renderHeight, 0.018, 14, 20);
}

export function bodyLabelSize(ctx: BuzzRenderContext): number {
  return canvasH(ctx.renderHeight, 0.022, 16, 24);
}
