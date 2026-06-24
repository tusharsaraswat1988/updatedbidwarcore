/**
 * Top Buys — placeholder frame metadata (4:5 featured template)
 *
 * Calibrated to the empty gold-frame background at 1080×1350.
 * Tune these values when the designer updates the master asset —
 * components read from here via the frame metadata registry.
 */

import { BuzzTemplateType } from "../../registry/template-types";
import type { TemplateFrameMetadataEntry } from "../../rendering/template-frame-schema";

export const TOP_BUYS_FEATURED_FRAMES_4_5: TemplateFrameMetadataEntry = {
  templateId: BuzzTemplateType.TOP_BUYS,
  aspectRatio: "4:5",
  frames: {
    /** Upper inner area of the vertical card — excludes logo notch */
    photoFrame: {
      x: 0.244,
      y: 0.328,
      w: 0.420,
      h: 0.188,
      borderRadius: 10,
    },
    /** Small square at bottom-center of the card */
    logoFrame: {
      x: 0.425,
      y: 0.512,
      w: 0.15,
      h: 0.105,
      borderRadius: 6,
    },
    /** Player name + role — strictly below photo/logo, never overlaps photo */
    nameFrame: {
      x: 0.285,
      y: 0.618,
      w: 0.43,
      h: 0.078,
    },
    /** Horizontal podium price box */
    amountFrame: {
      x: 0.212,
      y: 0.748,
      w: 0.576,
      h: 0.062,
    },
    /** Optional rank badge (left gold box) */
    rankFrame: {
      x: 0.188,
      y: 0.348,
      w: 0.085,
      h: 0.042,
    },
  },
};
