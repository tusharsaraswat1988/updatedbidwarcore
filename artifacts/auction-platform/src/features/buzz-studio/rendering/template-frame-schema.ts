/**
 * Template placeholder frame schema (Phase 18.2)
 *
 * Designers define safe-area rectangles on the background asset.
 * Renderers inject content ONLY inside these frames — never hardcode
 * coordinates in React components.
 */

import type { BuzzAspectRatio } from "./buzz-render-context";
import type { BuzzTemplateType } from "../registry/template-types";
import type { PosterZoneRect } from "./template-layout-schema";

/** Normalized placeholder rect (0–1) relative to full poster canvas. */
export interface TemplateFrameRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Inner clip radius in px at 1080×1350 export size; scaled at render time. */
  borderRadius?: number;
}

/** Standard dynamic placeholders for framed poster templates. */
export interface TemplatePlaceholderFrames {
  photoFrame: TemplateFrameRect;
  logoFrame: TemplateFrameRect;
  nameFrame: TemplateFrameRect;
  amountFrame: TemplateFrameRect;
  rankFrame?: TemplateFrameRect;
}

export interface TemplateFrameMetadataEntry {
  templateId: BuzzTemplateType;
  aspectRatio: BuzzAspectRatio;
  frames: TemplatePlaceholderFrames;
}

export function frameToZoneRect(frame: TemplateFrameRect): PosterZoneRect {
  return {
    x: frame.x,
    y: frame.y,
    width: frame.w,
    height: frame.h,
    align: "center",
    valign: "center",
  };
}

/** Pixel dimensions for a frame at the current render canvas size. */
export function resolveFramePixels(
  frame: TemplateFrameRect,
  renderWidth: number,
  renderHeight: number,
) {
  return {
    width: Math.round(frame.w * renderWidth),
    height: Math.round(frame.h * renderHeight),
    borderRadius: frame.borderRadius
      ? Math.round(frame.borderRadius * (renderHeight / 1350))
      : 0,
  };
}
