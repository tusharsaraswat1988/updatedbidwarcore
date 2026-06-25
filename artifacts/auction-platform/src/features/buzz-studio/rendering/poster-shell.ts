/**
 * Shared full-bleed poster column/row shells for templates.
 */

import type { CSSProperties } from "react";
import type { BuzzRenderContext } from "./buzz-render-context";
import { isLandscapePoster, isTallPoster, posterSpacing } from "./poster-layout";

export function posterColumnRoot(ctx: BuzzRenderContext): CSSProperties {
  const spacing = posterSpacing(ctx);
  return {
    display: "flex",
    flexDirection: "column",
    width: "100%",
    height: "100%",
    flex: 1,
    minHeight: 0,
    gap: isTallPoster(ctx) ? spacing.sectionGap * 1.1 : spacing.sectionGap,
  };
}

export function posterColumnBody(): CSSProperties {
  return {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    justifyContent: "flex-end",
    width: "100%",
    minHeight: 0,
  };
}

export function posterLandscapeRoot(ctx: BuzzRenderContext): CSSProperties {
  return {
    display: "flex",
    flexDirection: "row",
    alignItems: "stretch",
    width: "100%",
    height: "100%",
    flex: 1,
    gap: posterSpacing(ctx).sectionGap * 1.4,
    minHeight: 0,
  };
}

export function posterLandscapeMain(): CSSProperties {
  return {
    flex: 1.1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  };
}

export function posterLandscapeSide(): CSSProperties {
  return {
    flex: 0.9,
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
  };
}

export function posterUsesLandscape(ctx: BuzzRenderContext): boolean {
  return isLandscapePoster(ctx);
}
