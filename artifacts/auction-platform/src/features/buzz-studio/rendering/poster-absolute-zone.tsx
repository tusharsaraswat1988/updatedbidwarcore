/**
 * Absolute-positioned poster zone — maps normalized rects to canvas pixels.
 */

import React from "react";
import type { BuzzRenderContext } from "./buzz-render-context";
import type { PosterZoneRect } from "./template-layout-schema";

function alignToFlex(align?: PosterZoneRect["align"]): React.CSSProperties["justifyContent"] {
  if (align === "left") return "flex-start";
  if (align === "right") return "flex-end";
  return "center";
}

function valignToFlex(valign?: PosterZoneRect["valign"]): React.CSSProperties["alignItems"] {
  if (valign === "top") return "flex-start";
  if (valign === "bottom") return "flex-end";
  return "center";
}

export function PosterAbsoluteZone({
  rect,
  ctx,
  children,
}: {
  rect: PosterZoneRect;
  ctx: BuzzRenderContext;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: rect.x * ctx.renderWidth,
        top: rect.y * ctx.renderHeight,
        width: rect.width * ctx.renderWidth,
        height: rect.height * ctx.renderHeight,
        display: "flex",
        alignItems: valignToFlex(rect.valign),
        justifyContent: alignToFlex(rect.align),
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}
