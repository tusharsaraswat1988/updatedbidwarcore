/**
 * Registry of template placeholder frame metadata per template + aspect ratio.
 */

import { BuzzTemplateType } from "../registry/template-types";
import type { BuzzAspectRatio } from "./buzz-render-context";
import type { TemplateFrameMetadataEntry, TemplatePlaceholderFrames } from "./template-frame-schema";
import { TOP_BUYS_FEATURED_FRAMES_4_5 } from "../templates/top-buys/top-buys-frame-metadata";

const FRAME_ENTRIES: TemplateFrameMetadataEntry[] = [
  TOP_BUYS_FEATURED_FRAMES_4_5,
];

const frameIndex = new Map<string, TemplatePlaceholderFrames>();
for (const entry of FRAME_ENTRIES) {
  frameIndex.set(`${entry.templateId}:${entry.aspectRatio}`, entry.frames);
}

export function getTemplatePlaceholderFrames(
  templateId: BuzzTemplateType,
  aspectRatio: BuzzAspectRatio,
): TemplatePlaceholderFrames | undefined {
  return frameIndex.get(`${templateId}:${aspectRatio}`);
}

export function getTemplateFrameMetadataEntry(
  templateId: BuzzTemplateType,
  aspectRatio: BuzzAspectRatio,
): TemplateFrameMetadataEntry | undefined {
  return FRAME_ENTRIES.find(
    (e) => e.templateId === templateId && e.aspectRatio === aspectRatio,
  );
}
